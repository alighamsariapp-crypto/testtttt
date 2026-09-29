<?php

use App\Modules\Payments\Controllers\PaymentWebhookController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Dedicated Non-Production / Staging Routes
|--------------------------------------------------------------------------
| This file is ONLY loaded when config('app.env') !== 'production'.
| In production, this file is not registered, guaranteeing test endpoints
| return a true 404 Route-Not-Found.
*/

Route::prefix('payments/test')->middleware(['auth:sanctum', 'role:admin,staff', 'throttle:simulation-test'])->group(function () {
    Route::match(['get', 'post'], '/simulate', [PaymentWebhookController::class, 'simulateTestPayment'])
        ->name('payments.test.simulate');
});
