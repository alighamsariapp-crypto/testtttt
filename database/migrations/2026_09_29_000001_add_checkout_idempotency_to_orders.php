<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table): void {
            $table->string('checkout_idempotency_key', 128)->nullable()->after('user_id');
            $table->string('checkout_request_hash', 64)->nullable()->after('checkout_idempotency_key');
            $table->unique(['user_id', 'checkout_idempotency_key'], 'orders_user_checkout_idempotency_unique');
            $table->index('checkout_request_hash', 'orders_checkout_request_hash_index');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table): void {
            $table->dropUnique('orders_user_checkout_idempotency_unique');
            $table->dropIndex('orders_checkout_request_hash_index');
            $table->dropColumn(['checkout_idempotency_key', 'checkout_request_hash']);
        });
    }
};
