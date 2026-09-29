<?php

namespace App\Modules\Shared\Security;

use LogicException;

class CorsService
{
    /**
     * Normalize an origin string by parsing scheme, host, and port.
     * Ensures lowercase scheme and host, removes default ports (80 for http, 443 for https),
     * and strips trailing slashes, paths, and queries.
     *
     * Returns null if invalid or not http/https.
     */
    public static function normalizeOrigin(string $raw): ?string
    {
        $trimmed = trim($raw);
        if ($trimmed === '') {
            return null;
        }

        if ($trimmed === '*') {
            return '*';
        }

        $parsed = parse_url($trimmed);
        if (!$parsed || !isset($parsed['scheme'], $parsed['host'])) {
            return null;
        }

        $scheme = strtolower((string) $parsed['scheme']);
        if (!in_array($scheme, ['http', 'https'], true)) {
            return null;
        }

        $host = strtolower((string) $parsed['host']);
        $port = isset($parsed['port']) ? (int) $parsed['port'] : null;

        // Strip standard default ports
        if (($scheme === 'http' && $port === 80) || ($scheme === 'https' && $port === 443)) {
            $port = null;
        }

        return $port !== null ? "{$scheme}://{$host}:{$port}" : "{$scheme}://{$host}";
    }

    /**
     * Resolve the allowed origins based on the current environment.
     * Dedicated environment variables are checked:
     * - Production: CORS_ALLOWED_ORIGINS_PRODUCTION, falling back to CORS_ALLOWED_ORIGINS
     * - Staging: CORS_ALLOWED_ORIGINS_STAGING, falling back to CORS_ALLOWED_ORIGINS
     * - Development/Local: CORS_ALLOWED_ORIGINS or safe localhost defaults.
     *
     * @return array<string>
     */
    public static function resolveOrigins(?string $appEnv = null): array
    {
        $env = $appEnv ?? (string) env('APP_ENV', 'production');

        $rawOrigins = match ($env) {
            'production' => env('CORS_ALLOWED_ORIGINS_PRODUCTION', env('CORS_ALLOWED_ORIGINS', '')),
            'staging' => env('CORS_ALLOWED_ORIGINS_STAGING', env('CORS_ALLOWED_ORIGINS', '')),
            default => env('CORS_ALLOWED_ORIGINS', 'http://localhost:3000,http://127.0.0.1:3000'),
        };

        $parts = array_filter(array_map('trim', explode(',', (string) $rawOrigins)));
        $normalized = [];

        foreach ($parts as $part) {
            $cleaned = self::normalizeOrigin($part);
            if ($cleaned !== null && !in_array($cleaned, $normalized, true)) {
                $normalized[] = $cleaned;
            }
        }

        return $normalized;
    }

    /**
     * Validate CORS configuration against production security rules.
     * Throws LogicException if:
     * - Production origin list is empty.
     * - Production origin list contains wildcard (*).
     * - Wildcard is used when supports_credentials is true (in any environment).
     *
     * @param array<string> $allowedOrigins
     * @throws LogicException
     */
    public static function validateConfiguration(string $appEnv, array $allowedOrigins, bool $supportsCredentials): void
    {
        $hasWildcard = in_array('*', $allowedOrigins, true);

        // Rule 1: Wildcard with credentials is an explicit CORS spec violation & high-severity risk
        if ($supportsCredentials && $hasWildcard) {
            throw new LogicException(
                "CORS security violation: 'supports_credentials' cannot be enabled with wildcard origins ('*'). " .
                "Browsers strictly forbid wildcard origins when credentials are included."
            );
        }

        // Rule 2: Production environment rules
        if ($appEnv === 'production') {
            if ($hasWildcard) {
                throw new LogicException(
                    "CORS security violation: Wildcard origin ('*') is strictly prohibited in production. " .
                    "Please configure explicit origins via CORS_ALLOWED_ORIGINS_PRODUCTION."
                );
            }

            if (empty($allowedOrigins)) {
                throw new LogicException(
                    "CORS security violation: No allowed origins defined for production. " .
                    "Set CORS_ALLOWED_ORIGINS_PRODUCTION with a comma-separated list of approved domains."
                );
            }
        }
    }

    /**
     * Check if a given request origin matches the allowlist exactly (scheme, host, port).
     * Does NOT blindly reflect unknown origins.
     */
    public static function isOriginAllowed(?string $requestOrigin, array $allowedOrigins): bool
    {
        if ($requestOrigin === null || trim($requestOrigin) === '') {
            return false;
        }

        $normalizedRequest = self::normalizeOrigin($requestOrigin);
        if ($normalizedRequest === null) {
            return false;
        }

        foreach ($allowedOrigins as $allowed) {
            if ($allowed === '*') {
                return true;
            }

            $normalizedAllowed = self::normalizeOrigin($allowed);
            if ($normalizedAllowed !== null && $normalizedRequest === $normalizedAllowed) {
                return true;
            }
        }

        return false;
    }

    /**
     * API methods strictly required and used by the application.
     *
     * @return array<string>
     */
    public static function getAllowedMethods(): array
    {
        return ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'];
    }

    /**
     * Request headers permitted for API cross-origin requests.
     * Includes Authorization (Sanctum), Content-Type, Accept, X-Session-ID (cart),
     * and X-Idempotency-Key (payments & orders).
     *
     * @return array<string>
     */
    public static function getAllowedHeaders(): array
    {
        return [
            'Authorization',
            'Content-Type',
            'Accept',
            'X-Session-ID',
            'X-Idempotency-Key',
            'X-Requested-With',
        ];
    }

    /**
     * Response headers exposed to client scripts.
     *
     * @return array<string>
     */
    public static function getExposedHeaders(): array
    {
        return [
            'X-RateLimit-Limit',
            'X-RateLimit-Remaining',
            'X-RateLimit-Reset',
        ];
    }

    /**
     * Preflight cache duration in seconds (24 hours).
     */
    public static function getMaxAge(): int
    {
        return 86400;
    }
}
