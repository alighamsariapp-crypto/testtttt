<?php

namespace Tests\Feature\Cart;

use Tests\TestCase;

class CartManagementTest extends TestCase
{
    public function test_guest_can_retrieve_empty_cart(): void
    {
        $response = $this->withHeader('X-Session-ID', 'sess_test_123')->getJson('/api/v1/cart');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'cart_id',
                    'items',
                    'subtotal',
                    'tax',
                    'grand_total',
                    'currency',
                    'item_count',
                ],
            ])
            ->assertJson([
                'success' => true,
                'data' => [
                    'subtotal' => 0,
                    'tax' => 0,
                    'grand_total' => 0,
                    'item_count' => 0,
                ],
            ]);
    }
}
