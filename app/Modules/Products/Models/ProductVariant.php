<?php

namespace App\Modules\Products\Models;

use App\Modules\Inventory\Models\Inventory;
use App\Modules\Shared\ValueObjects\Money;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class ProductVariant extends Model
{
    protected $fillable = [
        'product_id',
        'name',
        'sku',
        'price_override',
        'attributes',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'price_override' => 'integer',
            'attributes' => 'array',
            'is_active' => 'boolean',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function inventory(): HasOne
    {
        return $this->hasOne(Inventory::class, 'product_variant_id');
    }

    public function getEffectivePriceAttribute(): int
    {
        return $this->price_override ?? $this->product->base_price;
    }

    public function getEffectivePriceMoneyAttribute(): Money
    {
        return Money::from($this->effective_price, $this->product->currency ?? 'IRR');
    }
}
