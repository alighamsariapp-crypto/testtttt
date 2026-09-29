<?php

namespace Tests\Feature\Cart;

use App\Modules\Cart\Models\Cart;
use App\Modules\Cart\Models\CartItem;
use App\Modules\Inventory\Models\Inventory;
use App\Modules\Products\Models\Product;
use App\Modules\Products\Models\ProductVariant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CartStaleStockAdjustmentTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_can_reduce_a_stale_cart_quantity_that_exceeds_current_stock(): void
    {
        [$cartItem, $sessionId] = $this->createStaleCartItem(currentStock: 7, cartQuantity: 12);

        $response = $this->withHeader('X-Session-ID', $sessionId)
            ->patchJson("/api/v1/cart/items/{$cartItem->id}", ['quantity' => 11]);

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.items.0.quantity', 7)
            ->assertJsonPath('data.items.0.available_stock', 7)
            ->assertJsonPath('data.items.0.is_in_stock', true);

        $this->assertDatabaseHas('cart_items', [
            'id' => $cartItem->id,
            'quantity' => 7,
        ]);
    }

    public function test_guest_cannot_increase_a_stale_cart_quantity_when_current_stock_is_insufficient(): void
    {
        [$cartItem, $sessionId] = $this->createStaleCartItem(currentStock: 7, cartQuantity: 12);

        $response = $this->withHeader('X-Session-ID', $sessionId)
            ->patchJson("/api/v1/cart/items/{$cartItem->id}", ['quantity' => 13]);

        $response->assertStatus(400)
            ->assertJsonPath('success', false)
            ->assertJsonPath('error_code', 'INSUFFICIENT_STOCK');

        $this->assertDatabaseHas('cart_items', [
            'id' => $cartItem->id,
            'quantity' => 12,
        ]);
    }

    /**
     * @return array{0: CartItem, 1: string}
     */
    private function createStaleCartItem(int $currentStock, int $cartQuantity): array
    {
        $sessionId = 'stale_stock_cart_test';
        $product = Product::create([
            'name' => 'Stale stock test product',
            'slug' => 'stale-stock-test-product',
            'sku' => 'STALE-STOCK-01',
            'base_price' => 100000,
            'currency' => 'IRR',
            'is_active' => true,
            'is_featured' => false,
        ]);
        $variant = ProductVariant::create([
            'product_id' => $product->id,
            'name' => 'Default',
            'sku' => 'STALE-STOCK-01',
            'is_active' => true,
        ]);
        Inventory::create([
            'product_variant_id' => $variant->id,
            'quantity' => $currentStock,
            'reserved_quantity' => 0,
            'safety_threshold' => 0,
        ]);
        $cart = Cart::create(['session_id' => $sessionId]);
        $cartItem = $cart->items()->create([
            'product_variant_id' => $variant->id,
            'quantity' => $cartQuantity,
        ]);

        return [$cartItem, $sessionId];
    }
}
