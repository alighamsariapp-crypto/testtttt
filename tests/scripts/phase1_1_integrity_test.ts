import express from "express";
import { Server } from "http";
import { getDatabase, persistDatabase, queryRows } from "../../src/server/db";
import { handleCheckout, handleCancelOrder } from "../../src/server/orderRoutes";
import {
  handleAdminUpdateOrderStatus,
  restoreOrderInventory,
  restoreProductStock,
  getAdminProducts,
} from "../../src/server/adminRoutes";
import { handleZibalCallback } from "../../src/server/paymentRoutes";
import { setZibalHttpClient } from "../../src/server/services/zibalService";

async function runPhase1_1IntegrityTests() {
  console.log("===============================================================");
  console.log("=== Starting Phase 1.1: Comprehensive Integrity Tests       ===");
  console.log("===============================================================");

  const db = await getDatabase();
  const now = new Date().toISOString();

  // 1. Locate valid active variant
  const catalog = getAdminProducts();
  const validProduct = catalog.find((p: any) => p.is_active && p.variants?.some((v: any) => v.is_active));
  if (!validProduct) throw new Error("No active product found for test");
  const validVariant = validProduct.variants.find((v: any) => v.is_active);
  const testVariantId = validVariant.id;

  // 2. Setup deterministic test users
  db.run(`
    INSERT OR IGNORE INTO users (id, name, email, phone, password, role, status, created_at, updated_at)
    VALUES
      (911, 'کاربر تستی فاز 1.1', 'phase1_1_user@apexstore.local', '09129110001', 'hash', 'customer', 'active', '${now}', '${now}'),
      (912, 'مدیر تستی فاز 1.1', 'phase1_1_admin@apexstore.local', '09129110002', 'hash', 'admin', 'active', '${now}', '${now}');

    INSERT OR IGNORE INTO personal_access_tokens (id, tokenable_type, tokenable_id, name, token, abilities, created_at, updated_at)
    VALUES
      (911, 'App\\\\Modules\\\\Users\\\\Models\\\\User', 911, 'test-token-911', 'token_911', '["*"]', '${now}', '${now}'),
      (912, 'App\\\\Modules\\\\Users\\\\Models\\\\User', 912, 'test-token-912', 'token_912', '["*"]', '${now}', '${now}');
  `);

  // Reset variant stock to 10
  db.run(`
    UPDATE inventory SET quantity = 10 WHERE product_variant_id = ${testVariantId};
    UPDATE product_variants SET stock_quantity = 10, stock = 10 WHERE id = ${testVariantId};
  `);
  persistDatabase();

  // Setup express test server
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.post("/api/v1/checkout", handleCheckout);
  app.post("/api/v1/orders/:id/cancel", handleCancelOrder);
  app.patch("/api/v1/admin/orders/:id/status", handleAdminUpdateOrderStatus);
  app.get("/api/v1/payments/zibal/callback", handleZibalCallback);
  app.get("/payment-status", (req, res) => {
    res.json({ route: "payment-status", query: req.query });
  });

  const server: Server = await new Promise((resolve) => {
    const s = app.listen(3099, () => resolve(s));
  });

  const baseUrl = "http://127.0.0.1:3099";

  try {
    // -------------------------------------------------------------
    // SECTION 1: INVENTORY RESTORATION ATOMICITY & IDEMPOTENCY
    // -------------------------------------------------------------
    console.log("\n--- [TEST 1] Inventory Restoration Exactly Once & Idempotency ---");

    // Create a mock order with 2 items of testVariantId
    const order1Id = 8801;
    const order1Num = "ORD-TEST-8801";
    db.run(`
      INSERT OR REPLACE INTO orders (id, order_number, user_id, status, payment_status, subtotal, grand_total, currency, shipping_address_snapshot, is_inventory_restored, created_at, updated_at)
      VALUES (${order1Id}, '${order1Num}', 911, 'pending', 'pending', 200000, 200000, 'IRR', '{}', 0, '${now}', '${now}');

      DELETE FROM order_items WHERE order_id = ${order1Id};
      INSERT INTO order_items (order_id, product_variant_id, product_name_snapshot, quantity, unit_price, total_price)
      VALUES (${order1Id}, ${testVariantId}, 'تست اینونتوری', 2, 100000, 200000);
    `);

    // Initially variant stock is 10
    const initialQty = Number(queryRows(db, "SELECT quantity FROM inventory WHERE product_variant_id = ?", [testVariantId])[0].quantity);
    console.log(`Initial stock quantity before restore: ${initialQty}`);

    // First restoration: should restore 2 items -> stock becomes 12
    const restore1 = restoreOrderInventory(db, order1Id, "test_restore_1");
    if (!restore1) throw new Error("First restoreOrderInventory call failed unexpectedly");

    const stockAfterRestore1 = Number(queryRows(db, "SELECT quantity FROM inventory WHERE product_variant_id = ?", [testVariantId])[0].quantity);
    if (stockAfterRestore1 !== initialQty + 2) {
      throw new Error(`Stock mismatch: expected ${initialQty + 2}, got ${stockAfterRestore1}`);
    }
    console.log(`✓ First restore succeeded: stock updated from ${initialQty} to ${stockAfterRestore1}`);

    // Second restoration on same order: must be strictly rejected (idempotent, return false)
    const restore2 = restoreOrderInventory(db, order1Id, "test_restore_2");
    if (restore2) throw new Error("Duplicate restoreOrderInventory call incorrectly succeeded!");

    const stockAfterRestore2 = Number(queryRows(db, "SELECT quantity FROM inventory WHERE product_variant_id = ?", [testVariantId])[0].quantity);
    if (stockAfterRestore2 !== stockAfterRestore1) {
      throw new Error(`Inventory double-restored! Stock should remain ${stockAfterRestore1}, but got ${stockAfterRestore2}`);
    }
    console.log("✓ Duplicate restoration correctly rejected; stock remained completely unchanged");

    // -------------------------------------------------------------
    // SECTION 2: PAYMENT CALLBACK IDEMPOTENCY & RACE-SAFETY
    // -------------------------------------------------------------
    console.log("\n--- [TEST 2] Duplicate Payment Callback Idempotency ---");

    const order2Id = 8802;
    const order2Num = "ORD-TEST-8802";
    const payment2Id = 8802;
    const trackId2 = 992002;

    db.run(`
      INSERT OR REPLACE INTO orders (id, order_number, user_id, status, payment_status, subtotal, grand_total, currency, shipping_address_snapshot, is_inventory_restored, created_at, updated_at)
      VALUES (${order2Id}, '${order2Num}', 911, 'pending', 'pending', 300000, 300000, 'IRR', '{}', 0, '${now}', '${now}');

      INSERT OR REPLACE INTO payments (id, order_id, user_id, gateway, amount, currency, status, reference_id, gateway_payment_id, created_at, updated_at)
      VALUES (${payment2Id}, ${order2Id}, 911, 'zibal', 300000, 'IRR', 'pending', '${trackId2}', '${trackId2}', '${now}', '${now}');
    `);
    persistDatabase();

    // Configure mock gateway to return exact matching amount
    setZibalHttpClient(async (endpoint: string, payload: Record<string, any>) => {
      if (endpoint === "/v1/verify") {
        return {
          result: 100,
          amount: 300000, // Exact match
          refNumber: 771122,
          cardNumber: "6037********5678",
          status: 2,
        };
      }
      return { result: 100 };
    });

    // Callback 1: Success
    const cb1Res = await fetch(`${baseUrl}/api/v1/payments/zibal/callback?success=1&trackId=${trackId2}&status=2`);
    const cb1Url = cb1Res.url;
    if (!cb1Url.includes("status=success")) {
      throw new Error(`Callback 1 did not redirect to success: ${cb1Url}`);
    }

    const order2AfterCb1 = queryRows(db, "SELECT status, payment_status FROM orders WHERE id = ?", [order2Id])[0];
    const payment2AfterCb1 = queryRows(db, "SELECT status, reference_id FROM payments WHERE id = ?", [payment2Id])[0];
    if (order2AfterCb1.payment_status !== "paid" || payment2AfterCb1.status !== "paid") {
      throw new Error(`Order or payment not marked as paid after callback 1`);
    }

    const txCountCb1 = queryRows(db, "SELECT COUNT(*) as cnt FROM payment_transactions WHERE payment_id = ?", [payment2Id])[0].cnt;
    console.log(`✓ Callback 1 successfully marked payment as PAID. Transactions count: ${txCountCb1}`);

    // Callback 2: Duplicate Callback with same trackId
    const cb2Res = await fetch(`${baseUrl}/api/v1/payments/zibal/callback?success=1&trackId=${trackId2}&status=2`);
    const cb2Url = cb2Res.url;
    if (!cb2Url.includes("status=success")) {
      throw new Error(`Duplicate callback did not redirect to success: ${cb2Url}`);
    }

    const txCountCb2 = queryRows(db, "SELECT COUNT(*) as cnt FROM payment_transactions WHERE payment_id = ?", [payment2Id])[0].cnt;
    if (Number(txCountCb2) !== Number(txCountCb1)) {
      throw new Error(`Duplicate callback created duplicate transaction records! count: ${txCountCb2}`);
    }
    console.log("✓ Duplicate callback handled idempotently with zero duplicate transaction inserts");

    // -------------------------------------------------------------
    // SECTION 3: STRICT PAYMENT AMOUNT VALIDATION
    // -------------------------------------------------------------
    console.log("\n--- [TEST 3] Strict Payment Amount Validation ---");

    // Test 3A: Gateway returns LOWER amount than order grand total -> MUST REJECT
    const order3AId = 8803;
    const order3ANum = "ORD-TEST-8803";
    const payment3AId = 8803;
    const trackId3A = 993003;

    db.run(`
      INSERT OR REPLACE INTO orders (id, order_number, user_id, status, payment_status, subtotal, grand_total, currency, shipping_address_snapshot, is_inventory_restored, created_at, updated_at)
      VALUES (${order3AId}, '${order3ANum}', 911, 'pending', 'pending', 500000, 500000, 'IRR', '{}', 0, '${now}', '${now}');

      INSERT OR REPLACE INTO payments (id, order_id, user_id, gateway, amount, currency, status, reference_id, gateway_payment_id, created_at, updated_at)
      VALUES (${payment3AId}, ${order3AId}, 911, 'zibal', 500000, 'IRR', 'pending', '${trackId3A}', '${trackId3A}', '${now}', '${now}');
    `);
    persistDatabase();

    setZibalHttpClient(async (endpoint: string, payload: Record<string, any>) => {
      if (endpoint === "/v1/verify") {
        return {
          result: 100,
          amount: 450000, // Gateway returned 450,000 instead of 500,000 (UNDERPAYMENT)
          refNumber: 772233,
        };
      }
      return { result: 100 };
    });

    const res3A = await fetch(`${baseUrl}/api/v1/payments/zibal/callback?success=1&trackId=${trackId3A}&status=2`);
    if (!res3A.url.includes("status=failed") || !res3A.url.includes("AMOUNT_MISMATCH")) {
      throw new Error(`Underpayment was NOT rejected! URL: ${res3A.url}`);
    }

    const order3A = queryRows(db, "SELECT status, payment_status FROM orders WHERE id = ?", [order3AId])[0];
    const payment3A = queryRows(db, "SELECT status FROM payments WHERE id = ?", [payment3AId])[0];
    if (order3A.payment_status === "paid" || payment3A.status === "paid") {
      throw new Error("Underpaid order was incorrectly marked as PAID!");
    }
    console.log("✓ Underpaid transaction strictly rejected with AMOUNT_MISMATCH");

    // Test 3B: Gateway returns HIGHER amount than order grand total -> MUST REJECT
    const order3BId = 8804;
    const order3BNum = "ORD-TEST-8804";
    const payment3BId = 8804;
    const trackId3B = 993004;

    db.run(`
      INSERT OR REPLACE INTO orders (id, order_number, user_id, status, payment_status, subtotal, grand_total, currency, shipping_address_snapshot, is_inventory_restored, created_at, updated_at)
      VALUES (${order3BId}, '${order3BNum}', 911, 'pending', 'pending', 500000, 500000, 'IRR', '{}', 0, '${now}', '${now}');

      INSERT OR REPLACE INTO payments (id, order_id, user_id, gateway, amount, currency, status, reference_id, gateway_payment_id, created_at, updated_at)
      VALUES (${payment3BId}, ${order3BId}, 911, 'zibal', 500000, 'IRR', 'pending', '${trackId3B}', '${trackId3B}', '${now}', '${now}');
    `);
    persistDatabase();

    setZibalHttpClient(async (endpoint: string, payload: Record<string, any>) => {
      if (endpoint === "/v1/verify") {
        return {
          result: 100,
          amount: 600000, // Gateway returned 600,000 instead of 500,000 (OVERPAYMENT)
          refNumber: 772244,
        };
      }
      return { result: 100 };
    });

    const res3B = await fetch(`${baseUrl}/api/v1/payments/zibal/callback?success=1&trackId=${trackId3B}&status=2`);
    if (!res3B.url.includes("status=failed") || !res3B.url.includes("AMOUNT_MISMATCH")) {
      throw new Error(`Overpayment was NOT rejected! URL: ${res3B.url}`);
    }

    const order3B = queryRows(db, "SELECT status, payment_status FROM orders WHERE id = ?", [order3BId])[0];
    if (order3B.payment_status === "paid") {
      throw new Error("Overpaid order was incorrectly marked as PAID!");
    }
    console.log("✓ Overpaid transaction strictly rejected with AMOUNT_MISMATCH");

    // Test 3C: Gateway returns null / undefined / empty amount -> MUST REJECT (NO FALLBACK)
    const order3CId = 8805;
    const order3CNum = "ORD-TEST-8805";
    const payment3CId = 8805;
    const trackId3C = 993005;

    db.run(`
      INSERT OR REPLACE INTO orders (id, order_number, user_id, status, payment_status, subtotal, grand_total, currency, shipping_address_snapshot, is_inventory_restored, created_at, updated_at)
      VALUES (${order3CId}, '${order3CNum}', 911, 'pending', 'pending', 400000, 400000, 'IRR', '{}', 0, '${now}', '${now}');

      INSERT OR REPLACE INTO payments (id, order_id, user_id, gateway, amount, currency, status, reference_id, gateway_payment_id, created_at, updated_at)
      VALUES (${payment3CId}, ${order3CId}, 911, 'zibal', 400000, 'IRR', 'pending', '${trackId3C}', '${trackId3C}', '${now}', '${now}');
    `);
    persistDatabase();

    setZibalHttpClient(async (endpoint: string, payload: Record<string, any>) => {
      if (endpoint === "/v1/verify") {
        return {
          result: 100,
          amount: undefined, // Missing amount from gateway
          refNumber: 772255,
        };
      }
      return { result: 100 };
    });

    const res3C = await fetch(`${baseUrl}/api/v1/payments/zibal/callback?success=1&trackId=${trackId3C}&status=2`);
    if (!res3C.url.includes("status=failed") || !res3C.url.includes("INVALID_PAYMENT_AMOUNT")) {
      throw new Error(`Missing gateway amount was not rejected! URL: ${res3C.url}`);
    }

    const order3C = queryRows(db, "SELECT status, payment_status FROM orders WHERE id = ?", [order3CId])[0];
    if (order3C.payment_status === "paid") {
      throw new Error("Missing amount transaction was incorrectly accepted via fallback!");
    }
    console.log("✓ Missing gateway amount strictly rejected with INVALID_PAYMENT_AMOUNT (zero fallback)");

    // -------------------------------------------------------------
    // SECTION 4: REFUND INTEGRITY & IDEMPOTENCY
    // -------------------------------------------------------------
    console.log("\n--- [TEST 4] Refund Integrity & Idempotency ---");

    // Test 4A: Wallet-paid order refund
    const order4AId = 8806;
    const order4ANum = "ORD-TEST-8806";
    const payment4AId = 8806;
    const paidAmount4A = 250000;

    db.run(`
      DELETE FROM wallet_transactions WHERE order_id = ${order4AId};
      DELETE FROM payment_transactions WHERE payment_id = ${payment4AId} OR order_id = ${order4AId};

      INSERT OR REPLACE INTO orders (id, order_number, user_id, status, payment_status, subtotal, grand_total, currency, shipping_address_snapshot, is_inventory_restored, created_at, updated_at)
      VALUES (${order4AId}, '${order4ANum}', 911, 'paid', 'paid', ${paidAmount4A}, ${paidAmount4A}, 'IRR', '{}', 0, '${now}', '${now}');

      INSERT OR REPLACE INTO payments (id, order_id, user_id, gateway, amount, currency, status, reference_id, created_at, updated_at)
      VALUES (${payment4AId}, ${order4AId}, 911, 'wallet', ${paidAmount4A}, 'IRR', 'paid', 'WAL-TX-8806', '${now}', '${now}');
    `);
    persistDatabase();

    // Admin updates order status to 'refunded'
    const adminRes1 = await fetch(`${baseUrl}/api/v1/admin/orders/${order4AId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer token_912",
      },
      body: JSON.stringify({ status: "refunded" }),
    });

    const adminJson1 = await adminRes1.json();
    if (!adminJson1.success) {
      throw new Error(`Admin refund status update failed: ${JSON.stringify(adminJson1)}`);
    }

    const walletTx1 = queryRows(db, "SELECT amount, type, status FROM wallet_transactions WHERE order_id = ?", [order4AId]);
    if (walletTx1.length !== 1 || Number(walletTx1[0].amount) !== paidAmount4A) {
      throw new Error(`Wallet refund record mismatch: ${JSON.stringify(walletTx1)}`);
    }
    console.log(`✓ Wallet-paid order refunded exactly ${paidAmount4A} IRR to customer wallet`);

    // Duplicate refund attempt on the same refunded order: MUST NOT credit wallet again
    const adminRes2 = await fetch(`${baseUrl}/api/v1/admin/orders/${order4AId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer token_912",
      },
      body: JSON.stringify({ status: "refunded" }),
    });

    const walletTx2 = queryRows(db, "SELECT amount, type, status FROM wallet_transactions WHERE order_id = ?", [order4AId]);
    if (walletTx2.length !== 1) {
      throw new Error(`Duplicate refund created duplicate wallet credit records! count: ${walletTx2.length}`);
    }
    console.log("✓ Duplicate refund attempt safely prevented double wallet credit");

    // Test 4B: External gateway (Zibal) payment refund: authoritative gateway refund
    const order4BId = 8807;
    const order4BNum = "ORD-TEST-8807";
    const payment4BId = 8807;
    const trackId4B = 994007;
    const paidAmount4B = 350000;

    db.run(`
      DELETE FROM payment_transactions WHERE payment_id = ${payment4BId} OR order_id = ${order4BId};
      DELETE FROM wallet_transactions WHERE order_id = ${order4BId};

      INSERT OR REPLACE INTO orders (id, order_number, user_id, status, payment_status, subtotal, grand_total, currency, shipping_address_snapshot, is_inventory_restored, created_at, updated_at)
      VALUES (${order4BId}, '${order4BNum}', 911, 'paid', 'paid', ${paidAmount4B}, ${paidAmount4B}, 'IRR', '{}', 0, '${now}', '${now}');

      INSERT OR REPLACE INTO payments (id, order_id, user_id, gateway, amount, currency, status, reference_id, gateway_payment_id, created_at, updated_at)
      VALUES (${payment4BId}, ${order4BId}, 911, 'zibal', ${paidAmount4B}, 'IRR', 'paid', '${trackId4B}', '${trackId4B}', '${now}', '${now}');
    `);
    persistDatabase();

    let refundZibalCalled = false;
    setZibalHttpClient(async (endpoint: string, payload: Record<string, any>) => {
      if (endpoint === "/v1/refund") {
        refundZibalCalled = true;
        return { result: 100, message: "Refund successful" };
      }
      return { result: 100 };
    });

    const adminRes3 = await fetch(`${baseUrl}/api/v1/admin/orders/${order4BId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer token_912",
      },
      body: JSON.stringify({ status: "refunded" }),
    });

    const adminJson3 = await adminRes3.json();
    if (!adminJson3.success) {
      throw new Error(`Admin refund for Zibal order failed: ${JSON.stringify(adminJson3)}`);
    }

    if (!refundZibalCalled) {
      throw new Error("Zibal gateway refund was not invoked during refund transition!");
    }

    // Verify that NO fake wallet credits were added to customer's wallet for this non-wallet order
    const fakeWalletTx = queryRows(db, "SELECT * FROM wallet_transactions WHERE order_id = ?", [order4BId]);
    if (fakeWalletTx.length > 0) {
      throw new Error(`Illegal fake wallet transaction created for gateway-paid order: ${JSON.stringify(fakeWalletTx)}`);
    }

    const gatewayRefundTx = queryRows(db, "SELECT * FROM payment_transactions WHERE order_id = ? AND event_type = 'refund'", [order4BId]);
    if (gatewayRefundTx.length !== 1) {
      throw new Error(`Missing or duplicate refund transaction in payment_transactions: ${JSON.stringify(gatewayRefundTx)}`);
    }
    console.log("✓ External gateway refund executed authoritatively without creating fake wallet credits");

    console.log("\n===============================================================");
    console.log("=== ALL PHASE 1.1 INTEGRITY TESTS PASSED WITH 100% SUCCESS! ===");
    console.log("===============================================================\n");
  } finally {
    server.close();
  }
}

runPhase1_1IntegrityTests().catch((err) => {
  console.error("\n❌ PHASE 1.1 TEST FAILED:", err);
  process.exit(1);
});
