<?php

namespace App\Modules\Services\Controllers;

use App\Modules\Services\Requests\CreateServiceRequestRequest;
use App\Modules\Services\Requests\RespondQuoteRequest;
use App\Modules\Services\Services\ServiceManagementService;
use App\Modules\Shared\Helpers\ApiResponseHelper;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class ServiceRequestController extends Controller
{
    public function __construct(private readonly ServiceManagementService $serviceManager)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $requests = $this->serviceManager->getCustomerRequests($request->user(), (int) $request->get('per_page', 15));
        return ApiResponseHelper::success($requests, 'Customer service requests retrieved.');
    }

    public function show(Request $request, string $requestIdOrNumber): JsonResponse
    {
        $serviceRequest = $this->serviceManager->findCustomerRequest($request->user(), $requestIdOrNumber);
        return ApiResponseHelper::success($serviceRequest, 'Service request details retrieved.');
    }

    public function store(CreateServiceRequestRequest $request): JsonResponse
    {
        $serviceRequest = $this->serviceManager->createCustomerRequest($request->user(), $request->validated());
        return ApiResponseHelper::created($serviceRequest, 'Service request submitted successfully.');
    }

    public function respondQuote(RespondQuoteRequest $request, int $quoteId): JsonResponse
    {
        $quote = $this->serviceManager->respondToQuote($request->user(), $quoteId, $request->validated('action'));
        return ApiResponseHelper::success($quote, "Quote successfully {$quote->status}.");
    }
}
