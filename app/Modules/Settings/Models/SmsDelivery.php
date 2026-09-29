<?php

namespace App\Modules\Settings\Models;

use Illuminate\Database\Eloquent\Model;

class SmsDelivery extends Model
{
    public const STATUS_QUEUED = 'queued';
    public const STATUS_SENT = 'sent';
    public const STATUS_FAILED = 'failed';
    public const STATUS_SKIPPED = 'skipped';

    protected $fillable = [
        'event_key',
        'event',
        'recipient',
        'payload',
        'provider_message_id',
        'provider_status',
        'status',
        'failure_code',
        'sent_at',
    ];

    protected function casts(): array
    {
        return [
            'payload' => 'array',
            'sent_at' => 'datetime',
        ];
    }
}
