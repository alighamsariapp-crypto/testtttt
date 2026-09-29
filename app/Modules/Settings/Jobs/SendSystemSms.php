<?php

namespace App\Modules\Settings\Jobs;

use App\Modules\Settings\Models\SmsDelivery;
use App\Modules\Settings\Services\KavenegarSmsService;
use App\Modules\Settings\Services\SmsConfigurationService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Throwable;

class SendSystemSms implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public array $backoff = [60, 300];

    /** @param array<string, string|int|float> $variables */
    public function __construct(
        public readonly string $event,
        public readonly string $eventKey,
        public readonly string $recipient,
        public readonly array $variables,
    ) {
    }

    public function handle(SmsConfigurationService $configuration, KavenegarSmsService $kavenegar): void
    {
        $delivery = SmsDelivery::firstOrCreate(
            ['event_key' => $this->eventKey],
            [
                'event' => $this->event,
                'recipient' => $this->recipient,
                'payload' => $this->variables,
                'status' => SmsDelivery::STATUS_QUEUED,
            ]
        );

        if ($delivery->status === SmsDelivery::STATUS_SENT) {
            return;
        }

        if (! $configuration->canSend($this->event)) {
            $delivery->forceFill([
                'status' => SmsDelivery::STATUS_SKIPPED,
                'failure_code' => 'SMS_EVENT_DISABLED',
            ])->save();

            return;
        }

        try {
            $result = $kavenegar->sendSystemEvent($this->event, $this->recipient, $this->variables);
            $delivery->forceFill([
                'provider_message_id' => $result['message_id'],
                'provider_status' => $result['status'],
                'status' => SmsDelivery::STATUS_SENT,
                'failure_code' => null,
                'sent_at' => now(),
            ])->save();
        } catch (Throwable $exception) {
            $delivery->forceFill([
                'status' => SmsDelivery::STATUS_FAILED,
                'failure_code' => 'KAVENEGAR_SEND_FAILED',
            ])->save();

            throw $exception;
        }
    }
}
