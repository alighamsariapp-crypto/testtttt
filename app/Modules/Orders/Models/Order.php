<?php

namespace App\Modules\Orders\Models;

use App\Modules\Payments\Models\Payment;
use App\Modules\Shared\ValueObjects\Money;
use App\Modules\Users\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Order extends Model
{
    public const STATUS_PENDING = 'pending';
    public const STATUS_AWAITING_PAYMENT = 'awaiting_payment';
    public const STATUS_PAID = 'paid';
    public const STATUS_PROCESSING = 'processing';
    public const STATUS_SHIPPED = 'shipped';
    public const STATUS_COMPLETED = 'completed';
    public const STATUS_CANCELLED = 'cancelled';
    public const STATUS_REFUNDED = 'refunded';
    public const STATUS_FAILED = 'failed';

    protected $fillable = [
        'order_number',
        'user_id',
        'checkout_idempotency_key',
        'checkout_request_hash',
        'status',
        'payment_status',
        'tracking_code',
        'subtotal',
        'discount_total',
        'tax_total',
        'shipping_total',
        'grand_total',
        'currency',
        'shipping_address_snapshot',
        'billing_address_snapshot',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'subtotal' => 'integer',
            'discount_total' => 'integer',
            'tax_total' => 'integer',
            'shipping_total' => 'integer',
            'grand_total' => 'integer',
            'shipping_address_snapshot' => 'array',
            'billing_address_snapshot' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function getGrandTotalMoneyAttribute(): Money
    {
        return Money::from($this->grand_total, $this->currency ?? 'IRR');
    }
}
