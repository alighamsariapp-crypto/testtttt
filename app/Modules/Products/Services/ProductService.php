<?php

namespace App\Modules\Products\Services;

use App\Modules\Inventory\Models\Inventory;
use App\Modules\Products\Models\Product;
use App\Modules\Products\Models\ProductVariant;
use App\Modules\Shared\Contracts\BaseServiceInterface;
use App\Modules\Shared\Exceptions\DomainException;
use App\Modules\Shared\Exceptions\EntityNotFoundException;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ProductService implements BaseServiceInterface
{
    public function __construct(
        private readonly FacetedCatalogService $facetedCatalog,
        private readonly ProductAttributeDefinitionService $attributeDefinitions,
    ) {
    }

    public function paginateCatalog(array $filters = [], int $perPage = 15): LengthAwarePaginator
    {
        return $this->facetedCatalog->paginate($filters, $perPage);
    }

    /** @return array<string, mixed> */
    public function catalogFacets(array $filters = []): array
    {
        return $this->facetedCatalog->facets($filters);
    }

    public function paginateForAdmin(int $perPage = 50): LengthAwarePaginator
    {
        return Product::query()
            ->with(['category:id,name,slug', 'variants.inventory'])
            ->orderByDesc('created_at')
            ->paginate(min(max($perPage, 1), 100));
    }

    public function findBySlug(string $slug): Product
    {
        $product = Product::where('slug', $slug)
            ->where('is_active', true)
            ->with(['category', 'variants.inventory'])
            ->first();

        if (!$product) {
            throw new EntityNotFoundException("Product with slug '{$slug}' not found.");
        }

        return $product;
    }

    public function createProduct(array $data): Product
    {
        return DB::transaction(function () use ($data) {
            if (empty($data['slug'])) {
                $data['slug'] = Str::slug($data['name']).'-'.Str::random(5);
            }

            if (!empty($data['variants'])) {
                $this->assertVariantPayloadIsValid($data['variants']);
            }
            $data['attributes'] = $this->synchronizeVariantFacetAttributes(
                is_array($data['attributes'] ?? null) ? $data['attributes'] : [],
                is_array($data['variants'] ?? null) ? $data['variants'] : []
            );
            $this->attributeDefinitions->validateProductAttributes(
                isset($data['category_id']) ? (int) $data['category_id'] : null,
                $data['attributes']
            );

            $product = Product::create($data);

            // Create default master variant if no variants specified
            if (empty($data['variants'])) {
                $variant = $product->variants()->create([
                    'name' => 'Default',
                    'sku' => $product->sku,
                    'price_override' => null,
                    'is_active' => true,
                ]);

                Inventory::create([
                    'product_variant_id' => $variant->id,
                    'quantity' => $data['initial_stock'] ?? 0,
                    'reserved_quantity' => 0,
                    'safety_threshold' => 0,
                ]);
            } else {
                foreach ($data['variants'] as $variantData) {
                    $variant = $product->variants()->create([
                        'name' => $variantData['name'],
                        'sku' => $variantData['sku'],
                        'price_override' => $variantData['price_override'] ?? null,
                        'attributes' => $variantData['attributes'] ?? null,
                        'is_active' => $variantData['is_active'] ?? true,
                    ]);

                    Inventory::create([
                        'product_variant_id' => $variant->id,
                        'quantity' => $variantData['stock'] ?? 0,
                        'reserved_quantity' => 0,
                        'safety_threshold' => $variantData['safety_threshold'] ?? 0,
                    ]);
                }
            }

            return $product->load(['category:id,name,slug', 'variants.inventory']);
        });
    }

    public function updateProduct(int $id, array $data): Product
    {
        try {
            return DB::transaction(function () use ($id, $data): Product {
            $product = Product::query()->lockForUpdate()->find($id);
            if (!$product) {
                throw new EntityNotFoundException('Product not found.');
            }

            $initialStock = array_key_exists('initial_stock', $data) ? max(0, (int) $data['initial_stock']) : null;
            $variants = array_key_exists('variants', $data) ? $data['variants'] : null;
            unset($data['initial_stock'], $data['variants']);
            $attributes = is_array($data['attributes'] ?? null) ? $data['attributes'] : ($product->attributes ?? []);
            if (is_array($variants)) {
                $attributes = $this->synchronizeVariantFacetAttributes($attributes, $variants);
                $data['attributes'] = $attributes;
            }
            $this->attributeDefinitions->validateProductAttributes(
                isset($data['category_id']) ? (int) $data['category_id'] : $product->category_id,
                $attributes
            );
            $product->update($data);

            if (is_array($variants)) {
                $this->assertVariantPayloadIsValid($variants, $product);

                if (empty($variants)) {
                    $masterVariant = $product->variants()->where('name', 'Default')->lockForUpdate()->first();
                    if (!$masterVariant) {
                        $masterVariant = $product->variants()->create([
                            'name' => 'Default',
                            'sku' => $product->sku,
                            'price_override' => null,
                            'attributes' => null,
                            'is_active' => true,
                        ]);
                    } else {
                        $masterVariant->update([
                            'sku' => $product->sku,
                            'price_override' => null,
                            'attributes' => null,
                            'is_active' => true,
                        ]);
                    }

                    $this->setInventoryQuantity($masterVariant->id, $initialStock ?? 0);
                    $product->variants()->whereKeyNot($masterVariant->id)->update(['is_active' => false]);
                } else {
                    $keptVariantIds = [];

                    foreach ($variants as $variantData) {
                        $variantId = isset($variantData['id']) ? (int) $variantData['id'] : null;
                        $variant = $variantId ? $product->variants()->whereKey($variantId)->lockForUpdate()->first() : null;
                        $variantPayload = [
                            'name' => $variantData['name'],
                            'sku' => $variantData['sku'],
                            'price_override' => $variantData['price_override'] ?? null,
                            'attributes' => $variantData['attributes'] ?? null,
                            'is_active' => $variantData['is_active'] ?? true,
                        ];

                        if ($variant) {
                            $variant->update($variantPayload);
                        } else {
                            $variant = $product->variants()->create($variantPayload);
                        }

                        $keptVariantIds[] = $variant->id;
                        $this->setInventoryQuantity($variant->id, max(0, (int) ($variantData['stock'] ?? 0)));
                    }

                    $product->variants()->whereNotIn('id', $keptVariantIds)->update(['is_active' => false]);
                }
            } elseif ($initialStock !== null) {
                $masterVariant = $product->variants()->where('name', 'Default')->lockForUpdate()->first()
                    ?? $product->variants()->orderBy('id')->lockForUpdate()->first();
                if ($masterVariant) {
                    $this->setInventoryQuantity($masterVariant->id, $initialStock);
                }
            }

            return $product->fresh(['variants.inventory', 'category']);
            }, 3);
        } catch (QueryException $exception) {
            $message = strtolower($exception->getMessage());
            if (str_contains($message, 'product_variants') && str_contains($message, 'sku')) {
                throw new DomainException('کد داخلی یکی از رنگ‌ها تکراری است. رنگ‌ها را یک‌بار باز کنید و دوباره ذخیره کنید.', 'DUPLICATE_VARIANT_SKU', 422);
            }

            throw new DomainException('ثبت تغییرات محصول انجام نشد. اطلاعات رنگ، قیمت و موجودی را بررسی کنید.', 'PRODUCT_UPDATE_FAILED', 422);
        }
    }

    /**
     * Validates the whole variant payload before any product or inventory row is changed.
     * This keeps create/update atomic and makes form mistakes actionable instead of DB 500s.
     *
     * @param array<int, array<string, mixed>> $variants
     */
    private function assertVariantPayloadIsValid(array $variants, ?Product $product = null): void
    {
        $seenSkus = [];
        $seenConfigurations = [];

        foreach ($variants as $variantData) {
            $sku = trim((string) ($variantData['sku'] ?? ''));
            if ($sku === '') {
                throw new DomainException('کد داخلی یکی از رنگ‌ها خالی است. فرم را یک‌بار باز و دوباره ذخیره کنید.', 'INVALID_VARIANT_SKU', 422);
            }

            $normalizedSku = strtolower($sku);
            if (isset($seenSkus[$normalizedSku])) {
                throw new DomainException('دو رنگ با یک کد داخلی یکسان ارسال شده‌اند. رنگ‌های تکراری را حذف کنید.', 'DUPLICATE_VARIANT_SKU', 422);
            }
            $seenSkus[$normalizedSku] = true;

            $attributes = is_array($variantData['attributes'] ?? null) ? $variantData['attributes'] : [];
            $configuration = $this->variantConfigurationSignature($attributes, (string) ($variantData['name'] ?? ''));
            if (isset($seenConfigurations[$configuration])) {
                $attributeKeys = collect(array_keys($attributes))
                    ->map(fn ($key) => Str::lower(trim((string) $key)))
                    ->filter(fn ($key) => $key !== '' && !in_array($key, ['image_url', 'image'], true))
                    ->values()
                    ->all();
                if (count($attributeKeys) === 1 && in_array($attributeKeys[0], ['color', 'رنگ'], true)) {
                    throw new DomainException('هر رنگ فقط باید یک‌بار در محصول ثبت شود.', 'DUPLICATE_VARIANT_COLOR', 422);
                }
                throw new DomainException('دو ترکیب فروش یکسان ثبت شده‌اند. رنگ و پیکربندی هر ردیف باید یکتا باشد.', 'DUPLICATE_VARIANT_CONFIGURATION', 422);
            }
            $seenConfigurations[$configuration] = true;

            $variantId = isset($variantData['id']) ? (int) $variantData['id'] : null;
            $existingVariant = $variantId ? ProductVariant::query()->find($variantId) : null;
            if ($variantId && (!$existingVariant || !$product || $existingVariant->product_id !== $product->id)) {
                throw new DomainException('variant انتخاب‌شده متعلق به این کالا نیست. فرم را تازه‌سازی کنید.', 'INVALID_PRODUCT_VARIANT', 422);
            }

            $collision = ProductVariant::query()->where('sku', $sku)->first();
            if ($collision && (!$variantId || $collision->id !== $variantId)) {
                throw new DomainException('کد داخلی یکی از رنگ‌ها با کالای دیگری تداخل دارد. رنگ‌ها را دوباره ذخیره کنید.', 'DUPLICATE_VARIANT_SKU', 422);
            }
        }
    }

    /**
     * Builds a stable signature from sellable option values only. Image metadata must not
     * allow the same color/configuration to be saved as a second variant.
     *
     * @param array<string, mixed> $attributes
     */
    private function variantConfigurationSignature(array $attributes, string $fallbackName): string
    {
        $parts = [];
        foreach ($attributes as $key => $value) {
            $normalizedKey = Str::lower(trim((string) $key));
            if ($normalizedKey === '' || in_array($normalizedKey, ['image_url', 'image'], true) || is_array($value) || is_object($value)) {
                continue;
            }

            $normalizedValue = Str::lower(trim(preg_replace('/\s+/u', ' ', (string) $value) ?? ''));
            if ($normalizedValue !== '') {
                $parts[$normalizedKey] = $normalizedValue;
            }
        }

        if ($parts === []) {
            $fallback = Str::lower(trim(preg_replace('/\s+/u', ' ', $fallbackName) ?? ''));
            return 'name:'.($fallback !== '' ? $fallback : 'default');
        }

        ksort($parts);
        return json_encode($parts, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: 'invalid';
    }

    /**
     * Copies only the declared sellable axes into product attributes. Catalog filters keep
     * querying one compact JSON document, while price and stock stay on product variants.
     *
     * @param array<string, mixed> $attributes
     * @param array<int, array<string, mixed>> $variants
     * @return array<string, mixed>
     */
    private function synchronizeVariantFacetAttributes(array $attributes, array $variants): array
    {
        $axes = is_array($attributes['novinet_variant_axes'] ?? null) ? $attributes['novinet_variant_axes'] : [];
        foreach ($axes as $axis) {
            $key = is_array($axis) ? trim((string) ($axis['key'] ?? '')) : '';
            if ($key === '') {
                continue;
            }

            $values = collect($variants)
                ->map(fn (array $variant) => $variant['attributes'][$key] ?? null)
                ->filter(fn ($value) => is_string($value) || is_numeric($value) || is_bool($value))
                ->map(fn ($value) => trim((string) $value))
                ->filter()
                ->unique()
                ->values()
                ->all();

            if ($values !== []) {
                $attributes[$key] = $values;
            } else {
                unset($attributes[$key]);
            }
        }

        return $attributes;
    }

    private function setInventoryQuantity(int $variantId, int $quantity): Inventory
    {
        $inventory = Inventory::query()
            ->where('product_variant_id', $variantId)
            ->lockForUpdate()
            ->first();

        if (!$inventory) {
            return Inventory::create([
                'product_variant_id' => $variantId,
                'quantity' => $quantity,
                'reserved_quantity' => 0,
                'safety_threshold' => 0,
            ]);
        }

        if ($quantity < $inventory->reserved_quantity) {
            throw new DomainException(
                "موجودی جدید نمی‌تواند از {$inventory->reserved_quantity} واحد رزروشده کمتر باشد.",
                'INVENTORY_BELOW_RESERVED',
                422
            );
        }

        $inventory->update(['quantity' => $quantity]);

        return $inventory;
    }

    public function deleteProduct(int $id): void
    {
        $product = Product::find($id);
        if (!$product) {
            throw new EntityNotFoundException('Product not found.');
        }

        $product->delete();
    }
}
