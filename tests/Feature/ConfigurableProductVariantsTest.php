<?php

namespace Tests\Feature;

use App\Modules\Categories\Models\Category;
use App\Modules\Products\Models\Product;
use App\Modules\Products\Models\ProductAttributeDefinition;
use App\Modules\Products\Services\FacetedCatalogService;
use App\Modules\Products\Services\ProductService;
use App\Modules\Inventory\Models\Inventory;
use App\Modules\Orders\Models\Order;
use App\Modules\Shared\Exceptions\DomainException;
use Tests\TestCase;

class ConfigurableProductVariantsTest extends TestCase
{
    public function test_product_can_have_same_color_with_distinct_sellable_configurations(): void
    {
        $category = Category::create([
            'name' => 'Mobile phones',
            'slug' => 'mobile-phones',
            'is_active' => true,
        ]);
        $ram = ProductAttributeDefinition::query()->firstOrCreate(['key' => 'ram'], [
            'key' => 'ram',
            'name' => 'RAM',
            'data_type' => 'single_select',
            'options' => ['8GB', '12GB'],
            'is_filterable' => true,
            'is_active' => true,
        ]);
        $category->productAttributeDefinitions()->attach($ram->id, [
            'is_filterable' => true,
            'is_required' => false,
            'inherit_to_children' => true,
            'sort_order' => 10,
        ]);

        $payload = [
            'category_id' => $category->id,
            'name' => 'Configurable mobile',
            'slug' => 'configurable-mobile',
            'sku' => 'CFG-MOBILE-001',
            'base_price' => 180000000,
            'currency' => 'IRR',
            'is_active' => true,
            'attributes' => [
                'ram' => ['8GB', '12GB'],
                'storage' => ['128GB', '256GB'],
                'novinet_variant_axes' => [
                    ['key' => 'ram', 'label' => 'RAM'],
                    ['key' => 'storage', 'label' => 'Storage'],
                ],
            ],
            'variants' => [
                [
                    'name' => 'Black · 8GB · 128GB',
                    'sku' => 'CFG-MOBILE-001-V1',
                    'price_override' => 180000000,
                    'stock' => 3,
                    'attributes' => ['color' => 'Black', 'ram' => '8GB', 'storage' => '128GB'],
                ],
                [
                    'name' => 'Black · 12GB · 256GB',
                    'sku' => 'CFG-MOBILE-001-V2',
                    'price_override' => 210000000,
                    'stock' => 5,
                    'attributes' => ['color' => 'Black', 'ram' => '12GB', 'storage' => '256GB'],
                ],
            ],
        ];

        $this->actingAsAdmin();
        $created = $this->postJson('/api/v1/admin/products', $payload)
            ->assertCreated()
            ->json('data');
        $product = Product::query()->findOrFail($created['id']);

        $variants = $product->variants()->with('inventory')->orderBy('sku')->get();

        $this->assertCount(2, $variants);
        $this->assertSame(['8GB', '12GB'], $product->attributes['ram']);
        $this->assertSame(['128GB', '256GB'], $product->attributes['storage']);
        $this->assertSame('Black', $variants[0]->attributes['color']);
        $this->assertSame('8GB', $variants[0]->attributes['ram']);
        $this->assertSame(3, $variants[0]->inventory->quantity);
        $this->assertSame('12GB', $variants[1]->attributes['ram']);
        $this->assertSame(5, $variants[1]->inventory->quantity);

        $filtered = app(FacetedCatalogService::class)->paginate([
            'category_id' => $category->id,
            'facets' => ['ram' => ['12GB']],
        ]);
        $facetPayload = app(FacetedCatalogService::class)->facets(['category_id' => $category->id]);

        $this->assertSame([$product->id], collect($filtered->items())->pluck('id')->all());
        $ramFacet = collect($facetPayload['facets'])->firstWhere('key', 'ram');
        $this->assertSame(1, collect($ramFacet['options'])->firstWhere('value', '12GB')['count']);

        $this->putJson('/api/v1/admin/products/'.$product->id, [
            'variants' => [
                [
                    'id' => $variants[0]->id,
                    'name' => 'Black · 8GB · 128GB',
                    'sku' => 'CFG-MOBILE-001-V1',
                    'price_override' => 185000000,
                    'stock' => 7,
                    'attributes' => ['color' => 'Black', 'ram' => '8GB', 'storage' => '128GB'],
                ],
                [
                    'id' => $variants[1]->id,
                    'name' => 'Black · 12GB · 256GB',
                    'sku' => 'CFG-MOBILE-001-V2',
                    'price_override' => 210000000,
                    'stock' => 5,
                    'attributes' => ['color' => 'Black', 'ram' => '12GB', 'storage' => '256GB'],
                ],
            ],
        ])->assertOk();

        $this->assertDatabaseHas('inventory', [
            'product_variant_id' => $variants[0]->id,
            'quantity' => 7,
        ]);
    }

