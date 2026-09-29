<?php

namespace Tests\Feature\Products;

use App\Modules\Categories\Models\Category;
use App\Modules\Products\Models\Product;
use Tests\TestCase;

class ProductLifecycleAuditTest extends TestCase
{
    private function createCategory(string $suffix): Category
    {
        return Category::create([
            'name' => "دسته ممیزی {$suffix}",
            'slug' => "audit-category-{$suffix}",
            'is_active' => true,
            'sort_order' => 1,
        ]);
    }

    /** @param array<int, array<string, mixed>> $variants */
    private function createProduct(Category $category, string $sku, array $variants = [], int $initialStock = 0): Product
    {
        $response = $this->postJson('/api/v1/admin/products', [
            'category_id' => $category->id,
            'name' => "کالای ممیزی {$sku}",
            'slug' => strtolower($sku).'-audit',
            'sku' => $sku,
            'base_price' => 1000000,
            'currency' => 'IRR',
            'is_active' => true,
            'initial_stock' => $initialStock,
            'variants' => $variants,
        ]);
        $response->assertCreated()->assertJsonPath('success', true);

        return Product::with('variants.inventory')->where('sku', $sku)->firstOrFail();
    }

    public function test_colored_product_can_be_converted_to_single_default_variant_without_stock_duplication(): void
    {
        $this->actingAsAdmin();
        $category = $this->createCategory('convert-default');
        $product = $this->createProduct($category, 'AUDIT-CONVERT-001', [
            ['name' => 'آبی', 'sku' => 'AUDIT-CONVERT-001-BLU', 'price_override' => 1000000, 'stock' => 4, 'attributes' => ['color' => 'آبی']],
            ['name' => 'قرمز', 'sku' => 'AUDIT-CONVERT-001-RED', 'price_override' => 1100000, 'stock' => 6, 'attributes' => ['color' => 'قرمز']],
        ]);

        $this->assertCount(2, $product->variants->where('is_active', true));
        $converted = $this->putJson('/api/v1/admin/products/'.$product->id, [
            'variants' => [],
            'initial_stock' => 7,
        ]);
        $converted->assertOk()->assertJsonPath('success', true);

        $product->refresh()->load('variants.inventory');
        $active = $product->variants->where('is_active', true);
        $this->assertCount(1, $active);
        $this->assertSame('Default', $active->first()->name);
        $this->assertSame(7, $active->first()->inventory->quantity);
        $this->assertSame(2, $product->variants->where('is_active', false)->count());
    }

    public function test_product_update_rejects_unknown_variant_and_stock_below_reserved_quantity(): void
    {
        $this->actingAsAdmin();
        $category = $this->createCategory('reserved-stock');
        $product = $this->createProduct($category, 'AUDIT-RESERVED-001', [
            ['name' => 'مشکی', 'sku' => 'AUDIT-RESERVED-001-BLK', 'price_override' => 1000000, 'stock' => 5, 'attributes' => ['color' => 'مشکی']],
        ]);
        $variant = $product->variants->first();
        $variant->inventory->update(['reserved_quantity' => 3]);

        $belowReserved = $this->putJson('/api/v1/admin/products/'.$product->id, [
            'variants' => [[
                'id' => $variant->id,
                'name' => 'مشکی',
                'sku' => 'AUDIT-RESERVED-001-BLK',
                'price_override' => 1000000,
                'stock' => 2,
                'attributes' => ['color' => 'مشکی'],
            ]],
        ]);
        $belowReserved->assertUnprocessable()->assertJsonPath('error_code', 'INVENTORY_BELOW_RESERVED');

        $unknownVariant = $this->putJson('/api/v1/admin/products/'.$product->id, [
            'variants' => [[
                'id' => 999999,
                'name' => 'مشکی',
                'sku' => 'AUDIT-RESERVED-001-BLK-NEW',
                'price_override' => 1000000,
                'stock' => 5,
                'attributes' => ['color' => 'مشکی'],
            ]],
        ]);
        $unknownVariant->assertUnprocessable()->assertJsonPath('error_code', 'INVALID_PRODUCT_VARIANT');
    }

    public function test_product_creation_rejects_duplicate_variant_sku_and_duplicate_color_before_database_write(): void
    {
        $this->actingAsAdmin();
        $category = $this->createCategory('duplicate-payload');

        $duplicateSku = $this->postJson('/api/v1/admin/products', [
            'category_id' => $category->id,
            'name' => 'کالای SKU تکراری',
            'slug' => 'duplicate-variant-sku-create',
            'sku' => 'AUDIT-DUP-SKU-001',
            'base_price' => 1000000,
            'variants' => [
                ['name' => 'آبی', 'sku' => 'AUDIT-DUP-SKU-001-X', 'stock' => 1, 'attributes' => ['color' => 'آبی']],
                ['name' => 'قرمز', 'sku' => 'AUDIT-DUP-SKU-001-X', 'stock' => 1, 'attributes' => ['color' => 'قرمز']],
            ],
        ]);
        $duplicateSku->assertUnprocessable()->assertJsonPath('error_code', 'DUPLICATE_VARIANT_SKU');

        $duplicateColor = $this->postJson('/api/v1/admin/products', [
            'category_id' => $category->id,
            'name' => 'کالای رنگ تکراری',
            'slug' => 'duplicate-variant-color-create',
            'sku' => 'AUDIT-DUP-COLOR-001',
            'base_price' => 1000000,
            'variants' => [
                ['name' => 'آبی', 'sku' => 'AUDIT-DUP-COLOR-001-A', 'stock' => 1, 'attributes' => ['color' => 'آبی']],
                ['name' => 'آبی دوم', 'sku' => 'AUDIT-DUP-COLOR-001-B', 'stock' => 1, 'attributes' => ['color' => ' آبی ']],
            ],
        ]);
        $duplicateColor->assertUnprocessable()->assertJsonPath('error_code', 'DUPLICATE_VARIANT_COLOR');

        $this->assertDatabaseMissing('products', ['sku' => 'AUDIT-DUP-SKU-001']);
        $this->assertDatabaseMissing('products', ['sku' => 'AUDIT-DUP-COLOR-001']);
    }

    public function test_partial_product_update_keeps_existing_category_and_inventory_when_they_are_omitted(): void
    {
        $this->actingAsAdmin();
        $category = $this->createCategory('partial-update');
        $product = $this->createProduct($category, 'AUDIT-PARTIAL-001', [], 9);
        $variant = $product->variants->first();

        $updated = $this->putJson('/api/v1/admin/products/'.$product->id, [
            'name' => 'نام جدید ممیزی',
        ]);
        $updated->assertOk()->assertJsonPath('success', true);

        $product->refresh()->load('variants.inventory');
        $this->assertSame($category->id, $product->category_id);
        $this->assertSame(9, $product->variants->firstWhere('id', $variant->id)->inventory->quantity);
    }
}
