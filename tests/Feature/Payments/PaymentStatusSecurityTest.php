<?php

namespace Tests\Feature\Payments;

use App\Modules\Orders\Models\Order;
use App\Modules\Payments\Models\Payment;
use App\Modules\Payments\Models\PaymentStatusExchange;
use App\Modules\Payments\Services\PaymentStatusExchangeService;
use App\Modules\Payments\Services\PaymentStatusTokenService;
use Tests\TestCase;

class PaymentStatusSecurityTest extends TestCase
{
    public function test_authenticated_user_can_view_their_own_payment_status(): void
    {
        $user = $this->createCustomer();
        $order = Order::create([
            'order_number' => 'ORD-OWNER-TEST-1',
            'user_id' => $user->id,
            'status' => 'processing',
            'payment_status' => 'paid',
            'subtotal' => 500000,
            'discount_total' => 0,
            'tax_total' => 0,
            'shipping_total' => 0,
            'grand_total' => 500000,
            'currency' => 'IRT',
            'shipping_address_snapshot' => ['phone' => '09121111111'],
            'billing_address_snapshot' => ['phone' => '09121111111'],
        ]);

        Payment::create([
            'order_id' => $order->id,
            'gateway' => 'zibal',
            'amount' => 500000,
            'currency' => 'IRT',
            'status' => 'paid',
            'reference_id' => 'REF-OWNER-123',
            'gateway_payment_id' => 'TRACK-OWNER-123',
        ]);

        $response = $this->withHeaders([
            'Authorization' => 'Bearer '.$this->createTokenForUser($user),
        ])->getJson('/api/v1/payments/status/ORD-OWNER-TEST-1');

        $response->assertStatus(200);
        $response->assertJson([
            'success' => true,
            'data' => [
                'order_number' => 'ORD-OWNER-TEST-1',
                'amount' => 500000,
                'status' => 'success',
                'payment_status' => 'paid',
            ],
        ]);
    }

    public function test_user_cannot_view_another_users_payment_status(): void
    {
        $alice = $this->createCustomer(['email' => 'alice.secure@example.com']);
        $bob = $this->createCustomer(['email' => 'bob.secure@example.com']);

        $aliceOrder = Order::create([
            'order_number' => 'ORD-ALICE-SECURE',
            'user_id' => $alice->id,
            'status' => 'processing',
            'payment_status' => 'paid',
            'subtotal' => 300000,
            'discount_total' => 0,
            'tax_total' => 0,
            'shipping_total' => 0,
            'grand_total' => 300000,
            'currency' => 'IRT',
            'shipping_address_snapshot' => ['phone' => '09122222222'],
            'billing_address_snapshot' => ['phone' => '09122222222'],
        ]);

        Payment::create([
            'order_id' => $aliceOrder->id,
            'gateway' => 'zibal',
            'amount' => 300000,
            'currency' => 'IRT',
            'status' => 'paid',
            'reference_id' => 'REF-ALICE-SECURE',
        ]);

        // Bob attempts to query Alice's order
        $response = $this->withHeaders([
            'Authorization' => 'Bearer '.$this->createTokenForUser($bob),
        ])->getJson('/api/v1/payments/status/ORD-ALICE-SECURE');

        $response->assertStatus(403);
    }

