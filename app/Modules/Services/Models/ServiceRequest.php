<?php

namespace App\Modules\Services\Models;

use App\Modules\Users\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class ServiceRequest extends Model
{
    public const STATUS_SUBMITTED = 'submitted';
    public const STATUS_REVIEWING = 'reviewing';
    public const STATUS_QUOTED = 'quoted';
    public const STATUS_CUSTOMER_ACCEPTED = 'customer_accepted';
    public const STATUS_IN_PROGRESS = 'in_progress';
    public const STATUS_WAITING_CUSTOMER = 'waiting_customer';
    public const STATUS_COMPLETED = 'completed';
    public const STATUS_CANCELLED = 'cancelled';
    public const STATUS_REJECTED = 'rejected';

    protected $fillable = [
        'request_number',
        'user_id',
        'service_catalog_id',
        'title',
        'requirements',
        'status',
        'assigned_staff_id',
        'custom_attributes',
        'attachments',
    ];

    protected function casts(): array
    {
        return [
            'custom_attributes' => 'array',
            'attachments' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function catalog(): BelongsTo
    {
        return $this->belongsTo(ServiceCatalog::class, 'service_catalog_id');
    }

    public function assignedStaff(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_staff_id');
    }

    public function quotes(): HasMany
    {
        return $this->hasMany(ServiceQuote::class);
    }

    public function activeQuote(): HasOne
    {
        return $this->hasOne(ServiceQuote::class)->latestOfMany();
    }

    public function timelines(): HasMany
    {
        return $this->hasMany(ServiceTimeline::class)->orderBy('due_date', 'asc');
    }
}
