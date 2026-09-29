<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email')->unique();
            $table->string('phone', 32)->nullable()->index();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('password');
            $table->string('role', 32)->default('customer')->index(); // customer, staff, admin
            $table->string('status', 32)->default('active')->index(); // active, inactive, suspended, pending
            $table->rememberToken();
            $table->timestamps();
        });

        Schema::create('user_addresses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->string('type', 32)->default('shipping'); // shipping, billing
            $table->string('recipient_name');
            $table->string('phone', 32);
            $table->string('province');
            $table->string('city');
            $table->string('postal_code', 32);
            $table->text('address_line');
            $table->boolean('is_default')->default(false);
            $table->timestamps();

            $table->index(['user_id', 'type']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('user_addresses');
        Schema::dropIfExists('users');
    }
};
