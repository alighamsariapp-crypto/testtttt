<?php

namespace App\Modules\Services\Models;

use App\Modules\Shared\ValueObjects\Money;
use App\Modules\Users\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ServiceQuote extends Model
{
    public const STATUS_PENDING = 'pending';
    public const STATUS_ACCEPTED = 'accepted';
    public const STATUS_REJECTED = 'rejected';
    public const STATUS_EXPIRED = 'expired';

    protected $fillable = [
        'service_request_id',
        'amount',
        'currency',
        'scope_of_work',
        'terms',
        'valid_until',
        'status',
        'responded_at',
        'created_by_staff_id',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'integer',
            'valid_until' => 'datetime',
            'responded_at' => 'datetime',
        ];
    }

    public function serviceRequest(): BelongsTo
    {
        return $this->belongsTo(ServiceRequest::class);
    }

    public function createdByStaff(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_staff_id');
    }

    public function getAmountMoneyAttribute(): Money
    {
        return Money::from($this->amount, $this->currency ?? 'IRR');
    }
}
