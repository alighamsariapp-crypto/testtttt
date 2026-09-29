<?php

namespace App\Modules\Auth\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ChangePasswordRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'current_password' => [
                'nullable',
                'string',
                Rule::requiredIf(fn (): bool => (bool) $this->user()?->hasPassword()),
            ],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ];
    }
}
