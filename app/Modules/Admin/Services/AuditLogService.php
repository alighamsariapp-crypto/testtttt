<?php

namespace App\Modules\Admin\Services;

use App\Modules\Admin\Models\AuditLog;
use App\Modules\Shared\Contracts\BaseServiceInterface;
use App\Modules\Shared\Helpers\RedactionHelper;
use App\Modules\Users\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class AuditLogService implements BaseServiceInterface
{
    public function __construct(private readonly RedactionHelper $redactionHelper)
    {
    }

    public function log(
        ?User $actor,
        string $action,
        string $entityType,
        ?int $entityId = null,
        array $metadata = [],
        ?string $ipAddress = null,
        ?string $userAgent = null
    ): AuditLog {
        $redacted = $this->redactionHelper->redact($metadata);

        return AuditLog::create([
            'user_id' => $actor?->id,
            'action' => $action,
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'ip_address' => $ipAddress,
            'user_agent' => $userAgent ? substr($userAgent, 0, 500) : null,
            'redacted_metadata' => $redacted,
            'created_at' => now(),
        ]);
    }

    public function paginateLogs(array $filters = [], int $perPage = 20): LengthAwarePaginator
    {
        $query = AuditLog::with('user:id,name,email')->orderBy('created_at', 'desc');

        if (!empty($filters['action'])) {
            $query->where('action', $filters['action']);
        }

        if (!empty($filters['entity_type'])) {
            $query->where('entity_type', $filters['entity_type']);
        }

        if (!empty($filters['user_id'])) {
            $query->where('user_id', $filters['user_id']);
        }

        return $query->paginate(min(max($perPage, 1), 100));
    }
}
