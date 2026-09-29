<?php

namespace Tests\Feature\Payments;

use App\Modules\Orders\Models\Order;
use App\Modules\Payments\Models\Payment;
use App\Modules\Payments\Services\PaymentService;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class ZibalPaymentGatewayTest extends TestCase
{
    public function test_zibal_payment_request_uses_authoritative_order_amount_and_returns_redirect_url(): void
    {
        $order = $this->makePendingOrder();
        Http::fake([
            'https://gateway.zibal.ir/v1/request' => Http::response([
                'result' => 100,
                'trackId' => 123456789,
                'message' => 'success',
            ]),
        ]);

        $result = app(PaymentService::class)->createPaymentForOrder($order, 'zibal');

        $this->assertSame('zibal', $result['intent']['gateway']);
        $this->assertSame('redirect', $result['intent']['action']);
        $this->assertSame('123456789', $result['intent']['reference_id']);
        $this->assertSame('https://gateway.zibal.ir/start/123456789', $result['intent']['payment_url']);
        $this->assertDatabaseHas('payments', [
            'order_id' => $order->id,
            'gateway' => 'zibal',
            'amount' => 15450000,
            'reference_id' => '123456789',
            'status' => 'pending',
        ]);
        Http::assertSent(function (Request $request): bool {
            return $request->url() === 'https://gateway.zibal.ir/v1/request'
                && $request['merchant'] === 'zibal'
                && $request['amount'] === 15450000
                && $request['orderId'] === 'ORD-ZIBAL-TEST';
        });
    }

    public function test_zibal_callback_marks_order_paid_only_after_successful_verify(): void
    {
        $order = $this->makePendingOrder();
        $payment = Payment::create([
            'order_id' => $order->id,
            'gateway' => 'zibal',
            'amount' => $order->grand_total,
            'currency' => 'IRR',
            'status' => Payment::STATUS_PENDING,
            'reference_id' => '987654321',
        ]);
        Http::fake([
            'https://gateway.zibal.ir/v1/verify' => Http::response([
                'result' => 100,
                'refNumber' => 551122,
                'cardNumber' => '6219********1234',
                'amount' => 15450000,
            ]),
        ]);

        $result = app(PaymentService::class)->completeZibalPayment('987654321', true);

        $this->assertTrue($result['paid']);
        $this->assertSame('paid', $result['payment_status']);
        $this->assertDatabaseHas('payments', ['id' => $payment->id, 'status' => 'paid']);
        $this->assertDatabaseHas('orders', ['id' => $order->id, 'status' => 'paid', 'payment_status' => 'paid']);
        $this->assertDatabaseHas('payment_transactions', [
            'payment_id' => $payment->id,
            'event_type' => 'paid',
            'is_reconciled' => true,
        ]);
        Http::assertSent(fn (Request $request): bool => $request->url() === 'https://gateway.zibal.ir/v1/verify' && $request['trackId'] === 987654321);
    }

    public function test_zibal_browser_callback_redirects_to_payment_status_after_verification(): void
    {
        $order = $this->makePendingOrder();
        Payment::create([
            'order_id' => $order->id,
            'gateway' => 'zibal',
            'amount' => $order->grand_total,
            'currency' => 'IRR',
            'status' => Payment::STATUS_PENDING,
            'reference_id' => '246813579',
        ]);
        Http::fake([
            'https://gateway.zibal.ir/v1/verify' => Http::response(['result' => 100, 'amount' => 15450000]),
        ]);

        $response = $this->get('/api/v1/payments/zibal/callback?trackId=246813579&success=1');

        $response->assertRedirect();
        $location = (string) $response->headers->get('Location');
        $this->assertStringContainsString('/payment-status?', $location);
        $this->assertStringContainsString('order=ORD-ZIBAL-TEST', $location);
        $this->assertStringContainsString('exchange_code=', $location);
        $this->assertStringNotContainsString('token=', $location);
        $this->assertStringNotContainsString('status=success', $location);
        $this->assertStringNotContainsString('amount=', $location);
    }

    private function makePendingOrder(): Order
    {
        $user = $this->createCustomer();

        return Order::create([
            'order_number' => 'ORD-ZIBAL-TEST',
            'user_id' => $user->id,
            'status' => Order::STATUS_PENDING,
            'payment_status' => 'pending',
            'subtotal' => 15000000,
            'discount_total' => 0,
            'tax_total' => 0,
            'shipping_total' => 450000,
            'grand_total' => 15450000,
            'currency' => 'IRR',
            'shipping_address_snapshot' => ['phone' => '09121234567'],
            'billing_address_snapshot' => ['phone' => '09121234567'],
        ]);
    }
}
