<?php

namespace App\Modules\Settings\Services;

use App\Modules\Settings\Models\Setting;
use App\Modules\Shared\Exceptions\DomainException;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Support\Facades\Crypt;

class CheckoutConfigurationService
{
    /**
     * This default preserves checkout behavior until an admin saves a configuration.
     * Amounts are always stored in IRR, matching orders and the payment gateway contract.
     */
    public function get(): array
    {
        $stored = Setting::query()
            ->where('key', 'checkout_config.config')
            ->value('value');

        $defaults = $this->defaults();
        $stored = is_array($stored) ? $stored : [];
        $payment = is_array($stored['payment'] ?? null) ? $stored['payment'] : [];
        $shipping = is_array($stored['shipping'] ?? null) ? $stored['shipping'] : [];
        $payment = array_replace($defaults['payment'], $payment);
        $payment['zibal_merchant'] = $this->decryptMerchant((string) ($payment['zibal_merchant'] ?? ''));

        return [
            'payment' => $payment,
            'shipping' => [
                'default_method_id' => (string) ($shipping['default_method_id'] ?? $defaults['shipping']['default_method_id']),
                'methods' => is_array($shipping['methods'] ?? null)
                    ? array_values($shipping['methods'])
                    : $defaults['shipping']['methods'],
            ],
        ];
    }

    /**
     * Admin-only configuration. Sensitive values are decrypted only after admin authorization.
     */
    public function adminConfig(): array
    {
        return $this->get();
    }

    /**
     * Persist checkout configuration while encrypting the payment merchant code at rest.
     */
    public function save(array $config): array
    {
        $defaults = $this->defaults();
        $payment = array_replace($defaults['payment'], is_array($config['payment'] ?? null) ? $config['payment'] : []);
        $merchant = trim((string) ($payment['zibal_merchant'] ?? ''));
        $payment['zibal_merchant'] = $merchant === '' ? '' : Crypt::encryptString($merchant);
        unset($payment['zibal_merchant_configured']);

        $stored = [
            'payment' => $payment,
            'shipping' => [
                'default_method_id' => (string) ($config['shipping']['default_method_id'] ?? $defaults['shipping']['default_method_id']),
                'methods' => array_values($config['shipping']['methods'] ?? $defaults['shipping']['methods']),
            ],
        ];

        Setting::updateOrCreate(
            ['key' => 'checkout_config.config'],
            [
                'group' => 'checkout_config',
                'value' => $stored,
                'is_public' => false,
            ]
        );

        return $this->adminConfig();
    }

    public function isProduction(): bool
    {
        return (function_exists('app') && app()->environment('production')) || config('app.env') === 'production';
    }

