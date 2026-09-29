<?php

namespace App\Modules\Support\Requests;

use Illuminate\Foundation\Http\FormRequest;

class SupportTicketMessageRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'message' => ['required', 'string', 'max:10000'],
            'attachments' => ['nullable', 'array', 'max:5'],
            'attachments.*' => ['string', 'max:2048'],
        ];
    }
}
