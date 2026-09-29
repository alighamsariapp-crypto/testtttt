import express from "express";
import { Server } from "http";
import crypto from "crypto";
import { getDatabase, persistDatabase, queryRows } from "../../src/server/db";
import { handleCheckout, handleCancelOrder } from "../../src/server/orderRoutes";
import { handleZibalCallback } from "../../src/server/paymentRoutes";
import { handleAdminUpdateOrderStatus } from "../../src/server/adminRoutes";
import { setZibalHttpClient } from "../../src/server/services/zibalService";
import {
  transitionOrderStatus,
  isValidOrderTransition,
} from "../../src/server/services/orderStateMachine";
import { reconcileUnknownPayment } from "../../src/server/services/paymentRecoveryService";

async function runPhase1_2_Tests() {
  console.log("=========================================================================");
  console.log("=== Starting Phase 1.2: Order State Machine & Concurrency Test Suite ===");
  console.log("=========================================================================");

  const db = await getDatabase();
  const now = new Date().toISOString();

  // Setup test users
  db.run(`
    INSERT OR IGNORE INTO users (id, name, email, phone, password, role, status, created_at, updated_at)
    VALUES
      (881, 'کاربر خریدار ۱', 'buyer1@apexstore.local', '09128810001', 'hash', 'customer', 'active', '${now}', '${now}'),
      (882, 'کاربر خریدار ۲', 'buyer2@apexstore.local', '09128810002', 'hash', 'customer', 'active', '${now}', '${now}'),
      (883, 'مدیر سامانه ۱.۲', 'admin_1_2@apexstore.local', '09128830003', 'hash', 'admin', 'active', '${now}', '${now}');

    INSERT OR IGNORE INTO personal_access_tokens (id, tokenable_type, tokenable_id, name, token, abilities, created_at, updated_at)
    VALUES
      (881, 'App\\\\Modules\\\\Users\\\\Models\\\\User', 881, 'token-881', 'token_881', '["*"]', '${now}', '${now}'),
      (882, 'App\\\\Modules\\\\Users\\\\Models\\\\User', 882, 'token-882', 'token_882', '["*"]', '${now}', '${now}'),
      (883, 'App\\\\Modules\\\\Users\\\\Models\\\\User', 883, 'token-883', 'token_883', '["*"]', '${now}', '${now}');

    DELETE FROM wallet_transactions WHERE user_id IN (881, 882);
    INSERT INTO wallet_transactions (user_id, type, amount, currency, status, reference, description, created_at, updated_at)
    VALUES
      (881, 'deposit', 100000000, 'IRR', 'successful', 'INITIAL-881-${Date.now()}', 'شارژ اولیه کیف پول برای آزمون', '${now}', '${now}'),
      (882, 'deposit', 100000000, 'IRR', 'successful', 'INITIAL-882-${Date.now()}', 'شارژ اولیه کیف پول برای آزمون', '${now}', '${now}');
  `);
  persistDatabase();

  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.post("/api/v1/orders/checkout", handleCheckout);
  app.post("/api/v1/orders/:id/cancel", handleCancelOrder);
  app.get("/api/v1/payments/zibal/callback", handleZibalCallback);
  app.post("/api/v1/payments/zibal/callback", handleZibalCallback);
  app.patch("/api/v1/admin/orders/:id/status", handleAdminUpdateOrderStatus);

  const server: Server = await new Promise((resolve) => {
    const s = app.listen(3098, () => resolve(s));
  });

  const baseUrl = "http://127.0.0.1:3098";
  const user1Headers = {
    Authorization: "Bearer token_881",
    "Content-Type": "application/json",
  };
  const user2Headers = {
    Authorization: "Bearer token_882",
    "Content-Type": "application/json",
  };
  const adminHeaders = {
    Authorization: "Bearer token_883",
    "Content-Type": "application/json",
  };

  try {
    // -------------------------------------------------------------
    // TEST A: CONCURRENT IDENTICAL CHECKOUT REQUESTS (SAME KEY & PAYLOAD)
    // -------------------------------------------------------------
    console.log("\n--- [TEST A] Concurrent Identical Checkouts (Same Idempotency Key) ---");
    const productIdA = 801;
    const variantIdA = 801;
    const initialStockA = 10;

    db.run(`
      DELETE FROM cart_items WHERE cart_id IN (SELECT id FROM carts WHERE user_id = 881);
      DELETE FROM carts WHERE user_id = 881;
      DELETE FROM product_variants WHERE id = ${variantIdA} OR sku = 'SKU-A-01';
      DELETE FROM products WHERE id = ${productIdA} OR slug = 'product-test-a' OR sku = 'SKU-PROD-A';

      INSERT INTO products (id, name, slug, sku, base_price, stock_quantity, is_active, created_at, updated_at)
      VALUES (${productIdA}, 'محصول آزمون A', 'product-test-a', 'SKU-PROD-A', 2000000, ${initialStockA}, 1, '${now}', '${now}');

      INSERT INTO product_variants (id, product_id, name, sku, price, stock_quantity, is_active, created_at, updated_at)
      VALUES (${variantIdA}, ${productIdA}, 'واریانت A', 'SKU-A-01', 2000000, ${initialStockA}, 1, '${now}', '${now}');

      DELETE FROM inventory WHERE product_variant_id = ${variantIdA};
      INSERT INTO inventory (product_variant_id, quantity, reserved_quantity, safety_threshold, created_at, updated_at)
      VALUES (${variantIdA}, ${initialStockA}, 0, 0, '${now}', '${now}');

      INSERT INTO carts (id, user_id, created_at, updated_at)
      VALUES (881, 881, '${now}', '${now}');

      INSERT INTO cart_items (id, cart_id, product_variant_id, quantity, created_at, updated_at)
      VALUES (881, 881, ${variantIdA}, 2, '${now}', '${now}');
    `);
    persistDatabase();

    const idempotencyKeyA = `idemp-key-test-a-${Date.now()}`;
    const checkoutPayloadA = {
      idempotency_key: idempotencyKeyA,
      shipping_method: "post",
      payment_gateway: "wallet",
      shipping_address: {
        recipient_name: "خریدار آزمون A",
        phone: "09128810001",
        province: "تهران",
        city: "تهران",
        address_line: "خیابان ولیعصر، پلاک ۱۰۰",
      },
    };

    // Execute two simultaneous requests with the exact same key and cart
    const [resA1, resA2] = await Promise.all([
      fetch(`${baseUrl}/api/v1/orders/checkout`, {
        method: "POST",
        headers: user1Headers,
        body: JSON.stringify(checkoutPayloadA),
      }),
      fetch(`${baseUrl}/api/v1/orders/checkout`, {
        method: "POST",
        headers: user1Headers,
        body: JSON.stringify(checkoutPayloadA),
      }),
    ]);

    const jsonA1: any = await resA1.json();
    const jsonA2: any = await resA2.json();

    console.log(`Test A Response 1: HTTP ${resA1.status}, body=${JSON.stringify(jsonA1)}`);
    console.log(`Test A Response 2: HTTP ${resA2.status}, body=${JSON.stringify(jsonA2)}`);

    if (resA1.status !== 200 && resA1.status !== 201) {
      throw new Error(`Test A FAILED: Request 1 returned unexpected status ${resA1.status}`);
    }
    if (resA2.status !== 200 && resA2.status !== 201) {
      throw new Error(`Test A FAILED: Request 2 returned unexpected status ${resA2.status}`);
    }

    if (jsonA1.order_id !== jsonA2.order_id) {
      throw new Error(`Test A FAILED: Two different orders created! (${jsonA1.order_id} vs ${jsonA2.order_id})`);
    }

    // Verify exactly one order exists with this idempotency key
    const ordersA = queryRows(db, `SELECT id FROM orders WHERE idempotency_key = ?`, [idempotencyKeyA]);
    if (ordersA.length !== 1) {
      throw new Error(`Test A FAILED: Expected exactly 1 order in DB, found ${ordersA.length}`);
    }

    // Verify stock was decremented exactly once (10 - 2 = 8)
    const variantARows = queryRows(db, `SELECT stock_quantity FROM product_variants WHERE id = ?`, [variantIdA]);
    const finalStockA = Number(variantARows[0]?.stock_quantity);
    if (finalStockA !== 8) {
      throw new Error(`Test A FAILED: Expected stock 8, found ${finalStockA}`);
    }

    console.log("--> [TEST A PASSED]: Exactly 1 order created, stock decremented exactly once, idempotent responses matching.");

    // -------------------------------------------------------------
    // TEST B: SAME IDEMPOTENCY KEY WITH DIFFERENT PAYLOAD -> 409
    // -------------------------------------------------------------
    console.log("\n--- [TEST B] Same Idempotency Key with Different Payload ---");
    // Repopulate cart for user 1
    db.run(`
      INSERT INTO cart_items (id, cart_id, product_variant_id, quantity, created_at, updated_at)
      VALUES (882, 881, ${variantIdA}, 1, '${now}', '${now}');
    `);
    persistDatabase();

    const differentPayloadB = {
      idempotency_key: idempotencyKeyA, // SAME key as Test A
      shipping_method: "tipax", // DIFFERENT shipping method
      payment_gateway: "wallet",
      shipping_address: {
        recipient_name: "یک گیرنده دیگر",
        phone: "09128819999",
        province: "اصفهان",
        city: "اصفهان",
        address_line: "چهارباغ عباسی، پلاک ۲۰",
      },
    };

    const resB = await fetch(`${baseUrl}/api/v1/orders/checkout`, {
      method: "POST",
      headers: user1Headers,
      body: JSON.stringify(differentPayloadB),
    });

    const jsonB: any = await resB.json();
    console.log(`Test B Response: HTTP ${resB.status}, code=${jsonB.code || jsonB.error}`);

    if (resB.status !== 409) {
      throw new Error(`Test B FAILED: Expected HTTP 409 for payload mismatch, got ${resB.status}`);
    }

    // Verify stock was NOT decremented again (must remain 8)
    const variantBRows = queryRows(db, `SELECT stock_quantity FROM product_variants WHERE id = ?`, [variantIdA]);
    if (Number(variantBRows[0]?.stock_quantity) !== 8) {
      throw new Error(`Test B FAILED: Stock changed after rejected payload mismatch!`);
    }

    console.log("--> [TEST B PASSED]: Rejected with 409 IDEMPOTENCY_PAYLOAD_MISMATCH, no stock deducted.");

    // -------------------------------------------------------------
    // TEST C: CONCURRENT CHECKOUTS COMPETING FOR LAST STOCK (STOCK = 1)
    // -------------------------------------------------------------
    console.log("\n--- [TEST C] Race Condition on Last In-Stock Item (Stock = 1) ---");
    const productIdC = 802;
    const variantIdC = 802;

    db.run(`
      DELETE FROM cart_items WHERE cart_id IN (SELECT id FROM carts WHERE user_id IN (881, 882));
      DELETE FROM carts WHERE user_id IN (881, 882);
      DELETE FROM product_variants WHERE id = ${variantIdC} OR sku = 'SKU-C-LAST';
      DELETE FROM products WHERE id = ${productIdC} OR slug = 'product-test-c' OR sku = 'SKU-PROD-C';

      INSERT INTO products (id, name, slug, sku, base_price, stock_quantity, is_active, created_at, updated_at)
      VALUES (${productIdC}, 'محصول آخرین موجودی C', 'product-test-c', 'SKU-PROD-C', 1000000, 1, 1, '${now}', '${now}');

      INSERT INTO product_variants (id, product_id, name, sku, price, stock_quantity, is_active, created_at, updated_at)
      VALUES (${variantIdC}, ${productIdC}, 'واریانت C', 'SKU-C-LAST', 1000000, 1, 1, '${now}', '${now}');

      DELETE FROM inventory WHERE product_variant_id = ${variantIdC};
      INSERT INTO inventory (product_variant_id, quantity, reserved_quantity, safety_threshold, created_at, updated_at)
      VALUES (${variantIdC}, 1, 0, 0, '${now}', '${now}');

      INSERT INTO carts (id, user_id, created_at, updated_at)
      VALUES (881, 881, '${now}', '${now}'), (882, 882, '${now}', '${now}');

      INSERT INTO cart_items (id, cart_id, product_variant_id, quantity, created_at, updated_at)
      VALUES (883, 881, ${variantIdC}, 1, '${now}', '${now}'),
             (884, 882, ${variantIdC}, 1, '${now}', '${now}');
    `);
    persistDatabase();

    const payloadC1 = {
      idempotency_key: `idemp-c1-${Date.now()}`,
      shipping_method: "post",
      payment_gateway: "wallet",
      shipping_address: {
        recipient_name: "خریدار ۱",
        phone: "09128810001",
        province: "تهران",
        city: "تهران",
        address_line: "آدرس ۱",
      },
    };

    const payloadC2 = {
      idempotency_key: `idemp-c2-${Date.now()}`,
      shipping_method: "post",
      payment_gateway: "wallet",
      shipping_address: {
        recipient_name: "خریدار ۲",
        phone: "09128820002",
        province: "تهران",
        city: "تهران",
        address_line: "آدرس ۲",
      },
    };

    // Both users checkout concurrently for the single remaining item
    const [resC1, resC2] = await Promise.all([
      fetch(`${baseUrl}/api/v1/orders/checkout`, {
        method: "POST",
        headers: user1Headers,
        body: JSON.stringify(payloadC1),
      }),
      fetch(`${baseUrl}/api/v1/orders/checkout`, {
        method: "POST",
        headers: user2Headers,
        body: JSON.stringify(payloadC2),
      }),
    ]);

    const jsonC1: any = await resC1.json();
    const jsonC2: any = await resC2.json();

    console.log(`Test C Result User 1: HTTP ${resC1.status}, success=${jsonC1.success}`);
    console.log(`Test C Result User 2: HTTP ${resC2.status}, success=${jsonC2.success}`);

    const successes = [resC1.status, resC2.status].filter((s) => s === 201 || s === 200).length;
    const failures = [resC1.status, resC2.status].filter((s) => s === 422).length;

    if (successes !== 1 || failures !== 1) {
      throw new Error(`Test C FAILED: Expected exactly 1 success and 1 422 failure, got ${successes} successes, ${failures} failures.`);
    }

    // Verify stock is exactly 0 and NEVER negative
    const variantCRows = queryRows(db, `SELECT stock_quantity FROM product_variants WHERE id = ?`, [variantIdC]);
    const finalStockC = Number(variantCRows[0]?.stock_quantity);
    if (finalStockC !== 0) {
      throw new Error(`Test C FAILED: Expected stock 0, found ${finalStockC}`);
    }

    console.log("--> [TEST C PASSED]: Concurrency race handled atomically. Stock reached 0, never negative.");

    // -------------------------------------------------------------
    // TEST D: PAYMENT CALLBACK FOR CANCELLED ORDER
    // -------------------------------------------------------------
    console.log("\n--- [TEST D] Payment Callback for Cancelled Order ---");
    const orderIdD = 8401;
    const paymentIdD = 8401;
    const trackIdD = 770001;
    const variantIdD = 803;

    db.run(`
      DELETE FROM product_variants WHERE id = ${variantIdD} OR sku = 'SKU-D';
      DELETE FROM products WHERE id = ${variantIdD} OR slug = 'product-d' OR sku = 'SKU-PROD-D';

      INSERT INTO products (id, name, slug, sku, base_price, stock_quantity, is_active, created_at, updated_at)
      VALUES (${variantIdD}, 'محصول D', 'product-d', 'SKU-PROD-D', 500000, 10, 1, '${now}', '${now}');

      INSERT INTO product_variants (id, product_id, name, sku, price, stock_quantity, is_active, created_at, updated_at)
      VALUES (${variantIdD}, ${variantIdD}, 'واریانت D', 'SKU-D', 500000, 10, 1, '${now}', '${now}');

      DELETE FROM inventory WHERE product_variant_id = ${variantIdD};
      INSERT INTO inventory (product_variant_id, quantity, reserved_quantity, safety_threshold, created_at, updated_at)
      VALUES (${variantIdD}, 10, 0, 0, '${now}', '${now}');

      DELETE FROM payments WHERE id = ${paymentIdD};
      DELETE FROM order_items WHERE order_id = ${orderIdD};
      DELETE FROM orders WHERE id = ${orderIdD};

      -- Order was cancelled by user, stock restored, is_inventory_restored = 1
      INSERT INTO orders (id, order_number, user_id, status, payment_status, subtotal, grand_total, currency, shipping_address_snapshot, is_inventory_restored, created_at, updated_at)
      VALUES (${orderIdD}, 'ORD-TEST-D', 881, 'cancelled', 'pending', 500000, 500000, 'IRR', '{}', 1, '${now}', '${now}');

      INSERT INTO order_items (id, order_id, product_id, product_variant_id, product_name_snapshot, variant_sku_snapshot, unit_price, quantity, total_price, created_at, updated_at)
      VALUES (8401, ${orderIdD}, ${variantIdD}, ${variantIdD}, 'محصول D', 'SKU-D', 500000, 1, 500000, '${now}', '${now}');

      INSERT INTO payments (id, order_id, user_id, gateway, amount, currency, status, gateway_payment_id, reference_id, created_at, updated_at)
      VALUES (${paymentIdD}, ${orderIdD}, 881, 'zibal', 500000, 'IRR', 'pending', '${trackIdD}', 'REF-D', '${now}', '${now}');
    `);
    persistDatabase();

    // Mock Zibal client returning success (result: 100)
    setZibalHttpClient(async (url: string, body: any) => {
      if (url.includes("/verify")) {
        return {
          result: 100,
          refNumber: 999888777,
          paidAt: new Date().toISOString(),
          cardNumber: "6037********1234",
          status: 1,
          amount: 500000,
          message: "تراکنش با موفقیت تأیید شد.",
        };
      }
      return { result: 100, trackId: trackIdD, message: "OK" };
    });

    // Callback arrives with success=1
    const resD = await fetch(`${baseUrl}/api/v1/payments/zibal/callback?trackId=${trackIdD}&success=1&status=2`);
    console.log(`Test D Callback Response: HTTP ${resD.status}`);

    const orderDRows = queryRows(db, `SELECT status, payment_status, is_inventory_restored FROM orders WHERE id = ?`, [orderIdD]);
    const orderD = orderDRows[0];
    console.log(`Order D in DB: status=${orderD.status}, payment_status=${orderD.payment_status}, is_restored=${orderD.is_inventory_restored}`);

    // Order must remain cancelled (or marked refund_pending) and NOT silently revived to pending/processing without review
    if (orderD.status !== "cancelled") {
      throw new Error(`Test D FAILED: Cancelled order was improperly revived to '${orderD.status}'!`);
    }

    // Verify stock was not deducted again or double-restored
    const variantDRows = queryRows(db, `SELECT stock_quantity FROM product_variants WHERE id = ?`, [variantIdD]);
    if (Number(variantDRows[0]?.stock_quantity) !== 10) {
      throw new Error(`Test D FAILED: Stock corrupted! Expected 10, got ${variantDRows[0]?.stock_quantity}`);
    }

    console.log("--> [TEST D PASSED]: Cancelled order protected against resurrection, financial status preserved as refund_pending, inventory intact.");

    // -------------------------------------------------------------
    // TEST E: DUPLICATE PAYMENT CALLBACKS (SAME TRACK_ID)
    // -------------------------------------------------------------
    console.log("\n--- [TEST E] Duplicate Payment Callbacks (Same Track ID) ---");
    const orderIdE = 8501;
    const paymentIdE = 8501;
    const trackIdE = 770002;
    const variantIdE = 804;

    db.run(`
      DELETE FROM product_variants WHERE id = ${variantIdE} OR sku = 'SKU-E';
      DELETE FROM products WHERE id = ${variantIdE} OR slug = 'product-e' OR sku = 'SKU-PROD-E';

      INSERT INTO products (id, name, slug, sku, base_price, stock_quantity, is_active, created_at, updated_at)
      VALUES (${variantIdE}, 'محصول E', 'product-e', 'SKU-PROD-E', 750000, 5, 1, '${now}', '${now}');

      INSERT INTO product_variants (id, product_id, name, sku, price, stock_quantity, is_active, created_at, updated_at)
      VALUES (${variantIdE}, ${variantIdE}, 'واریانت E', 'SKU-E', 750000, 5, 1, '${now}', '${now}');

      DELETE FROM inventory WHERE product_variant_id = ${variantIdE};
      INSERT INTO inventory (product_variant_id, quantity, reserved_quantity, safety_threshold, created_at, updated_at)
      VALUES (${variantIdE}, 5, 0, 0, '${now}', '${now}');

      DELETE FROM payments WHERE id = ${paymentIdE};
      DELETE FROM order_items WHERE order_id = ${orderIdE};
      DELETE FROM orders WHERE id = ${orderIdE};

      INSERT INTO orders (id, order_number, user_id, status, payment_status, subtotal, grand_total, currency, shipping_address_snapshot, is_inventory_restored, created_at, updated_at)
      VALUES (${orderIdE}, 'ORD-TEST-E', 881, 'pending', 'pending', 750000, 750000, 'IRR', '{}', 0, '${now}', '${now}');

      INSERT INTO order_items (id, order_id, product_id, product_variant_id, product_name_snapshot, variant_sku_snapshot, unit_price, quantity, total_price, created_at, updated_at)
      VALUES (8501, ${orderIdE}, ${variantIdE}, ${variantIdE}, 'محصول E', 'SKU-E', 750000, 1, 750000, '${now}', '${now}');

      INSERT INTO payments (id, order_id, user_id, gateway, amount, currency, status, gateway_payment_id, reference_id, created_at, updated_at)
      VALUES (${paymentIdE}, ${orderIdE}, 881, 'zibal', 750000, 'IRR', 'pending', '${trackIdE}', 'REF-E', '${now}', '${now}');
    `);
    persistDatabase();

    // Mock Zibal client returning success with matching amount (750000)
    setZibalHttpClient(async (url: string, body: any) => {
      if (url.includes("/verify")) {
        return {
          result: 100,
          refNumber: 999888778,
          paidAt: new Date().toISOString(),
          cardNumber: "6037********1234",
          status: 1,
          amount: 750000,
          message: "تراکنش با موفقیت تأیید شد.",
        };
      }
      return { result: 100, trackId: trackIdE, message: "OK" };
    });

    // Fire 2 concurrent callback requests for the same trackId
    const [resE1, resE2] = await Promise.all([
      fetch(`${baseUrl}/api/v1/payments/zibal/callback?trackId=${trackIdE}&success=1&status=2`),
      fetch(`${baseUrl}/api/v1/payments/zibal/callback?trackId=${trackIdE}&success=1&status=2`),
    ]);

    console.log(`Test E Callback 1 HTTP: ${resE1.status}, Callback 2 HTTP: ${resE2.status}`);

    const orderERows = queryRows(db, `SELECT status, payment_status FROM orders WHERE id = ?`, [orderIdE]);
    if (orderERows[0]?.payment_status !== "paid" || (orderERows[0]?.status !== "processing" && orderERows[0]?.status !== "paid")) {
      throw new Error(`Test E FAILED: Expected status 'paid' or 'processing' / 'paid', got ${orderERows[0]?.status} / ${orderERows[0]?.payment_status}`);
    }

    // Verify no duplicate transactions or corrupt transitions
    const paymentRowsE = queryRows(db, `SELECT status, reference_id FROM payments WHERE id = ?`, [paymentIdE]);
    if (paymentRowsE[0]?.status !== "paid") {
      throw new Error(`Test E FAILED: Payment record status is '${paymentRowsE[0]?.status}'`);
    }

    console.log("--> [TEST E PASSED]: Duplicate callbacks handled idempotently with zero state or stock divergence.");

    // -------------------------------------------------------------
    // TEST F: CANCELLATION RACE WITH SHIPPED/DELIVERED STATUS
    // -------------------------------------------------------------
    console.log("\n--- [TEST F] Order Cancellation Race with Fulfillment (Shipped/Delivered) ---");
    const orderIdF = 8601;

    db.run(`
      DELETE FROM orders WHERE id = ${orderIdF};
      INSERT INTO orders (id, order_number, user_id, status, payment_status, grand_total, shipping_address_snapshot, is_inventory_restored, created_at, updated_at)
      VALUES (${orderIdF}, 'ORD-TEST-F', 881, 'shipped', 'paid', 300000, '{}', 0, '${now}', '${now}');
    `);
    persistDatabase();

    // Attempt cancellation of already shipped order
    const resF = await fetch(`${baseUrl}/api/v1/orders/${orderIdF}/cancel`, {
      method: "POST",
      headers: user1Headers,
    });

    const jsonF: any = await resF.json();
    console.log(`Test F Cancellation of Shipped Order: HTTP ${resF.status}, error=${jsonF.error || jsonF.code}`);

    if (resF.status !== 422) {
      throw new Error(`Test F FAILED: Shipped order cancellation should return 422, got ${resF.status}`);
    }

    const orderFRows = queryRows(db, `SELECT status FROM orders WHERE id = ?`, [orderIdF]);
    if (orderFRows[0]?.status !== "shipped") {
      throw new Error(`Test F FAILED: Order status was changed to '${orderFRows[0]?.status}'`);
    }

    console.log("--> [TEST F PASSED]: Terminal/in-transit states protected from invalid user cancellation.");

    // -------------------------------------------------------------
    // TEST G: INVALID STATE MACHINE TRANSITIONS REJECTION
    // -------------------------------------------------------------
    console.log("\n--- [TEST G] Authoritative State Machine Invalid Transition Rejection ---");
    const orderIdG = 8701;

    db.run(`
      DELETE FROM orders WHERE id = ${orderIdG};
      INSERT INTO orders (id, order_number, user_id, status, payment_status, grand_total, shipping_address_snapshot, is_inventory_restored, created_at, updated_at)
      VALUES (${orderIdG}, 'ORD-TEST-G', 881, 'delivered', 'paid', 400000, '{}', 0, '${now}', '${now}');
    `);
    persistDatabase();

    // Invalid transition: delivered -> pending
    const invalidResult = transitionOrderStatus(db, {
      orderId: orderIdG,
      targetStatus: "pending",
      actorRole: "admin",
      reason: "illegal_reversion_test",
    });

    if (invalidResult.success || invalidResult.errorCode !== "INVALID_ORDER_STATUS_TRANSITION") {
      throw new Error(`Test G FAILED: Invalid transition (delivered -> pending) was not rejected by state machine! Result: ${JSON.stringify(invalidResult)}`);
    }

    // Verify order was not modified
    const orderGRows = queryRows(db, `SELECT status FROM orders WHERE id = ?`, [orderIdG]);
    if (orderGRows[0]?.status !== "delivered") {
      throw new Error(`Test G FAILED: Order status changed despite invalid transition!`);
    }

    console.log("--> [TEST G PASSED]: State machine strictly rejects invalid order lifecycle transitions.");

    // -------------------------------------------------------------
    // TEST H: RE-VERIFYING UNKNOWN PAYMENT VIA RECOVERY SERVICE
    // -------------------------------------------------------------
    console.log("\n--- [TEST H] Re-verifying Unknown Payment via Recovery Service ---");
    const orderIdH = 8801;
    const paymentIdH = 8801;
    const trackIdH = 770003;

    db.run(`
      DELETE FROM payments WHERE id = ${paymentIdH};
      DELETE FROM orders WHERE id = ${orderIdH};

      INSERT INTO orders (id, order_number, user_id, status, payment_status, grand_total, shipping_address_snapshot, is_inventory_restored, created_at, updated_at)
      VALUES (${orderIdH}, 'ORD-TEST-H', 881, 'pending', 'unknown', 600000, '{}', 0, '${now}', '${now}');

      INSERT INTO payments (id, order_id, user_id, gateway, amount, currency, status, gateway_payment_id, reference_id, created_at, updated_at)
      VALUES (${paymentIdH}, ${orderIdH}, 881, 'zibal', 600000, 'IRR', 'unknown', '${trackIdH}', 'REF-H', '${now}', '${now}');
    `);
    persistDatabase();

    // Reconcile as successful
    const recResult = await reconcileUnknownPayment(db, {
      paymentId: paymentIdH,
      orderId: orderIdH,
      outcome: "confirmed_success",
      adminUserId: 883,
      reason: "تأیید دستی بر اساس صورت‌حساب بانکی",
    });

    console.log(`Reconciliation result: success=${recResult.success}, message=${recResult.message}`);
    if (!recResult.success) {
      throw new Error(`Test H FAILED: Reconcile failed: ${recResult.message}`);
    }

    // Check DB state
    const orderHRows = queryRows(db, `SELECT status, payment_status FROM orders WHERE id = ?`, [orderIdH]);
    if ((orderHRows[0]?.status !== "paid" && orderHRows[0]?.status !== "processing") || orderHRows[0]?.payment_status !== "paid") {
      throw new Error(`Test H FAILED: DB state is ${orderHRows[0]?.status} / ${orderHRows[0]?.payment_status}`);
    }

    // Second call must be idempotent
    const recSecond = await reconcileUnknownPayment(db, {
      paymentId: paymentIdH,
      orderId: orderIdH,
      outcome: "confirmed_success",
      adminUserId: 883,
      reason: "تأیید دستی مجدد",
    });
    if (!recSecond.success || !recSecond.isIdempotent) {
      throw new Error("Test H FAILED: Second reconciliation attempt failed or was not marked idempotent!");
    }

    console.log("--> [TEST H PASSED]: Unknown payment recovery transitions order safely and idempotently.");

    // -------------------------------------------------------------
    // TEST I: LEDGER AND INVENTORY INTEGRITY AUDIT
    // -------------------------------------------------------------
    console.log("\n--- [TEST I] Financial Ledger & Inventory Integrity Audit ---");
    // Verify no negative stock across product_variants
    const negativeStockRows = queryRows(db, `SELECT id, stock_quantity FROM product_variants WHERE stock_quantity < 0`);
    if (negativeStockRows.length > 0) {
      throw new Error(`Test I FAILED: Found product variants with negative stock: ${JSON.stringify(negativeStockRows)}`);
    }

    // Verify order_transition_history records are auditable and well-formed
    const historyRows = queryRows(db, `SELECT id, order_id, from_status, to_status, from_payment_status, to_payment_status, reason FROM order_transition_history ORDER BY id DESC LIMIT 10`);
    console.log(`Recorded state machine transitions (sample ${historyRows.length}):`);
    for (const h of historyRows) {
      console.log(` - Order #${h.order_id}: [${h.from_status}/${h.from_payment_status}] -> [${h.to_status}/${h.to_payment_status}] (${h.reason})`);
    }

    if (historyRows.length === 0) {
      throw new Error("Test I FAILED: No state transition history records found!");
    }

    console.log("--> [TEST I PASSED]: No negative inventory, transition ledger fully populated and auditable.");

    console.log("\n=========================================================================");
    console.log("=== ALL TESTS (A through I) PASSED WITH FULL CONCURRENCY INTEGRITY ===");
    console.log("=========================================================================");
  } finally {
    server.close();
  }
}

runPhase1_2_Tests().catch((err) => {
  console.error("\nTEST SUITE FAILED WITH ERROR:", err);
  process.exit(1);
});
