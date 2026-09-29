import { getDatabase, queryRows, persistDatabase } from "../../src/server/db";
import { handleCheckout, __testCheckoutFailureInjection } from "../../src/server/orderRoutes";

interface MockResponse {
  statusCode: number;
  data: any;
  headers: Record<string, string>;
  status: (code: number) => MockResponse;
  json: (body: any) => MockResponse;
  send: (body: any) => MockResponse;
  set: (k: string, v: string) => MockResponse;
  setHeader: (k: string, v: string) => MockResponse;
}

function createMockResponse(): MockResponse {
  const res: MockResponse = {
    statusCode: 200,
    data: null,
    headers: {},
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: any) {
      this.data = body;
      return this;
    },
    send(body: any) {
      this.data = body;
      return this;
    },
    set(k: string, v: string) {
      this.headers[k] = v;
      return this;
    },
    setHeader(k: string, v: string) {
      this.headers[k] = v;
      return this;
    },
  };
  return res;
}

async function runMicroTask1Tests() {
  console.log("============================================================================");
  console.log("Starting Micro-Task 1: Checkout Transaction Atomicity & Concurrency Test");
  console.log("============================================================================");

  const db = await getDatabase();
  if (!db) throw new Error("Database not initialized");

  // Setup test environment
  const now = new Date().toISOString();

  // Clean old test records
  db.run("DELETE FROM checkout_idempotency WHERE idempotency_key LIKE 'mt1_%'");
  db.run("DELETE FROM orders WHERE order_number LIKE 'ORD-MT1-%'");
  db.run("DELETE FROM users WHERE email LIKE 'mt1_%@test.com'");
  db.run("DELETE FROM inventory WHERE product_variant_id IN (9201)");
  db.run("DELETE FROM product_variants WHERE id IN (9201)");
  db.run("DELETE FROM products WHERE id IN (9101) OR slug LIKE 'mt1_%'");
  db.run("DELETE FROM discount_coupons WHERE code LIKE 'MT1_%'");
  db.run("DELETE FROM cart_items WHERE cart_id >= 9400 AND cart_id <= 9410");
  db.run("DELETE FROM carts WHERE id >= 9400 AND id <= 9410");

  // 1. Create test user
  db.run(
    `INSERT OR REPLACE INTO users (id, name, email, phone, password, role, status, created_at, updated_at)
     VALUES (9001, 'کاربر تستی MT1', 'mt1_user1@test.com', '09129001001', 'hash', 'customer', 'active', ?, ?)`,
    [now, now]
  );
  db.run(
    `INSERT OR REPLACE INTO personal_access_tokens (id, tokenable_type, tokenable_id, name, token, abilities, created_at, updated_at)
     VALUES (9001, 'App\\\\Modules\\\\Users\\\\Models\\\\User', 9001, 'token-9001', 'token_9001', '["*"]', ?, ?)`,
    [now, now]
  );
  // Deposit wallet funds for user 9001
  db.run("DELETE FROM wallet_transactions WHERE user_id = 9001");
  db.run(
    `INSERT INTO wallet_transactions (user_id, type, amount, currency, status, reference, description, created_at, updated_at)
     VALUES (9001, 'deposit', 50000000, 'IRR', 'successful', 'DEP-MT1-1', 'شارژ اولیه', ?, ?)`,
    [now, now]
  );

  // 2. Create test product & variant with stock = 10
  db.run(
    `INSERT INTO products (id, name, slug, sku, base_price, stock_quantity, is_active, created_at, updated_at)
     VALUES (9101, 'محصول MT1-A', 'mt1-prod-a', 'SKU-MT1-A', 1000000, 10, 1, ?, ?)`,
    [now, now]
  );
  db.run(
    `INSERT INTO product_variants (id, product_id, name, sku, price, stock_quantity, is_active, created_at, updated_at)
     VALUES (9201, 9101, 'واریانت اصلی', 'SKU-MT1-A-V1', 1000000, 10, 1, ?, ?)`,
    [now, now]
  );
  db.run(
    `INSERT INTO inventory (product_variant_id, quantity, reserved_quantity, safety_threshold, created_at, updated_at)
     VALUES (9201, 10, 0, 0, ?, ?)`,
    [now, now]
  );

  // 3. Create test coupon
  db.run(
    `INSERT INTO discount_coupons (id, code, title, discount_type, discount_value, usage_limit, usage_count, is_active, created_at, updated_at)
     VALUES (9301, 'MT1_COUPON_10', 'تخفیف ۱۰ درصدی', 'percentage', 10, 100, 0, 1, ?, ?)`,
    [now, now]
  );

  // 4. Create user cart with 2 units of variant 9201
  db.run(`INSERT INTO carts (id, user_id, created_at, updated_at) VALUES (9401, 9001, ?, ?)`, [now, now]);
  db.run(
    `INSERT INTO cart_items (cart_id, product_variant_id, quantity, created_at, updated_at)
     VALUES (9401, 9201, 2, ?, ?)`,
    [now, now]
  );
  persistDatabase();

  const standardPayload = {
    shipping_address: {
      recipient_name: "تستر اتمیک",
      phone: "09129001001",
      province: "تهران",
      city: "تهران",
      address_line: "خیابان آزادی، پلاک ۱۰",
    },
    shipping_method: "post",
    payment_gateway: "wallet",
    coupon_code: "MT1_COUPON_10",
  };

  function createAuthReq(userId: number, body: any, headers: Record<string, string> = {}) {
    return {
      headers: {
        authorization: `Bearer token_${userId}`,
        ...headers,
      },
      body,
      query: {},
      params: {},
    } as any;
  }

  // --------------------------------------------------------------------------
  // TEST A: 5 Concurrent Identical Checkouts (Same Idempotency Key)
  // --------------------------------------------------------------------------
  console.log("\n--- [TEST A] 5 Concurrent Identical Checkouts (Same Idempotency Key) ---");
  const idemKeyA = "mt1_test_a_" + Date.now();

  const initialStockA = Number(queryRows(db, "SELECT quantity FROM inventory WHERE product_variant_id = 9201")[0].quantity);
  const initialCouponA = Number(queryRows(db, "SELECT usage_count FROM discount_coupons WHERE id = 9301")[0].usage_count);

  const promisesA = Array.from({ length: 5 }, (_, i) => {
    const req = createAuthReq(9001, { ...standardPayload, idempotency_key: idemKeyA });
    const res = createMockResponse();
    return handleCheckout(req, res as any).then(() => res);
  });

  const resultsA = await Promise.all(promisesA);
  const statusCodesA = resultsA.map((r) => r.statusCode);
  console.log("Test A Responses Status Codes:", statusCodesA);

  const success201 = resultsA.filter((r) => r.statusCode === 201);
  const success200 = resultsA.filter((r) => r.statusCode === 200);

  if (success201.length !== 1 || success200.length !== 4) {
    throw new Error(`Test A FAILED: Expected exactly 1x 201 and 4x 200, got ${success201.length}x 201, ${success200.length}x 200`);
  }

  const orderNumberA = success201[0].data.order_number;
  for (const r of success200) {
    if (r.data.order_number !== orderNumberA) {
      throw new Error(`Test A FAILED: Cached order number mismatch. Expected ${orderNumberA}, got ${r.data.order_number}`);
    }
  }

  const finalStockA = Number(queryRows(db, "SELECT quantity FROM inventory WHERE product_variant_id = 9201")[0].quantity);
  const finalCouponA = Number(queryRows(db, "SELECT usage_count FROM discount_coupons WHERE id = 9301")[0].usage_count);

  if (finalStockA !== initialStockA - 2) {
    throw new Error(`Test A FAILED: Stock should decrease by 2 exactly once. Expected ${initialStockA - 2}, got ${finalStockA}`);
  }
  if (finalCouponA !== initialCouponA + 1) {
    throw new Error(`Test A FAILED: Coupon count should increase by 1 exactly once. Expected ${initialCouponA + 1}, got ${finalCouponA}`);
  }

  console.log("--> [TEST A PASSED]: 5 concurrent requests resulted in exactly 1 order, 1 stock decrement, 1 coupon increment, 4 identical cached responses.");

  // --------------------------------------------------------------------------
  // TEST B: Different Idempotency Keys, Limited Stock (Race Condition)
  // --------------------------------------------------------------------------
  console.log("\n--- [TEST B] 5 Concurrent Checkouts for Limited Stock (Stock = 1) ---");
  // Setup 5 users, each with 1 item in cart, but inventory only has 1 left
  db.run("UPDATE inventory SET quantity = 1 WHERE product_variant_id = 9201");
  db.run("UPDATE product_variants SET stock_quantity = 1 WHERE id = 9201");
  db.run("UPDATE products SET stock_quantity = 1 WHERE id = 9101");

  for (let u = 9002; u <= 9006; u++) {
    db.run(
      `INSERT OR REPLACE INTO users (id, name, email, phone, password, role, status, created_at, updated_at)
       VALUES (?, 'کاربر تستی MT1-B', 'mt1_user_${u}@test.com', '0912900${u}', 'hash', 'customer', 'active', ?, ?)`,
      [u, now, now]
    );
    db.run(
      `INSERT OR REPLACE INTO personal_access_tokens (id, tokenable_type, tokenable_id, name, token, abilities, created_at, updated_at)
       VALUES (?, 'App\\\\Modules\\\\Users\\\\Models\\\\User', ?, 'token-${u}', 'token_${u}', '["*"]', ?, ?)`,
      [u, u, now, now]
    );
    db.run("DELETE FROM wallet_transactions WHERE user_id = ?", [u]);
    db.run(
      `INSERT INTO wallet_transactions (user_id, type, amount, currency, status, reference, description, created_at, updated_at)
       VALUES (?, 'deposit', 50000000, 'IRR', 'successful', 'DEP-MT1-${u}', 'شارژ اولیه', ?, ?)`,
      [u, now, now]
    );
    db.run(`INSERT OR REPLACE INTO carts (id, user_id, created_at, updated_at) VALUES (?, ?, ?, ?)`, [9400 + u, u, now, now]);
    db.run(`DELETE FROM cart_items WHERE cart_id = ?`, [9400 + u]);
    db.run(
      `INSERT INTO cart_items (cart_id, product_variant_id, quantity, created_at, updated_at)
       VALUES (?, 9201, 1, ?, ?)`,
      [9400 + u, now, now]
    );
  }
  persistDatabase();

  const promisesB = [9002, 9003, 9004, 9005, 9006].map((u) => {
    const req = createAuthReq(u, { ...standardPayload, idempotency_key: `mt1_test_b_${u}_${Date.now()}` });
    const res = createMockResponse();
    return handleCheckout(req, res as any).then(() => res);
  });

  const resultsB = await Promise.all(promisesB);
  const statusCodesB = resultsB.map((r) => r.statusCode);
  console.log("Test B Responses Status Codes:", statusCodesB);

  const successB = resultsB.filter((r) => r.statusCode === 201);
  const rejectedB = resultsB.filter((r) => r.statusCode === 422);

  if (successB.length !== 1) {
    throw new Error(`Test B FAILED: Expected exactly 1 successful purchase, got ${successB.length}`);
  }
  if (rejectedB.length !== 4) {
    throw new Error(`Test B FAILED: Expected 4 requests rejected due to insufficient stock, got ${rejectedB.length}`);
  }

  const finalStockB = Number(queryRows(db, "SELECT quantity FROM inventory WHERE product_variant_id = 9201")[0].quantity);
  if (finalStockB !== 0) {
    throw new Error(`Test B FAILED: Stock should be 0, never negative. Got ${finalStockB}`);
  }

  console.log("--> [TEST B PASSED]: Limited stock correctly sold to exactly 1 user; 4 users rejected; stock reached 0 and never became negative.");

  // --------------------------------------------------------------------------
  // TEST C: Failure Injection at Each Database Step (Rollback Verification)
  // --------------------------------------------------------------------------
  console.log("\n--- [TEST C] Failure Injection at 5 Critical Points (Rollback Verification) ---");

  // Helper to re-seed user 9001 cart with stock 10
  function resetStockAndCart() {
    db.run("UPDATE inventory SET quantity = 10 WHERE product_variant_id = 9201");
    db.run("UPDATE product_variants SET stock_quantity = 10 WHERE id = 9201");
    db.run("UPDATE products SET stock_quantity = 10 WHERE id = 9101");
    db.run("UPDATE discount_coupons SET usage_count = 5 WHERE id = 9301");
    db.run("DELETE FROM cart_items WHERE cart_id = 9401");
    db.run("INSERT INTO cart_items (cart_id, product_variant_id, quantity, created_at, updated_at) VALUES (9401, 9201, 2, ?, ?)", [now, now]);
    persistDatabase();
  }

  const failurePoints = [
    { key: "failAfterStockDecrement", name: "After Stock Decrement" },
    { key: "failAfterOrderCreation", name: "After Order Creation" },
    { key: "failAfterOrderItemsCreation", name: "After Order Items Creation" },
    { key: "failAfterCouponUpdate", name: "After Coupon Update" },
    { key: "failAfterPaymentCreation", name: "After Payment Creation" },
  ] as const;

  for (const fp of failurePoints) {
    resetStockAndCart();
    const ordersCountBefore = Number(queryRows(db, "SELECT count(*) as c FROM orders")[0].c);
    const orderItemsCountBefore = Number(queryRows(db, "SELECT count(*) as c FROM order_items")[0].c);
    const paymentsCountBefore = Number(queryRows(db, "SELECT count(*) as c FROM payments")[0].c);

    // Activate failure injection hook
    (__testCheckoutFailureInjection as any)[fp.key] = true;

    const testKey = `mt1_fail_${fp.key}_${Date.now()}`;
    const req = createAuthReq(9001, { ...standardPayload, idempotency_key: testKey });
    const res = createMockResponse();

    await handleCheckout(req, res as any);

    // Reset failure hook
    (__testCheckoutFailureInjection as any)[fp.key] = false;

    console.log(`Testing Failure Point [${fp.name}] -> HTTP status: ${res.statusCode}`);
    if (res.statusCode !== 500) {
      throw new Error(`Test C FAILED: Expected 500 for ${fp.name}, got ${res.statusCode}`);
    }

    const ordersCountAfter = Number(queryRows(db, "SELECT count(*) as c FROM orders")[0].c);
    const orderItemsCountAfter = Number(queryRows(db, "SELECT count(*) as c FROM order_items")[0].c);
    const paymentsCountAfter = Number(queryRows(db, "SELECT count(*) as c FROM payments")[0].c);
    const stockAfter = Number(queryRows(db, "SELECT quantity FROM inventory WHERE product_variant_id = 9201")[0].quantity);
    const couponAfter = Number(queryRows(db, "SELECT usage_count FROM discount_coupons WHERE id = 9301")[0].usage_count);

    if (ordersCountAfter !== ordersCountBefore) {
      throw new Error(`Test C FAILED [${fp.name}]: Order was not rolled back! Before=${ordersCountBefore}, After=${ordersCountAfter}`);
    }
    if (orderItemsCountAfter !== orderItemsCountBefore) {
      throw new Error(`Test C FAILED [${fp.name}]: Order items were not rolled back! Before=${orderItemsCountBefore}, After=${orderItemsCountAfter}`);
    }
    if (paymentsCountAfter !== paymentsCountBefore) {
      throw new Error(`Test C FAILED [${fp.name}]: Payment was not rolled back! Before=${paymentsCountBefore}, After=${paymentsCountAfter}`);
    }
    if (stockAfter !== 10) {
      throw new Error(`Test C FAILED [${fp.name}]: Stock was not rolled back! Expected 10, got ${stockAfter}`);
    }
    if (couponAfter !== 5) {
      throw new Error(`Test C FAILED [${fp.name}]: Coupon usage was not rolled back! Expected 5, got ${couponAfter}`);
    }

    console.log(`  -> Rollback verified: Orders: +0, Items: +0, Payments: +0, Stock: 10 (intact), Coupon: 5 (intact).`);
  }

  console.log("--> [TEST C PASSED]: All 5 injection points properly triggered full transaction rollback!");

  // --------------------------------------------------------------------------
  // TEST D: Retry with Same Idempotency Key after Failed Transaction
  // --------------------------------------------------------------------------
  console.log("\n--- [TEST D] Retry with Same Idempotency Key after Failure ---");
  resetStockAndCart();

  const retryKey = `mt1_retry_${Date.now()}`;

  // 1. First attempt fails due to injection
  __testCheckoutFailureInjection.failAfterPaymentCreation = true;
  const reqD1 = createAuthReq(9001, { ...standardPayload, idempotency_key: retryKey });
  const resD1 = createMockResponse();
  await handleCheckout(reqD1, resD1 as any);
  __testCheckoutFailureInjection.failAfterPaymentCreation = false;

  if (resD1.statusCode !== 500) {
    throw new Error(`Test D FAILED: Initial attempt should fail with 500, got ${resD1.statusCode}`);
  }

  // 2. Second attempt with SAME idempotency key should succeed (retryable)
  const reqD2 = createAuthReq(9001, { ...standardPayload, idempotency_key: retryKey });
  const resD2 = createMockResponse();
  await handleCheckout(reqD2, resD2 as any);

  if (resD2.statusCode !== 201) {
    throw new Error(`Test D FAILED: Retry with same idempotency key should return 201, got ${resD2.statusCode}: ${JSON.stringify(resD2.data)}`);
  }

  const stockD = Number(queryRows(db, "SELECT quantity FROM inventory WHERE product_variant_id = 9201")[0].quantity);
  if (stockD !== 8) {
    throw new Error(`Test D FAILED: Stock should only be decremented once (by 2). Expected 8, got ${stockD}`);
  }

  console.log("--> [TEST D PASSED]: Failed transaction safely allows retry with same idempotency key, resulting in clean 201.");

  // --------------------------------------------------------------------------
  // TEST E: Retry after Successful Checkout with Same Idempotency Key
  // --------------------------------------------------------------------------
  console.log("\n--- [TEST E] Immediate Retry after Successful Checkout ---");
  const ordersCountE1 = Number(queryRows(db, "SELECT count(*) as c FROM orders")[0].c);

  const reqE = createAuthReq(9001, { ...standardPayload, idempotency_key: retryKey });
  const resE = createMockResponse();
  await handleCheckout(reqE, resE as any);

  if (resE.statusCode !== 200) {
    throw new Error(`Test E FAILED: Retry of completed checkout should return 200, got ${resE.statusCode}`);
  }
  if (resE.data.order_number !== resD2.data.order_number) {
    throw new Error(`Test E FAILED: Expected cached order ${resD2.data.order_number}, got ${resE.data.order_number}`);
  }

  const ordersCountE2 = Number(queryRows(db, "SELECT count(*) as c FROM orders")[0].c);
  if (ordersCountE2 !== ordersCountE1) {
    throw new Error(`Test E FAILED: Duplicate order created on completed idempotency retry!`);
  }

  console.log("--> [TEST E PASSED]: Repeated request returned cached 200 with zero duplicate database operations.");

  console.log("\n============================================================================");
  console.log("ALL MICRO-TASK 1 ATOMICITY & CONCURRENCY TESTS PASSED SUCCESSFULLY!");
  console.log("============================================================================");
}

runMicroTask1Tests().catch((err) => {
  console.error("MICRO-TASK 1 TEST SUITE FAILED:", err);
  process.exit(1);
});
