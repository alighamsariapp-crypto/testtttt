<?php

namespace App\Modules\Shared\Security;

use App\Modules\Shared\Exceptions\DomainException;
use Symfony\Component\HttpFoundation\Response;

class PhoneNormalizer
{
    private const PERSIAN_ARABIC_DIGITS = [
        '۰' => '0', '۱' => '1', '۲' => '2', '۳' => '3', '۴' => '4',
        '۵' => '5', '۶' => '6', '۷' => '7', '۸' => '8', '۹' => '9',
        '٠' => '0', '١' => '1', '٢' => '2', '٣' => '3', '٤' => '4',
        '٥' => '5', '٦' => '6', '٧' => '7', '٨' => '8', '٩' => '9',
    ];

    /**
     * Canonicalizes any valid Iranian mobile representation to standard 09XXXXXXXXX.
     * Handles Persian/Arabic digits, +98, 0098, 98, separators (spaces, hyphens, brackets, dots).
     *
     * @throws DomainException if the input is not a valid Iranian mobile number
     */
    public static function normalize(mixed $phone): string
    {
        if (!is_string($phone) && !is_numeric($phone)) {
            throw new DomainException(
                'A valid Iranian mobile number is required.',
                'INVALID_PHONE',
                Response::HTTP_UNPROCESSABLE_ENTITY
            );
        }

        $phoneStr = trim((string) $phone);
        if ($phoneStr === '') {
            throw new DomainException(
                'A valid Iranian mobile number is required.',
                'INVALID_PHONE',
                Response::HTTP_UNPROCESSABLE_ENTITY
            );
        }

        // Convert Persian and Arabic digits to ASCII digits
        $translated = strtr($phoneStr, self::PERSIAN_ARABIC_DIGITS);

        // Strip non-digit characters except leading plus
        $digits = preg_replace('/[^0-9+]/', '', $translated) ?? '';

        // Normalize international and local prefixes to 09XXXXXXXXX
        if (str_starts_with($digits, '+98')) {
            $digits = '0' . substr($digits, 3);
        } elseif (str_starts_with($digits, '0098')) {
            $digits = '0' . substr($digits, 4);
        } elseif (str_starts_with($digits, '98') && strlen($digits) === 12) {
            $digits = '0' . substr($digits, 2);
        } elseif (str_starts_with($digits, '9') && strlen($digits) === 10) {
            $digits = '0' . $digits;
        }

        // Strictly validate 11 digits starting with 09
        if (!preg_match('/^09\d{9}$/', $digits)) {
            throw new DomainException(
                'A valid Iranian mobile number is required.',
                'INVALID_PHONE',
                Response::HTTP_UNPROCESSABLE_ENTITY
            );
        }

        return $digits;
    }

    /**
     * Safe normalization that returns null on invalid input instead of throwing.
     * Useful for rate-limit key resolution to avoid consuming phone buckets on malformed input.
     */
    public static function tryNormalize(mixed $phone): ?string
    {
        try {
            return self::normalize($phone);
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * Redacts phone number for safe logging (e.g. 0912****67).
     */
    public static function redact(?string $phone): string
    {
        if ($phone === null || $phone === '') {
            return '***';
        }

        $clean = self::tryNormalize($phone) ?? preg_replace('/\D+/', '', $phone);
        $len = strlen($clean);
        if ($len < 8) {
            return '***';
        }

        return substr($clean, 0, 4) . '****' . substr($clean, -2);
    }

    /**
     * Computes a stable SHA-256 hash of the canonical phone number for audit logging.
     */
    public static function hash(?string $phone): string
    {
        if ($phone === null || $phone === '') {
            return '';
        }

        $canonical = self::tryNormalize($phone) ?? (string) $phone;
        return hash('sha256', $canonical);
    }
}
