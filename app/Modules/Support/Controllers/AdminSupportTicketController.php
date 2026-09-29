<?php

namespace App\Modules\Support\Controllers;

use App\Modules\Shared\Helpers\ApiResponseHelper;
use App\Modules\Support\Requests\SupportTicketMessageRequest;
use App\Modules\Support\Requests\UpdateSupportTicketRequest;
use App\Modules\Support\Services\SupportTicketService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class AdminSupportTicketController extends Controller
{
    public function __construct(private readonly SupportTicketService $ticketService)
    {
    }

    public function index(Request $request): JsonResponse
    {
        return ApiResponseHelper::success(
            $this->ticketService->paginateForAdmin(
                (int) $request->integer('per_page', 20),
                $request->boolean('include_archived')
            ),
            'Support tickets retrieved successfully.'
        );
    }

    public function reply(SupportTicketMessageRequest $request, int|string $ticket): JsonResponse
    {
        return ApiResponseHelper::created(
            $this->ticketService->addSupportMessage($request->user(), $ticket, $request->validated()),
            'Support reply sent successfully.'
        );
    }

    public function update(UpdateSupportTicketRequest $request, int|string $ticket): JsonResponse
    {
        return ApiResponseHelper::success(
            $this->ticketService->updateFromAdmin($ticket, $request->validated()),
            'Support ticket updated successfully.'
        );
    }

    public function markRead(int|string $ticket): JsonResponse
    {
        return ApiResponseHelper::success(
            $this->ticketService->markReadForAdmin($ticket),
            'Support ticket messages marked as read.'
        );
    }

    public function archive(int|string $ticket): JsonResponse
    {
        return ApiResponseHelper::success(
            $this->ticketService->archiveForAdmin($ticket),
            'Support ticket archived successfully.'
        );
    }

    public function restore(int|string $ticket): JsonResponse
    {
        return ApiResponseHelper::success(
            $this->ticketService->restoreForAdmin($ticket),
            'Support ticket restored successfully.'
        );
    }

    public function destroy(int|string $ticket): JsonResponse
    {
        $this->ticketService->deleteForAdmin($ticket);

        return ApiResponseHelper::success(null, 'Support ticket deleted permanently.');
    }
}
