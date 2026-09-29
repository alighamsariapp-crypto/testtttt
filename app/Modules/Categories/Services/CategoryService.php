<?php

namespace App\Modules\Categories\Services;

use App\Modules\Categories\Models\Category;
use App\Modules\Shared\Contracts\BaseServiceInterface;
use App\Modules\Shared\Exceptions\EntityNotFoundException;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class CategoryService implements BaseServiceInterface
{
    private const CACHE_KEY_TREE = 'categories:tree';

    public function getCategoryTree(): Collection
    {
        return Cache::remember(self::CACHE_KEY_TREE, 3600, function () {
            return Category::whereNull('parent_id')
                ->where('is_active', true)
                ->with(['children' => function ($query) {
                    $query->where('is_active', true)->with('children');
                }])
                ->orderBy('sort_order', 'asc')
                ->get();
        });
    }

    public function getAllForAdmin(): Collection
    {
        return Category::query()
            ->with(['parent', 'children'])
            ->orderBy('sort_order', 'asc')
            ->orderBy('name')
            ->get();
    }

    public function findBySlug(string $slug): Category
    {
        $category = Category::where('slug', $slug)
            ->where('is_active', true)
            ->with(['parent', 'children'])
            ->first();

        if (!$category) {
            throw new EntityNotFoundException("Category with slug '{$slug}' was not found.");
        }

        return $category;
    }

    public function createCategory(array $data): Category
    {
        if (empty($data['slug'])) {
            $data['slug'] = $this->makeSlug((string) $data['name']);
        }

        $category = Category::create($data);
        $this->invalidateCache();

        return $category;
    }

    public function updateCategory(int $id, array $data): Category
    {
        $category = Category::find($id);
        if (!$category) {
            throw new EntityNotFoundException('Category not found.');
        }

        $category->update($data);
        $this->invalidateCache();

        return $category->fresh();
    }

    public function deleteCategory(int $id): void
    {
        $category = Category::find($id);
        if (!$category) {
            throw new EntityNotFoundException('Category not found.');
        }

        if ($category->children()->exists()) {
            throw ValidationException::withMessages([
                'category' => 'این دسته زیردسته دارد. ابتدا زیردسته‌ها را منتقل یا غیرفعال کنید.',
            ]);
        }

        if ($category->products()->exists()) {
            throw ValidationException::withMessages([
                'category' => 'این دسته دارای محصول است. ابتدا محصولات را به دستهٔ دیگری منتقل کنید.',
            ]);
        }

        $category->delete();
        $this->invalidateCache();
    }

    public function invalidateCache(): void
    {
        Cache::forget(self::CACHE_KEY_TREE);
    }

    private function makeSlug(string $name): string
    {
        $slug = Str::slug($name);
        return $slug !== '' ? $slug : 'category-'.substr(sha1($name), 0, 12);
    }
}
