<?php

namespace Tests\Feature;

use App\Modules\Support\Models\SupportTicket;
use Tests\TestCase;

class AdminSupportTicketWorkflowTest extends TestCase
{
    public function test_admin_can_list_and_reply_to_a_customer_ticket(): void
    {
        $this->actingAsCustomer();

        $ticket = $this->postJson('/api/v1/users/support-tickets', [
            'title' => 'پیگیری وضعیت سفارش',
            'department' => 'پشتیبانی فنی',
            'priority' => 'high',
            'message' => 'لطفاً وضعیت سفارش من را بررسی کنید.',
        ])->assertCreated()->json('data');

        $this->actingAsAdmin();

        $this->getJson('/api/v1/admin/tickets')
            ->assertOk()
            ->assertJsonPath('data.data.0.id', $ticket['id'])
            ->assertJsonPath('data.data.0.ticket_number', $ticket['ticket_number']);

        $this->postJson('/api/v1/admin/tickets/'.$ticket['id'].'/reply', [
            'message' => 'سفارش شما بررسی شد و در حال آماده‌سازی است.',
        ])->assertCreated()
            ->assertJsonPath('data.id', $ticket['id'])
            ->assertJsonPath('data.status', SupportTicket::STATUS_ANSWERED)
            ->assertJsonPath('data.messages.1.sender', 'support');
    }

    public function test_admin_can_mark_messages_read_archive_restore_and_delete_a_closed_ticket(): void
    {
        $this->actingAsCustomer();

        $ticket = $this->postJson('/api/v1/users/support-tickets', [
            'title' => 'تیکت قابل بایگانی',
            'department' => 'پشتیبانی فنی',
            'priority' => 'medium',
            'message' => 'این پیام باید هنگام بازشدن توسط مدیر خوانده شود.',
        ])->assertCreated()->json('data');

        $this->actingAsAdmin();

        $this->postJson('/api/v1/admin/tickets/'.$ticket['id'].'/read')
            ->assertOk()
            ->assertJsonPath('data.id', $ticket['id'])
            ->assertJsonPath('data.messages.0.sender', 'user')
            ->assertJsonPath('data.messages.0.read_at', fn ($value) => is_string($value) && $value !== '');

        $this->patchJson('/api/v1/admin/tickets/'.$ticket['id'], [
            'status' => SupportTicket::STATUS_CLOSED,
        ])->assertOk()
            ->assertJsonPath('data.status', SupportTicket::STATUS_CLOSED);

        $this->deleteJson('/api/v1/admin/tickets/'.$ticket['id'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('ticket');

        $this->postJson('/api/v1/admin/tickets/'.$ticket['id'].'/archive')
            ->assertOk()
            ->assertJsonPath('data.id', $ticket['id'])
            ->assertJsonPath('data.archived_at', fn ($value) => is_string($value) && $value !== '');

        $this->getJson('/api/v1/admin/tickets')
            ->assertOk()
            ->assertJsonCount(0, 'data.data');

        $this->getJson('/api/v1/admin/tickets?include_archived=1')
            ->assertOk()
            ->assertJsonPath('data.data.0.id', $ticket['id']);

        $this->postJson('/api/v1/admin/tickets/'.$ticket['id'].'/reply', [
            'message' => 'این پاسخ نباید به تیکت بایگانی‌شده اضافه شود.',
        ])->assertUnprocessable()->assertJsonValidationErrors('ticket');

        $this->patchJson('/api/v1/admin/tickets/'.$ticket['id'], [
            'status' => SupportTicket::STATUS_OPEN,
        ])->assertUnprocessable()->assertJsonValidationErrors('ticket');

        $this->postJson('/api/v1/admin/tickets/'.$ticket['id'].'/restore')
            ->assertOk()
            ->assertJsonPath('data.archived_at', null);

        $this->patchJson('/api/v1/admin/tickets/'.$ticket['id'], [
            'status' => SupportTicket::STATUS_OPEN,
        ])->assertOk()
            ->assertJsonPath('data.status', SupportTicket::STATUS_OPEN)
            ->assertJsonPath('data.closed_at', null);

        $this->patchJson('/api/v1/admin/tickets/'.$ticket['id'], [
            'status' => SupportTicket::STATUS_CLOSED,
        ])->assertOk();
        $this->postJson('/api/v1/admin/tickets/'.$ticket['id'].'/archive')->assertOk();

        $this->deleteJson('/api/v1/admin/tickets/'.$ticket['id'])
            ->assertOk();

        $this->assertDatabaseMissing('support_tickets', ['id' => $ticket['id']]);
        $this->assertDatabaseMissing('support_ticket_messages', ['support_ticket_id' => $ticket['id']]);
    }
}
