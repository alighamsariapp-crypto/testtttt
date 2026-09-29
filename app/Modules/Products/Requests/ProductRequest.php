<?php

namespace App\Modules\Products\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ProductRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isAdmin() || $this->user()?->isStaff();
    }

    public function rules(): array
    {
        $productId = $this->route('id') ?? $this->route('product');
        $required = $this->isMethod('post') ? 'required' : 'sometimes';

        return [
            'category_id' => [$required, 'exists:categories,id'],
            'name' => [$required, 'string', 'max:255'],
            'slug' => ['nullable', 'string', 'max:255', 'unique:products,slug,'.($productId ? (int) $productId : 'NULL')],
            'sku' => [$required, 'string', 'max:64', 'unique:products,sku,'.($productId ? (int) $productId : 'NULL')],
            'description' => ['nullable', 'string'],
            'base_price' => [$required, 'integer', 'min:0'],
            'compare_price' => ['nullable', 'integer', 'min:0'],
            // All newly written catalog prices are stored as integer Iranian rials.
            // Legacy records remain readable, while new arbitrary currency strings
            // cannot create a cart/checkout currency mismatch.
            'currency' => ['sometimes', 'in:IRR'],
            'is_active' => ['sometimes', 'boolean'],
            'is_featured' => ['sometimes', 'boolean'],
            'images' => ['nullable', 'array'],
            'images.*' => ['string', 'url'],
            'attributes' => ['nullable', 'array'],
            'meta_title' => ['nullable', 'string', 'max:255'],
            'meta_description' => ['nullable', 'string', 'max:500'],
            'initial_stock' => ['sometimes', 'integer', 'min:0'],
            'variants' => ['nullable', 'array'],
            'variants.*.id' => ['nullable', 'integer'],
            'variants.*.name' => ['required_with:variants', 'string', 'max:255'],
            'variants.*.sku' => ['required_with:variants', 'string', 'max:64'],
            'variants.*.price_override' => ['nullable', 'integer', 'min:0'],
            'variants.*.stock' => ['nullable', 'integer', 'min:0'],
            'variants.*.is_active' => ['nullable', 'boolean'],
            'variants.*.attributes' => ['nullable', 'array'],
        ];
    }
}
