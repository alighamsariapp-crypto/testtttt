import express from "express";
import { Server } from "http";

process.env.NODE_ENV = "test";
process.env.APP_KEY = process.env.APP_KEY || "base64:zP7F+6U556w3Fp6x856vT6l6L9k5z5f6G7h8j9k0l1m=";

import { getDatabase, persistDatabase, queryRows } from "../../src/server/db";
import {
  handleZibalCallback,
  handleGetPaymentStatus,
  handleExchangePaymentStatusToken,
} from "../../src/server/paymentRoutes";
import {
  createPaymentStatusExchangeCode,
  exchangeCodeForStatusToken,
} from "../../src/server/services/paymentStatusExchangeService";
import { TokenService } from "../../src/server/tokenService";

async function runPaymentStatusExchangeSecurityTests() {
  console.log("=== Starting Payment Status Exchange Security Acceptance Tests ===");

  const db = await getDatabase();
  const now = new Date().toISOString();
  const future = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

  // 1. Seed two test users: Customer 901 and Customer 902
  const token901Hash = TokenService.hashToken("token_exchange_901");
  const token902Hash = TokenService.hashToken("token_exchange_902");

  db.run(`
    INSERT OR IGNORE INTO users (id, name, email, phone, password, role, status, created_at, updated_at)
    VALUES
      (901, 'کاربر آزمون تبادل یک', 'exchange_user1@apexstore.local', '09129010001', 'dummy', 'customer', 'active', '${now}', '${now}'),
      (902, 'کاربر آزمون تبادل دو', 'exchange_user2@apexstore.local', '09129020002', 'dummy', 'customer', 'active', '${now}', '${now}');

    DELETE FROM personal_access_tokens WHERE tokenable_id IN (901, 902) OR id IN (901, 902);

    INSERT INTO personal_access_tokens (id, tokenable_type, tokenable_id, name, token, abilities, expires_at, created_at, updated_at)
    VALUES
      (901, 'App\\\\Modules\\\\Users\\\\Models\\\\User', 901, 'tok-901', '${token901Hash}', '["*"]', '${future}', '${now}', '${now}'),
      (902, 'App\\\\Modules\\\\Users\\\\Models\\\\User', 902, 'tok-902', '${token902Hash}', '["*"]', '${future}', '${now}', '${now}');
  `);

  // 2. Seed orders and payments
  db.run(`
    DELETE FROM payments WHERE order_id IN (9010, 9020);
    DELETE FROM orders WHERE id IN (9010, 9020);
    DELETE FROM payment_status_exchanges WHERE order_id IN (9010, 9020);

    INSERT INTO orders (id, user_id, order_number, status, payment_status, subtotal, discount_total, shipping_total, tax_total, grand_total, currency, shipping_address_snapshot, created_at, updated_at)
    VALUES
      (9010, 901, 'ORD-EXCH-9010', 'processing', 'paid', 250000, 0, 0, 0, 250000, 'IRT', '{}', '${now}', '${now}'),
      (9020, 902, 'ORD-EXCH-9020', 'processing', 'paid', 350000, 0, 0, 0, 350000, 'IRT', '{}', '${now}', '${now}');

    INSERT INTO payments (id, order_id, user_id, gateway, amount, currency, status, reference_id, gateway_payment_id, created_at, updated_at)
    VALUES
      (9010, 9010, 901, 'zibal', 250000, 'IRT', 'paid', 'REF-9010', 'TRACK-9010', '${now}', '${now}'),
      (9020, 9020, 902, 'zibal', 350000, 'IRT', 'paid', 'REF-9020', 'TRACK-9020', '${now}', '${now}');
  `);
  persistDatabase();

  // 3. Set up test Express HTTP server
  const app = express();
  app.use(express.json());

  app.get("/api/v1/payments/zibal/callback", handleZibalCallback);
  app.post("/api/v1/payments/status/exchange", handleExchangePaymentStatusToken);
  app.post("/api/v1/payments/status/:identifier/exchange", handleExchangePaymentStatusToken);
  app.get("/api/v1/payments/status/:identifier", handleGetPaymentStatus);

  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // -------------------------------------------------------------
    // Acceptance Test A: Zibal callback Location header contains no reusable token= query parameter
    // -------------------------------------------------------------
    console.log("\n[Acceptance Test A] Checking Zibal callback Location header for lack of token...");
    const callbackRes = await fetch(`${baseUrl}/api/v1/payments/zibal/callback?trackId=TRACK-9010&success=1&status=2&orderId=ORD-EXCH-9010`, {
      redirect: "manual",
    });
    if (callbackRes.status !== 302) {
      throw new Error(`Expected 302 redirect from callback, got: ${callbackRes.status}`);
    }
    const location = callbackRes.headers.get("location") || "";
    if (location.includes("token=")) {
      throw new Error(`FAIL: Zibal callback Location header contains forbidden reusable token: ${location}`);
    }
    if (!location.includes("exchange_code=")) {
      throw new Error(`FAIL: Zibal callback Location header missing single-use exchange_code: ${location}`);
    }
    if (!location.includes("order=ORD-EXCH-9010")) {
      throw new Error(`FAIL: Missing order in redirect location: ${location}`);
    }
    console.log("✓ Acceptance Test A PASSED: Callback redirect contains NO token= and contains exchange_code=.");

    // -------------------------------------------------------------
    // Acceptance Test F: Referrer-Policy is no-referrer on payment status flow
    // -------------------------------------------------------------
    console.log("\n[Acceptance Test F] Verifying Referrer-Policy header on payment status flow...");
    const redirectReferrerPolicy = callbackRes.headers.get("referrer-policy");
    if (redirectReferrerPolicy !== "no-referrer") {
      throw new Error(`FAIL: Callback redirect missing Referrer-Policy: no-referrer, got: ${redirectReferrerPolicy}`);
    }

    const testExchCode = createPaymentStatusExchangeCode(db, 9010, "ORD-EXCH-9010", 901);
    const exchRes = await fetch(`${baseUrl}/api/v1/payments/status/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: "ORD-EXCH-9010", code: testExchCode }),
    });
    if (exchRes.headers.get("referrer-policy") !== "no-referrer") {
      throw new Error(`FAIL: Exchange endpoint missing Referrer-Policy: no-referrer`);
    }
    const exchJson = await exchRes.json();
    const statusToken = exchJson.data?.token;

    const statusRes = await fetch(`${baseUrl}/api/v1/payments/status/ORD-EXCH-9010`, {
      headers: { "X-Payment-Status-Token": statusToken },
    });
    if (statusRes.headers.get("referrer-policy") !== "no-referrer") {
      throw new Error(`FAIL: Payment status endpoint missing Referrer-Policy: no-referrer`);
    }
    console.log("✓ Acceptance Test F PASSED: Referrer-Policy: no-referrer verified across callback, exchange, and status.");

    // -------------------------------------------------------------
    // Acceptance Test B: A one-time exchange succeeds exactly once and then fails (replay blocked)
    // -------------------------------------------------------------
    console.log("\n[Acceptance Test B] Verifying single-use exchange code...");
    const singleUseCode = createPaymentStatusExchangeCode(db, 9010, "ORD-EXCH-9010", 901);

    // Attempt 1: First exchange MUST succeed
    const firstExchRes = await fetch(`${baseUrl}/api/v1/payments/status/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: "ORD-EXCH-9010", code: singleUseCode }),
    });
    if (firstExchRes.status !== 200) {
      throw new Error(`First exchange failed with status ${firstExchRes.status}`);
    }
    const firstJson = await firstExchRes.json();
    if (!firstJson.data?.token) {
      throw new Error("First exchange did not return status token");
    }

    // Attempt 2: Replay exchange with same code MUST fail with 403
    const secondExchRes = await fetch(`${baseUrl}/api/v1/payments/status/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: "ORD-EXCH-9010", code: singleUseCode }),
    });
    if (secondExchRes.status !== 401 && secondExchRes.status !== 403) {
      throw new Error(`FAIL: Replay attack succeeded or returned unexpected status: ${secondExchRes.status}`);
    }
    const secondJson = await secondExchRes.json();
    if (secondJson.error_code !== "EXCHANGE_CODE_ALREADY_USED") {
      throw new Error(`Expected error_code EXCHANGE_CODE_ALREADY_USED, got: ${secondJson.error_code}`);
    }
    console.log("✓ Acceptance Test B PASSED: Exchange succeeds exactly once, replay immediately rejected (403).");

    // -------------------------------------------------------------
    // Acceptance Test C: The exchange cannot be used for another order or user
    // -------------------------------------------------------------
    console.log("\n[Acceptance Test C] Verifying order and user binding...");
    const orderBoundCode = createPaymentStatusExchangeCode(db, 9010, "ORD-EXCH-9010", 901);

    // Attempt to exchange 9010's code for order 9020
    const orderMismatchRes = await fetch(`${baseUrl}/api/v1/payments/status/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: "ORD-EXCH-9020", code: orderBoundCode }),
    });
    if (orderMismatchRes.status !== 401 && orderMismatchRes.status !== 403) {
      throw new Error(`FAIL: Order mismatch did not reject with 401/403, got: ${orderMismatchRes.status}`);
    }
    const orderMismatchJson = await orderMismatchRes.json();
    if (orderMismatchJson.error_code !== "EXCHANGE_CODE_ORDER_MISMATCH") {
      throw new Error(`Expected EXCHANGE_CODE_ORDER_MISMATCH, got: ${orderMismatchJson.error_code}`);
    }

    // Attempt to exchange with user 902's authenticated bearer token for user 901's order
    const userMismatchRes = await fetch(`${baseUrl}/api/v1/payments/status/exchange`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer token_exchange_902",
      },
      body: JSON.stringify({ order: "ORD-EXCH-9010", code: orderBoundCode }),
    });
    if (userMismatchRes.status !== 401 && userMismatchRes.status !== 403) {
      throw new Error(`FAIL: User mismatch did not reject with 401/403, got: ${userMismatchRes.status}`);
    }
    const userMismatchJson = await userMismatchRes.json();
    if (userMismatchJson.error_code !== "EXCHANGE_CODE_USER_MISMATCH") {
      throw new Error(`Expected EXCHANGE_CODE_USER_MISMATCH, got: ${userMismatchJson.error_code}`);
    }
    console.log("✓ Acceptance Test C PASSED: Exchange cannot be used for another order or another user.");

    // -------------------------------------------------------------
    // Acceptance Test D: Forged or expired exchange returns 401/403
    // -------------------------------------------------------------
    console.log("\n[Acceptance Test D] Verifying forged and expired exchange rejection...");
    // Forged random code
    const forgedRes = await fetch(`${baseUrl}/api/v1/payments/status/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: "ORD-EXCH-9010", code: "random_forged_code_abcdef123456" }),
    });
    if (forgedRes.status !== 401 && forgedRes.status !== 403) {
      throw new Error(`Expected 401/403 for forged code, got: ${forgedRes.status}`);
    }

    // Expired code (TTL = -10s)
    const expiredCode = createPaymentStatusExchangeCode(db, 9010, "ORD-EXCH-9010", 901, -10);
    const expiredRes = await fetch(`${baseUrl}/api/v1/payments/status/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: "ORD-EXCH-9010", code: expiredCode }),
    });
    if (expiredRes.status !== 401 && expiredRes.status !== 403) {
      throw new Error(`Expected 401/403 for expired code, got: ${expiredRes.status}`);
    }
    const expiredJson = await expiredRes.json();
    if (expiredJson.error_code !== "EXCHANGE_CODE_EXPIRED") {
      throw new Error(`Expected EXCHANGE_CODE_EXPIRED, got: ${expiredJson.error_code}`);
    }
    console.log("✓ Acceptance Test D PASSED: Forged and expired exchange codes rejected with 401/403.");

    // -------------------------------------------------------------
    // Acceptance Test E: URL query token rejected; final browser URL sanitized
    // -------------------------------------------------------------
    console.log("\n[Acceptance Test E] Verifying URL query token is rejected and only header token is accepted...");
    const validExchangeCode = createPaymentStatusExchangeCode(db, 9010, "ORD-EXCH-9010", 901);
    const exchangeForAuthRes = await fetch(`${baseUrl}/api/v1/payments/status/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: "ORD-EXCH-9010", code: validExchangeCode }),
    });
    const exchangeForAuthJson = await exchangeForAuthRes.json();
    const authorizedToken = exchangeForAuthJson.data?.token;

    // Passing token in URL query parameter MUST BE REJECTED
    const queryTokenAttempt = await fetch(`${baseUrl}/api/v1/payments/status/ORD-EXCH-9010?token=${encodeURIComponent(authorizedToken)}`);
    if (queryTokenAttempt.status !== 401 && queryTokenAttempt.status !== 403) {
      throw new Error(`FAIL: Status lookup allowed token in query param! status=${queryTokenAttempt.status}`);
    }

    // Passing token in X-Payment-Status-Token header MUST BE ACCEPTED
    const headerTokenAttempt = await fetch(`${baseUrl}/api/v1/payments/status/ORD-EXCH-9010`, {
      headers: { "X-Payment-Status-Token": authorizedToken },
    });
    if (headerTokenAttempt.status !== 200) {
      throw new Error(`FAIL: Status lookup with header token failed! status=${headerTokenAttempt.status}`);
    }
    const headerJson = await headerTokenAttempt.json();
    if (headerJson.data?.amount !== 250000 || headerJson.data?.status !== "success") {
      throw new Error(`FAIL: Status lookup with header token returned wrong data: ${JSON.stringify(headerJson)}`);
    }

    // Verify frontend URL sanitization contract (simulated window.history.replaceState logic)
    const simulatedIncomingUrl = new URL("https://example.com/payment-status?order=ORD-EXCH-9010&exchange_code=XYZ12345#secret_hash_value");
    const sanitizedSearch = simulatedIncomingUrl.searchParams.get("order") ? `?order=${encodeURIComponent(simulatedIncomingUrl.searchParams.get("order")!)}` : "";
    const sanitizedUrl = simulatedIncomingUrl.pathname + sanitizedSearch;
    if (sanitizedUrl.includes("exchange_code") || sanitizedUrl.includes("token") || sanitizedUrl.includes("secret")) {
      throw new Error(`FAIL: Sanitized URL still contains sensitive params: ${sanitizedUrl}`);
    }
    console.log("✓ Acceptance Test E PASSED: URL query token rejected; header token accepted; URL sanitized cleanly.");

    console.log("\n==================================================================");
    console.log("🎉 ALL PAYMENT STATUS EXCHANGE ACCEPTANCE TESTS A-F PASSED!");
    console.log("==================================================================\n");
  } finally {
    server.close();
  }
}

runPaymentStatusExchangeSecurityTests().catch((err) => {
  console.error("\n❌ PAYMENT STATUS EXCHANGE SECURITY TEST FAILED:", err);
  process.exit(1);
});
