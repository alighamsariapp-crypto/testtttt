<?php

namespace App\Modules\Auth\Requests;

use Illuminate\Foundation\Http\FormRequest;

class GoogleOAuthExchangeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'handoff_code' => ['required', 'string', 'regex:/^[A-Za-z0-9_-]{40,128}$/'],
        ];
    }
}
