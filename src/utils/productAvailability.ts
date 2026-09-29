import type { Product, ProductVariant } from '../types';

/**
 * Creates a synthetic fallback variant for products that do not have an explicit variants array.
 */
export const createDefaultProductVariant = (product: Product): ProductVariant => {
  const stock = product.stock_quantity ?? (product.in_stock !== false ? 10 : 0);
  return {
    id: product.id || 1,
    product_id: product.id || 1,
    name: 'استاندارد',
    sku: product.sku || `SKU-${product.id}`,
    price_override: product.discount_price ?? product.base_price,
    effective_price: product.effective_price ?? product.discount_price ?? product.base_price,
    stock_quantity: Math.max(0, stock),
    is_active: product.is_active !== false,
  };
};

/**
 * A variant is sellable when it is active and its available stock is greater than 0.
 */
export const isSellableVariant = (variant: ProductVariant | undefined | null): variant is ProductVariant => {
  return Boolean(variant && variant.is_active !== false && (variant.stock_quantity ?? 0) > 0);
};

export const getSellableVariants = (product: Product | undefined | null): ProductVariant[] => {
  if (!product) return [];
  const list = (product.variants || []).filter(isSellableVariant);
  if (list.length > 0) return list;
  
  // If product has no explicit variants array but is in-stock and active:
  if (product.is_active !== false && product.in_stock !== false && (product.stock_quantity === undefined || product.stock_quantity > 0)) {
    return [createDefaultProductVariant(product)];
  }
  return [];
};

export const getDefaultSellableVariant = (product: Product | undefined | null): ProductVariant | undefined => {
  if (!product) return undefined;
  const sellable = getSellableVariants(product);
  if (sellable.length > 0) return sellable[0];
  
  if (product.is_active !== false && product.in_stock !== false && (product.stock_quantity === undefined || product.stock_quantity > 0)) {
    return createDefaultProductVariant(product);
  }
  return undefined;
};

/**
 * Determines whether the product can be added to the cart by a customer.
 */
export const isProductPurchasable = (product: Product | undefined | null): boolean => {
  if (!product || product.is_active === false) return false;
  if (product.in_stock === false && (product.stock_quantity ?? 0) <= 0) return false;
  const variant = getDefaultSellableVariant(product);
  return Boolean(variant && (variant.stock_quantity ?? 0) > 0);
};

export const getFirstActiveVariant = (product: Product | undefined | null): ProductVariant | undefined => {
  if (!product) return undefined;
  const active = product.variants?.find((variant) => variant.is_active !== false);
  return active || createDefaultProductVariant(product);
};

