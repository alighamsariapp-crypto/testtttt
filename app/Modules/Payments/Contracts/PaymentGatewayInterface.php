<?php

namespace App\Modules\Payments\Contracts;

use App\Modules\Orders\Models\Order;
use App\Modules\Payments\Models\Payment;

interface PaymentGatewayInterface
{
    public function getName(): string;

    /**
     * Initializes payment and returns checkout/redirect URL or intent payload
     */
    public function createPaymentIntent(Order $order, Payment $payment): array;

    /**
     * Verifies webhook/callback authenticity and returns parsed payload
     */
    public function verifyWebhook(array $payload, array $headers): array;
}
