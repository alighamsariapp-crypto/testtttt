<?php

namespace App\Modules\Shared\Helpers;

class RedactionHelper
{
    private const DEFAULT_SENSITIVE_KEYS = [
        'password',
        'password_confirmation',
        'current_password',
        'secret',
        'api_key',
        'token',
        'access_token',
        'refresh_token',
        'authorization',
        'card_number',
        'cvv',
        'cvc',
        'private_key',
    ];

    private array $sensitiveKeys;

    public function __construct(array $sensitiveKeys = [])
    {
        $this->sensitiveKeys = !empty($sensitiveKeys) ? $sensitiveKeys : self::DEFAULT_SENSITIVE_KEYS;
    }

    /**
     * Recursively scrubs sensitive values from arrays/payloads without relying on Laravel global config container
     */
    public function redact(mixed $data): mixed
    {
        if (!is_array($data)) {
            return $data;
        }

        $redacted = [];

        foreach ($data as $key => $value) {
            if ($this->isSensitiveKey((string) $key)) {
                $redacted[$key] = '[REDACTED]';
            } elseif (is_array($value)) {
                $redacted[$key] = $this->redact($value);
            } else {
                $redacted[$key] = $value;
            }
        }

        return $redacted;
    }

    public function isSensitiveKey(string $key): bool
    {
        $normalizedKey = strtolower(str_replace(['-', '_'], '', $key));

        foreach ($this->sensitiveKeys as $sensitive) {
            $normalizedSensitive = strtolower(str_replace(['-', '_'], '', $sensitive));
            if (str_contains($normalizedKey, $normalizedSensitive)) {
                return true;
            }
        }

        return false;
    }
}
