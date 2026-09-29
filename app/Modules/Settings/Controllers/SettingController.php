<?php

namespace App\Modules\Settings\Controllers;

use App\Modules\Settings\Services\CheckoutConfigurationService;
use App\Modules\Settings\Services\KavenegarSmsService;
use App\Modules\Settings\Services\SettingService;
use App\Modules\Settings\Services\SmsConfigurationService;
use App\Modules\Shared\Exceptions\DomainException;
use App\Modules\Shared\Helpers\ApiResponseHelper;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Validator;

class SettingController extends Controller
{
    public function __construct(
        private readonly SettingService $settingService,
        private readonly CheckoutConfigurationService $checkoutConfiguration,
        private readonly SmsConfigurationService $smsConfiguration,
        private readonly KavenegarSmsService $kavenegar,
    )
    {
    }

    public function public(): JsonResponse
    {
        return ApiResponseHelper::success(
            $this->settingService->getPublicGroups(),
            'Public settings retrieved successfully.'
        );
    }

    public function checkoutConfiguration(): JsonResponse
    {
        return ApiResponseHelper::success(
            $this->checkoutConfiguration->publicConfig(),
            'Checkout configuration retrieved successfully.'
        );
    }

    public function showAdmin(Request $request, string $group): JsonResponse
    {
        if ($group === 'checkout_config') {
            return ApiResponseHelper::success(
                ['config' => $this->checkoutConfiguration->adminConfig()],
                'Settings retrieved successfully.'
            );
        }

        if ($group === 'sms_config') {
            $this->ensureSmsAdministrator($request);

            return ApiResponseHelper::success(
                ['config' => $this->smsConfiguration->adminConfig()],
                'SMS settings retrieved successfully.'
            );
        }

        return ApiResponseHelper::success(
            $this->settingService->getAdminGroup($group),
            'Settings retrieved successfully.'
        );
    }

    public function testSmsConnection(Request $request): JsonResponse
    {
        $this->ensureSmsAdministrator($request);

        return ApiResponseHelper::success(
            $this->kavenegar->accountInfo(),
            'Kavenegar connection verified successfully.'
        );
    }

    private function ensureSmsAdministrator(Request $request): void
    {
        if ($request->user()?->role !== 'admin') {
            throw new DomainException('Only administrators can manage SMS credentials.', 'SMS_SETTINGS_ADMIN_ONLY', 403);
        }
    }

