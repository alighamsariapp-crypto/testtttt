<?php

namespace Tests;

use App\Modules\Users\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Laravel\Sanctum\Sanctum;

abstract class TestCase extends BaseTestCase
{
    use RefreshDatabase;

    protected function createCustomer(array $attributes = []): User
    {
        return $this->createUserWithRole(User::ROLE_CUSTOMER, $attributes);
    }

    protected function createTokenForUser(User $user, array $abilities = ['customer:access']): string
    {
        return $user->createToken('test-token', $abilities)->plainTextToken;
    }

    protected function createStaff(array $attributes = []): User
    {
        return $this->createUserWithRole(User::ROLE_STAFF, $attributes);
    }

    protected function createAdmin(array $attributes = []): User
    {
        return $this->createUserWithRole(User::ROLE_ADMIN, $attributes);
    }

    private function createUserWithRole(string $role, array $attributes): User
    {
        $status = $attributes['status'] ?? User::STATUS_ACTIVE;
        $role = $attributes['role'] ?? $role;
        unset($attributes['role'], $attributes['status']);

        $user = User::create(array_merge([
            'name' => 'Test User',
            'email' => 'user_'.uniqid().'@example.com',
            'password' => bcrypt('Password123!'),
        ], $attributes));

        $user->forceFill([
            'role' => $role,
            'status' => $status,
        ])->save();

        return $user->fresh();
    }

    protected function actingAsCustomer(?User $user = null): User
    {
        $user = $user ?? $this->createCustomer();
        Sanctum::actingAs($user, ['*']);
        return $user;
    }

    protected function actingAsStaff(?User $user = null): User
    {
        $user = $user ?? $this->createStaff();
        Sanctum::actingAs($user, ['*']);
        return $user;
    }

    protected function actingAsAdmin(?User $user = null): User
    {
        $user = $user ?? $this->createAdmin();
        Sanctum::actingAs($user, ['*']);
        return $user;
    }
}
