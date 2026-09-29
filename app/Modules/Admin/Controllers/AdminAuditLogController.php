<?php

namespace App\Modules\Admin\Controllers;

use App\Modules\Admin\Requests\AuditLogFilterRequest;
use App\Modules\Admin\Services\AuditLogService;
use App\Modules\Shared\Helpers\ApiResponseHelper;
use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller;

class AdminAuditLogController extends Controller
{
    public function __construct(private readonly AuditLogService $auditLogService)
    {
    }

    public function index(AuditLogFilterRequest $request): JsonResponse
    {
        $logs = $this->auditLogService->paginateLogs(
            $request->validated(),
            (int) $request->validated('per_page', 20)
        );

        return ApiResponseHelper::success($logs, 'Audit logs retrieved.');
    }
}