    public function test_product_rejects_duplicate_color_and_configuration_before_writing_rows(): void
    {
        $category = Category::create([
            'name' => 'Laptop computers',
            'slug' => 'laptop-computers',
            'is_active' => true,
        ]);

        $this->expectException(DomainException::class);
        $this->expectExceptionMessage('دو ترکیب فروش یکسان ثبت شده‌اند');

        app(ProductService::class)->createProduct([
            'category_id' => $category->id,
            'name' => 'Duplicate configuration',
            'slug' => 'duplicate-configuration',
            'sku' => 'CFG-DUPLICATE-001',
            'base_price' => 120000000,
            'currency' => 'IRR',
            'is_active' => true,
            'variants' => [
                ['name' => 'Gray · 16GB', 'sku' => 'CFG-DUPLICATE-001-V1', 'stock' => 1, 'attributes' => ['color' => 'Gray', 'ram' => '16GB']],
                ['name' => 'Gray · 16GB', 'sku' => 'CFG-DUPLICATE-001-V2', 'stock' => 2, 'attributes' => ['color' => 'Gray', 'ram' => '16GB']],
            ],
        ]);

        $this->assertDatabaseMissing('products', ['sku' => 'CFG-DUPLICATE-001']);
    }

    public function test_guest_can_buy_a_selected_configuration_and_cannot_exceed_its_stock(): void
    {
        $category = Category::create([
            'name' => 'Cart mobile phones',
            'slug' => 'cart-mobile-phones',
            'is_active' => true,
        ]);
        $product = app(ProductService::class)->createProduct([
            'category_id' => $category->id,
            'name' => 'Cart configuration mobile',
            'slug' => 'cart-configuration-mobile',
            'sku' => 'CFG-CART-001',
            'base_price' => 150000000,
            'currency' => 'IRR',
            'is_active' => true,
            'attributes' => [
                'novinet_variant_axes' => [['key' => 'ram', 'label' => 'RAM']],
            ],
            'variants' => [
                [
                    'name' => 'Blue · 12GB',
                    'sku' => 'CFG-CART-001-V1',
                    'price_override' => 175000000,
                    'stock' => 3,
                    'attributes' => ['color' => 'Blue', 'ram' => '12GB'],
                ],
            ],
        ]);
        $variant = $product->variants()->firstOrFail();
        $session = ['X-Session-ID' => 'configurable-cart-guest'];

        $added = $this->withHeaders($session)
            ->postJson('/api/v1/cart/items', ['product_variant_id' => $variant->id, 'quantity' => 1])
            ->assertOk()
            ->assertJsonPath('data.items.0.variant_id', $variant->id)
            ->assertJsonPath('data.items.0.quantity', 1)
            ->json('data');
        $itemId = $added['items'][0]['id'];

        $this->withHeaders($session)
            ->postJson('/api/v1/cart/items', ['product_variant_id' => $variant->id, 'quantity' => 2])
            ->assertOk()
            ->assertJsonPath('data.items.0.quantity', 3);

        $this->withHeaders($session)
            ->postJson('/api/v1/cart/items', ['product_variant_id' => $variant->id, 'quantity' => 1])
            ->assertStatus(400)
            ->assertJsonPath('error_code', 'INSUFFICIENT_STOCK');

        $this->withHeaders($session)
            ->patchJson('/api/v1/cart/items/'.$itemId, ['quantity' => 2])
            ->assertOk()
            ->assertJsonPath('data.items.0.quantity', 2);

        $this->withHeaders($session)
            ->patchJson('/api/v1/cart/items/'.$itemId, ['quantity' => 4])
            ->assertStatus(400)
            ->assertJsonPath('error_code', 'INSUFFICIENT_STOCK');

        $this->withHeaders($session)
            ->patchJson('/api/v1/cart/items/'.$itemId, ['quantity' => 1])
            ->assertOk()
            ->assertJsonPath('data.items.0.quantity', 1);

        $this->withHeaders($session)
            ->deleteJson('/api/v1/cart/items/'.$itemId)
            ->assertOk()
            ->assertJsonPath('data.item_count', 0);
    }

