<?php

namespace Tests\Feature\Payments;

use App\Modules\Admin\Models\AuditLog;
use App\Modules\Orders\Models\Order;
use App\Modules\Payments\Models\Payment;
use App\Modules\Users\Models\User;
use Illuminate\Support\Facades\Config;
use Symfony\Component\Process\Process;
use Tests\TestCase;

class PaymentSimulationSecurityTest extends TestCase
{
    /**
     * Test A: In production, the simulation URL returns a true route-not-found/disabled response (404)
     * and the route is not listed in production bootstrapping.
     */
    public function test_a_simulation_endpoint_returns_404_in_production(): void
    {
        $process = new Process(
            ['php', 'artisan', 'route:list', '--except-vendor', '--path=payments/test'],
            base_path(),
            [
                'APP_ENV' => 'production',
                'APP_KEY' => (string) config('app.key'),
                'CORS_ALLOWED_ORIGINS_PRODUCTION' => 'https://apexstore.ir',
            ]
        );
        $process->run();

        $this->assertSame(0, $process->getExitCode(), $process->getErrorOutput());
        $this->assertStringNotContainsString('payments.test.simulate', $process->getOutput().$process->getErrorOutput());
    }

    /**
     * Test B: Unauthenticated and customer requests fail with 401/403 in staging.
     */
    public function test_b_unauthenticated_and_customer_requests_fail_in_staging(): void
    {
        Config::set('app.env', 'staging');

        // Unauthenticated request fails with 401
        $unauthResponse = $this->getJson('/api/v1/payments/test/simulate?reference=TEST-123');
        $unauthResponse->assertStatus(401);

        // Customer user fails with 403
        $customer = $this->createCustomer();
        $this->withToken($customer->createToken('simulation-customer', ['customer:access'])->plainTextToken);

        $customerResponse = $this->getJson('/api/v1/payments/test/simulate?reference=TEST-123');
        $customerResponse->assertStatus(403);
    }

    /**
     * Test C: Admin without the explicit simulation ability fails with 403.
     */
    public function test_c_admin_without_explicit_simulation_ability_fails(): void
    {
        Config::set('app.env', 'staging');

        $admin = $this->createAdmin();

        // Token with restricted abilities not containing payments:simulate
        $this->withToken($admin->createToken('simulation-admin', ['orders:view', 'products:manage'])->plainTextToken);

        $response = $this->getJson('/api/v1/payments/test/simulate?reference=TEST-123');
        $response->assertStatus(403);
        $response->assertJson([
            'success' => false,
            'error_code' => 'FORBIDDEN_SIMULATION_ABILITY',
        ]);
    }

    /**
     * Test: Admin with wildcard ability '*' only must be rejected with 403.
     * Wildcards cannot authorize sensitive financial simulation operations.
     */
    public function test_admin_with_wildcard_only_fails_with_403(): void
    {
        Config::set('app.env', 'staging');

        $admin = $this->createAdmin();

        // Token with wildcard ability '*' only - MUST be rejected with 403
        $this->withToken($admin->createToken('simulation-admin', ['*'])->plainTextToken);

        $response = $this->getJson('/api/v1/payments/test/simulate?reference=TEST-123');
        $response->assertStatus(403);
        $response->assertJson([
            'success' => false,
            'error_code' => 'FORBIDDEN_SIMULATION_ABILITY',
        ]);
    }

    /**
     * Test: Repeating the same simulation with the same idempotency key is idempotent.
     */
    public function test_repeating_same_simulation_with_same_idempotency_key_is_idempotent(): void
    {
        Config::set('app.env', 'staging');

        $admin = $this->createAdmin();
        $this->withToken($admin->createToken('simulation-admin', ['payments:simulate'])->plainTextToken);

        $order = $this->makePendingOrder();
        $payment = Payment::create([
            'order_id' => $order->id,
            'gateway' => 'test',
            'amount' => $order->grand_total,
            'currency' => 'IRR',
            'status' => Payment::STATUS_PENDING,
            'reference_id' => 'TEST-IDEMP-REF-789',
        ]);

        $idempotencyKey = 'idemp_key_test_789';

        // First simulation call
        $res1 = $this->postJson('/api/v1/payments/test/simulate', [
            'reference' => 'TEST-IDEMP-REF-789',
        ], ['X-Idempotency-Key' => $idempotencyKey]);
        $res1->assertStatus(200);

        // Second simulation call with identical idempotency key returns idempotent success
        $res2 = $this->postJson('/api/v1/payments/test/simulate', [
            'reference' => 'TEST-IDEMP-REF-789',
        ], ['X-Idempotency-Key' => $idempotencyKey]);
        $res2->assertStatus(200);
        $res2->assertJson([
            'success' => true,
        ]);
    }

