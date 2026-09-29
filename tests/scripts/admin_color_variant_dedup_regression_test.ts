import assert from 'node:assert/strict';
import { selectCanonicalColorVariants } from '../../src/components/admin/staging/productVariantColorMapping';

const duplicatedColorProduct = {
  id: 712,
  name: 'محصول دو رنگ آزمون',
  sku: 'COLOR-DUP-712',
  category_id: 1,
  category_name: 'تجهیزات تست',
  category_slug: 'test',
  base_price: 5000000,
  effective_price: 5000000,
  currency: 'IRR',
  is_active: true,
  is_featured: false,
  stock_quantity: 122,
  image_url: 'https://example.test/product.webp',
  gallery_urls: [],
  colors: [
    { name: 'تن', hex: '#d2b48c' },
    { name: 'مشکی', hex: '#111111' },
    { name: ' تن ', hex: '#d2b48c' },
  ],
  variants: [
    { id: 41, name: 'تن قدیمی', is_active: true, stock_quantity: 55, effective_price: 5000000, attributes: { color: 'تن' } },
    { id: 42, name: 'مشکی قدیمی', is_active: true, stock_quantity: 55, effective_price: 5000000, attributes: { color: 'مشکی' } },
    { id: 43, name: 'تن جدید', is_active: true, stock_quantity: 11, effective_price: 5250000, attributes: { color: 'تن' } },
    { id: 44, name: 'مشکی جدید', is_active: true, stock_quantity: 9, effective_price: 5300000, attributes: { color: 'مشکی' } },
  ],
} as any;

const canonical = selectCanonicalColorVariants(duplicatedColorProduct.colors, duplicatedColorProduct.variants);
assert.equal(canonical.colors.length, 2, 'نام رنگ تکراری باید پیش از نمایش فرم حذف شود');
assert.equal(canonical.variants.length, 2, 'فرم دو رنگ نباید چهار ردیف variant نشان دهد');
assert.deepEqual(canonical.variants.map(({ variant }) => variant.id), [43, 44], 'برای هر رنگ باید جدیدترین variant باقی بماند');
assert.deepEqual(canonical.variants.map(({ variant }) => variant.stock_quantity), [11, 9], 'موجودی آخرین variant هر رنگ باید حفظ شود');

console.log('Admin color variant dedup regression: PASS');
