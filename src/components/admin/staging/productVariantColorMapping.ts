import type { Product } from '../../../types';

type StorefrontColor = NonNullable<Product['colors']>[number];
type StorefrontVariant = NonNullable<Product['variants']>[number];

const colorKey = (value: string) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('fa-IR');

const variantColor = (variant: StorefrontVariant): string => {
  const value = variant.attributes?.color || variant.attributes?.رنگ;
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
};

/**
 * Produces the single source of truth for the color editor: one configured
 * color and at most one active variant for that color. If legacy data contains
 * duplicate active variants, the newest numeric variant id wins so saving the
 * editor can deactivate the older duplicates safely.
 */
export const selectCanonicalColorVariants = (colors: Product['colors'] | undefined, variants: Product['variants'] | undefined) => {
  const canonicalColors = (colors || []).reduce<StorefrontColor[]>((unique, color) => {
    const name = color.name.trim().replace(/\s+/g, ' ');
    if (!name || unique.some((item) => colorKey(item.name) === colorKey(name))) return unique;
    return [...unique, { name, hex: color.hex }];
  }, []);
  const colorsByKey = new Map(canonicalColors.map((color) => [colorKey(color.name), color]));
  const variantsByColor = new Map<string, StorefrontVariant>();

  for (const variant of variants || []) {
    if (!variant.is_active) continue;
    const key = colorKey(variantColor(variant));
    if (!key || !colorsByKey.has(key)) continue;
    const current = variantsByColor.get(key);
    if (!current || Number(variant.id) > Number(current.id)) variantsByColor.set(key, variant);
  }

  return {
    colors: canonicalColors,
    variants: canonicalColors.flatMap((color) => {
      const variant = variantsByColor.get(colorKey(color.name));
      return variant ? [{ color: color.name, variant }] : [];
    }),
  };
};
