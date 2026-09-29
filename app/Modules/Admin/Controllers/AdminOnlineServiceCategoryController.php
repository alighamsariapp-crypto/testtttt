<?php

namespace App\Modules\Admin\Controllers;

use App\Modules\Admin\Requests\OnlineServiceCategoryRequest;
use App\Modules\Admin\Services\AuditLogService;
use App\Modules\Services\Models\ServiceCategory;
use App\Modules\Services\Services\ServiceManagementService;
use App\Modules\Shared\Helpers\ApiResponseHelper;
use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AdminOnlineServiceCategoryController extends Controller
{
    public function __construct(
        private readonly AuditLogService $auditLogService,
        private readonly ServiceManagementService $serviceManager,
    ) {
    }

    public function index(): JsonResponse
    {
        return ApiResponseHelper::success(
            ServiceCategory::query()->withCount('services')->orderBy('sort_order')->orderBy('name')->get(),
            'Admin online service categories.'
        );
    }

    public function store(OnlineServiceCategoryRequest $request): JsonResponse
    {
        $category = ServiceCategory::create($this->payload($request->validated()));
        $this->serviceManager->invalidateCache();
        $this->auditLogService->log($request->user(), 'service.category_created', ServiceCategory::class, $category->id, ['slug' => $category->slug], $request->ip(), $request->userAgent());

        return ApiResponseHelper::created($category, 'Online service category created.');
    }

    public function update(OnlineServiceCategoryRequest $request, int $serviceCategory): JsonResponse
    {
        $category = ServiceCategory::findOrFail($serviceCategory);
        $category->update($this->payload($request->validated(), $category));

        // The denormalized display label remains available to legacy consumers while all
        // new relations use service_category_id as the source of truth.
        $category->services()->update(['category' => $category->name]);
        $this->serviceManager->invalidateCache();
        $this->auditLogService->log($request->user(), 'service.category_updated', ServiceCategory::class, $category->id, ['slug' => $category->slug], $request->ip(), $request->userAgent());

        return ApiResponseHelper::success($category->fresh()->loadCount('services'), 'Online service category updated.');
    }

    public function destroy(int $serviceCategory): JsonResponse
    {
        $category = ServiceCategory::withCount('services')->findOrFail($serviceCategory);
        if ($category->services_count > 0) {
            throw ValidationException::withMessages(['serviceCategory' => 'این دسته دارای خدمت است. ابتدا خدمت‌ها را به دستهٔ دیگری منتقل یا غیرفعال کنید.']);
        }

        $category->delete();
        $this->serviceManager->invalidateCache();
        $this->auditLogService->log(request()->user(), 'service.category_deleted', ServiceCategory::class, $serviceCategory, ['slug' => $category->slug], request()->ip(), request()->userAgent());

        return ApiResponseHelper::success(null, 'Online service category deleted.');
    }

    private function payload(array $data, ?ServiceCategory $category = null): array
    {
        $data['name'] = trim($data['name']);
        $data['slug'] = $data['slug'] ?? $category?->slug ?? $this->makeSlug($data['name']);
        $data['sort_order'] = $data['sort_order'] ?? $category?->sort_order ?? ((int) ServiceCategory::max('sort_order') + 10);

        return $data;
    }

    private function makeSlug(string $name): string
    {
        $slug = Str::slug($name);
        return $slug !== '' ? $slug : 'service-category-'.substr(sha1($name), 0, 12);
    }
}
