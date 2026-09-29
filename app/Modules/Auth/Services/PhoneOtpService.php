<?php

namespace App\Modules\Auth\Services;

use App\Modules\Auth\Models\PhoneVerificationCode;
use App\Modules\Auth\Security\TokenAbilities;
use App\Modules\Settings\Services\KavenegarSmsService;
use App\Modules\Settings\Services\SmsConfigurationService;
use App\Modules\Shared\Exceptions\DomainException;
use App\Modules\Shared\Security\PhoneNormalizer;
use App\Modules\Users\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Symfony\Component\HttpFoundation\Response;

class PhoneOtpService
{
    public function __construct(
        private readonly SmsConfigurationService $smsConfiguration,
        private readonly KavenegarSmsService $kavenegar,
    ) {
    }

    public function send(string $phone): array
    {
        $normalizedPhone = $this->normalizePhone($phone);
        $this->ensureSmsIsConfigured();

        $resendSeconds = max(30, (int) config('services.sms.otp_resend_seconds', 60));
        $existing = PhoneVerificationCode::query()->where('phone', $normalizedPhone)->first();

        if ($existing) {
            $isTooSoon = $existing->resend_available_at
                ? $existing->resend_available_at->isFuture()
                : ($existing->updated_at?->addSeconds($resendSeconds)->isFuture() ?? false);

            if ($isTooSoon) {
                throw new DomainException(
                    'Please wait before requesting another verification code.',
                    'OTP_RESEND_TOO_SOON',
                    Response::HTTP_TOO_MANY_REQUESTS
                );
            }
        }

        $this->cleanupExpiredCodes();

        $code = (string) random_int(100000, 999999);
        $ttlSeconds = max(60, (int) config('services.sms.otp_ttl_seconds', 120));
        $now = now();

        PhoneVerificationCode::query()->updateOrCreate(
            ['phone' => $normalizedPhone],
            [
                'code_hash' => Hash::make($code),
                'issued_at' => $now,
                'resend_available_at' => $now->copy()->addSeconds($resendSeconds),
                'expires_at' => $now->copy()->addSeconds($ttlSeconds),
                'consumed_at' => null,
                'attempts' => 0,
            ]
        );

        $this->kavenegar->sendOtp($normalizedPhone, $code);

        return [
            'success' => true,
            'message' => 'Verification code sent successfully.',
            'expires_in' => $ttlSeconds,
            'resend_in' => $resendSeconds,
        ];
    }

    public function verify(string $phone, string $code, ?string $deviceName = null): array
    {
        $normalizedPhone = $this->normalizePhone($phone);
        $maxAttempts = max(3, (int) config('services.sms.otp_max_attempts', 5));

        $record = PhoneVerificationCode::query()
            ->where('phone', $normalizedPhone)
            ->first();

        if (!$record || $record->isConsumed()) {
            throw new DomainException(
                'Verification code is invalid or expired.',
                'OTP_INVALID_OR_EXPIRED',
                Response::HTTP_UNPROCESSABLE_ENTITY
            );
        }

        if ($record->attempts >= $maxAttempts) {
            $record->forceFill(['expires_at' => now()->subSecond()])->save();
            throw new DomainException(
                'Too many invalid verification attempts. Please request a new code.',
                'OTP_ATTEMPT_LIMIT_REACHED',
                Response::HTTP_TOO_MANY_REQUESTS
            );
        }

        if ($record->isExpired()) {
            throw new DomainException(
                'Verification code is invalid or expired.',
                'OTP_INVALID_OR_EXPIRED',
                Response::HTTP_UNPROCESSABLE_ENTITY
            );
        }

        if (!Hash::check($code, $record->code_hash)) {
            $record->increment('attempts');
            $currentAttempts = $record->fresh()?->attempts ?? ($record->attempts + 1);
            if ($currentAttempts >= $maxAttempts) {
                $record->forceFill(['expires_at' => now()->subSecond()])->save();
                throw new DomainException(
                    'Too many invalid verification attempts. Please request a new code.',
                    'OTP_ATTEMPT_LIMIT_REACHED',
                    Response::HTTP_TOO_MANY_REQUESTS
                );
            }

            throw new DomainException(
                'Verification code is invalid or expired.',
                'OTP_INVALID_OR_EXPIRED',
                Response::HTTP_UNPROCESSABLE_ENTITY
            );
        }

        return DB::transaction(function () use ($record, $normalizedPhone, $deviceName): array {
            $lockedRecord = PhoneVerificationCode::query()
                ->where('id', $record->id)
                ->lockForUpdate()
                ->first();

            if (!$lockedRecord || $lockedRecord->isConsumed() || $lockedRecord->isExpired()) {
                throw new DomainException(
                    'Verification code is invalid or expired.',
                    'OTP_INVALID_OR_EXPIRED',
                    Response::HTTP_UNPROCESSABLE_ENTITY
                );
            }

            $lockedRecord->forceFill(['consumed_at' => now()])->save();

            $user = User::query()->where('phone', $normalizedPhone)->first();
            if (!$user) {
                $user = User::create([
                    'phone' => $normalizedPhone,
                ]);
                $user->forceFill([
                    'phone_verified_at' => now(),
                    'role' => User::ROLE_CUSTOMER,
                    'status' => User::STATUS_ACTIVE,
                ])->save();
            } elseif (!$user->hasVerifiedPhone()) {
                $user->forceFill(['phone_verified_at' => now()])->save();
            }

            if (!$user->isActive()) {
                throw new DomainException(
                    'Account is inactive or suspended.',
                    'ACCOUNT_DISABLED',
                    Response::HTTP_FORBIDDEN
                );
            }

            $tokenName = $deviceName ? substr(trim($deviceName), 0, 50) : 'phone-otp';

            return [
                'user' => $user->fresh(),
                'token' => $user->createToken(
                    $tokenName,
                    TokenAbilities::forUser($user),
                    TokenAbilities::defaultExpiration()
                )->plainTextToken,
                'is_new_user' => $user->wasRecentlyCreated,
            ];
        });
    }

    public function normalizePhone(string $phone): string
    {
        return PhoneNormalizer::normalize($phone);
    }

    private function ensureSmsIsConfigured(): void
    {
        if (!$this->smsConfiguration->canSend(SmsConfigurationService::EVENT_OTP)) {
            throw new DomainException(
                'SMS verification is not configured yet. Please use Google or email and password.',
                'SMS_NOT_CONFIGURED',
                Response::HTTP_SERVICE_UNAVAILABLE
            );
        }
    }

    public function cleanupExpiredCodes(): int
    {
        return PhoneVerificationCode::query()
            ->where('expires_at', '<', now()->subHours(24))
            ->orWhere(function ($query) {
                $query->whereNotNull('consumed_at')
                    ->where('consumed_at', '<', now()->subHours(24));
            })
            ->delete();
    }

    public static function redactPhone(string $phone): string
    {
        return PhoneNormalizer::redact($phone);
    }
}
