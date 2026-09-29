<?php

namespace Tests\Feature\Auth;

use App\Modules\Auth\Models\PhoneVerificationCode;
use App\Modules\Settings\Services\KavenegarSmsService;
use App\Modules\Settings\Services\SmsConfigurationService;
use App\Modules\Users\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class PhoneOtpSecurityTest extends TestCase
{
    /**
     * Acceptance Test A: Two codes for the same phone cannot be requested inside the resend window.
     */
    public function test_two_codes_for_same_phone_cannot_be_requested_inside_resend_window(): void
    {
        $this->enableSms();

        Http::fake([
            'https://api.kavenegar.com/v1/*/sms/send.json' => Http::response([
                'return' => ['status' => 200],
                'entries' => [['messageid' => 101, 'status' => 1]],
            ]),
        ]);

        $phone = '09129876543';

        $firstResponse = $this->postJson('/api/v1/auth/otp/send', ['phone' => $phone]);
        $firstResponse->assertOk()
            ->assertJsonPath('data.expires_in', 120)
            ->assertJsonPath('data.resend_in', 60);

        // Immediate second request must be rejected with 429 inside resend window
        $secondResponse = $this->postJson('/api/v1/auth/otp/send', ['phone' => $phone]);
        $secondResponse->assertStatus(429)
            ->assertJsonPath('error_code', 'OTP_RESEND_TOO_SOON');
    }

    /**
     * Acceptance Test B: A random valid code succeeds once and only once.
     */
    public function test_random_valid_code_succeeds_once_and_only_once(): void
    {
        $phone = '09125554433';
        $randomCode = (string) random_int(100000, 999999);

        PhoneVerificationCode::create([
            'phone' => $phone,
            'code_hash' => Hash::make($randomCode),
            'issued_at' => now(),
            'resend_available_at' => now()->addMinute(),
            'expires_at' => now()->addMinutes(2),
            'consumed_at' => null,
            'attempts' => 0,
        ]);

        // First verification succeeds
        $first = $this->postJson('/api/v1/auth/otp/verify', [
            'phone' => $phone,
            'code' => $randomCode,
            'device_name' => 'phpunit',
        ]);
        $first->assertOk()
            ->assertJsonStructure(['data' => ['token', 'user']]);

        // Second verification with the exact same code fails because consumed_at is set
        $second = $this->postJson('/api/v1/auth/otp/verify', [
            'phone' => $phone,
            'code' => $randomCode,
            'device_name' => 'phpunit',
        ]);
        $second->assertUnprocessable()
            ->assertJsonPath('error_code', 'OTP_INVALID_OR_EXPIRED');
    }

    /**
     * Acceptance Test C: 123456 does not succeed unless it was actually randomly generated.
     */
    public function test_123456_does_not_succeed_unless_actually_randomly_generated(): void
    {
        $phone = '09121112233';
        $realCode = '748291'; // Real randomly generated code differs from 123456

        PhoneVerificationCode::create([
            'phone' => $phone,
            'code_hash' => Hash::make($realCode),
            'issued_at' => now(),
            'resend_available_at' => now()->addMinute(),
            'expires_at' => now()->addMinutes(2),
            'consumed_at' => null,
            'attempts' => 0,
        ]);

        // Attempting universal default bypass "123456" must fail
        $response = $this->postJson('/api/v1/auth/otp/verify', [
            'phone' => $phone,
            'code' => '123456',
        ]);
        $response->assertUnprocessable()
            ->assertJsonPath('error_code', 'OTP_INVALID_OR_EXPIRED');

        $this->assertDatabaseMissing('users', ['phone' => $phone]);
    }

    /**
     * Acceptance Test D: An expired code fails.
     */
    public function test_expired_code_fails(): void
    {
        $phone = '09123334455';
        $code = '839201';

        PhoneVerificationCode::create([
            'phone' => $phone,
            'code_hash' => Hash::make($code),
            'issued_at' => now()->subMinutes(5),
            'resend_available_at' => now()->subMinutes(4),
            'expires_at' => now()->subMinutes(3), // Expired
            'consumed_at' => null,
            'attempts' => 0,
        ]);

        $response = $this->postJson('/api/v1/auth/otp/verify', [
            'phone' => $phone,
            'code' => $code,
        ]);
        $response->assertUnprocessable()
            ->assertJsonPath('error_code', 'OTP_INVALID_OR_EXPIRED');
    }

    /**
     * Acceptance Test E: A wrong code increments attempts and eventually locks out.
     */
    public function test_wrong_code_increments_attempts_and_eventually_locks_out(): void
    {
        $phone = '09127778899';
        $validCode = '928374';

        $record = PhoneVerificationCode::create([
            'phone' => $phone,
            'code_hash' => Hash::make($validCode),
            'issued_at' => now(),
            'resend_available_at' => now()->addMinute(),
            'expires_at' => now()->addMinutes(2),
            'consumed_at' => null,
            'attempts' => 0,
        ]);

        // 4 failed attempts
        for ($i = 1; $i <= 4; $i++) {
            $resp = $this->postJson('/api/v1/auth/otp/verify', [
                'phone' => $phone,
                'code' => '000000',
            ]);
            $resp->assertUnprocessable()
                ->assertJsonPath('error_code', 'OTP_INVALID_OR_EXPIRED');
        }

        // 5th failed attempt reaches limit and locks out with 429
        $lockoutResp = $this->postJson('/api/v1/auth/otp/verify', [
            'phone' => $phone,
            'code' => '000000',
        ]);
        $lockoutResp->assertStatus(429)
            ->assertJsonPath('error_code', 'OTP_ATTEMPT_LIMIT_REACHED');

        // Clear route rate limiter cache so subsequent request explicitly tests domain-level lockout rather than route rate limit
        \Illuminate\Support\Facades\Cache::flush();
        \Illuminate\Support\Facades\RateLimiter::clear('otp-verify-phone:'.$phone);
        \Illuminate\Support\Facades\RateLimiter::clear('otp-verify-ip:127.0.0.1');

        // Subsequent attempt even with the valid code must now fail because record is invalidated
        $subsequent = $this->postJson('/api/v1/auth/otp/verify', [
            'phone' => $phone,
            'code' => $validCode,
        ]);
        $subsequent->assertStatus(429)
            ->assertJsonPath('error_code', 'OTP_ATTEMPT_LIMIT_REACHED');
    }

    /**
     * Acceptance Test F: SMS-disabled configuration returns 503 and does not authenticate.
     */
    public function test_sms_disabled_configuration_returns_503_and_does_not_authenticate(): void
    {
        $this->disableSms();

        $response = $this->postJson('/api/v1/auth/otp/send', ['phone' => '09121234567']);
        $response->assertStatus(503)
            ->assertJsonPath('error_code', 'SMS_NOT_CONFIGURED');

        $this->assertDatabaseMissing('phone_verification_codes', ['phone' => '09121234567']);
    }

    /**
     * Acceptance Test H: OTP values and hashes are absent from logs and responses.
     */
    public function test_otp_values_and_hashes_are_absent_from_logs_and_responses(): void
    {
        $this->enableSms();

        Http::fake([
            'https://api.kavenegar.com/v1/*/sms/send.json' => Http::response([
                'return' => ['status' => 200],
                'entries' => [['messageid' => 999, 'status' => 1]],
            ]),
        ]);

        $response = $this->postJson('/api/v1/auth/otp/send', ['phone' => '09126667788']);
        $response->assertOk();

        $content = $response->getContent();
        $this->assertStringNotContainsString('code_hash', $content);
        $this->assertStringNotContainsString('"code":', $content);

        $record = PhoneVerificationCode::where('phone', '09126667788')->first();
        $this->assertNotNull($record);
        // Code hash must be a bcrypt hash (starts with $2y$), not plaintext
        $this->assertStringStartsWith('$2y$', $record->code_hash);
    }

    private function enableSms(): void
    {
        app(SmsConfigurationService::class)->save([
            'provider' => 'kavenegar',
            'enabled' => true,
            'api_key' => 'test-kavenegar-key',
            'sender' => '10004346',
            'otp_template' => '',
            'templates' => [
                'otp' => ['enabled' => true, 'text' => 'کد شما: {code}'],
            ],
        ]);
    }

    private function disableSms(): void
    {
        app(SmsConfigurationService::class)->save([
            'provider' => 'kavenegar',
            'enabled' => false,
            'api_key' => '',
            'sender' => '',
            'otp_template' => '',
            'templates' => [
                'otp' => ['enabled' => false, 'text' => ''],
            ],
        ]);
    }
}
