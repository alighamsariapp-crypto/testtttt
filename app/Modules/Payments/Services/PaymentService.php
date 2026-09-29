<?php

namespace App\Modules\Payments\Services;

use App\Modules\Orders\Models\Order;
use App\Modules\Payments\Contracts\PaymentGatewayInterface;
use App\Modules\Payments\Gateways\BankTransferGateway;
use App\Modules\Payments\Gateways\PayPalPaymentGateway;
use App\Modules\Payments\Gateways\StripePaymentGateway;
use App\Modules\Payments\Gateways\TestPaymentGateway;
use App\Modules\Payments\Gateways\WalletPaymentGateway;
use App\Modules\Payments\Gateways\ZibalPaymentGateway;
use App\Modules\Payments\Models\Payment;
use App\Modules\Payments\Models\PaymentTransaction;
use App\Modules\Settings\Services\CheckoutConfigurationService;
use App\Modules\Settings\Services\SmsConfigurationService;
use App\Modules\Settings\Services\SystemSmsNotifier;
use App\Modules\Shared\Contracts\BaseServiceInterface;
use App\Modules\Shared\Contracts\IdempotencyInterface;
use App\Modules\Shared\Exceptions\DomainException;
use App\Modules\Shared\Exceptions\EntityNotFoundException;
use Illuminate\Contracts\Cache\Lock;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class PaymentService implements BaseServiceInterface, IdempotencyInterface
{
    private array $gateways;

    /** @var array<string, Lock> */
    private array $activeLocks = [];

    public function __construct(
        private readonly CheckoutConfigurationService $checkoutConfiguration,
        private readonly SystemSmsNotifier $systemSmsNotifier,
    )
    {
        $this->gateways = [
            'test' => new TestPaymentGateway(),
            'zibal' => new ZibalPaymentGateway($this->checkoutConfiguration),
            'stripe' => new StripePaymentGateway(),
            'paypal' => new PayPalPaymentGateway(),
            'bank_transfer' => new BankTransferGateway($this->checkoutConfiguration),
            'wallet' => new WalletPaymentGateway(),
        ];
    }

    public function getGateway(string $name): PaymentGatewayInterface
    {
        if ($name === 'test' && ((function_exists('app') && app()->environment('production')) || config('app.env') === 'production')) {
            throw new DomainException("Test payment gateway is disabled in production environment.", 'UNSUPPORTED_GATEWAY', 422);
        }

        if (!isset($this->gateways[$name])) {
            throw new DomainException("Unsupported payment gateway: {$name}", 'UNSUPPORTED_GATEWAY', 422);
        }

        return $this->gateways[$name];
    }

    public function createPaymentForOrder(Order $order, string $gatewayName): array
    {
        $this->checkoutConfiguration->assertPaymentGatewayEnabled($gatewayName);
        $gateway = $this->getGateway($gatewayName);

        $payment = Payment::create([
            'order_id' => $order->id,
            'gateway' => $gatewayName,
            'amount' => $order->grand_total,
            'currency' => $order->currency,
            'status' => Payment::STATUS_PENDING,
        ]);

        $intent = $gateway->createPaymentIntent($order, $payment);

        $payment->gateway_response = [
            ...($payment->gateway_response ?? []),
            'intent' => $intent,
        ];
        $payment->save();

        if ($payment->status === Payment::STATUS_PAID) {
            $this->queuePaidOrderSms($order);
        }

        return [
            'payment' => $payment,
            'intent' => $intent,
        ];
    }

    /**
     * Finish a Zibal browser callback. The callback is never trusted until the verify API succeeds.
     */
    public function completeZibalPayment(string $trackId, bool $callbackSucceeded): array
    {
        $cleanTrackId = $this->normalizeIdempotencyKey($trackId);
        $lockKey = "zibal_callback_lock:{$cleanTrackId}";
        $lock = null;
        try {
            $lock = $this->createLock($lockKey, 15);
            $lock->block(5);
        } catch (\Throwable) {}

        try {
            return DB::transaction(function () use ($cleanTrackId, $callbackSucceeded): array {
                $payment = Payment::query()
                    ->where('gateway', 'zibal')
                    ->where(function ($q) use ($cleanTrackId) {
                        $q->where('gateway_payment_id', $cleanTrackId)
                            ->orWhere('reference_id', $cleanTrackId);
                    })
                    ->lockForUpdate()
                    ->first();

                if (!$payment) {
                    throw new EntityNotFoundException("Zibal payment with track ID {$cleanTrackId} was not found.");
                }

                $order = $payment->order()->lockForUpdate()->firstOrFail();

                // If already marked as paid, return idempotent result immediately
                if ($payment->status === Payment::STATUS_PAID) {
                    return $this->paymentCompletionResult($payment, $order, true);
                }

                if (!$callbackSucceeded) {
                    if ($payment->status === Payment::STATUS_PENDING) {
                        $payment->status = Payment::STATUS_CANCELLED;
                        $payment->gateway_response = [
                            ...($payment->gateway_response ?? []),
                            'callback' => ['success' => false],
                        ];
                        $payment->save();
                        $order->payment_status = Payment::STATUS_CANCELLED;
                        $order->save();
                    }

                    return $this->paymentCompletionResult($payment, $order, false, 'PAYMENT_CANCELLED');
                }

                $gateway = $this->getGateway('zibal');
                if (!$gateway instanceof ZibalPaymentGateway) {
                    throw new DomainException('Zibal payment gateway is not configured.', 'ZIBAL_GATEWAY_UNAVAILABLE', 503);
                }

                $verified = $gateway->verifyPayment($payment);
                $resultCode = (string) ($verified['result_code'] ?? 'unknown');
                $idempotencyKey = $this->normalizeIdempotencyKey("zibal_verify_{$payment->reference_id}_{$resultCode}");

                // Ensure transaction entry is created idempotently
                PaymentTransaction::firstOrCreate(
                    [
                        'idempotency_key' => $idempotencyKey,
                    ],
                    [
                        'payment_id' => $payment->id,
                        'event_type' => $verified['status'],
                        'payload' => $verified['raw'] ?? [],
                        'is_reconciled' => (bool) ($verified['is_valid'] ?? false),
                    ]
                );

                $payment->gateway_response = [
                    ...($payment->gateway_response ?? []),
                    'verification' => $verified['raw'] ?? [],
                    'verification_result' => $resultCode,
                ];

                if (($verified['is_valid'] ?? false) === true) {
                    if ($payment->status !== Payment::STATUS_PAID) {
                        $payment->status = Payment::STATUS_PAID;
                        $payment->save();
                    }

                    if ($order->status !== Order::STATUS_PAID) {
                        $order->status = Order::STATUS_PAID;
                        $order->payment_status = Payment::STATUS_PAID;
                        $order->save();
                        $this->queuePaidOrderSms($order);
                    }

                    return $this->paymentCompletionResult($payment, $order, true);
                }

                if ($payment->status === Payment::STATUS_PENDING) {
                    $payment->status = Payment::STATUS_FAILED;
                    $payment->save();
                    $order->payment_status = Payment::STATUS_FAILED;
                    $order->save();
                }

                return $this->paymentCompletionResult($payment, $order, false, 'PAYMENT_VERIFICATION_FAILED');
            });
        } catch (QueryException $e) {
            if ($this->isDuplicateKeyException($e)) {
                $payment = Payment::query()
                    ->where('gateway', 'zibal')
                    ->where(function ($q) use ($cleanTrackId) {
                        $q->where('gateway_payment_id', $cleanTrackId)
                            ->orWhere('reference_id', $cleanTrackId);
                    })
                    ->first();
                if ($payment) {
                    $order = $payment->order;
                    return $this->paymentCompletionResult($payment, $order, $payment->status === Payment::STATUS_PAID);
                }
            }
            throw $e;
        } finally {
            if ($lock) {
                try {
                    $lock->release();
                } catch (\Throwable) {}
            }
        }
    }

    public function processWebhook(string $gatewayName, array $payload, array $headers, ?string $idempotencyKey = null): array
    {
        $gateway = $this->getGateway($gatewayName);
        $verified = $gateway->verifyWebhook($payload, $headers);

        if (!$verified['is_valid']) {
            throw new DomainException('Webhook signature verification failed.', 'INVALID_WEBHOOK_SIGNATURE', 400);
        }

        $referenceId = $verified['reference_id'];
        $status = $verified['status'];

        $key = $this->deriveWebhookIdempotencyKey($gatewayName, $payload, $idempotencyKey, $referenceId, $status);

        // Bounded lock (15s TTL, 5s wait) acquired before checking or mutating payment state
        $lockKey = "webhook_lock:{$key}";
        $lock = null;
        try {
            $lock = $this->createLock($lockKey, 15);
            $lock->block(5);
        } catch (\Throwable) {}

        try {
            return DB::transaction(function () use ($referenceId, $status, $key, $payload, $gatewayName): array {
                // Secondary check inside transaction after acquiring lock
                $existingTx = PaymentTransaction::where('idempotency_key', $key)->first();
                if ($existingTx) {
                    return [
                        'status' => 'already_processed',
                        'idempotency_key' => $key,
                        'payment_id' => $existingTx->payment_id,
                        'payment_status' => $existingTx->payment?->status ?? $existingTx->event_type,
                    ];
                }

                $payment = Payment::where('reference_id', $referenceId)
                    ->orWhere('gateway_payment_id', $referenceId)
                    ->lockForUpdate()
                    ->first();

                if (!$payment) {
                    throw new EntityNotFoundException("Payment with reference {$referenceId} not found.");
                }

                if ($payment->gateway !== $gatewayName) {
                    throw new DomainException("Gateway mismatch: payment {$payment->id} belongs to '{$payment->gateway}', cannot process via '{$gatewayName}'.", 'GATEWAY_MISMATCH', 422);
                }

                // Check again after payment row lock
                $existingTx = PaymentTransaction::where('idempotency_key', $key)->first();
                if ($existingTx) {
                    return [
                        'status' => 'already_processed',
                        'idempotency_key' => $key,
                        'payment_id' => $existingTx->payment_id,
                        'payment_status' => $payment->status,
                    ];
                }

                // State machine guard: Prevent invalid status downgrade if payment is already in terminal state
                if ($payment->status === Payment::STATUS_PAID && in_array($status, ['pending', 'failed', 'cancelled'], true)) {
                    PaymentTransaction::firstOrCreate(
                        ['idempotency_key' => $key],
                        [
                            'payment_id' => $payment->id,
                            'event_type' => $status,
                            'payload' => $payload,
                            'is_reconciled' => false,
                        ]
                    );

                    return [
                        'status' => 'ignored_downgrade',
                        'idempotency_key' => $key,
                        'payment_id' => $payment->id,
                        'payment_status' => $payment->status,
                    ];
                }

                PaymentTransaction::create([
                    'payment_id' => $payment->id,
                    'idempotency_key' => $key,
                    'event_type' => $status,
                    'payload' => $payload,
                    'is_reconciled' => true,
                ]);

                if ($status === 'paid' && $payment->status !== Payment::STATUS_PAID) {
                    $payment->status = Payment::STATUS_PAID;
                    $payment->save();

                    $order = $payment->order;
                    if ($order && $order->status !== Order::STATUS_PAID) {
                        $order->status = Order::STATUS_PAID;
                        $order->payment_status = Payment::STATUS_PAID;
                        $order->save();
                        $this->queuePaidOrderSms($order);
                    }
                } elseif ($status === 'failed' && $payment->status === Payment::STATUS_PENDING) {
                    $payment->status = Payment::STATUS_FAILED;
                    $payment->save();

                    $order = $payment->order;
                    if ($order && $order->payment_status === Payment::STATUS_PENDING) {
                        $order->payment_status = Payment::STATUS_FAILED;
                        $order->save();
                    }
                }

                return [
                    'status' => 'success',
                    'payment_id' => $payment->id,
                    'payment_status' => $payment->status,
                    'idempotency_key' => $key,
                ];
            });
        } catch (QueryException $e) {
            // Catch unique constraint race condition and return existing transaction cleanly
            if ($this->isDuplicateKeyException($e)) {
                $existingTx = PaymentTransaction::where('idempotency_key', $key)->first();
                if ($existingTx) {
                    return [
                        'status' => 'already_processed',
                        'idempotency_key' => $key,
                        'payment_id' => $existingTx->payment_id,
                        'payment_status' => $existingTx->payment?->status ?? 'paid',
                    ];
                }
            }
            throw $e;
        } finally {
            if ($lock) {
                try {
                    $lock->release();
                } catch (\Throwable) {}
            }
        }
    }

    /**
     * Dedicated test payment simulation strictly for TestPaymentGateway.
     * Impossible to mark live payments (Zibal, Stripe, PayPal) as paid.
     */
    public function simulateTestPayment(Payment $payment, string $idempotencyKey): array
    {
        if ($payment->gateway !== 'test') {
            throw new DomainException("Live or non-test payment {$payment->id} cannot be simulated. Gateway '{$payment->gateway}' requires official provider verification.", 'LIVE_PAYMENT_SIMULATION_FORBIDDEN', 422);
        }

        $gateway = $this->getGateway('test');
        if (!$gateway instanceof TestPaymentGateway) {
            throw new DomainException('Test payment gateway is unavailable or not configured.', 'TEST_GATEWAY_UNAVAILABLE', 500);
        }

        $normalizedKey = $this->normalizeIdempotencyKey($idempotencyKey);
        $lockKey = "simulate_payment_lock:{$payment->id}";
        $lock = null;
        try {
            $lock = $this->createLock($lockKey, 15);
            $lock->block(5);
        } catch (\Throwable) {}

        try {
            return DB::transaction(function () use ($payment, $normalizedKey): array {
                $payment = Payment::where('id', $payment->id)->lockForUpdate()->first();

                // Check existing transaction by key
                $existingTx = PaymentTransaction::where('idempotency_key', $normalizedKey)->first();
                if ($existingTx) {
                    return [
                        'status' => 'already_paid',
                        'payment_id' => $payment->id,
                        'payment_status' => $payment->status,
                        'order_number' => $payment->order?->order_number,
                    ];
                }

                if ($payment->status === Payment::STATUS_PAID) {
                    return [
                        'status' => 'already_paid',
                        'payment_id' => $payment->id,
                        'payment_status' => $payment->status,
                        'order_number' => $payment->order?->order_number,
                    ];
                }

                PaymentTransaction::firstOrCreate(
                    [
                        'idempotency_key' => $normalizedKey,
                    ],
                    [
                        'payment_id' => $payment->id,
                        'event_type' => 'paid',
                        'payload' => [
                            'simulated' => true,
                            'gateway' => 'test',
                            'timestamp' => now()->toIso8601String(),
                        ],
                        'is_reconciled' => true,
                    ]
                );

                $payment->status = Payment::STATUS_PAID;
                $payment->gateway_response = array_merge($payment->gateway_response ?? [], [
                    'simulated' => true,
                    'simulated_at' => now()->toIso8601String(),
                ]);
                $payment->save();

                $order = $payment->order;
                if ($order && $order->status !== Order::STATUS_PAID) {
                    $order->status = Order::STATUS_PAID;
                    $order->payment_status = Payment::STATUS_PAID;
                    $order->save();
                    $this->queuePaidOrderSms($order);
                }

                return [
                    'status' => 'success',
                    'payment_id' => $payment->id,
                    'payment_status' => $payment->status,
                    'order_number' => $order?->order_number,
                ];
            });
        } catch (QueryException $e) {
            if ($this->isDuplicateKeyException($e)) {
                $existingTx = PaymentTransaction::where('idempotency_key', $normalizedKey)->first();
                if ($existingTx) {
                    return [
                        'status' => 'already_paid',
                        'payment_id' => $existingTx->payment_id,
                        'payment_status' => $existingTx->payment?->status ?? 'paid',
                        'order_number' => $existingTx->payment?->order?->order_number,
                    ];
                }
            }
            throw $e;
        } finally {
            if ($lock) {
                try {
                    $lock->release();
                } catch (\Throwable) {}
            }
        }
    }

    public function isProcessed(string $idempotencyKey): bool
    {
        $normalized = $this->normalizeIdempotencyKey($idempotencyKey);
        return PaymentTransaction::where('idempotency_key', $normalized)->exists();
    }

    public function lockKey(string $idempotencyKey, int $ttlSeconds = 60, ?string $owner = null): bool
    {
        $normalized = $this->normalizeIdempotencyKey($idempotencyKey);
        $lockKey = "payment_idempotency_lock:{$normalized}";
        $lockOwner = $owner ?? Str::random(32);
        $lock = $this->createLock($lockKey, $ttlSeconds, $lockOwner);

        if ($lock->get()) {
            $this->activeLocks[$normalized] = [
                'lock' => $lock,
                'owner' => $lockOwner,
            ];
            return true;
        }

        return false;
    }

    public function releaseKey(string $idempotencyKey, ?string $owner = null): void
    {
        $normalized = $this->normalizeIdempotencyKey($idempotencyKey);
        if (isset($this->activeLocks[$normalized])) {
            $active = $this->activeLocks[$normalized];
            if ($owner !== null && $active['owner'] !== $owner) {
                return;
            }
            try {
                $active['lock']->release();
            } catch (\Throwable) {}
            unset($this->activeLocks[$normalized]);
        } elseif ($owner !== null) {
            try {
                $lockKey = "payment_idempotency_lock:{$normalized}";
                $lock = $this->createLock($lockKey, 60, $owner);
                $lock->release();
            } catch (\Throwable) {}
        }
    }

    public function normalizeIdempotencyKey(string $key): string
    {
        $clean = trim($key);
        $sanitized = preg_replace('/[^a-zA-Z0-9_\-:]/', '_', $clean) ?? $clean;
        return substr($sanitized, 0, 128);
    }

    private function createLock(string $name, int $ttlSeconds = 60, ?string $owner = null): Lock
    {
        $owner = $owner ?? Str::random(32);
        try {
            return Cache::store('database')->lock($name, $ttlSeconds, $owner);
        } catch (\Throwable) {
            return Cache::lock($name, $ttlSeconds, $owner);
        }
    }

    private function deriveWebhookIdempotencyKey(string $gatewayName, array $payload, ?string $providedKey, ?string $referenceId, string $status): string
    {
        if (!empty($providedKey) && is_string($providedKey)) {
            return $this->normalizeIdempotencyKey($providedKey);
        }

        $providerEventId = $payload['id']
            ?? $payload['event_id']
            ?? ($payload['resource']['id'] ?? null)
            ?? ($payload['data']['object']['id'] ?? null);

        if (!empty($providerEventId) && is_string($providerEventId)) {
            return $this->normalizeIdempotencyKey("{$gatewayName}_{$providerEventId}");
        }

        $cleanRef = trim((string) ($referenceId ?? 'none'));
        $cleanStatus = trim(strtolower($status));
        return $this->normalizeIdempotencyKey("webhook_{$gatewayName}_{$cleanRef}_{$cleanStatus}");
    }

    private function isDuplicateKeyException(QueryException $e): bool
    {
        $code = (string) $e->getCode();
        $message = strtolower($e->getMessage());
        return $code === '23000'
            || str_contains($message, 'unique')
            || str_contains($message, 'duplicate')
            || str_contains($message, 'integrity constraint');
    }

    private function queuePaidOrderSms(Order $order): void
    {
        $eventKey = "order-paid-{$order->id}";

        if (\App\Modules\Settings\Models\SmsDelivery::where('event_key', $eventKey)->exists()) {
            return;
        }

        $order->loadMissing('user');
        $this->systemSmsNotifier->queue(
            SmsConfigurationService::EVENT_ORDER_PAID,
            $eventKey,
            $order->user?->phone,
            [
                'name' => trim((string) ($order->user?->name ?? 'مشتری گرامی')) ?: 'مشتری گرامی',
                'order_number' => $order->order_number,
                'amount' => (int) $order->grand_total,
            ]
        );
    }

    private function paymentCompletionResult(Payment $payment, Order $order, bool $paid, ?string $errorCode = null): array
    {
        return [
            'paid' => $paid,
            'payment_status' => $payment->status,
            'order_id' => $order->id,
            'user_id' => $order->user_id,
            'order_number' => $order->order_number,
            'amount' => $payment->amount,
            'currency' => $payment->currency,
            'reference_id' => $payment->reference_id,
            'error_code' => $errorCode,
        ];
    }
}
