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
        Schema::create('service_catalogs', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('category', 64)->default('engineering')->index();
            $table->text('short_description')->nullable();
            $table->longText('description')->nullable();
            $table->unsignedBigInteger('estimated_base_price')->nullable();
            $table->string('currency', 10)->default('IRR');
            $table->boolean('is_active')->default(true)->index();
            $table->json('required_fields')->nullable();
            $table->string('meta_title')->nullable();
            $table->text('meta_description')->nullable();
            $table->timestamps();
        });

        Schema::create('service_requests', function (Blueprint $table) {
            $table->id();
            $table->string('request_number', 32)->unique();
            $table->foreignId('user_id')->constrained('users')->onDelete('restrict');
            $table->foreignId('service_catalog_id')->nullable()->constrained('service_catalogs')->onDelete('set null');
            $table->string('title');
            $table->longText('requirements');
            $table->string('status', 32)->default('submitted')->index();
            // submitted, reviewing, quoted, customer_accepted, in_progress, waiting_customer, completed, cancelled, rejected
            $table->foreignId('assigned_staff_id')->nullable()->constrained('users')->onDelete('set null');
            $table->json('custom_attributes')->nullable();
            $table->json('attachments')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'status', 'created_at']);
        });

        Schema::create('service_quotes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('service_request_id')->constrained('service_requests')->onDelete('cascade');
            $table->unsignedBigInteger('amount');
            $table->string('currency', 10)->default('IRR');
            $table->text('scope_of_work')->nullable();
            $table->text('terms')->nullable();
            $table->timestamp('valid_until')->nullable();
            $table->string('status', 32)->default('pending')->index(); // pending, accepted, rejected, expired
            $table->timestamp('responded_at')->nullable();
            $table->foreignId('created_by_staff_id')->nullable()->constrained('users')->onDelete('set null');
            $table->timestamps();
        });

        Schema::create('service_timelines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('service_request_id')->constrained('service_requests')->onDelete('cascade');
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('status', 32)->default('pending'); // pending, in_progress, completed
            $table->date('due_date')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('service_timelines');
        Schema::dropIfExists('service_quotes');
        Schema::dropIfExists('service_requests');
        Schema::dropIfExists('service_catalogs');
    }
};
