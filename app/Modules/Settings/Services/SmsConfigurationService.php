<?php

namespace App\Modules\Settings\Services;

use App\Modules\Settings\Models\Setting;
use App\Modules\Shared\Exceptions\DomainException;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Support\Facades\Crypt;

class SmsConfigurationService
{
    public const EVENT_OTP = 'otp';
    public const EVENT_PASSWORD_RESET = 'password_reset';
    public const EVENT_ORDER_PAID = 'order_paid';
    public const EVENT_ORDER_SHIPPED = 'order_shipped';
    public const EVENT_TICKET_REPLY = 'ticket_reply';

    /** @return array<string, mixed> */
    public function adminConfig(): array
    {
        $stored = $this->stored();
        $config = $this->resolvedConfig($stored);
        $config['api_key'] = '';
        $config['api_key_configured'] = trim((string) ($stored['api_key'] ?? '')) !== '';

        return $config;
    }

    /** @return array<string, mixed> */
    public function internalConfig(): array
    {
        $stored = $this->stored();
        $config = $this->resolvedConfig($stored);
        $config['api_key'] = $this->decryptApiKey((string) ($stored['api_key'] ?? ''));

        return $config;
    }

    /** @param array<string, mixed> $config @return array<string, mixed> */
    public function save(array $config): array
    {
        $current = $this->stored();
        $defaults = $this->defaults();
        $templates = array_replace($defaults['templates'], is_array($config['templates'] ?? null) ? $config['templates'] : []);
        $submittedApiKey = trim((string) ($config['api_key'] ?? ''));
        $storedApiKey = (string) ($current['api_key'] ?? '');

        if ($submittedApiKey !== '') {
            $storedApiKey = Crypt::encryptString($submittedApiKey);
        }

        if ((bool) ($config['clear_api_key'] ?? false)) {
            $storedApiKey = '';
        }

        $stored = [
            'provider' => 'kavenegar',
            'enabled' => (bool) ($config['enabled'] ?? false),
            'api_key' => $storedApiKey,
            'sender' => trim((string) ($config['sender'] ?? '')),
            'otp_template' => trim((string) ($config['otp_template'] ?? '')),
            'templates' => [
                self::EVENT_OTP => $this->normalizeTemplate($templates[self::EVENT_OTP] ?? [], $defaults['templates'][self::EVENT_OTP]),
                self::EVENT_PASSWORD_RESET => $this->normalizeTemplate($templates[self::EVENT_PASSWORD_RESET] ?? [], $defaults['templates'][self::EVENT_PASSWORD_RESET]),
                self::EVENT_ORDER_PAID => $this->normalizeTemplate($templates[self::EVENT_ORDER_PAID] ?? [], $defaults['templates'][self::EVENT_ORDER_PAID]),
                self::EVENT_ORDER_SHIPPED => $this->normalizeTemplate($templates[self::EVENT_ORDER_SHIPPED] ?? [], $defaults['templates'][self::EVENT_ORDER_SHIPPED]),
                self::EVENT_TICKET_REPLY => $this->normalizeTemplate($templates[self::EVENT_TICKET_REPLY] ?? [], $defaults['templates'][self::EVENT_TICKET_REPLY]),
            ],
        ];

        Setting::updateOrCreate(
            ['key' => 'sms_config.config'],
            ['group' => 'sms_config', 'value' => $stored, 'is_public' => false]
        );

        return $this->adminConfig();
    }

    /** @return array{api_key: string, sender: string, otp_template: string} */
    public function kavenegarCredentials(bool $requireEnabled = true): array
    {
        $config = $this->internalConfig();
        $key = trim((string) ($config['api_key'] ?? ''));

        if ($requireEnabled && !(bool) ($config['enabled'] ?? false)) {
            throw new DomainException('SMS delivery is disabled by the administrator.', 'SMS_DISABLED', 503);
        }

        if ($key === '') {
            throw new DomainException('Kavenegar API key is not configured.', 'SMS_API_KEY_NOT_CONFIGURED', 422);
        }

        return [
            'api_key' => $key,
            'sender' => trim((string) ($config['sender'] ?? '')),
            'otp_template' => trim((string) ($config['otp_template'] ?? '')),
        ];
    }

    /** @param array<string, string|int|float> $variables */
    public function render(string $event, array $variables): string
    {
        $config = $this->internalConfig();
        $template = (string) ($config['templates'][$event]['text'] ?? '');
        $replacement = [];
        foreach ($variables as $key => $value) {
            $replacement['{'.$key.'}'] = (string) $value;
        }

        return trim(strtr($template, $replacement));
    }

