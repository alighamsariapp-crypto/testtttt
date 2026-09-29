import express from "express";
import { Server } from "http";
import { getDatabase, persistDatabase, queryRows } from "../../src/server/db";
import { handleCheckout, handleCancelOrder } from "../../src/server/orderRoutes";
import { handleAdminUpdateOrderStatus, decrementProductStock, restoreProductStock, restoreOrderInventory, isValidOrderTransition, getAdminProducts } from "../../src/server/adminRoutes";
import { setZibalHttpClient } from "../../src/server/services/zibalService";

async function runPhase1IntegrityTests() {
  console.log("=== Starting Phase 1: Payment, Order & Inventory Integrity Tests ===");

  const db = await getDatabase();
  const now = new Date();
  const nowIso = now.toISOString();
  const expiresIso = new Date(now.getTime() + 7 * 86400000).toISOString();

  // Find a valid active product variant from catalog
  const catalogProducts = getAdminProducts();
  const validProduct = catalogProducts.find((p: any) => p.is_active && p.variants?.some((v: any) => v.is_active));
  if (!validProduct) throw new Error("No active product found in catalog");
  const validVariant = validProduct.variants.find((v: any) => v.is_active);
  const testVariantId = validVariant.id;

  // Ensure test users exist
  db.run(`
    INSERT OR REPLACE INTO users (id, name, email, phone, password, role, status, created_at, updated_at)
    VALUES
      (901, 'کاربر تستی یکپارچگی', 'integrity_user@apexstore.local', '09129010001', 'dummy_hash', 'customer', 'active', '${nowIso}', '${nowIso}'),
      (902, 'مدیر تستی یکپارچگی', 'integrity_admin@apexstore.local', '09129010002', 'dummy_hash', 'admin', 'active', '${nowIso}', '${nowIso}');

    INSERT OR REPLACE INTO personal_access_tokens (id, tokenable_type, tokenable_id, name, token, abilities, expires_at, created_at, updated_at)
    VALUES
      (9010, 'App\\\\Modules\\\\Users\\\\Models\\\\User', 901, 'test-integrity-token', 'token_integrity_user_901', '["*"]', '${expiresIso}', '${nowIso}', '${nowIso}'),
      (9020, 'App\\\\Modules\\\\Users\\\\Models\\\\User', 902, 'test-admin-token', 'token_integrity_admin_902', '["*"]', '${expiresIso}', '${nowIso}', '${nowIso}');
  `);

  // Ensure test variant has stock = 10 for deterministic testing
  db.run(`
    UPDATE inventory SET quantity = 10 WHERE product_variant_id = ${testVariantId};
    UPDATE product_variants SET stock_quantity = 10, stock = 10 WHERE id = ${testVariantId};
  `);
  persistDatabase();

  // Set up mock Zibal HTTP handler
  setZibalHttpClient(async (endpoint: string, payload: Record<string, any>) => {
    if (endpoint === "/v1/request") {
      return { result: 100, trackId: 901001, message: "success" };
    }
    if (endpoint === "/v1/verify") {
      return { result: 100, amount: payload.amount, refNumber: 998877, cardNumber: "6219********1234", status: 2, paidAt: new Date().toISOString() };
    }
    throw new Error(`Unhandled mock endpoint: ${endpoint}`);
  });

  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.post("/api/v1/checkout", handleCheckout);
  app.post("/api/v1/orders/:id/cancel", handleCancelOrder);
  app.put("/api/v1/admin/orders/:id/status", handleAdminUpdateOrderStatus);

  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const userHeaders = {
    "Authorization": "Bearer token_integrity_user_901",
    "Content-Type": "application/json",
  };
  const adminHeaders = {
    "Authorization": "Bearer token_integrity_admin_902",
    "Content-Type": "application/json",
  };

  try {
    // ----------------------------------------------------
    // TEST 1: State Machine Transition Rules
    // ----------------------------------------------------
    console.log("\n[TEST 1] Testing Order State Machine Transitions...");
    if (!isValidOrderTransition("pending", "awaiting_payment")) throw new Error("pending -> awaiting_payment should be valid");
    if (!isValidOrderTransition("awaiting_payment", "paid")) throw new Error("awaiting_payment -> paid should be valid");
    if (!isValidOrderTransition("paid", "processing")) throw new Error("paid -> processing should be valid");
    if (!isValidOrderTransition("processing", "shipped")) throw new Error("processing -> shipped should be valid");
    if (!isValidOrderTransition("shipped", "delivered")) throw new Error("shipped -> delivered should be valid");
    if (isValidOrderTransition("delivered", "pending")) throw new Error("delivered -> pending should be INVALID");
    if (isValidOrderTransition("cancelled", "paid")) throw new Error("cancelled -> paid should be INVALID");
    if (isValidOrderTransition("refunded", "processing")) throw new Error("refunded -> processing should be INVALID");
    console.log("✓ Order State Machine transition rules successfully verified.");

    // ----------------------------------------------------
    // TEST 2: Checkout Idempotency
    // ----------------------------------------------------
    console.log("\n[TEST 2] Testing Checkout Idempotency...");
    const cartId = 901;
    db.run(`
      INSERT OR IGNORE INTO carts (id, user_id, session_id, created_at, updated_at)
      VALUES (${cartId}, 901, 'session_901', '${now}', '${now}');

      DELETE FROM cart_items WHERE cart_id = ${cartId};
      INSERT INTO cart_items (cart_id, product_variant_id, quantity, created_at, updated_at)
      VALUES (${cartId}, ${testVariantId}, 1, '${now}', '${now}');
    `);

    const idempotencyKey = `IDEMP-${Date.now()}-ABC`;
    const checkoutBody = {
      shipping_address: {
        recipient_name: "تست یکپارچگی",
        phone: "09129010001",
        province: "تهران",
        city: "تهران",
        postal_code: "1122334455",
        address_line: "خیابان ولیعصر",
      },
      payment_gateway: "zibal",
      shipping_method: "post",
      idempotency_key: idempotencyKey,
    };

    // First checkout call
    const res1 = await fetch(`${baseUrl}/api/v1/checkout`, {
      method: "POST",
      headers: userHeaders,
      body: JSON.stringify(checkoutBody),
    });
    const json1 = await res1.json();
    if (!json1.success) throw new Error(`First checkout failed: ${json1.message}`);
    const orderId1 = json1.data?.order_id || json1.data?.id;

    // Check inventory: quantity should now be 9
    let stockRows = queryRows(db, `SELECT quantity FROM inventory WHERE product_variant_id = ?`, [testVariantId]);
    if (Number(stockRows[0].quantity) !== 9) throw new Error(`Expected stock 9 after first checkout, got ${stockRows[0].quantity}`);

    // Second checkout call with EXACT same idempotency_key
    const res2 = await fetch(`${baseUrl}/api/v1/checkout`, {
      method: "POST",
      headers: userHeaders,
      body: JSON.stringify(checkoutBody),
    });
    const json2 = await res2.json();
    if (!json2.success) throw new Error(`Second idempotent checkout failed: ${json2.message}`);
    if (json2.is_idempotent !== true) throw new Error("Expected is_idempotent: true in idempotent response");
    const orderId2 = json2.data?.order_id || json2.data?.id;
    if (orderId1 !== orderId2) throw new Error(`Order IDs do not match: ${orderId1} vs ${orderId2}`);

    // Check inventory again: quantity must STILL be 9 (not decremented twice!)
    stockRows = queryRows(db, `SELECT quantity FROM inventory WHERE product_variant_id = ?`, [testVariantId]);
    if (Number(stockRows[0].quantity) !== 9) throw new Error(`Stock decremented twice on duplicate checkout! Current stock: ${stockRows[0].quantity}`);
    console.log("✓ Checkout Idempotency verified: duplicate requests return existing order without double-decrementing stock.");

    // ----------------------------------------------------
    // TEST 3: Atomic Stock Decrement & Overselling Protection
    // ----------------------------------------------------
    console.log("\n[TEST 3] Testing Atomic Stock Decrement & Overselling Protection...");
    // Stock is currently 9
    const dec1 = decrementProductStock(testVariantId, 9);
    if (!dec1) throw new Error("decrementProductStock(9) should have succeeded when stock is 9");
    // Stock is now 0
    const dec2 = decrementProductStock(testVariantId, 1);
    if (dec2) throw new Error("decrementProductStock(1) should have FAILED when stock is 0 (prevent overselling)");

    stockRows = queryRows(db, `SELECT quantity FROM inventory WHERE product_variant_id = ?`, [testVariantId]);
    if (Number(stockRows[0].quantity) < 0) throw new Error(`Stock went negative! Value: ${stockRows[0].quantity}`);
    console.log("✓ Overselling guard verified: stock decrements atomically and rejects when insufficient.");

    // Restore stock back to 1
    restoreProductStock(testVariantId, 1);

    // ----------------------------------------------------
    // TEST 4: Single Restoration on Order Cancellation
    // ----------------------------------------------------
    console.log("\n[TEST 4] Testing Inventory Restoration & Idempotency on Cancellation...");
    // Current stock is 1. Cancel orderId1 (which had quantity 1).
    const cancelRes1 = await fetch(`${baseUrl}/api/v1/orders/${orderId1}/cancel`, {
      method: "POST",
      headers: userHeaders,
    });
    const cancelJson1 = await cancelRes1.json();
    if (!cancelJson1.success) throw new Error(`Cancel order failed: ${cancelJson1.message}`);

    // Stock should now be restored from 1 to 2
    stockRows = queryRows(db, `SELECT quantity FROM inventory WHERE product_variant_id = ?`, [testVariantId]);
    if (Number(stockRows[0].quantity) !== 2) throw new Error(`Expected stock 2 after cancellation, got ${stockRows[0].quantity}`);

    // Attempt second cancellation on the already-cancelled order
    const cancelRes2 = await fetch(`${baseUrl}/api/v1/orders/${orderId1}/cancel`, {
      method: "POST",
      headers: userHeaders,
    });
    const cancelJson2 = await cancelRes2.json();
    if (cancelJson2.success) throw new Error("Second cancellation on already-cancelled order should have failed!");
    if (cancelJson2.error_code !== "ORDER_ALREADY_CANCELLED") throw new Error(`Expected ORDER_ALREADY_CANCELLED, got: ${cancelJson2.error_code}`);

    // Stock MUST still be 2 (NEVER restored twice!)
    stockRows = queryRows(db, `SELECT quantity FROM inventory WHERE product_variant_id = ?`, [testVariantId]);
    if (Number(stockRows[0].quantity) !== 2) throw new Error(`Stock restored multiple times on double cancel! Current: ${stockRows[0].quantity}`);
    console.log("✓ Inventory restored exactly once; duplicate cancellation rejected.");

    // ----------------------------------------------------
    // TEST 5: Admin Order Status Transition & Audit Logging
    // ----------------------------------------------------
    console.log("\n[TEST 5] Testing Admin Status Transition Enforcement & Audit Logging...");
    // Attempt invalid transition: cancelled order -> paid
    const adminRes1 = await fetch(`${baseUrl}/api/v1/admin/orders/${orderId1}/status`, {
      method: "PUT",
      headers: adminHeaders,
      body: JSON.stringify({ status: "paid" }),
    });
    const adminJson1 = await adminRes1.json();
    if (adminRes1.status !== 422 || adminJson1.success) {
      throw new Error(`Expected 422 for invalid transition from cancelled to paid, got: ${adminRes1.status}`);
    }
    console.log("✓ Admin invalid state transition properly rejected with 422.");

    // Verify audit logs were written
    const auditLogs = queryRows(db, `SELECT action, entity_type, entity_id FROM audit_logs WHERE entity_id = ?`, [orderId1]);
    if (auditLogs.length === 0) throw new Error("No audit logs recorded for order lifecycle events");
    console.log(`✓ Audit logs verified: found ${auditLogs.length} audit entries for order ${orderId1}.`);

    console.log("\n========================================================");
    console.log("🎉 ALL PHASE 1 INTEGRITY TESTS PASSED SUCCESSFULLY!");
    console.log("========================================================");
  } finally {
    server.close();
  }
}

runPhase1IntegrityTests().catch((err) => {
  console.error("❌ PHASE 1 INTEGRITY TEST FAILED:", err);
  process.exit(1);
});
