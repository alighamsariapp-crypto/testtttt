<?php

namespace App\Modules\Support\Controllers;

use App\Modules\Shared\Helpers\ApiResponseHelper;
use App\Modules\Support\Requests\CreateSupportTicketRequest;
use App\Modules\Support\Requests\SupportTicketMessageRequest;
use App\Modules\Support\Services\SupportTicketService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class SupportTicketController extends Controller
{
    public function __construct(private readonly SupportTicketService $ticketService)
    {
    }

    public function index(Request $request): JsonResponse
    {
        return ApiResponseHelper::success(
            $this->ticketService->paginateForUser($request->user(), (int) $request->integer('per_page', 15)),
            'Support tickets retrieved successfully.'
        );
    }

    public function show(Request $request, int|string $ticket): JsonResponse
    {
        return ApiResponseHelper::success(
            $this->ticketService->findForUser($request->user(), $ticket),
            'Support ticket retrieved successfully.'
        );
    }

    public function store(CreateSupportTicketRequest $request): JsonResponse
    {
        return ApiResponseHelper::created(
            $this->ticketService->create($request->user(), $request->validated()),
            'Support ticket created successfully.'
        );
    }

    public function storeMessage(SupportTicketMessageRequest $request, int|string $ticket): JsonResponse
    {
        return ApiResponseHelper::created(
            $this->ticketService->addUserMessage($request->user(), $ticket, $request->validated()),
            'Support ticket message sent successfully.'
        );
    }

    public function close(Request $request, int|string $ticket): JsonResponse
    {
        return ApiResponseHelper::success(
            $this->ticketService->closeForUser($request->user(), $ticket),
            'Support ticket closed successfully.'
        );
    }
}
