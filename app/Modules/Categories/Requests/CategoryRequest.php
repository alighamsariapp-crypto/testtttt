<?php

namespace App\Modules\Categories\Requests;

use App\Modules\Categories\Models\Category;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class CategoryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isAdmin() || $this->user()?->isStaff();
    }

    public function rules(): array
    {
        $categoryId = $this->route('id') ?? $this->route('category');
        $required = $this->isMethod('post') ? 'required' : 'sometimes';

        return [
            'parent_id' => ['nullable', 'exists:categories,id'],
            'name' => [$required, 'string', 'max:255'],
            'slug' => ['nullable', 'string', 'max:255', 'unique:categories,slug,'.($categoryId ? (int) $categoryId : 'NULL')],
            'description' => ['nullable', 'string'],
            'image_url' => ['nullable', 'url', 'max:2048'],
            'is_active' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer'],
            'meta_title' => ['nullable', 'string', 'max:255'],
            'meta_description' => ['nullable', 'string', 'max:500'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            $categoryId = (int) ($this->route('id') ?? $this->route('category') ?? 0);
            $parentId = $this->input('parent_id');

            if (! $parentId) {
                return;
            }

            if ((int) $parentId === $categoryId) {
                $validator->errors()->add('parent_id', 'یک دسته نمی‌تواند والد خودش باشد.');
                return;
            }

            $parent = Category::find($parentId);
            if ($parent && ! $parent->is_active) {
                $validator->errors()->add('parent_id', 'برای زیردسته باید یک دستهٔ والد فعال انتخاب شود.');
            }

            if ($categoryId && $this->isDescendantOf((int) $parentId, $categoryId)) {
                $validator->errors()->add('parent_id', 'والد انتخاب‌شده یکی از زیردسته‌های همین مورد است و حلقه ایجاد می‌کند.');
            }
        });
    }

    private function isDescendantOf(int $candidateId, int $categoryId): bool
    {
        $current = Category::find($candidateId);
        $visited = [];

        while ($current && ! isset($visited[$current->id])) {
            if ($current->parent_id === $categoryId) {
                return true;
            }

            $visited[$current->id] = true;
            $current = $current->parent;
        }

        return false;
    }
}
