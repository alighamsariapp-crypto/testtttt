<?php

namespace App\Modules\Payments\Controllers;

use App\Modules\Admin\Services\AuditLogService;
use App\Modules\Orders\Models\Order;
use App\Modules\Payments\Models\Payment;
use App\Modules\Payments\Services\PaymentStatusExchangeService;
use App\Modules\Payments\Services\PaymentStatusTokenService;
use App\Modules\Shared\Helpers\ApiResponseHelper;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Auth;

class PaymentStatusController extends Controller
{
    public function __construct(private readonly AuditLogService $auditLogService)
    {
    }

    /**
     * Exchange a single-use exchange code for a short-lived payment-status authorization token.
     * Prevents long-lived or reusable tokens from being exposed in browser URLs.
     */
    public function exchangeToken(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'order' => ['nullable', 'string', 'max:100'],
            'order_number' => ['nullable', 'string', 'max:100'],
            'identifier' => ['nullable', 'string', 'max:100'],
            'code' => ['nullable', 'string', 'max:128'],
            'exchange_code' => ['nullable', 'string', 'max:128'],
        ]);

        $orderIdentifier = trim((string) (
            $validated['order']
            ?? $validated['order_number']
            ?? $validated['identifier']
            ?? $request->route('identifier')
            ?? $request->input('order')
            ?? ''
        ));
        $code = trim((string) ($validated['code'] ?? $validated['exchange_code'] ?? $request->header('X-Payment-Exchange-Code') ?? ''));

        if (empty($orderIdentifier) || empty($code)) {
            $resp = ApiResponseHelper::error('شماره سفارش و کد تبادل الزامی است.', 'MISSING_EXCHANGE_PARAMETERS', 400);
            $resp->headers->set('Referrer-Policy', 'no-referrer');
            return $resp;
        }

        // Keep this endpoint public for browser callbacks, while recognizing
        // an optional bearer token for user-bound exchange validation.
        $user = $request->user() ?? Auth::guard('sanctum')->user();
        $result = PaymentStatusExchangeService::exchangeCode($code, $orderIdentifier, $user?->id);

        if (isset($result['error'])) {
            $this->auditLogService->log(
                $user,
                'payment_status.exchange_failed',
                'order',
                0,
                [
                    'identifier' => $orderIdentifier,
                    'error_code' => $result['error'],
                ],
                $request->ip(),
                $request->userAgent()
            );

            $resp = ApiResponseHelper::error($result['message'], $result['error'], $result['status'] ?? 403);
            $resp->headers->set('Referrer-Policy', 'no-referrer');
            return $resp;
        }

        $response = ApiResponseHelper::success([
            'token' => $result['token'],
            'order_id' => $result['order_id'],
            'order_number' => $result['order_number'],
            'expires_in' => $result['expires_in'],
        ], 'کد تبادل با موفقیت به توکن دسترسی تبدیل شد.');

        $response->headers->setCookie(
            cookie(
                'payment_status_token',
                $result['token'],
                5,
                '/',
                null,
                $request->isSecure(),
                true,
                false,
                'Lax'
            )
        );
        $response->headers->set('Referrer-Policy', 'no-referrer');

        return $response;
    }

    /**
     * Get verified server-side payment status for an order or payment identifier.
     * Enforces user ownership or short-lived signed status token.
     * Prevents order/payment ID enumeration and URL parameter spoofing.
     */
    public function show(Request $request, string $identifier): JsonResponse
    {
        $identifier = trim($identifier);
        if (empty($identifier)) {
            $resp = ApiResponseHelper::error('شناسه پرداخت یا شماره سفارش الزامی است.', 'MISSING_IDENTIFIER', 400);
            $resp->headers->set('Referrer-Policy', 'no-referrer');
            return $resp;
        }

        // 1. Locate Order & associated Payment
        $order = Order::where('order_number', $identifier)
            ->orWhere('id', is_numeric($identifier) ? (int) $identifier : 0)
            ->first();

        $payment = null;
        if ($order) {
            $payment = $order->payments()->latest()->first();
        } else {
            $payment = Payment::where('reference_id', $identifier)
                ->orWhere('gateway_payment_id', $identifier)
                ->orWhere('id', is_numeric($identifier) ? (int) $identifier : 0)
                ->first();

            if ($payment) {
                $order = $payment->order;
            }
        }

        if (!$order) {
            // Log security audit log on not found
            $this->auditLogService->log(
                $request->user(),
                'payment_status.unauthorized_lookup',
                'order',
                0,
                [
                    'identifier' => $identifier,
                    'reason' => 'not_found',
                ],
                $request->ip(),
                $request->userAgent()
            );

            $resp = ApiResponseHelper::error('اطلاعات سفارش یا پرداخت یافت نشد.', 'PAYMENT_NOT_FOUND', 404);
            $resp->headers->set('Referrer-Policy', 'no-referrer');
            return $resp;
        }

        // 2. Authorization check: Authenticated owner, Admin/Staff, OR valid signed status token
        $isAuthorized = false;
        // The route stays public for signed browser status tokens, but a
        // logged-in customer must also be recognized for ownership checks.
        $user = $request->user() ?? Auth::guard('sanctum')->user();

        if ($user) {
            if ($user->id === $order->user_id || $user->isAdmin() || $user->isStaff()) {
                $isAuthorized = true;
            }
        }

        // Token authorization: Strictly header or HttpOnly cookie (URL query token is forbidden)
        $token = $request->header('X-Payment-Status-Token') ?? $request->cookie('payment_status_token');
        if (!$isAuthorized && !empty($token) && is_string($token)) {
            $verifiedPayload = PaymentStatusTokenService::verifyToken($token, $order->id, $order->order_number);
            if ($verifiedPayload !== null) {
                $isAuthorized = true;
            }
        }

        // Support on-the-fly exchange via X-Payment-Exchange-Code header on the first status request
        $exchangeCodeHeader = $request->header('X-Payment-Exchange-Code');
        if (!$isAuthorized && !empty($exchangeCodeHeader) && is_string($exchangeCodeHeader)) {
            $exchangeResult = PaymentStatusExchangeService::exchangeCode($exchangeCodeHeader, $order->order_number, $user?->id);
            if (!isset($exchangeResult['error'])) {
                $isAuthorized = true;
            }
        }

        if (!$isAuthorized) {
            // Log unauthorized lookup attempt WITHOUT logging the token or code value
            $this->auditLogService->log(
                $user,
                'payment_status.unauthorized_lookup',
                'order',
                $order->id,
                [
                    'identifier' => $identifier,
                    'order_number' => $order->order_number,
                    'reason' => $user ? 'ownership_mismatch' : 'missing_or_invalid_status_token',
                ],
                $request->ip(),
                $request->userAgent()
            );

            $resp = ApiResponseHelper::error('دسترسی به وضعیت این پرداخت مجاز نمی‌باشد.', 'PAYMENT_STATUS_FORBIDDEN', 403);
            $resp->headers->set('Referrer-Policy', 'no-referrer');
            return $resp;
        }

        // 3. Map server payment status
        $rawPaymentStatus = $payment?->status ?? $order->payment_status;
        $displayStatus = match ($rawPaymentStatus) {
            Payment::STATUS_PAID => 'success',
            Payment::STATUS_CANCELLED => 'cancelled',
            Payment::STATUS_FAILED => 'failed',
            'payment_unknown' => 'unknown',
            default => 'pending',
        };

        $gateway = $payment?->gateway ?? 'zibal';
        $paymentMethod = match ($gateway) {
            'zibal' => 'پرداخت اینترنتی زیبال',
            'wallet' => 'کیف پول',
            'bank_transfer' => 'کارت به کارت / انتقال بانکی',
            default => 'درگاه پرداخت اینترنتی',
        };

        $response = ApiResponseHelper::success([
            'order_id' => $order->id,
            'order_number' => $order->order_number,
            'order_status' => $order->status,
            'payment_status' => $rawPaymentStatus,
            'status' => $displayStatus,
            'amount' => (int) ($payment?->amount ?? $order->grand_total),
            'currency' => $payment?->currency ?? $order->currency ?? 'IRT',
            'gateway' => $gateway,
            'payment_method' => $paymentMethod,
            'payment_id' => $payment?->id,
            'reference_id' => $payment?->reference_id,
            'gateway_payment_id' => $payment?->gateway_payment_id,
            'track_id' => $payment?->gateway_payment_id,
            'error_code' => is_array($payment?->gateway_response) ? ($payment->gateway_response['error'] ?? $payment->gateway_response['error_code'] ?? null) : null,
            'created_at' => $payment?->created_at?->toIso8601String() ?? $order->created_at?->toIso8601String(),
            'updated_at' => $payment?->updated_at?->toIso8601String() ?? $order->updated_at?->toIso8601String(),
        ], 'وضعیت پرداخت با موفقیت دریافت شد.');
        $response->headers->set('Referrer-Policy', 'no-referrer');

        return $response;
    }
}
