<?php

namespace App\Modules\Cart\Services;

use App\Modules\Cart\Models\Cart;
use App\Modules\Cart\Models\CartItem;
use App\Modules\Inventory\Models\Inventory;
use App\Modules\Products\Models\ProductVariant;
use App\Modules\Shared\Contracts\BaseServiceInterface;
use App\Modules\Shared\Exceptions\DomainException;
use App\Modules\Shared\Exceptions\EntityNotFoundException;
use App\Modules\Shared\ValueObjects\Money;
use App\Modules\Users\Models\User;
use Illuminate\Support\Facades\DB;

class CartService implements BaseServiceInterface
{
    public function getOrCreateCart(?User $user, ?string $sessionId = null): Cart
    {
        if ($user) {
            return DB::transaction(function () use ($user, $sessionId): Cart {
                $userCart = Cart::firstOrCreate(['user_id' => $user->id]);

                if (!$sessionId) {
                    return $userCart;
                }

                $guestCart = Cart::query()
                    ->where('session_id', $sessionId)
                    ->whereNull('user_id')
                    ->with('items.variant.inventory')
                    ->first();

                if (!$guestCart || $guestCart->id === $userCart->id) {
                    return $userCart;
                }

                foreach ($guestCart->items as $guestItem) {
                    $existingItem = $userCart->items()->where('product_variant_id', $guestItem->product_variant_id)->first();
                    $inventory = Inventory::query()
                        ->where('product_variant_id', $guestItem->product_variant_id)
                        ->lockForUpdate()
                        ->first();
                    $availableStock = $inventory?->availableQuantity() ?? 0;
                    $currentQuantity = $existingItem?->quantity ?? 0;
                    $mergedQuantity = min($availableStock, $currentQuantity + $guestItem->quantity);

                    if ($existingItem) {
                        if ($mergedQuantity > 0) {
                            $existingItem->update(['quantity' => $mergedQuantity]);
                        } else {
                            $existingItem->delete();
                        }
                    } elseif ($mergedQuantity > 0) {
                        $userCart->items()->create([
                            'product_variant_id' => $guestItem->product_variant_id,
                            'quantity' => $mergedQuantity,
                        ]);
                    }
                }

                $guestCart->items()->delete();
                $guestCart->delete();

                return $userCart;
            });
        }

        if ($sessionId) {
            return Cart::firstOrCreate(['session_id' => $sessionId]);
        }

        throw new DomainException('Either authenticated user or session identifier is required for cart.', 'INVALID_CART_IDENTITY', 400);
    }

    public function getCartSummary(Cart $cart): array
    {
        $cart->load(['items.variant.product', 'items.variant.inventory']);

        $currency = null;
        $subtotal = null;
        $itemsData = [];

        foreach ($cart->items as $item) {
            $variant = $item->variant;
            if (!$variant || !$variant->product || !$variant->is_active || !$variant->product->is_active) {
                continue;
            }

            $itemCurrency = $variant->product->currency ?? 'IRR';
            $unitPrice = Money::from($variant->effective_price, $itemCurrency);
            $itemTotal = $unitPrice->multiply($item->quantity);

            if ($subtotal === null) {
                $currency = $itemCurrency;
                $subtotal = Money::zero($currency);
            }

            if ($itemCurrency !== $currency) {
                throw new DomainException(
                    'Cart items must use the same currency.',
                    'CART_CURRENCY_MISMATCH',
                    422,
                );
            }

            $subtotal = $subtotal->add($itemTotal);

            $availableStock = $variant->inventory?->availableQuantity() ?? 0;
            $variantImage = is_array($variant->attributes) ? ($variant->attributes['image_url'] ?? null) : null;
            $productImages = is_array($variant->product->images) ? $variant->product->images : [];
            $productImage = collect($productImages)->first(static fn (mixed $image): bool => is_string($image) && trim($image) !== '');
            $imageUrl = is_string($variantImage) && trim($variantImage) !== '' ? $variantImage : $productImage;

            $itemsData[] = [
                'id' => $item->id,
                'product_id' => $variant->product->id,
                'product_name' => $variant->product->name,
                'variant_id' => $variant->id,
                'variant_name' => $variant->name,
                'variant_sku' => $variant->sku,
                'unit_price' => $unitPrice->getAmount(),
                'quantity' => $item->quantity,
                'total_price' => $itemTotal->getAmount(),
                'currency' => $itemCurrency,
                'is_in_stock' => $availableStock >= $item->quantity,
                'available_stock' => $availableStock,
                // A chosen color may have an image of its own. If not, the card must
                // still show the selected product's primary image rather than a UI placeholder.
                'image_url' => $imageUrl,
            ];
        }

        $currency ??= 'IRR';
        $subtotal ??= Money::zero($currency);

        $taxRate = 0.09; // 9% VAT
        $tax = $subtotal->multiply($taxRate);
        $grandTotal = $subtotal->add($tax);

        return [
            'cart_id' => $cart->id,
            'items' => $itemsData,
            'subtotal' => $subtotal->getAmount(),
            'tax' => $tax->getAmount(),
            'grand_total' => $grandTotal->getAmount(),
            'currency' => $currency,
            'item_count' => count($itemsData),
        ];
    }

