<?php

namespace Tests\Feature\Products;

use App\Modules\Categories\Models\Category;
use App\Modules\Products\Models\Product;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\File;
use Tests\TestCase;

class ProductMediaAndVariantTest extends TestCase
{
    /** @var array<int, string> */
    private array $uploadedPaths = [];

    protected function tearDown(): void
    {
        foreach ($this->uploadedPaths as $path) {
            File::delete($path);
        }

        parent::tearDown();
    }

    public function test_admin_can_upload_a_valid_product_image_and_invalid_files_are_rejected(): void
    {
        $this->actingAsAdmin();

        $uploaded = $this->post('/api/v1/admin/products/images', [
            'image' => UploadedFile::fake()->image('product.png', 300, 300),
        ]);

        $uploaded->assertCreated()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.url', fn (string $url) => str_contains($url, '/uploads/products/'));

        $path = (string) parse_url((string) $uploaded->json('data.url'), PHP_URL_PATH);
        $absolutePath = public_path(ltrim($path, '/'));
        $this->uploadedPaths[] = $absolutePath;
        $this->assertFileExists($absolutePath);

        $invalid = $this->post('/api/v1/admin/products/images', [
            'image' => UploadedFile::fake()->create('not-an-image.txt', 32, 'text/plain'),
        ]);

        $invalid->assertUnprocessable()->assertJsonValidationErrors('image');
    }

    public function test_admin_can_create_and_update_color_variants_with_their_own_images_stock_and_category(): void
    {
        $this->actingAsAdmin();
        $category = Category::create([
            'name' => 'تجهیزات تست',
            'slug' => 'test-equipment',
            'is_active' => true,
            'sort_order' => 1,
        ]);

        $created = $this->postJson('/api/v1/admin/products', [
            'category_id' => $category->id,
            'name' => 'محصول تست تصویر رنگ',
            'slug' => 'color-media-test',
            'sku' => 'COLOR-MEDIA-001',
            'base_price' => 1250000,
            'currency' => 'IRR',
            'is_active' => true,
            'images' => ['https://example.test/uploads/main.webp'],
            'attributes' => [
                'novinet_admin_colors' => [
                    ['name' => 'مشکی', 'hex' => '#111111'],
                    ['name' => 'آبی', 'hex' => '#2563eb'],
                ],
            ],
            'variants' => [
                [
                    'name' => 'مشکی',
                    'sku' => 'COLOR-MEDIA-001-BLK',
                    'price_override' => 1250000,
                    'stock' => 8,
                    'attributes' => ['color' => 'مشکی', 'image_url' => 'https://example.test/uploads/black.webp'],
                ],
                [
                    'name' => 'آبی',
                    'sku' => 'COLOR-MEDIA-001-BLU',
                    'price_override' => 1290000,
                    'stock' => 3,
                    'attributes' => ['color' => 'آبی', 'image_url' => 'https://example.test/uploads/blue.webp'],
                ],
            ],
        ]);

        $created->assertCreated()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.category.id', $category->id);
        $product = Product::with('variants.inventory')->where('sku', 'COLOR-MEDIA-001')->firstOrFail();
        $this->assertCount(2, $product->variants);
        $this->assertSame('https://example.test/uploads/black.webp', $product->variants[0]->attributes['image_url']);
        $this->assertSame(8, $product->variants[0]->inventory->quantity);

        $black = $product->variants->firstWhere('sku', 'COLOR-MEDIA-001-BLK');
        $blue = $product->variants->firstWhere('sku', 'COLOR-MEDIA-001-BLU');
        $black->inventory->update(['reserved_quantity' => 2]);

        $updated = $this->putJson('/api/v1/admin/products/'.$product->id, [
            'images' => ['https://example.test/uploads/main-v2.webp'],
            'variants' => [
                [
                    'id' => $black->id,
                    'name' => 'مشکی',
                    'sku' => 'COLOR-MEDIA-001-BLK',
                    'price_override' => 1270000,
                    'stock' => 11,
                    'attributes' => ['color' => 'مشکی', 'image_url' => 'https://example.test/uploads/black-v2.webp'],
                ],
            ],
        ]);

        $updated->assertOk()->assertJsonPath('success', true);
        $product->refresh()->load('variants.inventory');
        $black->refresh()->load('inventory');
        $blue->refresh();

        $this->assertSame('https://example.test/uploads/black-v2.webp', $black->attributes['image_url']);
        $this->assertSame(11, $black->inventory->quantity);
        $this->assertSame(2, $black->inventory->reserved_quantity);
        $this->assertFalse($blue->is_active);
        $this->assertSame(['https://example.test/uploads/main-v2.webp'], $product->images);
    }

