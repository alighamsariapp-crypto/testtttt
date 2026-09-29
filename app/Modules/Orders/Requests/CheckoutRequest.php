<?php

namespace App\Modules\Orders\Requests;

use App\Modules\Settings\Services\CheckoutConfigurationService;
use Illuminate\Foundation\Http\FormRequest;

class CheckoutRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        $this->merge([
            'idempotency_key' => trim((string) ($this->header('X-Idempotency-Key') ?: $this->input('idempotency_key', ''))),
        ]);
    }

    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        $validGateways = app(CheckoutConfigurationService::class)->availableGatewayIds();
        $inList = !empty($validGateways) ? implode(',', $validGateways) : '__none__';

        return [
            'shipping_address' => ['required', 'array'],
            'shipping_address.recipient_name' => ['required', 'string', 'max:255'],
            'shipping_address.phone' => ['required', 'string', 'max:32'],
            'shipping_address.province' => ['required', 'string', 'max:100'],
            'shipping_address.city' => ['required', 'string', 'max:100'],
            'shipping_address.postal_code' => ['required', 'string', 'max:32'],
            'shipping_address.address_line' => ['required', 'string', 'max:1000'],
            'billing_address' => ['nullable', 'array'],
            'payment_gateway' => ['required', 'string', "in:{$inList}"],
            'shipping_method' => ['nullable', 'string', 'max:64', 'regex:/^[a-z0-9_-]+$/'],
            'idempotency_key' => ['required', 'string', 'regex:/^[A-Za-z0-9][A-Za-z0-9_:-]{15,127}$/'],
            'notes' => ['nullable', 'string', 'max:500'],
        ];
    }
}
