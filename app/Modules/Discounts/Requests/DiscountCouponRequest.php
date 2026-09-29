<?php

namespace App\Modules\Discounts\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class DiscountCouponRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $couponId = $this->route('coupon');

        return [
            'code' => ['required', 'string', 'max:64', Rule::unique('discount_coupons', 'code')->ignore($couponId)],
            'title' => ['required', 'string', 'max:255'],
            'discount_type' => ['required', 'string', Rule::in(['fixed', 'percentage'])],
            'discount_value' => ['required', 'integer', 'min:1'],
            'min_order_amount' => ['required', 'integer', 'min:0'],
            'max_discount_amount' => ['nullable', 'integer', 'min:1'],
            'usage_limit' => ['required', 'integer', 'min:0'],
            'starts_at' => ['nullable', 'date'],
            'expires_at' => ['nullable', 'date', 'after:starts_at'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}
