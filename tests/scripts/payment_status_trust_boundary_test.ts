import express from "express";
import { Server } from "http";

// Inject test APP_KEY for test environment execution
process.env.NODE_ENV = "test";
process.env.APP_KEY = process.env.APP_KEY || "base64:zP7F+6U556w3Fp6x856vT6l6L9k5z5f6G7h8j9k0l1m=";

import { getDatabase, persistDatabase, queryRows } from "../../src/server/db";
import { handleGetPaymentStatus } from "../../src/server/paymentRoutes";
import {
  generatePaymentStatusToken,
  verifyPaymentStatusToken,
} from "../../src/server/services/paymentStatusTokenService";
import { TokenService } from "../../src/server/tokenService";

async function runPaymentStatusTrustBoundaryTests() {
  console.log("=== Starting Payment Status Trust Boundary Acceptance Tests ===");

  const db = await getDatabase();
  const now = new Date().toISOString();
  const future = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

  // 1. Seed two test users: Alice (id: 701) and Bob (id: 702)
  const tokenAliceHash = TokenService.hashToken("token_alice_secret");
  const tokenBobHash = TokenService.hashToken("token_bob_secret");

  db.run(`
    INSERT OR IGNORE INTO users (id, name, email, phone, password, role, status, created_at, updated_at)
    VALUES
      (701, 'آلیس خریدار', 'alice@apexstore.local', '09127010001', 'dummy_hash', 'customer', 'active', '${now}', '${now}'),
      (702, 'باب خریدار', 'bob@apexstore.local', '09127020002', 'dummy_hash', 'customer', 'active', '${now}', '${now}');

    DELETE FROM personal_access_tokens WHERE tokenable_id IN (701, 702);

    INSERT INTO personal_access_tokens (id, tokenable_type, tokenable_id, name, token, abilities, expires_at, created_at, updated_at)
    VALUES
      (701, 'App\\\\Modules\\\\Users\\\\Models\\\\User', 701, 'alice-token', '${tokenAliceHash}', '["*"]', '${future}', '${now}', '${now}'),
      (702, 'App\\\\Modules\\\\Users\\\\Models\\\\User', 702, 'bob-token', '${tokenBobHash}', '["*"]', '${future}', '${now}', '${now}');
  `);

  // 2. Seed orders and payments for Alice and Bob
  db.run(`
    DELETE FROM payments WHERE order_id IN (7010, 7020, 7030);
    DELETE FROM orders WHERE id IN (7010, 7020, 7030);

    -- Alice's paid order: 450,000 IRT
    INSERT INTO orders (id, user_id, order_number, status, payment_status, subtotal, discount_total, shipping_total, tax_total, grand_total, currency, shipping_address_snapshot, created_at, updated_at)
    VALUES (7010, 701, 'ORD-ALICE-PAID', 'processing', 'paid', 450000, 0, 0, 0, 450000, 'IRT', '{}', '${now}', '${now}');

    INSERT INTO payments (id, order_id, user_id, gateway, amount, currency, status, reference_id, gateway_payment_id, created_at, updated_at)
    VALUES (7010, 7010, 701, 'zibal', 450000, 'IRT', 'paid', 'REF-ALICE-12345', 'TRACK-ALICE-12345', '${now}', '${now}');

    -- Alice's pending/unknown order: 120,000 IRT
    INSERT INTO orders (id, user_id, order_number, status, payment_status, subtotal, discount_total, shipping_total, tax_total, grand_total, currency, shipping_address_snapshot, created_at, updated_at)
    VALUES (7020, 701, 'ORD-ALICE-PENDING', 'pending', 'pending', 120000, 0, 0, 0, 120000, 'IRT', '{}', '${now}', '${now}');

    INSERT INTO payments (id, order_id, user_id, gateway, amount, currency, status, reference_id, gateway_payment_id, created_at, updated_at)
    VALUES (7020, 7020, 701, 'zibal', 120000, 'IRT', 'pending', 'REF-ALICE-PENDING', 'TRACK-ALICE-PENDING', '${now}', '${now}');

    -- Bob's private order: 990,000 IRT
    INSERT INTO orders (id, user_id, order_number, status, payment_status, subtotal, discount_total, shipping_total, tax_total, grand_total, currency, shipping_address_snapshot, created_at, updated_at)
    VALUES (7030, 702, 'ORD-BOB-PRIVATE', 'processing', 'paid', 990000, 0, 0, 0, 990000, 'IRT', '{}', '${now}', '${now}');

    INSERT INTO payments (id, order_id, user_id, gateway, amount, currency, status, reference_id, gateway_payment_id, created_at, updated_at)
    VALUES (7030, 7030, 702, 'zibal', 990000, 'IRT', 'paid', 'REF-BOB-SECRET', 'TRACK-BOB-SECRET', '${now}', '${now}');
  `);
  await persistDatabase();

  // Generate valid signed HMAC status token for Alice's order
  const aliceValidToken = generatePaymentStatusToken(7010, "ORD-ALICE-PAID", 701);
  const alicePendingToken = generatePaymentStatusToken(7020, "ORD-ALICE-PENDING", 701);

  // Setup test Express server
  const app = express();
  app.use(express.json());
  app.get("/api/v1/payments/status/:identifier", handleGetPaymentStatus);
  app.get("/api/v1/payments/:trackIdOrRef/status", handleGetPaymentStatus);

  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // -------------------------------------------------------------
    // Test 1: Authenticated Owner can retrieve payment status
    // -------------------------------------------------------------
    console.log("\n[Test 1] Authenticated order owner lookup...");
    const resAlice = await fetch(`${baseUrl}/api/v1/payments/status/ORD-ALICE-PAID`, {
      headers: { Authorization: "Bearer token_alice_secret" },
    });
    if (resAlice.status !== 200) {
      throw new Error(`Expected 200 for Alice accessing her own order, got: ${resAlice.status}`);
    }
    const jsonAlice = await resAlice.json();
    if (!jsonAlice.success || jsonAlice.data.amount !== 450000 || jsonAlice.data.status !== "success") {
      throw new Error(`Unexpected response for Alice: ${JSON.stringify(jsonAlice)}`);
    }
    console.log("✓ Owner successfully authorized and retrieved server-stored payment truth.");

    // -------------------------------------------------------------
    // Test 2 (Acceptance Test B): Bob cannot retrieve Alice's order (Ownership violation)
    // -------------------------------------------------------------
    console.log("\n[Test 2] Cross-user access rejection (Bob trying to view Alice's order)...");
    const resBobSniff = await fetch(`${baseUrl}/api/v1/payments/status/ORD-ALICE-PAID`, {
      headers: { Authorization: "Bearer token_bob_secret" },
    });
    if (resBobSniff.status !== 401 && resBobSniff.status !== 403) {
      throw new Error(`Expected 401/403 for cross-user order lookup, got: ${resBobSniff.status}`);
    }
    console.log("✓ Bob was blocked with 401/403 when attempting to access Alice's order.");

    // -------------------------------------------------------------
    // Test 3: Unauthenticated user without token is rejected (No enumeration)
    // -------------------------------------------------------------
    console.log("\n[Test 3] Unauthenticated enumeration attempt rejection...");
    const resAnon = await fetch(`${baseUrl}/api/v1/payments/status/ORD-BOB-PRIVATE`);
    if (resAnon.status !== 401 && resAnon.status !== 403) {
      throw new Error(`Expected 401/403 for anonymous lookup without token, got: ${resAnon.status}`);
    }
    console.log("✓ Anonymous lookup without signed token correctly blocked.");

    // -------------------------------------------------------------
    // Test 4: Signed HMAC status token permits lookup without login (post-gateway redirect)
    // -------------------------------------------------------------
    console.log("\n[Test 4] Status token authorization without authentication...");
    const resToken = await fetch(`${baseUrl}/api/v1/payments/status/ORD-ALICE-PAID`, {
      headers: { "X-Payment-Status-Token": aliceValidToken },
    });
    if (resToken.status !== 200) {
      throw new Error(`Expected 200 with valid signed token, got: ${resToken.status}`);
    }
    const jsonToken = await resToken.json();
    if (jsonToken.data.order_number !== "ORD-ALICE-PAID" || jsonToken.data.amount !== 450000) {
      throw new Error(`Token verification returned wrong data: ${JSON.stringify(jsonToken)}`);
    }
    console.log("✓ Valid signed HMAC status token authorized lookup correctly.");

    // Verify token in query string is strictly blocked
    const resQueryToken = await fetch(`${baseUrl}/api/v1/payments/status/ORD-ALICE-PAID?token=${encodeURIComponent(aliceValidToken)}`);
    if (resQueryToken.status !== 401 && resQueryToken.status !== 403) {
      throw new Error(`Expected 401/403 for token passed in query parameter, got: ${resQueryToken.status}`);
    }
    console.log("✓ Status token in URL query parameter strictly blocked.");

    // -------------------------------------------------------------
    // Test 5: Forged/Tampered token is rejected
    // -------------------------------------------------------------
    console.log("\n[Test 5] Forged status token rejection...");
    const forgedToken = aliceValidToken.slice(0, -6) + "badsig";
    const resForged = await fetch(`${baseUrl}/api/v1/payments/status/ORD-ALICE-PAID`, {
      headers: { "X-Payment-Status-Token": forgedToken },
    });
    if (resForged.status !== 401 && resForged.status !== 403) {
      throw new Error(`Expected 401/403 for forged token, got: ${resForged.status}`);
    }
    console.log("✓ Forged token rejected with 401/403.");

    // -------------------------------------------------------------
    // Test 6 (Acceptance Test A): Forged query parameters (?status=failed&amount=9999999)
    // MUST NOT alter the server-derived financial truth
    // -------------------------------------------------------------
    console.log("\n[Test 6] URL query parameter tampering resilience...");
    const resTampered = await fetch(
      `${baseUrl}/api/v1/payments/status/ORD-ALICE-PAID?status=failed&amount=999999999&reference=FAKE_REF`,
      {
        headers: { "X-Payment-Status-Token": aliceValidToken },
      }
    );
    if (resTampered.status !== 200) {
      throw new Error(`Expected 200, got: ${resTampered.status}`);
    }
    const jsonTampered = await resTampered.json();
    if (jsonTampered.data.status !== "success" || jsonTampered.data.amount !== 450000) {
      throw new Error(`Security breach: Server returned tampered values! ${JSON.stringify(jsonTampered)}`);
    }
    if (jsonTampered.data.reference_id !== "REF-ALICE-12345") {
      throw new Error(`Security breach: Reference was tampered! ${jsonTampered.data.reference_id}`);
    }
    console.log("✓ Tampered query parameters (status=failed, amount=999999999) had ZERO effect on server truth.");

    // -------------------------------------------------------------
    // Test 7 (Acceptance Test D): Pending order returns pending, not paid
    // -------------------------------------------------------------
    console.log("\n[Test 7] Pending payment status derivation...");
    const resPending = await fetch(
      `${baseUrl}/api/v1/payments/status/ORD-ALICE-PENDING?status=success&amount=50000000`,
      {
        headers: { "X-Payment-Status-Token": alicePendingToken },
      }
    );
    const jsonPending = await resPending.json();
    if (jsonPending.data.status !== "pending" || jsonPending.data.payment_status !== "pending") {
      throw new Error(`Expected status 'pending', got: ${JSON.stringify(jsonPending)}`);
    }
    if (jsonPending.data.amount !== 120000) {
      throw new Error(`Expected server amount 120000, got: ${jsonPending.data.amount}`);
    }
    console.log("✓ Pending order is strictly derived as pending, ignoring query status=success.");

    // -------------------------------------------------------------
    // Test 8 (Acceptance Test C): Idempotency on repeated lookups / page refresh
    // -------------------------------------------------------------
    console.log("\n[Test 8] Idempotent status inquiry (simulating browser page refresh)...");
    for (let i = 0; i < 5; i++) {
      const resRepeat = await fetch(`${baseUrl}/api/v1/payments/status/ORD-ALICE-PAID`, {
        headers: { "X-Payment-Status-Token": aliceValidToken },
      });
      if (resRepeat.status !== 200) {
        throw new Error(`Repeat ${i} failed with status: ${resRepeat.status}`);
      }
      const jsonRepeat = await resRepeat.json();
      if (jsonRepeat.data.status !== "success" || jsonRepeat.data.amount !== 450000) {
        throw new Error(`Repeat ${i} returned inconsistent data!`);
      }
    }
    console.log("✓ Multiple consecutive lookups are completely idempotent with zero state changes.");

    // -------------------------------------------------------------
    // Test 9: Security audit log check
    // -------------------------------------------------------------
    console.log("\n[Test 9] Security audit logging verification...");
    const auditLogs = queryRows(
      db,
      `SELECT * FROM audit_logs WHERE action = 'unauthorized_payment_status_lookup'`
    );
    if (auditLogs.length === 0) {
      throw new Error("Expected unauthorized lookups to be recorded in audit_logs, but found 0!");
    }
    // Verify tokens are NOT logged in metadata
    for (const log of auditLogs) {
      const meta = String(log.redacted_metadata || log.metadata || "");
      if (meta.includes("token_") || (aliceValidToken && meta.includes(aliceValidToken))) {
        throw new Error("Security audit leak: token was stored in audit_logs!");
      }
    }
    console.log(`✓ Recorded ${auditLogs.length} unauthorized lookup audit logs without leaking any tokens.`);

    // -------------------------------------------------------------
    // Test 10: Lookup by payment primary key (payment_id)
    // -------------------------------------------------------------
    console.log("\n[Test 10] Lookup by payment primary key...");
    const resPayId = await fetch(`${baseUrl}/api/v1/payments/status/7010`, {
      headers: { Authorization: "Bearer token_alice_secret" },
    });
    if (resPayId.status !== 200) {
      throw new Error(`Expected 200 for lookup by payment ID, got ${resPayId.status}`);
    }
    const jsonPayId = await resPayId.json();
    if (jsonPayId.data.order_number !== "ORD-ALICE-PAID" || jsonPayId.data.amount !== 450000) {
      throw new Error(`Lookup by payment ID returned invalid data: ${JSON.stringify(jsonPayId)}`);
    }
    console.log("✓ Successfully looked up payment status by payment primary key.");

    // -------------------------------------------------------------
    // Test 11: Lookup by reference_id
    // -------------------------------------------------------------
    console.log("\n[Test 11] Lookup by reference_id...");
    const resRefId = await fetch(`${baseUrl}/api/v1/payments/status/REF-ALICE-12345`, {
      headers: { Authorization: "Bearer token_alice_secret" },
    });
    if (resRefId.status !== 200) {
      throw new Error(`Expected 200 for lookup by reference_id, got ${resRefId.status}`);
    }
    const jsonRefId = await resRefId.json();
    if (jsonRefId.data.order_number !== "ORD-ALICE-PAID" || jsonRefId.data.reference_id !== "REF-ALICE-12345") {
      throw new Error(`Lookup by reference_id returned invalid data: ${JSON.stringify(jsonRefId)}`);
    }
    console.log("✓ Successfully looked up payment status by reference_id.");

    // -------------------------------------------------------------
    // Test 12: Lookup by gateway_payment_id (e.g. Zibal trackId / provider payment ID)
    // -------------------------------------------------------------
    console.log("\n[Test 12] Lookup by gateway_payment_id...");
    const resTrackId = await fetch(`${baseUrl}/api/v1/payments/status/TRACK-ALICE-12345`, {
      headers: { Authorization: "Bearer token_alice_secret" },
    });
    if (resTrackId.status !== 200) {
      throw new Error(`Expected 200 for lookup by gateway_payment_id, got ${resTrackId.status}`);
    }
    const jsonTrackId = await resTrackId.json();
    if (jsonTrackId.data.order_number !== "ORD-ALICE-PAID" || jsonTrackId.data.gateway_payment_id !== "TRACK-ALICE-12345") {
      throw new Error(`Lookup by gateway_payment_id returned invalid data: ${JSON.stringify(jsonTrackId)}`);
    }
    console.log("✓ Successfully looked up payment status by gateway_payment_id.");

    // -------------------------------------------------------------
    // Test 13: Bob trying to query Alice's payment via gateway_payment_id is rejected
    // -------------------------------------------------------------
    console.log("\n[Test 13] Cross-user rejection for gateway_payment_id lookup...");
    const resBobTrack = await fetch(`${baseUrl}/api/v1/payments/status/TRACK-ALICE-12345`, {
      headers: { Authorization: "Bearer token_bob_secret" },
    });
    if (resBobTrack.status !== 401 && resBobTrack.status !== 403) {
      throw new Error(`Expected 401/403 for unauthorized gateway_payment_id lookup, got ${resBobTrack.status}`);
    }
    console.log("✓ Cross-user gateway_payment_id lookup blocked with 401/403.");

    console.log("\n============================================================");
    console.log("🎉 ALL PAYMENT STATUS TRUST BOUNDARY TESTS PASSED!");
    console.log("============================================================\n");
  } finally {
    server.close();
  }
}

runPaymentStatusTrustBoundaryTests().catch((err) => {
  console.error("\n❌ TRUST BOUNDARY TEST FAILED:", err);
  process.exit(1);
});
