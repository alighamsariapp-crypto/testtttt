<?php

use App\Modules\Admin\Controllers\AdminAuditLogController;
use App\Modules\Admin\Controllers\AdminDashboardController;
use App\Modules\Admin\Controllers\AdminOrderController;
use App\Modules\Admin\Controllers\AdminServiceController;
use App\Modules\Admin\Controllers\AdminOnlineServiceCatalogController;
use App\Modules\Admin\Controllers\AdminOnlineServiceCategoryController;
use App\Modules\Admin\Controllers\AdminUserController;
use App\Modules\Auth\Controllers\AuthController;
use App\Modules\Auth\Controllers\GoogleOAuthController;
use App\Modules\Cart\Controllers\CartController;
use App\Modules\Categories\Controllers\CategoryController;
use App\Modules\Discounts\Controllers\DiscountCouponController;
use App\Modules\Favorites\Controllers\FavoriteController;
use App\Modules\Orders\Controllers\CheckoutController;
use App\Modules\Orders\Controllers\OrderController;
use App\Modules\Payments\Controllers\PaymentStatusController;
use App\Modules\Payments\Controllers\PaymentWebhookController;
use App\Modules\Products\Controllers\ProductController;
use App\Modules\Products\Controllers\ProductAttributeDefinitionController;
use App\Modules\Products\Controllers\ProductImageUploadController;
use App\Modules\Services\Controllers\ServiceController;
use App\Modules\Services\Controllers\ServiceRequestController;
use App\Modules\Settings\Controllers\BlogImageUploadController;
use App\Modules\Settings\Controllers\SiteMediaUploadController;
use App\Modules\Settings\Controllers\SettingController;
use App\Modules\Shared\Controllers\HealthDiagnosticsController;
use App\Modules\Shared\Helpers\ApiResponseHelper;
use App\Modules\Support\Controllers\AdminSupportTicketController;
use App\Modules\Support\Controllers\SupportTicketController;
use App\Modules\Wallet\Controllers\WalletController;
use App\Modules\Users\Controllers\UserController;
use App\Modules\Users\Controllers\UserSessionController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes — NOOVINNET / APEXSTORE (/api/v1/*)
|--------------------------------------------------------------------------
*/

// Backward-compatible minimal liveness endpoint for shared-hosting checks.
Route::get('/health', [HealthDiagnosticsController::class, 'health']);

Route::prefix('v1')->group(function () {

    // 1. Diagnostics & Health Check (Hardened Minimal Public Liveness)
    Route::get('/health', [HealthDiagnosticsController::class, 'health']);

    // Protected Operator Readiness & Diagnostics Check
    Route::get('/diagnostics', [HealthDiagnosticsController::class, 'diagnostics'])
        ->middleware(['auth:sanctum', 'role:admin,staff']);

    // 2. Authentication Flow
    Route::prefix('auth')->group(function () {
        Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:auth-register');
        Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:auth-login');
        Route::post('/otp/send', [AuthController::class, 'sendPhoneVerificationCode'])->middleware('throttle:otp-send');
        Route::post('/otp/verify', [AuthController::class, 'verifyPhoneVerificationCode'])->middleware('throttle:otp-verify');
        Route::post('/forgot-password', [AuthController::class, 'forgotPassword'])->middleware('throttle:password-reset');
        Route::post('/reset-password', [AuthController::class, 'resetPassword'])->middleware('throttle:password-reset');
        Route::post('/password-reset/sms/send', [AuthController::class, 'sendSmsPasswordResetCode'])->middleware('throttle:password-reset-sms-send');
        Route::post('/password-reset/sms/confirm', [AuthController::class, 'confirmSmsPasswordReset'])->middleware('throttle:password-reset-sms-confirm');
        Route::get('/google/redirect', [GoogleOAuthController::class, 'redirect'])->middleware('throttle:oauth-google');
        Route::get('/google/callback', [GoogleOAuthController::class, 'callback'])->middleware('throttle:oauth-google');
        Route::post('/google/exchange', [GoogleOAuthController::class, 'exchange'])->middleware('throttle:oauth-google');
        Route::get('/email/verify/{id}/{hash}', [AuthController::class, 'verifyEmail'])
            ->middleware(['signed', 'throttle:6,1'])
            ->name('verification.verify');

        Route::middleware('auth:sanctum')->group(function () {
            Route::get('/me', [AuthController::class, 'me']);
            Route::post('/logout', [AuthController::class, 'logout']);
            Route::post('/change-password', [AuthController::class, 'changePassword']);
            Route::post('/email/verification-notification', [AuthController::class, 'resendVerificationEmail'])->middleware('throttle:6,1');
        });
    });

    // 3. Customer Profile & Addresses
    Route::prefix('users')->middleware('auth:sanctum')->group(function () {
        Route::get('/me', [UserController::class, 'me']);
        Route::patch('/me', [UserController::class, 'updateMe']);
        Route::get('/addresses', [UserController::class, 'getAddresses']);
        Route::post('/addresses', [UserController::class, 'storeAddress']);
        Route::put('/addresses/{id}', [UserController::class, 'updateAddress']);
        Route::delete('/addresses/{id}', [UserController::class, 'deleteAddress']);
        Route::get('/sessions', [UserSessionController::class, 'index']);
        Route::delete('/sessions/{tokenId}', [UserSessionController::class, 'destroy']);
        Route::delete('/sessions', [UserSessionController::class, 'destroyOthers']);

        Route::get('/favorites', [FavoriteController::class, 'index']);
        Route::post('/favorites/{product}', [FavoriteController::class, 'store']);
        Route::delete('/favorites/{product}', [FavoriteController::class, 'destroy']);

        Route::get('/support-tickets', [SupportTicketController::class, 'index']);
        Route::post('/support-tickets', [SupportTicketController::class, 'store']);
        Route::get('/support-tickets/{ticket}', [SupportTicketController::class, 'show']);
        Route::post('/support-tickets/{ticket}/messages', [SupportTicketController::class, 'storeMessage']);
        Route::post('/support-tickets/{ticket}/close', [SupportTicketController::class, 'close']);

        Route::get('/wallet', [WalletController::class, 'index']);
        Route::post('/wallet/deposits', [WalletController::class, 'createDeposit']);
    });

    // Public site settings
    Route::get('/settings/public', [SettingController::class, 'public']);

    // 4. Categories
    Route::prefix('categories')->group(function () {
        Route::get('/', [CategoryController::class, 'index']);
        Route::get('/{slug}', [CategoryController::class, 'show']);

        Route::middleware(['auth:sanctum', 'role:admin,staff'])->group(function () {
            Route::post('/', [CategoryController::class, 'store']);
            Route::put('/{id}', [CategoryController::class, 'update']);
            Route::delete('/{id}', [CategoryController::class, 'destroy']);
        });
    });

    // 5. Products Catalog
    Route::prefix('products')->group(function () {
        Route::get('/', [ProductController::class, 'index']);
        Route::get('/facets', [ProductController::class, 'facets']);
        Route::get('/{slug}', [ProductController::class, 'show']);

        Route::middleware(['auth:sanctum', 'role:admin,staff'])->group(function () {
            Route::post('/', [ProductController::class, 'store']);
            Route::put('/{id}', [ProductController::class, 'update']);
            Route::delete('/{id}', [ProductController::class, 'destroy']);
        });
    });

    // 6. Shopping Cart
    Route::prefix('cart')->group(function () {
        Route::get('/', [CartController::class, 'show']);
        Route::post('/items', [CartController::class, 'addItem']);
        Route::patch('/items/{item}', [CartController::class, 'updateItem']);
        Route::delete('/items/{item}', [CartController::class, 'removeItem']);
        Route::delete('/', [CartController::class, 'clear']);
    });

    // 7. Checkout (Zero-Trust Transaction)
    Route::get('/checkout/configuration', [SettingController::class, 'checkoutConfiguration']);
    Route::post('/checkout', [CheckoutController::class, 'checkout'])->middleware(['auth:sanctum', 'throttle:checkout']);

    // Coupon & Promotion Validation
    Route::post('/coupons/validate', [DiscountCouponController::class, 'validateCoupon'])->middleware('throttle:coupon-validate');
    Route::post('/discounts/validate', [DiscountCouponController::class, 'validateCoupon'])->middleware('throttle:coupon-validate');

    // 8. Orders (Customer Isolation)
    Route::prefix('orders')->middleware('auth:sanctum')->group(function () {
        Route::get('/', [OrderController::class, 'index']);
        Route::get('/{order}', [OrderController::class, 'show']);
        Route::post('/{id}/cancel', [OrderController::class, 'cancel']);
    });

    // 9. Payments & Webhooks
    Route::prefix('payments')->group(function () {
        Route::get('/zibal/callback', [PaymentWebhookController::class, 'zibalCallback'])
            ->name('payments.zibal.callback')
            ->middleware('throttle:payment-webhook');
        Route::post('/webhooks/{gateway}', [PaymentWebhookController::class, 'handle'])
            ->middleware('throttle:payment-webhook');
        Route::post('/status/exchange', [PaymentStatusController::class, 'exchangeToken'])
            ->middleware('throttle:payment-status');
        Route::post('/status/{identifier}/exchange', [PaymentStatusController::class, 'exchangeToken'])
            ->middleware('throttle:payment-status');
        Route::get('/status/{identifier}', [PaymentStatusController::class, 'show'])
            ->middleware('throttle:payment-status');
        Route::get('/{identifier}/status', [PaymentStatusController::class, 'show'])
            ->middleware('throttle:payment-status');
    });

    // 10. Engineering Services Catalog & Customer Requests
    Route::prefix('services')->group(function () {
        Route::get('/', [ServiceController::class, 'index']);
        Route::get('/categories', [ServiceController::class, 'categories']);
        Route::get('/{slug}', [ServiceController::class, 'show']);
    });

    Route::prefix('service-requests')->middleware('auth:sanctum')->group(function () {
        Route::get('/', [ServiceRequestController::class, 'index']);
        Route::post('/', [ServiceRequestController::class, 'store']);
        Route::get('/{requestNumber}', [ServiceRequestController::class, 'show']);
        Route::post('/quotes/{quoteId}/respond', [ServiceRequestController::class, 'respondQuote']);
    });

    // 11. Admin & Staff Back-Office
    Route::prefix('admin')->middleware(['auth:sanctum', 'role:admin,staff', 'throttle:admin-mutations'])->group(function () {
        Route::get('/dashboard', [AdminDashboardController::class, 'index']);
        Route::get('/categories', [CategoryController::class, 'adminIndex']);
        Route::post('/categories', [CategoryController::class, 'store']);
        Route::put('/categories/{id}', [CategoryController::class, 'update']);
        Route::delete('/categories/{id}', [CategoryController::class, 'destroy']);

        Route::get('/products', [ProductController::class, 'adminIndex']);
        Route::get('/product-attributes', [ProductAttributeDefinitionController::class, 'index']);
        Route::post('/product-attributes', [ProductAttributeDefinitionController::class, 'store']);
        Route::put('/product-attributes/{productAttribute}', [ProductAttributeDefinitionController::class, 'update']);
        Route::delete('/product-attributes/{productAttribute}', [ProductAttributeDefinitionController::class, 'destroy']);
        Route::put('/categories/{category}/product-attributes', [ProductAttributeDefinitionController::class, 'syncCategory']);
        Route::post('/products/images', [ProductImageUploadController::class, 'store'])->middleware('throttle:admin-uploads');
        Route::post('/products', [ProductController::class, 'store']);
        Route::put('/products/{id}', [ProductController::class, 'update']);
        Route::delete('/products/{id}', [ProductController::class, 'destroy']);
        Route::get('/users', [AdminUserController::class, 'index']);
        Route::patch('/users/{id}/status', [AdminUserController::class, 'updateStatus']);
        Route::post('/users/{id}/wallet-adjustments', [AdminUserController::class, 'adjustWallet']);
        Route::get('/orders', [AdminOrderController::class, 'index']);
        Route::patch('/orders/{id}/status', [AdminOrderController::class, 'updateStatus']);
        Route::get('/services/requests', [AdminServiceController::class, 'index']);
        Route::post('/services/requests/{id}/quotes', [AdminServiceController::class, 'createQuote']);
        Route::patch('/services/requests/{id}/status', [AdminServiceController::class, 'updateStatus']);
        Route::get('/services/catalog', [AdminOnlineServiceCatalogController::class, 'index']);
        Route::post('/services/catalog', [AdminOnlineServiceCatalogController::class, 'store']);
        Route::put('/services/catalog/{service}', [AdminOnlineServiceCatalogController::class, 'update']);
        Route::delete('/services/catalog/{service}', [AdminOnlineServiceCatalogController::class, 'destroy']);
        Route::get('/services/categories', [AdminOnlineServiceCategoryController::class, 'index']);
        Route::post('/services/categories', [AdminOnlineServiceCategoryController::class, 'store']);
        Route::put('/services/categories/{serviceCategory}', [AdminOnlineServiceCategoryController::class, 'update']);
        Route::delete('/services/categories/{serviceCategory}', [AdminOnlineServiceCategoryController::class, 'destroy']);
        Route::get('/audit-logs', [AdminAuditLogController::class, 'index']);
        Route::post('/blog/images', [BlogImageUploadController::class, 'store'])->middleware('throttle:admin-uploads');
        Route::post('/site-media/images', [SiteMediaUploadController::class, 'store'])->middleware('throttle:admin-uploads');

        Route::get('/tickets', [AdminSupportTicketController::class, 'index']);
        Route::post('/tickets/{ticket}/reply', [AdminSupportTicketController::class, 'reply']);
        Route::post('/tickets/{ticket}/read', [AdminSupportTicketController::class, 'markRead']);
        Route::post('/tickets/{ticket}/archive', [AdminSupportTicketController::class, 'archive']);
        Route::post('/tickets/{ticket}/restore', [AdminSupportTicketController::class, 'restore']);
        Route::patch('/tickets/{ticket}', [AdminSupportTicketController::class, 'update']);
        Route::delete('/tickets/{ticket}', [AdminSupportTicketController::class, 'destroy']);

        Route::get('/discounts', [DiscountCouponController::class, 'index']);
        Route::post('/discounts', [DiscountCouponController::class, 'store']);
        Route::put('/discounts/{coupon}', [DiscountCouponController::class, 'update']);
        Route::delete('/discounts/{coupon}', [DiscountCouponController::class, 'destroy']);
        Route::post('/discounts/{coupon}/toggle', [DiscountCouponController::class, 'toggle']);

        Route::post('/sms/test-connection', [SettingController::class, 'testSmsConnection'])->middleware('throttle:admin-mutations');
        Route::get('/settings/{group}', [SettingController::class, 'showAdmin']);
        Route::put('/settings/{group}', [SettingController::class, 'updateAdmin']);
        Route::get('/diagnostics', [HealthDiagnosticsController::class, 'diagnostics']);
    });

    /*
    |--------------------------------------------------------------------------
    | Dedicated Non-Production / Staging Routes
    |--------------------------------------------------------------------------
    | Loaded only in local / testing / staging environments.
    | In production, this file is not registered, ensuring test endpoints do not exist.
    */
    if (config('app.env') !== 'production' && file_exists(__DIR__.'/testing.php')) {
        require __DIR__.'/testing.php';
    }
});

// Fallback for any unknown /api/* endpoint to ensure 100% JSON 404 response
Route::fallback(function () {
    return response()->json([
        'success' => false,
        'message' => 'مسیر مورد نظر در API یافت نشد (API endpoint not found).',
        'error_code' => 'NOT_FOUND',
    ], 404);
});
