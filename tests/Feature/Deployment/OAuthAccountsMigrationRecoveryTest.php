<?php

namespace Tests\Feature\Deployment;

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class OAuthAccountsMigrationRecoveryTest extends TestCase
{
    public function test_migration_keeps_a_compatible_existing_oauth_table_and_its_rows(): void
    {
        $user = $this->createCustomer();
        DB::table('oauth_accounts')->insert([
            'user_id' => $user->id,
            'provider' => 'google',
            'provider_user_id' => 'existing-google-subject',
            'provider_email' => 'customer@example.test',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $migration = '2026_08_22_000001_create_oauth_accounts_table';
        DB::table('migrations')->where('migration', $migration)->delete();

        $exitCode = Artisan::call('migrate', [
            '--path' => 'database/migrations/2026_08_22_000001_create_oauth_accounts_table.php',
            '--force' => true,
        ]);

        $this->assertSame(0, $exitCode);
        $this->assertDatabaseHas('oauth_accounts', [
            'user_id' => $user->id,
            'provider' => 'google',
            'provider_user_id' => 'existing-google-subject',
            'provider_email' => 'customer@example.test',
        ]);
        $this->assertDatabaseHas('migrations', ['migration' => $migration]);
    }
}
