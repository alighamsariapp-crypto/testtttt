<?php

namespace App\Modules\Shared\Security;

use RuntimeException;

class SecurityConfigValidator
{
    /**
     * List of forbidden insecure placeholders and default keys.
     */
    protected const FORBIDDEN_PLACEHOLDERS = [
        'apexstore-fallback',
        'SomeRandomString',
        'base64:CHANGEME',
        'CHANGEME',
        'YOUR_APP_KEY',
        'base64:YOUR_SECRET_KEY',
        'base64:0000000000000000000000000000000000000000000=',
        'secret',
        'placeholder',
    ];

    /**
     * Validates APP_KEY for strict security criteria.
     * In production, APP_KEY must be present, valid, and not a placeholder.
     * If invalid, throws RuntimeException preventing startup.
     *
     * @throws RuntimeException
     */
    public static function validateAppKey(?string $key = null, ?string $env = null): void
    {
        $env = $env ?? (string) config('app.env', 'production');
        $isProduction = in_array(strtolower($env), ['production', 'prod'], true);
        $isTesting = in_array(strtolower($env), ['testing', 'test'], true);

        $key = $key !== null ? $key : config('app.key');

        if (empty($key) || !is_string($key)) {
            if ($isProduction) {
                throw new RuntimeException(
                    '[SECURITY FATAL] APP_KEY is missing or empty in production. A secure 256-bit application key is strictly required before serving requests.'
                );
            }
            if (!$isTesting) {
                throw new RuntimeException(
                    '[SECURITY FATAL] APP_KEY is missing or empty. Application key must be configured.'
                );
            }
            return;
        }

        // Check for known placeholder/fallback secrets
        foreach (self::FORBIDDEN_PLACEHOLDERS as $placeholder) {
            if (strcasecmp($key, $placeholder) === 0 || str_contains(strtolower($key), strtolower($placeholder))) {
                throw new RuntimeException(
                    '[SECURITY FATAL] APP_KEY contains an insecure placeholder or known default secret. Generate a secure key using "php artisan key:generate".'
                );
            }
        }

        // Validate key format and length
        if (str_starts_with($key, 'base64:')) {
            $decoded = base64_decode(substr($key, 7), true);
            if ($decoded === false || strlen($decoded) < 32) {
                throw new RuntimeException(
                    '[SECURITY FATAL] APP_KEY is malformed or too short. A minimum 32-byte (256-bit) base64 key is required.'
                );
            }
        } else {
            if (strlen($key) < 32) {
                throw new RuntimeException(
                    '[SECURITY FATAL] APP_KEY is too short. A minimum 32-character key is required.'
                );
            }
        }
    }

    /**
     * Boot-level validation runner for production configuration.
     *
     * @throws RuntimeException
     */
    public static function validateBootConfiguration(): void
    {
        $isProduction = app()->isProduction() || strtolower((string) config('app.env')) === 'production';
        if ($isProduction) {
            self::validateAppKey();
        }
    }
}
