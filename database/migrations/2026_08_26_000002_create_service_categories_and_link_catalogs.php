<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('service_categories')) {
            Schema::create('service_categories', function (Blueprint $table) {
                $table->id();
                $table->string('name', 100)->unique();
                $table->string('slug', 120)->unique();
                $table->text('description')->nullable();
                $table->boolean('is_active')->default(true)->index();
                $table->unsignedInteger('sort_order')->default(0)->index();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('service_catalogs')) {
            return;
        }

        if (! Schema::hasColumn('service_catalogs', 'service_category_id')) {
            Schema::table('service_catalogs', function (Blueprint $table) {
                $table->unsignedBigInteger('service_category_id')->nullable()->after('category')->index();
            });
        }

        DB::transaction(function () {
            $categories = DB::table('service_catalogs')
                ->select('category')
                ->whereNotNull('category')
                ->where('category', '<>', '')
                ->distinct()
                ->pluck('category');

            foreach ($categories as $position => $rawName) {
                $name = trim((string) $rawName) ?: 'خدمات آنلاین';
                $category = DB::table('service_categories')->where('name', $name)->first();

                if (! $category) {
                    $slug = Str::slug($name);
                    if ($slug === '') {
                        $slug = 'service-category-'.substr(sha1($name), 0, 12);
                    }

                    $id = DB::table('service_categories')->insertGetId([
                        'name' => $name,
                        'slug' => $slug,
                        'is_active' => true,
                        'sort_order' => ($position + 1) * 10,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                } else {
                    $id = $category->id;
                }

                DB::table('service_catalogs')
                    ->where('category', $rawName)
                    ->whereNull('service_category_id')
                    ->update(['service_category_id' => $id]);
            }
        });
    }

    public function down(): void
    {
        if (Schema::hasTable('service_catalogs') && Schema::hasColumn('service_catalogs', 'service_category_id')) {
            Schema::table('service_catalogs', function (Blueprint $table) {
                $table->dropIndex(['service_category_id']);
                $table->dropColumn('service_category_id');
            });
        }

        Schema::dropIfExists('service_categories');
    }
};
