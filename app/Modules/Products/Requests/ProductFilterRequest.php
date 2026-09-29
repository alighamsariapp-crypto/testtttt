<?php

namespace App\Modules\Products\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ProductFilterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'category_id' => ['nullable', 'integer', 'exists:categories,id'],
            'category_slug' => ['nullable', 'string', 'max:255'],
            'brand' => ['nullable', 'string', 'max:120'],
            'facets' => ['nullable', 'array', 'max:30'],
            'facets.*' => ['nullable', 'array', 'max:20'],
            'facets.*.*' => ['string', 'max:120'],
            'search' => ['nullable', 'string', 'max:100'],
            'featured' => ['nullable', 'boolean'],
            'in_stock' => ['nullable', 'boolean'],
            'min_price' => ['nullable', 'integer', 'min:0'],
            'max_price' => ['nullable', 'integer', 'min:0'],
            'sort' => ['nullable', 'string', 'in:newest,price_asc,price_desc,name_asc'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ];
    }
}
