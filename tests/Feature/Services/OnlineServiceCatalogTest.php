<?php

namespace Tests\Feature\Services;

use Tests\TestCase;

class OnlineServiceCatalogTest extends TestCase
{
    private function payload(int $serviceCategoryId, array $overrides = []): array
    {
        return array_merge([
            'name' => 'استعلام خلافی خودرو',
            'slug' => 'vehicle-fines-inquiry',
            'service_category_id' => $serviceCategoryId,
            'short_description' => 'راهنمای مدارک و مسیر ارتباط برای استعلام خلافی خودرو.',
            'description' => 'ابتدا مدارک لازم را آماده کنید و سپس از مسیر ارتباطی تعیین‌شده با پشتیبانی در تماس باشید.',
            'documents' => ['کارت ملی مالک', 'شماره پلاک خودرو'],
            'steps' => ['مدارک را آماده کنید', 'با پشتیبانی ارتباط بگیرید'],
            'faq' => [['question' => 'چه مدارکی لازم است؟', 'answer' => 'کارت ملی مالک و شماره پلاک خودرو.']],
            'contact_type' => 'telegram',
            'contact_url' => 'https://t.me/novinet_support',
            'cta_label' => 'ادامه در تلگرام',
            'is_active' => true,
        ], $overrides);
    }

    private function createServiceCategory(array $overrides = []): int
    {
        $response = $this->postJson('/api/v1/admin/services/categories', array_merge([
            'name' => 'خدمات خودرو',
            'slug' => 'vehicle-services',
            'description' => 'خدمات راهنمایی و پیگیری خودرو.',
            'is_active' => true,
            'sort_order' => 10,
        ], $overrides))->assertCreated();

        return (int) $response->json('data.id');
    }

    public function test_admin_can_create_and_publish_an_online_service_with_its_own_public_page_data(): void
    {
        $this->actingAsAdmin();
        $categoryId = $this->createServiceCategory();

        $created = $this->postJson('/api/v1/admin/services/catalog', $this->payload($categoryId));
        $created->assertCreated()->assertJsonPath('data.slug', 'vehicle-fines-inquiry')->assertJsonPath('data.contact_url', 'https://t.me/novinet_support');

        $publicList = $this->getJson('/api/v1/services');
        $publicList->assertOk()->assertJsonPath('data.0.slug', 'vehicle-fines-inquiry');

        $publicPage = $this->getJson('/api/v1/services/vehicle-fines-inquiry');
        $publicPage->assertOk()->assertJsonPath('data.documents.0', 'کارت ملی مالک')->assertJsonPath('data.steps.1', 'با پشتیبانی ارتباط بگیرید')->assertJsonPath('data.faq.0.question', 'چه مدارکی لازم است؟');
    }

    public function test_draft_online_service_is_not_available_on_the_public_catalog(): void
    {
        $this->actingAsAdmin();
        $categoryId = $this->createServiceCategory();
        $this->postJson('/api/v1/admin/services/catalog', $this->payload($categoryId, ['slug' => 'private-service-guide', 'is_active' => false]))->assertCreated();

        $this->getJson('/api/v1/services/private-service-guide')->assertNotFound();
    }

    public function test_online_service_requires_a_safe_contact_path(): void
    {
        $this->actingAsAdmin();
        $categoryId = $this->createServiceCategory();
        $this->postJson('/api/v1/admin/services/catalog', $this->payload($categoryId, ['contact_url' => 'http://unsafe.example.com']))->assertUnprocessable()->assertJsonValidationErrors('contact_url');
    }

    public function test_admin_can_update_and_delete_an_unrequested_online_service(): void
    {
        $this->actingAsAdmin();
        $categoryId = $this->createServiceCategory();
        $created = $this->postJson('/api/v1/admin/services/catalog', $this->payload($categoryId))->assertCreated();
        $id = (int) $created->json('data.id');

        $this->putJson("/api/v1/admin/services/catalog/{$id}", $this->payload($categoryId, [
            'name' => 'استعلام خلافی خودرو و عوارض',
            'short_description' => 'راهنمای به‌روزشده برای خلافی و عوارض خودرو.',
            'is_active' => false,
        ]))->assertOk()->assertJsonPath('data.name', 'استعلام خلافی خودرو و عوارض')->assertJsonPath('data.is_active', false);

        $this->deleteJson("/api/v1/admin/services/catalog/{$id}")->assertOk();
        $this->getJson('/api/v1/services/vehicle-fines-inquiry')->assertNotFound();
    }

    public function test_service_category_update_controls_public_visibility_and_prevents_deletion_while_services_exist(): void
    {
        $this->actingAsAdmin();
        $categoryId = $this->createServiceCategory();
        $this->postJson('/api/v1/admin/services/catalog', $this->payload($categoryId))->assertCreated();

        $this->getJson('/api/v1/services/categories')->assertOk()->assertJsonPath('data.0.slug', 'vehicle-services');
        $this->deleteJson("/api/v1/admin/services/categories/{$categoryId}")->assertUnprocessable()->assertJsonValidationErrors('serviceCategory');

        $this->putJson("/api/v1/admin/services/categories/{$categoryId}", [
            'name' => 'خدمات خودرو و رانندگی',
            'slug' => 'vehicle-services',
            'description' => 'نسخهٔ به‌روز خدمات خودرو.',
            'is_active' => false,
            'sort_order' => 20,
        ])->assertOk()->assertJsonPath('data.name', 'خدمات خودرو و رانندگی')->assertJsonPath('data.is_active', false);

        $this->getJson('/api/v1/services/vehicle-fines-inquiry')->assertNotFound();
    }
}
