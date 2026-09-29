<?php

namespace Tests\Feature\Auth;

use App\Modules\Auth\Models\PhoneVerificationCode;
use App\Modules\Auth\Models\SmsPasswordResetCode;
use App\Modules\Settings\Services\SmsConfigurationService;
use App\Modules\Users\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class AuthenticationFlowTest extends TestCase
{
    public function test_user_registration_creates_customer_and_returns_token(): void
    {
        $payload = [
            'name' => 'Sara Test',
            'email' => 'sara_test_'.time().'@example.com',
            'password' => 'SecurePass123!',
            'password_confirmation' => 'SecurePass123!',
        ];

        $response = $this->postJson('/api/v1/auth/register', $payload);

        $response->assertStatus(201)
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    'user' => ['id', 'name', 'email', 'role', 'status'],
                    'token',
                ],
            ])
            ->assertJson([
                'success' => true,
                'data' => [
                    'user' => [
                        'role' => 'customer',
                        'status' => 'active',
                    ],
                ],
            ]);
    }

    public function test_email_and_password_login_returns_a_token(): void
    {
        $user = $this->createCustomer([
            'email' => 'login@example.com',
            'password' => Hash::make('SecurePass123!'),
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'SecurePass123!',
            'device_name' => 'phpunit',
        ]);

        $response->assertOk()
            ->assertJsonPath('data.user.id', $user->id)
            ->assertJsonStructure(['data' => ['token']]);
    }

    public function test_valid_phone_code_creates_and_authenticates_a_customer(): void
    {
        $phone = '09121234567';

        PhoneVerificationCode::create([
            'phone' => $phone,
            'code_hash' => Hash::make('123456'),
            'expires_at' => now()->addMinutes(2),
            'attempts' => 0,
        ]);

        $response = $this->postJson('/api/v1/auth/otp/verify', [
            'phone' => $phone,
            'code' => '123456',
            'device_name' => 'phpunit',
        ]);

        $response->assertOk()
            ->assertJsonPath('data.user.phone', $phone)
            ->assertJsonPath('data.user.phone_verified', true)
            ->assertJsonPath('data.is_new_user', true)
            ->assertJsonStructure(['data' => ['token']]);

        $this->assertDatabaseHas('users', [
            'phone' => $phone,
            'role' => User::ROLE_CUSTOMER,
            'status' => User::STATUS_ACTIVE,
        ]);
    }

    public function test_invalid_phone_code_cannot_authenticate(): void
    {
        $phone = '09121234567';

        PhoneVerificationCode::create([
            'phone' => $phone,
            'code_hash' => Hash::make('123456'),
            'expires_at' => now()->addMinutes(2),
            'attempts' => 0,
        ]);

        $this->postJson('/api/v1/auth/otp/verify', [
            'phone' => $phone,
            'code' => '654321',
        ])->assertUnprocessable()
            ->assertJsonPath('error_code', 'OTP_INVALID_OR_EXPIRED');

        $this->assertDatabaseMissing('users', ['phone' => $phone]);
    }

    public function test_phone_customer_without_a_password_can_set_a_first_password(): void
    {
        $user = $this->createCustomer([
            'phone' => '09121234567',
            'password' => null,
        ]);
        $user->forceFill(['phone_verified_at' => now()])->save();
        $this->actingAsCustomer($user);

        $this->postJson('/api/v1/auth/change-password', [
            'password' => 'FirstPassword123!',
            'password_confirmation' => 'FirstPassword123!',
        ])->assertOk();

        $this->assertTrue(Hash::check('FirstPassword123!', $user->fresh()->password));
    }

    public function test_password_reset_sms_returns_the_same_response_for_eligible_and_unknown_phones(): void
    {
        $phone = '09121234567';
        $this->createVerifiedPasswordCustomer($phone);
        $this->enablePasswordResetSms('novinetlogin');
        Http::fake($this->successfulLookupResponse());

        $eligibleResponse = $this->postJson('/api/v1/auth/password-reset/sms/send', ['phone' => $phone]);
        $unknownResponse = $this->postJson('/api/v1/auth/password-reset/sms/send', ['phone' => '09129999999']);

        $eligibleResponse->assertOk()
            ->assertJsonPath('data.success', true)
            ->assertJsonPath('data.message', 'If an eligible account exists, a password recovery code has been sent.');
        $unknownResponse->assertOk()
            ->assertJsonPath('data.success', true)
            ->assertJsonPath('data.message', 'If an eligible account exists, a password recovery code has been sent.');
        $this->assertSame($eligibleResponse->json('data.expires_in'), $unknownResponse->json('data.expires_in'));
        $this->assertSame($eligibleResponse->json('data.resend_in'), $unknownResponse->json('data.resend_in'));

        $this->assertDatabaseHas('sms_password_reset_codes', ['phone' => $phone]);
        $this->assertDatabaseMissing('sms_password_reset_codes', ['phone' => '09129999999']);
        Http::assertSentCount(1);
        Http::assertSent(fn ($request) => str_contains($request->url(), '/verify/lookup.json')
            && $request['receptor'] === $phone
            && $request['template'] === 'novinetlogin'
            && preg_match('/^\\d{6}$/', (string) $request['token']) === 1
            && !array_key_exists('sender', $request->data()));
        Http::assertNotSent(fn ($request) => str_contains($request->url(), '/sms/send.json'));
    }

    public function test_password_reset_sms_falls_back_to_approved_text_delivery_without_a_lookup_template(): void
    {
        $phone = '09121234567';
        $this->createVerifiedPasswordCustomer($phone);
        $this->enablePasswordResetSms();
        Http::fake($this->successfulSmsResponse());

        $this->postJson('/api/v1/auth/password-reset/sms/send', ['phone' => $phone])->assertOk();

        Http::assertSent(fn ($request) => str_contains($request->url(), '/sms/send.json')
            && $request['receptor'] === $phone
            && str_contains((string) $request['message'], 'بازیابی رمز عبور'));
        Http::assertNotSent(fn ($request) => str_contains($request->url(), '/verify/lookup.json'));
    }

    public function test_password_reset_sms_does_not_send_a_second_code_during_the_resend_window(): void
    {
        $phone = '09121234567';
        $this->createVerifiedPasswordCustomer($phone);
        $this->enablePasswordResetSms();
        Http::fake($this->successfulSmsResponse());

        $this->postJson('/api/v1/auth/password-reset/sms/send', ['phone' => $phone])->assertOk();
        $firstCode = SmsPasswordResetCode::query()->where('phone', $phone)->firstOrFail();
        $firstHash = $firstCode->code_hash;

        $this->postJson('/api/v1/auth/password-reset/sms/send', ['phone' => $phone])
            ->assertOk()
            ->assertJsonPath('data.success', true);

        $this->assertSame($firstHash, $firstCode->fresh()->code_hash);
        Http::assertSentCount(1);
    }

    public function test_valid_password_reset_sms_code_changes_password_revokes_old_tokens_and_returns_a_fresh_token(): void
    {
        $phone = '09121234567';
        $user = $this->createVerifiedPasswordCustomer($phone, 'OldPassword123!');
        $oldToken = $user->createToken('existing-session');
        SmsPasswordResetCode::create([
            'user_id' => $user->id,
            'phone' => $phone,
            'code_hash' => Hash::make('123456'),
            'expires_at' => now()->addMinutes(10),
            'attempts' => 0,
        ]);

        $response = $this->postJson('/api/v1/auth/password-reset/sms/confirm', [
            'phone' => $phone,
            'code' => '123456',
            'password' => 'NewPassword123!',
            'password_confirmation' => 'NewPassword123!',
            'device_name' => 'phpunit',
        ]);

        $response->assertOk()
            ->assertJsonPath('data.user.id', $user->id)
            ->assertJsonStructure(['data' => ['token']]);
        $this->assertTrue(Hash::check('NewPassword123!', $user->fresh()->password));
        $this->assertDatabaseMissing('personal_access_tokens', ['id' => $oldToken->accessToken->id]);
        $this->assertDatabaseCount('personal_access_tokens', 1);
        $this->assertNotNull(SmsPasswordResetCode::query()->where('user_id', $user->id)->value('consumed_at'));
    }

    public function test_invalid_expired_or_consumed_reset_codes_cannot_change_the_password(): void
    {
        $phone = '09121234567';
        $user = $this->createVerifiedPasswordCustomer($phone, 'OldPassword123!');
        SmsPasswordResetCode::create([
            'user_id' => $user->id,
            'phone' => $phone,
            'code_hash' => Hash::make('123456'),
            'expires_at' => now()->subSecond(),
            'attempts' => 0,
        ]);

        $payload = [
            'phone' => $phone,
            'code' => '123456',
            'password' => 'NewPassword123!',
            'password_confirmation' => 'NewPassword123!',
        ];

        $this->postJson('/api/v1/auth/password-reset/sms/confirm', $payload)
            ->assertUnprocessable()
            ->assertJsonPath('error_code', 'PASSWORD_RESET_SMS_INVALID_OR_EXPIRED');
        $this->assertTrue(Hash::check('OldPassword123!', $user->fresh()->password));

        $record = SmsPasswordResetCode::query()->where('user_id', $user->id)->firstOrFail();
        $record->forceFill(['expires_at' => now()->addMinutes(10), 'consumed_at' => now()])->save();
        $this->postJson('/api/v1/auth/password-reset/sms/confirm', $payload)
            ->assertUnprocessable()
            ->assertJsonPath('error_code', 'PASSWORD_RESET_SMS_INVALID_OR_EXPIRED');
        $this->assertTrue(Hash::check('OldPassword123!', $user->fresh()->password));
    }

    public function test_invalid_password_reset_code_increments_attempts_without_changing_password(): void
    {
        $phone = '09121234567';
        $user = $this->createVerifiedPasswordCustomer($phone, 'OldPassword123!');
        SmsPasswordResetCode::create([
            'user_id' => $user->id,
            'phone' => $phone,
            'code_hash' => Hash::make('123456'),
            'expires_at' => now()->addMinutes(10),
            'attempts' => 0,
        ]);

        $this->postJson('/api/v1/auth/password-reset/sms/confirm', [
            'phone' => $phone,
            'code' => '654321',
            'password' => 'NewPassword123!',
            'password_confirmation' => 'NewPassword123!',
        ])->assertUnprocessable()
            ->assertJsonPath('error_code', 'PASSWORD_RESET_SMS_INVALID_OR_EXPIRED');

        $this->assertSame(1, SmsPasswordResetCode::query()->where('user_id', $user->id)->value('attempts'));
        $this->assertTrue(Hash::check('OldPassword123!', $user->fresh()->password));
    }

    private function createVerifiedPasswordCustomer(string $phone, string $password = 'SecurePass123!'): User
    {
        $user = $this->createCustomer([
            'phone' => $phone,
            'password' => Hash::make($password),
        ]);
        $user->forceFill(['phone_verified_at' => now()])->save();

        return $user->fresh();
    }

    private function enablePasswordResetSms(string $otpTemplate = ''): void
    {
        app(SmsConfigurationService::class)->save([
            'provider' => 'kavenegar',
            'enabled' => true,
            'api_key' => 'test-kavenegar-key',
            'sender' => '10004346',
            'otp_template' => $otpTemplate,
            'templates' => [
                'otp' => ['enabled' => true, 'text' => 'کد تأیید ورود شما در نوین‌نت: {code}'],
                'password_reset' => ['enabled' => true, 'text' => 'کد بازیابی رمز عبور شما در نوین‌نت: {code}'],
                'order_paid' => ['enabled' => false, 'text' => '{name}، سفارش {order_number} پرداخت شد.'],
                'order_shipped' => ['enabled' => false, 'text' => '{name}، سفارش {order_number} ارسال شد.{tracking_suffix}'],
                'ticket_reply' => ['enabled' => false, 'text' => '{name}، پاسخ تیکت {ticket_number} ثبت شد.'],
            ],
        ]);
    }

    /** @return array<string, \Illuminate\Http\Client\Response> */
    private function successfulLookupResponse(): array
    {
        return [
            'https://api.kavenegar.com/v1/*/verify/lookup.json' => Http::response([
                'return' => ['status' => 200],
                'entries' => [['messageid' => 12345, 'status' => 1, 'statustext' => 'در صف ارسال']],
            ]),
        ];
    }

    /** @return array<string, \Illuminate\Http\Client\Response> */
    private function successfulSmsResponse(): array
    {
        return [
            'https://api.kavenegar.com/v1/*/sms/send.json' => Http::response([
                'return' => ['status' => 200],
                'entries' => [['messageid' => 12345, 'status' => 1, 'statustext' => 'در صف ارسال']],
            ]),
        ];
    }
}
