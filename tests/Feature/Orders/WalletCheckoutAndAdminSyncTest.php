<?php

namespace Tests\Feature\Orders;

use App\Modules\Categories\Models\Category;
use App\Modules\Inventory\Models\Inventory;
use App\Modules\Products\Models\Product;
use App\Modules\Products\Models\ProductVariant;
use App\Modules\Wallet\Models\WalletTransaction;
use Tests\TestCase;

class WalletCheckoutAndAdminSyncTest extends TestCase
{
    public function test_authenticated_cart_wallet_checkout_and_admin_order_sync_work_together(): void
    {
        $customer = $this->createCustomer();
        $admin = $this->createAdmin();
        $category = Category::create([
            'name' => 'Integration Category',
            'slug' => 'integration-category',
            'is_active' => true,
        ]);
        $product = Product::create([
            'category_id' => $category->id,
            'name' => 'Integration Product',
            'slug' => 'integration-product',
            'sku' => 'INT-1001',
            'base_price' => 1_000_000,
            'currency' => 'IRR',
            'is_active' => true,
        ]);
        $variant = ProductVariant::create([
            'product_id' => $product->id,
            'name' => 'Default',
            'sku' => 'INT-1001-DEFAULT',
            'is_active' => true,
        ]);
        Inventory::create([
            'product_variant_id' => $variant->id,
            'quantity' => 4,
            'reserved_quantity' => 0,
            'safety_threshold' => 0,
        ]);
        WalletTransaction::create([
            'user_id' => $customer->id,
            'type' => 'deposit',
            'amount' => 5_000_000,
            'currency' => 'IRR',
            'status' => WalletTransaction::STATUS_SUCCESSFUL,
            'reference' => 'TEST-DEPOSIT-1',
            'description' => 'Integration test balance',
        ]);

        $this->actingAsCustomer($customer);
        $this->postJson('/api/v1/cart/items', [
            'product_variant_id' => $variant->id,
            'quantity' => 1,
        ])->assertOk()->assertJsonPath('data.item_count', 1);

        $checkout = $this->postJson('/api/v1/checkout', [
            'shipping_address' => [
                'recipient_name' => 'Integration Customer',
                'phone' => '09121111111',
                'province' => 'Tehran',
                'city' => 'Tehran',
                'postal_code' => '1415512345',
                'address_line' => 'Integration address',
            ],
            'payment_gateway' => 'wallet',
            'idempotency_key' => 'wallet-checkout-test-key-001',
        ])->assertCreated()
            ->assertJsonPath('data.status', 'paid')
            ->assertJsonPath('data.payment_status', 'paid')
            ->assertJsonPath('data.payment_intent.gateway', 'wallet')
            ->assertJsonPath('data.payment_intent.payment_status', 'paid');

        $orderNumber = $checkout->json('data.order_number');
        $this->assertDatabaseHas('wallet_transactions', [
            'user_id' => $customer->id,
            'type' => 'purchase',
            'status' => WalletTransaction::STATUS_SUCCESSFUL,
        ]);
        $this->assertDatabaseMissing('cart_items', ['cart_id' => 1]);
        $this->assertDatabaseHas('inventory', [
            'product_variant_id' => $variant->id,
            'quantity' => 3,
        ]);

        $this->actingAsAdmin($admin);
        $this->getJson('/api/v1/admin/orders')
            ->assertOk()
            ->assertJsonPath('data.data.0.order_number', $orderNumber);
    }
}
