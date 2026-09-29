<?php

namespace App\Modules\Users\Requests;

use Illuminate\Foundation\Http\FormRequest;

class AddressRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'type' => ['sometimes', 'string', 'in:shipping,billing'],
            'title' => ['sometimes', 'string', 'max:64'],
            'recipient_name' => ['required', 'string', 'max:255'],
            'phone' => ['required', 'string', 'max:32'],
            'province' => ['required', 'string', 'max:100'],
            'city' => ['required', 'string', 'max:100'],
            'postal_code' => ['required', 'string', 'max:32'],
            'address_line' => ['required', 'string', 'max:1000'],
            'is_default' => ['sometimes', 'boolean'],
        ];
    }
}
