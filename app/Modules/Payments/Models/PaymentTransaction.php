<?php

namespace App\Modules\Payments\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PaymentTransaction extends Model
{
    protected $fillable = [
        'payment_id',
        'idempotency_key',
        'event_type',
        'payload',
        'is_reconciled',
    ];

    protected function casts(): array
    {
        return [
            'payload' => 'array',
            'is_reconciled' => 'boolean',
        ];
    }

    public function payment(): BelongsTo
    {
        return $this->belongsTo(Payment::class);
    }
}
