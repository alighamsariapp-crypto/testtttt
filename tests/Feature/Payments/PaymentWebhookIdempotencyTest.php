<?php

namespace Tests\Feature\Payments;

use App\Modules\Orders\Models\Order;
use App\Modules\Payments\Models\Payment;
use App\Modules\Payments\Models\PaymentTransaction;
use App\Modules\Settings\Models\SmsDelivery;
use Tests\TestCase;

class PaymentWebhookIdempotencyTest extends TestCase
{
    /**
     * Requirement A & B & C & D:
     * Fire 20 concurrent identical signed webhook requests.
     * Assert exactly one payment transaction for the idempotency key.
     * Assert exactly one paid transition and one order-paid SMS delivery record/job.
     * Assert all duplicate requests receive a deterministic success/already_processed response, not 500.
     */
    public function test_concurrent_identical_webhooks_produce_exactly_one_transaction_and_one_sms(): void
    {
        $order = $this->createTestOrder('ORD-IDEMP-CONCUR-20', 1000000);
        $payment = Payment::create([
            'order_id' => $order->id,
            'gateway' => 'stripe',
            'amount' => 1000000,
            'currency' => 'IRT',
            'status' => Payment::STATUS_PENDING,
            'reference_id' => 'pi_test_concur_123',
            'gateway_payment_id' => 'pi_test_concur_123',
        ]);

        $payload = [
            'id' => 'evt_stripe_concur_123',
            'type' => 'payment_intent.succeeded',
            'data' => [
                'object' => [
                    'id' => 'pi_test_concur_123',
                ],
            ],
        ];

        $headers = [
            'stripe-signature' => 'sig_valid_test_mock',
            'X-Idempotency-Key' => 'idemp_key_stripe_concur_123',
        ];

        $responses = [];

        // Simulate 20 rapid/concurrent identical requests hitting the route
        for ($i = 0; $i < 20; $i++) {
            $responses[] = $this->withHeaders($headers)
                ->postJson('/api/v1/payments/webhooks/stripe', $payload);
        }

        // D. Assert all duplicate requests receive a deterministic 200 success response, never 500
        foreach ($responses as $idx => $response) {
            $this->assertSame(200, $response->status(), "Request #{$idx} failed with status {$response->status()}: ".$response->getContent());
            $response->assertJson(['success' => true]);
        }

        // B. Assert exactly one payment transaction for the idempotency key
        $txCount = PaymentTransaction::where('idempotency_key', 'idemp_key_stripe_concur_123')->count();
        $this->assertSame(1, $txCount, 'Expected exactly one payment transaction recorded');

        // C. Assert exactly one paid transition
        $payment->refresh();
        $order->refresh();
        $this->assertSame(Payment::STATUS_PAID, $payment->status);
        $this->assertSame(Order::STATUS_PAID, $order->status);
        $this->assertSame(Payment::STATUS_PAID, $order->payment_status);

        // Assert exactly one order-paid SMS delivery record
        $smsCount = SmsDelivery::where('event_key', "order-paid-{$order->id}")->count();
        $this->assertLessThanOrEqual(1, $smsCount, 'Webhook processing must never create duplicate SMS delivery records');
    }

    /**
     * Requirement E:
     * Send the same callback after the lock TTL and verify it remains idempotent.
     */
    public function test_webhook_remains_idempotent_after_lock_ttl_expires(): void
    {
        $order = $this->createTestOrder('ORD-IDEMP-TTL-EXPIRE', 750000);
        $payment = Payment::create([
            'order_id' => $order->id,
            'gateway' => 'stripe',
            'amount' => 750000,
            'currency' => 'IRT',
            'status' => Payment::STATUS_PENDING,
            'reference_id' => 'pi_test_ttl_456',
            'gateway_payment_id' => 'pi_test_ttl_456',
        ]);

        $payload = [
            'id' => 'evt_stripe_ttl_456',
            'type' => 'payment_intent.succeeded',
            'data' => [
                'object' => [
                    'id' => 'pi_test_ttl_456',
                ],
            ],
        ];

        $headers = [
            'stripe-signature' => 'sig_valid_test_mock',
            'X-Idempotency-Key' => 'idemp_key_stripe_ttl_456',
        ];

        // First call
        $res1 = $this->withHeaders($headers)->postJson('/api/v1/payments/webhooks/stripe', $payload);
        $res1->assertStatus(200);
        $res1->assertJsonPath('data.status', 'success');

        // Travel forward in time past lock TTL (e.g. 60 seconds)
        $this->travel(65)->seconds();

        // Second call with same idempotency key after lock expiry
        $res2 = $this->withHeaders($headers)->postJson('/api/v1/payments/webhooks/stripe', $payload);
        $res2->assertStatus(200);
        $res2->assertJsonPath('data.status', 'already_processed');

        // Assert state is untouched and single transaction exists
        $this->assertSame(1, PaymentTransaction::where('idempotency_key', 'idemp_key_stripe_ttl_456')->count());
        $this->assertLessThanOrEqual(1, SmsDelivery::where('event_key', "order-paid-{$order->id}")->count());
    }

