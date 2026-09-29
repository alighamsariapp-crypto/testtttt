import assert from 'node:assert/strict';
import { calculateFinalPrice } from '../../src/components/admin/staging/product-editor/utils';
import { mapProduct } from '../../src/services/apiMappers';

console.log('--- Running Product Discount & Image Upload Verification Tests ---');

// ============================================================================
// Test Scenario 1: Discount Calculation and Persistence (User scenario: 50,000,000 with 12% discount)
// ============================================================================
{
  const originalPrice = 50_000_000;
  const discountPercent = 12;
  const expectedFinalPrice = 44_000_000;

  const calculated = calculateFinalPrice(originalPrice, discountPercent);
  assert.equal(
    calculated,
    expectedFinalPrice,
    `Test 1 Failed: Expected ${expectedFinalPrice} but got ${calculated}`
  );
  console.log('✓ Test 1A: Discount calculation is mathematically exact (50,000,000 - 12% = 44,000,000)');

  // Test 0% discount preserves original price
  assert.equal(calculateFinalPrice(50_000_000, 0), 50_000_000);
  console.log('✓ Test 1B: 0% discount returns full original price');
}

// ============================================================================
// Test Scenario 2: Backend -> Frontend Mapping (apiMappers.ts)
// Ensure original_price and discount_percent survive round-trip mapping
// ============================================================================
{
  const backendProduct = {
    id: 999,
    name: 'تست لپ‌تاپ ایسوس',
    slug: 'asus-test-laptop',
    base_price: 50_000_000,
    original_price: 50_000_000,
    discount_percent: 12,
    variants: [
      {
        id: 9001,
        name: 'مشکی / 16GB',
        price: 44_000_000,
        original_price: 50_000_000,
        discount_percent: 12,
        sku: 'ASUS-BLK-16',
        is_active: true,
        inventory: { quantity: 15, reserved_quantity: 0 },
      },
    ],
  };

  const mapped = mapProduct(backendProduct);

  assert.equal(
    mapped.original_price,
    50_000_000,
    'Product original_price must be retained in replica model'
  );
  assert.equal(
    mapped.discount_percent,
    12,
    'Product discount_percent must be retained in replica model'
  );
  assert.equal(
    calculateFinalPrice(mapped.original_price, mapped.discount_percent),
    44_000_000,
    'Product price must be calculated correctly'
  );

  const variant = mapped.variants[0];
  assert.ok(variant, 'Variant must exist');
  assert.equal(
    variant.original_price,
    50_000_000,
    'Variant original_price must be preserved'
  );
  assert.equal(
    variant.discount_percent,
    12,
    'Variant discount_percent must be preserved'
  );
  assert.equal(
    calculateFinalPrice(variant.original_price!, variant.discount_percent!),
    44_000_000,
    'Variant calculated price must match formula'
  );

  console.log('✓ Test 2: API mappers faithfully preserve original_price & discount_percent for product and variants');
}

// ============================================================================
// Test Scenario 3: Variant without explicit discount (fallback behavior)
// ============================================================================
{
  const backendSimpleProduct = {
    id: 1000,
    name: 'گوشی موبایل ساده',
    slug: 'simple-phone',
    base_price: 30_000_000,
    variants: [
      {
        id: 9002,
        name: 'پیش‌فرض',
        price: 30_000_000,
        sku: 'PHONE-01',
        is_active: true,
        inventory: { quantity: 5, reserved_quantity: 0 },
      },
    ],
  };

  const mapped = mapProduct(backendSimpleProduct);
  assert.equal(mapped.original_price, 30_000_000);
  assert.equal(mapped.discount_percent, undefined);
  assert.equal(mapped.base_price, 30_000_000);
  console.log('✓ Test 3: Products without discount default cleanly to undefined discount_percent and original_price = base_price');
}

console.log('All verification tests passed successfully!');
