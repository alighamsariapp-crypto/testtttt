<?php

namespace App\Modules\Auth\Services;

use App\Modules\Auth\Models\SmsPasswordResetCode;
use App\Modules\Auth\Security\TokenAbilities;
use App\Modules\Settings\Services\KavenegarSmsService;
use App\Modules\Settings\Services\SmsConfigurationService;
use App\Modules\Shared\Exceptions\DomainException;
use App\Modules\Users\Models\User;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class SmsPasswordResetService
{
    public function __construct(
        private readonly PhoneOtpService $phoneOtp,
        private readonly SmsConfigurationService $smsConfiguration,
        private readonly KavenegarSmsService $kavenegar,
    ) {
    }

    /** @return array{success: bool, message: string, expires_in: int, resend_in: int} */
    public function send(string $phone): array
    {
        $normalizedPhone = $this->phoneOtp->normalizePhone($phone);
        $this->ensureSmsCanSend();

        $ttlSeconds = max(120, (int) config('services.sms.password_reset_ttl_seconds', 600));
        $resendSeconds = max(30, (int) config('services.sms.password_reset_resend_seconds', 60));
        $response = [
            'success' => true,
            'message' => 'If an eligible account exists, a password recovery code has been sent.',
            'expires_in' => $ttlSeconds,
            'resend_in' => $resendSeconds,
        ];

        $user = User::query()
            ->where('phone', $normalizedPhone)
            ->whereNotNull('phone_verified_at')
            ->first();

        // Keep the response identical for missing, suspended, or passwordless accounts.
        if (!$user || !$user->isActive() || !$user->hasPassword()) {
            return $response;
        }

        $existing = SmsPasswordResetCode::query()->where('user_id', $user->id)->first();
        // Return the same response and let the route throttle apply uniformly. This prevents a second request
        // from revealing whether the supplied number belongs to an eligible account.
        if ($existing && $existing->updated_at?->addSeconds($resendSeconds)->isFuture()) {
            return $response;
        }

        $code = (string) random_int(100000, 999999);
        SmsPasswordResetCode::query()->updateOrCreate(
            ['user_id' => $user->id],
            [
                'phone' => $normalizedPhone,
                'code_hash' => Hash::make($code),
                'expires_at' => now()->addSeconds($ttlSeconds),
                'consumed_at' => null,
                'attempts' => 0,
            ]
        );

        $this->kavenegar->sendPasswordResetOtp($normalizedPhone, $code);

        return $response;
    }

    /** @return array{user: User, token: string} */
    public function reset(string $phone, string $code, string $password, ?string $deviceName = null): array
    {
        $normalizedPhone = $this->phoneOtp->normalizePhone($phone);
        $maxAttempts = max(3, (int) config('services.sms.password_reset_max_attempts', 5));

        $result = DB::transaction(function () use ($normalizedPhone, $code, $password, $deviceName, $maxAttempts): array {
            $user = User::query()
                ->where('phone', $normalizedPhone)
                ->whereNotNull('phone_verified_at')
                ->lockForUpdate()
                ->first();

            $record = $user
                ? SmsPasswordResetCode::query()->where('user_id', $user->id)->lockForUpdate()->first()
                : null;

            if (!$user || !$user->isActive() || !$user->hasPassword() || !$record || $record->isConsumed() || $record->isExpired()) {
                return ['failure' => 'invalid'];
            }

            if ($record->attempts >= $maxAttempts) {
                return ['failure' => 'attempt_limit'];
            }

            if (!Hash::check($code, $record->code_hash)) {
                // Do not throw inside the transaction: the attempt increment must remain committed.
                $record->increment('attempts');

                return ['failure' => 'invalid'];
            }

            $record->forceFill(['consumed_at' => now()])->save();
            $user->forceFill([
                'password' => Hash::make($password),
                'remember_token' => Str::random(60),
            ])->save();

            // A password recovery can indicate account compromise; invalidate all earlier sessions.
            $user->tokens()->delete();
            event(new PasswordReset($user));

            $tokenName = $deviceName ? substr(trim($deviceName), 0, 50) : 'password-recovery';

            return [
                'user' => $user->fresh(),
                'token' => $user->createToken(
                    $tokenName,
                    TokenAbilities::forUser($user),
                    TokenAbilities::defaultExpiration()
                )->plainTextToken,
            ];
        });

        if (($result['failure'] ?? null) === 'attempt_limit') {
            throw new DomainException(
                'Too many invalid password recovery attempts. Please request a new code.',
                'PASSWORD_RESET_SMS_ATTEMPT_LIMIT_REACHED',
                Response::HTTP_TOO_MANY_REQUESTS
            );
        }

        if (($result['failure'] ?? null) === 'invalid') {
            throw $this->invalidCodeException();
        }

        /** @var array{user: User, token: string} $result */
        return $result;
    }

    private function ensureSmsCanSend(): void
    {
        if (!$this->smsConfiguration->canSend(SmsConfigurationService::EVENT_PASSWORD_RESET)) {
            throw new DomainException(
                'SMS password recovery is not configured yet.',
                'SMS_NOT_CONFIGURED',
                Response::HTTP_SERVICE_UNAVAILABLE
            );
        }
    }

    private function invalidCodeException(): DomainException
    {
        return new DomainException(
            'Password recovery code is invalid or expired.',
            'PASSWORD_RESET_SMS_INVALID_OR_EXPIRED',
            Response::HTTP_UNPROCESSABLE_ENTITY
        );
    }
}
