<?php

namespace App\Modules\Inventory\Services;

use App\Modules\Inventory\Models\Inventory;
use App\Modules\Shared\Contracts\BaseServiceInterface;
use App\Modules\Shared\Exceptions\DomainException;
use App\Modules\Shared\Exceptions\EntityNotFoundException;
use Illuminate\Support\Facades\DB;

class InventoryService implements BaseServiceInterface
{
    /**
     * Atomically validates stock availability with pessimistic row locking
     */
    public function validateAndLockStock(int $productVariantId, int $requestedQuantity): Inventory
    {
        $inventory = Inventory::where('product_variant_id', $productVariantId)
            ->lockForUpdate()
            ->first();

        if (!$inventory) {
            throw new EntityNotFoundException("Inventory record for variant ID {$productVariantId} not found.");
        }

        $availableQuantity = $inventory->availableQuantity();

        if ($availableQuantity < $requestedQuantity) {
            throw new DomainException(
                "Insufficient stock for variant ID {$productVariantId}. Available: {$availableQuantity}, requested: {$requestedQuantity}.",
                'INSUFFICIENT_STOCK',
                400
            );
        }

        return $inventory;
    }

    /**
     * Atomically decrements quantity upon order placement
     */
    public function decrementStock(int $productVariantId, int $quantity): void
    {
        $inventory = $this->validateAndLockStock($productVariantId, $quantity);

        $inventory->quantity -= $quantity;
        $inventory->save();
    }

    /**
     * Restocks or increments inventory atomically
     */
    public function incrementStock(int $productVariantId, int $quantity): Inventory
    {
        return DB::transaction(function () use ($productVariantId, $quantity) {
            $inventory = Inventory::where('product_variant_id', $productVariantId)
                ->lockForUpdate()
                ->first();

            if (!$inventory) {
                $inventory = Inventory::create([
                    'product_variant_id' => $productVariantId,
                    'quantity' => 0,
                    'reserved_quantity' => 0,
                    'safety_threshold' => 0,
                ]);
            }

            $inventory->quantity += $quantity;
            $inventory->save();

            return $inventory;
        });
    }
}
