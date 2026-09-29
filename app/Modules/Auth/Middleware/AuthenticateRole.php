<?php

namespace App\Modules\Auth\Middleware;

use App\Modules\Shared\Helpers\ApiResponseHelper;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AuthenticateRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (!$user) {
            return ApiResponseHelper::error('Unauthenticated.', 'UNAUTHENTICATED', Response::HTTP_UNAUTHORIZED);
        }

        if (!$user->isActive()) {
            return ApiResponseHelper::error('Account is inactive or suspended.', 'ACCOUNT_DISABLED', Response::HTTP_FORBIDDEN);
        }

        if (empty($roles)) {
            return $next($request);
        }

        if ($user->isAdmin()) {
            return $next($request);
        }

        if (in_array($user->role, $roles, true)) {
            return $next($request);
        }

        return ApiResponseHelper::error('Unauthorized access for your role.', 'FORBIDDEN_ROLE', Response::HTTP_FORBIDDEN);
    }
}
