<?php

namespace App\Modules\Wallet\Requests;

use Illuminate\Foundation\Http\FormRequest;

class CreateWalletDepositRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'amount' => ['required', 'integer', 'min:10000', 'max:1000000000'],
            'description' => ['nullable', 'string', 'max:500'],
        ];
    }
}
