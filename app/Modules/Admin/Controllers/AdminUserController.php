<?php

namespace App\Modules\Admin\Controllers;

use App\Modules\Admin\Services\AuditLogService;
use App\Modules\Orders\Models\Order;
use App\Modules\Shared\Helpers\ApiResponseHelper;
use App\Modules\Support\Models\SupportTicket;
use App\Modules\Users\Models\User;
use App\Modules\Wallet\Models\WalletTransaction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class AdminUserController extends Controller
{
    public function __construct(private readonly AuditLogService $auditLogService)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $walletBalance = WalletTransaction::query()
            ->selectRaw("COALESCE(SUM(CASE WHEN type IN ('deposit', 'refund', 'cashback', 'adjustment') THEN amount WHEN type = 'purchase' THEN -amount ELSE 0 END), 0)")
            ->whereColumn('user_id', 'users.id')
            ->where('status', WalletTransaction::STATUS_SUCCESSFUL);
        $ordersCount = Order::query()
            ->selectRaw('COUNT(*)')
            ->whereColumn('user_id', 'users.id');
        $openTicketsCount = SupportTicket::query()
            ->selectRaw('COUNT(*)')
            ->whereColumn('user_id', 'users.id')
            ->whereIn('status', [SupportTicket::STATUS_OPEN, SupportTicket::STATUS_INVESTIGATING]);
        $lastOrderAt = Order::query()
            ->select('created_at')
            ->whereColumn('user_id', 'users.id')
            ->latest('created_at')
            ->limit(1);

        $query = User::query()
            ->with('addresses')
            ->select('users.*')
            ->selectSub($walletBalance, 'wallet_balance')
            ->selectSub($ordersCount, 'orders_count')
            ->selectSub($openTicketsCount, 'open_tickets_count')
            ->selectSub($lastOrderAt, 'last_order_at');

        if ($request->filled('role')) {
            $query->where('role', $request->get('role'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->get('status'));
        }

        if ($request->filled('search')) {
            $term = trim($request->get('search'));
            $query->where(function ($q) use ($term) {
                $q->where('name', 'LIKE', "%{$term}%")
                  ->orWhere('email', 'LIKE', "%{$term}%");
            });
        }

        $users = $query
            ->orderBy('created_at', 'desc')
            ->paginate((int) $request->get('per_page', 20))
            ->through(fn (User $user): array => $this->userPayload($user));

        return ApiResponseHelper::success($users, 'Users list retrieved.');
    }

    public function adjustWallet(Request $request, int $id): JsonResponse
    {
        if (!$request->user()->isAdmin()) {
            return ApiResponseHelper::error('Only administrators can adjust wallet balances.', 'FORBIDDEN', 403);
        }

        $validated = $request->validate([
            'amount' => ['required', 'integer', 'not_in:0', 'between:-1000000000,1000000000'],
            'note' => ['required', 'string', 'max:500'],
        ]);

        $user = User::findOrFail($id);
        $balance = $this->walletBalance($user);

        if ($balance + $validated['amount'] < 0) {
            return ApiResponseHelper::error('Wallet balance cannot become negative.', 'INVALID_WALLET_BALANCE', 422);
        }

        $transaction = WalletTransaction::create([
            'user_id' => $user->id,
            'type' => 'adjustment',
            'amount' => $validated['amount'],
            'currency' => 'IRR',
            'status' => WalletTransaction::STATUS_SUCCESSFUL,
            'reference' => 'ADJ-'.str()->upper(str()->random(16)),
            'description' => $validated['note'],
        ]);

        $this->auditLogService->log(
            $request->user(),
            'user.wallet_adjusted',
            User::class,
            $user->id,
            ['transaction_id' => $transaction->id, 'amount' => $validated['amount']],
            $request->ip(),
            $request->userAgent()
        );

        return ApiResponseHelper::success($transaction, 'Wallet balance adjusted successfully.');
    }

    public function updateStatus(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'status' => ['required', 'string', 'in:active,inactive,suspended,pending'],
            'role' => ['sometimes', 'string', 'in:customer,staff,admin'],
        ]);

        $user = User::findOrFail($id);
        $oldState = ['status' => $user->status, 'role' => $user->role];

        if ($request->filled('status')) {
            $user->status = $request->get('status');
        }

        if ($request->filled('role')) {
            $user->role = $request->get('role');
        }

        $user->save();

        $this->auditLogService->log(
            $request->user(),
            'user.status_or_role_updated',
            User::class,
            $user->id,
            ['old' => $oldState, 'new' => ['status' => $user->status, 'role' => $user->role]],
            $request->ip(),
            $request->userAgent()
        );

        $freshUser = $user->fresh(['addresses']);

        return ApiResponseHelper::success($this->userPayload($freshUser), 'User status/role updated.');
    }

    private function userPayload(User $user): array
    {
        $selectedBalance = $user->getAttribute('wallet_balance');
        $selectedOrdersCount = $user->getAttribute('orders_count');
        $selectedOpenTicketsCount = $user->getAttribute('open_tickets_count');
        $selectedLastOrderAt = $user->getAttribute('last_order_at');

        return array_merge($user->toArray(), [
            'wallet_balance' => is_numeric($selectedBalance) ? (int) $selectedBalance : $this->walletBalance($user),
            'orders_count' => is_numeric($selectedOrdersCount) ? (int) $selectedOrdersCount : Order::query()->where('user_id', $user->id)->count(),
            'open_tickets_count' => is_numeric($selectedOpenTicketsCount) ? (int) $selectedOpenTicketsCount : SupportTicket::query()->where('user_id', $user->id)->whereIn('status', [SupportTicket::STATUS_OPEN, SupportTicket::STATUS_INVESTIGATING])->count(),
            'last_order_at' => $selectedLastOrderAt ?? Order::query()->where('user_id', $user->id)->latest('created_at')->value('created_at'),
            'has_password' => $user->hasPassword(),
        ]);
    }

    private function walletBalance(User $user): int
    {
        return (int) WalletTransaction::query()
            ->where('user_id', $user->id)
            ->where('status', WalletTransaction::STATUS_SUCCESSFUL)
            ->selectRaw("COALESCE(SUM(CASE WHEN type IN ('deposit', 'refund', 'cashback', 'adjustment') THEN amount WHEN type = 'purchase' THEN -amount ELSE 0 END), 0) AS balance")
            ->value('balance');
    }
}
