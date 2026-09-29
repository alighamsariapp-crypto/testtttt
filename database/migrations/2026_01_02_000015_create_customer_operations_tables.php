<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_favorites', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['user_id', 'product_id']);
        });

        Schema::create('support_tickets', function (Blueprint $table) {
            $table->id();
            $table->string('ticket_number', 32)->unique();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('title', 255);
            $table->string('department', 64);
            $table->string('status', 32)->default('open')->index();
            $table->string('priority', 32)->default('medium')->index();
            $table->timestamp('last_reply_at')->nullable()->index();
            $table->timestamp('closed_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'status']);
        });

        Schema::create('support_ticket_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('support_ticket_id')->constrained('support_tickets')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('sender', 16); // user | support
            $table->text('message');
            $table->json('attachments')->nullable();
            $table->timestamps();
        });

        Schema::create('wallet_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('type', 32)->index(); // deposit, purchase, refund, cashback, adjustment
            $table->bigInteger('amount');
            $table->string('currency', 8)->default('IRR');
            $table->string('status', 32)->default('pending')->index();
            $table->string('reference', 64)->nullable()->unique();
            $table->string('description', 500)->nullable();
            $table->timestamps();

            $table->index(['user_id', 'status']);
        });

        Schema::create('discount_coupons', function (Blueprint $table) {
            $table->id();
            $table->string('code', 64)->unique();
            $table->string('title', 255);
            $table->string('discount_type', 16)->default('fixed'); // fixed | percentage
            $table->bigInteger('discount_value');
            $table->bigInteger('min_order_amount')->default(0);
            $table->bigInteger('max_discount_amount')->nullable();
            $table->unsignedInteger('usage_limit')->default(0); // zero means unlimited
            $table->unsignedInteger('usage_count')->default(0);
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('expires_at')->nullable()->index();
            $table->boolean('is_active')->default(true)->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('discount_coupons');
        Schema::dropIfExists('wallet_transactions');
        Schema::dropIfExists('support_ticket_messages');
        Schema::dropIfExists('support_tickets');
        Schema::dropIfExists('user_favorites');
    }
};
