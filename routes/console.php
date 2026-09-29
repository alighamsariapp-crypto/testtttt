<?php

use Illuminate\Support\Facades\Schedule;

/*
|--------------------------------------------------------------------------
| DirectAdmin Console & Scheduled Tasks
|--------------------------------------------------------------------------
| The DirectAdmin 1-minute system cron triggers this scheduler.
| Short-lived worker lifecycle prevents process accumulation on shared hosting.
|
| DirectAdmin crontab entry:
| * * * * * cd /home/USERNAME/public_html/.. && php artisan schedule:run >> /dev/null 2>&1
*/

// Short-lived database queue worker (terminates when empty or after 50 seconds)
Schedule::command('queue:work --stop-when-empty --max-time=50 --memory=128 --tries=3')
    ->everyMinute()
    ->withoutOverlapping(10); // 10-minute lock expiration if stale

// Clean old sessions once daily
Schedule::command('session:gc')->daily()->withoutOverlapping();

/*
|--------------------------------------------------------------------------
| Production Release Gate Checklist Command
|--------------------------------------------------------------------------
*/
\Illuminate\Support\Facades\Artisan::command('release:check', function () {
    $this->info("================================================================================");
    $this->info("RUNNING LARAVEL PRODUCTION RELEASE GATE CHECKLIST");
    $this->info("================================================================================");

    $failures = [];

    // 1. APP_DEBUG in production
    $isProd = app()->isProduction() || strtolower((string) config('app.env')) === 'production';
    $debug = config('app.debug', false);
    if ($isProd && $debug) {
        $failures[] = "APP_DEBUG is enabled in production environment.";
        $this->error("[FAIL] APP_DEBUG must be false in production.");
    } else {
        $this->line("[PASS] APP_DEBUG check: OK (debug=" . ($debug ? 'true' : 'false') . ")");
    }

    // 2. APP_KEY present
    $key = (string) config('app.key');
    if (empty($key) || (!str_starts_with($key, 'base64:') && strlen($key) < 32)) {
        $failures[] = "APP_KEY is missing or invalid.";
        $this->error("[FAIL] APP_KEY is missing or invalid.");
    } else {
        $this->line("[PASS] APP_KEY present and valid.");
    }

    // 3. CORS production origin list
    $corsProd = (string) env('CORS_ALLOWED_ORIGINS_PRODUCTION', '');
    $origins = array_filter(array_map('trim', explode(',', $corsProd)));
    $hasWildcard = in_array('*', $origins, true);
    if ($isProd && (empty($origins) || $hasWildcard)) {
        $failures[] = "CORS_ALLOWED_ORIGINS_PRODUCTION is empty or contains wildcard in production.";
        $this->error("[FAIL] CORS production origin list empty or contains wildcard.");
    } else {
        $this->line("[PASS] CORS production origin check: OK (" . implode(', ', $origins) . ")");
    }

    // 4. Test payment gateway in production
    $sandbox = (bool) config('services.zibal.sandbox', false);
    if ($isProd && $sandbox) {
        $failures[] = "Zibal sandbox payment gateway enabled in production.";
        $this->error("[FAIL] Test payment gateway / sandbox enabled in production.");
    } else {
        $this->line("[PASS] Production payment gateway check: OK");
    }

    // 5. Demo mode enabled
    $demoMode = (bool) env('VITE_ENABLE_DEMO_MODE', false);
    if ($isProd && $demoMode) {
        $failures[] = "Demo mode is enabled in production.";
        $this->error("[FAIL] VITE_ENABLE_DEMO_MODE must be false in production.");
    } else {
        $this->line("[PASS] Demo mode check: OK");
    }

    // 6. Database driver supported
    $driver = config('database.default');
    if ($isProd && !in_array($driver, ['mysql', 'mariadb'], true)) {
        $failures[] = "Database driver '{$driver}' is unsupported in production (must be mysql or mariadb).";
        $this->error("[FAIL] Database driver must be MySQL 8 or MariaDB 10.6+ in production.");
    } else {
        $this->line("[PASS] Database driver check: OK (driver={$driver})");
    }

    // 7. Absence of simulation routes in production
    $hasSimulateRoute = \Illuminate\Support\Facades\Route::has('payments.test.simulate');
    if ($isProd && $hasSimulateRoute) {
        $failures[] = "Test payment simulation route is registered in production.";
        $this->error("[FAIL] payments.test.simulate must not exist in production.");
    } else {
        $this->line("[PASS] Absence of simulation routes check: OK");
    }

    if (!empty($failures)) {
        $this->error("\nRELEASE GATE FAILED: " . count($failures) . " critical violation(s) detected.");
        return 1;
    }

    $this->info("\nALL LARAVEL PRODUCTION RELEASE GATES PASSED.");
    return 0;
})->purpose('Run production release checklist validations');