    public function test_valid_signed_status_token_allows_unauthenticated_status_lookup(): void
    {
        $user = $this->createCustomer();
        $order = Order::create([
            'order_number' => 'ORD-TOKEN-TEST',
            'user_id' => $user->id,
            'status' => 'processing',
            'payment_status' => 'paid',
            'subtotal' => 450000,
            'discount_total' => 0,
            'tax_total' => 0,
            'shipping_total' => 0,
            'grand_total' => 450000,
            'currency' => 'IRT',
            'shipping_address_snapshot' => ['phone' => '09123333333'],
            'billing_address_snapshot' => ['phone' => '09123333333'],
        ]);

        Payment::create([
            'order_id' => $order->id,
            'gateway' => 'zibal',
            'amount' => 450000,
            'currency' => 'IRT',
            'status' => 'paid',
            'reference_id' => 'REF-TOKEN-TEST',
        ]);

        $token = PaymentStatusTokenService::generateToken($order->id, $order->order_number, $user->id);

        // Security requirement: Header X-Payment-Status-Token MUST authorize status lookup
        $response = $this->withHeaders([
            'X-Payment-Status-Token' => $token,
        ])->getJson("/api/v1/payments/status/{$order->order_number}");

        $response->assertStatus(200);
        $response->assertHeader('Referrer-Policy', 'no-referrer');
        $response->assertJson([
            'success' => true,
            'data' => [
                'order_number' => 'ORD-TOKEN-TEST',
                'amount' => 450000,
                'status' => 'success',
            ],
        ]);

        // Security requirement: Token in URL query string MUST NOT be accepted
        $queryResponse = $this->flushHeaders()->getJson("/api/v1/payments/status/{$order->order_number}?token={$token}");
        $queryResponse->assertStatus(403);
    }

    public function test_one_time_exchange_code_succeeds_once_and_fails_on_replay(): void
    {
        $user = $this->createCustomer();
        $order = Order::create([
            'order_number' => 'ORD-EXCHANGE-TEST',
            'user_id' => $user->id,
            'status' => 'processing',
            'payment_status' => 'paid',
            'subtotal' => 300000,
            'discount_total' => 0,
            'tax_total' => 0,
            'shipping_total' => 0,
            'grand_total' => 300000,
            'currency' => 'IRT',
            'shipping_address_snapshot' => ['phone' => '09123333334'],
            'billing_address_snapshot' => ['phone' => '09123333334'],
        ]);

        $code = PaymentStatusExchangeService::createExchangeCode($order->id, $order->order_number, $user->id);
        $this->assertNotEmpty($code);

        // First exchange must succeed
        $response1 = $this->postJson('/api/v1/payments/status/exchange', [
            'order' => $order->order_number,
            'code' => $code,
        ]);

        $response1->assertStatus(200);
        $response1->assertHeader('Referrer-Policy', 'no-referrer');
        $token = $response1->json('data.token');
        $this->assertNotEmpty($token);

        // Second exchange with same code MUST fail (replay attack blocked)
        $response2 = $this->postJson('/api/v1/payments/status/exchange', [
            'order' => $order->order_number,
            'code' => $code,
        ]);

        $response2->assertStatus(403);
        $response2->assertJson([
            'error_code' => 'EXCHANGE_CODE_ALREADY_USED',
        ]);
    }

    public function test_exchange_code_cannot_be_used_for_another_order_or_user(): void
    {
        $alice = $this->createCustomer(['email' => 'alice.exchange@example.com']);
        $bob = $this->createCustomer(['email' => 'bob.exchange@example.com']);

        $aliceOrder = Order::create([
            'order_number' => 'ORD-ALICE-EXCH',
            'user_id' => $alice->id,
            'status' => 'processing',
            'payment_status' => 'paid',
            'subtotal' => 150000,
            'discount_total' => 0,
            'tax_total' => 0,
            'shipping_total' => 0,
            'grand_total' => 150000,
            'currency' => 'IRT',
            'shipping_address_snapshot' => ['phone' => '09123333335'],
            'billing_address_snapshot' => ['phone' => '09123333335'],
        ]);

        $bobOrder = Order::create([
            'order_number' => 'ORD-BOB-EXCH',
            'user_id' => $bob->id,
            'status' => 'processing',
            'payment_status' => 'paid',
            'subtotal' => 200000,
            'discount_total' => 0,
            'tax_total' => 0,
            'shipping_total' => 0,
            'grand_total' => 200000,
            'currency' => 'IRT',
            'shipping_address_snapshot' => ['phone' => '09123333336'],
            'billing_address_snapshot' => ['phone' => '09123333336'],
        ]);

        $aliceCode = PaymentStatusExchangeService::createExchangeCode($aliceOrder->id, $aliceOrder->order_number, $alice->id);

        // Attempt to exchange Alice's code for Bob's order => must fail
        $orderMismatchRes = $this->postJson('/api/v1/payments/status/exchange', [
            'order' => $bobOrder->order_number,
            'code' => $aliceCode,
        ]);
        $orderMismatchRes->assertStatus(403);
        $orderMismatchRes->assertJson(['error_code' => 'EXCHANGE_CODE_ORDER_MISMATCH']);

        // Bob authenticated attempts to exchange Alice's code => must fail
        $userMismatchRes = $this->withHeaders([
            'Authorization' => 'Bearer '.$this->createTokenForUser($bob),
        ])->postJson('/api/v1/payments/status/exchange', [
            'order' => $aliceOrder->order_number,
            'code' => $aliceCode,
        ]);
        $userMismatchRes->assertStatus(403);
        $userMismatchRes->assertJson(['error_code' => 'EXCHANGE_CODE_USER_MISMATCH']);
    }

