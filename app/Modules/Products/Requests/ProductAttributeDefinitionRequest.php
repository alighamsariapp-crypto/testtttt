<?php

namespace App\Modules\Products\Requests;

use App\Modules\Products\Models\ProductAttributeDefinition;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ProductAttributeDefinitionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isAdmin() || $this->user()?->isStaff();
    }

    public function rules(): array
    {
        $definitionId = $this->route('productAttribute') ?? $this->route('id');

        return [
            'key' => ['required', 'alpha_dash', 'max:80', Rule::unique('product_attribute_definitions', 'key')->ignore($definitionId)],
            'name' => ['required', 'string', 'max:120'],
            'data_type' => ['required', 'string', Rule::in(ProductAttributeDefinition::TYPES)],
            'unit' => ['nullable', 'string', 'max:32'],
            'options' => ['nullable', 'array', 'max:100'],
            'options.*' => ['string', 'max:120'],
            'is_filterable' => ['sometimes', 'boolean'],
            'is_required' => ['sometimes', 'boolean'],
            'is_active' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'min:0', 'max:10000'],
        ];
    }
}
