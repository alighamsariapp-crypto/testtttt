import type { ProductCustomOption, ProductVariant } from './types';

export const cleanText = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

export const parseNumber = (v: unknown): number => {
  if (typeof v === 'number' && !isNaN(v)) return v;
  if (typeof v === 'string') {
    const clean = v.replace(/[^\d.]/g, '');
    const n = parseFloat(clean);
    return isNaN(n) ? 0 : n;
  }
  return 0;
};

export const formatMoney = (amount: number): string =>
  new Intl.NumberFormat('fa-IR').format(Math.max(0, Math.round(amount || 0))) + ' تومان';

export const calculateFinalPrice = (basePrice: number, discountPercent: number): number => {
  const cleanBase = Math.max(0, basePrice || 0);
  const cleanPct = Math.min(99, Math.max(0, discountPercent || 0));
  if (cleanPct <= 0) return cleanBase;
  return Math.round(cleanBase * (1 - cleanPct / 100));
};

export const slugify = (text: string): string => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\u0600-\u06FFa-z0-9-]/g, '')
    .replace(/--+/g, '-');
};

export const variantLabel = (variant: ProductVariant, options: ProductCustomOption[]): string => {
  const parts: string[] = [];
  if (variant.color) parts.push(variant.color);
  if (variant.optionValues) {
    options.forEach((opt) => {
      const val = variant.optionValues?.[opt.name];
      if (val) parts.push(val);
    });
  }
  return parts.length ? parts.join(' / ') : 'تنوع بدون نام';
};

export const buildVariantSku = (baseSku: string, variant: ProductVariant): string => {
  const cleanBase = cleanText(baseSku) || 'PRD';
  const colorPart = cleanText(variant.color).slice(0, 3).toUpperCase() || 'DEF';
  const optParts = Object.values(variant.optionValues || {})
    .map((v) => cleanText(v).replace(/\s+/g, '').slice(0, 4).toUpperCase())
    .filter(Boolean)
    .join('-');
  return `${cleanBase}-${colorPart}${optParts ? `-${optParts}` : ''}`;
};