    public function updateAdmin(Request $request, string $group): JsonResponse
    {
        if ($group === 'sms_config') {
            $this->ensureSmsAdministrator($request);
        }

        $rules = [
            'settings' => ['required', 'array'],
            'settings.*' => ['nullable'],
        ];

        if ($group === 'sms_config') {
            $rules = [
                'settings' => ['required', 'array'],
                'settings.config' => ['required', 'array'],
                'settings.config.provider' => ['nullable', 'in:kavenegar'],
                'settings.config.enabled' => ['required', 'boolean'],
                'settings.config.api_key' => ['nullable', 'string', 'max:512'],
                'settings.config.clear_api_key' => ['nullable', 'boolean'],
                'settings.config.sender' => ['nullable', 'string', 'max:32', 'regex:/^[+0-9]+$/'],
                'settings.config.otp_template' => ['nullable', 'string', 'max:120', 'regex:/^[A-Za-z0-9_-]*$/'],
                'settings.config.templates' => ['required', 'array'],
                'settings.config.templates.otp.enabled' => ['required', 'boolean'],
                'settings.config.templates.otp.text' => ['required', 'string', 'max:900'],
                'settings.config.templates.password_reset.enabled' => ['required', 'boolean'],
                'settings.config.templates.password_reset.text' => ['required', 'string', 'max:900'],
                'settings.config.templates.order_paid.enabled' => ['required', 'boolean'],
                'settings.config.templates.order_paid.text' => ['required', 'string', 'max:900'],
                'settings.config.templates.order_shipped.enabled' => ['required', 'boolean'],
                'settings.config.templates.order_shipped.text' => ['required', 'string', 'max:900'],
                'settings.config.templates.ticket_reply.enabled' => ['required', 'boolean'],
                'settings.config.templates.ticket_reply.text' => ['required', 'string', 'max:900'],
            ];
        } elseif ($group === 'checkout_config') {
            $rules = [
                'settings' => ['required', 'array'],
                'settings.config' => ['required', 'array'],
                'settings.config.payment' => ['required', 'array'],
                'settings.config.payment.online_enabled' => ['required', 'boolean'],
                'settings.config.payment.online_provider' => ['nullable', 'in:zibal'],
                'settings.config.payment.zibal_sandbox' => ['nullable', 'boolean'],
                'settings.config.payment.zibal_merchant' => ['nullable', 'string', 'max:120'],
                'settings.config.payment.wallet_enabled' => ['required', 'boolean'],
                'settings.config.payment.bank_transfer_enabled' => ['required', 'boolean'],
                'settings.config.payment.default_method' => ['required', 'in:online,wallet,bank_transfer'],
                'settings.config.payment.bank_account_name' => ['nullable', 'string', 'max:120'],
                'settings.config.payment.bank_card_number' => ['nullable', 'string', 'regex:/^\d{16}$/'],
                'settings.config.shipping' => ['required', 'array'],
                'settings.config.shipping.default_method_id' => ['required', 'string', 'max:64', 'regex:/^[a-z0-9_-]+$/'],
                'settings.config.shipping.methods' => ['required', 'array', 'min:1', 'max:10'],
                'settings.config.shipping.methods.*.id' => ['required', 'string', 'max:64', 'regex:/^[a-z0-9_-]+$/'],
                'settings.config.shipping.methods.*.title' => ['required', 'string', 'max:120'],
                'settings.config.shipping.methods.*.description' => ['nullable', 'string', 'max:500'],
                'settings.config.shipping.methods.*.enabled' => ['required', 'boolean'],
                'settings.config.shipping.methods.*.base_cost' => ['required', 'integer', 'min:0', 'max:1000000000'],
                'settings.config.shipping.methods.*.free_shipping_threshold' => ['required', 'integer', 'min:0', 'max:10000000000'],
            ];
        }

        $validator = Validator::make($request->all(), $rules);

        if ($group === 'sms_config') {
            $validator->after(function ($validator) use ($request): void {
                $config = $request->input('settings.config', []);
                $enabled = (bool) ($config['enabled'] ?? false);
                $hasExistingKey = (bool) ($this->smsConfiguration->adminConfig()['api_key_configured'] ?? false);
                $submittedKey = trim((string) ($config['api_key'] ?? ''));
                $clearKey = (bool) ($config['clear_api_key'] ?? false);
                $sender = trim((string) ($config['sender'] ?? ''));
                $otpEnabled = (bool) data_get($config, 'templates.otp.enabled', false);

                if ($enabled && $sender === '') {
                    $validator->errors()->add('settings.config.sender', 'An approved Kavenegar sender line is required before SMS can be enabled.');
                }

                if ($enabled && $clearKey) {
                    $validator->errors()->add('settings.config.api_key', 'An API key is required before SMS can be enabled.');
                } elseif ($enabled && $submittedKey === '' && !$hasExistingKey) {
                    $validator->errors()->add('settings.config.api_key', 'An API key is required before SMS can be enabled.');
                }

                if ($enabled && !$otpEnabled) {
                    $validator->errors()->add('settings.config.templates.otp.enabled', 'OTP delivery must remain enabled while the SMS service is enabled.');
                }
            });
        } elseif ($group === 'checkout_config') {
            $validator->after(function ($validator) use ($request): void {
                $config = $request->input('settings.config', []);
                $payment = is_array($config['payment'] ?? null) ? $config['payment'] : [];
                $shipping = is_array($config['shipping'] ?? null) ? $config['shipping'] : [];
                $methods = is_array($shipping['methods'] ?? null) ? $shipping['methods'] : [];

                $enabledPayments = [
                    'online' => (bool) ($payment['online_enabled'] ?? false),
                    'wallet' => (bool) ($payment['wallet_enabled'] ?? false),
                    'bank_transfer' => (bool) ($payment['bank_transfer_enabled'] ?? false),
                ];

                if (!in_array(true, $enabledPayments, true)) {
                    $validator->errors()->add('settings.config.payment', 'At least one payment method must be enabled.');
                }

                $defaultPayment = $payment['default_method'] ?? null;
                if (is_string($defaultPayment) && (($enabledPayments[$defaultPayment] ?? false) !== true)) {
                    $validator->errors()->add('settings.config.payment.default_method', 'The default payment method must be enabled.');
                }

                $onlineProvider = (string) ($payment['online_provider'] ?? 'zibal');
                $zibalSandbox = (bool) ($payment['zibal_sandbox'] ?? true);
                if (($enabledPayments['online'] ?? false) === true && $onlineProvider === 'zibal' && !$zibalSandbox && trim((string) ($payment['zibal_merchant'] ?? '')) === '') {
                    $validator->errors()->add('settings.config.payment.zibal_merchant', 'Zibal merchant code is required before live payments can be enabled.');
                }

                if (($enabledPayments['bank_transfer'] ?? false) === true) {
                    if (mb_strlen(trim((string) ($payment['bank_account_name'] ?? ''))) < 2) {
                        $validator->errors()->add('settings.config.payment.bank_account_name', 'Bank account name is required when bank transfer is enabled.');
                    }
                    if (!preg_match('/^\d{16}$/', (string) ($payment['bank_card_number'] ?? ''))) {
                        $validator->errors()->add('settings.config.payment.bank_card_number', 'A 16-digit bank card number is required when bank transfer is enabled.');
                    }
                }

                $methodIds = [];
                $enabledShippingIds = [];
                foreach ($methods as $index => $method) {
                    if (!is_array($method)) {
                        continue;
                    }

                    $id = $method['id'] ?? null;
                    if (is_string($id) && $id !== '') {
                        if (in_array($id, $methodIds, true)) {
                            $validator->errors()->add("settings.config.shipping.methods.{$index}.id", 'Shipping method identifiers must be unique.');
                        }
                        $methodIds[] = $id;
                        if (($method['enabled'] ?? false) === true) {
                            $enabledShippingIds[] = $id;
                        }
                    }
                }

                if ($enabledShippingIds === []) {
                    $validator->errors()->add('settings.config.shipping.methods', 'At least one shipping method must be enabled.');
                }

                if (!in_array($shipping['default_method_id'] ?? null, $enabledShippingIds, true)) {
                    $validator->errors()->add('settings.config.shipping.default_method_id', 'The default shipping method must exist and be enabled.');
                }
            });
        }

        $validated = $validator->validate();

        if ($group === 'checkout_config') {
            return ApiResponseHelper::success(
                ['config' => $this->checkoutConfiguration->save($validated['settings']['config'])],
                'Settings updated successfully.'
            );
        }

        if ($group === 'sms_config') {
            return ApiResponseHelper::success(
                ['config' => $this->smsConfiguration->save($validated['settings']['config'])],
                'SMS settings updated successfully.'
            );
        }

        return ApiResponseHelper::success(
            $this->settingService->putAdminGroup($group, $validated['settings']),
            'Settings updated successfully.'
        );
    }
}
