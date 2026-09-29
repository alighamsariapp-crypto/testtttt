<?php

namespace App\Modules\Payments\Services;

use App\Modules\Payments\Models\PaymentStatusExchange;
use Illuminate\Support\Carbon;

class PaymentStatusExchangeService
{
    public const DEFAULT_EXCHANGE_TTL_SECONDS = 120;
    public const STATUS_TOKEN_TTL_SECONDS = 300;

    /**
     * Creates a single-use, short-lived exchange code bound to an order.
     * Stored strictly as a SHA-256 hash in the database.
     */
    public static function createExchangeCode(
        int $orderId,
        string $orderNumber,
        int $userId = 0,
        int $ttlSeconds = self::DEFAULT_EXCHANGE_TTL_SECONDS
    ): string {
        $code = bin2hex(random_bytes(32));
        $codeHash = hash('sha256', $code);

        PaymentStatusExchange::create([
            'code_hash' => $codeHash,
            'order_id' => $orderId,
            'order_number' => $orderNumber,
            'user_id' => $userId,
            'purpose' => 'payment_status',
            'expires_at' => Carbon::now()->addSeconds($ttlSeconds),
        ]);

        return $code;
    }

    /**
     * Exchanges a one-time exchange code for a short-lived payment-status authorization token.
     * Atomically invalidates the exchange code upon first use.
     *
     * @return array{token?: string, order_id?: int, order_number?: string, expires_in?: int, error?: string, status?: int, message?: string}
     */
    public static function exchangeCode(
        string $code,
        string $orderIdentifier,
        ?int $authenticatedUserId = null
    ): array {
        $cleanCode = trim($code);
        $cleanIdentifier = trim($orderIdentifier);

        if (empty($cleanCode)) {
            return [
                'error' => 'EXCHANGE_CODE_INVALID',
                'status' => 401,
                'message' => 'کد تبادل نامعتبر است.',
            ];
        }

        $codeHash = hash('sha256', $cleanCode);

        /** @var PaymentStatusExchange|null $exchange */
        $exchange = PaymentStatusExchange::where('code_hash', $codeHash)->first();

        if (!$exchange) {
            return [
                'error' => 'EXCHANGE_CODE_INVALID',
                'status' => 401,
                'message' => 'کد تبادل نامعتبر است.',
            ];
        }

        if ($exchange->used_at !== null) {
            return [
                'error' => 'EXCHANGE_CODE_ALREADY_USED',
                'status' => 403,
                'message' => 'این کد تبادل قبلاً استفاده شده است و فاقد اعتبار است.',
            ];
        }

        if (Carbon::now()->isAfter($exchange->expires_at)) {
            return [
                'error' => 'EXCHANGE_CODE_EXPIRED',
                'status' => 403,
                'message' => 'کد تبادل منقضی شده است.',
            ];
        }

        // Validate order binding
        $matchesOrderNumber = ($exchange->order_number === $cleanIdentifier);
        $matchesOrderId = ((string) $exchange->order_id === $cleanIdentifier);
        if (!$matchesOrderNumber && !$matchesOrderId) {
            return [
                'error' => 'EXCHANGE_CODE_ORDER_MISMATCH',
                'status' => 403,
                'message' => 'کد تبادل متعلق به این سفارش نمی‌باشد.',
            ];
        }

        // Validate user binding if authenticated
        if ($authenticatedUserId !== null && $exchange->user_id > 0 && $exchange->user_id !== $authenticatedUserId) {
            return [
                'error' => 'EXCHANGE_CODE_USER_MISMATCH',
                'status' => 403,
                'message' => 'دسترسی غیرمجاز: کد تبادل متعلق به کاربر دیگری است.',
            ];
        }

        // Atomic invalidation: update only if used_at is still NULL
        $affected = PaymentStatusExchange::where('id', $exchange->id)
            ->whereNull('used_at')
            ->update(['used_at' => Carbon::now()]);

        if ($affected === 0) {
            return [
                'error' => 'EXCHANGE_CODE_ALREADY_USED',
                'status' => 403,
                'message' => 'این کد تبادل قبلاً استفاده شده است.',
            ];
        }

        // Generate short-lived signed status token (e.g. 5 minutes)
        $statusToken = PaymentStatusTokenService::generateToken(
            $exchange->order_id,
            $exchange->order_number,
            $exchange->user_id,
            self::STATUS_TOKEN_TTL_SECONDS
        );

        return [
            'token' => $statusToken,
            'order_id' => $exchange->order_id,
            'order_number' => $exchange->order_number,
            'expires_in' => self::STATUS_TOKEN_TTL_SECONDS,
        ];
    }
}
