<?php

namespace App\Modules\Shared\Contracts;

/**
 * Idempotency Interface
 *
 * Enforces replay-protection and duplicate prevention across financial/state operations.
 */
interface IdempotencyInterface
{
    public function isProcessed(string $idempotencyKey): bool;
    public function lockKey(string $idempotencyKey, int $ttlSeconds = 60): bool;
    public function releaseKey(string $idempotencyKey): void;
}