    public function test_admin_rejects_duplicate_variant_skus_with_an_actionable_error(): void
    {
        $this->actingAsAdmin();
        $category = Category::create([
            'name' => 'تجهیزات کنترل SKU',
            'slug' => 'sku-control-equipment',
            'is_active' => true,
            'sort_order' => 1,
        ]);

        $created = $this->postJson('/api/v1/admin/products', [
            'category_id' => $category->id,
            'name' => 'محصول کنترل رنگ',
            'slug' => 'variant-sku-control-product',
            'sku' => 'VARIANT-SKU-CONTROL-001',
            'base_price' => 1000000,
            'currency' => 'IRR',
            'variants' => [
                ['name' => 'زرد', 'sku' => 'VARIANT-SKU-CONTROL-001-Y', 'stock' => 5, 'attributes' => ['color' => 'زرد']],
                ['name' => 'بنفش', 'sku' => 'VARIANT-SKU-CONTROL-001-P', 'stock' => 3, 'attributes' => ['color' => 'بنفش']],
            ],
        ]);
        $created->assertCreated();
        $product = Product::with('variants')->where('sku', 'VARIANT-SKU-CONTROL-001')->firstOrFail();

        $duplicate = $this->putJson('/api/v1/admin/products/'.$product->id, [
            'variants' => [
                ['id' => $product->variants[0]->id, 'name' => 'زرد', 'sku' => 'VARIANT-SKU-CONTROL-001-DUP', 'stock' => 7, 'attributes' => ['color' => 'زرد']],
                ['id' => $product->variants[1]->id, 'name' => 'بنفش', 'sku' => 'VARIANT-SKU-CONTROL-001-DUP', 'stock' => 4, 'attributes' => ['color' => 'بنفش']],
            ],
        ]);

        $duplicate->assertUnprocessable()
            ->assertJsonPath('success', false)
            ->assertJsonPath('error_code', 'DUPLICATE_VARIANT_SKU');
    }

    public function test_admin_preserves_base_stock_without_colors_and_can_remove_existing_color_variants(): void
    {
        $this->actingAsAdmin();
        $category = Category::create([
            'name' => 'تجهیزات موجودی پایه',
            'slug' => 'base-inventory-equipment',
            'is_active' => true,
            'sort_order' => 1,
        ]);

        $created = $this->postJson('/api/v1/admin/products', [
            'category_id' => $category->id,
            'name' => 'محصول بدون رنگ با موجودی',
            'slug' => 'base-stock-product',
            'sku' => 'BASE-STOCK-001',
            'base_price' => 990000,
            'currency' => 'IRR',
            'is_active' => true,
            'initial_stock' => 12,
            'variants' => [],
        ]);

        $created->assertCreated()->assertJsonPath('success', true);
        $product = Product::with('variants.inventory')->where('sku', 'BASE-STOCK-001')->firstOrFail();
        $this->assertCount(1, $product->variants);
        $this->assertSame('Default', $product->variants->first()->name);
        $this->assertSame(12, $product->variants->first()->inventory->quantity);

        $updated = $this->putJson('/api/v1/admin/products/'.$product->id, [
            'initial_stock' => 7,
            'variants' => [],
        ]);

        $updated->assertOk()->assertJsonPath('success', true);
        $product->refresh()->load('variants.inventory');
        $this->assertCount(1, $product->variants->where('is_active', true));
        $this->assertSame('Default', $product->variants->firstWhere('is_active', true)->name);
        $this->assertSame(7, $product->variants->firstWhere('is_active', true)->inventory->quantity);
    }
}
