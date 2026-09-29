<?php

namespace App\Modules\Payments\Controllers;

use App\Modules\Admin\Services\AuditLogService;
use App\Modules\Payments\Models\Payment;
use App\Modules\Payments\Services\PaymentService;
use App\Modules\Payments\Services\PaymentStatusExchangeService;
use App\Modules\Payments\Services\PaymentStatusTokenService;
use App\Modules\Shared\Exceptions\DomainException;
use App\Modules\Shared\Exceptions\EntityNotFoundException;
use App\Modules\Shared\Helpers\ApiResponseHelper;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class PaymentWebhookController extends Controller
{
    public function __construct(
        private readonly PaymentService $paymentService,
        private readonly AuditLogService $auditLogService
    ) {
    }

    public function handle(Request $request, string $gateway): JsonResponse
    {
        $idempotencyKey = $request->header('X-Idempotency-Key') ?? $request->header('Stripe-Signature');

        $result = $this->paymentService->processWebhook(
            $gateway,
            $request->input(),
            $request->headers->all(),
            $idempotencyKey
        );

        return ApiResponseHelper::success($result, 'Webhook processed successfully.');
    }

    /**
     * Browser callback from Zibal. The payment status is not trusted until the server calls verify.
     */
    public function zibalCallback(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'trackId' => ['required', 'string', 'max:64', 'regex:/^\d+$/'],
            'success' => ['required', 'in:0,1'],
        ]);

        try {
            $result = $this->paymentService->completeZibalPayment(
                $validated['trackId'],
                $validated['success'] === '1'
            );

            $exchangeCode = PaymentStatusExchangeService::createExchangeCode(
                (int) $result['order_id'],
                (string) $result['order_number'],
                (int) $result['user_id']
            );

            return $this->redirectToPaymentStatus([
                'order' => $result['order_number'],
                'exchange_code' => $exchangeCode,
            ]);
        } catch (EntityNotFoundException) {
            return $this->redirectToPaymentStatus([
                'error' => 'PAYMENT_NOT_FOUND',
            ]);
        } catch (DomainException $exception) {
            return $this->redirectToPaymentStatus([
                'error' => $exception->getErrorCode(),
            ]);
        }
    }

    /**
     * Test simulation endpoint strictly guarded:
     * - Forbidden in production
     * - Requires authenticated admin/staff
     * - Requires explicit payments:simulate token ability
     * - Only operates on existing TestPaymentGateway payments (cannot simulate live payments)
     * - Full audit logging with redacted metadata
     */
    public function simulateTestPayment(Request $request): JsonResponse
    {
        // 1. Double check environment & database/gateway guard
        if ($this->isProductionEnvironment()) {
            return ApiResponseHelper::error('Test payment simulation is forbidden in production environment.', 'SIMULATION_FORBIDDEN_IN_PRODUCTION', 403);
        }

        // 2. Authentication & Authorization check: Admin/Staff with exact explicit ability
        $user = $request->user();
        if (!$user) {
            return ApiResponseHelper::error('Authentication required.', 'UNAUTHENTICATED', 401);
        }

        if (!$user->isAdmin() && !$user->isStaff()) {
            return ApiResponseHelper::error('Only administrative staff may execute payment simulations.', 'FORBIDDEN_ROLE', 403);
        }

        // Strictly check for exact 'payments:simulate' ability. Wildcard '*', admin role alone, or frontend flags CANNOT bypass this.
        $tokenAbilities = $user->currentAccessToken()?->abilities ?? [];
        if (!is_array($tokenAbilities) || !in_array('payments:simulate', $tokenAbilities, true)) {
            return ApiResponseHelper::error('Token lacks explicit payments:simulate ability.', 'FORBIDDEN_SIMULATION_ABILITY', 403);
        }

        // 3. Validate reference ONLY. Strictly ignore/reject arbitrary caller-supplied user IDs, amounts, order numbers, or statuses.
        $validated = $request->validate([
            'reference' => ['required', 'string', 'max:100'],
            'reason' => ['nullable', 'string', 'max:255'],
        ]);

        $reference = trim((string) ($request->input('reference') ?? $request->query('reference')));

        // 4. Require a valid existing payment record
        $payment = Payment::where('reference_id', $reference)
            ->orWhere('id', is_numeric($reference) ? (int) $reference : 0)
            ->first();

        if (!$payment) {
            return ApiResponseHelper::error("No payment found with reference: {$reference}", 'PAYMENT_NOT_FOUND', 404);
        }

        // 5. Ensure the payment uses TestPaymentGateway and cannot affect live gateways
        if ($payment->gateway !== 'test') {
            return ApiResponseHelper::error(
                "Simulation cannot be performed on '{$payment->gateway}' gateway payments. Only dedicated test gateway payments can be simulated.",
                'LIVE_PAYMENT_SIMULATION_FORBIDDEN',
                422
            );
        }

        // 6. Execute simulation via PaymentService using dedicated TestPaymentGateway with client or stable server idempotency key
        $clientKey = $request->header('X-Idempotency-Key') ?: $request->input('idempotency_key');
        $idempotencyKey = !empty($clientKey) ? trim((string) $clientKey) : "sim_stable_{$payment->reference_id}";
        $result = $this->paymentService->simulateTestPayment($payment, $idempotencyKey);

        // 7. Audit logging: actor, payment ID, environment, reason, timestamp
        $this->auditLogService->log(
            $user,
            'payment.simulated',
            'payment',
            $payment->id,
            [
                'payment_id' => $payment->id,
                'reference_id' => $payment->reference_id,
                'order_id' => $payment->order_id,
                'gateway' => $payment->gateway,
                'amount' => $payment->amount,
                'environment' => config('app.env', 'testing'),
                'reason' => $validated['reason'] ?? 'Staging / automated test simulation',
                'timestamp' => now()->toIso8601String(),
            ],
            $request->ip(),
            $request->userAgent()
        );

        return ApiResponseHelper::success($result, 'Test payment simulated as PAID.');
    }

    /**
     * Environment guard checking multiple layers (APP_ENV, database configuration, payment mode)
     */
    private function isProductionEnvironment(): bool
    {
        if (config('app.env') === 'production') {
            return true;
        }

        $defaultConnection = config('database.default', 'sqlite');
        $host = (string) config("database.connections.{$defaultConnection}.host", '');
        $database = (string) config("database.connections.{$defaultConnection}.database", '');

        if (str_contains(strtolower($host), 'prod') || str_contains(strtolower($database), 'prod')) {
            return true;
        }

        if (config('services.payment_mode') === 'production' || config('security.production_payment_locked', false)) {
            return true;
        }

        return false;
    }

    private function redirectToPaymentStatus(array $query): RedirectResponse
    {
        $response = redirect()->to(url('/payment-status').'?'.http_build_query(array_filter(
            $query,
            static fn ($value): bool => $value !== '' && $value !== null
        )));
        $response->headers->set('Referrer-Policy', 'no-referrer');

        return $response;
    }
}
