<?php

namespace Database\Seeders;

use App\Modules\Categories\Models\Category;
use App\Modules\Inventory\Models\Inventory;
use App\Modules\Products\Models\Product;
use App\Modules\Products\Models\ProductVariant;
use App\Modules\Services\Models\ServiceCatalog;
use App\Modules\Users\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use RuntimeException;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        if (app()->environment('production')) {
            $adminEmail = trim((string) env('INITIAL_ADMIN_EMAIL'));
            $admin = $adminEmail !== '' ? User::where('email', $adminEmail)->first() : null;

            if (!$admin) {
                $adminName = trim((string) env('INITIAL_ADMIN_NAME'));
                $adminPhone = trim((string) env('INITIAL_ADMIN_PHONE'));
                $adminPassword = (string) env('INITIAL_ADMIN_PASSWORD');

                if ($adminEmail === '' || $adminName === '' || $adminPhone === '' || $adminPassword === '') {
                    throw new RuntimeException(
                        'Set INITIAL_ADMIN_NAME, INITIAL_ADMIN_EMAIL, INITIAL_ADMIN_PHONE, and INITIAL_ADMIN_PASSWORD in .env before seeding production.'
                    );
                }

                $admin = User::create([
                    'name' => $adminName,
                    'email' => $adminEmail,
                    'phone' => $adminPhone,
                    'password' => Hash::make($adminPassword),
                    'email_verified_at' => now(),
                    'role' => User::ROLE_ADMIN,
                    'status' => User::STATUS_ACTIVE,
                ]);
            }

            $admin->role = User::ROLE_ADMIN;
            $admin->status = User::STATUS_ACTIVE;
            $admin->save();

            // Demo catalogue and sample account are never seeded in production unless explicitly requested.
            if (!filter_var(env('SEED_DEMO_DATA', false), FILTER_VALIDATE_BOOLEAN)) {
                return;
            }
        }

        // 1. Seed Initial Admin User for local/test environments and opted-in demo environments.
        $admin = User::firstOrCreate(
            ['email' => 'admin@apexstore.local'],
            [
                'name' => 'System Administrator',
                'phone' => null,
                'password' => Hash::make(Str::random(64)),
                'email_verified_at' => now(),
            ]
        );
        $admin->role = User::ROLE_ADMIN;
        $admin->status = User::STATUS_ACTIVE;
        $admin->save();

        // 2. Seed Customer User
        $customer = User::firstOrCreate(
            ['email' => 'customer@apexstore.local'],
            [
                'name' => 'Customer Demo',
                'phone' => null,
                'password' => Hash::make(Str::random(64)),
                'email_verified_at' => now(),
            ]
        );
        $customer->role = User::ROLE_CUSTOMER;
        $customer->status = User::STATUS_ACTIVE;
        $customer->save();

        // 3. Seed Product Categories
        $catHardware = Category::firstOrCreate(
            ['slug' => 'industrial-hardware'],
            [
                'name' => 'تجهیزات صنعتی و سخت‌افزار',
                'description' => 'انواع قطعات، ماژول‌ها و تجهیزات صنعتی و اتوماسیون',
                'is_active' => true,
                'sort_order' => 1,
            ]
        );

        $catNetwork = Category::firstOrCreate(
            ['slug' => 'networking-equipment'],
            [
                'name' => 'تجهیزات شبکه و مخابرات',
                'description' => 'روترها، سوئیچ‌ها و بردهای شبکه پیشرفته',
                'is_active' => true,
                'sort_order' => 2,
            ]
        );

        // 4. Seed Products & Inventory
        $product1 = Product::firstOrCreate(
            ['sku' => 'NVN-SRV-01'],
            [
                'category_id' => $catHardware->id,
                'name' => 'کنترلر صنعتی پیشرفته ApexCore X1',
                'slug' => 'apexcore-x1-industrial-controller',
                'description' => 'کنترلر هوشمند قابل برنامه‌ریزی با پشتیبانی از پروتکل‌های صنعتی Modbus و CAN Bus',
                'base_price' => 12500000,
                'currency' => 'IRR',
                'is_active' => true,
                'is_featured' => true,
            ]
        );

        $variant1 = ProductVariant::firstOrCreate(
            ['sku' => 'NVN-SRV-01-STD'],
            [
                'product_id' => $product1->id,
                'name' => 'نسخه استاندارد (۲۴ ولت DC)',
                'is_active' => true,
            ]
        );

        Inventory::firstOrCreate(
            ['product_variant_id' => $variant1->id],
            [
                'quantity' => 25,
                'reserved_quantity' => 0,
                'safety_threshold' => 3,
            ]
        );

        // 5. Seed Engineering Services Catalog
        ServiceCatalog::firstOrCreate(
            ['slug' => 'embedded-firmware-development'],
            [
                'name' => 'طراحی و توسعه فریمور سامانه‌های توکار',
                'category' => 'مهندسی الکترونیک و نرم‌افزار',
                'short_description' => 'طراحی نرم‌افزارهای بلادرنگ (RTOS) و درایورهای سخت‌افزاری سفارشی',
                'description' => 'ارائه خدمات جامع مهندسی برای پیاده‌سازی فریمور بر روی میکروکنترلرهای ARM Cortex-M، ESP32 و بردهای صنعتی.',
                'estimated_base_price' => 50000000,
                'currency' => 'IRR',
                'is_active' => true,
                'required_fields' => [
                    ['name' => 'mcu_architecture', 'label' => 'معماری میکروکنترلر / سخت‌افزار', 'type' => 'text', 'required' => true],
                    ['name' => 'protocols', 'label' => 'پروتکل‌های ارتباطی مورد نیاز', 'type' => 'text', 'required' => false],
                ],
            ]
        );

        ServiceCatalog::firstOrCreate(
            ['slug' => 'industrial-iot-consultation'],
            [
                'name' => 'مشاوره و پیاده‌سازی اینترنت اشیاء صنعتی (IIoT)',
                'category' => 'اتوماسیون صنعتی',
                'short_description' => 'پایش برخط خطوط تولید، مانیتورینگ سنسورها و داشبوردهای اسکادا',
                'description' => 'طراحی معماری کامل اتصال تجهیزات کارخانه‌ای به سرورهای محلی یا ابری با رعایت استانداردهای امنیت صنعتی.',
                'estimated_base_price' => 80000000,
                'currency' => 'IRR',
                'is_active' => true,
                'required_fields' => [
                    ['name' => 'plant_scale', 'label' => 'مقیاس خط تولید و تعداد نودها', 'type' => 'text', 'required' => true],
                ],
            ]
        );
    }
}
