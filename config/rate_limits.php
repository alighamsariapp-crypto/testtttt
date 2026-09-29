<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Production-Grade Rate Limiting Configuration
    |--------------------------------------------------------------------------
    | Centralized rate limits for the official ApexStore backend.
    | Every limit defines maximum requests allowed per minute window.
    | Configurable per environment with safe, hardened production defaults.
    */

    // Authentication & Identity Endpoints
    'auth_register' => (int) env('RATE_LIMIT_AUTH_REGISTER', 10),
    'auth_login_ip' => (int) env('RATE_LIMIT_AUTH_LOGIN_IP', 15),
    'auth_login_credential' => (int) env('RATE_LIMIT_AUTH_LOGIN_CREDENTIAL', 5),

    // OTP Lifecycle (Distinct thresholds for sending vs verifying)
    'otp_send_ip' => (int) env('RATE_LIMIT_OTP_SEND_IP', 3),
    'otp_send_phone' => (int) env('RATE_LIMIT_OTP_SEND_PHONE', 2),
    'otp_verify_ip' => (int) env('RATE_LIMIT_OTP_VERIFY_IP', 10),
    'otp_verify_phone' => (int) env('RATE_LIMIT_OTP_VERIFY_PHONE', 5),

    // Password Reset (Email & SMS)
    'password_reset_ip' => (int) env('RATE_LIMIT_PASSWORD_RESET_IP', 5),
    'password_reset_email' => (int) env('RATE_LIMIT_PASSWORD_RESET_EMAIL', 3),
    'password_reset_sms_send_ip' => (int) env('RATE_LIMIT_PASSWORD_RESET_SMS_SEND_IP', 3),
    'password_reset_sms_send_phone' => (int) env('RATE_LIMIT_PASSWORD_RESET_SMS_SEND_PHONE', 2),
    'password_reset_sms_confirm_ip' => (int) env('RATE_LIMIT_PASSWORD_RESET_SMS_CONFIRM_IP', 10),
    'password_reset_sms_confirm_phone' => (int) env('RATE_LIMIT_PASSWORD_RESET_SMS_CONFIRM_PHONE', 5),

    // Google OAuth
    'oauth_google' => (int) env('RATE_LIMIT_OAUTH_GOOGLE', 15),

    // Checkout & Order Placement
    'checkout' => (int) env('RATE_LIMIT_CHECKOUT', 10),

    // Coupon & Promotion Validation (Brute-force protection)
    'coupon_validate' => (int) env('RATE_LIMIT_COUPON_VALIDATE', 20),

    // Payment Callbacks & Webhooks (High-throughput with idempotency separation)
    'payment_webhook' => (int) env('RATE_LIMIT_PAYMENT_WEBHOOK', 120),

    // Admin & Staff Operations
    'admin_uploads' => (int) env('RATE_LIMIT_ADMIN_UPLOADS', 30),
    'admin_mutations' => (int) env('RATE_LIMIT_ADMIN_MUTATIONS', 60),

    // Dedicated Staging / Simulation Routes
    'simulation_test' => (int) env('RATE_LIMIT_SIMULATION_TEST', 10),
];
