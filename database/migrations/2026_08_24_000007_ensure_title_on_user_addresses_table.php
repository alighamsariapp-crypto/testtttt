<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Add the address title only when a previous shared-hosting deployment
     * recorded the migration without applying its schema change.
     */
    public function up(): void
    {
        if (! Schema::hasTable('user_addresses') || Schema::hasColumn('user_addresses', 'title')) {
            return;
        }

        Schema::table('user_addresses', function (Blueprint $table) {
            $table->string('title', 64)->nullable()->after('type');
        });
    }

    /**
     * Do not drop a user-facing column during rollback on shared hosting.
     */
    public function down(): void
    {
        // Intentionally left empty.
    }
};
