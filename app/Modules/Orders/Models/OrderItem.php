<?php

namespace App\Modules\Orders\Models;

use App\Modules\Products\Models\ProductVariant;
use App\Modules\Shared\ValueObjects\Money;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderItem extends Model
{
    protected $fillable = [
        'order_id',
        'product_variant_id',
        'product_name_snapshot',
        'variant_sku_snapshot',
        'variant_attributes_snapshot',
        'unit_price',
        'quantity',
        'discount_amount',
        'tax_amount',
        'total_price',
    ];

    protected function casts(): array
    {
        return [
            'unit_price' => 'integer',
            'quantity' => 'integer',
            'discount_amount' => 'integer',
            'tax_amount' => 'integer',
            'total_price' => 'integer',
            'variant_attributes_snapshot' => 'array',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function variant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class, 'product_variant_id');
    }

    public function getUnitPriceMoneyAttribute(): Money
    {
        return Money::from($this->unit_price, $this->order->currency ?? 'IRR');
    }
}
