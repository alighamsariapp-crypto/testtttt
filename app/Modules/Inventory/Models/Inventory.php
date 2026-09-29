<?php

namespace App\Modules\Inventory\Models;

use App\Modules\Products\Models\ProductVariant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Inventory extends Model
{
    protected $table = 'inventory';

    protected $fillable = [
        'product_variant_id',
        'quantity',
        'reserved_quantity',
        'safety_threshold',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'integer',
            'reserved_quantity' => 'integer',
            'safety_threshold' => 'integer',
        ];
    }

    public function variant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class, 'product_variant_id');
    }

    public function availableQuantity(): int
    {
        return max(0, (int) $this->quantity - (int) $this->reserved_quantity);
    }

    public function getAvailableQuantityAttribute(): int
    {
        return $this->availableQuantity();
    }
}
