<?php

namespace App\Modules\Payments\Gateways;

use App\Modules\Orders\Models\Order;
use App\Modules\Payments\Contracts\PaymentGatewayInterface;
use App\Modules\Payments\Models\Payment;
use App\Modules\Settings\Services\CheckoutConfigurationService;
use Illuminate\Support\Str;

/**
 * Bank Transfer (Offline) Payment Gateway Adapter
 *
 * Contract:
 * - reference_id: Internal bank transfer reference tracking code
 * - gateway_payment_id: Null (no third-party payment provider)
 */
class BankTransferGateway implements PaymentGatewayInterface
{
    public function __construct(private readonly CheckoutConfigurationService $checkoutConfiguration)
    {
    }

    public function getName(): string
    {
        return 'bank_transfer';
    }

    public function createPaymentIntent(Order $order, Payment $payment): array
    {
        $reference = 'BANK-'.strtoupper(Str::random(10));
        $payment->reference_id = $reference;
        $payment->save();

        $paymentConfig = $this->checkoutConfiguration->get()['payment'] ?? [];
        $accountName = trim((string) ($paymentConfig['bank_account_name'] ?? ''));
        $cardNumber = trim((string) ($paymentConfig['bank_card_number'] ?? ''));

        return [
            'gateway' => 'bank_transfer',
            'action' => 'offline_instructions',
            'reference_id' => $reference,
            'account_name' => $accountName,
            'card_number' => $cardNumber,
            'instructions' => $accountName !== '' && $cardNumber !== ''
                ? "مبلغ دقیق سفارش را به کارت {$cardNumber} به نام {$accountName} واریز کنید."
                : 'اطلاعات واریز توسط پشتیبانی اعلام می‌شود.',
        ];
    }

    public function verifyWebhook(array $payload, array $headers): array
    {
        return [
            'is_valid' => false,
            'reference_id' => null,
            'status' => 'pending',
            'raw' => $payload,
        ];
    }
}
