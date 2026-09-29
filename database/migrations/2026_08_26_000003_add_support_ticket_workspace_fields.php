<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('support_tickets', function (Blueprint $table) {
            $table->timestamp('archived_at')->nullable()->after('closed_at')->index();
        });

        Schema::table('support_ticket_messages', function (Blueprint $table) {
            $table->timestamp('read_at')->nullable()->after('attachments')->index();
        });
    }

    public function down(): void
    {
        Schema::table('support_ticket_messages', function (Blueprint $table) {
            $table->dropIndex(['read_at']);
            $table->dropColumn('read_at');
        });

        Schema::table('support_tickets', function (Blueprint $table) {
            $table->dropIndex(['archived_at']);
            $table->dropColumn('archived_at');
        });
    }
};