    /**
     * Authoritative list of implemented, configured, enabled, and environment-appropriate gateways.
     * Never exposes secrets.
     */
    public function availableGateways(): array
    {
        $config = $this->get();
        $payment = $config['payment'] ?? [];
        $isProd = $this->isProduction();

        $gateways = [];

        // 1. Zibal (Online Shaparak Gateway)
        $onlineEnabled = (bool) ($payment['online_enabled'] ?? true);
        $onlineProvider = (string) ($payment['online_provider'] ?? 'zibal');
        $zibalMerchant = trim((string) ($payment['zibal_merchant'] ?? ''));
        $isSandbox = (bool) ($payment['zibal_sandbox'] ?? true);

        // In production, Zibal requires a configured real merchant code.
        // In non-production environments, the sandbox merchant 'zibal' is valid.
        $zibalConfigured = $isProd
            ? ($zibalMerchant !== '' && $zibalMerchant !== 'zibal')
            : ($zibalMerchant !== '');

        if ($onlineEnabled && $onlineProvider === 'zibal' && $zibalConfigured) {
            $gateways[] = [
                'id' => 'zibal',
                'name' => 'zibal',
                'title' => 'درگاه پرداخت اینترنتی زیبال',
                'display_label' => 'درگاه پرداخت اینترنتی زیبال (کارت‌های بانکی عضو شتاب)',
                'description' => 'پرداخت امن آنلاین از طریق کلیه کارت‌های عضو شبکه بانکی کشور (شاپرک)',
                'environment' => $isSandbox ? 'sandbox' : 'production',
                'environment_label' => $isSandbox ? 'آزمایشی (سندباکس)' : 'عملیاتی (شاپرک)',
                'is_test' => false,
                'enabled' => true,
                'capabilities' => ['cards_shetab', 'instant_verification', 'redirect_payment'],
                'currencies' => ['IRR', 'IRT'],
            ];
        }

        // 2. Wallet Gateway
        $walletEnabled = (bool) ($payment['wallet_enabled'] ?? true);
        if ($walletEnabled) {
            $gateways[] = [
                'id' => 'wallet',
                'name' => 'wallet',
                'title' => 'کیف پول نوین‌نت',
                'display_label' => 'کسر از اعتبار کیف پول نوین‌نت',
                'description' => 'پرداخت آنی بدون کارمزد از مانده اعتبار حساب کاربری',
                'environment' => 'internal',
                'environment_label' => 'داخلی',
                'is_test' => false,
                'enabled' => true,
                'capabilities' => ['instant_settlement', 'zero_gateway_fee'],
                'currencies' => ['IRR', 'IRT'],
            ];
        }

        // 3. Bank Transfer Gateway
        $bankTransferEnabled = (bool) ($payment['bank_transfer_enabled'] ?? false);
        if ($bankTransferEnabled) {
            $gateways[] = [
                'id' => 'bank_transfer',
                'name' => 'bank_transfer',
                'title' => 'انتقال بانکی / کارت به کارت',
                'display_label' => 'واریز به حساب / کارت به کارت بانکی',
                'description' => 'واریز وجه و ثبت اطلاعات فیش جهت تأیید واحد مالی',
                'environment' => 'offline',
                'environment_label' => 'آفلاین',
                'is_test' => false,
                'enabled' => true,
                'capabilities' => ['offline_verification', 'receipt_upload'],
                'currencies' => ['IRR', 'IRT'],
            ];
        }

        // 4. Test Payment Simulator (STAGING/TESTING ONLY - STRICTLY PROHIBITED IN PRODUCTION)
        if (!$isProd) {
            $gateways[] = [
                'id' => 'test',
                'name' => 'test',
                'title' => 'درگاه پرداخت شبیه‌ساز (تستی)',
                'display_label' => 'درگاه پرداخت شبیه‌ساز (محیط آزمایشی / تستی)',
                'description' => 'درگاه آزمایشی صرفاً جهت شبیه‌سازی و تست خرید در محیط توسعه (Staging Only)',
                'environment' => 'staging',
                'environment_label' => 'آزمایشی (توسعه / Staging)',
                'is_test' => true,
                'enabled' => true,
                'capabilities' => ['simulator_only', 'staging_only'],
                'currencies' => ['IRR', 'IRT'],
            ];
        }

        return $gateways;
    }

    /**
     * @return string[]
     */
    public function availableGatewayIds(): array
    {
        return array_column($this->availableGateways(), 'id');
    }

    /**
     * Public configuration intentionally excludes account and merchant credentials.
     */
    public function publicConfig(): array
    {
        $config = $this->get();
        $gateways = $this->availableGateways();

        return [
            'payment' => [
                'online_enabled' => (bool) ($config['payment']['online_enabled'] ?? true),
                'online_provider' => (string) ($config['payment']['online_provider'] ?? 'zibal'),
                'wallet_enabled' => (bool) ($config['payment']['wallet_enabled'] ?? true),
                'bank_transfer_enabled' => (bool) ($config['payment']['bank_transfer_enabled'] ?? false),
                'default_method' => (string) ($config['payment']['default_method'] ?? 'online'),
                'gateways' => $gateways,
            ],
            'gateways' => $gateways,
            'shipping' => [
                'default_method_id' => (string) ($config['shipping']['default_method_id'] ?? 'post'),
                'methods' => array_values(array_map(static fn (array $method): array => [
                    'id' => (string) ($method['id'] ?? ''),
                    'title' => (string) ($method['title'] ?? ''),
                    'description' => (string) ($method['description'] ?? ''),
                    'enabled' => (bool) ($method['enabled'] ?? false),
                    'base_cost' => max(0, (int) ($method['base_cost'] ?? 0)),
                    'free_shipping_threshold' => max(0, (int) ($method['free_shipping_threshold'] ?? 0)),
                ], array_filter($config['shipping']['methods'] ?? [], 'is_array'))),
            ],
        ];
    }

