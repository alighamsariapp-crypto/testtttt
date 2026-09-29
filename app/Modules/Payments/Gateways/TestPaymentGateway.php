<?php

namespace App\Modules\Payments\Gateways;

use App\Modules\Orders\Models\Order;
use App\Modules\Payments\Contracts\PaymentGatewayInterface;
use App\Modules\Payments\Models\Payment;
use Illuminate\Support\Str;

/**
 * Test Simulator Payment Gateway Adapter
 *
 * Contract:
 * - reference_id: Internal test transaction reference
 * - gateway_payment_id: Simulated provider payment identifier
 */
class TestPaymentGateway implements PaymentGatewayInterface
{
    public function getName(): string
    {
        return 'test';
    }

    public function createPaymentIntent(Order $order, Payment $payment): array
    {
        $reference = 'TEST-'.strtoupper(Str::random(12));
        $payment->reference_id = $reference;
        $payment->gateway_payment_id = $reference;
        $payment->save();

        return [
            'gateway' => 'test',
            'action' => 'redirect_or_mock',
            'reference_id' => $reference,
            'payment_url' => url("/payment-status?order_number={$order->order_number}&payment_status=pending"),
        ];
    }

    public function verifyWebhook(array $payload, array $headers): array
    {
        return [
            'is_valid' => true,
            'reference_id' => $payload['reference_id'] ?? null,
            'status' => $payload['status'] ?? 'paid',
            'raw' => $payload,
        ];
    }
}
