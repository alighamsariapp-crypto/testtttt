<?php

namespace App\Modules\Orders\Services;

use App\Modules\Orders\Models\Order;
use App\Modules\Shared\Contracts\BaseServiceInterface;
use App\Modules\Shared\Exceptions\EntityNotFoundException;
use App\Modules\Users\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class OrderService implements BaseServiceInterface
{
    public function getOrdersForUser(User $user, int $perPage = 15): LengthAwarePaginator
    {
        return Order::where('user_id', $user->id)
            ->with(['items', 'payments'])
            ->orderBy('created_at', 'desc')
            ->paginate(min(max($perPage, 1), 50));
    }

    public function findUserOrder(User $user, int|string $orderIdOrNumber): Order
    {
        $query = Order::where('user_id', $user->id)->with(['items', 'payments']);

        $order = is_numeric($orderIdOrNumber)
            ? $query->where('id', (int) $orderIdOrNumber)->first()
            : $query->where('order_number', $orderIdOrNumber)->first();

        if (!$order) {
            throw new EntityNotFoundException('Order not found or access is denied.');
        }

        return $order;
    }

    public function cancelOrder(User $user, int $orderId): Order
    {
        $order = $this->findUserOrder($user, $orderId);

        if (!in_array($order->status, [Order::STATUS_PENDING, Order::STATUS_AWAITING_PAYMENT], true)) {
            throw new EntityNotFoundException('Only pending or awaiting payment orders can be cancelled.');
        }

        $order->status = Order::STATUS_CANCELLED;
        $order->save();

        return $order;
    }
}
