<?php

namespace App\Modules\Auth\Requests;

use App\Modules\Auth\Services\PhoneOtpService;
use Illuminate\Foundation\Http\FormRequest;

class SendPhoneVerificationCodeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('phone') && is_string($this->input('phone'))) {
            try {
                $this->merge([
                    'phone' => app(PhoneOtpService::class)->normalizePhone($this->input('phone')),
                ]);
            } catch (\Throwable) {
                // If normalization fails, leave raw to trigger regex validation error
            }
        }
    }

    public function rules(): array
    {
        return [
            'phone' => ['required', 'string', 'regex:/^(?:\\+98|0098|98|0)?9\\d{9}$/'],
        ];
    }
}
