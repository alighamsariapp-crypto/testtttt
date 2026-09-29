<?php

namespace Tests\Feature\Orders;

use App\Modules\Categories\Models\Category;
use App\Modules\Inventory\Models\Inventory;
use App\Modules\Products\Models\Product;
use App\Modules\Products\Models\ProductVariant;
use Tests\TestCase;

class CheckoutAndOrderTest extends TestCase
{
    public function test_customer_can_checkout_cart_atomically(): void
    {
        $user = $this->createCustomer();
        $this->actingAsCustomer($user);

        // 1. Create Category, Product, Variant & Inventory
        $category = Category::create([
            'name' => 'Industrial Hardware',
            'slug' => 'industrial-hardware',
            'is_active' => true,
        ]);

        $product = Product::create([
            'category_id' => $category->id,
            'name' => 'High Precision Motor',
            'slug' => 'high-precision-motor',
            'sku' => 'MOT-1001',
            'base_price' => 5000000,
            'currency' => 'IRR',
            'is_active' => true,
        ]);

        $variant = ProductVariant::create([
            'product_id' => $product->id,
            'name' => '220V Standard',
            'sku' => 'MOT-1001-220V',
            'price_override' => null,
            'is_active' => true,
        ]);

        Inventory::create([
            'product_variant_id' => $variant->id,
            'quantity' => 10,
            'reserved_quantity' => 0,
            'safety_threshold' => 1,
        ]);

        // 2. Add to cart
        $cartResponse = $this->postJson('/api/v1/cart/items', [
            'product_variant_id' => $variant->id,
            'quantity' => 2,
        ]);
        $cartResponse->assertStatus(200);

        // 3. Checkout
        $checkoutPayload = [
            'shipping_address' => [
                'recipient_name' => 'Ali Rezaei',
                'phone' => '09123456789',
                'province' => 'Tehran',
                'city' => 'Tehran',
                'postal_code' => '1234567890',
                'address_line' => 'Valiasr St, No 123',
            ],
            'payment_gateway' => 'test',
            'shipping_method' => 'post',
            'idempotency_key' => 'checkout-test-key-001',
        ];

        $checkoutResponse = $this->postJson('/api/v1/checkout', $checkoutPayload);

        $checkoutResponse->assertStatus(201)
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    'order_id',
                    'order_number',
                    'grand_total',
                    'currency',
                    'status',
                    'payment_intent',
                ],
            ])
            ->assertJson([
                'success' => true,
                'data' => [
                    'status' => 'pending',
                ],
            ]);

        // 4. Verify inventory was safely decremented
        $updatedInventory = Inventory::where('product_variant_id', $variant->id)->first();
        $this->assertSame(8, $updatedInventory->quantity);
    }
}
