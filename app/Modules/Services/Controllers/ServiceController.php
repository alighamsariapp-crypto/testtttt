<?php

namespace App\Modules\Services\Controllers;

use App\Modules\Services\Services\ServiceManagementService;
use App\Modules\Shared\Helpers\ApiResponseHelper;
use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller;

class ServiceController extends Controller
{
    public function __construct(private readonly ServiceManagementService $serviceManager)
    {
    }

    public function index(): JsonResponse
    {
        $services = $this->serviceManager->getActiveServices();
        return ApiResponseHelper::success($services, 'Active services catalog retrieved.');
    }

    public function categories(): JsonResponse
    {
        return ApiResponseHelper::success($this->serviceManager->getActiveServiceCategories(), 'Active service categories retrieved.');
    }

    public function show(string $slug): JsonResponse
    {
        $service = $this->serviceManager->findServiceBySlug($slug);
        return ApiResponseHelper::success($service, 'Service details retrieved.');
    }
}