    public function test_forged_or_expired_exchange_code_is_rejected(): void
    {
        $user = $this->createCustomer();
        $order = Order::create([
            'order_number' => 'ORD-EXPIRED-TEST',
            'user_id' => $user->id,
            'status' => 'processing',
            'payment_status' => 'paid',
            'subtotal' => 100000,
            'discount_total' => 0,
            'tax_total' => 0,
            'shipping_total' => 0,
            'grand_total' => 100000,
            'currency' => 'IRT',
            'shipping_address_snapshot' => ['phone' => '09123333337'],
            'billing_address_snapshot' => ['phone' => '09123333337'],
        ]);

        // Forged code
        $forgedRes = $this->postJson('/api/v1/payments/status/exchange', [
            'order' => $order->order_number,
            'code' => 'forged_fake_exchange_code_12345',
        ]);
        $forgedRes->assertStatus(401);

        // Expired code (TTL = -10 seconds)
        $expiredCode = PaymentStatusExchangeService::createExchangeCode($order->id, $order->order_number, $user->id, -10);
        $expiredRes = $this->postJson('/api/v1/payments/status/exchange', [
            'order' => $order->order_number,
            'code' => $expiredCode,
        ]);
        $expiredRes->assertStatus(403);
        $expiredRes->assertJson(['error_code' => 'EXCHANGE_CODE_EXPIRED']);
    }

    public function test_query_parameter_spoofing_does_not_change_server_truth(): void
    {
        $user = $this->createCustomer();
        $order = Order::create([
            'order_number' => 'ORD-SPOOF-TEST',
            'user_id' => $user->id,
            'status' => 'processing',
            'payment_status' => 'paid',
            'subtotal' => 100000,
            'discount_total' => 0,
            'tax_total' => 0,
            'shipping_total' => 0,
            'grand_total' => 100000,
            'currency' => 'IRT',
            'shipping_address_snapshot' => ['phone' => '09124444444'],
            'billing_address_snapshot' => ['phone' => '09124444444'],
        ]);

        Payment::create([
            'order_id' => $order->id,
            'gateway' => 'zibal',
            'amount' => 100000,
            'currency' => 'IRT',
            'status' => 'paid',
            'reference_id' => 'REF-SPOOF-TEST',
        ]);

        $token = PaymentStatusTokenService::generateToken($order->id, $order->order_number, $user->id);

        // Attacker passes status=failed and amount=99999999 via query
        $response = $this->withHeaders([
            'X-Payment-Status-Token' => $token,
        ])->getJson("/api/v1/payments/status/{$order->order_number}?status=failed&amount=99999999");

        $response->assertStatus(200);
        $response->assertJson([
            'success' => true,
            'data' => [
                'order_number' => 'ORD-SPOOF-TEST',
                'amount' => 100000,
                'status' => 'success',
            ],
        ]);
    }

