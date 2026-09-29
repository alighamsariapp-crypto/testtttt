<?php

namespace App\Modules\Products\Requests;

use Illuminate\Foundation\Http\FormRequest;

class CategoryProductAttributeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isAdmin() || $this->user()?->isStaff();
    }

    public function rules(): array
    {
        return [
            'definitions' => ['required', 'array', 'max:50'],
            'definitions.*.id' => ['required', 'integer', 'exists:product_attribute_definitions,id'],
            'definitions.*.is_filterable' => ['sometimes', 'boolean'],
            'definitions.*.is_required' => ['sometimes', 'boolean'],
            'definitions.*.inherit_to_children' => ['sometimes', 'boolean'],
            'definitions.*.sort_order' => ['sometimes', 'integer', 'min:0', 'max:10000'],
        ];
    }
}
