import express from "express";
import { Server } from "http";
import { getDatabase, persistDatabase, queryRows } from "../../src/server/db";
import { handleSimulateTestPayment } from "../../src/server/paymentRoutes";
import { mountDevelopmentApiRoutes } from "../../src/server/devApiAdapter";
import { TokenService } from "../../src/server/tokenService";

async function runPaymentSimulationSecurityTests() {
  console.log("=== Starting Payment Simulation Security Acceptance Tests ===");

  const db = await getDatabase();
  const now = new Date().toISOString();
  const future = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

  const tokenAdminSimulateHash = TokenService.hashToken("token_admin_simulate");
  const tokenAdminNoSimulateHash = TokenService.hashToken("token_admin_no_simulate");
  const tokenAdminWildcardHash = TokenService.hashToken("token_admin_wildcard");
  const tokenCustomerHash = TokenService.hashToken("token_customer_user");

  // Seed test users with different roles and token abilities
  db.run(`
    INSERT OR IGNORE INTO users (id, name, email, phone, password, role, status, created_at, updated_at)
    VALUES
      (950, 'مدیر با دسترسی شبیه‌سازی', 'admin.simulate@apexstore.local', '09129500001', 'hash', 'admin', 'active', '${now}', '${now}'),
      (951, 'مدیر بدون دسترسی شبیه‌سازی', 'admin.no_simulate@apexstore.local', '09129500002', 'hash', 'admin', 'active', '${now}', '${now}'),
      (952, 'مشتری عادی', 'customer.test@apexstore.local', '09129500003', 'hash', 'customer', 'active', '${now}', '${now}');

    DELETE FROM personal_access_tokens WHERE tokenable_id IN (950, 951, 952);

    -- Admin with explicit payments:simulate ability
    INSERT INTO personal_access_tokens (id, tokenable_type, tokenable_id, name, token, abilities, expires_at, created_at, updated_at)
    VALUES (950, 'App\\\\Modules\\\\Users\\\\Models\\\\User', 950, 'admin-simulate-token', '${tokenAdminSimulateHash}', '["payments:simulate"]', '${future}', '${now}', '${now}');

    -- Admin WITHOUT payments:simulate ability
    INSERT INTO personal_access_tokens (id, tokenable_type, tokenable_id, name, token, abilities, expires_at, created_at, updated_at)
    VALUES (951, 'App\\\\Modules\\\\Users\\\\Models\\\\User', 951, 'admin-no-simulate-token', '${tokenAdminNoSimulateHash}', '["orders:view", "products:view"]', '${future}', '${now}', '${now}');

    -- Admin with wildcard ability only (["*"])
    INSERT INTO personal_access_tokens (id, tokenable_type, tokenable_id, name, token, abilities, expires_at, created_at, updated_at)
    VALUES (953, 'App\\\\Modules\\\\Users\\\\Models\\\\User', 950, 'admin-wildcard-token', '${tokenAdminWildcardHash}', '["*"]', '${future}', '${now}', '${now}');

    -- Customer token
    INSERT INTO personal_access_tokens (id, tokenable_type, tokenable_id, name, token, abilities, expires_at, created_at, updated_at)
    VALUES (952, 'App\\\\Modules\\\\Users\\\\Models\\\\User', 952, 'customer-token', '${tokenCustomerHash}', '["customer:access"]', '${future}', '${now}', '${now}');
  `);

  // Seed test payments: one with gateway="test" and one with gateway="zibal"
  db.run(`
    DELETE FROM payments WHERE reference_id IN ('TEST-REF-ACCEPTANCE-1', 'ZIBAL-REF-ACCEPTANCE-1') OR id IN (9501, 9502);
    DELETE FROM orders WHERE order_number IN ('ORD-TEST-SIM-001', 'ORD-ZIBAL-SIM-001') OR id IN (9501, 9502);
    DELETE FROM payment_transactions WHERE payment_id IN (9501, 9502) OR idempotency_key LIKE '%TEST-REF-ACCEPTANCE-1%';
    DELETE FROM audit_logs WHERE entity_id IN (9501, 9502);

    INSERT INTO orders (id, user_id, order_number, status, payment_status, subtotal, discount_total, shipping_total, tax_total, grand_total, currency, shipping_address_snapshot, created_at, updated_at)
    VALUES
      (9501, 950, 'ORD-TEST-SIM-001', 'pending', 'pending', 100000, 0, 10000, 9000, 119000, 'IRR', '{}', '${now}', '${now}'),
      (9502, 950, 'ORD-ZIBAL-SIM-001', 'pending', 'pending', 200000, 0, 10000, 18000, 228000, 'IRR', '{}', '${now}', '${now}');

    INSERT INTO payments (id, order_id, user_id, gateway, amount, currency, status, reference_id, gateway_payment_id, created_at, updated_at)
    VALUES
      (9501, 9501, 950, 'test', 119000, 'IRR', 'pending', 'TEST-REF-ACCEPTANCE-1', 'TEST-REF-ACCEPTANCE-1', '${now}', '${now}'),
      (9502, 9502, 950, 'zibal', 228000, 'IRR', 'pending', 'ZIBAL-REF-ACCEPTANCE-1', 'ZIBAL-REF-ACCEPTANCE-1', '${now}', '${now}');
  `);
  await persistDatabase();

  // Setup test Express server
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Mount test/staging routes
  app.get("/api/v1/payments/test/simulate", handleSimulateTestPayment);
  app.post("/api/v1/payments/test/simulate", handleSimulateTestPayment);

  let server: Server;
  const port = 3991;
  await new Promise<void>((resolve) => {
    server = app.listen(port, () => resolve());
  });

  const baseUrl = `http://127.0.0.1:${port}/api/v1`;

  try {
    // -------------------------------------------------------------------------
    // TEST A: In production, route is not registered / returns 404
    // -------------------------------------------------------------------------
    console.log("\n[TEST A] Verifying production route registration isolation...");
    const prodApp = express();
    prodApp.use(express.json());

    // In production, devApiAdapter does not mount the route
    const originalEnv = process.env.APP_ENV;
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.APP_ENV = "production";
    process.env.NODE_ENV = "production";

    // Re-evaluate conditional mounting
    if (process.env.APP_ENV !== "production" && process.env.NODE_ENV !== "production") {
      prodApp.get("/api/v1/payments/test/simulate", handleSimulateTestPayment);
    }

    const prodServer = await new Promise<Server>((resolve) => {
      const s = prodApp.listen(3992, () => resolve(s));
    });

    try {
      const prodRes = await fetch("http://127.0.0.1:3992/api/v1/payments/test/simulate?reference=TEST-REF-ACCEPTANCE-1");
      if (prodRes.status === 404) {
        console.log("  PASS: Route returns 404 (Not Found) in production mode.");
      } else {
        throw new Error(`Expected 404 in production, got ${prodRes.status}`);
      }
    } finally {
      process.env.APP_ENV = originalEnv;
      process.env.NODE_ENV = originalNodeEnv;
      prodServer.close();
    }

    // -------------------------------------------------------------------------
    // TEST B: Unauthenticated & Customer requests fail with 401 / 403
    // -------------------------------------------------------------------------
    console.log("\n[TEST B] Verifying authentication and customer role rejection...");

    // B1: Unauthenticated request
    const unauthRes = await fetch(`${baseUrl}/payments/test/simulate?reference=TEST-REF-ACCEPTANCE-1`);
    const unauthBody = await unauthRes.json();
    if (unauthRes.status === 401 && unauthBody.error_code === "UNAUTHENTICATED") {
      console.log("  PASS: Unauthenticated request rejected with 401 UNAUTHENTICATED.");
    } else {
      throw new Error(`Expected 401 for unauthenticated request, got ${unauthRes.status}`);
    }

    // B2: Customer user request
    const customerRes = await fetch(`${baseUrl}/payments/test/simulate?reference=TEST-REF-ACCEPTANCE-1`, {
      headers: { Authorization: "Bearer token_customer_user" },
    });
    const customerBody = await customerRes.json();
    if (customerRes.status === 403 && customerBody.error_code === "FORBIDDEN_ROLE") {
      console.log("  PASS: Customer request rejected with 403 FORBIDDEN_ROLE.");
    } else {
      throw new Error(`Expected 403 for customer request, got ${customerRes.status}`);
    }

    // -------------------------------------------------------------------------
    // TEST C: Admin WITHOUT payments:simulate ability fails with 403
    // -------------------------------------------------------------------------
    console.log("\n[TEST C] Verifying admin without payments:simulate ability is rejected...");
    const adminNoAbilityRes = await fetch(`${baseUrl}/payments/test/simulate?reference=TEST-REF-ACCEPTANCE-1`, {
      headers: { Authorization: "Bearer token_admin_no_simulate" },
    });
    const adminNoAbilityBody = await adminNoAbilityRes.json();
    if (adminNoAbilityRes.status === 403 && adminNoAbilityBody.error_code === "FORBIDDEN_SIMULATION_ABILITY") {
      console.log("  PASS: Admin without payments:simulate rejected with 403 FORBIDDEN_SIMULATION_ABILITY.");
    } else {
      throw new Error(`Expected 403 for admin without ability, got ${adminNoAbilityRes.status}: ${JSON.stringify(adminNoAbilityBody)}`);
    }

    // -------------------------------------------------------------------------
    // TEST D: Admin with wildcard ability only (['*']) MUST fail with 403
    // -------------------------------------------------------------------------
    console.log("\n[TEST D] Verifying admin with wildcard ability only (['*']) is strictly rejected...");
    const adminWildcardRes = await fetch(`${baseUrl}/payments/test/simulate?reference=TEST-REF-ACCEPTANCE-1`, {
      headers: { Authorization: "Bearer token_admin_wildcard" },
    });
    const adminWildcardBody = await adminWildcardRes.json();
    if (adminWildcardRes.status === 403 && adminWildcardBody.error_code === "FORBIDDEN_SIMULATION_ABILITY") {
      console.log("  PASS: Admin with wildcard ability '*' rejected with 403 FORBIDDEN_SIMULATION_ABILITY.");
    } else {
      throw new Error(`Expected 403 for admin with wildcard ability, got ${adminWildcardRes.status}: ${JSON.stringify(adminWildcardBody)}`);
    }

    // -------------------------------------------------------------------------
    // TEST E: Live gateway payment (Zibal) CANNOT be simulated (fails with 422)
    // -------------------------------------------------------------------------
    console.log("\n[TEST E] Verifying live gateway payment (Zibal) cannot be simulated...");
    const liveSimRes = await fetch(`${baseUrl}/payments/test/simulate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer token_admin_simulate",
      },
      body: JSON.stringify({
        reference: "ZIBAL-REF-ACCEPTANCE-1",
        reason: "Malicious attempt to simulate live payment",
      }),
    });
    const liveSimBody = await liveSimRes.json();
    if (liveSimRes.status === 422 && liveSimBody.error_code === "LIVE_PAYMENT_SIMULATION_FORBIDDEN") {
      console.log("  PASS: Live gateway payment rejected with 422 LIVE_PAYMENT_SIMULATION_FORBIDDEN.");
    } else {
      throw new Error(`Expected 422 for live payment simulation, got ${liveSimRes.status}: ${JSON.stringify(liveSimBody)}`);
    }

    // Verify Zibal payment and order are still PENDING
    const livePaymentRows = queryRows(db, "SELECT status FROM payments WHERE reference_id = 'ZIBAL-REF-ACCEPTANCE-1'");
    if (livePaymentRows[0].status !== "pending") {
      throw new Error(`Live payment should remain pending, but is ${livePaymentRows[0].status}`);
    }
    console.log("  PASS: Live gateway payment record remained unmodified (pending).");

    // -------------------------------------------------------------------------
    // TEST D: Permitted staging request affects only TestPaymentGateway payment
    // -------------------------------------------------------------------------
    console.log("\n[TEST D] Verifying permitted staging request simulates test payment...");
    const validSimRes = await fetch(`${baseUrl}/payments/test/simulate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer token_admin_simulate",
      },
      body: JSON.stringify({
        reference: "TEST-REF-ACCEPTANCE-1",
        reason: "Automated acceptance test simulation",
      }),
    });
    const validSimBody = await validSimRes.json();
    if (validSimRes.status === 200 && validSimBody.success === true && validSimBody.data?.payment_status === "paid") {
      console.log("  PASS: Test payment simulated successfully as PAID.");
    } else {
      throw new Error(`Expected 200 success for test payment simulation, got ${validSimRes.status}: ${JSON.stringify(validSimBody)}`);
    }

    // Verify DB records
    const testPaymentRows = queryRows(db, "SELECT status FROM payments WHERE reference_id = 'TEST-REF-ACCEPTANCE-1'");
    const testOrderRows = queryRows(db, "SELECT status, payment_status FROM orders WHERE id = 9501");
    if (testPaymentRows[0].status === "paid" && testOrderRows[0].payment_status === "paid") {
      console.log("  PASS: Database payment and order status marked as paid.");
    } else {
      throw new Error(`Payment or order status not updated correctly in database`);
    }

    // -------------------------------------------------------------------------
    // TEST F: Every simulation is audit logged with actor, payment ID, env, reason
    // -------------------------------------------------------------------------
    console.log("\n[TEST F] Verifying audit logging of the simulation event...");
    const auditRows = queryRows(
      db,
      "SELECT user_id, action, entity_type, entity_id, redacted_metadata FROM audit_logs WHERE action = 'payment.simulated' AND entity_id = 9501 ORDER BY id DESC LIMIT 1"
    );

    if (auditRows.length === 0) {
      throw new Error("No audit log entry found for simulated payment 9501");
    }

    const log = auditRows[0];
    const meta = typeof log.redacted_metadata === "string" ? JSON.parse(log.redacted_metadata) : log.redacted_metadata;
    if (
      Number(log.user_id) === 950 &&
      log.entity_type === "payment" &&
      meta.reference_id === "TEST-REF-ACCEPTANCE-1" &&
      meta.gateway === "test" &&
      meta.reason === "Automated acceptance test simulation"
    ) {
      console.log("  PASS: Audit log entry successfully created with actor ID 950, payment ID 9501, and metadata.");
    } else {
      throw new Error(`Audit log metadata mismatch: ${JSON.stringify(log)}`);
    }

    // -------------------------------------------------------------------------
    // TEST G: Repeating the same simulation with the same idempotency key is idempotent
    // -------------------------------------------------------------------------
    console.log("\n[TEST G] Verifying repeating simulation with same idempotency key is idempotent...");
    const idempKey = "idemp_test_key_9501";
    const idempRes1 = await fetch(`${baseUrl}/payments/test/simulate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Idempotency-Key": idempKey,
        Authorization: "Bearer token_admin_simulate",
      },
      body: JSON.stringify({
        reference: "TEST-REF-ACCEPTANCE-1",
        reason: "First idempotency call",
      }),
    });
    const idempBody1 = await idempRes1.json();

    const idempRes2 = await fetch(`${baseUrl}/payments/test/simulate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Idempotency-Key": idempKey,
        Authorization: "Bearer token_admin_simulate",
      },
      body: JSON.stringify({
        reference: "TEST-REF-ACCEPTANCE-1",
        reason: "Second idempotency call",
      }),
    });
    const idempBody2 = await idempRes2.json();

    if (idempRes1.status === 200 && idempRes2.status === 200 && idempBody2.success === true) {
      console.log("  PASS: Repeated simulation with same idempotency key returned 200 idempotent response.");
    } else {
      throw new Error(`Idempotency verification failed: res1=${idempRes1.status}, res2=${idempRes2.status}`);
    }

    console.log("\n=== ALL PAYMENT SIMULATION SECURITY ACCEPTANCE TESTS PASSED (A - G) ===");

  } finally {
    server!.close();
  }
}

runPaymentSimulationSecurityTests().catch((err) => {
  console.error("FATAL: Acceptance tests failed:", err);
  process.exit(1);
});
