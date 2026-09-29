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
        Schema::create('payment_status_exchanges', function (Blueprint $table) {
            $table->id();
            $table->string('code_hash', 64)->unique();
            $table->unsignedBigInteger('order_id');
            $table->string('order_number', 64)->index();
            $table->unsignedBigInteger('user_id')->default(0)->index();
            $table->string('purpose', 32)->default('payment_status');
            $table->timestamp('expires_at')->index();
            $table->timestamp('used_at')->nullable()->index();
            $table->timestamps();

            $table->foreign('order_id')->references('id')->on('orders')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('payment_status_exchanges');
    }
};
