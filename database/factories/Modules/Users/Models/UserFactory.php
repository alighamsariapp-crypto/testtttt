<?php

namespace Database\Factories\Modules\Users\Models;

use App\Modules\Users\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    protected $model = User::class;

    public function definition(): array
    {
        return [
            'name' => fake()->name(),
            'email' => fake()->unique()->safeEmail(),
            'email_verified_at' => now(),
            'phone' => '0912'.fake()->numerify('######'),
            'password' => 'Password123!',
            'remember_token' => Str::random(10),
            'role' => User::ROLE_CUSTOMER,
            'status' => User::STATUS_ACTIVE,
        ];
    }
}
