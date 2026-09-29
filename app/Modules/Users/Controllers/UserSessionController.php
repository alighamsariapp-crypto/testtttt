<?php

namespace App\Modules\Users\Controllers;

use App\Modules\Shared\Helpers\ApiResponseHelper;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class UserSessionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $currentTokenId = $request->user()->currentAccessToken()?->id;
        $tokens = $request->user()
            ->tokens()
            ->orderByDesc('last_used_at')
            ->orderByDesc('created_at')
            ->get()
            ->map(fn ($token): array => [
                'id' => $token->id,
                'device' => $token->name ?: 'دستگاه ناشناس',
                'browser' => 'توکن دسترسی',
                'os' => '',
                'location' => '',
                'ip' => '',
                'last_active' => $token->last_used_at ?? $token->created_at,
                'created_at' => (string) $token->created_at,
                'expires_at' => (string) $token->expires_at,
                'is_current' => (int) $token->id === (int) $currentTokenId,
            ]);

        return ApiResponseHelper::success($tokens, 'Active sessions retrieved successfully.');
    }

    public function destroy(Request $request, int $tokenId): JsonResponse
    {
        $currentTokenId = $request->user()->currentAccessToken()?->id;
        if ((int) $tokenId === (int) $currentTokenId) {
            return ApiResponseHelper::error('Use logout to terminate the current session.', 'CURRENT_SESSION', 422);
        }

        $deleted = $request->user()->tokens()->whereKey($tokenId)->delete();
        if (!$deleted) {
            return ApiResponseHelper::error('Session not found.', 'SESSION_NOT_FOUND', 404);
        }

        return ApiResponseHelper::success(null, 'Session terminated successfully.');
    }

    public function destroyOthers(Request $request): JsonResponse
    {
        $currentTokenId = $request->user()->currentAccessToken()?->id;
        $request->user()->tokens()->when($currentTokenId, fn ($query) => $query->whereKeyNot($currentTokenId))->delete();

        return ApiResponseHelper::success(null, 'Other sessions terminated successfully.');
    }
}