    public function test_pending_payment_is_derived_as_pending_not_paid(): void
    {
        $user = $this->createCustomer();
        $order = Order::create([
            'order_number' => 'ORD-PENDING-DERIVE',
            'user_id' => $user->id,
            'status' => 'pending',
            'payment_status' => 'pending',
            'subtotal' => 200000,
            'discount_total' => 0,
            'tax_total' => 0,
            'shipping_total' => 0,
            'grand_total' => 200000,
            'currency' => 'IRT',
            'shipping_address_snapshot' => ['phone' => '09125555555'],
            'billing_address_snapshot' => ['phone' => '09125555555'],
        ]);

        Payment::create([
            'order_id' => $order->id,
            'gateway' => 'zibal',
            'amount' => 200000,
            'currency' => 'IRT',
            'status' => 'pending',
        ]);

        $token = PaymentStatusTokenService::generateToken($order->id, $order->order_number, $user->id);

        // Attacker passes status=success
        $response = $this->withHeaders([
            'X-Payment-Status-Token' => $token,
        ])->getJson("/api/v1/payments/status/{$order->order_number}?status=success");

        $response->assertStatus(200);
        $response->assertJson([
            'success' => true,
            'data' => [
                'order_number' => 'ORD-PENDING-DERIVE',
                'status' => 'pending',
                'payment_status' => 'pending',
            ],
        ]);
    }

    public function test_payment_status_can_be_looked_up_by_payment_id(): void
    {
        $user = $this->createCustomer();
        $order = Order::create([
            'order_number' => 'ORD-LOOKUP-PAYID',
            'user_id' => $user->id,
            'status' => 'processing',
            'payment_status' => 'paid',
            'subtotal' => 600000,
            'discount_total' => 0,
            'tax_total' => 0,
            'shipping_total' => 0,
            'grand_total' => 600000,
            'currency' => 'IRT',
            'shipping_address_snapshot' => ['phone' => '09126666666'],
            'billing_address_snapshot' => ['phone' => '09126666666'],
        ]);

        $payment = Payment::create([
            'order_id' => $order->id,
            'gateway' => 'zibal',
            'amount' => 600000,
            'currency' => 'IRT',
            'status' => 'paid',
            'reference_id' => 'REF-LOOKUP-PAYID',
            'gateway_payment_id' => 'TRACK-LOOKUP-PAYID',
        ]);

        $response = $this->withHeaders([
            'Authorization' => 'Bearer '.$this->createTokenForUser($user),
        ])->getJson("/api/v1/payments/status/{$payment->id}");

        $response->assertStatus(200);
        $response->assertJson([
            'success' => true,
            'data' => [
                'order_number' => 'ORD-LOOKUP-PAYID',
                'payment_id' => $payment->id,
                'reference_id' => 'REF-LOOKUP-PAYID',
                'gateway_payment_id' => 'TRACK-LOOKUP-PAYID',
                'amount' => 600000,
                'status' => 'success',
            ],
        ]);
    }

    public function test_payment_status_can_be_looked_up_by_reference_id(): void
    {
        $user = $this->createCustomer();
        $order = Order::create([
            'order_number' => 'ORD-LOOKUP-REFID',
            'user_id' => $user->id,
            'status' => 'processing',
            'payment_status' => 'paid',
            'subtotal' => 750000,
            'discount_total' => 0,
            'tax_total' => 0,
            'shipping_total' => 0,
            'grand_total' => 750000,
            'currency' => 'IRT',
            'shipping_address_snapshot' => ['phone' => '09127777777'],
            'billing_address_snapshot' => ['phone' => '09127777777'],
        ]);

        $payment = Payment::create([
            'order_id' => $order->id,
            'gateway' => 'zibal',
            'amount' => 750000,
            'currency' => 'IRT',
            'status' => 'paid',
            'reference_id' => 'REF-LOOKUP-REF-UNIQUE-999',
            'gateway_payment_id' => 'TRACK-LOOKUP-REF-UNIQUE-999',
        ]);

        $response = $this->withHeaders([
            'Authorization' => 'Bearer '.$this->createTokenForUser($user),
        ])->getJson('/api/v1/payments/status/REF-LOOKUP-REF-UNIQUE-999');

        $response->assertStatus(200);
        $response->assertJson([
            'success' => true,
            'data' => [
                'order_number' => 'ORD-LOOKUP-REFID',
                'payment_id' => $payment->id,
                'reference_id' => 'REF-LOOKUP-REF-UNIQUE-999',
                'gateway_payment_id' => 'TRACK-LOOKUP-REF-UNIQUE-999',
                'amount' => 750000,
                'status' => 'success',
            ],
        ]);
    }

