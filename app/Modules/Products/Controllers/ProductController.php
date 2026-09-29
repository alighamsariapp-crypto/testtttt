<?php

namespace App\Modules\Products\Controllers;

use App\Modules\Products\Requests\ProductFilterRequest;
use App\Modules\Products\Requests\ProductRequest;
use App\Modules\Products\Services\ProductService;
use App\Modules\Shared\Helpers\ApiResponseHelper;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class ProductController extends Controller
{
    public function __construct(private readonly ProductService $productService)
    {
    }

    public function index(ProductFilterRequest $request): JsonResponse
    {
        $products = $this->productService->paginateCatalog(
            $request->validated(),
            (int) $request->validated('per_page', 15)
        );

        return ApiResponseHelper::success($products, 'Products catalog retrieved.');
    }

    public function facets(ProductFilterRequest $request): JsonResponse
    {
        return ApiResponseHelper::success(
            $this->productService->catalogFacets($request->validated()),
            'Product catalog facets retrieved.'
        );
    }

    public function adminIndex(Request $request): JsonResponse
    {
        return ApiResponseHelper::success(
            $this->productService->paginateForAdmin((int) $request->integer('per_page', 50)),
            'Admin product list retrieved successfully.'
        );
    }

    public function show(string $slug): JsonResponse
    {
        $product = $this->productService->findBySlug($slug);
        return ApiResponseHelper::success($product, 'Product details retrieved.');
    }

    public function store(ProductRequest $request): JsonResponse
    {
        $product = $this->productService->createProduct($request->validated());
        return ApiResponseHelper::created($product, 'Product created successfully.');
    }

    public function update(ProductRequest $request, int $id): JsonResponse
    {
        $product = $this->productService->updateProduct($id, $request->validated());
        return ApiResponseHelper::success($product, 'Product updated successfully.');
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        if (!$request->user()?->isAdmin()) {
            return ApiResponseHelper::error('Unauthorized.', 'FORBIDDEN', 403);
        }

        $this->productService->deleteProduct($id);
        return ApiResponseHelper::success(null, 'Product deleted successfully.');
    }
}
