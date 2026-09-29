<?php

use App\Modules\Shared\Middleware\ForceJsonResponse;
use App\Modules\Shared\Middleware\SecurityHeaders;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Global middleware for API and Web
        $middleware->append(SecurityHeaders::class);
        $middleware->append(ForceJsonResponse::class);

        // Middleware aliases
        $middleware->alias([
            'role' => \App\Modules\Auth\Middleware\AuthenticateRole::class,
        ]);

        // API group rate limiting
        $middleware->api(prepend: [
            \Illuminate\Routing\Middleware\SubstituteBindings::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Render all API/health exceptions as hardened JSON responses (No stack traces, SQL, or file paths in production)
        $exceptions->render(function (Throwable $e, Request $request) {
            if ($e instanceof \Illuminate\Http\Exceptions\HttpResponseException) {
                return $e->getResponse();
            }

            if ($request->is('api/*') || $request->is('health') || $request->expectsJson()) {
                $statusCode = 500;
                $errorCode = 'SERVER_ERROR';
                $message = 'An unexpected error occurred.';

                if ($e instanceof AuthenticationException) {
                    $statusCode = 401;
                    $errorCode = 'UNAUTHENTICATED';
                    $message = 'Authentication is required.';
                } elseif ($e instanceof AuthorizationException) {
                    $statusCode = 403;
                    $errorCode = 'FORBIDDEN';
                    $message = 'You are not authorized to perform this action.';
                } elseif ($e instanceof HttpExceptionInterface) {
                    $statusCode = $e->getStatusCode();
                    $message = $e->getMessage() ?: 'HTTP Error';
                    $errorCode = match ($statusCode) {
                        400 => 'BAD_REQUEST',
                        401 => 'UNAUTHENTICATED',
                        403 => 'FORBIDDEN',
                        404 => 'NOT_FOUND',
                        409 => 'CONFLICT',
                        422 => 'VALIDATION_ERROR',
                        429 => 'TOO_MANY_REQUESTS',
                        default => 'HTTP_ERROR',
                    };
                } elseif ($e instanceof \Illuminate\Validation\ValidationException) {
                    $statusCode = 422;
                    $errorCode = 'VALIDATION_FAILED';
                    $message = 'The given data was invalid.';

                    $validationResponse = response()->json([
                        'success' => false,
                        'message' => $message,
                        'error_code' => $errorCode,
                        'errors' => $e->errors(),
                    ], $statusCode);

                    return SecurityHeaders::applyTo($validationResponse, $request);
                } elseif ($e instanceof \App\Modules\Shared\Exceptions\DomainException) {
                    $statusCode = $e->getStatusCode();
                    $errorCode = $e->getErrorCode();
                    $message = $e->getMessage();
                }

                $headers = $e instanceof HttpExceptionInterface ? $e->getHeaders() : [];
                if ($statusCode === 429 && !isset($headers['Retry-After'])) {
                    $headers['Retry-After'] = '60';
                }

                $isProduction = app()->isProduction() || strtolower((string) config('app.env')) === 'production';

                // Strict hardening: In production or for 500 errors, never leak file paths, SQL queries, or internals
                if ($isProduction || $statusCode >= 500) {
                    if ($statusCode >= 500) {
                        $message = 'An unexpected server error occurred. Please try again later.';
                    } else {
                        // Strip any potential server paths or database keywords
                        $message = preg_replace('/(\/[a-zA-Z0-9_\-\.]+)+/', '[path]', $message);
                        $message = preg_replace('/(SQLSTATE|SELECT|INSERT|UPDATE|DELETE|FROM|WHERE)/i', '[query]', $message);
                    }
                }

                $response = [
                    'success' => false,
                    'message' => $message,
                    'error_code' => $errorCode,
                ];

                // Debug details: STRICTLY forbidden in production, regardless of APP_DEBUG.
                // In non-production environments, only included if APP_DEBUG is explicitly enabled.
                if (!$isProduction && config('app.debug', false)) {
                    $response['debug'] = [
                        'exception' => get_class($e),
                        'file' => $e->getFile(),
                        'line' => $e->getLine(),
                        'trace' => collect($e->getTrace())->take(5)->map(function ($item) {
                            unset($item['args']); // Never leak arguments which could contain passwords, tokens, or cards
                            return $item;
                        })->toArray(),
                    ];
                }

                $jsonResponse = response()->json($response, $statusCode, $headers);

                // Consistently apply security headers to all error responses
                return SecurityHeaders::applyTo($jsonResponse, $request);
            }
        });
    })->create();
