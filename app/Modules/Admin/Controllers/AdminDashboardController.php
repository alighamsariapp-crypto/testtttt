<?php

namespace App\Modules\Admin\Controllers;

use App\Modules\Admin\Services\AdminDashboardService;
use App\Modules\Shared\Helpers\ApiResponseHelper;
use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller;

class AdminDashboardController extends Controller
{
    public function __construct(private readonly AdminDashboardService $dashboardService)
    {
    }

    public function index(): JsonResponse
    {
        $metrics = $this->dashboardService->getSummaryMetrics();
        return ApiResponseHelper::success($metrics, 'Admin dashboard metrics retrieved.');
    }
}
