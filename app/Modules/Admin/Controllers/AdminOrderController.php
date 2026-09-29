<?php

namespace App\Modules\Admin\Controllers;

use App\Modules\Admin\Services\AuditLogService;
use App\Modules\Orders\Models\Order;
use App\Modules\Settings\Services\SmsConfigurationService;
use App\Modules\Settings\Services\SystemSmsNotifier;
use App\Modules\Shared\Helpers\ApiResponseHelper;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class AdminOrderController extends Controller
{
    public function __construct(
        private readonly AuditLogService $auditLogService,
        private readonly SystemSmsNotifier $systemSmsNotifier,
    )
    {
    }

    public function index(Request $request): JsonResponse
    {
        $query = Order::with(['user:id,name,email', 'items', 'payments']);

        if ($request->filled('status')) {
            $query->where('status', $request->get('status'));
        }

        if ($request->filled('order_number')) {
            $query->where('order_number', $request->get('order_number'));
        }

        $orders = $query->orderBy('created_at', 'desc')->paginate((int) $request->get('per_page', 20));
        return ApiResponseHelper::success($orders, 'Admin orders retrieved.');
    }

    public function updateStatus(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'status' => ['required', 'string', 'in:pending,awaiting_payment,paid,processing,shipped,completed,cancelled,refunded,failed'],
            'tracking_code' => ['nullable', 'string', 'max:128'],
        ]);

        $order = Order::findOrFail($id);
        $oldStatus = $order->status;
        $order->status = $request->get('status');
        if ($request->has('tracking_code')) {
            $order->tracking_code = $request->input('tracking_code');
        }
        $order->save();

        if ($oldStatus !== Order::STATUS_SHIPPED && $order->status === Order::STATUS_SHIPPED) {
            $order->loadMissing('user');
            $trackingCode = trim((string) ($order->tracking_code ?? ''));
            $this->systemSmsNotifier->queue(
                SmsConfigurationService::EVENT_ORDER_SHIPPED,
                "order-shipped-{$order->id}",
                $order->user?->phone,
                [
                    'name' => trim((string) ($order->user?->name ?? 'مشتری گرامی')) ?: 'مشتری گرامی',
                    'order_number' => $order->order_number,
                    'tracking_suffix' => $trackingCode === '' ? '' : " کد رهگیری: {$trackingCode}",
                ]
            );
        }

        $this->auditLogService->log(
            $request->user(),
            'order.status_updated',
            Order::class,
            $order->id,
            ['old_status' => $oldStatus, 'new_status' => $order->status],
            $request->ip(),
            $request->userAgent()
        );

        return ApiResponseHelper::success($order->load('items'), 'Order status updated.');
    }
}
