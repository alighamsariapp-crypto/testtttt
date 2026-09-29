<?php

namespace App\Modules\Admin\Controllers;

use App\Modules\Admin\Requests\CreateQuoteRequest;
use App\Modules\Admin\Services\AuditLogService;
use App\Modules\Services\Models\ServiceQuote;
use App\Modules\Services\Models\ServiceRequest;
use App\Modules\Shared\Helpers\ApiResponseHelper;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;

class AdminServiceController extends Controller
{
    public function __construct(private readonly AuditLogService $auditLogService)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $query = ServiceRequest::with(['user:id,name,email', 'catalog', 'quotes', 'timelines']);

        if ($request->filled('status')) {
            $query->where('status', $request->get('status'));
        }

        $requests = $query->orderBy('created_at', 'desc')->paginate((int) $request->get('per_page', 20));
        return ApiResponseHelper::success($requests, 'Admin service requests list.');
    }

    public function createQuote(CreateQuoteRequest $request, int $id): JsonResponse
    {
        $serviceRequest = ServiceRequest::findOrFail($id);

        $quote = DB::transaction(function () use ($request, $serviceRequest) {
            $quote = $serviceRequest->quotes()->create([
                'amount' => $request->validated('amount'),
                'currency' => $request->validated('currency', 'IRR'),
                'scope_of_work' => $request->validated('scope_of_work'),
                'terms' => $request->validated('terms'),
                'valid_until' => $request->validated('valid_until'),
                'status' => ServiceQuote::STATUS_PENDING,
                'created_by_staff_id' => $request->user()->id,
            ]);

            $serviceRequest->status = ServiceRequest::STATUS_QUOTED;
            $serviceRequest->save();

            return $quote;
        });

        $this->auditLogService->log(
            $request->user(),
            'service.quote_created',
            ServiceQuote::class,
            $quote->id,
            ['amount' => $quote->amount, 'service_request_id' => $serviceRequest->id],
            $request->ip(),
            $request->userAgent()
        );

        return ApiResponseHelper::created($quote, 'Quote submitted to customer.');
    }

    public function updateStatus(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'status' => ['required', 'string', 'in:submitted,reviewing,quoted,customer_accepted,in_progress,waiting_customer,completed,cancelled,rejected'],
            'assigned_staff_id' => ['nullable', 'exists:users,id'],
        ]);

        $serviceRequest = ServiceRequest::findOrFail($id);
        if ($request->filled('status')) {
            $serviceRequest->status = $request->get('status');
        }
        if ($request->has('assigned_staff_id')) {
            $serviceRequest->assigned_staff_id = $request->get('assigned_staff_id');
        }
        $serviceRequest->save();

        $this->auditLogService->log(
            $request->user(),
            'service.status_updated',
            ServiceRequest::class,
            $serviceRequest->id,
            ['status' => $serviceRequest->status, 'assigned_staff_id' => $serviceRequest->assigned_staff_id],
            $request->ip(),
            $request->userAgent()
        );

        return ApiResponseHelper::success($serviceRequest, 'Service request updated.');
    }
}
