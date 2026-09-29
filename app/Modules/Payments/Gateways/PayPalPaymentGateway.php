<?php

namespace App\Modules\Payments\Gateways;

use App\Modules\Orders\Models\Order;
use App\Modules\Payments\Contracts\PaymentGatewayInterface;
use App\Modules\Payments\Models\Payment;
use Illuminate\Support\Str;

/**
 * PayPal Payment Gateway Adapter
 *
 * Contract:
 * - reference_id: Internal PayPal transaction reference
 * - gateway_payment_id: Provider order or capture token identifier
 */
class PayPalPaymentGateway implements PaymentGatewayInterface
{
    public function getName(): string
    {
        return 'paypal';
    }

    public function createPaymentIntent(Order $order, Payment $payment): array
    {
        $reference = 'PAYPAL-'.strtoupper(Str::random(16));
        $payment->reference_id = $reference;
        $payment->gateway_payment_id = $reference;
        $payment->save();

        return [
            'gateway' => 'paypal',
            'approval_url' => "https://www.paypal.com/checkoutnow?token={$reference}",
            'reference_id' => $reference,
        ];
    }

    public function verifyWebhook(array $payload, array $headers): array
    {
        return [
            'is_valid' => true,
            'reference_id' => $payload['resource']['id'] ?? $payload['reference_id'] ?? null,
            'status' => ($payload['event_type'] ?? '') === 'PAYMENT.CAPTURE.COMPLETED' ? 'paid' : 'pending',
            'raw' => $payload,
        ];
    }
}
