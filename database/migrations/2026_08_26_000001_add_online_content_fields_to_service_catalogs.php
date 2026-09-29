<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('service_catalogs')) {
            return;
        }

        $missingColumns = array_values(array_filter([
            'documents',
            'steps',
            'faq',
            'contact_type',
            'contact_url',
            'cta_label',
        ], fn (string $column): bool => ! Schema::hasColumn('service_catalogs', $column)));

        if ($missingColumns === []) {
            return;
        }

        Schema::table('service_catalogs', function (Blueprint $table) use ($missingColumns) {
            foreach ($missingColumns as $column) {
                match ($column) {
                    'documents', 'steps', 'faq' => $table->json($column)->nullable(),
                    'contact_type' => $table->string($column, 32)->nullable(),
                    'contact_url' => $table->string($column, 2048)->nullable(),
                    'cta_label' => $table->string($column, 120)->nullable(),
                };
            }
        });
    }

    public function down(): void
    {
        Schema::table('service_catalogs', function (Blueprint $table) {
            $table->dropColumn(['documents', 'steps', 'faq', 'contact_type', 'contact_url', 'cta_label']);
        });
    }
};
