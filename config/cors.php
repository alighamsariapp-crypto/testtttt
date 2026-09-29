<?php

use App\Modules\Shared\Security\CorsService;

$appEnv = (string) env('APP_ENV', 'production');
$supportsCredentials = filter_var(env('CORS_SUPPORTS_CREDENTIALS', false), FILTER_VALIDATE_BOOLEAN);

$origins = CorsService::resolveOrigins($appEnv);

// Enforce production & credentials safety validation on config load
if ($appEnv === 'production' || ($supportsCredentials && in_array('*', $origins, true))) {
    CorsService::validateConfiguration($appEnv, $origins, $supportsCredentials);
}

return [
    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    | Hardened CORS policy:
    | - Explicit, separate allowlists for production and staging
    | - Exact scheme, host, and port normalization (no blind reflection)
    | - Wildcards (*) forbidden with credentials or in production
    | - Restrictive method & header lists tailored to application client
    | - supports_credentials defaults to false for Bearer-token architecture
    */
    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => CorsService::getAllowedMethods(),

    'allowed_origins' => $origins,

    'allowed_origins_patterns' => [],

    'allowed_headers' => CorsService::getAllowedHeaders(),

    'exposed_headers' => CorsService::getExposedHeaders(),

    'max_age' => CorsService::getMaxAge(),

    'supports_credentials' => $supportsCredentials,
];
