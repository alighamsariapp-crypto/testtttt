<?php

namespace App\Modules\Discounts\Controllers;

use App\Modules\Discounts\Models\DiscountCoupon;
use App\Modules\Discounts\Requests\DiscountCouponRequest;
use App\Modules\Shared\Helpers\ApiResponseHelper;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class DiscountCouponController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $coupons = DiscountCoupon::query()
            ->latest()
            ->paginate(min(max((int) $request->integer('per_page', 20), 1), 100));

        return ApiResponseHelper::success($coupons, 'Discount coupons retrieved successfully.');
    }

    public function store(DiscountCouponRequest $request): JsonResponse
    {
        $coupon = DiscountCoupon::create($request->validated());

        return ApiResponseHelper::created($coupon, 'Discount coupon created successfully.');
    }

    public function update(DiscountCouponRequest $request, int $coupon): JsonResponse
    {
        $model = DiscountCoupon::query()->findOrFail($coupon);
        $model->update($request->validated());

        return ApiResponseHelper::success($model->fresh(), 'Discount coupon updated successfully.');
    }

    public function destroy(int $coupon): JsonResponse
    {
        DiscountCoupon::query()->findOrFail($coupon)->delete();

        return ApiResponseHelper::success(null, 'Discount coupon deleted successfully.');
    }

    public function toggle(int $coupon): JsonResponse
    {
        $model = DiscountCoupon::query()->findOrFail($coupon);
        $model->update(['is_active' => !$model->is_active]);

        return ApiResponseHelper::success($model->fresh(), 'Discount coupon status updated successfully.');
    }

    public function validateCoupon(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => ['required', 'string', 'max:64'],
            'subtotal' => ['nullable', 'numeric', 'min:0'],
        ]);

        $code = trim(strtoupper($validated['code']));
        $subtotal = isset($validated['subtotal']) ? (float) $validated['subtotal'] : 0.0;

        $coupon = DiscountCoupon::query()
            ->where('code', $code)
            ->where('is_active', true)
            ->first();

        if (!$coupon) {
            return ApiResponseHelper::error('کد تخفیف نامعتبر است یا منقضی شده است.', 'INVALID_COUPON', 422);
        }

        if ($coupon->expires_at && now()->greaterThan($coupon->expires_at)) {
            return ApiResponseHelper::error('کد تخفیف منقضی شده است.', 'EXPIRED_COUPON', 422);
        }

        if ($coupon->min_order_amount && $subtotal < (float) $coupon->min_order_amount) {
            return ApiResponseHelper::error(
                sprintf('حداقل مبلغ سفارش برای استفاده از این کد تخفیف %s ریال است.', number_format((float) $coupon->min_order_amount)),
                'MIN_ORDER_AMOUNT_NOT_MET',
                422
            );
        }

        $discountAmount = 0.0;
        if ($coupon->type === 'percent') {
            $discountAmount = ($subtotal * (float) $coupon->value) / 100;
            if ($coupon->max_discount_amount && $discountAmount > (float) $coupon->max_discount_amount) {
                $discountAmount = (float) $coupon->max_discount_amount;
            }
        } else {
            $discountAmount = min((float) $coupon->value, $subtotal);
        }

        return ApiResponseHelper::success([
            'code' => $coupon->code,
            'type' => $coupon->type,
            'value' => (float) $coupon->value,
            'discount_amount' => (int) round($discountAmount),
            'description' => $coupon->description,
        ], 'کد تخفیف با موفقیت اعمال شد.');
    }
}
