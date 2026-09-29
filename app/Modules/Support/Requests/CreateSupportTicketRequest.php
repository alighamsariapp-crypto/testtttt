<?php

namespace App\Modules\Support\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CreateSupportTicketRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:255'],
            'department' => ['required', 'string', Rule::in([
                'فروش و تمدید',
                'پشتیبانی فنی',
                'مالی و فاکتور',
                'عمومی و پیشنهادات',
            ])],
            'priority' => ['required', 'string', Rule::in(['low', 'medium', 'high', 'urgent'])],
            'message' => ['required', 'string', 'max:10000'],
        ];
    }
}
