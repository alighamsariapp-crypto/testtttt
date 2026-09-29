<?php

namespace Tests\Feature\Deployment;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class LegacyTokenInvalidationMigrationTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // Ensure personal_access_tokens table exists for migration testing
        if (!Schema::hasTable('personal_access_tokens')) {
            $this->artisan('migrate', ['--force' => true]);
        }
    }

    /**
     * Acceptance Criteria B, C, D, E:
     * - Migration succeeds on test database without driver syntax errors.
     * - No plaintext tokens remain after migration.
     * - Tokens lacking expires_at receive the exact configured expiration timestamp.
     * - Migration is completely idempotent and does not corrupt existing timestamps.
     */
    public function test_legacy_token_invalidation_purges_plaintext_and_backfills_expiry(): void
    {
        $configExpiration = 10080; // 7 days in minutes
        config(['sanctum.expiration' => $configExpiration]);

        $baseCreatedAt = '2026-03-01 12:00:00';
        $expectedExpiry = Carbon::parse($baseCreatedAt)->addMinutes($configExpiration)->toDateTimeString();

        // 1. Seed test data:
        // A) Legacy plaintext token (length 28 != 64)
        $legacyPlaintextId = DB::table('personal_access_tokens')->insertGetId([
            'tokenable_type' => 'App\\Modules\\Users\\Models\\User',
            'tokenable_id' => 9999,
            'name' => 'legacy-plaintext-device',
            'token' => 'legacy_plaintext_secret_123',
            'abilities' => '["*"]',
            'expires_at' => null,
            'created_at' => $baseCreatedAt,
            'updated_at' => $baseCreatedAt,
        ]);

        // B) Valid SHA-256 hashed token lacking expires_at (null)
        $validHashNoExpiry = hash('sha256', 'valid-plain-token-no-expiry');
        $validTokenId = DB::table('personal_access_tokens')->insertGetId([
            'tokenable_type' => 'App\\Modules\\Users\\Models\\User',
            'tokenable_id' => 9999,
            'name' => 'valid-token-no-expiry',
            'token' => $validHashNoExpiry,
            'abilities' => '["*"]',
            'expires_at' => null,
            'created_at' => $baseCreatedAt,
            'updated_at' => $baseCreatedAt,
        ]);

        // C) Valid SHA-256 hashed token with existing explicit expires_at
        $preExistingExpiry = '2026-04-15 18:30:00';
        $validHashWithExpiry = hash('sha256', 'valid-plain-token-with-expiry');
        $existingTokenId = DB::table('personal_access_tokens')->insertGetId([
            'tokenable_type' => 'App\\Modules\\Users\\Models\\User',
            'tokenable_id' => 9999,
            'name' => 'valid-token-with-expiry',
            'token' => $validHashWithExpiry,
            'abilities' => '["*"]',
            'expires_at' => $preExistingExpiry,
            'created_at' => $baseCreatedAt,
            'updated_at' => $baseCreatedAt,
        ]);

        // 2. Run the migration
        $migration = require database_path('migrations/2026_09_23_000007_invalidate_legacy_plaintext_tokens.php');
        $migration->up();

        // 3. Verification:
        // C: No plaintext token remains
        $this->assertNull(
            DB::table('personal_access_tokens')->where('id', $legacyPlaintextId)->first(),
            'Legacy plaintext token was NOT purged by the migration!'
        );
        $this->assertEquals(
            0,
            DB::table('personal_access_tokens')->whereRaw('LENGTH(token) != 64')->count(),
            'Tokens with length != 64 still exist in personal_access_tokens table!'
        );

        // D: Valid token with null expires_at received exact configured expiration
        $backfilledToken = DB::table('personal_access_tokens')->where('id', $validTokenId)->first();
        $this->assertNotNull($backfilledToken);
        $this->assertEquals($expectedExpiry, Carbon::parse($backfilledToken->expires_at)->toDateTimeString());
        $this->assertEquals($baseCreatedAt, Carbon::parse($backfilledToken->created_at)->toDateTimeString());

        // Pre-existing expires_at was NOT corrupted
        $untouchedToken = DB::table('personal_access_tokens')->where('id', $existingTokenId)->first();
        $this->assertNotNull($untouchedToken);
        $this->assertEquals($preExistingExpiry, Carbon::parse($untouchedToken->expires_at)->toDateTimeString());

        // 4. Idempotency test (E): Rerun migration up() and verify zero side effects or corruption
        $migration->up();

        $recheckedBackfilled = DB::table('personal_access_tokens')->where('id', $validTokenId)->first();
        $this->assertEquals($expectedExpiry, Carbon::parse($recheckedBackfilled->expires_at)->toDateTimeString());

        $recheckedUntouched = DB::table('personal_access_tokens')->where('id', $existingTokenId)->first();
        $this->assertEquals($preExistingExpiry, Carbon::parse($recheckedUntouched->expires_at)->toDateTimeString());
    }

    /**
     * Verify that when personal_access_tokens table has tokens with null created_at,
     * the migration falls back cleanly without crashing or corrupting.
     */
    public function test_migration_handles_null_created_at_safely(): void
    {
        $validHash = hash('sha256', 'token-with-null-created-at');
        $tokenId = DB::table('personal_access_tokens')->insertGetId([
            'tokenable_type' => 'App\\Modules\\Users\\Models\\User',
            'tokenable_id' => 9998,
            'name' => 'null-created-at-token',
            'token' => $validHash,
            'abilities' => '["*"]',
            'expires_at' => null,
            'created_at' => null,
            'updated_at' => null,
        ]);

        $migration = require database_path('migrations/2026_09_23_000007_invalidate_legacy_plaintext_tokens.php');
        $migration->up();

        $token = DB::table('personal_access_tokens')->where('id', $tokenId)->first();
        $this->assertNotNull($token->expires_at, 'Token without created_at was not assigned an expires_at!');
    }
}
