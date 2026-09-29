<?php

namespace Tests\Feature\Settings;

use App\Modules\Auth\Models\PhoneVerificationCode;
use App\Modules\Settings\Jobs\SendSystemSms;
use App\Modules\Settings\Models\Setting;
use App\Modules\Settings\Models\SmsDelivery;
use App\Modules\Settings\Services\KavenegarSmsService;
use App\Modules\Settings\Services\SmsConfigurationService;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class KavenegarSmsConfigurationTest extends TestCase
{
    public function test_admin_can_save_an_encrypted_kavenegar_key_and_test_connection_without_sending_sms(): void
    {
        $admin = $this->createAdmin();
        $this->actingAsAdmin($admin);
        $config = $this->configuration(['enabled' => false, 'api_key' => 'test-kavenegar-key', 'sender' => '10004346']);

        $this->putJson('/api/v1/admin/settings/sms_config', ['settings' => ['config' => $config]])
            ->assertOk()
            ->assertJsonPath('data.config.api_key', '')
            ->assertJsonPath('data.config.api_key_configured', true)
            ->assertJsonPath('data.config.sender', '10004346');

        $stored = Setting::query()->where('key', 'sms_config.config')->value('value');
        $this->assertNotSame('test-kavenegar-key', $stored['api_key']);

        Http::fake([
            'https://api.kavenegar.com/v1/*/account/info.json' => Http::response([
                'return' => ['status' => 200],
                'entries' => ['remaincredit' => 50000, 'expiredate' => '1788035400', 'type' => 'Master'],
            ]),
        ]);

        $this->postJson('/api/v1/admin/sms/test-connection')
            ->assertOk()
            ->assertJsonPath('data.remaining_credit', 50000)
            ->assertJsonPath('data.account_type', 'Master');

        Http::assertNotSent(fn ($request) => str_contains($request->url(), '/sms/send.json'));
    }

    public function test_otp_send_calls_kavenegar_only_when_admin_has_explicitly_enabled_sms(): void
    {
        app(SmsConfigurationService::class)->save($this->configuration([
            'enabled' => true,
            'api_key' => 'test-kavenegar-key',
            'sender' => '10004346',
        ]));

        Http::fake([
            'https://api.kavenegar.com/v1/*/sms/send.json' => Http::response([
                'return' => ['status' => 200],
                'entries' => [['messageid' => 12345, 'status' => 1, 'statustext' => 'در صف ارسال']],
            ]),
        ]);

        $this->postJson('/api/v1/auth/otp/send', ['phone' => '09121234567'])
            ->assertOk()
            ->assertJsonPath('data.success', true);

        $this->assertDatabaseHas('phone_verification_codes', ['phone' => '09121234567']);
        Http::assertSent(fn ($request) => str_contains($request->url(), '/sms/send.json')
            && $request['receptor'] === '09121234567'
            && $request['sender'] === '10004346');
    }

    public function test_disabled_event_is_logged_as_skipped_without_provider_request(): void
    {
        app(SmsConfigurationService::class)->save($this->configuration([
            'enabled' => true,
            'api_key' => 'test-kavenegar-key',
            'sender' => '10004346',
        ]));

        Http::fake();
        $job = new SendSystemSms('order_paid', 'order-paid-99', '09121234567', [
            'name' => 'مشتری',
            'order_number' => 'ORD-99',
            'amount' => 100000,
        ]);
        $job->handle(app(SmsConfigurationService::class), app(KavenegarSmsService::class));

        $this->assertDatabaseHas('sms_deliveries', [
            'event_key' => 'order-paid-99',
            'status' => SmsDelivery::STATUS_SKIPPED,
            'failure_code' => 'SMS_EVENT_DISABLED',
        ]);
        Http::assertNothingSent();
    }

    public function test_enabled_system_event_sends_once_and_persists_the_provider_message_id(): void
    {
        app(SmsConfigurationService::class)->save($this->configuration([
            'enabled' => true,
            'api_key' => 'test-kavenegar-key',
            'sender' => '10004346',
            'templates' => ['order_paid' => ['enabled' => true]],
        ]));

        Http::fake([
            'https://api.kavenegar.com/v1/*/sms/send.json' => Http::response([
                'return' => ['status' => 200],
                'entries' => [['messageid' => 67890, 'status' => 1, 'statustext' => 'در صف ارسال']],
            ]),
        ]);

        $job = new SendSystemSms('order_paid', 'order-paid-100', '09121234567', [
            'name' => 'مشتری',
            'order_number' => 'ORD-100',
            'amount' => 250000,
        ]);
        $job->handle(app(SmsConfigurationService::class), app(KavenegarSmsService::class));
        $job->handle(app(SmsConfigurationService::class), app(KavenegarSmsService::class));

        $this->assertDatabaseHas('sms_deliveries', [
            'event_key' => 'order-paid-100',
            'status' => SmsDelivery::STATUS_SENT,
            'provider_message_id' => '67890',
        ]);
        Http::assertSentCount(1);
    }

    /** @param array<string, mixed> $overrides @return array<string, mixed> */
    private function configuration(array $overrides = []): array
    {
        $templates = [
            'otp' => ['enabled' => true, 'text' => 'کد تأیید ورود شما در نوین‌نت: {code}'],
            'password_reset' => ['enabled' => true, 'text' => 'کد بازیابی رمز عبور شما در نوین‌نت: {code}'],
            'order_paid' => ['enabled' => false, 'text' => '{name}، سفارش {order_number} پرداخت شد.'],
            'order_shipped' => ['enabled' => false, 'text' => '{name}، سفارش {order_number} ارسال شد.{tracking_suffix}'],
            'ticket_reply' => ['enabled' => false, 'text' => '{name}، پاسخ تیکت {ticket_number} ثبت شد.'],
        ];

        return array_replace_recursive([
            'provider' => 'kavenegar',
            'enabled' => false,
            'api_key' => '',
            'sender' => '',
            'otp_template' => '',
            'templates' => $templates,
        ], $overrides);
    }
}
