<?php

namespace Tests\Feature;

use App\Modules\Categories\Models\Category;
use App\Modules\Products\Models\ProductAttributeDefinition;
use Tests\TestCase;

class CategoryProductAttributeManagementTest extends TestCase
{
    public function test_admin_can_define_selectable_ram_and_storage_attributes_for_a_category(): void
    {
        $category = Category::create([
            'name' => 'Laptop category',
            'slug' => 'laptop-category',
            'is_active' => true,
        ]);

        $this->actingAsAdmin();

        $ram = $this->postJson('/api/v1/admin/product-attributes', [
            'key' => 'test_ram_axis',
            'name' => 'RAM',
            'data_type' => 'single_select',
            'unit' => 'GB',
            'options' => ['8GB', '16GB', '32GB'],
            'is_filterable' => true,
            'is_required' => false,
            'is_active' => true,
            'sort_order' => 10,
        ])->assertCreated()->json('data');

        $storage = $this->postJson('/api/v1/admin/product-attributes', [
            'key' => 'test_storage_axis',
            'name' => 'Storage',
            'data_type' => 'single_select',
            'unit' => 'GB',
            'options' => ['256GB', '512GB', '1TB'],
            'is_filterable' => true,
            'is_required' => false,
            'is_active' => true,
            'sort_order' => 20,
        ])->assertCreated()->json('data');

        $this->putJson('/api/v1/admin/categories/'.$category->id.'/product-attributes', [
            'definitions' => [
                [
                    'id' => $ram['id'],
                    'is_filterable' => true,
                    'is_required' => false,
                    'inherit_to_children' => true,
                    'sort_order' => 10,
                ],
                [
                    'id' => $storage['id'],
                    'is_filterable' => true,
                    'is_required' => false,
                    'inherit_to_children' => true,
                    'sort_order' => 20,
                ],
            ],
        ])->assertOk();

        $this->assertDatabaseHas('category_product_attribute', [
            'category_id' => $category->id,
            'product_attribute_definition_id' => $ram['id'],
            'inherit_to_children' => true,
        ]);
        $this->assertDatabaseHas('category_product_attribute', [
            'category_id' => $category->id,
            'product_attribute_definition_id' => $storage['id'],
            'inherit_to_children' => true,
        ]);

        $this->assertSame(['8GB', '16GB', '32GB'], ProductAttributeDefinition::query()->findOrFail($ram['id'])->options);
        $this->assertSame(['256GB', '512GB', '1TB'], ProductAttributeDefinition::query()->findOrFail($storage['id'])->options);
    }
}
