<?php

namespace Tests\Feature\Users;

use Tests\TestCase;

class ProfileAndAddressAccessTest extends TestCase
{
    public function test_guest_cannot_create_a_delivery_address(): void
    {
        $this->postJson('/api/v1/users/addresses', [
            'title' => 'خانه',
            'recipient_name' => 'کاربر آزمایشی',
            'phone' => '09121234567',
            'address_line' => 'تهران، خیابان آزمایشی',
            'postal_code' => '1234567890',
            'type' => 'shipping',
        ])->assertUnauthorized();
    }

    public function test_authenticated_user_profile_normalizes_international_phone_number(): void
    {
        $user = $this->actingAsCustomer();

        $this->patchJson('/api/v1/users/me', [
            'phone' => '+98 912 345 6789',
        ])->assertOk()
            ->assertJsonPath('data.phone', '09123456789')
            ->assertJsonPath('data.phone_verified', false);

        $this->assertDatabaseHas('users', [
            'id' => $user->id,
            'phone' => '09123456789',
        ]);
    }

    public function test_authenticated_user_profile_rejects_invalid_phone_number(): void
    {
        $this->actingAsCustomer();

        $this->patchJson('/api/v1/users/me', [
            'phone' => '12345',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['phone']);
    }
}
