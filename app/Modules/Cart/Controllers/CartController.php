<?php

namespace App\Modules\Cart\Controllers;

use App\Modules\Cart\Requests\AddToCartRequest;
use App\Modules\Cart\Requests\UpdateCartItemRequest;
use App\Modules\Cart\Services\CartService;
use App\Modules\Shared\Helpers\ApiResponseHelper;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class CartController extends Controller
{
    public function __construct(private readonly CartService $cartService)
    {
    }

    private function getCart(Request $request)
    {
        $sessionId = $request->header('X-Session-ID') ?? $request->cookie('cart_session_id') ?? $request->ip();
        // Cart routes support guests, but must still recognize a supplied Sanctum token.
        // Otherwise a logged-in customer receives a guest cart and checkout sees an empty user cart.
        $user = $request->user('sanctum') ?? $request->user();

        return $this->cartService->getOrCreateCart($user, $sessionId);
    }

    public function show(Request $request): JsonResponse
    {
        $cart = $this->getCart($request);
        $summary = $this->cartService->getCartSummary($cart);
        return ApiResponseHelper::success($summary, 'Cart retrieved successfully.');
    }

    public function addItem(AddToCartRequest $request): JsonResponse
    {
        $cart = $this->getCart($request);
        $summary = $this->cartService->addItem(
            $cart,
            (int) $request->validated('product_variant_id'),
            (int) $request->validated('quantity')
        );

        return ApiResponseHelper::success($summary, 'Item added to cart.');
    }

    public function updateItem(UpdateCartItemRequest $request, int $itemId): JsonResponse
    {
        $cart = $this->getCart($request);
        $summary = $this->cartService->updateItem(
            $cart,
            $itemId,
            (int) $request->validated('quantity')
        );

        return ApiResponseHelper::success($summary, 'Cart item updated.');
    }

    public function removeItem(Request $request, int $itemId): JsonResponse
    {
        $cart = $this->getCart($request);
        $summary = $this->cartService->removeItem($cart, $itemId);
        return ApiResponseHelper::success($summary, 'Item removed from cart.');
    }

    public function clear(Request $request): JsonResponse
    {
        $cart = $this->getCart($request);
        $this->cartService->clearCart($cart);
        return ApiResponseHelper::success(null, 'Cart cleared successfully.');
    }
}
