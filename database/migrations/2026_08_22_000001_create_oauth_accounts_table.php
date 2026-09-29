<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('oauth_accounts')) {
            $requiredColumns = ['id', 'user_id', 'provider', 'provider_user_id', 'provider_email', 'created_at', 'updated_at'];
            $missingColumns = array_diff($requiredColumns, Schema::getColumnListing('oauth_accounts'));

            if ($missingColumns !== []) {
                throw new \RuntimeException(
                    'The existing oauth_accounts table is incompatible; missing columns: '.implode(', ', $missingColumns).'. No data was changed.'
                );
            }

            return;
        }

        Schema::create('oauth_accounts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('provider', 32);
            $table->string('provider_user_id', 255);
            $table->string('provider_email')->nullable();
            $table->timestamps();

            $table->unique(['provider', 'provider_user_id']);
            $table->unique(['user_id', 'provider']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('oauth_accounts');
    }
};
