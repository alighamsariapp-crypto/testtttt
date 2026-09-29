<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Invalidate legacy plaintext tokens and enforce explicit expiration timestamps.
     *
     * Production-compatible across MySQL 8, MariaDB 10.6+, PostgreSQL, and SQLite.
     */
    public function up(): void
    {
        if (!Schema::hasTable('personal_access_tokens')) {
            return;
        }

        // 1. Invalidate/delete any tokens that are not standard 64-character SHA-256 hashes
        // (i.e. legacy plaintext tokens that were stored directly without one-way hashing).
        // Processing via chunkById ensures safety, low memory footprint, and absence of long locks on large tables.
        DB::table('personal_access_tokens')
            ->whereRaw('LENGTH(token) != 64')
            ->orderBy('id')
            ->chunkById(500, function ($tokens) {
                $ids = $tokens->pluck('id')->all();
                DB::table('personal_access_tokens')->whereIn('id', $ids)->delete();
            });

        // 2. For any remaining validly-hashed tokens lacking an expires_at value,
        // populate an explicit expiration window based on sanctum configuration.
        // Using Laravel Query Builder with Carbon chunking completely eliminates raw SQL dialect
        // incompatibilities (such as SQLite's datetime(..., '+X minutes') vs MySQL's DATE_ADD)
        // and guarantees exact timestamp formatting without timezone or SQL injection risks.
        $expirationMinutes = (int) config('sanctum.expiration', 10080);
        $expirationMinutes = $expirationMinutes > 0 ? $expirationMinutes : 10080;

        DB::table('personal_access_tokens')
            ->whereNull('expires_at')
            ->orderBy('id')
            ->chunkById(500, function ($tokens) use ($expirationMinutes) {
                foreach ($tokens as $token) {
                    $baseDate = !empty($token->created_at) ? Carbon::parse($token->created_at) : Carbon::now();
                    $expiresAt = $baseDate->copy()->addMinutes($expirationMinutes)->toDateTimeString();

                    DB::table('personal_access_tokens')
                        ->where('id', $token->id)
                        ->update(['expires_at' => $expiresAt]);
                }
            });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Irreversible security migration; revoked plaintext tokens must not be restored.
    }
};
