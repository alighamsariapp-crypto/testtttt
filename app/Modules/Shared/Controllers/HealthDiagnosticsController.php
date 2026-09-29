<?php

namespace App\Modules\Shared\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Shared\Helpers\ApiResponseHelper;
use App\Modules\Shared\Middleware\SecurityHeaders;
use App\Modules\Shared\Services\SafeImageUploadService;
use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Throwable;

class HealthDiagnosticsController extends Controller
{
    /**
     * Minimal, Public Liveness Health Check.
     *
     * Strict Hardening Rules:
     * - Returns only minimal stable schema: status, version, timestamp.
     * - Never discloses APP_ENV, cache driver, queue driver, session driver,
     *   database name, filesystem paths, hostnames, exception class, or stack traces.
     * - Guarantees valid JSON response and security headers in both success and failure states.
     */
    public function health(Request $request): JsonResponse
    {
        try {
            $data = [
                'status' => 'healthy',
                'version' => (string) config('app.version', '1.0.0'),
                'timestamp' => now()->toIso8601String(),
            ];

            $response = response()->json([
                'success' => true,
                'data' => $data,
                'message' => 'ApexStore Backend is operational.',
                'error_code' => null,
                'errors' => null,
            ], 200);

            return SecurityHeaders::applyTo($response, $request);
        } catch (Throwable $e) {
            // Liveness check failure: minimal sanitized failure response with 503
            $response = response()->json([
                'success' => false,
                'data' => [
                    'status' => 'degraded',
                    'version' => (string) config('app.version', '1.0.0'),
                    'timestamp' => now()->toIso8601String(),
                ],
                'message' => 'Service temporarily degraded.',
                'error_code' => 'SERVICE_DEGRADED',
                'errors' => null,
            ], 503);

            return SecurityHeaders::applyTo($response, $request);
        }
    }

    /**
     * Protected Readiness & System Diagnostics Check.
     *
     * Strict Authorization:
     * - Accessible ONLY to authenticated administrators or staff (auth:sanctum + role:admin,staff).
     *
     * Dependency Verification (Zero-Disclosure):
     * - Verifies core functional dependencies (database connectivity, cache responsiveness,
     *   and filesystem storage writability) without leaking any implementation details such
     *   as connection strings, database names, table names, hostnames, driver names, or paths.
     */
    public function diagnostics(Request $request): JsonResponse
    {
        $dependencies = [
            'database' => 'disconnected',
            'cache' => 'degraded',
            'storage' => 'readonly',
            'image_processor' => 'unavailable',
        ];

        $allHealthy = true;

        // 1. Verify Database Readiness without leaking database credentials or hostnames
        try {
            DB::connection()->getPdo();
            $dependencies['database'] = 'connected';
        } catch (Throwable $e) {
            $dependencies['database'] = 'disconnected';
            $allHealthy = false;
        }

        // 2. Verify Cache Readiness without leaking cache backend or driver names
        try {
            $testKey = 'health_ping_'.bin2hex(random_bytes(4));
            Cache::put($testKey, 'ok', 5);
            $val = Cache::get($testKey);
            Cache::forget($testKey);

            if ($val === 'ok') {
                $dependencies['cache'] = 'operational';
            } else {
                $dependencies['cache'] = 'degraded';
                $allHealthy = false;
            }
        } catch (Throwable $e) {
            $dependencies['cache'] = 'degraded';
            $allHealthy = false;
        }

        // 3. Verify Local Storage Readiness without leaking server paths
        try {
            $storagePath = storage_path('framework/cache');
            if (is_writable($storagePath) || is_writable(storage_path())) {
                $dependencies['storage'] = 'writable';
            } else {
                $dependencies['storage'] = 'readonly';
                $allHealthy = false;
            }
        } catch (Throwable $e) {
            $dependencies['storage'] = 'readonly';
            $allHealthy = false;
        }

        // 4. Verify Image Processor Readiness (GD with JPEG, PNG, and WebP support)
        try {
            $processorStatus = SafeImageUploadService::verifyImageProcessorSupport();
            if ($processorStatus['available']) {
                $dependencies['image_processor'] = 'ready';
            } else {
                $dependencies['image_processor'] = 'unavailable';
                $allHealthy = false;
            }
        } catch (Throwable $e) {
            $dependencies['image_processor'] = 'unavailable';
            $allHealthy = false;
        }

        $statusCode = $allHealthy ? 200 : 503;
        $status = $allHealthy ? 'ready' : 'degraded';
        $message = $allHealthy
            ? 'All core system dependencies are operational.'
            : 'One or more system dependencies are currently degraded.';

        $response = response()->json([
            'success' => $allHealthy,
            'data' => [
                'status' => $status,
                'version' => (string) config('app.version', '1.0.0'),
                'timestamp' => now()->toIso8601String(),
                'dependencies' => $dependencies,
            ],
            'message' => $message,
            'error_code' => $allHealthy ? null : 'DEPENDENCY_DEGRADED',
            'errors' => null,
        ], $statusCode);

        return SecurityHeaders::applyTo($response, $request);
    }
}
