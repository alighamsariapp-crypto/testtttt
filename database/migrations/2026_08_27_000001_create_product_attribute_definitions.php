<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('product_attribute_definitions')) {
            Schema::create('product_attribute_definitions', function (Blueprint $table) {
                $table->id();
                $table->string('key', 80)->unique();
                $table->string('name', 120);
                $table->string('data_type', 32)->default('single_select');
                $table->string('unit', 32)->nullable();
                $table->json('options')->nullable();
                $table->boolean('is_filterable')->default(true)->index();
                $table->boolean('is_required')->default(false);
                $table->boolean('is_active')->default(true)->index();
                $table->unsignedInteger('sort_order')->default(100);
                $table->timestamps();
            });
        }

        // Laravel derives a foreign-key name longer than MySQL's 64-character
        // limit for product_attribute_definition_id. Explicit short names also
        // let this migration recover after its original partial table creation.
        if (!Schema::hasTable('category_product_attribute')) {
            Schema::create('category_product_attribute', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('category_id');
                $table->unsignedBigInteger('product_attribute_definition_id');
                $table->boolean('is_filterable')->default(true);
                $table->boolean('is_required')->default(false);
                $table->boolean('inherit_to_children')->default(true);
                $table->unsignedInteger('sort_order')->default(100);
                $table->timestamps();
                $table->unique(['category_id', 'product_attribute_definition_id'], 'cpa_category_attribute_unique');
            });
        }

        $this->ensureForeignKey('category_product_attribute', 'category_id', 'categories', 'cpa_category_fk');
        $this->ensureForeignKey('category_product_attribute', 'product_attribute_definition_id', 'product_attribute_definitions', 'cpa_attribute_definition_fk');

        $now = now();
        $definitions = [
            ['key' => 'brand', 'name' => 'برند سازنده', 'data_type' => 'single_select', 'unit' => null, 'sort_order' => 10],
            ['key' => 'processor', 'name' => 'پردازنده (CPU)', 'data_type' => 'single_select', 'unit' => null, 'sort_order' => 20],
            ['key' => 'ram', 'name' => 'حافظهٔ RAM', 'data_type' => 'single_select', 'unit' => 'GB', 'sort_order' => 30],
            ['key' => 'storage', 'name' => 'حافظهٔ داخلی / SSD', 'data_type' => 'single_select', 'unit' => 'GB', 'sort_order' => 40],
            ['key' => 'gpu', 'name' => 'کارت گرافیک (GPU)', 'data_type' => 'single_select', 'unit' => null, 'sort_order' => 50],
            ['key' => 'screen_size', 'name' => 'اندازهٔ نمایشگر', 'data_type' => 'number', 'unit' => 'inch', 'sort_order' => 60],
            ['key' => 'usage_type', 'name' => 'نوع کاربری', 'data_type' => 'multi_select', 'unit' => null, 'sort_order' => 70],
            ['key' => 'network_generation', 'name' => 'نسل شبکه', 'data_type' => 'multi_select', 'unit' => null, 'sort_order' => 20],
            ['key' => 'modem_type', 'name' => 'نوع مودم', 'data_type' => 'single_select', 'unit' => null, 'sort_order' => 30],
            ['key' => 'wifi_standard', 'name' => 'استاندارد Wi‑Fi', 'data_type' => 'multi_select', 'unit' => null, 'sort_order' => 40],
            ['key' => 'ethernet_ports', 'name' => 'تعداد پورت شبکه', 'data_type' => 'number', 'unit' => 'port', 'sort_order' => 50],
            ['key' => 'sim_support', 'name' => 'پشتیبانی از سیم‌کارت', 'data_type' => 'boolean', 'unit' => null, 'sort_order' => 60],
            ['key' => 'battery_capacity', 'name' => 'ظرفیت باتری', 'data_type' => 'number', 'unit' => 'mAh', 'sort_order' => 60],
            ['key' => 'primary_camera', 'name' => 'دوربین اصلی', 'data_type' => 'number', 'unit' => 'MP', 'sort_order' => 70],
            ['key' => 'nfc', 'name' => 'NFC', 'data_type' => 'boolean', 'unit' => null, 'sort_order' => 80],
        ];

        foreach ($definitions as $definition) {
            DB::table('product_attribute_definitions')->updateOrInsert(
                ['key' => $definition['key']],
                [...$definition, 'options' => null, 'is_filterable' => true, 'is_required' => false, 'is_active' => true, 'created_at' => $now, 'updated_at' => $now]
            );
        }

        $definitionIds = DB::table('product_attribute_definitions')->pluck('id', 'key');
        $profiles = [
            'laptops' => ['brand', 'processor', 'ram', 'storage', 'gpu', 'screen_size', 'usage_type'],
            'mobile' => ['brand', 'storage', 'ram', 'network_generation', 'screen_size', 'battery_capacity', 'primary_camera', 'sim_support', 'nfc'],
            'modem' => ['brand', 'network_generation', 'modem_type', 'wifi_standard', 'ethernet_ports', 'sim_support'],
            'modem-and-network' => ['brand', 'network_generation', 'modem_type', 'wifi_standard', 'ethernet_ports', 'sim_support'],
        ];

        foreach ($profiles as $categorySlug => $keys) {
            $categoryId = DB::table('categories')->where('slug', $categorySlug)->value('id');
            if (!$categoryId) {
                continue;
            }

            foreach ($keys as $position => $key) {
                if (!isset($definitionIds[$key])) {
                    continue;
                }

                DB::table('category_product_attribute')->updateOrInsert(
                    ['category_id' => $categoryId, 'product_attribute_definition_id' => $definitionIds[$key]],
                    ['is_filterable' => true, 'is_required' => false, 'inherit_to_children' => true, 'sort_order' => ($position + 1) * 10, 'created_at' => $now, 'updated_at' => $now]
                );
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('category_product_attribute');
        Schema::dropIfExists('product_attribute_definitions');
    }

    private function ensureForeignKey(string $tableName, string $column, string $referencedTable, string $constraintName): void
    {
        if ($this->foreignKeyExists($tableName, $column)) {
            return;
        }

        Schema::table($tableName, function (Blueprint $table) use ($column, $referencedTable, $constraintName) {
            $table->foreign($column, $constraintName)
                ->references('id')
                ->on($referencedTable)
                ->cascadeOnDelete();
        });
    }

    private function foreignKeyExists(string $tableName, string $column): bool
    {
        if (DB::getDriverName() !== 'mysql') {
            return false;
        }

        return DB::table('information_schema.KEY_COLUMN_USAGE')
            ->where('TABLE_SCHEMA', DB::raw('DATABASE()'))
            ->where('TABLE_NAME', $tableName)
            ->where('COLUMN_NAME', $column)
            ->whereNotNull('REFERENCED_TABLE_NAME')
            ->exists();
    }
};
