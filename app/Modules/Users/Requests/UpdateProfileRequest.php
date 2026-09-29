<?php

namespace App\Modules\Users\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    protected function prepareForValidation(): void
    {
        if (!$this->has('phone')) {
            return;
        }

        $phone = strtr((string) $this->input('phone'), [
            '۰' => '0', '۱' => '1', '۲' => '2', '۳' => '3', '۴' => '4',
            '۵' => '5', '۶' => '6', '۷' => '7', '۸' => '8', '۹' => '9',
            '٠' => '0', '١' => '1', '٢' => '2', '٣' => '3', '٤' => '4',
            '٥' => '5', '٦' => '6', '٧' => '7', '٨' => '8', '٩' => '9',
        ]);
        $phone = preg_replace('/[^0-9+]/', '', trim($phone)) ?? '';

        if (str_starts_with($phone, '+98')) {
            $phone = '0'.substr($phone, 3);
        } elseif (str_starts_with($phone, '0098')) {
            $phone = '0'.substr($phone, 4);
        } elseif (str_starts_with($phone, '98')) {
            $phone = '0'.substr($phone, 2);
        } elseif (str_starts_with($phone, '9') && strlen($phone) === 10) {
            $phone = '0'.$phone;
        }

        $this->merge(['phone' => $phone === '' ? null : $phone]);
    }

    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:32', 'regex:/^(?:\\+98|0098|98|0)?9\\d{9}$/'],
            'email' => [
                'sometimes',
                'nullable',
                'string',
                'email:rfc',
                'max:255',
                Rule::unique('users', 'email')->ignore($this->user()?->id),
            ],
        ];
    }
}
