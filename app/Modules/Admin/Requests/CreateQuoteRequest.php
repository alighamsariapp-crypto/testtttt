<?php

namespace App\Modules\Admin\Requests;

use Illuminate\Foundation\Http\FormRequest;

class CreateQuoteRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isAdmin() || $this->user()?->isStaff();
    }

    public function rules(): array
    {
        return [
            'amount' => ['required', 'integer', 'min:1'],
            'currency' => ['sometimes', 'string', 'max:10'],
            'scope_of_work' => ['required', 'string', 'max:5000'],
            'terms' => ['nullable', 'string', 'max:2000'],
            'valid_until' => ['nullable', 'date', 'after:now', 'before_or_equal:2038-01-19 03:14:07'],
        ];
    }
}
