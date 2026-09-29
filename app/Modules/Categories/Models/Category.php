<?php

namespace App\Modules\Categories\Models;

use App\Modules\Products\Models\Product;
use App\Modules\Products\Models\ProductAttributeDefinition;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Category extends Model
{
    protected $fillable = [
        'parent_id',
        'name',
        'slug',
        'description',
        'image_url',
        'is_active',
        'sort_order',
        'meta_title',
        'meta_description',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(Category::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(Category::class, 'parent_id')->orderBy('sort_order', 'asc');
    }

    public function products(): HasMany
    {
        return $this->hasMany(Product::class);
    }

    public function productAttributeDefinitions(): BelongsToMany
    {
        return $this->belongsToMany(ProductAttributeDefinition::class, 'category_product_attribute')
            ->withPivot(['is_filterable', 'is_required', 'inherit_to_children', 'sort_order'])
            ->withTimestamps();
    }
}
