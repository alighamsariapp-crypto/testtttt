<?php

namespace App\Modules\Admin\Controllers;

use App\Modules\Admin\Requests\OnlineServiceCatalogRequest;
use App\Modules\Admin\Services\AuditLogService;
use App\Modules\Services\Models\ServiceCatalog;
use App\Modules\Services\Models\ServiceCategory;
use App\Modules\Services\Services\ServiceManagementService;
use App\Modules\Shared\Helpers\ApiResponseHelper;
use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller;
use Illuminate\Validation\ValidationException;

class AdminOnlineServiceCatalogController extends Controller
{
    public function __construct(
        private readonly AuditLogService $auditLogService,
        private readonly ServiceManagementService $serviceManager,
    ) {
    }

    public function index(): JsonResponse
    {
        $services = ServiceCatalog::query()->with('serviceCategory:id,name,slug,is_active,sort_order')->orderByDesc('updated_at')->get();

        return ApiResponseHelper::success($services, 'Admin online services catalog.');
    }

    public function store(OnlineServiceCatalogRequest $request): JsonResponse
    {
        $service = ServiceCatalog::create($this->payload($request->validated()));
        $this->serviceManager->invalidateCache();

        $this->auditLogService->log($request->user(), 'service.catalog_created', ServiceCatalog::class, $service->id, ['slug' => $service->slug], $request->ip(), $request->userAgent());

        return ApiResponseHelper::created($service, 'Online service created.');
    }

    public function update(OnlineServiceCatalogRequest $request, int $service): JsonResponse
    {
        $catalog = ServiceCatalog::findOrFail($service);
        $catalog->update($this->payload($request->validated()));
        $this->serviceManager->invalidateCache();

        $this->auditLogService->log($request->user(), 'service.catalog_updated', ServiceCatalog::class, $catalog->id, ['slug' => $catalog->slug], $request->ip(), $request->userAgent());

        return ApiResponseHelper::success($catalog->fresh(), 'Online service updated.');
    }

    public function destroy(int $service): JsonResponse
    {
        $catalog = ServiceCatalog::findOrFail($service);
        if ($catalog->requests()->exists()) {
            throw ValidationException::withMessages(['service' => 'این خدمت درخواست ثبت‌شده دارد؛ آن را غیرفعال کنید و حذف نکنید.']);
        }

        $catalog->delete();
        $this->serviceManager->invalidateCache();

        $this->auditLogService->log(request()->user(), 'service.catalog_deleted', ServiceCatalog::class, $service, ['slug' => $catalog->slug], request()->ip(), request()->userAgent());

        return ApiResponseHelper::success(null, 'Online service deleted.');
    }

    private function payload(array $data): array
    {
        $category = ServiceCategory::findOrFail($data['service_category_id']);
        $data['category'] = $category->name;

        return $data;
    }
}
