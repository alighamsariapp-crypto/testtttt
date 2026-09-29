<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Recover only the structures required by phone OTP on installations where
     * the original authentication migration was deployed but not executed.
     *
     * This migration is intentionally additive and idempotent. It never
     * removes users, phone values, tokens, or existing verification records.
     */
    public function up(): void
    {
        if (! Schema::hasColumn('users', 'phone_verified_at')) {
            Schema::table('users', function (Blueprint $table): void {
                $table->timestamp('phone_verified_at')->nullable()->after('phone');
            });
        }

        if (! Schema::hasTable('phone_verification_codes')) {
            Schema::create('phone_verification_codes', function (Blueprint $table): void {
                $table->id();
                $table->string('phone', 32);
                $table->string('code_hash');
                $table->timestamp('issued_at')->nullable();
                $table->timestamp('resend_available_at')->nullable();
                $table->timestamp('expires_at');
                $table->timestamp('consumed_at')->nullable();
                $table->unsignedTinyInteger('attempts')->default(0);
                $table->timestamps();

                $table->unique('phone');
                $table->index('expires_at');
            });
        } else {
            Schema::table('phone_verification_codes', function (Blueprint $table): void {
                if (! Schema::hasColumn('phone_verification_codes', 'issued_at')) {
                    $table->timestamp('issued_at')->nullable()->after('code_hash');
                }
                if (! Schema::hasColumn('phone_verification_codes', 'resend_available_at')) {
                    $table->timestamp('resend_available_at')->nullable()->after('issued_at');
                }
            });
        }
    }

    /**
     * This recovery migration deliberately has no destructive rollback.
     */
    public function down(): void
    {
        // Existing production data must remain untouched.
    }
};
