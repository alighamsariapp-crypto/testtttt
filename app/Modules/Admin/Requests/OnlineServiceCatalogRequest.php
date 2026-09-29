<?php

namespace App\Modules\Admin\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class OnlineServiceCatalogRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $serviceId = $this->route('service');

        return [
            'name' => ['required', 'string', 'max:180'],
            'slug' => ['required', 'string', 'max:180', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/', Rule::unique('service_catalogs', 'slug')->ignore($serviceId)],
            'service_category_id' => ['required', 'integer', Rule::exists('service_categories', 'id')],
            'short_description' => ['required', 'string', 'max:1200'],
            'description' => ['nullable', 'string', 'max:30000'],
            'documents' => ['nullable', 'array', 'max:12'],
            'documents.*' => ['string', 'max:400'],
            'steps' => ['nullable', 'array', 'max:12'],
            'steps.*' => ['string', 'max:800'],
            'faq' => ['nullable', 'array', 'max:12'],
            'faq.*.question' => ['required_with:faq', 'string', 'max:400'],
            'faq.*.answer' => ['required_with:faq', 'string', 'max:2500'],
            'contact_type' => ['required', Rule::in(['telegram', 'whatsapp', 'phone', 'external'])],
            'contact_url' => ['required', 'string', 'max:2048'],
            'cta_label' => ['required', 'string', 'max:120'],
            'is_active' => ['required', 'boolean'],
        ];
    }

    public function after(): array
    {
        return [function ($validator) {
            $contactType = $this->input('contact_type');
            $contactUrl = (string) $this->input('contact_url');

            if ($contactType === 'phone') {
                if (! preg_match('/^tel:\+?[0-9]{7,20}$/', $contactUrl)) {
                    $validator->errors()->add('contact_url', 'شماره تماس باید با الگوی tel:+982100000000 وارد شود.');
                }

                return;
            }

            if (! filter_var($contactUrl, FILTER_VALIDATE_URL) || ! str_starts_with($contactUrl, 'https://')) {
                $validator->errors()->add('contact_url', 'مسیر ارتباط باید یک URL امن HTTPS باشد.');
            }
        }];
    }
}
