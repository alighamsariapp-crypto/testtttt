<?php

namespace App\Modules\Shared\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * SecurityHeaders Middleware
 *
 * Applies standard HTTP security headers cleanly and configurably.
 * Designed to be safe-by-default, low overhead, and fully compatible with future frontends.
 */
class SecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        return self::applyTo($response, $request);
    }

    /**
     * Consistently applies configured security headers to any HTTP response.
     */
    public static function applyTo(Response $response, ?Request $request = null): Response
    {
        $headers = config('security.headers', []);

        if (!empty($headers['x_frame_options'])) {
            $response->headers->set('X-Frame-Options', $headers['x_frame_options']);
        }

        if (!empty($headers['x_content_type_options'])) {
            $response->headers->set('X-Content-Type-Options', $headers['x_content_type_options']);
        }

        if (!empty($headers['x_xss_protection'])) {
            $response->headers->set('X-XSS-Protection', $headers['x_xss_protection']);
        }

        $path = $request ? $request->path() : '';
        if (str_contains($path, 'payment-status') || str_contains($path, 'payments/status') || str_contains($path, 'payments/zibal')) {
            $response->headers->set('Referrer-Policy', 'no-referrer');
        } elseif (!empty($headers['referrer_policy'])) {
            $response->headers->set('Referrer-Policy', $headers['referrer_policy']);
        }

        $isSecure = $request ? $request->isSecure() : (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on');
        if (!empty($headers['strict_transport_security']) && $isSecure) {
            $maxAge = $headers['hsts_max_age'] ?? 31536000;
            $response->headers->set('Strict-Transport-Security', "max-age={$maxAge}; includeSubDomains");
        }

        // Configurable Content-Security-Policy (Disabled by default to avoid breaking SPAs; configurable via config/env)
        $cspConfig = config('security.csp', []);
        if (!empty($cspConfig['enabled']) && !empty($cspConfig['policy'])) {
            $headerName = !empty($cspConfig['report_only'])
                ? 'Content-Security-Policy-Report-Only'
                : 'Content-Security-Policy';

            $response->headers->set($headerName, $cspConfig['policy']);
        }

        return $response;
    }
}
