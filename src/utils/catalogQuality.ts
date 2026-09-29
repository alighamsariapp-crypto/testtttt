import { Product } from '../types';

const QA_MARKER = /(?:\bqa[\s_-]*test\b|\btest[\s_-]*data\b|\bapi[\s_-]*test\b|داده[‌\s-]*آزمایشی|محصول[‌\s-]*آزمایشی|کنترل[‌\s-]*کیفیت)/iu;

const isRepeatedPlaceholder = (value: string): boolean => {
  const compact = value.replace(/[\s\-_.]/g, '');
  return compact.length >= 4 && /^(.)(?:\1)+$/u.test(compact);
};

export type CatalogQualityIssue = 'test-record' | 'missing-name' | 'missing-price';

/**
 * Gives customer-facing surfaces a conservative safeguard against QA records.
 * The record is not changed or deleted: it remains available to administrators
 * so it can be corrected and published deliberately.
 */
export const getCatalogQualityIssues = (product: Product): CatalogQualityIssue[] => {
  const issues: CatalogQualityIssue[] = [];
  const name = product.name?.trim() || '';
  const searchableText = `${name} ${product.sku || ''} ${product.category_name || ''}`;

  if (!name) issues.push('missing-name');
  if (QA_MARKER.test(searchableText) || isRepeatedPlaceholder(name)) issues.push('test-record');
  if (!Number.isFinite(product.effective_price ?? product.base_price) || (product.effective_price ?? product.base_price) <= 0) {
    issues.push('missing-price');
  }

  return issues;
};

export const isStorefrontReadyProduct = (product: Product): boolean => (
  product.is_active && getCatalogQualityIssues(product).length === 0
);

export const getStorefrontProducts = (products: Product[]): Product[] => (
  products.filter(isStorefrontReadyProduct)
);

export const catalogQualityLabel = (issue: CatalogQualityIssue): string => ({
  'test-record': 'دادهٔ آزمایشی یا نامعتبر',
  'missing-name': 'نام محصول ثبت نشده',
  'missing-price': 'قیمت معتبر ثبت نشده',
}[issue]);
