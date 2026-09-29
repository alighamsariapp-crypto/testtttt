<?php

namespace App\Modules\Orders\Services;

use App\Modules\Cart\Models\Cart;
use App\Modules\Inventory\Services\InventoryService;
use App\Modules\Orders\Models\Order;
use App\Modules\Payments\Services\PaymentService;
use App\Modules\Settings\Services\CheckoutConfigurationService;
use App\Modules\Shared\Contracts\BaseServiceInterface;
use App\Modules\Shared\Exceptions\DomainException;
use App\Modules\Shared\ValueObjects\Money;
use App\Modules\Users\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CheckoutService implements BaseServiceInterface
{
    public function __construct(
        private readonly InventoryService $inventoryService,
        private readonly PaymentService $paymentService,
        private readonly CheckoutConfigurationService $checkoutConfiguration
    ) {
    }

    /**
     * Executes atomic, zero-trust checkout transaction
     */
    public function processCheckout(User $user, Cart $cart, array $data): array
    {
        $cart->load(['items.variant.product', 'items.variant.inventory']);

        if ($cart->items->isEmpty()) {
            throw new DomainException('Cannot checkout with an empty shopping cart.', 'EMPTY_CART', 400);
        }

        $idempotencyKey = trim((string) ($data['idempotency_key'] ?? ''));
        if (!preg_match('/^[A-Za-z0-9][A-Za-z0-9_:-]{15,127}$/', $idempotencyKey)) {
            throw new DomainException('A valid checkout idempotency key is required.', 'INVALID_IDEMPOTENCY_KEY', 422);
        }

        $fingerprintPayload = [
            'user_id' => $user->id,
            'cart' => $cart->items->map(fn ($item) => [(int) $item->variant_id, (int) $item->quantity])->sortBy(fn ($item) => $item[0])->values()->all(),
            'shipping_address' => $data['shipping_address'] ?? [],
            'billing_address' => $data['billing_address'] ?? [],
            'shipping_method' => $data['shipping_method'] ?? null,
            'payment_gateway' => $data['payment_gateway'] ?? null,
            'coupon_code' => $data['coupon_code'] ?? $data['discount_code'] ?? null,
        ];
        $requestHash = hash('sha256', json_encode($fingerprintPayload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        $lock = Cache::lock("checkout:{$user->id}:{$idempotencyKey}", 60);
        try {
            $lock->block(10);
        } catch (\Throwable) {
            throw new DomainException('This checkout is already being processed. Please retry with the same request.', 'CHECKOUT_IN_PROGRESS', 409);
        }

        try {
            $existing = Order::query()->where('user_id', $user->id)->where('checkout_idempotency_key', $idempotencyKey)->with(['items', 'payments'])->first();
            if ($existing) {
                if (!hash_equals((string) $existing->checkout_request_hash, $requestHash)) {
                    throw new DomainException('The idempotency key was already used for a different checkout.', 'IDEMPOTENCY_KEY_REUSED', 409);
                }
                $payment = $existing->payments->sortByDesc('id')->first();
                return ['order' => $existing, 'payment' => $payment, 'payment_intent' => is_array($payment?->gateway_response) ? ($payment->gateway_response['intent'] ?? []) : []];
            }

            return DB::transaction(function () use ($user, $cart, $data, $idempotencyKey, $requestHash) {
            $currency = null;
            $subtotal = null;
            $orderItemsData = [];

            // 1. Lock and validate inventory atomically for every item
            foreach ($cart->items as $item) {
                $variant = $item->variant;
                if (!$variant || !$variant->product || !$variant->is_active || !$variant->product->is_active) {
                    throw new DomainException("Product or variant is no longer available.", 'INVALID_CART_PRODUCT', 400);
                }

                // Pessimistic lock row & decrement
                $this->inventoryService->decrementStock($variant->id, $item->quantity);

                $itemCurrency = $variant->product->currency ?? 'IRR';
                if ($currency === null) {
                    $currency = $itemCurrency;
                    $subtotal = Money::zero($currency);
                } elseif ($itemCurrency !== $currency) {
                    throw new DomainException('Cart items must use the same currency.', 'CART_CURRENCY_MISMATCH', 422);
                }

                $unitPrice = Money::from($variant->effective_price, $currency);
                $itemTotal = $unitPrice->multiply($item->quantity);
                $subtotal = $subtotal->add($itemTotal);

                $orderItemsData[] = [
                    'product_variant_id' => $variant->id,
                    'product_name_snapshot' => $variant->product->name,
                    'variant_sku_snapshot' => $variant->sku,
                    'variant_attributes_snapshot' => $variant->attributes,
                    'unit_price' => $unitPrice->getAmount(),
                    'quantity' => $item->quantity,
                    'discount_amount' => 0,
                    'tax_amount' => 0,
                    'total_price' => $itemTotal->getAmount(),
                ];
            }

            $currency ??= 'IRR';
            $subtotal ??= Money::zero($currency);

            // 2. Server-side zero-trust tax & totals calculation
            $taxRate = 0.09; // 9% standard tax
            $tax = $subtotal->multiply($taxRate);
            $checkoutConfig = $this->checkoutConfiguration->get();
            $shippingMethod = $this->checkoutConfiguration->resolveShipping(
                $data['shipping_method'] ?? $checkoutConfig['shipping']['default_method_id'],
                $subtotal->getAmount()
            );
            $shipping = Money::from($shippingMethod['cost'], $currency);
            $grandTotal = $subtotal->add($tax)->add($shipping);

            // 3. Create authoritative order record
            $orderNumber = 'ORD-'.date('Ymd').'-'.strtoupper(Str::random(6));

            $order = Order::create([
                'order_number' => $orderNumber,
                'user_id' => $user->id,
                'checkout_idempotency_key' => $idempotencyKey,
                'checkout_request_hash' => $requestHash,
                'status' => Order::STATUS_PENDING,
                'payment_status' => 'pending',
                'subtotal' => $subtotal->getAmount(),
                'discount_total' => 0,
                'tax_total' => $tax->getAmount(),
                'shipping_total' => $shipping->getAmount(),
                'grand_total' => $grandTotal->getAmount(),
                'currency' => $currency,
                'shipping_address_snapshot' => [
                    ...$data['shipping_address'],
                    'shipping_method' => [
                        'id' => $shippingMethod['id'],
                        'title' => $shippingMethod['title'],
                        'cost' => $shipping->getAmount(),
                    ],
                ],
                'billing_address_snapshot' => $data['billing_address'] ?? $data['shipping_address'],
                'notes' => $data['notes'] ?? null,
            ]);

            // 4. Create snapshot order items
            foreach ($orderItemsData as $orderItem) {
                $order->items()->create($orderItem);
            }

            // 5. Clear user cart
            $cart->items()->delete();

            // 6. Initialize Payment Intent
            $gatewayName = $data['payment_gateway'] ?? 'test';
            $paymentResult = $this->paymentService->createPaymentForOrder($order, $gatewayName);

            return [
                'order' => $order->load('items'),
                'payment' => $paymentResult['payment'],
                'payment_intent' => $paymentResult['intent'],
            ];
            });
        } finally {
            $lock->release();
        }
    }
}
