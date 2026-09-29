<?php

namespace Tests\Feature\Cart;

use App\Modules\Cart\Models\Cart;
use App\Modules\Cart\Services\CartService;
use App\Modules\Categories\Models\Category;
use App\Modules\Inventory\Models\Inventory;
use App\Modules\Products\Models\Product;
use App\Modules\Products\Models\ProductVariant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class GuestCartMergeTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_cart_is_merged_into_authenticated_user_cart(): void
    {
        $customer = $this->createCustomer();
        $category = Category::create([
            'name' => 'Network',
            'slug' => 'network',
            'is_active' => true,
        ]);
        $product = Product::create([
            'category_id' => $category->id,
            'name' => 'Router',
            'slug' => 'router',
            'sku' => 'RTR-001',
            'base_price' => 500000,
            'currency' => 'IRR',
            'is_active' => true,
        ]);
        $variant = ProductVariant::create([
            'product_id' => $product->id,
            'name' => 'Default',
            'sku' => 'RTR-001-DEFAULT',
            'is_active' => true,
        ]);
        Inventory::create([
            'product_variant_id' => $variant->id,
            'quantity' => 10,
            'reserved_quantity' => 0,
            'safety_threshold' => 0,
        ]);

        $guestCart = Cart::create(['session_id' => 'guest-session-1']);
        $guestCart->items()->create(['product_variant_id' => $variant->id, 'quantity' => 2]);

        $userCart = Cart::create(['user_id' => $customer->id]);
        $userCart->items()->create(['product_variant_id' => $variant->id, 'quantity' => 1]);

        $mergedCart = app(CartService::class)->getOrCreateCart($customer, 'guest-session-1');

        $this->assertSame($userCart->id, $mergedCart->id);
        $this->assertDatabaseHas('cart_items', [
            'cart_id' => $userCart->id,
            'product_variant_id' => $variant->id,
            'quantity' => 3,
        ]);
        $this->assertDatabaseMissing('carts', ['id' => $guestCart->id]);
    }

    public function test_guest_cart_merge_caps_the_combined_quantity_at_available_stock(): void
    {
        $customer = $this->createCustomer();
        $category = Category::create([
            'name' => 'Wireless',
            'slug' => 'wireless',
            'is_active' => true,
        ]);
        $product = Product::create([
            'category_id' => $category->id,
            'name' => 'Access point',
            'slug' => 'access-point',
            'sku' => 'AP-001',
            'base_price' => 500000,
            'currency' => 'IRR',
            'is_active' => true,
        ]);
        $variant = ProductVariant::create([
            'product_id' => $product->id,
            'name' => 'Default',
            'sku' => 'AP-001-DEFAULT',
            'is_active' => true,
        ]);
        Inventory::create([
            'product_variant_id' => $variant->id,
            'quantity' => 7,
            'reserved_quantity' => 0,
            'safety_threshold' => 0,
        ]);

        $guestCart = Cart::create(['session_id' => 'guest-session-stock-cap']);
        $guestCart->items()->create(['product_variant_id' => $variant->id, 'quantity' => 5]);
        $userCart = Cart::create(['user_id' => $customer->id]);
        $userCart->items()->create(['product_variant_id' => $variant->id, 'quantity' => 4]);

        app(CartService::class)->getOrCreateCart($customer, 'guest-session-stock-cap');

        $this->assertDatabaseHas('cart_items', [
            'cart_id' => $userCart->id,
            'product_variant_id' => $variant->id,
            'quantity' => 7,
        ]);
        $this->assertDatabaseMissing('carts', ['id' => $guestCart->id]);
    }
}
