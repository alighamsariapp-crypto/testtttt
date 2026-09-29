<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Global Security Headers Configuration
    |--------------------------------------------------------------------------
    | Configurable, safe-by-default security headers compatible with APIs and
    | future web frontends without rigid hardcoding.
    */
    'headers' => [
        'x_frame_options' => env('SECURITY_X_FRAME_OPTIONS', 'SAMEORIGIN'),
        'x_content_type_options' => env('SECURITY_X_CONTENT_TYPE_OPTIONS', 'nosniff'),
        'x_xss_protection' => env('SECURITY_X_XSS_PROTECTION', '1; mode=block'),
        'referrer_policy' => env('SECURITY_REFERRER_POLICY', 'strict-origin-when-cross-origin'),
        'strict_transport_security' => env('SECURITY_STRICT_TRANSPORT_SECURITY', true),
        'hsts_max_age' => (int) env('SECURITY_HSTS_MAX_AGE', 31536000), // 1 year
    ],

    /*
    |--------------------------------------------------------------------------
    | Content-Security-Policy (CSP) Policy
    |--------------------------------------------------------------------------
    | Safe baseline for APIs and modern SPAs. Can be switched to report-only
    | or adjusted via environment variables without editing code.
    */
    'csp' => [
        'enabled' => env('SECURITY_CSP_ENABLED', false), // Disabled by default for pure API / configurable
        'report_only' => env('SECURITY_CSP_REPORT_ONLY', false),
        'policy' => env('SECURITY_CSP_POLICY', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https: blob:; connect-src 'self' https:; frame-ancestors 'self';"),
    ],

    /*
    |--------------------------------------------------------------------------
    | Audit Log Sensitive Fields Redaction
    |--------------------------------------------------------------------------
    */
    'redacted_keys' => [
        'password',
        'password_confirmation',
        'token',
        'status_token',
        'payment_status_token',
        'exchange_code',
        'secret',
        'api_key',
        'apikey',
        'app_key',
        'appkey',
        'signing_key',
        'client_secret',
        'card_number',
        'cvv',
        'cvc',
        'authorization',
        'cookie',
        'remember_token',
        'session_id',
        'stripe_secret',
        'paypal_client_secret',
    ],

    /*
    |--------------------------------------------------------------------------
    | Payment Simulation Security
    |--------------------------------------------------------------------------
    */
    'payments' => [
        'allow_test_payment_simulation' => env('ALLOW_TEST_PAYMENT_SIMULATION', false),
        'production_payment_locked' => env('PRODUCTION_PAYMENT_LOCKED', false),
    ],
];
