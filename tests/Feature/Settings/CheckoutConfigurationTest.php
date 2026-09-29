<?php

namespace Tests\Feature\Settings;

use App\Modules\Settings\Models\Setting;
use App\Modules\Settings\Services\CheckoutConfigurationService;
use App\Modules\Shared\Exceptions\DomainException;
use Tests\TestCase;

class CheckoutConfigurationTest extends TestCase
{
    public function test_admin_can_save_checkout_configuration_and_public_endpoint_redacts_bank_details(): void
    {
        $admin = $this->createAdmin();
        $config = [
            'payment' => [
                'online_enabled' => false,
                'wallet_enabled' => true,
                'bank_transfer_enabled' => true,
                'default_method' => 'wallet',
                'bank_account_name' => 'نوین‌نت',
                'bank_card_number' => '6037991234567890',
            ],
            'shipping' => [
                'default_method_id' => 'tipax',
                'methods' => [
                    ['id' => 'post', 'title' => 'پست پیشتاز', 'description' => 'رهگیری مرسوله', 'enabled' => true, 'base_cost' => 450000, 'free_shipping_threshold' => 15000000],
                    ['id' => 'tipax', 'title' => 'تیپاکس', 'description' => 'تحویل سریع', 'enabled' => true, 'base_cost' => 650000, 'free_shipping_threshold' => 0],
                ],
            ],
        ];

        $this->actingAsAdmin($admin);
        $this->putJson('/api/v1/admin/settings/checkout_config', ['settings' => ['config' => $config]])
            ->assertOk()
            ->assertJsonPath('data.config.payment.bank_card_number', '6037991234567890')
            ->assertJsonPath('data.config.shipping.methods.0.base_cost', 450000);

        $this->getJson('/api/v1/checkout/configuration')
            ->assertOk()
            ->assertJsonPath('data.payment.bank_transfer_enabled', true)
            ->assertJsonPath('data.shipping.default_method_id', 'tipax')
            ->assertJsonPath('data.shipping.methods.0.base_cost', 450000)
            ->assertJsonMissingPath('data.payment.bank_account_name')
            ->assertJsonMissingPath('data.payment.bank_card_number');
    }

    public function test_admin_cannot_save_checkout_configuration_with_invalid_method_invariants(): void
    {
        $admin = $this->createAdmin();
        $this->actingAsAdmin($admin);

        $config = [
            'payment' => [
                'online_enabled' => false,
                'wallet_enabled' => true,
                'bank_transfer_enabled' => false,
                'default_method' => 'online',
                'bank_account_name' => '',
                'bank_card_number' => '',
            ],
            'shipping' => [
                'default_method_id' => 'post',
                'methods' => [
                    ['id' => 'post', 'title' => 'پست پیشتاز', 'description' => '', 'enabled' => false, 'base_cost' => 450000, 'free_shipping_threshold' => 0],
                    ['id' => 'post', 'title' => 'پست تکراری', 'description' => '', 'enabled' => false, 'base_cost' => 450000, 'free_shipping_threshold' => 0],
                ],
            ],
        ];

        $this->putJson('/api/v1/admin/settings/checkout_config', ['settings' => ['config' => $config]])
            ->assertUnprocessable()
            ->assertJsonValidationErrors([
                'settings.config.payment.default_method',
                'settings.config.shipping.methods',
                'settings.config.shipping.default_method_id',
                'settings.config.shipping.methods.1.id',
            ]);
    }

    public function test_shipping_cost_is_resolved_in_irr_and_becomes_free_at_threshold(): void
    {
        Setting::create([
            'key' => 'checkout_config.config',
            'group' => 'checkout_config',
            'value' => [
                'payment' => ['online_enabled' => true, 'wallet_enabled' => false, 'bank_transfer_enabled' => false],
                'shipping' => [
                    'default_method_id' => 'post',
                    'methods' => [[
                        'id' => 'post',
                        'title' => 'پست پیشتاز',
                        'enabled' => true,
                        'base_cost' => 450000,
                        'free_shipping_threshold' => 15000000,
                    ]],
                ],
            ],
            'is_public' => false,
        ]);

        $service = app(CheckoutConfigurationService::class);

        $this->assertSame(450000, $service->resolveShipping('post', 14999999)['cost']);
        $this->assertSame(0, $service->resolveShipping('post', 15000000)['cost']);
    }

    public function test_zibal_merchant_is_encrypted_at_rest_and_never_exposed_publicly(): void
    {
        $admin = $this->createAdmin();
        $this->actingAsAdmin($admin);

        $config = [
            'payment' => [
                'online_enabled' => true,
                'online_provider' => 'zibal',
                'zibal_sandbox' => false,
                'zibal_merchant' => 'merchant-live-example',
                'wallet_enabled' => false,
                'bank_transfer_enabled' => false,
                'default_method' => 'online',
                'bank_account_name' => '',
                'bank_card_number' => '',
            ],
            'shipping' => [
                'default_method_id' => 'post',
                'methods' => [[
                    'id' => 'post',
                    'title' => 'پست پیشتاز',
                    'description' => '',
                    'enabled' => true,
                    'base_cost' => 450000,
                    'free_shipping_threshold' => 0,
                ]],
            ],
        ];

        $this->putJson('/api/v1/admin/settings/checkout_config', ['settings' => ['config' => $config]])
            ->assertOk()
            ->assertJsonPath('data.config.payment.zibal_merchant', 'merchant-live-example');

        $stored = Setting::query()->where('key', 'checkout_config.config')->value('value');
        $this->assertNotSame('merchant-live-example', $stored['payment']['zibal_merchant']);

        $this->getJson('/api/v1/checkout/configuration')
            ->assertOk()
            ->assertJsonPath('data.payment.online_provider', 'zibal')
            ->assertJsonMissingPath('data.payment.zibal_merchant');
    }

    public function test_checkout_configuration_service_rejects_disabled_shipping_and_payment_methods(): void
    {
        Setting::create([
            'key' => 'checkout_config.config',
            'group' => 'checkout_config',
            'value' => [
                'payment' => ['online_enabled' => false, 'wallet_enabled' => true, 'bank_transfer_enabled' => false],
                'shipping' => ['methods' => [['id' => 'post', 'enabled' => false, 'base_cost' => 450000]]],
            ],
            'is_public' => false,
        ]);

        $service = app(CheckoutConfigurationService::class);

        try {
            $service->resolveShipping('post', 100000);
            $this->fail('Expected disabled shipping method to be rejected.');
        } catch (DomainException $exception) {
            $this->assertSame('SHIPPING_METHOD_UNAVAILABLE', $exception->getErrorCode());
        }

        try {
            $service->assertPaymentGatewayEnabled('test');
            $this->fail('Expected disabled payment method to be rejected.');
        } catch (DomainException $exception) {
            $this->assertSame('PAYMENT_METHOD_UNAVAILABLE', $exception->getErrorCode());
        }
    }
}
