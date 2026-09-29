<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Support customers who create an account using only a verified mobile number.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('name')->nullable()->change();
            $table->string('email')->nullable()->change();
            $table->string('password')->nullable()->change();
            $table->timestamp('phone_verified_at')->nullable()->after('phone');
            $table->unique('phone');
        });

        Schema::create('phone_verification_codes', function (Blueprint $table) {
            $table->id();
            $table->string('phone', 32);
            $table->string('code_hash');
            $table->timestamp('expires_at');
            $table->timestamp('consumed_at')->nullable();
            $table->unsignedTinyInteger('attempts')->default(0);
            $table->timestamps();

            $table->unique('phone');
            $table->index('expires_at');
        });
    }

    /**
     * Reverse only the new phone-authentication structures.
     */
    public function down(): void
    {
        Schema::dropIfExists('phone_verification_codes');

        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['phone']);
            $table->dropColumn('phone_verified_at');
        });
    }
};
