<?php

namespace App\Providers;

use App\Modules\Shared\Security\PhoneNormalizer;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        \App\Modules\Shared\Security\SecurityConfigValidator::validateBootConfiguration();
        $this->configureRateLimiting();
    }

    protected function configureRateLimiting(): void
    {
        $responseCallback = function (Request $request, array $headers): JsonResponse {
            $retryAfter = isset($headers['Retry-After']) ? (int) $headers['Retry-After'] : 60;
            
            // Audit metric logging: Never log passwords, OTPs, tokens, or full payment payloads
            Log::warning('[RATE_LIMIT_EXCEEDED] Rate limit threshold reached', [
                'path' => $request->path(),
                'method' => $request->method(),
                'ip' => $request->ip(),
                'retry_after' => $retryAfter,
            ]);

            return response()->json([
                'success' => false,
                'message' => 'تعداد درخواست‌ها بیش از حد مجاز است. لطفاً پس از مدتی مجدداً تلاش نمایید (Too many requests).',
                'error_code' => 'TOO_MANY_REQUESTS',
                'retry_after' => $retryAfter,
            ], 429, $headers);
        };

        // 1. User Registration
        RateLimiter::for('auth-register', function (Request $request) use ($responseCallback) {
            $email = strtolower(trim((string) $request->input('email', '')));
            $limits = [
                Limit::perMinute((int) config('rate_limits.auth_register', 10))
                    ->by('reg-ip:'.$request->ip())
                    ->response($responseCallback),
            ];

            if ($email !== '') {
                $limits[] = Limit::perMinute(5)
                    ->by('reg-email:'.$email)
                    ->response($responseCallback);
            }

            return $limits;
        });

        // 2. User Login
        RateLimiter::for('auth-login', function (Request $request) use ($responseCallback) {
            $email = $request->input('email');
            $phoneInput = $request->input('phone');
            $cred = '';
            if ($email) {
                $cred = strtolower(trim((string) $email));
            } elseif ($phoneInput) {
                $canonicalPhone = PhoneNormalizer::tryNormalize($phoneInput);
                $cred = $canonicalPhone ?? strtolower(trim((string) $phoneInput));
            }

            $limits = [
                Limit::perMinute((int) config('rate_limits.auth_login_ip', 15))
                    ->by('login-ip:'.$request->ip())
                    ->response($responseCallback),
            ];

            if ($cred !== '') {
                $limits[] = Limit::perMinute((int) config('rate_limits.auth_login_credential', 5))
                    ->by('login-cred:'.$cred)
                    ->response($responseCallback);
            }

            return $limits;
        });

        // 3. OTP Send
        RateLimiter::for('otp-send', function (Request $request) use ($responseCallback) {
            $phone = PhoneNormalizer::tryNormalize($request->input('phone'));
            $limits = [
                Limit::perMinute((int) config('rate_limits.otp_send_ip', 3))
                    ->by('otp-send-ip:'.$request->ip())
                    ->response($responseCallback),
            ];

            if ($phone !== null) {
                $limits[] = Limit::perMinute((int) config('rate_limits.otp_send_phone', 2))
                    ->by('otp-send-phone:'.$phone)
                    ->response($responseCallback);
            }

            return $limits;
        });

        // 4. OTP Verify (Distinct from OTP Send)
        RateLimiter::for('otp-verify', function (Request $request) use ($responseCallback) {
            $phone = PhoneNormalizer::tryNormalize($request->input('phone'));
            $limits = [
                Limit::perMinute((int) config('rate_limits.otp_verify_ip', 10))
                    ->by('otp-verify-ip:'.$request->ip())
                    ->response($responseCallback),
            ];

            if ($phone !== null) {
                $limits[] = Limit::perMinute((int) config('rate_limits.otp_verify_phone', 5))
                    ->by('otp-verify-phone:'.$phone)
                    ->response($responseCallback);
            }

            return $limits;
        });

        // 5. Password Reset (Email)
        RateLimiter::for('password-reset', function (Request $request) use ($responseCallback) {
            $email = strtolower(trim((string) $request->input('email', '')));
            $limits = [
                Limit::perMinute((int) config('rate_limits.password_reset_ip', 5))
                    ->by('pwd-reset-ip:'.$request->ip())
                    ->response($responseCallback),
            ];

            if ($email !== '') {
                $limits[] = Limit::perMinute((int) config('rate_limits.password_reset_email', 3))
                    ->by('pwd-reset-email:'.$email)
                    ->response($responseCallback);
            }

            return $limits;
        });

        // 6. Password Reset SMS Send
        RateLimiter::for('password-reset-sms-send', function (Request $request) use ($responseCallback) {
            $phone = PhoneNormalizer::tryNormalize($request->input('phone'));
            $limits = [
                Limit::perMinute((int) config('rate_limits.password_reset_sms_send_ip', 3))
                    ->by('pwd-sms-send-ip:'.$request->ip())
                    ->response($responseCallback),
            ];

            if ($phone !== null) {
                $limits[] = Limit::perMinute((int) config('rate_limits.password_reset_sms_send_phone', 2))
                    ->by('pwd-sms-send-phone:'.$phone)
                    ->response($responseCallback);
            }

            return $limits;
        });

        // 7. Password Reset SMS Confirm
        RateLimiter::for('password-reset-sms-confirm', function (Request $request) use ($responseCallback) {
            $phone = PhoneNormalizer::tryNormalize($request->input('phone'));
            $limits = [
                Limit::perMinute((int) config('rate_limits.password_reset_sms_confirm_ip', 10))
                    ->by('pwd-sms-conf-ip:'.$request->ip())
                    ->response($responseCallback),
            ];

            if ($phone !== null) {
                $limits[] = Limit::perMinute((int) config('rate_limits.password_reset_sms_confirm_phone', 5))
                    ->by('pwd-sms-conf-phone:'.$phone)
                    ->response($responseCallback);
            }

            return $limits;
        });

        // 8. Google OAuth
        RateLimiter::for('oauth-google', function (Request $request) use ($responseCallback) {
            return Limit::perMinute((int) config('rate_limits.oauth_google', 15))
                ->by('oauth-google:'.$request->ip())
                ->response($responseCallback);
        });

        // 9. Checkout
        RateLimiter::for('checkout', function (Request $request) use ($responseCallback) {
            $key = $request->user()?->id ? 'user:'.$request->user()->id : 'ip:'.$request->ip();

            return Limit::perMinute((int) config('rate_limits.checkout', 10))
                ->by('checkout:'.$key)
                ->response($responseCallback);
        });

        // 10. Coupon Validation
        RateLimiter::for('coupon-validate', function (Request $request) use ($responseCallback) {
            $key = $request->user()?->id ? 'user:'.$request->user()->id : 'ip:'.$request->ip();

            return Limit::perMinute((int) config('rate_limits.coupon_validate', 20))
                ->by('coupon-val:'.$key)
                ->response($responseCallback);
        });

        // 11. Payment Callbacks & Webhooks (Independent signature/idempotency key)
        RateLimiter::for('payment-webhook', function (Request $request) use ($responseCallback) {
            $signature = $request->header('X-Idempotency-Key')
                ?? $request->header('Stripe-Signature')
                ?? $request->header('X-Zibal-Signature')
                ?? $request->input('trackId')
                ?? $request->input('reference_id');

            $key = $signature
                ? 'webhook-sig:'.hash('sha256', (string) $signature)
                : 'webhook-ip:'.$request->ip();

            return Limit::perMinute((int) config('rate_limits.payment_webhook', 120))
                ->by($key)
                ->response($responseCallback);
        });

        // 11.5 Payment Status Lookups (Authorized customer/token status polling & inquiry)
        RateLimiter::for('payment-status', function (Request $request) use ($responseCallback) {
            $key = $request->user()?->id ? 'user:'.$request->user()->id : 'ip:'.$request->ip();

            return Limit::perMinute((int) config('rate_limits.payment_status', 60))
                ->by('payment-status:'.$key)
                ->response($responseCallback);
        });

        // 12. Admin File & Image Uploads
        RateLimiter::for('admin-uploads', function (Request $request) use ($responseCallback) {
            $key = $request->user()?->id ? 'admin:'.$request->user()->id : 'ip:'.$request->ip();

            return Limit::perMinute((int) config('rate_limits.admin_uploads', 30))
                ->by('admin-uploads:'.$key)
                ->response($responseCallback);
        });

        // 13. Admin Sensitive Mutations
        RateLimiter::for('admin-mutations', function (Request $request) use ($responseCallback) {
            $key = $request->user()?->id ? 'admin:'.$request->user()->id : 'ip:'.$request->ip();

            return Limit::perMinute((int) config('rate_limits.admin_mutations', 60))
                ->by('admin-mutations:'.$key)
                ->response($responseCallback);
        });

        // 14. Dedicated Non-Production Simulation Test Routes
        RateLimiter::for('simulation-test', function (Request $request) use ($responseCallback) {
            $key = $request->user()?->id ? 'admin:'.$request->user()->id : 'ip:'.$request->ip();

            return Limit::perMinute((int) config('rate_limits.simulation_test', 10))
                ->by('sim-test:'.$key)
                ->response($responseCallback);
        });
    }
}
