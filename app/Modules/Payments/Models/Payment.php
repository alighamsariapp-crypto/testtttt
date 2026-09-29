<?php

namespace App\Modules\Payments\Models;

use App\Modules\Orders\Models\Order;
use App\Modules\Shared\ValueObjects\Money;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Payment extends Model
{
    public const STATUS_PENDING = 'pending';
    public const STATUS_AUTHORIZED = 'authorized';
    public const STATUS_PAID = 'paid';
    public const STATUS_FAILED = 'failed';
    public const STATUS_CANCELLED = 'cancelled';
    public const STATUS_REFUNDED = 'refunded';

    protected $fillable = [
        'order_id',
        'gateway',
        'amount',
        'currency',
        'status',
        'reference_id',
        'gateway_payment_id',
        'gateway_response',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'integer',
            'gateway_response' => 'array',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(PaymentTransaction::class);
    }

    public function getAmountMoneyAttribute(): Money
    {
        return Money::from($this->amount, $this->currency ?? 'IRR');
    }
}
