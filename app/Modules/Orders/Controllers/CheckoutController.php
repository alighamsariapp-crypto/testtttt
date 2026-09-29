<?php

namespace App\Modules\Orders\Controllers;

use App\Modules\Cart\Services\CartService;
use App\Modules\Orders\Requests\CheckoutRequest;
use App\Modules\Orders\Services\CheckoutService;
use App\Modules\Shared\Helpers\ApiResponseHelper;
use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller;

class CheckoutController extends Controller
{
    public function __construct(
        private readonly CheckoutService $checkoutService,
        private readonly CartService $cartService
    ) {
    }

    public function checkout(CheckoutRequest $request): JsonResponse
    {
        $user = $request->user();
        $cart = $this->cartService->getOrCreateCart($user);

        $data = $request->validated();
        $data['idempotency_key'] = (string) $request->header('X-Idempotency-Key', $data['idempotency_key']);
        $result = $this->checkoutService->processCheckout($user, $cart, $data);

        return ApiResponseHelper::created([
            'order_id' => $result['order']->id,
            'order_number' => $result['order']->order_number,
            'grand_total' => $result['order']->grand_total,
            'currency' => $result['order']->currency,
            'status' => $result['order']->status,
            'payment_status' => $result['order']->payment_status,
            'items' => $result['order']->items,
            'payment_intent' => $result['payment_intent'],
        ], 'Order successfully placed.');
    }
}
