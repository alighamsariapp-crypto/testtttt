<?php

namespace App\Modules\Products\Controllers;

use App\Modules\Products\Models\ProductAttributeDefinition;
use App\Modules\Products\Requests\CategoryProductAttributeRequest;
use App\Modules\Products\Requests\ProductAttributeDefinitionRequest;
use App\Modules\Products\Services\ProductAttributeDefinitionService;
use App\Modules\Shared\Helpers\ApiResponseHelper;
use Illuminate\Http\JsonResponse;

class ProductAttributeDefinitionController
{
    public function __construct(private readonly ProductAttributeDefinitionService $attributeDefinitions)
    {
    }

    public function index(): JsonResponse
    {
        return ApiResponseHelper::success(
            ProductAttributeDefinition::query()->with('categories:id,name,slug')->orderBy('sort_order')->get(),
            'Product attribute definitions retrieved successfully.'
        );
    }

    public function store(ProductAttributeDefinitionRequest $request): JsonResponse
    {
        $definition = ProductAttributeDefinition::create($request->validated());
        return ApiResponseHelper::created($definition, 'Product attribute definition created successfully.');
    }

    public function update(ProductAttributeDefinitionRequest $request, int $productAttribute): JsonResponse
    {
        $definition = ProductAttributeDefinition::query()->findOrFail($productAttribute);
        $definition->update($request->validated());
        return ApiResponseHelper::success($definition->fresh(), 'Product attribute definition updated successfully.');
    }

    public function destroy(int $productAttribute): JsonResponse
    {
        ProductAttributeDefinition::query()->findOrFail($productAttribute)->delete();
        return ApiResponseHelper::success(null, 'Product attribute definition deleted successfully.');
    }

    public function syncCategory(CategoryProductAttributeRequest $request, int $category): JsonResponse
    {
        $this->attributeDefinitions->syncCategoryDefinitions($category, $request->validated('definitions'));
        return ApiResponseHelper::success(
            $this->attributeDefinitions->forCategory($category)->values(),
            'Category product attributes synchronized successfully.'
        );
    }
}
