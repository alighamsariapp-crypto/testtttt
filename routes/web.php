<?php

use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Web Routes — NOOVINNET / APEXSTORE
|--------------------------------------------------------------------------
*/

/**
 * Serve only known client-side routes through the React shell when a request
 * reaches Laravel (for example when the web server's SPA rewrite is bypassed).
 * Static paths and API paths deliberately do not match this route, so a missing
 * JS/CSS/image gets a genuine 404 rather than index.html.
 */
$spaRoutePattern = '^(?:store(?:/.*)?|product(?:/.*)?|services(?:/.*)?|service(?:/.*)?|cart|checkout|payment-status|auth|magazine(?:/.*)?|about|contact|profile(?:/.*)?|admin(?:/.*)?|typography-test)?$';

Route::match(['GET', 'HEAD'], '/{any?}', function () {
    $spaIndex = public_path('index.html');

    abort_unless(File::exists($spaIndex), 404, 'Frontend build was not found.');

    return response()->file($spaIndex, [
        'Content-Type' => 'text/html; charset=UTF-8',
        'Cache-Control' => 'no-cache, must-revalidate',
    ]);
})->where('any', $spaRoutePattern);