    public function addItem(Cart $cart, int $variantId, int $quantity): array
    {
        if ($quantity <= 0) {
            throw new DomainException('Quantity must be greater than zero.', 'INVALID_QUANTITY', 400);
        }

        return DB::transaction(function () use ($cart, $variantId, $quantity): array {
            $variant = ProductVariant::query()->with('product')->find($variantId);
            if (!$variant || !$variant->is_active || !$variant->product?->is_active) {
                throw new EntityNotFoundException('Product variant is invalid or inactive.');
            }

            $inventory = Inventory::query()
                ->where('product_variant_id', $variantId)
                ->lockForUpdate()
                ->first();
            $availableStock = $inventory?->availableQuantity() ?? 0;
            $item = $cart->items()->where('product_variant_id', $variantId)->lockForUpdate()->first();
            $newQuantity = $item ? ($item->quantity + $quantity) : $quantity;

            if ($newQuantity > $availableStock) {
                throw new DomainException(
                    "Cannot add {$quantity} items. Available stock: {$availableStock}.",
                    'INSUFFICIENT_STOCK',
                    400
                );
            }

            if ($item) {
                $item->update(['quantity' => $newQuantity]);
            } else {
                $cart->items()->create([
                    'product_variant_id' => $variantId,
                    'quantity' => $quantity,
                ]);
            }

            return $this->getCartSummary($cart);
        }, 3);
    }

    public function updateItem(Cart $cart, int $itemId, int $quantity): array
    {
        return DB::transaction(function () use ($cart, $itemId, $quantity): array {
            $item = $cart->items()->lockForUpdate()->find($itemId);
            if (!$item) {
                throw new EntityNotFoundException('Cart item not found.');
            }

            if ($quantity <= 0) {
                $item->delete();
                return $this->getCartSummary($cart);
            }

            $inventory = Inventory::query()
                ->where('product_variant_id', $item->product_variant_id)
                ->lockForUpdate()
                ->first();
            $availableStock = $inventory?->availableQuantity() ?? 0;
            $isIncreasingQuantity = $quantity > $item->quantity;

            // A cart can become stale when stock is adjusted after the item was added.
            // Block only new increases above stock. On a decrease, immediately cap a
            // stale item at the available quantity so the cart becomes valid again.
            if ($isIncreasingQuantity && $quantity > $availableStock) {
                throw new DomainException(
                    "Requested quantity {$quantity} exceeds available stock ({$availableStock}).",
                    'INSUFFICIENT_STOCK',
                    400
                );
            }

            if (!$isIncreasingQuantity && $item->quantity > $availableStock && $quantity > $availableStock) {
                $quantity = $availableStock;
            }

            if ($quantity <= 0) {
                $item->delete();
                return $this->getCartSummary($cart);
            }

            $item->update(['quantity' => $quantity]);

            return $this->getCartSummary($cart);
        }, 3);
    }

    public function removeItem(Cart $cart, int $itemId): array
    {
        $item = $cart->items()->find($itemId);
        if (!$item) {
            throw new EntityNotFoundException('Cart item not found.');
        }

        $item->delete();
        return $this->getCartSummary($cart);
    }

    public function clearCart(Cart $cart): void
    {
        $cart->items()->delete();
    }
}
