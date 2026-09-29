<?php

namespace App\Modules\Services\Models;

use App\Modules\Shared\ValueObjects\Money;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ServiceCatalog extends Model
{
    protected $fillable = [
        'name',
        'slug',
        'category',
        'service_category_id',
        'short_description',
        'description',
        'documents',
        'steps',
        'faq',
        'estimated_base_price',
        'currency',
        'is_active',
        'required_fields',
        'contact_type',
        'contact_url',
        'cta_label',
        'meta_title',
        'meta_description',
    ];

    protected function casts(): array
    {
        return [
            'estimated_base_price' => 'integer',
            'is_active' => 'boolean',
            'required_fields' => 'array',
            'documents' => 'array',
            'steps' => 'array',
            'faq' => 'array',
        ];
    }

    public function requests(): HasMany
    {
        return $this->hasMany(ServiceRequest::class);
    }

    public function serviceCategory(): BelongsTo
    {
        return $this->belongsTo(ServiceCategory::class, 'service_category_id');
    }

    public function getEstimatedBasePriceMoneyAttribute(): ?Money
    {
        return $this->estimated_base_price ? Money::from($this->estimated_base_price, $this->currency ?? 'IRR') : null;
    }
}
