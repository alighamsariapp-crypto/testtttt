<?php

namespace App\Modules\Orders\Controllers;

use App\Modules\Orders\Models\Order;
use App\Modules\Orders\Services\OrderService;
use App\Modules\Shared\Helpers\ApiResponseHelper;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class OrderController extends Controller
{
    public function __construct(private readonly OrderService $orderService)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->integer('per_page', 15), 1), 50);
        $orders = $this->orderService->getOrdersForUser($request->user(), $perPage);

        return ApiResponseHelper::success($orders, 'Orders retrieved successfully.');
    }

    public function show(Request $request, int|string $order): JsonResponse
    {
        $userOrder = $this->orderService->findUserOrder($request->user(), $order);

        return ApiResponseHelper::success($userOrder, 'Order details retrieved successfully.');
    }

    public function cancel(Request $request, int $id): JsonResponse
    {
        $order = $this->orderService->cancelOrder($request->user(), $id);

        return ApiResponseHelper::success($order, 'Order cancelled successfully.');
    }
}
