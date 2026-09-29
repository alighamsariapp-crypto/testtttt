<?php

return [
    'google' => [
        'client_id' => env('GOOGLE_CLIENT_ID'),
        'client_secret' => env('GOOGLE_CLIENT_SECRET'),
        'redirect' => env('GOOGLE_REDIRECT_URI', rtrim((string) env('APP_URL'), '/') . '/api/v1/auth/google/callback'),
        'frontend_redirect' => env('GOOGLE_FRONTEND_REDIRECT', env('APP_URL')),
    ],

    // SMS delivery remains disabled until a provider is selected and configured.
    'sms' => [
        'enabled' => filter_var(env('SMS_ENABLED', false), FILTER_VALIDATE_BOOL),
        'driver' => env('SMS_DRIVER', 'disabled'),
        'sender' => env('SMS_SENDER'),
        'otp_ttl_seconds' => (int) env('SMS_OTP_TTL_SECONDS', 120),
        'otp_resend_seconds' => (int) env('SMS_OTP_RESEND_SECONDS', 60),
        'otp_max_attempts' => (int) env('SMS_OTP_MAX_ATTEMPTS', 5),
    ],
];