    /**
     * Test D: Permitted staging request affects only an existing TestPaymentGateway payment.
     */
    public function test_d_permitted_request_simulates_test_gateway_payment_successfully(): void
    {
        Config::set('app.env', 'staging');

        $admin = $this->createAdmin();
        $this->withToken($admin->createToken('simulation-admin', ['payments:simulate'])->plainTextToken);

        $order = $this->makePendingOrder();
        $payment = Payment::create([
            'order_id' => $order->id,
            'gateway' => 'test',
            'amount' => $order->grand_total,
            'currency' => 'IRR',
            'status' => Payment::STATUS_PENDING,
            'reference_id' => 'TEST-VALID-REF-123',
        ]);

        $response = $this->postJson('/api/v1/payments/test/simulate', [
            'reference' => 'TEST-VALID-REF-123',
            'reason' => 'Integration test simulation',
        ]);

        $response->assertStatus(200);
        $response->assertJson([
            'success' => true,
            'data' => [
                'status' => 'success',
                'payment_status' => 'paid',
            ],
        ]);

        $payment->refresh();
        $order->refresh();
        $this->assertSame(Payment::STATUS_PAID, $payment->status);
        $this->assertSame(Order::STATUS_PAID, $order->status);
    }

    /**
     * Test E: A live gateway payment (Zibal, Stripe, PayPal) cannot be simulated.
     */
    public function test_e_live_gateway_payment_cannot_be_simulated(): void
    {
        Config::set('app.env', 'staging');

        $admin = $this->createAdmin();
        $this->withToken($admin->createToken('simulation-admin', ['payments:simulate'])->plainTextToken);

        $order = $this->makePendingOrder();
        $livePayment = Payment::create([
            'order_id' => $order->id,
            'gateway' => 'zibal',
            'amount' => $order->grand_total,
            'currency' => 'IRR',
            'status' => Payment::STATUS_PENDING,
            'reference_id' => 'ZIBAL-TRACK-999',
        ]);

        $response = $this->postJson('/api/v1/payments/test/simulate', [
            'reference' => 'ZIBAL-TRACK-999',
        ]);

        $response->assertStatus(422);
        $response->assertJson([
            'success' => false,
            'error_code' => 'LIVE_PAYMENT_SIMULATION_FORBIDDEN',
        ]);

        $livePayment->refresh();
        $this->assertSame(Payment::STATUS_PENDING, $livePayment->status);
    }

    /**
     * Test F: Every simulation is audit logged with actor, payment ID, environment, and reason.
     */
    public function test_f_every_simulation_is_audit_logged(): void
    {
        Config::set('app.env', 'staging');

        $admin = $this->createAdmin();
        $this->withToken($admin->createToken('simulation-admin', ['payments:simulate'])->plainTextToken);

        $order = $this->makePendingOrder();
        $payment = Payment::create([
            'order_id' => $order->id,
            'gateway' => 'test',
            'amount' => $order->grand_total,
            'currency' => 'IRR',
            'status' => Payment::STATUS_PENDING,
            'reference_id' => 'TEST-AUDIT-REF-456',
        ]);

        $this->postJson('/api/v1/payments/test/simulate', [
            'reference' => 'TEST-AUDIT-REF-456',
            'reason' => 'Security audit verification run',
        ])->assertStatus(200);

        $log = AuditLog::where('action', 'payment.simulated')
            ->where('entity_id', $payment->id)
            ->latest('id')
            ->first();

        $this->assertNotNull($log, 'Audit log entry must be created for simulation.');
        $this->assertSame($admin->id, $log->user_id);
        $this->assertSame('payment', $log->entity_type);
        $this->assertIsArray($log->redacted_metadata);
        $this->assertSame('TEST-AUDIT-REF-456', $log->redacted_metadata['reference_id'] ?? null);
        $this->assertSame('test', $log->redacted_metadata['gateway'] ?? null);
        $this->assertSame('Security audit verification run', $log->redacted_metadata['reason'] ?? null);
    }

    private function makePendingOrder(): Order
    {
        $user = $this->createCustomer();

        return Order::create([
            'order_number' => 'ORD-SIM-'.time().'-'.rand(100, 999),
            'user_id' => $user->id,
            'status' => Order::STATUS_PENDING,
            'payment_status' => Payment::STATUS_PENDING,
            'subtotal' => 1000000,
            'discount_amount' => 0,
            'shipping_amount' => 50000,
            'tax_amount' => 90000,
            'grand_total' => 1140000,
            'currency' => 'IRR',
            'shipping_address_snapshot' => ['full_name' => 'تست', 'address' => 'تهران', 'city' => 'تهران', 'province' => 'تهران', 'postal_code' => '1234567890', 'phone' => '09120000000'],
            'billing_address_snapshot' => ['full_name' => 'تست', 'address' => 'تهران', 'city' => 'تهران', 'province' => 'تهران', 'postal_code' => '1234567890', 'phone' => '09120000000'],
        ]);
    }
}
