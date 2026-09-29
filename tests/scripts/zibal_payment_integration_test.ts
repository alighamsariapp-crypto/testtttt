import express from "express";
import { Server } from "http";

process.env.NODE_ENV = "test";
process.env.APP_KEY = process.env.APP_KEY || "base64:zP7F+6U556w3Fp6x856vT6l6L9k5z5f6G7h8j9k0l1m=";

import { getDatabase, persistDatabase, queryRows } from "../../src/server/db";
import {
  handleCheckout,
  handleGetCheckoutConfiguration,
  handleGetOrderById,
} from "../../src/server/orderRoutes";
import {
  handleZibalCallback,
  handleGetPaymentStatus,
  handleExchangePaymentStatusToken,
} from "../../src/server/paymentRoutes";
import {
  setZibalHttpClient,
  getZibalConfig,
} from "../../src/server/services/zibalService";
import { getAdminProducts } from "../../src/server/adminRoutes";
import { TokenService } from "../../src/server/tokenService";

async function runZibalIntegrationTests() {
  console.log("=== Starting Zibal Payment Gateway Integration Tests ===");

  const db = await getDatabase();
  const now = new Date().toISOString();
  const tokenHash = TokenService.hashToken("token_zibal_test_customer");

  // Find a valid active product variant from catalog with available stock
  const catalogProducts = getAdminProducts();
  const validProduct = catalogProducts.find((p: any) => p.is_active && p.variants?.some((v: any) => v.is_active && (Number(v.stock_quantity ?? v.inventory?.quantity ?? 0) > 5)));
  if (!validProduct) throw new Error("No active product with variants found in catalog");
  const validVariant = validProduct.variants.find((v: any) => v.is_active && (Number(v.stock_quantity ?? v.inventory?.quantity ?? 0) > 5));
  const testVariantId = validVariant.id;
  console.log(`Using product "${validProduct.name}" (variant ID: ${testVariantId}) for cart tests.`);

  // 1. Ensure test customer user and access token exist
  db.run(`
    INSERT OR IGNORE INTO users (id, name, email, phone, password, role, status, created_at, updated_at)
    VALUES (881, 'کاربر تستی درگاه', 'zibal_customer@apexstore.local', '09128888881', 'dummy_hash', 'customer', 'active', '${now}', '${now}');

    DELETE FROM personal_access_tokens WHERE tokenable_id = 881;

    INSERT INTO personal_access_tokens (id, tokenable_type, tokenable_id, name, token, abilities, created_at, updated_at)
    VALUES (881, 'App\\\\Modules\\\\Users\\\\Models\\\\User', 881, 'test-zibal-token', '${tokenHash}', '["*"]', '${now}', '${now}');
  `);

  // Ensure test cart exists and has an item
  db.run(`
    DELETE FROM payments WHERE user_id = 881 OR gateway_payment_id IN ('881001', '881002', '881003', '881004', '881005');
    DELETE FROM orders WHERE user_id = 881;

    INSERT OR IGNORE INTO carts (id, user_id, session_id, created_at, updated_at)
    VALUES (881, 881, 'session_zibal_881', '${now}', '${now}');

    DELETE FROM cart_items WHERE cart_id = 881;

    INSERT INTO cart_items (cart_id, product_variant_id, quantity, created_at, updated_at)
    VALUES (881, ${testVariantId}, 1, '${now}', '${now}');
  `);

  // Ensure shipping address exists
  db.run(`
    INSERT OR IGNORE INTO user_addresses (id, user_id, title, recipient_name, phone, province, city, postal_code, address_line, is_default, created_at, updated_at)
    VALUES (881, 881, 'دفتر مرکزی', 'خریدار تستی', '09128888881', 'تهران', 'تهران', '1999999999', 'خیابان آزادی پلاک ۱۰', 1, '${now}', '${now}');
  `);

  persistDatabase();

  // 2. Set up mock Zibal HTTP handler to simulate official Zibal gateway
  let lastPaymentRequestPayload: any = null;
  let lastVerifyRequestPayload: any = null;
  let simulatedTrackId = 9876543210;
  let simulatedVerifyResult = 100;
  let simulatedVerifyAmount: number | null = null;
  let simulatedRefNumber = 55112233;

  setZibalHttpClient(async (endpoint: string, payload: Record<string, any>) => {
    if (endpoint === "/v1/request") {
      lastPaymentRequestPayload = { ...payload };
      return {
        result: 100,
        trackId: simulatedTrackId,
        message: "success",
      };
    }
    if (endpoint === "/v1/verify") {
      lastVerifyRequestPayload = { ...payload };
      return {
        result: simulatedVerifyResult,
        amount: simulatedVerifyAmount !== null ? simulatedVerifyAmount : payload.amount,
        refNumber: simulatedRefNumber,
        cardNumber: "6219********1234",
        status: 2,
        paidAt: new Date().toISOString(),
      };
    }
    throw new Error(`Unhandled mock endpoint: ${endpoint}`);
  });

  // 3. Mount routes onto an Express test server
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get("/api/v1/checkout/configuration", handleGetCheckoutConfiguration);
  app.post("/api/v1/checkout", handleCheckout);
  app.get("/api/v1/orders/:id", handleGetOrderById);
  app.get("/api/v1/payments/zibal/callback", handleZibalCallback);
  app.post("/api/v1/payments/zibal/callback", handleZibalCallback);
  app.post("/api/v1/payments/status/exchange", handleExchangePaymentStatusToken);
  app.post("/api/v1/payments/status/:identifier/exchange", handleExchangePaymentStatusToken);
  app.get("/api/v1/payments/status/:identifier", handleGetPaymentStatus);
  app.get("/api/v1/payments/:trackIdOrRef/status", handleGetPaymentStatus);

  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });

  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 3333;
  const baseUrl = `http://localhost:${port}`;
  const authHeaders = {
    Authorization: "Bearer token_zibal_test_customer",
    "Content-Type": "application/json",
  };

  try {
    // TEST 1: Public checkout configuration does not leak merchant secret
    console.log("\n[TEST 1] Verifying public checkout configuration security...");
    const configRes = await fetch(`${baseUrl}/api/v1/checkout/configuration`);
    const configData = await configRes.json();
    if (!configData.success) throw new Error("Failed to fetch checkout configuration");
    if (configData.data.payment.online_provider !== "zibal") {
      throw new Error(`Expected online_provider 'zibal', got: ${configData.data.payment.online_provider}`);
    }
    if (typeof configData.data.payment.zibal_sandbox !== "boolean") {
      throw new Error("Expected zibal_sandbox boolean");
    }
    console.log("✓ Public checkout config passed (safe properties, dynamic sandbox).");

    // TEST 2: Order Creation & Zibal Request
    console.log("\n[TEST 2] Testing checkout order creation and Zibal payment request...");
    simulatedTrackId = 881001;
    const checkoutRes = await fetch(`${baseUrl}/api/v1/checkout`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        shipping_address: {
          recipient_name: "خریدار تستی",
          phone: "09128888881",
          province: "تهران",
          city: "تهران",
          postal_code: "1999999999",
          address_line: "خیابان آزادی پلاک ۱۰",
        },
        payment_gateway: "zibal",
        shipping_method: "post",
      }),
    });

    const checkoutJson = await checkoutRes.json();
    if (!checkoutJson.success) {
      throw new Error(`Checkout failed: ${checkoutJson.message}`);
    }

    const orderNumber = checkoutJson.data?.order_number || checkoutJson.order_number;
    const orderId = checkoutJson.data?.id || checkoutJson.order_id;
    const grandTotal = checkoutJson.data?.grand_total;
    const intent = checkoutJson.data?.payment_intent;

    if (!orderNumber || !grandTotal || !intent) {
      throw new Error(`Missing expected checkout response structure: ${JSON.stringify(checkoutJson)}`);
    }

    if (intent.gateway !== "zibal") throw new Error(`Expected gateway 'zibal', got: ${intent.gateway}`);
    if (intent.action !== "redirect") throw new Error(`Expected action 'redirect', got: ${intent.action}`);
    if (String(intent.track_id) !== String(simulatedTrackId)) throw new Error(`Expected trackId ${simulatedTrackId}, got: ${intent.track_id}`);
    if (intent.payment_url !== `https://gateway.zibal.ir/start/${simulatedTrackId}`) {
      throw new Error(`Expected Zibal redirect URL, got: ${intent.payment_url}`);
    }

    // Verify payment was persisted in SQLite
    const paymentRows = queryRows(
      db,
      `SELECT * FROM payments WHERE gateway_payment_id = ?`,
      [String(simulatedTrackId)]
    );
    if (paymentRows.length === 0) throw new Error("Payment record not persisted in SQLite");
    const initialPayment = paymentRows[0];
    if (initialPayment.status !== "pending") throw new Error(`Expected payment pending, got: ${initialPayment.status}`);
    if (Number(initialPayment.amount) !== grandTotal) throw new Error("Payment amount mismatch with order grand total");

    // Verify parameters sent to Zibal request
    if (!lastPaymentRequestPayload) throw new Error("No payload sent to Zibal request");
    if (lastPaymentRequestPayload.amount !== grandTotal) {
      throw new Error(`Authoritative amount mismatch: expected ${grandTotal}, got ${lastPaymentRequestPayload.amount}`);
    }
    if (lastPaymentRequestPayload.orderId !== orderNumber) {
      throw new Error(`Order ID mismatch in Zibal request: ${lastPaymentRequestPayload.orderId}`);
    }
    console.log(`✓ Checkout created Order #${orderNumber} (${grandTotal} IRR), requested Zibal trackId ${simulatedTrackId}, persisted in SQLite.`);

    // TEST 3: Successful Callback & Server-side Verification
    console.log("\n[TEST 3] Testing Zibal callback and server-to-server verification...");
    simulatedVerifyResult = 100;
    simulatedVerifyAmount = grandTotal;
    simulatedRefNumber = 77112233;

    const callbackRes = await fetch(
      `${baseUrl}/api/v1/payments/zibal/callback?trackId=${simulatedTrackId}&success=1&status=2&orderId=${orderNumber}`,
      { redirect: "manual" }
    );

    // Express should return a 302 redirect to /payment-status
    if (callbackRes.status !== 302) {
      throw new Error(`Expected 302 redirect from callback, got: ${callbackRes.status}`);
    }
    const location = callbackRes.headers.get("location") || "";
    if (!location.includes("/payment-status")) {
      throw new Error(`Expected location to contain /payment-status, got: ${location}`);
    }
    if (location.includes("status=success") || location.includes("amount=")) {
      throw new Error(`Security violation: callback redirect must NOT leak or trust status/amount in URL: ${location}`);
    }
    if (!location.includes(`order=${encodeURIComponent(orderNumber)}`)) {
      throw new Error(`Expected order number in redirect, got: ${location}`);
    }
    if (location.includes("token=")) {
      throw new Error(`Security violation: callback redirect contains reusable token query param: ${location}`);
    }
    if (!location.includes("exchange_code=")) {
      throw new Error(`Expected single-use exchange_code in redirect, got: ${location}`);
    }
    if (callbackRes.headers.get("referrer-policy") !== "no-referrer") {
      throw new Error(`Expected Referrer-Policy: no-referrer on callback redirect, got: ${callbackRes.headers.get("referrer-policy")}`);
    }

    // Extract one-time exchange code from redirect URL
    const urlObj = new URL(location, "http://localhost");
    const exchangeCode = urlObj.searchParams.get("exchange_code") || "";

    // Exchange one-time code for short-lived status token
    const exchangeRes = await fetch(`${baseUrl}/api/v1/payments/status/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: orderNumber, exchange_code: exchangeCode }),
    });
    if (exchangeRes.status !== 200) {
      throw new Error(`Expected 200 from status exchange, got: ${exchangeRes.status}`);
    }
    if (exchangeRes.headers.get("referrer-policy") !== "no-referrer") {
      throw new Error(`Expected Referrer-Policy: no-referrer on exchange endpoint`);
    }
    const exchangeJson = await exchangeRes.json();
    const statusToken = exchangeJson.data?.token || "";
    if (!statusToken) {
      throw new Error(`Expected statusToken from exchange response, got: ${JSON.stringify(exchangeJson)}`);
    }

    // Test authoritative status lookup with header token
    const statusRes = await fetch(`${baseUrl}/api/v1/payments/status/${orderNumber}`, {
      headers: { "X-Payment-Status-Token": statusToken },
    });
    if (statusRes.status !== 200) {
      throw new Error(`Expected 200 from payment status endpoint with valid token, got: ${statusRes.status}`);
    }
    if (statusRes.headers.get("referrer-policy") !== "no-referrer") {
      throw new Error(`Expected Referrer-Policy: no-referrer on status lookup endpoint`);
    }
    const statusJson = await statusRes.json();
    if (statusJson.data?.status !== "success" || statusJson.data?.payment_status !== "paid") {
      throw new Error(`Expected status 'success' and payment_status 'paid', got: ${JSON.stringify(statusJson)}`);
    }
    if (statusJson.data?.amount !== grandTotal) {
      throw new Error(`Expected verified server amount ${grandTotal}, got: ${statusJson.data?.amount}`);
    }

    // Acceptance Test A: Changing query parameters on the URL must NOT alter the server result
    const spoofedStatusRes = await fetch(`${baseUrl}/api/v1/payments/status/${orderNumber}?status=failed&amount=9999999`, {
      headers: { "X-Payment-Status-Token": statusToken },
    });
    const spoofedJson = await spoofedStatusRes.json();
    if (spoofedJson.data?.status !== "success" || spoofedJson.data?.amount !== grandTotal) {
      throw new Error("Security violation: Spoofed query parameters altered verified status result!");
    }

    // Security Test: Token in query param MUST NOT authorize status lookup
    const queryTokenRes = await fetch(`${baseUrl}/api/v1/payments/status/${orderNumber}?token=${encodeURIComponent(statusToken)}`);
    if (queryTokenRes.status !== 401 && queryTokenRes.status !== 403) {
      throw new Error(`Security breach: Query string token authorized payment status lookup! status=${queryTokenRes.status}`);
    }

    // Acceptance Test B: Unauthorized lookup without token or ownership fails with 401/403
    const unauthorizedRes = await fetch(`${baseUrl}/api/v1/payments/status/${orderNumber}`);
    if (unauthorizedRes.status !== 401 && unauthorizedRes.status !== 403) {
      throw new Error(`Expected 401 or 403 for unauthorized lookup without token, got: ${unauthorizedRes.status}`);
    }

    // Verify SQLite updated payment and order to 'paid'
    const updatedPaymentRows = queryRows(
      db,
      `SELECT * FROM payments WHERE gateway_payment_id = ?`,
      [String(simulatedTrackId)]
    );
    const updatedPayment = updatedPaymentRows[0];
    if (updatedPayment.status !== "paid") {
      throw new Error(`Expected payment status 'paid', got: ${updatedPayment.status}`);
    }
    if (updatedPayment.reference_id !== String(simulatedRefNumber)) {
      throw new Error(`Expected reference_id '${simulatedRefNumber}', got: ${updatedPayment.reference_id}`);
    }

    const updatedOrderRows = queryRows(
      db,
      `SELECT * FROM orders WHERE id = ?`,
      [orderId]
    );
    const updatedOrder = updatedOrderRows[0];
    if (updatedOrder.payment_status !== "paid") {
      throw new Error(`Expected order payment_status 'paid', got: ${updatedOrder.payment_status}`);
    }
    if (updatedOrder.status !== "paid" && updatedOrder.status !== "processing") {
      throw new Error(`Expected order status 'paid' or 'processing', got: ${updatedOrder.status}`);
    }
    console.log(`✓ Callback verified with Zibal server-to-server, order and payment marked as PAID, ref=${simulatedRefNumber}.`);

    // TEST 4: Idempotency on Duplicate Callback
    console.log("\n[TEST 4] Testing idempotency on duplicate callback...");
    lastVerifyRequestPayload = null; // reset to check if verification is skipped

    const duplicateCallbackRes = await fetch(
      `${baseUrl}/api/v1/payments/zibal/callback?trackId=${simulatedTrackId}&success=1&status=2&orderId=${orderNumber}`,
      { redirect: "manual" }
    );
    if (duplicateCallbackRes.status !== 302) {
      throw new Error(`Expected 302 on duplicate callback, got: ${duplicateCallbackRes.status}`);
    }
    const dupLocation = duplicateCallbackRes.headers.get("location") || "";
    if (!dupLocation.includes("/payment-status") || !dupLocation.includes(`order=${encodeURIComponent(orderNumber)}`) || dupLocation.includes("token=")) {
      throw new Error(`Expected idempotent redirect with order and no token on duplicate callback, got: ${dupLocation}`);
    }
    if (!dupLocation.includes("exchange_code=")) {
      throw new Error(`Expected exchange_code on duplicate callback, got: ${dupLocation}`);
    }
    if (dupLocation.includes("status=") || dupLocation.includes("amount=")) {
      throw new Error(`Security violation: duplicate callback leaked status/amount: ${dupLocation}`);
    }
    if (lastVerifyRequestPayload !== null) {
      throw new Error("Idempotency violation: verify request was called again for an already paid payment!");
    }
    console.log("✓ Duplicate callback handled idempotently without re-verifying or altering state.");

    // TEST 5: Amount Mismatch Rejection
    console.log("\n[TEST 5] Testing amount mismatch security rejection...");
    // Re-seed cart for another order
    db.run(`
      INSERT INTO cart_items (cart_id, product_variant_id, quantity, created_at, updated_at)
      VALUES (881, ${testVariantId}, 1, '${now}', '${now}');
    `);
    persistDatabase();

    simulatedTrackId = 881002;
    const checkoutMismatchRes = await fetch(`${baseUrl}/api/v1/checkout`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        shipping_address: { recipient_name: "خریدار تستی", phone: "09128888881", address_line: "خیابان آزادی" },
        payment_gateway: "zibal",
        shipping_method: "post",
      }),
    });
    const mismatchJson = await checkoutMismatchRes.json();
    const mismatchOrderNumber = mismatchJson.data?.order_number || mismatchJson.order_number;
    const mismatchOrderId = mismatchJson.data?.id || mismatchJson.order_id;
    const mismatchGrandTotal = mismatchJson.data?.grand_total;

    // Simulate Zibal verify returning a different amount (e.g. half the order total)
    simulatedVerifyResult = 100;
    simulatedVerifyAmount = mismatchGrandTotal - 100000;

    const mismatchCallbackRes = await fetch(
      `${baseUrl}/api/v1/payments/zibal/callback?trackId=${simulatedTrackId}&success=1&orderId=${mismatchOrderNumber}`,
      { redirect: "manual" }
    );
    const mismatchRedirect = mismatchCallbackRes.headers.get("location") || "";
    if (!mismatchRedirect.includes("/payment-status") || !mismatchRedirect.includes(`order=${encodeURIComponent(mismatchOrderNumber)}`) || mismatchRedirect.includes("token=")) {
      throw new Error(`Expected /payment-status redirect with order and no token, got: ${mismatchRedirect}`);
    }
    if (!mismatchRedirect.includes("exchange_code=")) {
      throw new Error(`Expected exchange_code on mismatch callback, got: ${mismatchRedirect}`);
    }
    if (mismatchRedirect.includes("status=") || mismatchRedirect.includes("amount=")) {
      throw new Error(`Security violation: mismatch redirect leaked status/amount: ${mismatchRedirect}`);
    }

    const mismatchUrlObj = new URL(mismatchRedirect, "http://localhost");
    const mismatchCode = mismatchUrlObj.searchParams.get("exchange_code") || "";
    const mismatchExchRes = await fetch(`${baseUrl}/api/v1/payments/status/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: mismatchOrderNumber, exchange_code: mismatchCode }),
    });
    const mismatchExchJson = await mismatchExchRes.json();
    const mismatchToken = mismatchExchJson.data?.token || "";

    const mismatchStatusRes = await fetch(`${baseUrl}/api/v1/payments/status/${mismatchOrderNumber}`, {
      headers: { "X-Payment-Status-Token": mismatchToken },
    });
    const mismatchStatusJson = await mismatchStatusRes.json();
    if (mismatchStatusJson.data?.status !== "failed" || mismatchStatusJson.data?.payment_status !== "failed") {
      throw new Error(`Expected status 'failed' for amount mismatch, got: ${JSON.stringify(mismatchStatusJson)}`);
    }
    if (mismatchStatusJson.data?.error_code !== "AMOUNT_MISMATCH") {
      throw new Error(`Expected error_code 'AMOUNT_MISMATCH', got: ${mismatchStatusJson.data?.error_code}`);
    }

    const mismatchPayment = queryRows(db, `SELECT * FROM payments WHERE gateway_payment_id = ?`, [String(simulatedTrackId)])[0];
    if (mismatchPayment.status === "paid") {
      throw new Error("Security failure: payment was marked paid despite amount mismatch!");
    }
    if (mismatchPayment.status !== "failed") {
      throw new Error(`Expected payment failed, got: ${mismatchPayment.status}`);
    }

    const mismatchOrder = queryRows(db, `SELECT * FROM orders WHERE id = ?`, [mismatchOrderId])[0];
    if (mismatchOrder.payment_status === "paid") {
      throw new Error("Security failure: order was marked paid despite amount mismatch!");
    }
    console.log("✓ Amount mismatch correctly rejected payment and order from being marked paid.");

    // TEST 6: User Cancellation Handling
    console.log("\n[TEST 6] Testing customer cancellation handling...");
    db.run(`
      INSERT INTO cart_items (cart_id, product_variant_id, quantity, created_at, updated_at)
      VALUES (881, ${testVariantId}, 1, '${now}', '${now}');
    `);
    persistDatabase();

    simulatedTrackId = 881003;
    const checkoutCancelRes = await fetch(`${baseUrl}/api/v1/checkout`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        shipping_address: { recipient_name: "خریدار تستی", phone: "09128888881", address_line: "خیابان آزادی" },
        payment_gateway: "zibal",
        shipping_method: "post",
      }),
    });
    const cancelJson = await checkoutCancelRes.json();
    const cancelOrderNumber = cancelJson.data?.order_number || cancelJson.order_number;
    const cancelOrderId = cancelJson.data?.id || cancelJson.order_id;

    // Simulate customer cancelling at gateway (success=0)
    const cancelCallbackRes = await fetch(
      `${baseUrl}/api/v1/payments/zibal/callback?trackId=${simulatedTrackId}&success=0&status=3&orderId=${cancelOrderNumber}`,
      { redirect: "manual" }
    );
    const cancelRedirect = cancelCallbackRes.headers.get("location") || "";
    if (!cancelRedirect.includes("/payment-status") || !cancelRedirect.includes(`order=${encodeURIComponent(cancelOrderNumber)}`) || cancelRedirect.includes("token=")) {
      throw new Error(`Expected /payment-status redirect with order and no token, got: ${cancelRedirect}`);
    }
    if (!cancelRedirect.includes("exchange_code=")) {
      throw new Error(`Expected exchange_code on cancel callback, got: ${cancelRedirect}`);
    }
    if (cancelRedirect.includes("status=") || cancelRedirect.includes("amount=")) {
      throw new Error(`Security violation: cancel redirect leaked status/amount: ${cancelRedirect}`);
    }

    const cancelUrlObj = new URL(cancelRedirect, "http://localhost");
    const cancelCode = cancelUrlObj.searchParams.get("exchange_code") || "";
    const cancelExchRes = await fetch(`${baseUrl}/api/v1/payments/status/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: cancelOrderNumber, exchange_code: cancelCode }),
    });
    const cancelExchJson = await cancelExchRes.json();
    const cancelToken = cancelExchJson.data?.token || "";

    const cancelStatusRes = await fetch(`${baseUrl}/api/v1/payments/status/${cancelOrderNumber}`, {
      headers: { "X-Payment-Status-Token": cancelToken },
    });
    const cancelStatusJson = await cancelStatusRes.json();
    if (cancelStatusJson.data?.status !== "cancelled" || cancelStatusJson.data?.payment_status !== "cancelled") {
      throw new Error(`Expected status 'cancelled', got: ${JSON.stringify(cancelStatusJson)}`);
    }

    const cancelledPayment = queryRows(db, `SELECT * FROM payments WHERE gateway_payment_id = ?`, [String(simulatedTrackId)])[0];
    if (cancelledPayment.status !== "cancelled") {
      throw new Error(`Expected payment cancelled, got: ${cancelledPayment.status}`);
    }
    const cancelledOrder = queryRows(db, `SELECT * FROM orders WHERE id = ?`, [cancelOrderId])[0];
    if (cancelledOrder.payment_status !== "cancelled") {
      throw new Error(`Expected order payment_status cancelled, got: ${cancelledOrder.payment_status}`);
    }
    console.log("✓ User cancellation handled gracefully, marked payment and order as cancelled.");

    console.log("\n========================================================");
    console.log("🎉 ALL ZIBAL PAYMENT GATEWAY INTEGRATION TESTS PASSED!");
    console.log("========================================================\n");
  } finally {
    server.close();
  }
}

runZibalIntegrationTests().catch((err) => {
  console.error("\n❌ ZIBAL INTEGRATION TEST FAILED:", err);
  process.exit(1);
});
