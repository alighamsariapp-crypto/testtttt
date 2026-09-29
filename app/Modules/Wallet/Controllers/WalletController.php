<?php

namespace App\Modules\Wallet\Controllers;

use App\Modules\Shared\Helpers\ApiResponseHelper;
use App\Modules\Wallet\Models\WalletTransaction;
use App\Modules\Wallet\Requests\CreateWalletDepositRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Str;

class WalletController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $transactions = WalletTransaction::query()
            ->where('user_id', $request->user()->id)
            ->latest()
            ->paginate(min(max((int) $request->integer('per_page', 20), 1), 100));

        $balance = (int) WalletTransaction::query()
            ->where('user_id', $request->user()->id)
            ->where('status', WalletTransaction::STATUS_SUCCESSFUL)
            ->selectRaw("COALESCE(SUM(CASE WHEN type IN ('deposit', 'refund', 'cashback', 'adjustment') THEN amount WHEN type = 'purchase' THEN -amount ELSE 0 END), 0) AS balance")
            ->value('balance');

        return ApiResponseHelper::success([
            'balance' => $balance,
            'currency' => 'IRR',
            'transactions' => $transactions,
        ], 'Wallet retrieved successfully.');
    }

    public function createDeposit(CreateWalletDepositRequest $request): JsonResponse
    {
        $transaction = WalletTransaction::create([
            'user_id' => $request->user()->id,
            'type' => 'deposit',
            'amount' => $request->validated('amount'),
            'currency' => 'IRR',
            'status' => WalletTransaction::STATUS_PENDING,
            'reference' => 'WLT-'.Str::upper(Str::random(16)),
            'description' => $request->validated('description') ?: 'Wallet deposit request',
        ]);

        return ApiResponseHelper::created($transaction, 'Wallet deposit request created.');
    }
}
