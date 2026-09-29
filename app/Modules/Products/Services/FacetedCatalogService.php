<?php

namespace App\Modules\Products\Services;

use App\Modules\Categories\Models\Category;
use App\Modules\Products\Models\Product;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;

class FacetedCatalogService
{
    public function __construct(private readonly ProductAttributeDefinitionService $attributeDefinitions)
    {
    }

    public function paginate(array $filters = [], int $perPage = 15): LengthAwarePaginator
    {
        $query = $this->catalogQuery($filters);
        match ($filters['sort'] ?? 'newest') {
            'price_asc' => $query->orderBy('base_price', 'asc'),
            'price_desc' => $query->orderBy('base_price', 'desc'),
            'name_asc' => $query->orderBy('name', 'asc'),
            default => $query->orderBy('created_at', 'desc'),
        };

        return $query->paginate(min(max($perPage, 1), 100));
    }

    /** @return array<string, mixed> */
    public function facets(array $filters = []): array
    {
        $categoryId = $this->resolveCategoryId($filters);
        $definitions = $this->attributeDefinitions->forCategory($categoryId)
            ->filter(fn ($definition) => (bool) ($definition->getAttribute('category_config')['is_filterable'] ?? $definition->is_filterable));

        $items = [];
        foreach ($definitions as $definition) {
            $withoutThisFacet = $filters;
            unset($withoutThisFacet['facets'][$definition->key]);
            $products = $this->catalogQuery($withoutThisFacet)->get(['id', 'attributes']);
            $counts = $this->countAttributeValues($products, $definition->key);
            $selected = Arr::wrap($filters['facets'][$definition->key] ?? []);
            $options = collect($definition->options ?? [])
                ->map(fn ($value) => (string) $value)
                ->merge($counts->keys())
                ->unique()
                ->filter(fn (string $value) => $counts->has($value) || in_array($value, $selected, true))
                ->map(fn (string $value) => ['value' => $value, 'label' => $value, 'count' => $counts->get($value, 0)])
                ->values();

            if ($options->isEmpty()) {
                continue;
            }

            $items[] = [
                'key' => $definition->key,
                'label' => $definition->name,
                'type' => $definition->data_type,
                'unit' => $definition->unit,
                'sort_order' => $definition->getAttribute('category_config')['sort_order'] ?? $definition->sort_order,
                'options' => $options,
            ];
        }

        $priceScope = $this->catalogQuery(Arr::except($filters, ['min_price', 'max_price']));
        $price = $priceScope->selectRaw('MIN(base_price) as min_price, MAX(base_price) as max_price')->first();

        return [
            'category_id' => $categoryId,
            'price' => ['min' => (int) ($price->min_price ?? 0), 'max' => (int) ($price->max_price ?? 0)],
            'availability_count' => $this->catalogQuery([...$filters, 'in_stock' => true])->count(),
            'facets' => collect($items)->sortBy('sort_order')->values(),
        ];
    }

    public function catalogQuery(array $filters = []): Builder
    {
        $query = Product::query()
            ->where('is_active', true)
            ->with(['category:id,name,slug', 'variants.inventory']);

        $categoryIds = $this->resolveCategoryIds($filters);
        if ($categoryIds !== []) {
            $query->whereIn('category_id', $categoryIds);
        }

        if (!empty($filters['search'])) {
            $term = trim((string) $filters['search']);
            $query->where(fn (Builder $builder) => $builder
                ->where('name', 'LIKE', "%{$term}%")
                ->orWhere('sku', 'LIKE', "%{$term}%")
                ->orWhere('description', 'LIKE', "%{$term}%"));
        }

        if (!empty($filters['featured'])) {
            $query->where('is_featured', true);
        }
        if (array_key_exists('min_price', $filters) && $filters['min_price'] !== null) {
            $query->where('base_price', '>=', (int) $filters['min_price']);
        }
        if (array_key_exists('max_price', $filters) && $filters['max_price'] !== null) {
            $query->where('base_price', '<=', (int) $filters['max_price']);
        }
        if (!empty($filters['in_stock'])) {
            $query->whereHas('variants', fn (Builder $variantQuery) => $variantQuery
                ->where('is_active', true)
                ->whereHas('inventory', fn (Builder $inventoryQuery) => $inventoryQuery->whereRaw('quantity > reserved_quantity')));
        }

        $facets = is_array($filters['facets'] ?? null) ? $filters['facets'] : [];
        if (!empty($filters['brand'])) {
            $facets['brand'] = array_merge(Arr::wrap($facets['brand'] ?? []), [trim((string) $filters['brand'])]);
        }
        $allowedKeys = $this->attributeDefinitions->filterableKeys($this->resolveCategoryId($filters));
        foreach ($facets as $key => $values) {
            if (!in_array($key, $allowedKeys, true)) {
                continue;
            }
            $values = collect(Arr::wrap($values))->map(fn ($value) => trim((string) $value))->filter()->unique()->values();
            if ($values->isEmpty()) {
                continue;
            }
            $query->where(function (Builder $facetQuery) use ($key, $values) {
                foreach ($values as $value) {
                    $facetQuery->orWhere("attributes->{$key}", $value)
                        ->orWhereJsonContains("attributes->{$key}", $value);
                }
            });
        }

        return $query;
    }

    private function resolveCategoryId(array $filters): ?int
    {
        if (!empty($filters['category_id'])) {
            return (int) $filters['category_id'];
        }
        if (!empty($filters['category_slug'])) {
            return Category::query()->where('slug', $filters['category_slug'])->value('id');
        }
        return null;
    }

    /** @return array<int, int> */
    private function resolveCategoryIds(array $filters): array
    {
        $categoryId = $this->resolveCategoryId($filters);
        if (!$categoryId) {
            return [];
        }

        $categories = Category::query()->select(['id', 'parent_id'])->get();
        $ids = [$categoryId];
        $cursor = 0;
        while (isset($ids[$cursor])) {
            $parentId = $ids[$cursor++];
            foreach ($categories->where('parent_id', $parentId) as $child) {
                if (!in_array($child->id, $ids, true)) {
                    $ids[] = $child->id;
                }
            }
        }
        return $ids;
    }

    /** @param Collection<int, Product> $products */
    private function countAttributeValues(Collection $products, string $key): Collection
    {
        $counts = collect();
        foreach ($products as $product) {
            $values = Arr::wrap($product->attributes[$key] ?? null);
            foreach ($values as $value) {
                $normalized = trim((string) $value);
                if ($normalized !== '') {
                    $counts[$normalized] = ($counts[$normalized] ?? 0) + 1;
                }
            }
        }
        return $counts;
    }
}
