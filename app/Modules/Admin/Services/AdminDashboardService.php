<?php

namespace App\Modules\Admin\Services;

use App\Modules\Orders\Models\Order;
use App\Modules\Payments\Models\Payment;
use App\Modules\Products\Models\Product;
use App\Modules\Services\Models\ServiceRequest;
use App\Modules\Shared\Contracts\BaseServiceInterface;
use App\Modules\Users\Models\User;
use Illuminate\Support\Facades\DB;

class AdminDashboardService implements BaseServiceInterface
{
    /**
     * Efficient aggregated statistics for administrative dashboard
     */
    public function getSummaryMetrics(): array
    {
        $totalUsers = User::count();
        $totalProducts = Product::count();
        $totalOrders = Order::count();
        $pendingOrders = Order::whereIn('status', [Order::STATUS_PENDING, Order::STATUS_AWAITING_PAYMENT])->count();
        $totalRevenue = Order::where('status', Order::STATUS_PAID)->sum('grand_total');
        $pendingServiceRequests = ServiceRequest::whereIn('status', [ServiceRequest::STATUS_SUBMITTED, ServiceRequest::STATUS_REVIEWING])->count();
        $pendingPayments = Payment::where('status', Payment::STATUS_PENDING)->count();

        return [
            'metrics' => [
                'total_users' => $totalUsers,
                'total_products' => $totalProducts,
                'total_orders' => $totalOrders,
                'pending_orders' => $pendingOrders,
                'total_revenue_irr' => (int) $totalRevenue,
                'pending_service_requests' => $pendingServiceRequests,
                'pending_payments' => $pendingPayments,
            ],
            'recent_orders' => Order::with('user:id,name,email')->latest()->limit(5)->get(),
            'recent_service_requests' => ServiceRequest::with('user:id,name,email')->latest()->limit(5)->get(),
        ];
    }
}