    public function test_checkout_uses_the_selected_variant_price_and_persists_exact_irr_totals(): void
    {
        $customer = $this->createCustomer();
        $this->actingAsCustomer($customer);
        $category = Category::create(['name' => 'Accounting phones', 'slug' => 'accounting-phones', 'is_active' => true]);
        $product = app(ProductService::class)->createProduct([
            'category_id' => $category->id,
            'name' => 'Accounting configuration phone',
            'slug' => 'accounting-configuration-phone',
            'sku' => 'CFG-ACCOUNTING-001',
            'base_price' => 180000000,
            'currency' => 'IRR',
            'is_active' => true,
            'variants' => [[
                'name' => 'Blue · 12GB · 256GB',
                'sku' => 'CFG-ACCOUNTING-001-V1',
                'price_override' => 215000000,
                'stock' => 5,
                'attributes' => ['color' => 'Blue', 'ram' => '12GB', 'storage' => '256GB'],
            ]],
        ]);
        $variant = $product->variants()->firstOrFail();

        $this->postJson('/api/v1/cart/items', ['product_variant_id' => $variant->id, 'quantity' => 3])
            ->assertOk()
            ->assertJsonPath('data.currency', 'IRR')
            ->assertJsonPath('data.items.0.unit_price', 215000000)
            ->assertJsonPath('data.items.0.total_price', 645000000)
            ->assertJsonPath('data.subtotal', 645000000)
            ->assertJsonPath('data.tax', 58050000)
            ->assertJsonPath('data.grand_total', 703050000);

        $checkout = $this->postJson('/api/v1/checkout', [
            'shipping_address' => [
                'recipient_name' => 'Ali Rezaei', 'phone' => '09123456789', 'province' => 'Tehran',
                'city' => 'Tehran', 'postal_code' => '1234567890', 'address_line' => 'Valiasr St, No 123',
            ],
            'payment_gateway' => 'test',
        ])->assertCreated()
            ->assertJsonPath('data.currency', 'IRR')
            ->assertJsonPath('data.grand_total', 703050000)
            ->json('data');

        $order = Order::query()->findOrFail($checkout['order_id']);
        $this->assertSame(645000000, $order->subtotal);
        $this->assertSame(58050000, $order->tax_total);
        $this->assertSame(0, $order->shipping_total);
        $this->assertSame(703050000, $order->grand_total);
        $this->assertSame('IRR', $order->currency);
        $this->assertDatabaseHas('order_items', ['order_id' => $order->id, 'product_variant_id' => $variant->id, 'unit_price' => 215000000, 'quantity' => 3, 'total_price' => 645000000]);
        $this->assertSame(2, Inventory::query()->where('product_variant_id', $variant->id)->value('quantity'));
    }

    public function test_admin_cannot_create_a_new_product_with_a_non_irr_currency(): void
    {
        $category = Category::create(['name' => 'Currency phones', 'slug' => 'currency-phones', 'is_active' => true]);

        $this->actingAsAdmin();

        $this->postJson('/api/v1/admin/products', [
                'category_id' => $category->id,
                'name' => 'Invalid currency phone',
                'sku' => 'INVALID-CURRENCY-001',
                'base_price' => 1000000,
                'currency' => 'تومان',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('currency');
    }
}
