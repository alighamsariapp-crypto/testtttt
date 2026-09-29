<?php

namespace App\Modules\Payments\Gateways;

use App\Modules\Orders\Models\Order;
use App\Modules\Payments\Contracts\PaymentGatewayInterface;
use App\Modules\Payments\Models\Payment;
use Illuminate\Support\Str;

/**
 * Stripe Payment Gateway Adapter
 *
 * Contract:
 * - reference_id: Internal Stripe reference
 * - gateway_payment_id: Stripe PaymentIntent identifier (pi_...)
 */
class StripePaymentGateway implements PaymentGatewayInterface
{
    public function getName(): string
    {
        return 'stripe';
    }

    public function createPaymentIntent(Order $order, Payment $payment): array
    {
        $reference = 'pi_mock_'.Str::random(24);
        $payment->reference_id = $reference;
        $payment->gateway_payment_id = $reference;
        $payment->save();

        return [
            'gateway' => 'stripe',
            'client_secret' => $reference.'_secret_'.Str::random(10),
            'reference_id' => $reference,
        ];
    }

    public function verifyWebhook(array $payload, array $headers): array
    {
        $sigHeader = $headers['stripe-signature'] ?? null;
        // In production: \Stripe\Webhook::constructEvent($payload, $sigHeader, env('STRIPE_WEBHOOK_SECRET'));
        return [
            'is_valid' => !empty($sigHeader) || env('APP_ENV') === 'testing',
            'reference_id' => $payload['data']['object']['id'] ?? $payload['reference_id'] ?? null,
            'status' => ($payload['type'] ?? '') === 'payment_intent.succeeded' ? 'paid' : 'pending',
            'raw' => $payload,
        ];
    }
}
