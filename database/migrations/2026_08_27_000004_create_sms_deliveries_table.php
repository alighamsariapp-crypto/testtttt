<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sms_deliveries', function (Blueprint $table) {
            $table->id();
            $table->string('event_key', 191)->unique();
            $table->string('event', 64)->index();
            $table->string('recipient', 32)->index();
            $table->json('payload')->nullable();
            $table->string('provider_message_id', 64)->nullable()->index();
            $table->integer('provider_status')->nullable();
            $table->string('status', 24)->default('queued')->index();
            $table->string('failure_code', 64)->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sms_deliveries');
    }
};
