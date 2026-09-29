<?php

namespace App\Modules\Settings\Services;

use App\Modules\Settings\Jobs\SendSystemSms;
use App\Modules\Settings\Models\SmsDelivery;

class SystemSmsNotifier
{
    public function __construct(private readonly SmsConfigurationService $configuration)
    {
    }

    /** @param array<string, string|int|float> $variables */
    public function queue(string $event, string $eventKey, ?string $phone, array $variables): void
    {
        $recipient = $this->normalizeIranianMobile($phone);
        if ($recipient === null || ! $this->configuration->canSend($event)) {
            return;
        }

        // Atomically register the delivery record using unique event_key
        try {
            $delivery = SmsDelivery::firstOrCreate(
                ['event_key' => $eventKey],
                [
                    'event' => $event,
                    'recipient' => $recipient,
                    'payload' => $variables,
                    'status' => SmsDelivery::STATUS_QUEUED,
                ]
            );
        } catch (\Illuminate\Database\QueryException $e) {
            $delivery = SmsDelivery::where('event_key', $eventKey)->first();
            if (! $delivery) {
                throw $e;
            }
        }

        // Enforce idempotency: Only dispatch queue job if the delivery record was just newly created
        if ($delivery->wasRecentlyCreated) {
            SendSystemSms::dispatch($event, $eventKey, $recipient, $variables)->afterCommit();
        }
    }

    private function normalizeIranianMobile(?string $phone): ?string
    {
        $phone = strtr(trim((string) $phone), [
            '۰' => '0', '۱' => '1', '۲' => '2', '۳' => '3', '۴' => '4',
            '۵' => '5', '۶' => '6', '۷' => '7', '۸' => '8', '۹' => '9',
            '٠' => '0', '١' => '1', '٢' => '2', '٣' => '3', '٤' => '4',
            '٥' => '5', '٦' => '6', '٧' => '7', '٨' => '8', '٩' => '9',
        ]);
        $digits = preg_replace('/[^0-9+]/', '', $phone) ?? '';

        if (str_starts_with($digits, '+98')) {
            $digits = '0'.substr($digits, 3);
        } elseif (str_starts_with($digits, '0098')) {
            $digits = '0'.substr($digits, 4);
        } elseif (str_starts_with($digits, '98')) {
            $digits = '0'.substr($digits, 2);
        }

        return preg_match('/^09\d{9}$/', $digits) ? $digits : null;
    }
}
