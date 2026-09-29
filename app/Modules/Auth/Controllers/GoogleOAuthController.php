<?php

namespace App\Modules\Auth\Controllers;

use App\Modules\Auth\Requests\GoogleOAuthExchangeRequest;
use App\Modules\Auth\Services\GoogleOAuthException;
use App\Modules\Auth\Services\GoogleOAuthService;
use App\Modules\Shared\Exceptions\UnauthorizedActionException;
use App\Modules\Shared\Helpers\ApiResponseHelper;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Symfony\Component\HttpFoundation\Response;

class GoogleOAuthController extends Controller
{
    public function __construct(private readonly GoogleOAuthService $googleOAuthService)
    {
    }

    public function redirect(): RedirectResponse
    {
        try {
            $authorization = $this->googleOAuthService->begin();

            return redirect()->away($authorization['authorization_url'])
                ->withCookie($this->googleOAuthService->stateCookie($authorization['state']));
        } catch (GoogleOAuthException $exception) {
            return $this->redirectToFrontend('unavailable', $exception->reason);
        }
    }

    public function callback(Request $request): RedirectResponse
    {
        if ($request->query('error')) {
            return $this->redirectToFrontend('error', 'GOOGLE_OAUTH_CANCELLED');
        }

        try {
            $handoff = $this->googleOAuthService->authenticateCallback(
                $request->query('state'),
                $request->cookie('noovinnet_google_oauth_state'),
                $request->query('code')
            );

            return $this->redirectToFrontend('complete', null, $handoff)
                ->withCookie($this->googleOAuthService->forgetStateCookie());
        } catch (GoogleOAuthException|UnauthorizedActionException $exception) {
            $reason = $exception instanceof GoogleOAuthException ? $exception->reason : 'ACCOUNT_DISABLED';

            return $this->redirectToFrontend('error', $reason)
                ->withCookie($this->googleOAuthService->forgetStateCookie());
        }
    }

    public function exchange(GoogleOAuthExchangeRequest $request): JsonResponse
    {
        try {
            $result = $this->googleOAuthService->consumeHandoff($request->validated('handoff_code'));
            $user = $result['user'];

            return ApiResponseHelper::success([
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => $user->role,
                    'status' => $user->status,
                ],
                'token' => $result['token'],
            ], 'Google sign-in completed successfully.');
        } catch (GoogleOAuthException $exception) {
            return ApiResponseHelper::error(
                'Google sign-in session is invalid or expired. Please try again.',
                $exception->reason,
                Response::HTTP_UNPROCESSABLE_ENTITY
            );
        } catch (UnauthorizedActionException) {
            return ApiResponseHelper::error(
                'Account is inactive, suspended, or unavailable.',
                'ACCOUNT_DISABLED',
                Response::HTTP_FORBIDDEN
            );
        }
    }

    private function redirectToFrontend(string $outcome, ?string $reason = null, ?string $handoff = null): RedirectResponse
    {
        $query = ['google_oauth' => $outcome];
        if ($reason !== null) {
            $query['reason'] = $reason;
        }
        if ($handoff !== null) {
            $query['handoff'] = $handoff;
        }

        $frontendUrl = rtrim((string) config('services.google.frontend_redirect'), '/');
        if (!filter_var($frontendUrl, FILTER_VALIDATE_URL)) {
            $frontendUrl = rtrim((string) config('app.url'), '/');
        }

        return redirect()->away($frontendUrl . '/auth?' . http_build_query($query, '', '&', PHP_QUERY_RFC3986));
    }
}
