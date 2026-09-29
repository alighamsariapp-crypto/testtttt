import express from "express";
import { Server } from "http";
import { getDatabase, persistDatabase, queryRows } from "../../src/server/db";
import { handleAdminUpdateOrderStatus } from "../../src/server/adminRoutes";
import { handleCancelOrder } from "../../src/server/orderRoutes";
import { setZibalHttpClient } from "../../src/server/services/zibalService";
import { processOrderRefund, reconcileUnknownRefund } from "../../src/server/services/refundService";

async function runConcurrencyTests() {
  console.log("===============================================================");
  console.log("=== Starting Phase 1.1-R1: Concurrency & Lifecycle Tests    ===");
  console.log("===============================================================");

  const db = await getDatabase();
  const now = new Date().toISOString();

  // Setup deterministic test users
  db.run(`
    INSERT OR IGNORE INTO users (id, name, email, phone, password, role, status, created_at, updated_at)
    VALUES
      (921, 'کاربر همزمانی', 'concurrency_user@apexstore.local', '09129210001', 'hash', 'customer', 'active', '${now}', '${now}'),
      (922, 'مدیر همزمانی', 'concurrency_admin@apexstore.local', '09129210002', 'hash', 'admin', 'active', '${now}', '${now}');

    INSERT OR IGNORE INTO personal_access_tokens (id, tokenable_type, tokenable_id, name, token, abilities, created_at, updated_at)
    VALUES
      (921, 'App\\\\Modules\\\\Users\\\\Models\\\\User', 921, 'test-token-921', 'token_921', '["*"]', '${now}', '${now}'),
      (922, 'App\\\\Modules\\\\Users\\\\Models\\\\User', 922, 'test-token-922', 'token_922', '["*"]', '${now}', '${now}');
  `);
  persistDatabase();

  // Setup express test server
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.patch("/api/v1/admin/orders/:id/status", handleAdminUpdateOrderStatus);
  app.post("/api/v1/orders/:id/cancel", handleCancelOrder);

  const server: Server = await new Promise((resolve) => {
    const s = app.listen(3098, () => resolve(s));
  });

  const baseUrl = "http://127.0.0.1:3098";

  try {
    // -------------------------------------------------------------
    // TEST A: CONCURRENT ZIBAL REFUND
    // -------------------------------------------------------------
    console.log("\n--- [TEST A] Concurrent Zibal Refund ---");
    const orderAId = 8901;
    const paymentAId = 8901;
    const trackIdA = 995001;
    const amountA = 400000;

    db.run(`
      DELETE FROM payment_transactions WHERE payment_id = ${paymentAId} OR order_id = ${orderAId};
      DELETE FROM wallet_transactions WHERE order_id = ${orderAId};

      INSERT OR REPLACE INTO orders (id, order_number, user_id, status, payment_status, subtotal, grand_total, currency, shipping_address_snapshot, is_inventory_restored, created_at, updated_at)
      VALUES (${orderAId}, 'ORD-CONC-8901', 921, 'paid', 'paid', ${amountA}, ${amountA}, 'IRR', '{}', 0, '${now}', '${now}');

      INSERT OR REPLACE INTO payments (id, order_id, user_id, gateway, amount, currency, status, reference_id, gateway_payment_id, created_at, updated_at)
      VALUES (${paymentAId}, ${orderAId}, 921, 'zibal', ${amountA}, 'IRR', 'paid', '${trackIdA}', '${trackIdA}', '${now}', '${now}');
    `);
    persistDatabase();

    let zibalCallCountA = 0;
    setZibalHttpClient(async (endpoint: string, payload: Record<string, any>) => {
      if (endpoint === "/v1/refund") {
        zibalCallCountA++;
        // Add a 50ms delay to simulate network latency and ensure overlap
        await new Promise((r) => setTimeout(r, 50));
        return { result: 100, message: "Refund successful", trackId: payload.trackId };
      }
      return { result: 100 };
    });

    // Fire 5 simultaneous requests to refund the same Zibal payment
    const responsesA = await Promise.all(
      Array.from({ length: 5 }).map(() =>
        fetch(`${baseUrl}/api/v1/admin/orders/${orderAId}/status`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer token_922",
          },
          body: JSON.stringify({ status: "refunded" }),
        })
      )
    );

    const jsonResultsA = await Promise.all(responsesA.map((r) => r.json()));

    // Verify exactly 1 call was made to Zibal
    if (zibalCallCountA !== 1) {
      throw new Error(`Test A FAILED: Zibal API called ${zibalCallCountA} times! Expected exactly 1.`);
    }

    // Verify exactly 1 successful refund transaction was recorded
    const successfulTxA = queryRows(
      db,
      "SELECT * FROM payment_transactions WHERE order_id = ? AND event_type = 'refund' AND status = 'successful'",
      [orderAId]
    );
    if (successfulTxA.length !== 1) {
      throw new Error(`Test A FAILED: Expected exactly 1 successful refund tx, found ${successfulTxA.length}`);
    }

    // Verify order and payment final status
    const finalOrderA = queryRows(db, "SELECT status, payment_status FROM orders WHERE id = ?", [orderAId])[0];
    const finalPaymentA = queryRows(db, "SELECT status FROM payments WHERE id = ?", [paymentAId])[0];
    if (finalOrderA.status !== "refunded" || finalPaymentA.status !== "refunded") {
      throw new Error(`Test A FAILED: Order or payment status mismatch: order=${finalOrderA.status}, payment=${finalPaymentA.status}`);
    }

    console.log(`✓ Test A PASSED: 5 concurrent Zibal requests resulted in exactly 1 gateway call and 1 transaction.`);

    // -------------------------------------------------------------
    // TEST B: CONCURRENT WALLET REFUND
    // -------------------------------------------------------------
    console.log("\n--- [TEST B] Concurrent Wallet Refund ---");
    const orderBId = 8902;
    const paymentBId = 8902;
    const amountB = 300000;

    db.run(`
      DELETE FROM payment_transactions WHERE payment_id = ${paymentBId} OR order_id = ${orderBId};
      DELETE FROM wallet_transactions WHERE order_id = ${orderBId};

      INSERT OR REPLACE INTO orders (id, order_number, user_id, status, payment_status, subtotal, grand_total, currency, shipping_address_snapshot, is_inventory_restored, created_at, updated_at)
      VALUES (${orderBId}, 'ORD-CONC-8902', 921, 'paid', 'paid', ${amountB}, ${amountB}, 'IRR', '{}', 0, '${now}', '${now}');

      INSERT OR REPLACE INTO payments (id, order_id, user_id, gateway, amount, currency, status, reference_id, created_at, updated_at)
      VALUES (${paymentBId}, ${orderBId}, 921, 'wallet', ${amountB}, 'IRR', 'paid', 'WAL-TX-8902', '${now}', '${now}');
    `);
    persistDatabase();

    // Fire 5 simultaneous requests to refund the same wallet order
    const responsesB = await Promise.all(
      Array.from({ length: 5 }).map(() =>
        fetch(`${baseUrl}/api/v1/admin/orders/${orderBId}/status`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer token_922",
          },
          body: JSON.stringify({ status: "refunded" }),
        })
      )
    );

    const jsonResultsB = await Promise.all(responsesB.map((r) => r.json()));

    // Verify wallet transactions
    const walletTxB = queryRows(
      db,
      "SELECT * FROM wallet_transactions WHERE order_id = ? AND type = 'refund' AND status = 'successful'",
      [orderBId]
    );
    if (walletTxB.length !== 1) {
      throw new Error(`Test B FAILED: Expected exactly 1 wallet refund transaction, found ${walletTxB.length}`);
    }

    const totalWalletRefundedB = Number(walletTxB[0].amount);
    if (totalWalletRefundedB !== amountB) {
      throw new Error(`Test B FAILED: Expected wallet refund of ${amountB}, found ${totalWalletRefundedB}`);
    }

    console.log(`✓ Test B PASSED: 5 concurrent wallet refund requests resulted in exactly 1 credit of ${amountB} IRR.`);

    // -------------------------------------------------------------
    // TEST C: GATEWAY REFUND FAILURE & LIFECYCLE CONSISTENCY
    // -------------------------------------------------------------
    console.log("\n--- [TEST C] Gateway Refund Failure ---");
    const orderCId = 8903;
    const paymentCId = 8903;
    const trackIdC = 995003;
    const amountC = 500000;

    db.run(`
      DELETE FROM payment_transactions WHERE payment_id = ${paymentCId} OR order_id = ${orderCId};
      DELETE FROM wallet_transactions WHERE order_id = ${orderCId};

      INSERT OR REPLACE INTO orders (id, order_number, user_id, status, payment_status, subtotal, grand_total, currency, shipping_address_snapshot, is_inventory_restored, created_at, updated_at)
      VALUES (${orderCId}, 'ORD-CONC-8903', 921, 'paid', 'paid', ${amountC}, ${amountC}, 'IRR', '{}', 0, '${now}', '${now}');

      INSERT OR REPLACE INTO payments (id, order_id, user_id, gateway, amount, currency, status, reference_id, gateway_payment_id, created_at, updated_at)
      VALUES (${paymentCId}, ${orderCId}, 921, 'zibal', ${amountC}, 'IRR', 'paid', '${trackIdC}', '${trackIdC}', '${now}', '${now}');
    `);
    persistDatabase();

    // Mock Zibal returning an explicit failure
    setZibalHttpClient(async (endpoint: string, payload: Record<string, any>) => {
      if (endpoint === "/v1/refund") {
        return { result: 500, message: "موجودی درگاه کافی نیست یا خطا رخ داده است" };
      }
      return { result: 100 };
    });

    const resC = await fetch(`${baseUrl}/api/v1/admin/orders/${orderCId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer token_922",
      },
      body: JSON.stringify({ status: "refunded" }),
    });

    const jsonC = await resC.json();
    if (jsonC.success) {
      throw new Error(`Test C FAILED: Gateway failure should have rejected the transition! Got success.`);
    }

    // Verify order and payment status: must NOT be refunded!
    const orderCAfter = queryRows(db, "SELECT status, payment_status FROM orders WHERE id = ?", [orderCId])[0];
    const paymentCAfter = queryRows(db, "SELECT status FROM payments WHERE id = ?", [paymentCId])[0];

    if (orderCAfter.status === "refunded" || orderCAfter.payment_status === "refunded") {
      throw new Error(`Test C FAILED: Order was incorrectly marked as refunded after gateway failure!`);
    }

    if (paymentCAfter.status === "refunded") {
      throw new Error(`Test C FAILED: Payment was incorrectly marked as refunded after gateway failure!`);
    }

    // Must be in retryable 'refund_failed' status
    if (paymentCAfter.status !== "refund_failed") {
      throw new Error(`Test C FAILED: Expected payment status 'refund_failed', found '${paymentCAfter.status}'`);
    }

    // Must have recorded a failed transaction record for auditability
    const failedTxC = queryRows(
      db,
      "SELECT * FROM payment_transactions WHERE order_id = ? AND event_type = 'refund' AND status = 'failed'",
      [orderCId]
    );
    if (failedTxC.length !== 1) {
      throw new Error(`Test C FAILED: Expected exactly 1 failed transaction record, found ${failedTxC.length}`);
    }

    // Zero fake wallet credits
    const walletTxC = queryRows(db, "SELECT * FROM wallet_transactions WHERE order_id = ?", [orderCId]);
    if (walletTxC.length > 0) {
      throw new Error(`Test C FAILED: Fake wallet credit was illegally created on gateway refund failure!`);
    }

    console.log(`✓ Test C PASSED: Gateway failure properly handled without false-positive status or fake wallet credits.`);

    // -------------------------------------------------------------
    // TEST D: CRASH / RECOVERY SIMULATION
    // -------------------------------------------------------------
    console.log("\n--- [TEST D] Crash / Recovery Simulation ---");
    const orderDId = 8904;
    const paymentDId = 8904;
    const trackIdD = 995004;
    const amountD = 600000;

    // Simulate crash scenario: status got stuck in 'refund_processing' during an interrupted previous process
    db.run(`
      DELETE FROM payment_transactions WHERE payment_id = ${paymentDId} OR order_id = ${orderDId};
      DELETE FROM wallet_transactions WHERE order_id = ${orderDId};

      INSERT OR REPLACE INTO orders (id, order_number, user_id, status, payment_status, subtotal, grand_total, currency, shipping_address_snapshot, is_inventory_restored, created_at, updated_at)
      VALUES (${orderDId}, 'ORD-CONC-8904', 921, 'paid', 'paid', ${amountD}, ${amountD}, 'IRR', '{}', 0, '${now}', '${now}');

      INSERT OR REPLACE INTO payments (id, order_id, user_id, gateway, amount, currency, status, reference_id, gateway_payment_id, created_at, updated_at)
      VALUES (${paymentDId}, ${orderDId}, 921, 'zibal', ${amountD}, 'IRR', 'refund_processing', '${trackIdD}', '${trackIdD}', '${now}', '${now}');
    `);
    persistDatabase();

    let zibalCallCountD = 0;
    setZibalHttpClient(async (endpoint: string, payload: Record<string, any>) => {
      if (endpoint === "/v1/refund") {
        zibalCallCountD++;
        return { result: 100, message: "Refund completed successfully on recovery" };
      }
      return { result: 100 };
    });

    // Recovery runs - in R2, stale refund_processing must NOT blindly retry external gateway!
    const recoveryResultD = await processOrderRefund({
      orderId: orderDId,
      forceRecovery: true,
      adminUserId: 922,
      reason: "crash_recovery_retry",
    });

    if (recoveryResultD.error !== "RECONCILIATION_REQUIRED") {
      throw new Error(`Test D FAILED: Expected RECONCILIATION_REQUIRED, got: ${recoveryResultD.error}`);
    }

    if (zibalCallCountD !== 0) {
      throw new Error(`Test D FAILED: System blindly called Zibal on stale refund_processing (${zibalCallCountD} times)`);
    }

    const paymentDAfterQuarantine = queryRows(db, "SELECT status FROM payments WHERE id = ?", [paymentDId])[0];
    if (paymentDAfterQuarantine.status !== "refund_unknown") {
      throw new Error(`Test D FAILED: Status after crash detection should be 'refund_unknown', got: ${paymentDAfterQuarantine.status}`);
    }

    // Now administrator safely reconciles the ambiguous transaction
    const adminReconcileResult = await reconcileUnknownRefund({
      orderId: orderDId,
      decision: "confirmed_success",
      adminUserId: 922,
      notes: "تطبیق تایید استرداد در پرتال زیبال",
    });

    if (!adminReconcileResult.success) {
      throw new Error(`Test D FAILED: Admin reconciliation failed: ${adminReconcileResult.message}`);
    }

    const orderDAfter = queryRows(db, "SELECT status, payment_status FROM orders WHERE id = ?", [orderDId])[0];
    const paymentDAfter = queryRows(db, "SELECT status FROM payments WHERE id = ?", [paymentDId])[0];

    if (orderDAfter.status !== "refunded" || paymentDAfter.status !== "refunded") {
      throw new Error(`Test D FAILED: Final status after recovery is not refunded: order=${orderDAfter.status}, payment=${paymentDAfter.status}`);
    }

    console.log(`✓ Test D PASSED: Interrupted 'refund_processing' quarantined to 'refund_unknown' and reconciled cleanly without blind gateway retry.`);

    // -------------------------------------------------------------
    // TEST E: PARTIAL DATABASE FAILURE RECOVERY
    // -------------------------------------------------------------
    console.log("\n--- [TEST E] Partial Database Failure Recovery ---");
    const orderEId = 8905;
    const paymentEId = 8905;
    const trackIdE = 995005;
    const amountE = 700000;

    // Simulate scenario: External gateway succeeded and transaction record was written,
    // but the DB crashed or failed before payments/orders status could be updated from 'paid' to 'refunded'.
    db.run(`
      DELETE FROM payment_transactions WHERE payment_id = ${paymentEId} OR order_id = ${orderEId};
      DELETE FROM wallet_transactions WHERE order_id = ${orderEId};

      INSERT OR REPLACE INTO orders (id, order_number, user_id, status, payment_status, subtotal, grand_total, currency, shipping_address_snapshot, is_inventory_restored, created_at, updated_at)
      VALUES (${orderEId}, 'ORD-CONC-8905', 921, 'paid', 'paid', ${amountE}, ${amountE}, 'IRR', '{}', 0, '${now}', '${now}');

      INSERT OR REPLACE INTO payments (id, order_id, user_id, gateway, amount, currency, status, reference_id, gateway_payment_id, created_at, updated_at)
      VALUES (${paymentEId}, ${orderEId}, 921, 'zibal', ${amountE}, 'IRR', 'paid', '${trackIdE}', '${trackIdE}', '${now}', '${now}');

      INSERT INTO payment_transactions (payment_id, order_id, gateway, event_type, status, amount, currency, reference_id, idempotency_key, payload, created_at)
      VALUES (${paymentEId}, ${orderEId}, 'zibal', 'refund', 'successful', ${amountE}, 'IRR', '${trackIdE}', 'zibal_partial_fail_test', '{"result":100}', '${now}');
    `);
    persistDatabase();

    let zibalCalledE = false;
    setZibalHttpClient(async (endpoint: string, payload: Record<string, any>) => {
      if (endpoint === "/v1/refund") {
        zibalCalledE = true;
        return { result: 100, message: "Duplicate external call should NOT happen!" };
      }
      return { result: 100 };
    });

    // Retry the refund
    const resultE = await processOrderRefund({
      orderId: orderEId,
      adminUserId: 922,
      reason: "reconcile_partial_failure",
    });

    if (!resultE.isSuccessful) {
      throw new Error(`Test E FAILED: Reconcile execution failed: ${resultE.message}`);
    }

    if (zibalCalledE) {
      throw new Error(`Test E FAILED: External gateway was called again despite confirmed prior transaction!`);
    }

    if (!resultE.reconciled) {
      throw new Error(`Test E FAILED: Result was not marked as reconciled!`);
    }

    const orderEAfter = queryRows(db, "SELECT status, payment_status FROM orders WHERE id = ?", [orderEId])[0];
    const paymentEAfter = queryRows(db, "SELECT status FROM payments WHERE id = ?", [paymentEId])[0];

    if (orderEAfter.status !== "refunded" || paymentEAfter.status !== "refunded") {
      throw new Error(`Test E FAILED: Final status after reconciliation is not refunded: order=${orderEAfter.status}, payment=${paymentEAfter.status}`);
    }

    console.log(`✓ Test E PASSED: Partial failure reconciled without duplicate external gateway call.`);

    console.log("\n===============================================================");
    console.log("=== ALL 5 CONCURRENCY & LIFECYCLE TESTS PASSED WITH 100%!   ===");
    console.log("===============================================================");
  } finally {
    server.close();
  }
}

runConcurrencyTests().catch((err) => {
  console.error("❌ CONCURRENCY TEST SUITE FAILED:", err);
  process.exit(1);
});
