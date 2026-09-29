<?php

namespace App\Modules\Payments\Services;

use App\Modules\Shared\Security\SecurityConfigValidator;
use RuntimeException;

class PaymentStatusTokenService
{
    /**
     * Retrieves the strictly configured signing key without silent alterations or insecure fallbacks.
     *
     * @throws RuntimeException
     */
    public static function getSigningKey(): string
    {
        $key = config('app.key');

        if (!is_string($key) || $key === '') {
            throw new RuntimeException('Application signing key is not configured.');
        }

        // Validate key through security validator to prevent using placeholders or malformed keys
        SecurityConfigValidator::validateAppKey($key);

        return $key;
    }

    /**
     * Generates a tamper-proof HMAC-SHA256 signed status token for an order.
     */
    public static function generateToken(int $orderId, string $orderNumber, int $userId, int $ttlSeconds = 1800): string
    {
        $payload = [
            'order_id' => $orderId,
            'order_number' => $orderNumber,
            'user_id' => $userId,
            'purpose' => 'payment_status',
            'exp' => time() + $ttlSeconds,
            'nonce' => bin2hex(random_bytes(8)),
        ];

        $json = json_encode($payload, JSON_UNESCAPED_SLASHES);
        $b64 = rtrim(strtr(base64_encode($json), '+/', '-_'), '=');
        $key = static::getSigningKey();
        $sig = hash_hmac('sha256', $b64, $key);

        return $b64 . '.' . $sig;
    }

    /**
     * Validates HMAC signature, expiration, purpose, and order ID/number match.
     * Gracefully supports explicit key rotation via configured previous keys.
     */
    public static function verifyToken(?string $token, int $orderId, string $orderNumber): ?array
    {
        if (empty($token) || !is_string($token)) {
            return null;
        }

        $parts = explode('.', trim($token));
        if (count($parts) !== 2) {
            return null;
        }

        [$b64, $sig] = $parts;

        $primaryKey = static::getSigningKey();
        $previousKeys = (array) config('app.previous_keys', []);
        $candidateKeys = array_merge([$primaryKey], $previousKeys);

        $signatureValid = false;
        foreach ($candidateKeys as $candidateKey) {
            if (is_string($candidateKey) && $candidateKey !== '') {
                $expectedSig = hash_hmac('sha256', $b64, $candidateKey);
                if (hash_equals($expectedSig, $sig)) {
                    $signatureValid = true;
                    break;
                }
            }
        }

        if (!$signatureValid) {
            return null;
        }

        $json = base64_decode(strtr($b64, '-_', '+/'));
        if (!$json) {
            return null;
        }

        $payload = json_decode($json, true);
        if (!is_array($payload)) {
            return null;
        }

        if (($payload['purpose'] ?? '') !== 'payment_status') {
            return null;
        }

        if (!isset($payload['exp']) || time() > (int) $payload['exp']) {
            return null;
        }

        if ($orderId > 0 && ($payload['order_id'] ?? 0) !== $orderId) {
            return null;
        }

        if (!empty($orderNumber) && ($payload['order_number'] ?? '') !== $orderNumber) {
            return null;
        }

        return $payload;
    }
}
