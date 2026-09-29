<?php

namespace App\Modules\Support\Services;

use App\Modules\Settings\Services\SmsConfigurationService;
use App\Modules\Settings\Services\SystemSmsNotifier;
use App\Modules\Shared\Exceptions\EntityNotFoundException;
use App\Modules\Support\Models\SupportTicket;
use App\Modules\Support\Models\SupportTicketMessage;
use App\Modules\Users\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class SupportTicketService
{
    public function __construct(private readonly SystemSmsNotifier $systemSmsNotifier)
    {
    }

    public function paginateForUser(User $user, int $perPage = 15): LengthAwarePaginator
    {
        return SupportTicket::query()
            ->where('user_id', $user->id)
            ->with(['messages.user'])
            ->latest('last_reply_at')
            ->paginate(min(max($perPage, 1), 50));
    }

    public function findForUser(User $user, int|string $ticket): SupportTicket
    {
        $query = SupportTicket::query()
            ->where('user_id', $user->id)
            ->with(['messages.user']);

        $supportTicket = is_numeric($ticket)
            ? $query->whereKey((int) $ticket)->first()
            : $query->where('ticket_number', $ticket)->first();

        if (!$supportTicket) {
            throw new EntityNotFoundException('Ticket not found or access is denied.');
        }

        return $supportTicket;
    }

    public function create(User $user, array $data): SupportTicket
    {
        return DB::transaction(function () use ($user, $data): SupportTicket {
            $ticket = SupportTicket::create([
                'ticket_number' => $this->nextTicketNumber(),
                'user_id' => $user->id,
                'title' => $data['title'],
                'department' => $data['department'],
                'priority' => $data['priority'],
                'status' => SupportTicket::STATUS_OPEN,
                'last_reply_at' => now(),
            ]);

            SupportTicketMessage::create([
                'support_ticket_id' => $ticket->id,
                'user_id' => $user->id,
                'sender' => 'user',
                'message' => $data['message'],
            ]);

            return $ticket->load(['messages.user']);
        });
    }

    public function addUserMessage(User $user, int|string $ticket, array $data): SupportTicket
    {
        $supportTicket = $this->findForUser($user, $ticket);

        if ($supportTicket->status === SupportTicket::STATUS_CLOSED) {
            throw new EntityNotFoundException('Closed tickets cannot receive new messages.');
        }

        SupportTicketMessage::create([
            'support_ticket_id' => $supportTicket->id,
            'user_id' => $user->id,
            'sender' => 'user',
            'message' => $data['message'],
            'attachments' => $data['attachments'] ?? null,
        ]);

        $supportTicket->forceFill([
            'status' => SupportTicket::STATUS_INVESTIGATING,
            'last_reply_at' => now(),
        ])->save();

        return $supportTicket->fresh(['messages.user']);
    }

    public function closeForUser(User $user, int|string $ticket): SupportTicket
    {
        $supportTicket = $this->findForUser($user, $ticket);
        $supportTicket->forceFill([
            'status' => SupportTicket::STATUS_CLOSED,
            'closed_at' => now(),
        ])->save();

        return $supportTicket->fresh(['messages.user']);
    }

    public function paginateForAdmin(int $perPage = 20, bool $includeArchived = false): LengthAwarePaginator
    {
        return SupportTicket::query()
            ->when(! $includeArchived, fn ($query) => $query->whereNull('archived_at'))
            ->with(['user', 'messages.user'])
            ->latest('last_reply_at')
            ->paginate(min(max($perPage, 1), 100));
    }

    public function addSupportMessage(User $staff, int|string $ticketId, array $data): SupportTicket
    {
        $ticket = $this->findForAdmin($ticketId);
        $this->ensureTicketIsNotArchived($ticket);

        $isFirstSupportReply = ! $ticket->messages()->where('sender', 'support')->exists();
        $message = SupportTicketMessage::create([
            'support_ticket_id' => $ticket->id,
            'user_id' => $staff->id,
            'sender' => 'support',
            'message' => $data['message'],
            'attachments' => $data['attachments'] ?? null,
        ]);

        $ticket->forceFill([
            'status' => SupportTicket::STATUS_ANSWERED,
            'last_reply_at' => now(),
        ])->save();

        if ($isFirstSupportReply) {
            $ticket->loadMissing('user');
            $this->systemSmsNotifier->queue(
                SmsConfigurationService::EVENT_TICKET_REPLY,
                "ticket-first-reply-{$message->id}",
                $ticket->user?->phone,
                [
                    'name' => trim((string) ($ticket->user?->name ?? 'مشتری گرامی')) ?: 'مشتری گرامی',
                    'ticket_number' => $ticket->ticket_number,
                ]
            );
        }

        return $ticket->fresh(['user', 'messages.user']);
    }

    public function updateFromAdmin(int|string $ticketId, array $data): SupportTicket
    {
        $ticket = $this->findForAdmin($ticketId);
        $this->ensureTicketIsNotArchived($ticket);

        $ticket->fill($data);
        if (array_key_exists('status', $data)) {
            $ticket->closed_at = $data['status'] === SupportTicket::STATUS_CLOSED ? now() : null;
        }
        $ticket->save();

        return $ticket->fresh(['user', 'messages.user']);
    }

    public function markReadForAdmin(int|string $ticketId): SupportTicket
    {
        $ticket = $this->findForAdmin($ticketId);
        $ticket->messages()
            ->where('sender', 'user')
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return $ticket->fresh(['user', 'messages.user']);
    }

    public function archiveForAdmin(int|string $ticketId): SupportTicket
    {
        $ticket = $this->findForAdmin($ticketId);
        $this->ensureTicketIsClosed($ticket);
        $ticket->forceFill(['archived_at' => now()])->save();

        return $ticket->fresh(['user', 'messages.user']);
    }

    public function restoreForAdmin(int|string $ticketId): SupportTicket
    {
        $ticket = $this->findForAdmin($ticketId);
        $ticket->forceFill(['archived_at' => null])->save();

        return $ticket->fresh(['user', 'messages.user']);
    }

    public function deleteForAdmin(int|string $ticketId): void
    {
        $ticket = $this->findForAdmin($ticketId);
        $this->ensureTicketIsClosed($ticket);

        if (! $ticket->archived_at) {
            throw ValidationException::withMessages([
                'ticket' => 'ابتدا تیکت بسته‌شده را بایگانی کنید؛ سپس حذف دائمی مجاز است.',
            ]);
        }

        $ticket->delete();
    }

    private function ensureTicketIsNotArchived(SupportTicket $ticket): void
    {
        if ($ticket->archived_at) {
            throw ValidationException::withMessages([
                'ticket' => 'تیکت بایگانی‌شده است. ابتدا آن را بازگردانی کنید.',
            ]);
        }
    }

    private function ensureTicketIsClosed(SupportTicket $ticket): void
    {
        if ($ticket->status !== SupportTicket::STATUS_CLOSED) {
            throw ValidationException::withMessages([
                'ticket' => 'فقط تیکت‌های بسته‌شده قابل بایگانی یا حذف هستند.',
            ]);
        }
    }

    private function findForAdmin(int|string $ticket): SupportTicket
    {
        $supportTicket = is_numeric($ticket)
            ? SupportTicket::query()->find((int) $ticket)
            : SupportTicket::query()->where('ticket_number', $ticket)->first();

        if (!$supportTicket) {
            throw new EntityNotFoundException('Ticket not found.');
        }

        return $supportTicket;
    }

    private function nextTicketNumber(): string
    {
        do {
            $number = 'TKT-'.Str::upper(Str::random(10));
        } while (SupportTicket::where('ticket_number', $number)->exists());

        return $number;
    }
}
