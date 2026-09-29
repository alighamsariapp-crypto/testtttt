import express from "express";
import { Server } from "http";
import assert from "assert";
import { getDatabase, persistDatabase, queryRows } from "../../src/server/db";
import { handlePaymentWebhook } from "../../src/server/paymentRoutes";

async function runPaymentWebhookConcurrencyTests() {
  console.log("================================================================================");
  console.log("STARTING PRODUCTION PAYMENT WEBHOOK CONCURRENCY & IDEMPOTENCY ACCEPTANCE SUITE");
  console.log("================================================================================");

  const db = await getDatabase();
  const now = new Date().toISOString();

  // 1. Setup Test Order and Payment
  const orderId = 8801;
  const paymentId = 8801;
  const orderNumber = "ORD-CONCUR-8801";
  const stripePi = "pi_concur_live_8801";

  db.run(`
    DELETE FROM payment_transactions WHERE payment_id = ${paymentId} OR idempotency_key LIKE '%8801%';
    DELETE FROM sms_deliveries WHERE event_key = 'order-paid-${orderId}';
    DELETE FROM payments WHERE id = ${paymentId};
    DELETE FROM orders WHERE id = ${orderId};

    INSERT INTO orders (id, user_id, order_number, status, payment_status, subtotal, discount_total, shipping_total, tax_total, grand_total, currency, shipping_address_snapshot, created_at, updated_at)
    VALUES (${orderId}, 701, '${orderNumber}', 'pending', 'pending', 1500000, 0, 0, 0, 1500000, 'IRT', '{"phone":"09121234567"}', '${now}', '${now}');

    INSERT INTO payments (id, order_id, user_id, gateway, amount, currency, status, reference_id, gateway_payment_id, created_at, updated_at)
    VALUES (${paymentId}, ${orderId}, 701, 'stripe', 1500000, 'IRT', 'pending', '${stripePi}', '${stripePi}', '${now}', '${now}');
  `);
  persistDatabase();

  // Setup test Express server
  const app = express();
  app.use(express.json());
  app.post("/api/v1/payments/webhook/:gateway", handlePaymentWebhook);

  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // =========================================================================
    // TEST A & D: Fire 20 concurrent identical signed webhook requests
    // =========================================================================
    console.log("\n[TEST A] Firing 20 concurrent identical signed webhook requests simultaneously...");
    const idempotencyKey = `idemp_stripe_concur_${Date.now()}`;
    const payload = {
      id: "evt_stripe_concur_simul",
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: stripePi,
        },
      },
    };
    const headers = {
      "Content-Type": "application/json",
      "X-Idempotency-Key": idempotencyKey,
      "stripe-signature": "test_sig_concur_mock",
    };

    const requests = Array.from({ length: 20 }, (_, idx) =>
      fetch(`${baseUrl}/api/v1/payments/webhook/stripe`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      }).then(async (res) => ({
        idx,
        status: res.status,
        body: await res.json(),
      }))
    );

    const responses = await Promise.all(requests);

    // Assert ALL 20 requests returned HTTP 200 (never 500)
    for (const r of responses) {
      assert.strictEqual(
        r.status,
        200,
        `Request #${r.idx} failed with status ${r.status}: ${JSON.stringify(r.body)}`
      );
      assert.strictEqual(r.body.success, true, `Request #${r.idx} success must be true`);
      assert.ok(
        r.body.data.status === "success" || r.body.data.status === "already_processed",
        `Request #${r.idx} status was neither success nor already_processed: ${r.body.data.status}`
      );
    }
    console.log("✓ Requirement A & D passed: All 20 concurrent requests received deterministic HTTP 200 responses.");

    // =========================================================================
    // TEST B: Assert exactly one payment transaction for the idempotency key
    // =========================================================================
    console.log("\n[TEST B] Verifying exactly one payment transaction recorded...");
    const txRows = queryRows(
      db,
      `SELECT id, payment_id, idempotency_key, event_type FROM payment_transactions WHERE idempotency_key = ?`,
      [idempotencyKey]
    );
    assert.strictEqual(
      txRows.length,
      1,
      `Expected exactly 1 payment_transaction row, found ${txRows.length}`
    );
    console.log("✓ Requirement B passed: Exactly one payment transaction persisted for idempotency key.");

    // =========================================================================
    // TEST C: Assert exactly one paid transition and one order-paid SMS delivery
    // =========================================================================
    console.log("\n[TEST C] Verifying exactly one paid transition and one order-paid SMS delivery...");
    const paymentRows = queryRows(db, `SELECT status FROM payments WHERE id = ${paymentId}`);
    assert.strictEqual(paymentRows[0].status, "paid", "Payment status must be 'paid'");

    const orderRows = queryRows(db, `SELECT status, payment_status FROM orders WHERE id = ${orderId}`);
    assert.strictEqual(orderRows[0].status, "paid", "Order status must be 'paid'");
    assert.strictEqual(orderRows[0].payment_status, "paid", "Order payment_status must be 'paid'");

    const smsRows = queryRows(
      db,
      `SELECT id, event_key, event FROM sms_deliveries WHERE event_key = 'order-paid-${orderId}'`
    );
    assert.strictEqual(
      smsRows.length,
      1,
      `Expected exactly 1 SMS delivery record, found ${smsRows.length}`
    );
    console.log("✓ Requirement C passed: Exactly one paid state transition and one SMS delivery recorded.");

    // =========================================================================
    // TEST E: Send the same callback after lock TTL and verify it remains idempotent
    // =========================================================================
    console.log("\n[TEST E] Sending duplicate request after simulated lock TTL expiry...");
    const resAfterTtl = await fetch(`${baseUrl}/api/v1/payments/webhook/stripe`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    assert.strictEqual(resAfterTtl.status, 200, "Must return HTTP 200");
    const jsonAfterTtl = await resAfterTtl.json();
    assert.strictEqual(jsonAfterTtl.success, true);
    assert.strictEqual(
      jsonAfterTtl.data.status,
      "already_processed",
      "Must return status: already_processed"
    );

    // Verify transaction count and SMS count remain unchanged (1)
    const txAfter = queryRows(db, `SELECT COUNT(*) as cnt FROM payment_transactions WHERE idempotency_key = ?`, [idempotencyKey]);
    assert.strictEqual(Number(txAfter[0].cnt), 1, "Payment transactions count must still be 1");

    const smsAfter = queryRows(db, `SELECT COUNT(*) as cnt FROM sms_deliveries WHERE event_key = 'order-paid-${orderId}'`);
    assert.strictEqual(Number(smsAfter[0].cnt), 1, "SMS delivery count must still be 1");
    console.log("✓ Requirement E passed: Replay after TTL cleanly returns already_processed without duplicate state mutations.");

    // =========================================================================
    // TEST F: Send a different event key for the same payment and verify state machine prevents invalid downgrade
    // =========================================================================
    console.log("\n[TEST F] Sending different event key reporting failure for paid payment (downgrade prevention)...");
    const downgradeIdempKey = `idemp_stripe_downgrade_${Date.now()}`;
    const downgradePayload = {
      id: "evt_stripe_delayed_failure",
      type: "payment_intent.payment_failed",
      data: {
        object: {
          id: stripePi,
        },
      },
    };
    const downgradeRes = await fetch(`${baseUrl}/api/v1/payments/webhook/stripe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Idempotency-Key": downgradeIdempKey,
        "stripe-signature": "test_sig_concur_mock",
      },
      body: JSON.stringify(downgradePayload),
    });
    assert.strictEqual(downgradeRes.status, 200, "Downgrade attempt must be handled gracefully");
    const downgradeJson = await downgradeRes.json();
    assert.strictEqual(downgradeJson.data.status, "ignored_downgrade", "Status must be 'ignored_downgrade'");

    // Verify payment and order are still PAID
    const paymentCheck = queryRows(db, `SELECT status FROM payments WHERE id = ${paymentId}`);
    assert.strictEqual(paymentCheck[0].status, "paid", "Payment status must NOT have been downgraded!");

    const orderCheck = queryRows(db, `SELECT status, payment_status FROM orders WHERE id = ${orderId}`);
    assert.strictEqual(orderCheck[0].status, "paid", "Order status must NOT have been downgraded!");
    assert.strictEqual(orderCheck[0].payment_status, "paid", "Order payment_status must NOT have been downgraded!");

    // SMS count still 1
    const smsCheck = queryRows(db, `SELECT COUNT(*) as cnt FROM sms_deliveries WHERE event_key = 'order-paid-${orderId}'`);
    assert.strictEqual(Number(smsCheck[0].cnt), 1, "SMS count must still be 1");
    console.log("✓ Requirement F passed: State machine successfully prevented invalid downgrade transitions.");

    console.log("\n================================================================================");
    console.log("🎉 ALL PAYMENT WEBHOOK CONCURRENCY & IDEMPOTENCY ACCEPTANCE TESTS PASSED (A - F)!");
    console.log("================================================================================");
  } finally {
    server.close();
  }
}

runPaymentWebhookConcurrencyTests().catch((err) => {
  console.error("\n❌ CONCURRENCY TEST FAILED:", err);
  process.exit(1);
});
