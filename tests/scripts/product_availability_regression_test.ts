import assert from 'node:assert/strict';
import { mapProduct } from '../../src/services/apiMappers';
import { getDefaultSellableVariant, isProductPurchasable } from '../../src/utils/productAvailability';

const baseProduct = {
  id: 901,
  category_id: 1,
  name: 'محصول آزمون موجودی',
  slug: 'availability-test-product',
  sku: 'AVAIL-901',
  base_price: 100000,
  currency: 'IRR',
  image_url: 'https://example.test/product.jpg',
  in_stock: true,
};

const mappedWithMixedVariants = mapProduct({
  ...baseProduct,
  variants: [
    { id: 1, product_id: 901, name: 'غیرفعال', is_active: false, stock_quantity: 99 },
    { id: 2, product_id: 901, name: 'فعالِ تمام‌شده', is_active: true, stock_quantity: 0 },
    { id: 3, product_id: 901, name: 'فعالِ قابل‌فروش', is_active: true, stock_quantity: 4 },
  ],
});

assert.equal(mappedWithMixedVariants.in_stock, true, 'variant فعال و دارای موجودی باید محصول را قابل خرید کند');
assert.equal(mappedWithMixedVariants.stock_quantity, 4, 'موجودی غیرفعال نباید در موجودی قابل فروش جمع شود');
assert.equal(getDefaultSellableVariant(mappedWithMixedVariants)?.id, 3, 'انتخاب سریع باید نخستین variant فعال و دارای موجودی باشد');
assert.equal(isProductPurchasable(mappedWithMixedVariants), true, 'محصول دارای variant قابل فروش باید قابل خرید باشد');

const mappedWithOnlyInactiveVariants = mapProduct({
  ...baseProduct,
  variants: [
    { id: 4, product_id: 901, name: 'غیرفعال با موجودی', is_active: false, stock_quantity: 12 },
    { id: 5, product_id: 901, name: 'غیرفعال دیگر', is_active: false, stock_quantity: 3 },
  ],
});

assert.equal(mappedWithOnlyInactiveVariants.in_stock, false, 'پرچم قدیمی in_stock نباید variantهای غیرفعال را قابل خرید نشان دهد');
assert.equal(mappedWithOnlyInactiveVariants.stock_quantity, 0, 'variantهای غیرفعال نباید در موجودی مشتری ظاهر شوند');
assert.equal(getDefaultSellableVariant(mappedWithOnlyInactiveVariants), undefined, 'variant غیرفعال نباید برای سبد انتخاب شود');
assert.equal(isProductPurchasable(mappedWithOnlyInactiveVariants), false, 'محصول بدون variant قابل فروش باید ناموجود باشد');

console.log('Product availability regression: PASS');
