<?php

namespace App\Modules\Payments\Gateways;

use App\Modules\Orders\Models\Order;
use App\Modules\Payments\Contracts\PaymentGatewayInterface;
use App\Modules\Payments\Models\Payment;
use App\Modules\Settings\Services\CheckoutConfigurationService;
use App\Modules\Shared\Exceptions\DomainException;
use Illuminate\Support\Facades\Http;

/**
 * Zibal Payment Gateway Adapter
 *
 * Contract:
 * - reference_id: Internal/order reference identifier
 * - gateway_payment_id: Provider-assigned payment/tracking ID (Zibal trackId)
 */
class ZibalPaymentGateway implements PaymentGatewayInterface
{
    private const BASE_URL = 'https://gateway.zibal.ir';

    public function __construct(private readonly CheckoutConfigurationService $checkoutConfiguration)
    {
    }

    public function getName(): string
    {
        return 'zibal';
    }

    public function createPaymentIntent(Order $order, Payment $payment): array
    {
        $credentials = $this->checkoutConfiguration->zibalCredentials();
        $response = Http::acceptJson()
            ->asJson()
            ->timeout(15)
            ->post(self::BASE_URL.'/v1/request', [
                'merchant' => $credentials['merchant'],
                'amount' => $payment->amount,
                'callbackUrl' => route('payments.zibal.callback'),
                'description' => "پرداخت سفارش {$order->order_number}",
                'orderId' => $order->order_number,
                'mobile' => (string) ($order->shipping_address_snapshot['phone'] ?? ''),
            ]);

        $body = $response->json();
        $trackId = is_array($body) ? ($body['trackId'] ?? null) : null;
        $result = is_array($body) ? (int) ($body['result'] ?? 0) : 0;

        if (!$response->successful() || $result !== 100 || !is_numeric($trackId)) {
            throw new DomainException(
                'Could not initialize the Zibal payment. Please try again.',
                'ZIBAL_PAYMENT_REQUEST_FAILED',
                502
            );
        }

        $payment->reference_id = (string) $trackId;
        $payment->gateway_payment_id = (string) $trackId;
        $payment->gateway_response = [
            'request' => [
                'track_id' => (string) $trackId,
                'result' => $result,
                'sandbox' => $credentials['sandbox'],
            ],
        ];
        $payment->save();

        return [
            'gateway' => 'zibal',
            'action' => 'redirect',
            'reference_id' => (string) $trackId,
            'payment_url' => self::BASE_URL.'/start/'.rawurlencode((string) $trackId),
        ];
    }

    /**
     * Verify a callback only after locating the pending payment by its track id in our database.
     */
    public function verifyPayment(Payment $payment): array
    {
        $credentials = $this->checkoutConfiguration->zibalCredentials();
        $response = Http::acceptJson()
            ->asJson()
            ->timeout(15)
            ->post(self::BASE_URL.'/v1/verify', [
                'merchant' => $credentials['merchant'],
                'trackId' => (int) $payment->reference_id,
            ]);

        $body = $response->json();
        $result = is_array($body) ? (int) ($body['result'] ?? 0) : 0;
        $providerAmount = is_array($body) ? ($body['amount'] ?? $body['paidAmount'] ?? null) : null;
        $amountValid = is_numeric($providerAmount) && (int) $providerAmount === (int) $payment->amount;
        $resultValid = $response->successful() && in_array($result, [100, 201], true);

        return [
            'is_valid' => $resultValid && $amountValid,
            'reference_id' => (string) $payment->reference_id,
            'status' => $resultValid && $amountValid ? 'paid' : 'failed',
            'result_code' => $result,
            'amount_match' => $amountValid,
            'expected_amount' => (int) $payment->amount,
            'provider_amount' => is_numeric($providerAmount) ? (int) $providerAmount : null,
            'raw' => is_array($body) ? $body : [],
        ];
    }

    public function verifyWebhook(array $payload, array $headers): array
    {
        // Zibal's browser callback is finalized through verifyPayment(), not trusted directly.
        return [
            'is_valid' => false,
            'reference_id' => $payload['trackId'] ?? null,
            'status' => 'pending',
            'raw' => $payload,
        ];
    }
}