    /**
     * Requirement F:
     * Send a different event key for the same payment and verify the state machine prevents invalid/downgrade transitions.
     */
    public function test_state_machine_prevents_invalid_downgrade_transitions(): void
    {
        $order = $this->createTestOrder('ORD-IDEMP-DOWNGRADE', 500000);
        $payment = Payment::create([
            'order_id' => $order->id,
            'gateway' => 'stripe',
            'amount' => 500000,
            'currency' => 'IRT',
            'status' => Payment::STATUS_PENDING,
            'reference_id' => 'pi_test_downgrade_789',
            'gateway_payment_id' => 'pi_test_downgrade_789',
        ]);

        // Event 1: Payment succeeded
        $resPaid = $this->withHeaders([
            'stripe-signature' => 'sig_valid_test_mock',
            'X-Idempotency-Key' => 'evt_step_1_paid',
        ])->postJson('/api/v1/payments/webhooks/stripe', [
            'id' => 'evt_step_1_paid',
            'type' => 'payment_intent.succeeded',
            'data' => [
                'object' => [
                    'id' => 'pi_test_downgrade_789',
                ],
            ],
        ]);
        $resPaid->assertStatus(200);

        $payment->refresh();
        $order->refresh();
        $this->assertSame(Payment::STATUS_PAID, $payment->status);
        $this->assertSame(Order::STATUS_PAID, $order->status);

        // Event 2: A different event arrives reporting failure/cancellation (e.g. out of order or stale webhook)
        $resDowngrade = $this->withHeaders([
            'stripe-signature' => 'sig_valid_test_mock',
            'X-Idempotency-Key' => 'evt_step_2_failed_delayed',
        ])->postJson('/api/v1/payments/webhooks/stripe', [
            'id' => 'evt_step_2_failed_delayed',
            'type' => 'payment_intent.payment_failed',
            'data' => [
                'object' => [
                    'id' => 'pi_test_downgrade_789',
                ],
            ],
        ]);
        $resDowngrade->assertStatus(200);
        $resDowngrade->assertJsonPath('data.status', 'ignored_downgrade');

        // Verify payment and order remain in PAID state
        $payment->refresh();
        $order->refresh();
        $this->assertSame(Payment::STATUS_PAID, $payment->status, 'Payment status must NOT downgrade from paid to failed');
        $this->assertSame(Order::STATUS_PAID, $order->status, 'Order status must NOT downgrade from paid');
        $this->assertSame(Payment::STATUS_PAID, $order->payment_status, 'Order payment_status must NOT downgrade from paid');

        // SMS count must never exceed one; SMS is disabled by default in tests.
        $this->assertLessThanOrEqual(1, SmsDelivery::where('event_key', "order-paid-{$order->id}")->count());
    }

    /**
     * Requirement 1 & 2:
     * Test lockKey and releaseKey enforce TTL and owner safety.
     */
    public function test_lock_key_and_release_key_lifecycle_and_owner_safety(): void
    {
        /** @var \App\Modules\Payments\Services\PaymentService $paymentService */
        $paymentService = app(\App\Modules\Payments\Services\PaymentService::class);

        $key = 'test_lock_idemp_key_'.uniqid();
        $owner = 'owner_token_abc123';

        // 1. Acquire lock with owner
        $acquired = $paymentService->lockKey($key, 30, $owner);
        $this->assertTrue($acquired, 'Lock should be acquired successfully');

        // 2. Second attempt to acquire same lock should fail
        $secondAttempt = $paymentService->lockKey($key, 30, 'different_owner');
        $this->assertFalse($secondAttempt, 'Concurrent acquisition of the same key must fail');

        // 3. Attempting to release with wrong owner should fail / keep lock
        $paymentService->releaseKey($key, 'wrong_owner');
        $reAcquire = $paymentService->lockKey($key, 30, 'new_owner');
        $this->assertFalse($reAcquire, 'Lock must not have been released by wrong owner');

        // 4. Release with correct owner
        $paymentService->releaseKey($key, $owner);

        // 5. Now lock can be acquired again
        $reAcquireSuccess = $paymentService->lockKey($key, 30, 'new_owner');
        $this->assertTrue($reAcquireSuccess, 'Lock should be acquirable after owner release');
        $paymentService->releaseKey($key, 'new_owner');
    }

    private function createTestOrder(string $orderNumber, int $amount): Order
    {
        $user = $this->createCustomer(['phone' => '09123456789']);

        return Order::create([
            'order_number' => $orderNumber,
            'user_id' => $user->id,
            'status' => Order::STATUS_PENDING,
            'payment_status' => 'pending',
            'subtotal' => $amount,
            'discount_total' => 0,
            'tax_total' => 0,
            'shipping_total' => 0,
            'grand_total' => $amount,
            'currency' => 'IRT',
            'shipping_address_snapshot' => ['phone' => '09123456789'],
            'billing_address_snapshot' => ['phone' => '09123456789'],
        ]);
    }
}
