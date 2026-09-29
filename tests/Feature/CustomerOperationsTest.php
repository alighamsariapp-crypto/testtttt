<?php

namespace Tests\Feature;

use App\Modules\Discounts\Models\DiscountCoupon;
use App\Modules\Products\Models\Product;
use App\Modules\Categories\Models\Category;
use App\Modules\Support\Models\SupportTicket;
use App\Modules\Wallet\Models\WalletTransaction;
use Tests\TestCase;

class CustomerOperationsTest extends TestCase
{
    public function test_customer_can_manage_favorites(): void
    {
        $customer = $this->actingAsCustomer();
        $category = Category::create([
            'name' => 'Networking',
            'slug' => 'networking',
            'is_active' => true,
        ]);
        $product = Product::create([
            'category_id' => $category->id,
            'name' => 'Network Adapter',
            'slug' => 'network-adapter',
            'sku' => 'NET-ADAPTER-01',
            'base_price' => 150000,
            'currency' => 'IRR',
            'is_active' => true,
        ]);

        $this->postJson('/api/v1/users/favorites/'.$product->id)
            ->assertCreated()
            ->assertJsonPath('success', true);

        $this->getJson('/api/v1/users/favorites')
            ->assertOk()
            ->assertJsonPath('data.0.product_id', $product->id);

        $this->deleteJson('/api/v1/users/favorites/'.$product->id)
            ->assertOk()
            ->assertJsonPath('success', true);
    }

    public function test_customer_can_create_reply_and_close_own_ticket(): void
    {
        $customer = $this->actingAsCustomer();

        $created = $this->postJson('/api/v1/users/support-tickets', [
            'title' => 'Issue with my order',
            'department' => 'پشتیبانی فنی',
            'priority' => 'high',
            'message' => 'I need help with the ordered product.',
        ])->assertCreated()->json('data');

        $this->assertDatabaseHas('support_tickets', [
            'id' => $created['id'],
            'user_id' => $customer->id,
            'status' => SupportTicket::STATUS_OPEN,
        ]);

        $this->getJson('/api/v1/users/support-tickets/'.$created['ticket_number'])
            ->assertOk()
            ->assertJsonPath('data.id', $created['id'])
            ->assertJsonPath('data.ticket_number', $created['ticket_number']);

        $this->postJson('/api/v1/users/support-tickets/'.$created['id'].'/messages', [
            'message' => 'Additional diagnostic details.',
        ])->assertCreated()
            ->assertJsonPath('data.status', SupportTicket::STATUS_INVESTIGATING);

        $this->postJson('/api/v1/users/support-tickets/'.$created['id'].'/close')
            ->assertOk()
            ->assertJsonPath('data.status', SupportTicket::STATUS_CLOSED);
    }

    public function test_customer_wallet_deposit_is_pending_until_payment_is_verified(): void
    {
        $this->actingAsCustomer();

        $this->postJson('/api/v1/users/wallet/deposits', [
            'amount' => 250000,
            'description' => 'Online wallet top-up request',
        ])->assertCreated()
            ->assertJsonPath('data.status', WalletTransaction::STATUS_PENDING);

        $this->getJson('/api/v1/users/wallet')
            ->assertOk()
            ->assertJsonPath('data.balance', 0)
            ->assertJsonPath('data.transactions.total', 1);
    }

    public function test_admin_can_manage_settings_and_discount_coupons(): void
    {
        $this->actingAsAdmin();

        $this->putJson('/api/v1/admin/settings/appearance', [
            'settings' => ['brand_name' => 'NoovinNet'],
        ])->assertOk()
            ->assertJsonPath('data.brand_name', 'NoovinNet');

        $this->putJson('/api/v1/admin/settings/static_content', [
            'settings' => [
                'config' => [
                    'about' => ['title' => 'دربارهٔ مدیریت‌شدهٔ نوین‌نت'],
                    'contact' => ['supportPhone' => '021-55555555'],
                ],
            ],
        ])->assertOk()
            ->assertJsonPath('data.config.about.title', 'دربارهٔ مدیریت‌شدهٔ نوین‌نت');

        $this->getJson('/api/v1/settings/public')
            ->assertOk()
            ->assertJsonPath('data.static_content.config.about.title', 'دربارهٔ مدیریت‌شدهٔ نوین‌نت')
            ->assertJsonPath('data.static_content.config.contact.supportPhone', '021-55555555');

        $coupon = $this->postJson('/api/v1/admin/discounts', [
            'code' => 'WELCOME10',
            'title' => 'Welcome discount',
            'discount_type' => 'percentage',
            'discount_value' => 10,
            'min_order_amount' => 100000,
            'usage_limit' => 100,
            'is_active' => true,
        ])->assertCreated()->json('data');

        $this->postJson('/api/v1/admin/discounts/'.$coupon['id'].'/toggle')
            ->assertOk()
            ->assertJsonPath('data.is_active', false);

        $this->assertDatabaseHas('discount_coupons', [
            'id' => $coupon['id'],
            'code' => 'WELCOME10',
            'is_active' => false,
        ]);
    }

    public function test_admin_can_publish_blog_posts_for_public_consumption(): void
    {
        $this->actingAsAdmin();

        $posts = [
            [
                'id' => 1,
                'title' => 'راهنمای مودم 5G',
                'slug' => '5g-modem-guide',
                'summary' => 'راهنمای انتخاب مودم 5G برای خانه و محل کار.',
                'content' => 'متن کامل مقالهٔ منتشرشده.',
                'image' => 'https://example.test/modem.jpg',
                'author' => 'تیم نوین‌نت',
                'category' => 'راهنما',
                'date' => '۱۴۰۵/۰۵/۲۶',
                'readTime' => '۵ دقیقه مطالعه',
                'views' => 0,
                'isPublished' => true,
                'tags' => ['5G', 'مودم'],
            ],
            [
                'id' => 2,
                'title' => 'پیش‌نویس داخلی',
                'slug' => 'internal-draft',
                'summary' => 'این مطلب منتشر نشده است.',
                'content' => 'متن پیش‌نویس.',
                'image' => 'https://example.test/draft.jpg',
                'author' => 'تیم نوین‌نت',
                'category' => 'داخلی',
                'date' => '۱۴۰۵/۰۵/۲۶',
                'readTime' => '۲ دقیقه مطالعه',
                'views' => 0,
                'isPublished' => false,
                'tags' => [],
            ],
        ];

        $this->putJson('/api/v1/admin/settings/blog_posts', [
            'settings' => ['posts' => $posts],
        ])->assertOk()
            ->assertJsonCount(2, 'data.posts');

        $this->getJson('/api/v1/settings/public')
            ->assertOk()
            ->assertJsonCount(1, 'data.blog_posts.posts')
            ->assertJsonPath('data.blog_posts.posts.0.slug', '5g-modem-guide')
            ->assertJsonMissing(['slug' => 'internal-draft']);
    }
}
