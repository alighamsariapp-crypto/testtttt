import express from "express";
import { Server } from "http";
import { getDatabase, persistDatabase, queryRows } from "../../src/server/db";
import { handleAdminUpdateOrderStatus, handleAdminReconcileRefund } from "../../src/server/adminRoutes";
import { handleCancelOrder } from "../../src/server/orderRoutes";
import { setZibalHttpClient } from "../../src/server/services/zibalService";
import {
  processOrderRefund,
  setSimulatedClaimRecordFailure,
  setSimulatedReconcileDbFailure,
  reconcileUnknownRefund,
} from "../../src/server/services/refundService";

async function runPhase1_1_R2_Tests() {
  console.log("=========================================================================");
  console.log("=== Starting Phase 1.1-R2: Refund Atomicity, Safety & Concurrency Tests ===");
  console.log("=========================================================================");

  const db = await getDatabase();
  const now = new Date().toISOString();

  // Setup test users
  db.run(`
    INSERT OR IGNORE INTO users (id, name, email, phone, password, role, status, created_at, updated_at)
    VALUES
      (951, 'کاربر آزمون R2', 'user_r2@apexstore.local', '09129510001', 'hash', 'customer', 'active', '${now}', '${now}'),
      (952, 'مدیر آزمون R2', 'admin_r2@apexstore.local', '09129510002', 'hash', 'admin', 'active', '${now}', '${now}');

    INSERT OR IGNORE INTO personal_access_tokens (id, tokenable_type, tokenable_id, name, token, abilities, created_at, updated_at)
    VALUES
      (951, 'App\\\\Modules\\\\Users\\\\Models\\\\User', 951, 'token-951', 'token_951', '["*"]', '${now}', '${now}'),
      (952, 'App\\\\Modules\\\\Users\\\\Models\\\\User', 952, 'token-952', 'token_952', '["*"]', '${now}', '${now}');
  `);
  persistDatabase();

  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.patch("/api/v1/admin/orders/:id/status", handleAdminUpdateOrderStatus);
  app.post("/api/v1/admin/orders/:id/refund/reconcile", handleAdminReconcileRefund);
  app.post("/api/v1/orders/:id/cancel", handleCancelOrder);

  const server: Server = await new Promise((resolve) => {
    const s = app.listen(3097, () => resolve(s));
  });

  const baseUrl = "http://127.0.0.1:3097";

  try {
    // -------------------------------------------------------------
    // TEST 1: ATOMIC CLAIM FAILURE
    // -------------------------------------------------------------
    console.log("\n--- [TEST 1] Atomic Claim Failure & Rollback ---");
    const order1Id = 9101;
    const payment1Id = 9101;
    const amount1 = 500000;

    db.run(`
      DELETE FROM payment_transactions WHERE payment_id = ${payment1Id} OR order_id = ${order1Id};
      DELETE FROM wallet_transactions WHERE order_id = ${order1Id};
      DELETE FROM payments WHERE id = ${payment1Id};
      DELETE FROM orders WHERE id = ${order1Id};

      INSERT INTO orders (id, order_number, user_id, status, payment_status, subtotal, grand_total, currency, shipping_address_snapshot, is_inventory_restored, created_at, updated_at)
      VALUES (${order1Id}, 'ORD-TEST1-9101', 951, 'paid', 'paid', ${amount1}, ${amount1}, 'IRR', '{}', 0, '${now}', '${now}');

      INSERT INTO payments (id, order_id, user_id, gateway, amount, currency, status, reference_id, gateway_payment_id, created_at, updated_at)
      VALUES (${payment1Id}, ${order1Id}, 951, 'wallet', ${amount1}, 'IRR', 'paid', 'REF-9101', 'REF-9101', '${now}', '${now}');
    `);
    persistDatabase();

    // Enable simulated failure during claim-record insertion
    setSimulatedClaimRecordFailure(true);

    const failClaimResult = await processOrderRefund({
      orderId: order1Id,
      adminUserId: 952,
      reason: "test_claim_failure",
    });

    setSimulatedClaimRecordFailure(false);

    if (failClaimResult.isSuccessful) {
      throw new Error("Test 1 FAILED: Expected claim failure but refund reported success!");
    }

    // Verify payment was rolled back and is NOT stuck in refund_processing
    const payment1Rows = queryRows(db, `SELECT status FROM payments WHERE id = ?`, [payment1Id]);
    if (payment1Rows[0]?.status !== "paid") {
      throw new Error(`Test 1 FAILED: Payment is stuck in '${payment1Rows[0]?.status}' instead of 'paid'!`);
    }

    // Verify no orphan claim record exists
    const claimRows1 = queryRows(
      db,
      `SELECT id FROM payment_transactions WHERE payment_id = ? AND event_type = 'refund_claim'`,
      [payment1Id]
    );
    if (claimRows1.length > 0) {
      throw new Error(`Test 1 FAILED: Orphan claim record exists in payment_transactions!`);
    }

    // Verify retry succeeds cleanly after fixing transient failure
    const retryResult = await processOrderRefund({
      orderId: order1Id,
      adminUserId: 952,
      reason: "test_claim_retry",
    });

    if (!retryResult.isSuccessful || retryResult.status !== "refunded") {
      throw new Error(`Test 1 FAILED: Retry failed! Message: ${retryResult.message}`);
    }

    const payment1AfterRetry = queryRows(db, `SELECT status FROM payments WHERE id = ?`, [payment1Id]);
    if (payment1AfterRetry[0]?.status !== "refunded") {
      throw new Error(`Test 1 FAILED: Payment is not 'refunded' after successful retry!`);
    }
    console.log("PASS: [TEST 1] Atomic Claim Failure rolled back cleanly and retry succeeded.");

    // -------------------------------------------------------------
    // TEST 2: CONCURRENT REFUND REQUESTS
    // -------------------------------------------------------------
    console.log("\n--- [TEST 2] Concurrent Refund Requests ---");
    const order2Id = 9102;
    const payment2Id = 9102;
    const amount2 = 600000;
    const trackId2 = 998002;

    db.run(`
      DELETE FROM payment_transactions WHERE payment_id = ${payment2Id} OR order_id = ${order2Id};
      DELETE FROM payments WHERE id = ${payment2Id};
      DELETE FROM orders WHERE id = ${order2Id};

      INSERT INTO orders (id, order_number, user_id, status, payment_status, subtotal, grand_total, currency, shipping_address_snapshot, is_inventory_restored, created_at, updated_at)
      VALUES (${order2Id}, 'ORD-TEST2-9102', 951, 'paid', 'paid', ${amount2}, ${amount2}, 'IRR', '{}', 0, '${now}', '${now}');

      INSERT INTO payments (id, order_id, user_id, gateway, amount, currency, status, reference_id, gateway_payment_id, created_at, updated_at)
      VALUES (${payment2Id}, ${order2Id}, 951, 'zibal', ${amount2}, 'IRR', 'paid', '${trackId2}', '${trackId2}', '${now}', '${now}');
    `);
    persistDatabase();

    let zibalCallsCount2 = 0;
    setZibalHttpClient(async (endpoint: string, payload: Record<string, any>) => {
      if (endpoint === "/v1/refund") {
        zibalCallsCount2++;
        await new Promise((r) => setTimeout(r, 60)); // Simulate gateway latency
        return { result: 100, message: "Refund successful" };
      }
      return { result: 100 };
    });

    // Fire 5 concurrent refund requests
    const responses2 = await Promise.all(
      Array.from({ length: 5 }).map(() =>
        fetch(`${baseUrl}/api/v1/admin/orders/${order2Id}/status`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer token_952",
          },
          body: JSON.stringify({ status: "refunded" }),
        })
      )
    );

    const jsonResults2 = await Promise.all(responses2.map((r) => r.json()));

    if (zibalCallsCount2 !== 1) {
      throw new Error(`Test 2 FAILED: Zibal called ${zibalCallsCount2} times! Expected exactly 1.`);
    }

    const successfulTx2 = queryRows(
      db,
      `SELECT id FROM payment_transactions WHERE payment_id = ? AND event_type = 'refund' AND status = 'successful'`,
      [payment2Id]
    );
    if (successfulTx2.length !== 1) {
      throw new Error(`Test 2 FAILED: Found ${successfulTx2.length} successful transactions! Expected exactly 1.`);
    }

    const payment2Status = queryRows(db, `SELECT status FROM payments WHERE id = ?`, [payment2Id]);
    if (payment2Status[0]?.status !== "refunded") {
      throw new Error(`Test 2 FAILED: Payment is not refunded! Status: ${payment2Status[0]?.status}`);
    }
    console.log("PASS: [TEST 2] Exactly one external refund executed across 5 concurrent requests.");

    // -------------------------------------------------------------
    // TEST 3: GATEWAY EXPLICIT FAILURE
    // -------------------------------------------------------------
    console.log("\n--- [TEST 3] Gateway Explicit Failure ---");
    const order3Id = 9103;
    const payment3Id = 9103;
    const amount3 = 700000;
    const trackId3 = 998003;

    db.run(`
      DELETE FROM payment_transactions WHERE payment_id = ${payment3Id} OR order_id = ${order3Id};
      DELETE FROM payments WHERE id = ${payment3Id};
      DELETE FROM orders WHERE id = ${order3Id};

      INSERT INTO orders (id, order_number, user_id, status, payment_status, subtotal, grand_total, currency, shipping_address_snapshot, is_inventory_restored, created_at, updated_at)
      VALUES (${order3Id}, 'ORD-TEST3-9103', 951, 'paid', 'paid', ${amount3}, ${amount3}, 'IRR', '{}', 0, '${now}', '${now}');

      INSERT INTO payments (id, order_id, user_id, gateway, amount, currency, status, reference_id, gateway_payment_id, created_at, updated_at)
      VALUES (${payment3Id}, ${order3Id}, 951, 'zibal', ${amount3}, 'IRR', 'paid', '${trackId3}', '${trackId3}', '${now}', '${now}');
    `);
    persistDatabase();

    setZibalHttpClient(async (endpoint: string) => {
      if (endpoint === "/v1/refund") {
        return { result: 202, message: "موجودی حساب پذیرنده برای استرداد کافی نیست" };
      }
      return { result: 100 };
    });

    const res3 = await fetch(`${baseUrl}/api/v1/admin/orders/${order3Id}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer token_952",
      },
      body: JSON.stringify({ status: "refunded" }),
    });

    const json3 = await res3.json();
    if (res3.status !== 422 || json3.success !== false) {
      throw new Error(`Test 3 FAILED: Expected 422 error response, got ${res3.status}`);
    }

    const payment3Rows = queryRows(db, `SELECT status FROM payments WHERE id = ?`, [payment3Id]);
    if (payment3Rows[0]?.status !== "refund_failed") {
      throw new Error(`Test 3 FAILED: Payment should be 'refund_failed', got: ${payment3Rows[0]?.status}`);
    }

    const successTx3 = queryRows(
      db,
      `SELECT id FROM payment_transactions WHERE payment_id = ? AND event_type = 'refund' AND status = 'successful'`,
      [payment3Id]
    );
    if (successTx3.length > 0) {
      throw new Error("Test 3 FAILED: Found successful refund transaction on explicit failure!");
    }

    const failTx3 = queryRows(
      db,
      `SELECT id FROM payment_transactions WHERE payment_id = ? AND event_type = 'refund' AND status = 'failed'`,
      [payment3Id]
    );
    if (failTx3.length !== 1) {
      throw new Error("Test 3 FAILED: Expected 1 failed refund record in payment_transactions!");
    }

    // Verify refund remains retryable
    setZibalHttpClient(async () => ({ result: 100, message: "Refund succeeded on retry" }));
    const retryRes3 = await processOrderRefund({ orderId: order3Id, adminUserId: 952 });
    if (!retryRes3.isSuccessful || retryRes3.status !== "refunded") {
      throw new Error("Test 3 FAILED: Retry after failure did not succeed!");
    }
    console.log("PASS: [TEST 3] Explicit gateway failure handled correctly and remains retryable.");

    // -------------------------------------------------------------
    // TEST 4: AMBIGUOUS GATEWAY RESULT (TIMEOUT / NETWORK ERROR)
    // -------------------------------------------------------------
    console.log("\n--- [TEST 4] Ambiguous Gateway Result (Timeout / Network Error) ---");
    const order4Id = 9104;
    const payment4Id = 9104;
    const amount4 = 800000;
    const trackId4 = 998004;

    db.run(`
      DELETE FROM payment_transactions WHERE payment_id = ${payment4Id} OR order_id = ${order4Id};
      DELETE FROM payments WHERE id = ${payment4Id};
      DELETE FROM orders WHERE id = ${order4Id};

      INSERT INTO orders (id, order_number, user_id, status, payment_status, subtotal, grand_total, currency, shipping_address_snapshot, is_inventory_restored, created_at, updated_at)
      VALUES (${order4Id}, 'ORD-TEST4-9104', 951, 'paid', 'paid', ${amount4}, ${amount4}, 'IRR', '{}', 0, '${now}', '${now}');

      INSERT INTO payments (id, order_id, user_id, gateway, amount, currency, status, reference_id, gateway_payment_id, created_at, updated_at)
      VALUES (${payment4Id}, ${order4Id}, 951, 'zibal', ${amount4}, 'IRR', 'paid', '${trackId4}', '${trackId4}', '${now}', '${now}');
    `);
    persistDatabase();

    let callsCount4 = 0;
    setZibalHttpClient(async (endpoint: string) => {
      if (endpoint === "/v1/refund") {
        callsCount4++;
        throw new Error("ETIMEDOUT: Connection to Zibal timed out");
      }
      return { result: 100 };
    });

    const res4 = await processOrderRefund({
      orderId: order4Id,
      adminUserId: 952,
      reason: "test_ambiguous_timeout",
    });

    if (res4.isSuccessful) {
      throw new Error("Test 4 FAILED: Expected failure on gateway timeout!");
    }

    // Must be marked refund_unknown
    const payment4Rows = queryRows(db, `SELECT status FROM payments WHERE id = ?`, [payment4Id]);
    if (payment4Rows[0]?.status !== "refund_unknown") {
      throw new Error(`Test 4 FAILED: Expected status 'refund_unknown', got: ${payment4Rows[0]?.status}`);
    }

    // Verify a subsequent call does NOT blindly call Zibal again
    const secondCallRes4 = await processOrderRefund({
      orderId: order4Id,
      adminUserId: 952,
      reason: "test_second_attempt_on_unknown",
    });

    if (secondCallRes4.error !== "RECONCILIATION_REQUIRED") {
      throw new Error(`Test 4 FAILED: Expected RECONCILIATION_REQUIRED error, got: ${secondCallRes4.error}`);
    }

    if (callsCount4 !== 1) {
      throw new Error(`Test 4 FAILED: Gateway was called ${callsCount4} times! Blind retry occurred!`);
    }

    // Admin reconciles with confirmed_success
    const reconcileRes = await reconcileUnknownRefund({
      orderId: order4Id,
      decision: "confirmed_success",
      adminUserId: 952,
      notes: "تایید شده در داشبورد زیبال",
      externalReference: "REF-ZIBAL-998004",
    });

    if (!reconcileRes.success) {
      throw new Error(`Test 4 FAILED: Admin reconcile failed: ${reconcileRes.message}`);
    }

    const payment4Reconciled = queryRows(db, `SELECT status FROM payments WHERE id = ?`, [payment4Id]);
    if (payment4Reconciled[0]?.status !== "refunded") {
      throw new Error(`Test 4 FAILED: Expected status 'refunded' after reconciliation!`);
    }
    console.log("PASS: [TEST 4] Ambiguous outcome entered 'refund_unknown', prevented blind retries, and reconciled cleanly.");

    // -------------------------------------------------------------
    // TEST 5: CRASH AFTER GATEWAY SUCCESS BUT BEFORE LOCAL PERSISTENCE
    // -------------------------------------------------------------
    console.log("\n--- [TEST 5] Crash After Gateway Success (Stale refund_processing) ---");
    const order5Id = 9105;
    const payment5Id = 9105;
    const amount5 = 900000;
    const trackId5 = 998005;

    // Simulate state where server previously died while status was 'refund_processing'
    db.run(`
      DELETE FROM payment_transactions WHERE payment_id = ${payment5Id} OR order_id = ${order5Id};
      DELETE FROM payments WHERE id = ${payment5Id};
      DELETE FROM orders WHERE id = ${order5Id};

      INSERT INTO orders (id, order_number, user_id, status, payment_status, subtotal, grand_total, currency, shipping_address_snapshot, is_inventory_restored, created_at, updated_at)
      VALUES (${order5Id}, 'ORD-TEST5-9105', 951, 'paid', 'paid', ${amount5}, ${amount5}, 'IRR', '{}', 0, '${now}', '${now}');

      INSERT INTO payments (id, order_id, user_id, gateway, amount, currency, status, reference_id, gateway_payment_id, created_at, updated_at)
      VALUES (${payment5Id}, ${order5Id}, 951, 'zibal', ${amount5}, 'IRR', 'refund_processing', '${trackId5}', '${trackId5}', '${now}', '${now}');
    `);
    persistDatabase();

    let callsCount5 = 0;
    setZibalHttpClient(async () => {
      callsCount5++;
      return { result: 100 };
    });

    const res5 = await processOrderRefund({
      orderId: order5Id,
      adminUserId: 952,
    });

    if (res5.error !== "RECONCILIATION_REQUIRED") {
      throw new Error(`Test 5 FAILED: Expected RECONCILIATION_REQUIRED, got: ${res5.error}`);
    }

    if (callsCount5 !== 0) {
      throw new Error(`Test 5 FAILED: System blindly issued external refund (${callsCount5} calls)!`);
    }

    const payment5Rows = queryRows(db, `SELECT status FROM payments WHERE id = ?`, [payment5Id]);
    if (payment5Rows[0]?.status !== "refund_unknown") {
      throw new Error(`Test 5 FAILED: Payment should have transitioned to 'refund_unknown', got: ${payment5Rows[0]?.status}`);
    }
    console.log("PASS: [TEST 5] Crashed state safely quarantined into 'refund_unknown' without blind gateway call.");

    // -------------------------------------------------------------
    // TEST 6: PARTIAL REFUND PROTECTION
    // -------------------------------------------------------------
    console.log("\n--- [TEST 6] Partial Refund Protection (Full Refund Only Mode) ---");
    const order6Id = 9106;
    const payment6Id = 9106;
    const amount6 = 1000000;

    db.run(`
      DELETE FROM payment_transactions WHERE payment_id = ${payment6Id} OR order_id = ${order6Id};
      DELETE FROM wallet_transactions WHERE order_id = ${order6Id};
      DELETE FROM payments WHERE id = ${payment6Id};
      DELETE FROM orders WHERE id = ${order6Id};

      INSERT INTO orders (id, order_number, user_id, status, payment_status, subtotal, grand_total, currency, shipping_address_snapshot, is_inventory_restored, created_at, updated_at)
      VALUES (${order6Id}, 'ORD-TEST6-9106', 951, 'paid', 'paid', ${amount6}, ${amount6}, 'IRR', '{}', 0, '${now}', '${now}');

      INSERT INTO payments (id, order_id, user_id, gateway, amount, currency, status, reference_id, gateway_payment_id, created_at, updated_at)
      VALUES (${payment6Id}, ${order6Id}, 951, 'wallet', ${amount6}, 'IRR', 'paid', 'REF-9106', 'REF-9106', '${now}', '${now}');
    `);
    persistDatabase();

    // 1. Partial amount (400,000 out of 1,000,000)
    const partialRes = await processOrderRefund({
      orderId: order6Id,
      amount: 400000,
      adminUserId: 952,
    });

    if (partialRes.isSuccessful || partialRes.error !== "PARTIAL_REFUND_NOT_SUPPORTED") {
      throw new Error(`Test 6 FAILED: Expected PARTIAL_REFUND_NOT_SUPPORTED, got: ${partialRes.error}`);
    }

    // 2. Negative amount
    const negativeRes = await processOrderRefund({
      orderId: order6Id,
      amount: -50000,
      adminUserId: 952,
    });
    if (negativeRes.error !== "INVALID_REFUND_AMOUNT") {
      throw new Error(`Test 6 FAILED: Expected INVALID_REFUND_AMOUNT, got: ${negativeRes.error}`);
    }

    // 3. Excess amount (1,500,000 out of 1,000,000)
    const excessRes = await processOrderRefund({
      orderId: order6Id,
      amount: 1500000,
      adminUserId: 952,
    });
    if (excessRes.error !== "REFUND_AMOUNT_EXCEEDS_REFUNDABLE") {
      throw new Error(`Test 6 FAILED: Expected REFUND_AMOUNT_EXCEEDS_REFUNDABLE, got: ${excessRes.error}`);
    }

    // 4. Verify payment remained untouched and fully refundable
    const payment6Rows = queryRows(db, `SELECT status, amount FROM payments WHERE id = ?`, [payment6Id]);
    if (payment6Rows[0]?.status !== "paid") {
      throw new Error(`Test 6 FAILED: Payment status changed unexpectedly to: ${payment6Rows[0]?.status}`);
    }

    // 5. Full refund (1,000,000 or omitted amount) succeeds cleanly
    const fullRes = await processOrderRefund({
      orderId: order6Id,
      amount: 1000000,
      adminUserId: 952,
    });
    if (!fullRes.isSuccessful || fullRes.status !== "refunded" || fullRes.refundedAmount !== 1000000) {
      throw new Error(`Test 6 FAILED: Full refund failed! Result: ${JSON.stringify(fullRes)}`);
    }
    console.log("PASS: [TEST 6] Partial, negative, and excessive refunds strictly rejected; full refund succeeded.");

    // =============================================================
    // RECONCILIATION INTEGRITY & CONCURRENCY TESTS (TESTS A - F)
    // =============================================================

    // -------------------------------------------------------------
    // TEST A: Two concurrent confirmed_success reconciliation requests
    // -------------------------------------------------------------
    console.log("\n--- [TEST A] Two Concurrent confirmed_success Reconciliation Requests ---");
    const orderAId = 9201;
    const paymentAId = 9201;
    const productAId = 9201;
    const variantAId = 9201;
    const invAId = 9201;
    const amountA = 500000;

    db.run(`
      DELETE FROM payment_transactions WHERE payment_id = ${paymentAId} OR order_id = ${orderAId};
      DELETE FROM payments WHERE id = ${paymentAId};
      DELETE FROM order_items WHERE order_id = ${orderAId};
      DELETE FROM orders WHERE id = ${orderAId};
      DELETE FROM inventory WHERE id = ${invAId} OR product_variant_id = ${variantAId};
      DELETE FROM product_variants WHERE id = ${variantAId} OR sku = 'SKU-TEST-A-9201';
      DELETE FROM products WHERE id = ${productAId} OR slug = 'product-test-a' OR sku = 'SKU-PROD-A-9201';

      INSERT INTO products (id, name, slug, sku, base_price, stock_quantity, initial_stock, in_stock, is_active, created_at, updated_at)
      VALUES (${productAId}, 'Product Test A', 'product-test-a', 'SKU-PROD-A-9201', ${amountA}, 10, 10, 1, 1, '${now}', '${now}');

      INSERT INTO product_variants (id, product_id, name, sku, price, stock, stock_quantity, is_active, created_at, updated_at)
      VALUES (${variantAId}, ${productAId}, 'Variant Test A', 'SKU-TEST-A-9201', ${amountA}, 10, 10, 1, '${now}', '${now}');

      INSERT INTO inventory (id, product_variant_id, quantity, reserved_quantity, safety_threshold, created_at, updated_at)
      VALUES (${invAId}, ${variantAId}, 10, 0, 0, '${now}', '${now}');

      INSERT INTO orders (id, order_number, user_id, status, payment_status, subtotal, grand_total, currency, shipping_address_snapshot, is_inventory_restored, created_at, updated_at)
      VALUES (${orderAId}, 'ORD-TESTA-9201', 951, 'processing', 'processing', ${amountA}, ${amountA}, 'IRR', '{}', 0, '${now}', '${now}');

      INSERT INTO order_items (id, order_id, product_id, product_variant_id, product_name_snapshot, quantity, unit_price, total_price, created_at, updated_at)
      VALUES (9201, ${orderAId}, ${productAId}, ${variantAId}, 'Product Test A', 2, ${amountA}, ${amountA}, '${now}', '${now}');

      INSERT INTO payments (id, order_id, user_id, gateway, amount, currency, status, reference_id, gateway_payment_id, created_at, updated_at)
      VALUES (${paymentAId}, ${orderAId}, 951, 'zibal', ${amountA}, 'IRR', 'refund_unknown', 'REF-A-ORIG', 'REF-A-ORIG', '${now}', '${now}');
    `);
    persistDatabase();

    const [resA1, resA2] = await Promise.all([
      reconcileUnknownRefund({
        orderId: orderAId,
        paymentId: paymentAId,
        decision: "confirmed_success",
        adminUserId: 952,
        externalReference: "REF-CONC-SUCCESS-A",
        notes: "Concurrent reconcile attempt 1",
      }),
      reconcileUnknownRefund({
        orderId: orderAId,
        paymentId: paymentAId,
        decision: "confirmed_success",
        adminUserId: 952,
        externalReference: "REF-CONC-SUCCESS-A",
        notes: "Concurrent reconcile attempt 2",
      }),
    ]);

    if (!resA1.success || !resA2.success) {
      throw new Error(`Test A FAILED: One or both concurrent requests failed: ${JSON.stringify({ resA1, resA2 })}`);
    }

    // Exactly 1 successful refund transaction
    const txA = queryRows(
      db,
      `SELECT * FROM payment_transactions WHERE payment_id = ? AND event_type = 'refund' AND status = 'successful'`,
      [paymentAId]
    );
    if (txA.length !== 1) {
      throw new Error(`Test A FAILED: Expected exactly 1 successful refund transaction, got ${txA.length}`);
    }

    // Exactly 1 state transition to 'refunded'
    const paymentARows = queryRows(db, `SELECT status FROM payments WHERE id = ?`, [paymentAId]);
    if (paymentARows[0]?.status !== "refunded") {
      throw new Error(`Test A FAILED: Payment status is ${paymentARows[0]?.status}, expected 'refunded'`);
    }

    const orderARows = queryRows(db, `SELECT status, payment_status, is_inventory_restored FROM orders WHERE id = ?`, [orderAId]);
    if (orderARows[0]?.status !== "refunded" || orderARows[0]?.payment_status !== "refunded") {
      throw new Error(`Test A FAILED: Order status not updated to refunded`);
    }
    if (Number(orderARows[0]?.is_inventory_restored) !== 1) {
      throw new Error(`Test A FAILED: Order is_inventory_restored is not 1`);
    }

    // Exactly 1 inventory restoration (10 + 2 = 12, NOT 14)
    const invARows = queryRows(db, `SELECT quantity FROM inventory WHERE id = ?`, [invAId]);
    if (Number(invARows[0]?.quantity) !== 12) {
      throw new Error(`Test A FAILED: Inventory quantity is ${invARows[0]?.quantity}, expected 12 (restored exactly once)`);
    }

    // Zero duplicate wallet credits
    const walletTxA = queryRows(db, `SELECT * FROM wallet_transactions WHERE user_id = 951 AND reference LIKE '%9201%'`);
    if (walletTxA.length !== 0) {
      throw new Error(`Test A FAILED: Unexpected wallet transactions created: ${walletTxA.length}`);
    }

    console.log("PASS: [TEST A] Two concurrent confirmed_success requests handled with exactly 1 transaction and 1 inventory restoration.");

    // -------------------------------------------------------------
    // TEST B: Two concurrent confirmed_failure reconciliation requests
    // -------------------------------------------------------------
    console.log("\n--- [TEST B] Two Concurrent confirmed_failure Reconciliation Requests ---");
    const orderBId = 9202;
    const paymentBId = 9202;
    const productBId = 9202;
    const variantBId = 9202;
    const invBId = 9202;
    const amountB = 300000;

    db.run(`
      DELETE FROM payment_transactions WHERE payment_id = ${paymentBId} OR order_id = ${orderBId};
      DELETE FROM payments WHERE id = ${paymentBId};
      DELETE FROM order_items WHERE order_id = ${orderBId};
      DELETE FROM orders WHERE id = ${orderBId};
      DELETE FROM inventory WHERE id = ${invBId} OR product_variant_id = ${variantBId};
      DELETE FROM product_variants WHERE id = ${variantBId};
      DELETE FROM products WHERE id = ${productBId};

      INSERT INTO products (id, name, slug, sku, base_price, stock_quantity, initial_stock, in_stock, is_active, created_at, updated_at)
      VALUES (${productBId}, 'Product Test B', 'product-test-b', 'SKU-PROD-B-9202', ${amountB}, 10, 10, 1, 1, '${now}', '${now}');

      INSERT INTO product_variants (id, product_id, name, sku, price, stock, stock_quantity, is_active, created_at, updated_at)
      VALUES (${variantBId}, ${productBId}, 'Variant Test B', 'SKU-TEST-B-9202', ${amountB}, 10, 10, 1, '${now}', '${now}');

      INSERT INTO inventory (id, product_variant_id, quantity, reserved_quantity, safety_threshold, created_at, updated_at)
      VALUES (${invBId}, ${variantBId}, 10, 0, 0, '${now}', '${now}');

      INSERT INTO orders (id, order_number, user_id, status, payment_status, subtotal, grand_total, currency, shipping_address_snapshot, is_inventory_restored, created_at, updated_at)
      VALUES (${orderBId}, 'ORD-TESTB-9202', 951, 'processing', 'processing', ${amountB}, ${amountB}, 'IRR', '{}', 0, '${now}', '${now}');

      INSERT INTO order_items (id, order_id, product_id, product_variant_id, product_name_snapshot, quantity, unit_price, total_price, created_at, updated_at)
      VALUES (9202, ${orderBId}, ${productBId}, ${variantBId}, 'Product Test B', 2, ${amountB}, ${amountB}, '${now}', '${now}');

      INSERT INTO payments (id, order_id, user_id, gateway, amount, currency, status, reference_id, gateway_payment_id, created_at, updated_at)
      VALUES (${paymentBId}, ${orderBId}, 951, 'zibal', ${amountB}, 'IRR', 'refund_unknown', 'REF-B-ORIG', 'REF-B-ORIG', '${now}', '${now}');
    `);
    persistDatabase();

    const [resB1, resB2] = await Promise.all([
      reconcileUnknownRefund({
        orderId: orderBId,
        paymentId: paymentBId,
        decision: "confirmed_failure",
        adminUserId: 952,
        notes: "Concurrent failure attempt 1",
      }),
      reconcileUnknownRefund({
        orderId: orderBId,
        paymentId: paymentBId,
        decision: "confirmed_failure",
        adminUserId: 952,
        notes: "Concurrent failure attempt 2",
      }),
    ]);

    if (!resB1.success || !resB2.success) {
      throw new Error(`Test B FAILED: One or both concurrent requests failed: ${JSON.stringify({ resB1, resB2 })}`);
    }

    // No successful refund transaction
    const txBSuccess = queryRows(
      db,
      `SELECT * FROM payment_transactions WHERE payment_id = ? AND event_type = 'refund' AND status = 'successful'`,
      [paymentBId]
    );
    if (txBSuccess.length !== 0) {
      throw new Error(`Test B FAILED: Found unexpected successful refund transaction!`);
    }

    // Exactly 1 failed transaction record
    const txBFailed = queryRows(
      db,
      `SELECT * FROM payment_transactions WHERE payment_id = ? AND event_type = 'refund' AND status = 'failed'`,
      [paymentBId]
    );
    if (txBFailed.length !== 1) {
      throw new Error(`Test B FAILED: Expected exactly 1 failed transaction record, got ${txBFailed.length}`);
    }

    // Stable final state
    const paymentBRows = queryRows(db, `SELECT status FROM payments WHERE id = ?`, [paymentBId]);
    if (paymentBRows[0]?.status !== "refund_failed") {
      throw new Error(`Test B FAILED: Payment status is ${paymentBRows[0]?.status}, expected 'refund_failed'`);
    }

    // Order status and inventory remain untouched
    const orderBRows = queryRows(db, `SELECT status, payment_status, is_inventory_restored FROM orders WHERE id = ?`, [orderBId]);
    if (orderBRows[0]?.payment_status === "refunded") {
      throw new Error(`Test B FAILED: Order payment_status should not be refunded`);
    }
    if (Number(orderBRows[0]?.is_inventory_restored) !== 0) {
      throw new Error(`Test B FAILED: Order inventory was restored unexpectedly`);
    }

    const invBRows = queryRows(db, `SELECT quantity FROM inventory WHERE id = ?`, [invBId]);
    if (Number(invBRows[0]?.quantity) !== 10) {
      throw new Error(`Test B FAILED: Inventory quantity changed unexpectedly to ${invBRows[0]?.quantity}`);
    }

    console.log("PASS: [TEST B] Two concurrent confirmed_failure requests produced no money creation, no stock restoration, and idempotent retryable status.");

    // -------------------------------------------------------------
    // TEST C: confirmed_success followed immediately by another reconciliation attempt
    // -------------------------------------------------------------
    console.log("\n--- [TEST C] confirmed_success Followed by Subsequent Reconciliation ---");
    // Attempt 1: Re-submit confirmed_success on already reconciled payment A
    const resC1 = await reconcileUnknownRefund({
      orderId: orderAId,
      paymentId: paymentAId,
      decision: "confirmed_success",
      adminUserId: 952,
      externalReference: "REF-CONC-SUCCESS-A",
      notes: "Duplicate attempt",
    });

    if (!resC1.success || !resC1.alreadyReconciled) {
      throw new Error(`Test C FAILED: Expected idempotent success with alreadyReconciled: true, got: ${JSON.stringify(resC1)}`);
    }

    // Attempt 2: Attempt confirmed_failure on already refunded payment A
    const resC2 = await reconcileUnknownRefund({
      orderId: orderAId,
      paymentId: paymentAId,
      decision: "confirmed_failure",
      adminUserId: 952,
      notes: "Contradictory attempt",
    });

    if (resC2.success || resC2.error !== "PAYMENT_NOT_IN_UNKNOWN_STATUS") {
      throw new Error(`Test C FAILED: Expected PAYMENT_NOT_IN_UNKNOWN_STATUS, got: ${JSON.stringify(resC2)}`);
    }

    // Verify still exactly 1 refund transaction and unchanged stock
    const txCAfter = queryRows(
      db,
      `SELECT * FROM payment_transactions WHERE payment_id = ? AND event_type = 'refund'`,
      [paymentAId]
    );
    if (txCAfter.length !== 1) {
      throw new Error(`Test C FAILED: Unexpected duplicate transaction count: ${txCAfter.length}`);
    }

    const invCAfter = queryRows(db, `SELECT quantity FROM inventory WHERE id = ?`, [invAId]);
    if (Number(invCAfter[0]?.quantity) !== 12) {
      throw new Error(`Test C FAILED: Inventory corrupted after subsequent attempt: ${invCAfter[0]?.quantity}`);
    }

    console.log("PASS: [TEST C] Subsequent reconciliation requests are strictly idempotent and prevent duplicate financial operations.");

    // -------------------------------------------------------------
    // TEST D: Wrong payment ID / wrong order ID relationship
    // -------------------------------------------------------------
    console.log("\n--- [TEST D] Wrong Payment ID / Order ID Relationship ---");
    const resD = await reconcileUnknownRefund({
      orderId: orderAId,
      paymentId: paymentBId, // paymentB belongs to orderB, NOT orderA!
      decision: "confirmed_success",
      adminUserId: 952,
      externalReference: "REF-MISMATCH-TEST",
    });

    if (resD.success || resD.error !== "PAYMENT_ORDER_MISMATCH") {
      throw new Error(`Test D FAILED: Expected PAYMENT_ORDER_MISMATCH, got: ${JSON.stringify(resD)}`);
    }
    console.log("PASS: [TEST D] Mismatched payment/order pair strictly rejected.");

    // -------------------------------------------------------------
    // TEST E: Missing/invalid external reference for confirmed_success
    // -------------------------------------------------------------
    console.log("\n--- [TEST E] Missing/Invalid External Reference for confirmed_success ---");
    const orderEId = 9205;
    const paymentEId = 9205;
    const amountE = 450000;

    db.run(`
      DELETE FROM payment_transactions WHERE payment_id = ${paymentEId} OR order_id = ${orderEId};
      DELETE FROM payments WHERE id = ${paymentEId};
      DELETE FROM orders WHERE id = ${orderEId};

      INSERT INTO orders (id, order_number, user_id, status, payment_status, subtotal, grand_total, currency, shipping_address_snapshot, is_inventory_restored, created_at, updated_at)
      VALUES (${orderEId}, 'ORD-TESTE-9205', 951, 'processing', 'processing', ${amountE}, ${amountE}, 'IRR', '{}', 0, '${now}', '${now}');

      INSERT INTO payments (id, order_id, user_id, gateway, amount, currency, status, reference_id, gateway_payment_id, created_at, updated_at)
      VALUES (${paymentEId}, ${orderEId}, 951, 'zibal', ${amountE}, 'IRR', 'refund_unknown', 'REF-E-ORIG', 'REF-E-ORIG', '${now}', '${now}');
    `);
    persistDatabase();

    // 1. Omitted external reference
    const resE1 = await reconcileUnknownRefund({
      orderId: orderEId,
      paymentId: paymentEId,
      decision: "confirmed_success",
      adminUserId: 952,
    });
    if (resE1.success || resE1.error !== "EXTERNAL_REFERENCE_REQUIRED") {
      throw new Error(`Test E1 FAILED: Expected EXTERNAL_REFERENCE_REQUIRED, got: ${JSON.stringify(resE1)}`);
    }

    // 2. Whitespace-only external reference
    const resE2 = await reconcileUnknownRefund({
      orderId: orderEId,
      paymentId: paymentEId,
      decision: "confirmed_success",
      adminUserId: 952,
      externalReference: "   ",
    });
    if (resE2.success || resE2.error !== "EXTERNAL_REFERENCE_REQUIRED") {
      throw new Error(`Test E2 FAILED: Expected EXTERNAL_REFERENCE_REQUIRED, got: ${JSON.stringify(resE2)}`);
    }

    // Verify payment remains in refund_unknown with zero transactions
    const paymentERows = queryRows(db, `SELECT status FROM payments WHERE id = ?`, [paymentEId]);
    if (paymentERows[0]?.status !== "refund_unknown") {
      throw new Error(`Test E FAILED: Payment status changed unexpectedly to ${paymentERows[0]?.status}`);
    }
    const txE = queryRows(db, `SELECT * FROM payment_transactions WHERE payment_id = ?`, [paymentEId]);
    if (txE.length !== 0) {
      throw new Error(`Test E FAILED: Unexpected transaction recorded for invalid request`);
    }

    console.log("PASS: [TEST E] External reference is strictly required and validated for confirmed_success.");

    // -------------------------------------------------------------
    // TEST F: Database failure during reconciliation
    // -------------------------------------------------------------
    console.log("\n--- [TEST F] Database Failure During Reconciliation ---");
    const orderFId = 9206;
    const paymentFId = 9206;
    const productFId = 9206;
    const variantFId = 9206;
    const invFId = 9206;
    const amountF = 550000;

    db.run(`
      DELETE FROM payment_transactions WHERE payment_id = ${paymentFId} OR order_id = ${orderFId};
      DELETE FROM payments WHERE id = ${paymentFId};
      DELETE FROM order_items WHERE order_id = ${orderFId};
      DELETE FROM orders WHERE id = ${orderFId};
      DELETE FROM inventory WHERE id = ${invFId} OR product_variant_id = ${variantFId};
      DELETE FROM product_variants WHERE id = ${variantFId};
      DELETE FROM products WHERE id = ${productFId};

      INSERT INTO products (id, name, slug, sku, base_price, stock_quantity, initial_stock, in_stock, is_active, created_at, updated_at)
      VALUES (${productFId}, 'Product Test F', 'product-test-f', 'SKU-PROD-F-9206', ${amountF}, 10, 10, 1, 1, '${now}', '${now}');

      INSERT INTO product_variants (id, product_id, name, sku, price, stock, stock_quantity, is_active, created_at, updated_at)
      VALUES (${variantFId}, ${productFId}, 'Variant Test F', 'SKU-TEST-F-9206', ${amountF}, 10, 10, 1, '${now}', '${now}');

      INSERT INTO inventory (id, product_variant_id, quantity, reserved_quantity, safety_threshold, created_at, updated_at)
      VALUES (${invFId}, ${variantFId}, 10, 0, 0, '${now}', '${now}');

      INSERT INTO orders (id, order_number, user_id, status, payment_status, subtotal, grand_total, currency, shipping_address_snapshot, is_inventory_restored, created_at, updated_at)
      VALUES (${orderFId}, 'ORD-TESTF-9206', 951, 'processing', 'processing', ${amountF}, ${amountF}, 'IRR', '{}', 0, '${now}', '${now}');

      INSERT INTO order_items (id, order_id, product_id, product_variant_id, product_name_snapshot, quantity, unit_price, total_price, created_at, updated_at)
      VALUES (9206, ${orderFId}, ${productFId}, ${variantFId}, 'Product Test F', 2, ${amountF}, ${amountF}, '${now}', '${now}');

      INSERT INTO payments (id, order_id, user_id, gateway, amount, currency, status, reference_id, gateway_payment_id, created_at, updated_at)
      VALUES (${paymentFId}, ${orderFId}, 951, 'zibal', ${amountF}, 'IRR', 'refund_unknown', 'REF-F-ORIG', 'REF-F-ORIG', '${now}', '${now}');
    `);
    persistDatabase();

    // Enable DB failure simulation
    setSimulatedReconcileDbFailure(true);

    const resF = await reconcileUnknownRefund({
      orderId: orderFId,
      paymentId: paymentFId,
      decision: "confirmed_success",
      adminUserId: 952,
      externalReference: "REF-TEST-F-SIM-FAIL",
    });

    // Reset DB failure simulation immediately
    setSimulatedReconcileDbFailure(false);

    if (resF.success) {
      throw new Error(`Test F FAILED: Expected failure under simulated DB error, but got success!`);
    }

    // Verify transaction rollback:
    // 1. Payment status remains 'refund_unknown'
    const paymentFRows = queryRows(db, `SELECT status FROM payments WHERE id = ?`, [paymentFId]);
    if (paymentFRows[0]?.status !== "refund_unknown") {
      throw new Error(`Test F FAILED: Payment status not rolled back! Status: ${paymentFRows[0]?.status}`);
    }

    // 2. Order status remains untouched, inventory not restored
    const orderFRows = queryRows(db, `SELECT status, payment_status, is_inventory_restored FROM orders WHERE id = ?`, [orderFId]);
    if (orderFRows[0]?.status === "refunded" || Number(orderFRows[0]?.is_inventory_restored) !== 0) {
      throw new Error(`Test F FAILED: Order status or inventory_restored changed after rollback!`);
    }

    // 3. Stock remains 10
    const invFRows = queryRows(db, `SELECT quantity FROM inventory WHERE id = ?`, [invFId]);
    if (Number(invFRows[0]?.quantity) !== 10) {
      throw new Error(`Test F FAILED: Inventory quantity changed despite transaction rollback: ${invFRows[0]?.quantity}`);
    }

    // 4. Zero refund transactions recorded
    const txF = queryRows(db, `SELECT * FROM payment_transactions WHERE payment_id = ?`, [paymentFId]);
    if (txF.length !== 0) {
      throw new Error(`Test F FAILED: Orphan transaction record found after transaction rollback!`);
    }

    console.log("PASS: [TEST F] Database failure rolled back cleanly with zero partial state and zero inventory restoration.");

    // Clean up
    setZibalHttpClient(null);
    server.close();

    console.log("\n=========================================================================");
    console.log("=== ALL PHASE 1.1-R2 CONCURRENCY & RECONCILIATION TESTS PASSED (1-6 & A-F) ===");
    console.log("=========================================================================\n");
  } catch (err: any) {
    setZibalHttpClient(null);
    server.close();
    console.error("\nTEST SUITE FAILED:", err);
    process.exit(1);
  }
}

runPhase1_1_R2_Tests();
