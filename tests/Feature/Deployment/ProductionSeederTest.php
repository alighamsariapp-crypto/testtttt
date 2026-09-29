<?php

namespace Tests\Feature\Deployment;

use App\Modules\Users\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ProductionSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_production_seeder_creates_only_configured_initial_admin_when_demo_data_is_disabled(): void
    {
        $previousEnvironment = app()->environment();
        $environment = [
            'INITIAL_ADMIN_NAME' => 'Production Owner',
            'INITIAL_ADMIN_EMAIL' => 'owner@example.test',
            'INITIAL_ADMIN_PHONE' => '09121234567',
            'INITIAL_ADMIN_PASSWORD' => 'A-Unique-Production-Password-2026',
            'SEED_DEMO_DATA' => 'false',
        ];
        $originalVariables = $this->setEnvironmentVariables($environment);

        app()->instance('env', 'production');
        config(['app.env' => 'production']);

        try {
            app(DatabaseSeeder::class)->run();

            $admin = User::where('email', 'owner@example.test')->firstOrFail();

            $this->assertSame(User::ROLE_ADMIN, $admin->role);
            $this->assertSame(User::STATUS_ACTIVE, $admin->status);
            $this->assertTrue(Hash::check('A-Unique-Production-Password-2026', $admin->password));
            $this->assertDatabaseMissing('users', ['email' => 'admin@apexstore.local']);
            $this->assertDatabaseMissing('users', ['email' => 'customer@apexstore.local']);
            $this->assertDatabaseCount('products', 0);
        } finally {
            app()->instance('env', $previousEnvironment);
            config(['app.env' => $previousEnvironment]);
            $this->restoreEnvironmentVariables($originalVariables);
        }
    }

    /** @param array<string, string> $variables */
    private function setEnvironmentVariables(array $variables): array
    {
        $original = [];

        foreach ($variables as $key => $value) {
            $original[$key] = [
                'getenv' => getenv($key),
                'env_exists' => array_key_exists($key, $_ENV),
                'env' => $_ENV[$key] ?? null,
                'server_exists' => array_key_exists($key, $_SERVER),
                'server' => $_SERVER[$key] ?? null,
            ];
            putenv("{$key}={$value}");
            $_ENV[$key] = $value;
            $_SERVER[$key] = $value;
        }

        return $original;
    }

    /** @param array<string, array{getenv: string|false, env_exists: bool, env: mixed, server_exists: bool, server: mixed}> $original */
    private function restoreEnvironmentVariables(array $original): void
    {
        foreach ($original as $key => $values) {
            $values['getenv'] === false ? putenv($key) : putenv("{$key}={$values['getenv']}");

            if ($values['env_exists']) {
                $_ENV[$key] = $values['env'];
            } else {
                unset($_ENV[$key]);
            }

            if ($values['server_exists']) {
                $_SERVER[$key] = $values['server'];
            } else {
                unset($_SERVER[$key]);
            }
        }
    }
}