    public function resolveShipping(string $methodId, int $subtotal): array
    {
        $config = $this->get();
        $methods = $config['shipping']['methods'] ?? [];

        foreach ($methods as $method) {
            if (!is_array($method) || ($method['id'] ?? null) !== $methodId) {
                continue;
            }

            if (($method['enabled'] ?? false) !== true) {
                throw new DomainException('Selected shipping method is not available.', 'SHIPPING_METHOD_UNAVAILABLE', 422);
            }

            $threshold = max(0, (int) ($method['free_shipping_threshold'] ?? 0));
            $baseCost = max(0, (int) ($method['base_cost'] ?? 0));

            return [
                'id' => $methodId,
                'title' => (string) ($method['title'] ?? $methodId),
                'cost' => $threshold > 0 && $subtotal >= $threshold ? 0 : $baseCost,
            ];
        }

        throw new DomainException('Selected shipping method is not available.', 'SHIPPING_METHOD_UNAVAILABLE', 422);
    }

    public function assertPaymentGatewayEnabled(string $gateway): void
    {
        $gateway = trim(strtolower($gateway));
        $available = $this->availableGatewayIds();

        if (!in_array($gateway, $available, true)) {
            throw new DomainException("Selected payment gateway '{$gateway}' is not available or disabled.", 'PAYMENT_METHOD_UNAVAILABLE', 422);
        }
    }

    /**
     * @return array{merchant: string, sandbox: bool}
     */
    public function zibalCredentials(): array
    {
        $payment = $this->get()['payment'] ?? [];
        $merchant = trim((string) ($payment['zibal_merchant'] ?? ''));

        if ($merchant === '') {
            throw new DomainException('Zibal merchant code is not configured.', 'ZIBAL_MERCHANT_NOT_CONFIGURED', 422);
        }

        return [
            'merchant' => $merchant,
            'sandbox' => (bool) ($payment['zibal_sandbox'] ?? true),
        ];
    }

    private function decryptMerchant(string $stored): string
    {
        if ($stored === '') {
            return '';
        }

        try {
            return Crypt::decryptString($stored);
        } catch (DecryptException) {
            // Backward-compatible read for a value that was saved before encryption was introduced.
            return $stored;
        }
    }

    private function defaults(): array
    {
        return [
            'payment' => [
                'online_enabled' => true,
                'online_provider' => 'zibal',
                'zibal_sandbox' => true,
                'zibal_merchant' => 'zibal',
                'wallet_enabled' => true,
                'bank_transfer_enabled' => false,
                'default_method' => 'online',
                'bank_account_name' => '',
                'bank_card_number' => '',
            ],
            'shipping' => [
                'default_method_id' => 'post',
                'methods' => [
                    [
                        'id' => 'post',
                        'title' => 'پست پیشتاز',
                        'description' => 'ارسال سراسری با رهگیری مرسوله',
                        'enabled' => true,
                        'base_cost' => 450000,
                        'free_shipping_threshold' => 15000000,
                    ],
                    [
                        'id' => 'tipax',
                        'title' => 'تیپاکس',
                        'description' => 'تحویل سریع در شهرهای تحت پوشش',
                        'enabled' => false,
                        'base_cost' => 650000,
                        'free_shipping_threshold' => 0,
                    ],
                    [
                        'id' => 'courier',
                        'title' => 'پیک شهری',
                        'description' => 'ارسال فوری در محدودهٔ شهری',
                        'enabled' => false,
                        'base_cost' => 800000,
                        'free_shipping_threshold' => 0,
                    ],
                ],
            ],
        ];
    }
}
