<?php

namespace Tests\Feature\Orders;

use App\Modules\Orders\Models\Order;
use Tests\TestCase;

class CustomerOrderAccessTest extends TestCase
{
    public function test_customer_can_list_and_view_only_own_orders(): void
    {
        $customer = $this->createCustomer();
        $otherCustomer = $this->createCustomer();

        $ownOrder = $this->createOrderFor($customer->id, Order::STATUS_PENDING);
        $otherOrder = $this->createOrderFor($otherCustomer->id, Order::STATUS_PENDING);

        $this->actingAsCustomer($customer);

        $this->getJson('/api/v1/orders')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.total', 1)
            ->assertJsonPath('data.data.0.id', $ownOrder->id);

        $this->getJson('/api/v1/orders/'.$ownOrder->id)
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.id', $ownOrder->id);

        $this->getJson('/api/v1/orders/'.$otherOrder->id)
            ->assertNotFound()
            ->assertJsonPath('success', false)
            ->assertJsonPath('error_code', 'ENTITY_NOT_FOUND');
    }

    public function test_customer_can_cancel_pending_order_but_not_paid_order(): void
    {
        $customer = $this->createCustomer();
        $pendingOrder = $this->createOrderFor($customer->id, Order::STATUS_PENDING);
        $paidOrder = $this->createOrderFor($customer->id, Order::STATUS_PAID);

        $this->actingAsCustomer($customer);

        $this->postJson('/api/v1/orders/'.$pendingOrder->id.'/cancel')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.status', Order::STATUS_CANCELLED);

        $this->postJson('/api/v1/orders/'.$paidOrder->id.'/cancel')
            ->assertNotFound()
            ->assertJsonPath('success', false)
            ->assertJsonPath('error_code', 'ENTITY_NOT_FOUND');
    }

    private function createOrderFor(int $userId, string $status): Order
    {
        return Order::create([
            'order_number' => 'ORD-'.str()->upper(str()->random(12)),
            'user_id' => $userId,
            'status' => $status,
            'payment_status' => $status === Order::STATUS_PAID ? 'paid' : 'pending',
            'subtotal' => 250000,
            'discount_total' => 0,
            'tax_total' => 0,
            'shipping_total' => 0,
            'grand_total' => 250000,
            'currency' => 'IRR',
            'shipping_address_snapshot' => [
                'recipient_name' => 'Customer User',
                'phone' => '09123456789',
                'province' => 'Tehran',
                'city' => 'Tehran',
                'postal_code' => '1234567890',
                'address_line' => 'Sample address',
            ],
        ]);
    }
}
