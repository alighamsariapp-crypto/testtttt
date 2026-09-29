<?php

namespace Tests\Feature\Auth;

use Illuminate\Support\Facades\RateLimiter;
use Tests\TestCase;

class RateLimitingSecurityTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        RateLimiter::clear('login-ip:127.0.0.1');
        RateLimiter::clear('reg-ip:127.0.0.1');
        RateLimiter::clear('otp-send-ip:127.0.0.1');
        RateLimiter::clear('otp-verify-ip:127.0.0.1');
    }

    /**
     * Acceptance Test A: Repeated login requests reach 429 at documented threshold.
     */
    public function test_repeated_login_requests_reach_429_at_threshold(): void
    {
        $email = 'ratelimit_login_'.time().'@example.com';
        $limit = (int) config('rate_limits.auth_login_credential', 5);

        for ($i = 1; $i <= $limit; $i++) {
            $response = $this->postJson('/api/v1/auth/login', [
                'email' => $email,
                'password' => 'WrongPassword123!',
            ]);

            $this->assertNotEquals(429, $response->getStatusCode(), "Request #{$i} should not be throttled");
        }

        // Limit + 1 must be throttled with HTTP 429
        $throttledResponse = $this->postJson('/api/v1/auth/login', [
            'email' => $email,
            'password' => 'WrongPassword123!',
        ]);

        $throttledResponse->assertStatus(429)
            ->assertHeader('Retry-After')
            ->assertJsonPath('error_code', 'TOO_MANY_REQUESTS')
            ->assertJsonPath('success', false);
    }

    /**
     * Acceptance Test B: OTP resend and OTP verify have separate rate limiters.
     */
    public function test_otp_send_and_verify_have_separate_limiters(): void
    {
        $phone = '09120001122';
        $sendLimit = (int) config('rate_limits.otp_send_phone', 2);

        for ($i = 1; $i <= $sendLimit; $i++) {
            $this->postJson('/api/v1/auth/otp/send', ['phone' => $phone]);
        }

        // Send is throttled
        $sendThrottled = $this->postJson('/api/v1/auth/otp/send', ['phone' => $phone]);
        $this->assertEquals(429, $sendThrottled->getStatusCode());

        // But verify for this phone must not be throttled yet (separate bucket)
        $verifyResponse = $this->postJson('/api/v1/auth/otp/verify', [
            'phone' => $phone,
            'code' => '123456',
        ]);

        $this->assertNotEquals(429, $verifyResponse->getStatusCode(), 'Verify bucket must be separate from send bucket');
    }

    /**
     * Acceptance Test C: Retry-After header is returned and error responses do not leak account existence.
     */
    public function test_rate_limited_response_includes_retry_after_and_prevents_enumeration(): void
    {
        $email = 'enum_test_'.time().'@example.com';
        $limit = (int) config('rate_limits.auth_login_credential', 5);

        for ($i = 1; $i <= $limit + 1; $i++) {
            $res = $this->postJson('/api/v1/auth/login', [
                'email' => $email,
                'password' => 'test',
            ]);
        }

        $res->assertStatus(429);
        $this->assertNotEmpty($res->headers->get('Retry-After'));
        $res->assertJsonStructure([
            'success',
            'message',
            'error_code',
        ]);
        // Message is generic and does not disclose if account exists
        $this->assertEquals('TOO_MANY_REQUESTS', $res->json('error_code'));
    }
}
