<?php

namespace App\Modules\Products\Models;

use App\Modules\Categories\Models\Category;
use App\Modules\Inventory\Models\Inventory;
use App\Modules\Shared\ValueObjects\Money;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOneThrough;

class Product extends Model
{
    protected $fillable = [
        'category_id',
        'name',
        'slug',
        'sku',
        'description',
        'base_price',
        'compare_price',
        'currency',
        'is_active',
        'is_featured',
        'images',
        'attributes',
        'meta_title',
        'meta_description',
    ];

    protected function casts(): array
    {
        return [
            'base_price' => 'integer',
            'compare_price' => 'integer',
            'is_active' => 'boolean',
            'is_featured' => 'boolean',
            'images' => 'array',
            'attributes' => 'array',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function variants(): HasMany
    {
        return $this->hasMany(ProductVariant::class);
    }

    public function getBasePriceMoneyAttribute(): Money
    {
        return Money::from($this->base_price, $this->currency ?? 'IRR');
    }
}
