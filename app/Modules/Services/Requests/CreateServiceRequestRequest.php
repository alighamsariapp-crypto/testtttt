<?php

namespace App\Modules\Services\Requests;

use Illuminate\Foundation\Http\FormRequest;

class CreateServiceRequestRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'service_catalog_id' => ['nullable', 'exists:service_catalogs,id'],
            'title' => ['required', 'string', 'max:255'],
            'requirements' => ['required', 'string', 'max:5000'],
            'custom_attributes' => ['nullable', 'array'],
            'attachments' => ['nullable', 'array'],
            'attachments.*' => ['string', 'url'],
        ];
    }
}
