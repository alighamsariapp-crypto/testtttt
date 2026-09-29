<?php

namespace App\Modules\Products\Services;

use App\Modules\Categories\Models\Category;
use App\Modules\Products\Models\ProductAttributeDefinition;
use App\Modules\Shared\Exceptions\DomainException;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class ProductAttributeDefinitionService
{
    private ?bool $schemaAvailable = null;

    /** @return Collection<int, ProductAttributeDefinition> */
    public function forCategory(?int $categoryId): Collection
    {
        if (!$this->hasFacetSchema()) {
            return new Collection();
        }

        if (!$categoryId) {
            return ProductAttributeDefinition::query()
                ->where('is_active', true)
                ->orderBy('sort_order')
                ->get();
        }

        $lineage = $this->lineage($categoryId);
        if ($lineage === []) {
            return new Collection();
        }

        $assignments = ProductAttributeDefinition::query()
            ->where('is_active', true)
            ->whereHas('categories', fn ($query) => $query->whereIn('categories.id', $lineage))
            ->with(['categories' => fn ($query) => $query->whereIn('categories.id', $lineage)])
            ->orderBy('sort_order')
            ->get();

        $byKey = [];
        foreach ($lineage as $distance => $lineageCategoryId) {
            foreach ($assignments as $definition) {
                $assignment = $definition->categories->firstWhere('id', $lineageCategoryId)?->pivot;
                if (!$assignment || ($distance > 0 && !$assignment->inherit_to_children) || isset($byKey[$definition->key])) {
                    continue;
                }

                $definition->setAttribute('category_config', [
                    'is_filterable' => (bool) $assignment->is_filterable,
                    'is_required' => (bool) $assignment->is_required,
                    'sort_order' => (int) $assignment->sort_order,
                ]);
                $byKey[$definition->key] = $definition;
            }
        }

        return (new Collection(array_values($byKey)))
            ->sortBy(fn (ProductAttributeDefinition $definition) => $definition->getAttribute('category_config')['sort_order'] ?? $definition->sort_order)
            ->values();
    }

    /** @return array<int, string> */
    public function filterableKeys(?int $categoryId): array
    {
        return $this->forCategory($categoryId)
            ->filter(fn (ProductAttributeDefinition $definition) => (bool) ($definition->getAttribute('category_config')['is_filterable'] ?? $definition->is_filterable))
            ->pluck('key')
            ->all();
    }

    /** @param array<string, mixed> $attributes */
    public function validateProductAttributes(?int $categoryId, array $attributes): void
    {
        foreach ($this->forCategory($categoryId) as $definition) {
            $config = $definition->getAttribute('category_config') ?? [];
            $isRequired = (bool) ($config['is_required'] ?? $definition->is_required);
            $hasValue = array_key_exists($definition->key, $attributes) && $attributes[$definition->key] !== null && $attributes[$definition->key] !== '';

            if ($isRequired && !$hasValue) {
                throw new DomainException("ثبت مقدار «{$definition->name}» برای این دسته الزامی است.", 'REQUIRED_PRODUCT_ATTRIBUTE', 422);
            }
            if (!$hasValue) {
                continue;
            }

            $value = $attributes[$definition->key];
            if ($definition->data_type === 'number' && !is_numeric($value)) {
                throw new DomainException("مقدار «{$definition->name}» باید عددی باشد.", 'INVALID_PRODUCT_ATTRIBUTE', 422);
            }
            if ($definition->data_type === 'boolean' && !is_bool($value) && !in_array($value, [0, 1, '0', '1'], true)) {
                throw new DomainException("مقدار «{$definition->name}» باید درست یا نادرست باشد.", 'INVALID_PRODUCT_ATTRIBUTE', 422);
            }
            if ($definition->data_type === 'multi_select' && !is_array($value) && !is_string($value)) {
                throw new DomainException("مقدار «{$definition->name}» نامعتبر است.", 'INVALID_PRODUCT_ATTRIBUTE', 422);
            }

            $allowedOptions = collect($definition->options ?? [])->map(fn ($option) => Str::lower(trim((string) $option)))->filter()->all();
            if ($allowedOptions === []) {
                continue;
            }

            foreach ((array) $value as $option) {
                if (!in_array(Str::lower(trim((string) $option)), $allowedOptions, true)) {
                    throw new DomainException("گزینهٔ «{$option}» برای «{$definition->name}» مجاز نیست.", 'INVALID_PRODUCT_ATTRIBUTE_OPTION', 422);
                }
            }
        }
    }

    /** @param array<int, array<string, mixed>> $definitions */
    public function syncCategoryDefinitions(int $categoryId, array $definitions): void
    {
        if (!$this->hasFacetSchema()) {
            throw new DomainException('ساختار ویژگی‌های دسته‌ای هنوز روی سرور فعال نشده است. ابتدا migration فروشگاه را اجرا کنید.', 'PRODUCT_ATTRIBUTE_SCHEMA_MISSING', 503);
        }

        $sync = [];
        foreach ($definitions as $definition) {
            $id = (int) $definition['id'];
            $sync[$id] = [
                'is_filterable' => $definition['is_filterable'] ?? true,
                'is_required' => $definition['is_required'] ?? false,
                'inherit_to_children' => $definition['inherit_to_children'] ?? true,
                'sort_order' => $definition['sort_order'] ?? 100,
                'created_at' => now(),
                'updated_at' => now(),
            ];
        }

        Category::query()->findOrFail($categoryId)->productAttributeDefinitions()->sync($sync);
    }

    /** @return array<int, int> */
    private function lineage(int $categoryId): array
    {
        $lineage = [];
        $currentId = $categoryId;
        while ($currentId && !in_array($currentId, $lineage, true)) {
            $lineage[] = $currentId;
            $currentId = Category::query()->whereKey($currentId)->value('parent_id');
        }
        return $lineage;
    }

    private function hasFacetSchema(): bool
    {
        return $this->schemaAvailable ??= Schema::hasTable('product_attribute_definitions')
            && Schema::hasTable('category_product_attribute');
    }
}
