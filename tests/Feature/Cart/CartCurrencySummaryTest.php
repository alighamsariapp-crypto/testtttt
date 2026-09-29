<?php

namespace Tests\Feature\Cart;

use App\Modules\Inventory\Models\Inventory;
use App\Modules\Products\Models\Product;
use App\Modules\Products\Models\ProductVariant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CartCurrencySummaryTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_can_add_a_toman_product_to_an_empty_cart(): void
    {
        $product = Product::create([
            'name' => 'Toman cart product',
            'slug' => 'toman-cart-product',
            'sku' => 'TOMAN-CART-01',
            'base_price' => 2500000,
            'currency' => 'تومان',
            'is_active' => true,
            'is_featured' => false,
            'images' => ['https://cdn.example.test/products/toman-cart-product.jpg'],
        ]);

        $variant = ProductVariant::create([
            'product_id' => $product->id,
            'name' => 'Default',
            'sku' => 'TOMAN-CART-01',
            'is_active' => true,
            'attributes' => ['image_url' => 'https://cdn.example.test/products/toman-cart-product-variant.jpg'],
        ]);

        Inventory::create([
            'product_variant_id' => $variant->id,
            'quantity' => 15,
            'reserved_quantity' => 0,
            'safety_threshold' => 0,
        ]);

        $response = $this->withHeader('X-Session-ID', 'toman_cart_summary_test')
            ->postJson('/api/v1/cart/items', [
                'product_variant_id' => $variant->id,
                'quantity' => 1,
            ]);

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.item_count', 1)
            ->assertJsonPath('data.currency', 'تومان')
            ->assertJsonPath('data.items.0.currency', 'تومان')
            ->assertJsonPath('data.items.0.image_url', 'https://cdn.example.test/products/toman-cart-product-variant.jpg');
    }

    public function test_cart_falls_back_to_the_product_image_when_variant_has_no_image(): void
    {
        $product = Product::create([
            'name' => 'Product image fallback',
            'slug' => 'product-image-fallback',
            'sku' => 'PRODUCT-IMAGE-FALLBACK-01',
            'base_price' => 1200000,
            'currency' => 'IRR',
            'is_active' => true,
            'is_featured' => false,
            'images' => ['https://cdn.example.test/products/product-fallback.jpg'],
        ]);

        $variant = ProductVariant::create([
            'product_id' => $product->id,
            'name' => 'Default',
            'sku' => 'PRODUCT-IMAGE-FALLBACK-01',
            'is_active' => true,
        ]);

        Inventory::create([
            'product_variant_id' => $variant->id,
            'quantity' => 3,
            'reserved_quantity' => 0,
            'safety_threshold' => 0,
        ]);

        $response = $this->withHeader('X-Session-ID', 'product_image_fallback_cart_test')
            ->postJson('/api/v1/cart/items', [
                'product_variant_id' => $variant->id,
                'quantity' => 1,
            ]);

        $response->assertOk()
            ->assertJsonPath('data.items.0.image_url', 'https://cdn.example.test/products/product-fallback.jpg');
    }

    public function test_checkout_preserves_the_currency_of_a_legacy_toman_product(): void
    {
        $user = $this->createCustomer();
        $this->actingAsCustomer($user);
        $product = Product::create([
            'name' => 'Legacy toman checkout product',
            'slug' => 'legacy-toman-checkout-product',
            'sku' => 'LEGACY-TOMAN-01',
            'base_price' => 2500000,
            'currency' => 'تومان',
            'is_active' => true,
            'is_featured' => false,
        ]);
        $variant = ProductVariant::create([
            'product_id' => $product->id,
            'name' => 'Default',
            'sku' => 'LEGACY-TOMAN-01',
            'is_active' => true,
        ]);
        Inventory::create([
            'product_variant_id' => $variant->id,
            'quantity' => 4,
            'reserved_quantity' => 0,
            'safety_threshold' => 0,
        ]);

        $this->postJson('/api/v1/cart/items', ['product_variant_id' => $variant->id, 'quantity' => 2])
            ->assertOk()
            ->assertJsonPath('data.subtotal', 5000000)
            ->assertJsonPath('data.tax', 450000)
            ->assertJsonPath('data.grand_total', 5450000)
            ->assertJsonPath('data.currency', 'تومان');

        $this->postJson('/api/v1/checkout', [
            'shipping_address' => [
                'recipient_name' => 'Ali Rezaei', 'phone' => '09123456789', 'province' => 'Tehran',
                'city' => 'Tehran', 'postal_code' => '1234567890', 'address_line' => 'Valiasr St, No 123',
            ],
            'payment_gateway' => 'test',
        ])
            ->assertCreated()
            ->assertJsonPath('data.grand_total', 5900000)
            ->assertJsonPath('data.currency', 'تومان');

        $this->assertSame(2, Inventory::query()->where('product_variant_id', $variant->id)->value('quantity'));
    }
}
