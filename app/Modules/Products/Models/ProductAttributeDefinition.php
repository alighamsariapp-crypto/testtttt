<?php

namespace App\Modules\Products\Models;

use App\Modules\Categories\Models\Category;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class ProductAttributeDefinition extends Model
{
    public const TYPES = ['single_select', 'multi_select', 'number', 'boolean', 'color'];

    protected $fillable = [
        'key',
        'name',
        'data_type',
        'unit',
        'options',
        'is_filterable',
        'is_required',
        'is_active',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'options' => 'array',
            'is_filterable' => 'boolean',
            'is_required' => 'boolean',
            'is_active' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    public function categories(): BelongsToMany
    {
        return $this->belongsToMany(Category::class, 'category_product_attribute')
            ->withPivot(['is_filterable', 'is_required', 'inherit_to_children', 'sort_order'])
            ->withTimestamps();
    }
}
