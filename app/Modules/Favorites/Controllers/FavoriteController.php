<?php

namespace App\Modules\Favorites\Controllers;

use App\Modules\Favorites\Models\UserFavorite;
use App\Modules\Products\Models\Product;
use App\Modules\Shared\Exceptions\EntityNotFoundException;
use App\Modules\Shared\Helpers\ApiResponseHelper;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class FavoriteController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $favorites = UserFavorite::query()
            ->where('user_id', $request->user()->id)
            ->with('product.variants.inventory')
            ->latest()
            ->get();

        return ApiResponseHelper::success($favorites, 'Favorites retrieved successfully.');
    }

    public function store(Request $request, int $product): JsonResponse
    {
        Product::query()->whereKey($product)->where('is_active', true)->firstOr(function () {
            throw new EntityNotFoundException('Product not found.');
        });

        $favorite = UserFavorite::firstOrCreate([
            'user_id' => $request->user()->id,
            'product_id' => $product,
        ]);

        return ApiResponseHelper::created($favorite->load('product.variants.inventory'), 'Product added to favorites.');
    }

    public function destroy(Request $request, int $product): JsonResponse
    {
        UserFavorite::query()
            ->where('user_id', $request->user()->id)
            ->where('product_id', $product)
            ->delete();

        return ApiResponseHelper::success(null, 'Product removed from favorites.');
    }
}