    public function canSend(string $event): bool
    {
        $config = $this->internalConfig();

        return (bool) ($config['enabled'] ?? false)
            && trim((string) ($config['api_key'] ?? '')) !== ''
            && (bool) ($config['templates'][$event]['enabled'] ?? false);
    }

    /** @return array<string, mixed> */
    private function stored(): array
    {
        $value = Setting::query()->where('key', 'sms_config.config')->value('value');

        return is_array($value) ? $value : [];
    }

    /** @param array<string, mixed> $stored @return array<string, mixed> */
    private function resolvedConfig(array $stored): array
    {
        $defaults = $this->defaults();
        $templates = array_replace($defaults['templates'], is_array($stored['templates'] ?? null) ? $stored['templates'] : []);

        return [
            'provider' => 'kavenegar',
            'enabled' => (bool) ($stored['enabled'] ?? $defaults['enabled']),
            'api_key' => '',
            'sender' => (string) ($stored['sender'] ?? $defaults['sender']),
            'otp_template' => (string) ($stored['otp_template'] ?? $defaults['otp_template']),
            'templates' => [
                self::EVENT_OTP => $this->normalizeTemplate($templates[self::EVENT_OTP] ?? [], $defaults['templates'][self::EVENT_OTP]),
                self::EVENT_PASSWORD_RESET => $this->normalizeTemplate($templates[self::EVENT_PASSWORD_RESET] ?? [], $defaults['templates'][self::EVENT_PASSWORD_RESET]),
                self::EVENT_ORDER_PAID => $this->normalizeTemplate($templates[self::EVENT_ORDER_PAID] ?? [], $defaults['templates'][self::EVENT_ORDER_PAID]),
                self::EVENT_ORDER_SHIPPED => $this->normalizeTemplate($templates[self::EVENT_ORDER_SHIPPED] ?? [], $defaults['templates'][self::EVENT_ORDER_SHIPPED]),
                self::EVENT_TICKET_REPLY => $this->normalizeTemplate($templates[self::EVENT_TICKET_REPLY] ?? [], $defaults['templates'][self::EVENT_TICKET_REPLY]),
            ],
        ];
    }

    /** @param mixed $template @param array<string, mixed> $fallback @return array<string, mixed> */
    private function normalizeTemplate(mixed $template, array $fallback): array
    {
        $template = is_array($template) ? $template : [];

        return [
            'enabled' => (bool) ($template['enabled'] ?? $fallback['enabled']),
            'label' => (string) ($fallback['label'] ?? ''),
            'text' => trim((string) ($template['text'] ?? $fallback['text'])),
        ];
    }

    private function decryptApiKey(string $stored): string
    {
        if ($stored === '') {
            return '';
        }

        try {
            return Crypt::decryptString($stored);
        } catch (DecryptException) {
            return $stored;
        }
    }

    /** @return array<string, mixed> */
    private function defaults(): array
    {
        return [
            'provider' => 'kavenegar',
            'enabled' => false,
            'sender' => '',
            'otp_template' => '',
            'templates' => [
                self::EVENT_OTP => [
                    'enabled' => true,
                    'label' => 'کد تأیید ورود',
                    'text' => 'کد تأیید ورود شما در نوین‌نت: {code}',
                ],
                self::EVENT_PASSWORD_RESET => [
                    'enabled' => true,
                    'label' => 'کد بازیابی رمز عبور',
                    'text' => 'کد بازیابی رمز عبور شما در نوین‌نت: {code}',
                ],
                self::EVENT_ORDER_PAID => [
                    'enabled' => false,
                    'label' => 'ثبت و پرداخت موفق سفارش',
                    'text' => '{name}، سفارش {order_number} با مبلغ {amount} ریال با موفقیت ثبت و پرداخت شد.',
                ],
                self::EVENT_ORDER_SHIPPED => [
                    'enabled' => false,
                    'label' => 'ارسال سفارش',
                    'text' => '{name}، سفارش {order_number} ارسال شد.{tracking_suffix}',
                ],
                self::EVENT_TICKET_REPLY => [
                    'enabled' => false,
                    'label' => 'پاسخ پشتیبانی',
                    'text' => '{name}، پاسخ جدیدی برای تیکت {ticket_number} در نوین‌نت ثبت شد.',
                ],
            ],
        ];
    }
}