    public function test_payment_status_can_be_looked_up_by_gateway_payment_id(): void
    {
        $user = $this->createCustomer();
        $order = Order::create([
            'order_number' => 'ORD-LOOKUP-TRACKID',
            'user_id' => $user->id,
            'status' => 'processing',
            'payment_status' => 'paid',
            'subtotal' => 880000,
            'discount_total' => 0,
            'tax_total' => 0,
            'shipping_total' => 0,
            'grand_total' => 880000,
            'currency' => 'IRT',
            'shipping_address_snapshot' => ['phone' => '09128888888'],
            'billing_address_snapshot' => ['phone' => '09128888888'],
        ]);

        $payment = Payment::create([
            'order_id' => $order->id,
            'gateway' => 'zibal',
            'amount' => 880000,
            'currency' => 'IRT',
            'status' => 'paid',
            'reference_id' => 'REF-LOOKUP-TRACK-INTERNAL',
            'gateway_payment_id' => 'ZIBAL-TRACK-UNIQUE-55555',
        ]);

        $response = $this->withHeaders([
            'Authorization' => 'Bearer '.$this->createTokenForUser($user),
        ])->getJson('/api/v1/payments/status/ZIBAL-TRACK-UNIQUE-55555');

        $response->assertStatus(200);
        $response->assertJson([
            'success' => true,
            'data' => [
                'order_number' => 'ORD-LOOKUP-TRACKID',
                'payment_id' => $payment->id,
                'reference_id' => 'REF-LOOKUP-TRACK-INTERNAL',
                'gateway_payment_id' => 'ZIBAL-TRACK-UNIQUE-55555',
                'track_id' => 'ZIBAL-TRACK-UNIQUE-55555',
                'amount' => 880000,
                'status' => 'success',
            ],
        ]);
    }

    public function test_gateway_payment_id_lookup_rejects_unauthorized_user(): void
    {
        $alice = $this->createCustomer(['email' => 'alice.track@example.com']);
        $bob = $this->createCustomer(['email' => 'bob.track@example.com']);

        $aliceOrder = Order::create([
            'order_number' => 'ORD-ALICE-TRACK',
            'user_id' => $alice->id,
            'status' => 'processing',
            'payment_status' => 'paid',
            'subtotal' => 250000,
            'discount_total' => 0,
            'tax_total' => 0,
            'shipping_total' => 0,
            'grand_total' => 250000,
            'currency' => 'IRT',
            'shipping_address_snapshot' => ['phone' => '09129999999'],
            'billing_address_snapshot' => ['phone' => '09129999999'],
        ]);

        Payment::create([
            'order_id' => $aliceOrder->id,
            'gateway' => 'zibal',
            'amount' => 250000,
            'currency' => 'IRT',
            'status' => 'paid',
            'reference_id' => 'REF-ALICE-TRACK-ID',
            'gateway_payment_id' => 'TRACK-ALICE-SECRET-777',
        ]);

        // Bob attempts to query Alice's payment via gateway_payment_id
        $response = $this->withHeaders([
            'Authorization' => 'Bearer '.$this->createTokenForUser($bob),
        ])->getJson('/api/v1/payments/status/TRACK-ALICE-SECRET-777');

        $response->assertStatus(403);
    }

    public function test_missing_app_key_in_production_fails_config_validation(): void
    {
        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('[SECURITY FATAL] APP_KEY is missing or empty in production');

        \App\Modules\Shared\Security\SecurityConfigValidator::validateAppKey('', 'production');
    }

    public function test_placeholder_app_key_fails_validation(): void
    {
        $placeholders = [
            'apexstore-fallback',
            'base64:CHANGEME',
            'SomeRandomString',
            'YOUR_APP_KEY',
        ];

        foreach ($placeholders as $placeholder) {
            try {
                \App\Modules\Shared\Security\SecurityConfigValidator::validateAppKey($placeholder, 'production');
                $this->fail("Expected RuntimeException for placeholder: {$placeholder}");
            } catch (\RuntimeException $e) {
                $this->assertStringContainsString('[SECURITY FATAL] APP_KEY contains an insecure placeholder', $e->getMessage());
            }
        }
    }

