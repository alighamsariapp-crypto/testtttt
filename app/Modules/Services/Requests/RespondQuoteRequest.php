<?php

namespace App\Modules\Services\Requests;

use Illuminate\Foundation\Http\FormRequest;

class RespondQuoteRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'action' => ['required', 'string', 'in:accept,reject'],
        ];
    }
}
