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
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained('orders')->onDelete('restrict');
            $table->string('gateway', 32); // stripe, paypal, bank_transfer, test
            $table->unsignedBigInteger('amount');
            $table->string('currency', 10)->default('IRR');
            $table->string('status', 32)->default('pending'); // pending, authorized, paid, failed, cancelled, refunded
            $table->string('reference_id', 128)->nullable()->index();
            $table->json('gateway_response')->nullable();
            $table->timestamps();

            $table->index(['order_id', 'status']);
        });

        Schema::create('payment_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('payment_id')->constrained('payments')->onDelete('cascade');
            $table->string('idempotency_key', 128)->unique();
            $table->string('event_type', 64);
            $table->json('payload')->nullable();
            $table->boolean('is_reconciled')->default(false);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('payment_transactions');
        Schema::dropIfExists('payments');
    }
};