    public function test_malformed_or_short_app_key_fails_validation(): void
    {
        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('[SECURITY FATAL] APP_KEY is too short');

        \App\Modules\Shared\Security\SecurityConfigValidator::validateAppKey('short-key-value', 'production');
    }

    public function test_valid_app_key_token_generation_and_verification_succeed(): void
    {
        config(['app.key' => 'base64:zP7F+6U556w3Fp6x856vT6l6L9k5z5f6G7h8j9k0l1m=']);

        $token = PaymentStatusTokenService::generateToken(101, 'ORD-101', 5);
        $this->assertNotEmpty($token);

        $payload = PaymentStatusTokenService::verifyToken($token, 101, 'ORD-101');
        $this->assertNotNull($payload);
        $this->assertSame(101, $payload['order_id']);
        $this->assertSame('ORD-101', $payload['order_number']);
        $this->assertSame(5, $payload['user_id']);
        $this->assertSame('payment_status', $payload['purpose']);
    }

    public function test_modified_payload_or_signature_fails_verification(): void
    {
        config(['app.key' => 'base64:zP7F+6U556w3Fp6x856vT6l6L9k5z5f6G7h8j9k0l1m=']);

        $token = PaymentStatusTokenService::generateToken(102, 'ORD-102', 5);
        [$b64, $sig] = explode('.', $token);

        // Tamper signature
        $tamperedSig = substr($sig, 0, -4).'0000';
        $this->assertNull(PaymentStatusTokenService::verifyToken("{$b64}.{$tamperedSig}", 102, 'ORD-102'));

        // Tamper payload
        $tamperedB64 = base64_encode(json_encode(['order_id' => 999, 'order_number' => 'ORD-999', 'user_id' => 5, 'purpose' => 'payment_status', 'exp' => time() + 1800]));
        $this->assertNull(PaymentStatusTokenService::verifyToken("{$tamperedB64}.{$sig}", 102, 'ORD-102'));
    }

    public function test_expired_token_fails_verification(): void
    {
        config(['app.key' => 'base64:zP7F+6U556w3Fp6x856vT6l6L9k5z5f6G7h8j9k0l1m=']);

        // Generate token with negative TTL
        $token = PaymentStatusTokenService::generateToken(103, 'ORD-103', 5, -10);
        $this->assertNull(PaymentStatusTokenService::verifyToken($token, 103, 'ORD-103'));
    }

    public function test_token_verification_supports_key_rotation(): void
    {
        $oldKey = 'base64:zP7F+6U556w3Fp6x856vT6l6L9k5z5f6G7h8j9k0l1m=';
        $newKey = 'base64:dGVzdG5ld2tleWZvcmFwcHNlY3VyaXR5MTIzNDU2Nzg5MDEy';

        // Sign token with old key
        config(['app.key' => $oldKey, 'app.previous_keys' => []]);
        $token = PaymentStatusTokenService::generateToken(104, 'ORD-104', 5);

        // Rotate to new key with old key in previous_keys
        config(['app.key' => $newKey, 'app.previous_keys' => [$oldKey]]);

        // Verification must succeed via candidate previous keys
        $payload = PaymentStatusTokenService::verifyToken($token, 104, 'ORD-104');
        $this->assertNotNull($payload);
        $this->assertSame(104, $payload['order_id']);

        // Without old key in previous_keys, verification must fail
        config(['app.key' => $newKey, 'app.previous_keys' => []]);
        $this->assertNull(PaymentStatusTokenService::verifyToken($token, 104, 'ORD-104'));
    }

    public function test_app_key_is_not_exposed_in_responses(): void
    {
        $user = $this->createCustomer();
        $response = $this->withHeaders([
            'Authorization' => 'Bearer '.$this->createTokenForUser($user),
        ])->getJson('/api/v1/health');

        $content = $response->getContent();
        $this->assertStringNotContainsString(config('app.key'), $content);
        $this->assertArrayNotHasKey('app_key', (array) $response->json('data', []));
    }
}
