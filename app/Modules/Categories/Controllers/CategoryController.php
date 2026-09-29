<?php

namespace App\Modules\Categories\Controllers;

use App\Modules\Categories\Requests\CategoryRequest;
use App\Modules\Categories\Services\CategoryService;
use App\Modules\Shared\Helpers\ApiResponseHelper;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class CategoryController extends Controller
{
    public function __construct(private readonly CategoryService $categoryService)
    {
    }

    public function index(): JsonResponse
    {
        $categories = $this->categoryService->getCategoryTree();
        return ApiResponseHelper::success($categories, 'Category tree retrieved successfully.');
    }

    public function adminIndex(): JsonResponse
    {
        return ApiResponseHelper::success(
            $this->categoryService->getAllForAdmin(),
            'Admin category list retrieved successfully.'
        );
    }

    public function show(string $slugOrId): JsonResponse
    {
        $category = is_numeric($slugOrId)
            ? $this->categoryService->updateCategory((int) $slugOrId, []) // fallback or find
            : $this->categoryService->findBySlug($slugOrId);

        return ApiResponseHelper::success($category, 'Category details retrieved.');
    }

    public function store(CategoryRequest $request): JsonResponse
    {
        $category = $this->categoryService->createCategory($request->validated());
        return ApiResponseHelper::created($category, 'Category created successfully.');
    }

    public function update(CategoryRequest $request, int $id): JsonResponse
    {
        $category = $this->categoryService->updateCategory($id, $request->validated());
        return ApiResponseHelper::success($category, 'Category updated successfully.');
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        if (!$request->user()?->isAdmin()) {
            return ApiResponseHelper::error('Unauthorized.', 'FORBIDDEN', 403);
        }

        $this->categoryService->deleteCategory($id);
        return ApiResponseHelper::success(null, 'Category deleted successfully.');
    }
}
