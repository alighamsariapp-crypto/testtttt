<?php

namespace App\Modules\Settings\Services;

use App\Modules\Shared\Exceptions\DomainException;
use Illuminate\Support\Facades\Http;

class KavenegarSmsService
{
    private const BASE_URL = 'https://api.kavenegar.com/v1';

    public function __construct(private readonly SmsConfigurationService $configuration)
    {
    }

    /** @return array{remaining_credit: int, expires_at: int|string|null, account_type: string|null} */
    public function accountInfo(): array
    {
        $credentials = $this->configuration->kavenegarCredentials(false);
        $body = $this->request($credentials['api_key'], 'account/info.json');
        $entry = is_array($body['entries'] ?? null) ? $body['entries'] : [];

        return [
            'remaining_credit' => max(0, (int) ($entry['remaincredit'] ?? 0)),
            'expires_at' => $entry['expiredate'] ?? null,
            'account_type' => isset($entry['type']) ? (string) $entry['type'] : null,
        ];
    }

    /** @return array{message_id: string|null, status: int|null, status_text: string|null} */
    public function sendOtp(string $phone, string $code): array
    {
        $credentials = $this->configuration->kavenegarCredentials();
        $template = $credentials['otp_template'];

        if ($template !== '') {
            $body = $this->request($credentials['api_key'], 'verify/lookup.json', [
                'receptor' => $phone,
                'token' => $code,
                'template' => $template,
            ]);

            return $this->resultFrom($body);
        }

        return $this->sendText(
            $phone,
            $this->configuration->render(SmsConfigurationService::EVENT_OTP, ['code' => $code]),
            $credentials
        );
    }

    /** @return array{message_id: string|null, status: int|null, status_text: string|null} */
    public function sendPasswordResetOtp(string $phone, string $code): array
    {
        $credentials = $this->configuration->kavenegarCredentials();
        $template = $credentials['otp_template'];

        // The verified Lookup template is deliberately shared with sign-in. Its text must be
        // generic (for example, “کد امنیتی نوین‌نت: %token”) so it is truthful for both flows.
        if ($template !== '') {
            $body = $this->request($credentials['api_key'], 'verify/lookup.json', [
                'receptor' => $phone,
                'token' => $code,
                'template' => $template,
            ]);

            return $this->resultFrom($body);
        }

        return $this->sendText(
            $phone,
            $this->configuration->render(SmsConfigurationService::EVENT_PASSWORD_RESET, ['code' => $code]),
            $credentials
        );
    }

    /** @param array<string, string|int|float> $variables @return array{message_id: string|null, status: int|null, status_text: string|null} */
    public function sendSystemEvent(string $event, string $phone, array $variables): array
    {
        if (! $this->configuration->canSend($event)) {
            return ['message_id' => null, 'status' => null, 'status_text' => null];
        }

        $credentials = $this->configuration->kavenegarCredentials();
        $message = $this->configuration->render($event, $variables);
        if ($message === '') {
            throw new DomainException('SMS template text cannot be empty.', 'SMS_TEMPLATE_EMPTY', 422);
        }

        return $this->sendText($phone, $message, $credentials);
    }

    /** @param array{api_key: string, sender: string, otp_template: string} $credentials @return array{message_id: string|null, status: int|null, status_text: string|null} */
    private function sendText(string $phone, string $message, array $credentials): array
    {
        $payload = [
            'receptor' => $phone,
            'message' => $message,
        ];

        if ($credentials['sender'] !== '') {
            $payload['sender'] = $credentials['sender'];
        }

        $body = $this->request($credentials['api_key'], 'sms/send.json', $payload);

        return $this->resultFrom($body);
    }

    /** @param array<string, string> $payload @return array<string, mixed> */
    private function request(string $apiKey, string $path, array $payload = []): array
    {
        $url = self::BASE_URL.'/'.rawurlencode($apiKey).'/'.$path;
        $response = Http::acceptJson()->asForm()->timeout(15)->post($url, $payload);
        $body = $response->json();
        $providerStatus = is_array($body) ? (int) data_get($body, 'return.status', 0) : 0;

        if (! $response->successful() || $providerStatus !== 200) {
            throw new DomainException(
                'Kavenegar could not complete the SMS request. Check the sender line, account credit, and API key.',
                'KAVENEGAR_REQUEST_FAILED',
                502
            );
        }

        return is_array($body) ? $body : [];
    }

    /** @param array<string, mixed> $body @return array{message_id: string|null, status: int|null, status_text: string|null} */
    private function resultFrom(array $body): array
    {
        $entries = $body['entries'] ?? [];
        $entry = is_array($entries) && array_is_list($entries) ? ($entries[0] ?? []) : $entries;
        $entry = is_array($entry) ? $entry : [];

        return [
            'message_id' => isset($entry['messageid']) ? (string) $entry['messageid'] : null,
            'status' => isset($entry['status']) ? (int) $entry['status'] : null,
            'status_text' => isset($entry['statustext']) ? (string) $entry['statustext'] : null,
        ];
    }
}
