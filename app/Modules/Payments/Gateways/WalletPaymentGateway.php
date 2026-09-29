<?php

namespace App\Modules\Payments\Gateways;

use App\Modules\Orders\Models\Order;
use App\Modules\Payments\Contracts\PaymentGatewayInterface;
use App\Modules\Payments\Models\Payment;
use App\Modules\Shared\Exceptions\DomainException;
use App\Modules\Wallet\Models\WalletTransaction;
use Illuminate\Support\Str;

/**
 * Wallet Payment Gateway Adapter
 *
 * Contract:
 * - reference_id: Internal wallet transaction reference tracking code
 * - gateway_payment_id: Null (internal customer wallet balance debit)
 */
class WalletPaymentGateway implements PaymentGatewayInterface
{
    public function getName(): string
    {
        return 'wallet';
    }

    public function createPaymentIntent(Order $order, Payment $payment): array
    {
        $order->loadMissing('user');

        if (!$order->user) {
            throw new DomainException('Wallet payment requires an authenticated order owner.', 'WALLET_OWNER_NOT_FOUND', 400);
        }

        $transactions = WalletTransaction::query()
            ->where('user_id', $order->user_id)
            ->where('status', WalletTransaction::STATUS_SUCCESSFUL)
            ->lockForUpdate()
            ->get();

        $balance = (int) $transactions->sum(function (WalletTransaction $transaction): int {
            return in_array($transaction->type, ['deposit', 'refund', 'cashback', 'adjustment'], true)
                ? $transaction->amount
                : -$transaction->amount;
        });

        if ($balance < $order->grand_total) {
            throw new DomainException('Insufficient wallet balance.', 'INSUFFICIENT_WALLET_BALANCE', 422);
        }

        $reference = 'WLT-PAY-'.Str::upper(Str::random(16));

        WalletTransaction::create([
            'user_id' => $order->user_id,
            'type' => 'purchase',
            'amount' => $order->grand_total,
            'currency' => $order->currency,
            'status' => WalletTransaction::STATUS_SUCCESSFUL,
            'reference' => $reference,
            'description' => "Wallet payment for order {$order->order_number}",
        ]);

        $payment->reference_id = $reference;
        $payment->status = Payment::STATUS_PAID;
        $payment->save();

        $order->status = Order::STATUS_PAID;
        $order->payment_status = Payment::STATUS_PAID;
        $order->save();

        return [
            'gateway' => $this->getName(),
            'action' => 'completed',
            'reference_id' => $reference,
            'payment_status' => Payment::STATUS_PAID,
        ];
    }

    public function verifyWebhook(array $payload, array $headers): array
    {
        return [
            'is_valid' => false,
            'reference_id' => null,
            'status' => 'failed',
            'raw' => $payload,
        ];
    }
}
