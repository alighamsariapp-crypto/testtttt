import crypto from "crypto";
import { queryRows, recordAuditLog, persistDatabase, getDatabase } from "../db";
import { refundZibalPayment } from "./zibalService";
import { restoreOrderInventory } from "../adminRoutes";

export interface RefundableInfo {
  isPaid: boolean;
  paidAmount: number;
  refundedAmount: number;
  refundableAmount: number;
  currency: string;
  gateway: string;
  payment: any;
}

export interface ProcessRefundOptions {
  orderId: number;
  paymentId?: number;
  amount?: number;
  reason?: string;
  adminUserId?: number;
  userId?: number;
  forceRecovery?: boolean;
}

export interface RefundResult {
  success: boolean;
  isSuccessful: boolean;
  gateway: string;
  refundedAmount: number;
  remainingRefundable: number;
  status: string;
  reference?: string;
  message: string;
  error?: string;
  isDuplicate?: boolean;
  reconciled?: boolean;
}

export interface ReconcileRefundOptions {
  orderId: number;
  paymentId?: number;
  decision: "confirmed_success" | "confirmed_failure";
  adminUserId: number;
  notes?: string;
  externalReference?: string;
}

// In-memory mutex for in-flight refund requests in the current node process (process-level debounce)
const inFlightRefundPromises = new Map<number, Promise<RefundResult>>();

// Test seam: simulate claim-record insertion failure for atomic claim rollback verification (TEST 1)
let simulatedClaimRecordFailure = false;

export function setSimulatedClaimRecordFailure(enable: boolean): void {
  simulatedClaimRecordFailure = enable;
}

// Test seam: simulate database failure during reconciliation (TEST F)
let simulatedReconcileDbFailure = false;

export function setSimulatedReconcileDbFailure(enable: boolean): void {
  simulatedReconcileDbFailure = enable;
}

/**
 * Accurately calculate the refundable amount for an order/payment.
 * Authoritative: based on actual successfully paid amount minus already refunded amount.
 * Client-provided amounts are never trusted.
 */
export function calculateRefundableAmount(db: any, orderId: number, paymentId?: number): RefundableInfo {
  let payment: any = null;

  if (paymentId) {
    const rows = queryRows(
      db,
      `SELECT id, order_id, user_id, gateway, amount, currency, status, reference_id, gateway_payment_id
       FROM payments WHERE id = ? AND order_id = ? LIMIT 1`,
      [paymentId, orderId]
    );
    payment = rows.length > 0 ? rows[0] : null;
  } else {
    const rows = queryRows(
      db,
      `SELECT id, order_id, user_id, gateway, amount, currency, status, reference_id, gateway_payment_id
       FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1`,
      [orderId]
    );
    payment = rows.length > 0 ? rows[0] : null;
  }

  if (!payment) {
    return {
      isPaid: false,
      paidAmount: 0,
      refundedAmount: 0,
      refundableAmount: 0,
      currency: "IRR",
      gateway: "",
      payment: null,
    };
  }

  const validPaidStatuses = ["paid", "refund_pending", "refund_processing", "refund_unknown", "refund_failed", "refunded"];
  const isPaid = validPaidStatuses.includes(String(payment.status || "").toLowerCase());

  if (!isPaid) {
    return {
      isPaid: false,
      paidAmount: 0,
      refundedAmount: 0,
      refundableAmount: 0,
      currency: payment.currency || "IRR",
      gateway: payment.gateway,
      payment,
    };
  }

  const paidAmount = Math.max(0, Math.floor(Number(payment.amount || 0)));
  let refundedAmount = 0;

  if (payment.gateway === "wallet") {
    const res = queryRows(
      db,
      `SELECT COALESCE(SUM(amount), 0) AS total_refunded
       FROM wallet_transactions
       WHERE order_id = ? AND type = 'refund' AND status = 'successful'`,
      [orderId]
    );
    refundedAmount = Math.max(0, Math.floor(Number(res[0]?.total_refunded || 0)));
  } else {
    const res = queryRows(
      db,
      `SELECT COALESCE(SUM(amount), 0) AS total_refunded
       FROM payment_transactions
       WHERE payment_id = ? AND event_type = 'refund' AND status = 'successful'`,
      [payment.id]
    );
    refundedAmount = Math.max(0, Math.floor(Number(res[0]?.total_refunded || 0)));
  }

  const refundableAmount = Math.max(0, paidAmount - refundedAmount);

  return {
    isPaid: true,
    paidAmount,
    refundedAmount,
    refundableAmount,
    currency: payment.currency || "IRR",
    gateway: payment.gateway,
    payment,
  };
}

/**
 * Centrally and safely process an order refund.
 * Guarantees:
 * 1. Transactional Atomic Claim: Payment claim and claim record occur in a single database transaction.
 * 2. Crash & Ambiguous Outcome Safety: Distinguishes SUCCESS, FAILURE, and UNKNOWN.
 * 3. Full Refund Only: Disallows partial refunds to protect financial integrity.
 * 4. Reconciliation Required: Ambiguous or crashed external states are quarantined in 'refund_unknown'.
 */
export async function processOrderRefund(options: ProcessRefundOptions): Promise<RefundResult> {
  const { orderId, paymentId, amount, reason, adminUserId, userId, forceRecovery } = options;
  const db = await getDatabase();
  const now = new Date().toISOString();

  // 1. Calculate authoritative refundable amount from database
  const info = calculateRefundableAmount(db, orderId, paymentId);
  const payment = info.payment;

  if (!payment || !info.isPaid) {
    return {
      success: false,
      isSuccessful: false,
      gateway: info.gateway,
      refundedAmount: 0,
      remainingRefundable: 0,
      status: payment ? payment.status : "unknown",
      message: "سفارش پرداخت نشده است یا رکوردی برای استرداد یافت نشد.",
      error: "ORDER_NOT_PAID",
    };
  }

  // 2. Enforce Full Refund Only mode (Phase 1.1-R2)
  if (amount !== undefined) {
    const requestedAmount = Number(amount);
    if (isNaN(requestedAmount) || requestedAmount <= 0) {
      return {
        success: false,
        isSuccessful: false,
        gateway: payment.gateway,
        refundedAmount: 0,
        remainingRefundable: info.refundableAmount,
        status: payment.status,
        message: "مبلغ استرداد نامعتبر است. مبلغ باید مقداری مثبت باشد.",
        error: "INVALID_REFUND_AMOUNT",
      };
    }

    if (requestedAmount > info.refundableAmount) {
      return {
        success: false,
        isSuccessful: false,
        gateway: payment.gateway,
        refundedAmount: 0,
        remainingRefundable: info.refundableAmount,
        status: payment.status,
        message: `مبلغ درخواستی (${requestedAmount}) بیشتر از کل مبلغ قابل استرداد (${info.refundableAmount}) است.`,
        error: "REFUND_AMOUNT_EXCEEDS_REFUNDABLE",
      };
    }

    if (requestedAmount < info.refundableAmount) {
      // Partial refund rejected!
      return {
        success: false,
        isSuccessful: false,
        gateway: payment.gateway,
        refundedAmount: 0,
        remainingRefundable: info.refundableAmount,
        status: payment.status,
        message: `استرداد جزئی مجاز نیست. کل مبلغ قابل استرداد (${info.refundableAmount} ریال) باید مسترد شود.`,
        error: "PARTIAL_REFUND_NOT_SUPPORTED",
      };
    }
  }

  // Authoritative amount to refund
  const amountToRefund = info.refundableAmount;

  // 3. If already fully refunded in ledger, reconcile if needed and return idempotent success
  if (info.refundableAmount <= 0) {
    if (payment.status !== "refunded") {
      db.run(`UPDATE payments SET status = 'refunded', updated_at = ? WHERE id = ?`, [now, payment.id]);
      db.run(`UPDATE orders SET status = 'refunded', payment_status = 'refunded', updated_at = ? WHERE id = ?`, [now, orderId]);
      await persistDatabase();

      recordAuditLog(db, {
        userId: adminUserId || userId,
        action: "refund_reconciled_from_confirmed_ledger",
        entityType: "order",
        entityId: orderId,
        metadata: { payment_id: payment.id, gateway: payment.gateway, refunded_amount: info.refundedAmount },
      });

      return {
        success: true,
        isSuccessful: true,
        gateway: payment.gateway,
        refundedAmount: 0,
        remainingRefundable: 0,
        status: "refunded",
        message: "استرداد وجه قبلاً در دفاتر مالی ثبت شده بود و وضعیت سفارش همگام‌سازی شد.",
        reconciled: true,
      };
    }

    return {
      success: true,
      isSuccessful: true,
      gateway: payment.gateway,
      refundedAmount: 0,
      remainingRefundable: 0,
      status: "refunded",
      message: "این سفارش قبلاً به‌طور کامل مسترد شده است.",
      isDuplicate: true,
    };
  }

  // 4. Safe handling for 'refund_unknown' state
  if (payment.status === "refund_unknown") {
    // Check if authoritative ledger has a confirmed successful refund
    const confirmedTx = queryRows(
      db,
      `SELECT id, reference_id FROM payment_transactions WHERE payment_id = ? AND event_type = 'refund' AND status = 'successful' LIMIT 1`,
      [payment.id]
    );

    if (confirmedTx.length > 0) {
      db.run(`UPDATE payments SET status = 'refunded', updated_at = ? WHERE id = ?`, [now, payment.id]);
      db.run(`UPDATE orders SET status = 'refunded', payment_status = 'refunded', updated_at = ? WHERE id = ?`, [now, orderId]);
      await persistDatabase();
      return {
        success: true,
        isSuccessful: true,
        gateway: payment.gateway,
        refundedAmount: amountToRefund,
        remainingRefundable: 0,
        status: "refunded",
        reference: confirmedTx[0].reference_id,
        message: "استرداد وجه قبلاً توسط درگاه تایید شده بود و وضعیت سفارش همگام‌سازی شد.",
        reconciled: true,
      };
    }

    // Do NOT blindly call Zibal again! Require explicit admin reconciliation.
    return {
      success: false,
      isSuccessful: false,
      gateway: payment.gateway,
      refundedAmount: 0,
      remainingRefundable: info.refundableAmount,
      status: "refund_unknown",
      message: "وضعیت استرداد این سفارش نامشخص است (احتمال کسر از درگاه). جهت جلوگیری از استرداد دوبل، تطبیق دستی توسط مدیر الزامی است.",
      error: "RECONCILIATION_REQUIRED",
    };
  }

  // 5. Safe handling for stale 'refund_processing' state (e.g. server crash during processing)
  if (payment.status === "refund_processing") {
    // Check if authoritative ledger has a confirmed successful refund
    const confirmedTx = queryRows(
      db,
      `SELECT id, reference_id FROM payment_transactions WHERE payment_id = ? AND event_type = 'refund' AND status = 'successful' LIMIT 1`,
      [payment.id]
    );

    if (confirmedTx.length > 0) {
      db.run(`UPDATE payments SET status = 'refunded', updated_at = ? WHERE id = ?`, [now, payment.id]);
      db.run(`UPDATE orders SET status = 'refunded', payment_status = 'refunded', updated_at = ? WHERE id = ?`, [now, orderId]);
      await persistDatabase();
      return {
        success: true,
        isSuccessful: true,
        gateway: payment.gateway,
        refundedAmount: amountToRefund,
        remainingRefundable: 0,
        status: "refunded",
        reference: confirmedTx[0].reference_id,
        message: "استرداد وجه قبلاً توسط درگاه تایید شده بود و وضعیت سفارش همگام‌سازی شد.",
        reconciled: true,
      };
    }

    // If an in-flight promise is active in THIS process, wait for it
    if (inFlightRefundPromises.has(payment.id)) {
      const inFlightPromise = inFlightRefundPromises.get(payment.id)!;
      const result = await inFlightPromise;
      return {
        ...result,
        isDuplicate: true,
        message: result.isSuccessful
          ? "استرداد وجه توسط درخواست همزمان با موفقیت انجام شد."
          : "استرداد وجه توسط درخواست همزمان انجام شد: " + result.message,
      };
    }

    // Otherwise, this is a stale refund_processing from a crashed process or dead worker.
    // DO NOT blindly retry external refund! Transition to 'refund_unknown' to require reconciliation.
    db.run(`UPDATE payments SET status = 'refund_unknown', updated_at = ? WHERE id = ?`, [now, payment.id]);
    const unknownKey = `refund_unknown_crash_${payment.id}_${Date.now()}`;
    db.run(
      `INSERT INTO payment_transactions (
        payment_id, order_id, gateway, event_type, status, amount, currency, reference_id, idempotency_key, payload, created_at
      ) VALUES (?, ?, ?, 'refund', 'unknown', ?, ?, ?, ?, ?, ?)
      ON CONFLICT (idempotency_key) DO NOTHING`,
      [
        payment.id,
        orderId,
        payment.gateway,
        amountToRefund,
        info.currency,
        payment.gateway_payment_id || payment.reference_id,
        unknownKey,
        JSON.stringify({ reason: "stale_refund_processing_from_crash", previous_status: "refund_processing", detected_at: now }),
        now,
      ]
    );
    await persistDatabase();

    return {
      success: false,
      isSuccessful: false,
      gateway: payment.gateway,
      refundedAmount: 0,
      remainingRefundable: info.refundableAmount,
      status: "refund_unknown",
      message: "فرآیند استرداد قبلی به دلیل توقف سرور یا قطعی ناتمام ماند. وضعیت به 'refund_unknown' تغییر یافت تا از استرداد تکراری جلوگیری شود. تطبیق مدیر الزامی است.",
      error: "RECONCILIATION_REQUIRED",
    };
  }

  // 6. Check if another request in the current process is processing this payment
  if (inFlightRefundPromises.has(payment.id)) {
    const inFlightPromise = inFlightRefundPromises.get(payment.id)!;
    const result = await inFlightPromise;
    return {
      ...result,
      isDuplicate: true,
      message: result.isSuccessful
        ? "استرداد وجه توسط درخواست همزمان با موفقیت انجام شد."
        : "استرداد وجه توسط درخواست همزمان انجام شد: " + result.message,
    };
  }

  // 7. Process-level mutex tracking
  const refundExecution = (async (): Promise<RefundResult> => {
    try {
      return await executeRefund(db, orderId, payment, info, amountToRefund, options, now);
    } finally {
      inFlightRefundPromises.delete(payment.id);
    }
  })();

  inFlightRefundPromises.set(payment.id, refundExecution);
  return await refundExecution;
}

/**
 * Execute the atomic claim and gateway refund.
 */
async function executeRefund(
  db: any,
  orderId: number,
  payment: any,
  info: RefundableInfo,
  amountToRefund: number,
  options: ProcessRefundOptions,
  now: string
): Promise<RefundResult> {
  const { reason, adminUserId, userId } = options;

  // -------------------------------------------------------------
  // ISSUE 1: ATOMIC DATABASE-LEVEL CLAIM IN ONE TRANSACTION
  // -------------------------------------------------------------
  const claimResult = claimRefundTransaction(
    db,
    payment.id,
    orderId,
    payment.gateway,
    amountToRefund,
    info.currency,
    payment.gateway_payment_id || payment.reference_id,
    reason || "order_refund",
    now
  );

  if (!claimResult.claimed) {
    // Claim failed or was claimed concurrently
    const currentPaymentRows = queryRows(db, `SELECT status FROM payments WHERE id = ?`, [payment.id]);
    const currentStatus = currentPaymentRows[0]?.status || "unknown";

    if (currentStatus === "refunded") {
      return {
        success: true,
        isSuccessful: true,
        gateway: payment.gateway,
        refundedAmount: 0,
        remainingRefundable: 0,
        status: "refunded",
        message: "این سفارش قبلاً مسترد شده است.",
        isDuplicate: true,
      };
    }

    if (currentStatus === "refund_processing") {
      return {
        success: false,
        isSuccessful: false,
        gateway: payment.gateway,
        refundedAmount: 0,
        remainingRefundable: info.refundableAmount,
        status: "refund_processing",
        message: "استرداد وجه این سفارش در حال حاضر در حال پردازش است.",
        error: "REFUND_ALREADY_PROCESSING",
        isDuplicate: true,
      };
    }

    if (currentStatus === "refund_unknown") {
      return {
        success: false,
        isSuccessful: false,
        gateway: payment.gateway,
        refundedAmount: 0,
        remainingRefundable: info.refundableAmount,
        status: "refund_unknown",
        message: "وضعیت استرداد نامشخص است. تطبیق مدیر الزامی است.",
        error: "RECONCILIATION_REQUIRED",
      };
    }

    return {
      success: false,
      isSuccessful: false,
      gateway: payment.gateway,
      refundedAmount: 0,
      remainingRefundable: info.refundableAmount,
      status: currentStatus,
      message: claimResult.error || `وضعیت پرداخت برای استرداد معتبر نیست (${currentStatus}).`,
      error: claimResult.reason || "INVALID_PAYMENT_STATUS_FOR_REFUND",
    };
  }

  // -------------------------------------------------------------
  // ROUTE TO APPROPRIATE GATEWAY HANDLER
  // -------------------------------------------------------------
  if (payment.gateway === "wallet") {
    return executeWalletRefund(db, orderId, payment, amountToRefund, options, now);
  } else if (payment.gateway === "zibal" || payment.gateway === "online") {
    return await executeZibalRefund(db, orderId, payment, amountToRefund, info, options, now);
  } else {
    // Default manual / COD refund
    db.run(`UPDATE payments SET status = 'refunded', updated_at = ? WHERE id = ?`, [now, payment.id]);
    db.run(`UPDATE orders SET status = 'refunded', payment_status = 'refunded', updated_at = ? WHERE id = ?`, [now, orderId]);
    await persistDatabase();

    return {
      success: true,
      isSuccessful: true,
      gateway: payment.gateway,
      refundedAmount: amountToRefund,
      remainingRefundable: 0,
      status: "refunded",
      message: "سفارش با موفقیت مسترد شد.",
    };
  }
}

/**
 * Executes an all-or-nothing database transaction to claim the refund:
 * 1. Verifies the payment is in an eligible status ('paid', 'refund_pending', 'refund_failed')
 * 2. Atomically sets status = 'refund_processing'
 * 3. Inserts the corresponding refund_claim transaction record
 * 4. Commits only if all steps succeed. If any step fails, rolls back completely.
 */
function claimRefundTransaction(
  db: any,
  paymentId: number,
  orderId: number,
  gateway: string,
  amount: number,
  currency: string,
  referenceId: string | null,
  reason: string,
  now: string
): { claimed: boolean; reason?: string; error?: string } {
  let inTx = false;
  try {
    db.run("BEGIN TRANSACTION;");
    inTx = true;

    // 1. Verify eligibility under transaction
    const rows = queryRows(
      db,
      `SELECT id, order_id, status, amount FROM payments WHERE id = ?`,
      [paymentId]
    );

    if (!rows.length) {
      db.run("ROLLBACK;");
      inTx = false;
      return { claimed: false, reason: "PAYMENT_NOT_FOUND" };
    }

    const currentStatus = String(rows[0].status || "").toLowerCase();
    const eligibleStatuses = ["paid", "refund_pending", "refund_failed"];
    if (!eligibleStatuses.includes(currentStatus)) {
      db.run("ROLLBACK;");
      inTx = false;
      return {
        claimed: false,
        reason: currentStatus === "refund_processing"
          ? "REFUND_ALREADY_PROCESSING"
          : (currentStatus === "refunded" ? "ALREADY_REFUNDED" : "INVALID_STATUS"),
      };
    }

    // 2. Atomically claim status
    db.run(
      `UPDATE payments SET status = 'refund_processing', updated_at = ?
       WHERE id = ? AND status IN ('paid', 'refund_pending', 'refund_failed')`,
      [now, paymentId]
    );

    const modified = typeof db.getRowsModified === "function" ? db.getRowsModified() : 1;
    if (modified === 0) {
      db.run("ROLLBACK;");
      inTx = false;
      return { claimed: false, reason: "CONCURRENT_CLAIM_LOST" };
    }

    // Test seam hook for simulating failure during claim record insert (TEST 1)
    if (simulatedClaimRecordFailure) {
      throw new Error("SIMULATED_CLAIM_RECORD_INSERT_FAILURE");
    }

    // 3. Create claim record in payment_transactions with unique idempotency key
    const claimKey = `refund_claim_${paymentId}_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
    db.run(
      `INSERT INTO payment_transactions (
        payment_id, order_id, gateway, event_type, status, amount, currency, reference_id, idempotency_key, payload, created_at
      ) VALUES (?, ?, ?, 'refund_claim', 'processing', ?, ?, ?, ?, ?, ?)
      ON CONFLICT (idempotency_key) DO NOTHING`,
      [
        paymentId,
        orderId,
        gateway,
        amount,
        currency,
        referenceId,
        claimKey,
        JSON.stringify({ reason, initiated_at: now }),
        now,
      ]
    );

    // 4. Commit all operations together
    db.run("COMMIT;");
    inTx = false;

    return { claimed: true };
  } catch (err: any) {
    if (inTx) {
      try {
        db.run("ROLLBACK;");
      } catch {}
      inTx = false;
    }
    return {
      claimed: false,
      reason: "CLAIM_TRANSACTION_FAILED",
      error: err?.message,
    };
  }
}

/**
 * Execute internal ledger wallet refund.
 */
function executeWalletRefund(
  db: any,
  orderId: number,
  payment: any,
  amountToRefund: number,
  options: ProcessRefundOptions,
  now: string
): RefundResult {
  const { adminUserId, userId, reason } = options;

  let inTx = false;
  try {
    db.run("BEGIN TRANSACTION;");
    inTx = true;

    // Double check under transaction that wallet has not already been refunded
    const existingRefunds = queryRows(
      db,
      `SELECT COALESCE(SUM(amount), 0) AS total_refunded FROM wallet_transactions WHERE order_id = ? AND type = 'refund' AND status = 'successful'`,
      [orderId]
    );
    const totalRefunded = Number(existingRefunds[0]?.total_refunded || 0);
    const paidAmount = Number(payment.amount);
    const remaining = Math.max(0, paidAmount - totalRefunded);

    if (remaining < amountToRefund || amountToRefund <= 0) {
      db.run("ROLLBACK;");
      inTx = false;
      return {
        success: true,
        isSuccessful: true,
        gateway: "wallet",
        refundedAmount: 0,
        remainingRefundable: remaining,
        status: "refunded",
        message: "مبلغ استرداد قبلاً به کیف پول واریز شده است.",
        isDuplicate: true,
      };
    }

    const ref = `REF-WAL-${orderId}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    const orderUserId = Number(payment.user_id || userId);

    db.run(
      `INSERT INTO wallet_transactions (
        user_id, order_id, type, amount, currency, status, reference, description, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderUserId,
        orderId,
        "refund",
        amountToRefund,
        "IRR",
        "successful",
        ref,
        `استرداد وجه سفارش ${orderId}`,
        now,
        now,
      ]
    );

    const txKey = `wallet_refund_success_${orderId}_${ref}`;
    db.run(
      `INSERT INTO payment_transactions (
        payment_id, order_id, gateway, event_type, status, amount, currency, reference_id, idempotency_key, payload, created_at
      ) VALUES (?, ?, ?, 'refund', 'successful', ?, ?, ?, ?, ?, ?)
      ON CONFLICT (idempotency_key) DO NOTHING`,
      [
        payment.id,
        orderId,
        "wallet",
        amountToRefund,
        "IRR",
        ref,
        txKey,
        JSON.stringify({ reason: reason || "wallet_refund" }),
        now,
      ]
    );

    db.run(`UPDATE payments SET status = 'refunded', updated_at = ? WHERE id = ?`, [now, payment.id]);
    db.run(`UPDATE orders SET status = 'refunded', payment_status = 'refunded', updated_at = ? WHERE id = ?`, [now, orderId]);

    db.run("COMMIT;");
    inTx = false;

    recordAuditLog(db, {
      userId: adminUserId || userId,
      action: "wallet_refund_successful",
      entityType: "order",
      entityId: orderId,
      metadata: { order_id: orderId, amount: amountToRefund, reference: ref },
    });

    persistDatabase();

    return {
      success: true,
      isSuccessful: true,
      gateway: "wallet",
      refundedAmount: amountToRefund,
      remainingRefundable: 0,
      status: "refunded",
      reference: ref,
      message: `مبلغ ${amountToRefund} ریال با موفقیت به کیف پول کاربر مسترد شد.`,
    };
  } catch (err: any) {
    if (inTx) {
      try {
        db.run("ROLLBACK;");
      } catch {}
    }
    // Revert status to refund_failed so it is retryable
    db.run(`UPDATE payments SET status = 'refund_failed', updated_at = ? WHERE id = ?`, [now, payment.id]);
    return {
      success: false,
      isSuccessful: false,
      gateway: "wallet",
      refundedAmount: 0,
      remainingRefundable: amountToRefund,
      status: "refund_failed",
      message: "خطا در استرداد کیف پول: " + err?.message,
      error: "WALLET_REFUND_FAILED",
    };
  }
}

/**
 * Execute external Zibal gateway refund.
 * Strictly respects outcome: SUCCESS, FAILURE, UNKNOWN.
 */
async function executeZibalRefund(
  db: any,
  orderId: number,
  payment: any,
  amountToRefund: number,
  info: RefundableInfo,
  options: ProcessRefundOptions,
  now: string
): Promise<RefundResult> {
  const { adminUserId, userId } = options;
  const trackId = payment.gateway_payment_id || payment.reference_id;

  if (!trackId) {
    db.run(`UPDATE payments SET status = 'refund_failed', updated_at = ? WHERE id = ?`, [now, payment.id]);
    return {
      success: false,
      isSuccessful: false,
      gateway: "zibal",
      refundedAmount: 0,
      remainingRefundable: amountToRefund,
      status: "refund_failed",
      message: "شناسه پرداخت درگاه (trackId) یافت نشد.",
      error: "MISSING_TRACK_ID",
    };
  }

  // -------------------------------------------------------------
  // CALL EXTERNAL GATEWAY (ZIBAL)
  // -------------------------------------------------------------
  const refundRes = await refundZibalPayment({
    trackId,
    amount: amountToRefund,
  });

  // -------------------------------------------------------------
  // SCENARIO C: AMBIGUOUS / TIMEOUT / NETWORK FAILURE (UNKNOWN)
  // -------------------------------------------------------------
  if (refundRes.outcome === "UNKNOWN") {
    // Payment status becomes 'refund_unknown'.
    // DO NOT mark it refunded.
    // DO NOT create a successful refund ledger.
    // DO NOT create a fake wallet credit.
    // DO NOT automatically call Zibal again.
    // Preserves all identifiers for administrative reconciliation.
    db.run(`UPDATE payments SET status = 'refund_unknown', updated_at = ? WHERE id = ?`, [now, payment.id]);

    const unknownKey = `zibal_refund_unknown_${payment.id}_${Date.now()}`;
    db.run(
      `INSERT INTO payment_transactions (
        payment_id, order_id, gateway, event_type, status, amount, currency, reference_id, idempotency_key, payload, created_at
      ) VALUES (?, ?, ?, 'refund', 'unknown', ?, ?, ?, ?, ?, ?)
      ON CONFLICT (idempotency_key) DO NOTHING`,
      [
        payment.id,
        orderId,
        "zibal",
        amountToRefund,
        info.currency,
        trackId,
        unknownKey,
        JSON.stringify({
          reason: "ambiguous_gateway_outcome",
          message: refundRes.message,
          trackId,
          amount: amountToRefund,
          requested_at: now,
        }),
        now,
      ]
    );

    recordAuditLog(db, {
      userId: adminUserId || userId,
      action: "gateway_refund_unknown",
      entityType: "payment",
      entityId: payment.id,
      metadata: { order_id: orderId, trackId, amount: amountToRefund, reason: refundRes.message },
    });

    await persistDatabase();

    return {
      success: false,
      isSuccessful: false,
      gateway: "zibal",
      refundedAmount: 0,
      remainingRefundable: amountToRefund,
      status: "refund_unknown",
      reference: String(trackId),
      message: "پاسخ درگاه بانکی نامشخص است یا خطای ارتباط رخ داد. وضعیت پرداخت به 'refund_unknown' تغییر یافت و نیازمند تطبیق دستی است.",
      error: "REFUND_OUTCOME_UNKNOWN",
    };
  }

  // -------------------------------------------------------------
  // SCENARIO B: EXPLICIT CONFIRMED FAILURE FROM ZIBAL
  // -------------------------------------------------------------
  if (refundRes.outcome === "FAILURE") {
    // Payment becomes 'refund_failed'.
    // No successful refund ledger.
    // No fake wallet credit.
    // Refund remains retryable.
    db.run(`UPDATE payments SET status = 'refund_failed', updated_at = ? WHERE id = ?`, [now, payment.id]);

    const failKey = `zibal_refund_fail_${payment.id}_${Date.now()}`;
    db.run(
      `INSERT INTO payment_transactions (
        payment_id, order_id, gateway, event_type, status, amount, currency, reference_id, idempotency_key, payload, created_at
      ) VALUES (?, ?, ?, 'refund', 'failed', ?, ?, ?, ?, ?, ?)
      ON CONFLICT (idempotency_key) DO NOTHING`,
      [
        payment.id,
        orderId,
        "zibal",
        amountToRefund,
        info.currency,
        trackId,
        failKey,
        JSON.stringify(refundRes.raw || { message: refundRes.message }),
        now,
      ]
    );

    recordAuditLog(db, {
      userId: adminUserId || userId,
      action: "gateway_refund_failed",
      entityType: "payment",
      entityId: payment.id,
      metadata: { order_id: orderId, trackId, amount: amountToRefund, gateway_response: refundRes },
    });

    await persistDatabase();

    return {
      success: false,
      isSuccessful: false,
      gateway: "zibal",
      refundedAmount: 0,
      remainingRefundable: amountToRefund,
      status: "refund_failed",
      reference: String(trackId),
      message: "استرداد درگاه بانکی با خطا مواجه شد: " + (refundRes?.message || "رد درخواست توسط درگاه"),
      error: "GATEWAY_REFUND_FAILED",
    };
  }

  // -------------------------------------------------------------
  // SCENARIO A: EXPLICIT CONFIRMED SUCCESS FROM ZIBAL
  // -------------------------------------------------------------
  const successKey = `zibal_refund_success_${payment.id}`;
  db.run(
    `INSERT INTO payment_transactions (
      payment_id, order_id, gateway, event_type, status, amount, currency, reference_id, idempotency_key, payload, created_at
    ) VALUES (?, ?, ?, 'refund', 'successful', ?, ?, ?, ?, ?, ?)
    ON CONFLICT (idempotency_key) DO NOTHING`,
    [
      payment.id,
      orderId,
      "zibal",
      amountToRefund,
      info.currency,
      trackId,
      successKey,
      JSON.stringify(refundRes.raw || {}),
      now,
    ]
  );

  db.run(`UPDATE payments SET status = 'refunded', updated_at = ? WHERE id = ?`, [now, payment.id]);
  db.run(`UPDATE orders SET status = 'refunded', payment_status = 'refunded', updated_at = ? WHERE id = ?`, [now, orderId]);

  recordAuditLog(db, {
    userId: adminUserId || userId,
    action: "gateway_refund_successful",
    entityType: "payment",
    entityId: payment.id,
    metadata: { order_id: orderId, trackId, amount: amountToRefund, gateway_response: refundRes },
  });

  await persistDatabase();

  return {
    success: true,
    isSuccessful: true,
    gateway: "zibal",
    refundedAmount: amountToRefund,
    remainingRefundable: 0,
    status: "refunded",
    reference: String(trackId),
    message: "استرداد وجه از طریق درگاه بانکی با موفقیت انجام شد.",
  };
}

// In-memory mutex for in-flight reconciliation requests (process-level debounce)
const inFlightReconcilePromises = new Map<number, Promise<any>>();

/**
 * Authoritative manual reconciliation by an administrator for payments in 'refund_unknown'.
 * Preserves all audit trails and resolves ambiguous external outcomes safely.
 * Guarantees:
 * 1. Strict order/payment ownership verification.
 * 2. Server-authoritative refundable amount.
 * 3. Atomic database transaction with rollback protection.
 * 4. Required external reference for confirmed_success.
 * 5. Exactly-once inventory restoration.
 * 6. Zero duplicate transactions or wallet credits.
 * 7. Full idempotency on repeated or concurrent reconciliation requests.
 */
export async function reconcileUnknownRefund(options: ReconcileRefundOptions): Promise<{
  success: boolean;
  message: string;
  error?: string;
  alreadyReconciled?: boolean;
}> {
  const { orderId, paymentId, decision, adminUserId, notes, externalReference } = options;

  if (!orderId || isNaN(orderId)) {
    return { success: false, message: "شناسه سفارش نامعتبر است.", error: "INVALID_ORDER_ID" };
  }

  if (decision !== "confirmed_success" && decision !== "confirmed_failure") {
    return { success: false, message: "تصمیم نامعتبر برای تطبیق استرداد.", error: "INVALID_DECISION" };
  }

  const db = await getDatabase();
  const now = new Date().toISOString();

  // REQUIREMENT 1: Strict order/payment ownership
  const orderRows = queryRows(
    db,
    `SELECT id, status, payment_status, is_inventory_restored FROM orders WHERE id = ? LIMIT 1`,
    [orderId]
  );
  if (orderRows.length === 0) {
    return { success: false, message: "سفارش مورد نظر یافت نشد.", error: "ORDER_NOT_FOUND" };
  }

  let payment: any = null;
  if (paymentId) {
    const pRows = queryRows(db, `SELECT * FROM payments WHERE id = ? LIMIT 1`, [paymentId]);
    if (pRows.length === 0) {
      return { success: false, message: "رکورد پرداخت یافت نشد.", error: "PAYMENT_NOT_FOUND" };
    }
    if (Number(pRows[0].order_id) !== Number(orderId)) {
      return {
        success: false,
        message: "شناسه پرداخت با سفارش مشخص شده مطابقت ندارد.",
        error: "PAYMENT_ORDER_MISMATCH",
      };
    }
    payment = pRows[0];
  } else {
    const pRows = queryRows(db, `SELECT * FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1`, [orderId]);
    if (pRows.length === 0) {
      return { success: false, message: "هیچ پرداختی برای این سفارش یافت نشد.", error: "PAYMENT_NOT_FOUND" };
    }
    payment = pRows[0];
  }

  // REQUIREMENT 5: External reference is strictly required for confirmed_success
  const cleanRef = typeof externalReference === "string" ? externalReference.trim() : "";
  if (decision === "confirmed_success") {
    if (!cleanRef) {
      return {
        success: false,
        message: "شناسه پیگیری خارجی استرداد (externalReference) برای تایید موفقیت الزامی است.",
        error: "EXTERNAL_REFERENCE_REQUIRED",
      };
    }

    // The same external reference must not be accepted twice for two different successful refund records
    const dupRefRows = queryRows(
      db,
      `SELECT id, payment_id FROM payment_transactions 
       WHERE reference_id = ? AND event_type = 'refund' AND status = 'successful' AND payment_id != ? LIMIT 1`,
      [cleanRef, payment.id]
    );
    if (dupRefRows.length > 0) {
      return {
        success: false,
        message: "این شناسه پیگیری استرداد قبلاً برای پرداخت دیگری ثبت شده است.",
        error: "DUPLICATE_EXTERNAL_REFERENCE",
      };
    }
  }

  // Idempotency check: Already reconciled?
  const currentStatus = String(payment.status || "").toLowerCase();
  if (decision === "confirmed_success") {
    const existingSuccess = queryRows(
      db,
      `SELECT id FROM payment_transactions 
       WHERE payment_id = ? AND event_type = 'refund' AND status = 'successful' LIMIT 1`,
      [payment.id]
    );
    if (currentStatus === "refunded" && existingSuccess.length > 0) {
      return {
        success: true,
        message: "این پرداخت قبلاً با موفقیت تطبیق داده شده و استرداد آن ثبت شده است.",
        alreadyReconciled: true,
      };
    }
  } else if (decision === "confirmed_failure") {
    if (currentStatus === "refund_failed") {
      return {
        success: true,
        message: "این پرداخت قبلاً به عنوان استرداد ناموفق ثبت شده است و اکنون قابل تلاش مجدد است.",
        alreadyReconciled: true,
      };
    }
  }

  if (currentStatus !== "refund_unknown" && currentStatus !== "refund_processing") {
    return {
      success: false,
      message: `پرداخت در وضعیت نیازمند تطبیق نیست (وضعیت فعلی: ${currentStatus}).`,
      error: "PAYMENT_NOT_IN_UNKNOWN_STATUS",
    };
  }

  // Process-level mutex to serialize concurrent reconciliation calls for the exact same payment
  const activePromise = inFlightReconcilePromises.get(payment.id);
  if (activePromise) {
    try {
      await activePromise;
    } catch {
      // ignore
    }
    // Re-check payment state after in-flight reconciliation completes
    const recheckedRows = queryRows(db, `SELECT * FROM payments WHERE id = ? LIMIT 1`, [payment.id]);
    const rechecked = recheckedRows[0];
    const recheckedStatus = String(rechecked?.status || "").toLowerCase();
    if (decision === "confirmed_success" && recheckedStatus === "refunded") {
      return {
        success: true,
        message: "این پرداخت قبلاً با موفقیت تطبیق داده شده و استرداد آن ثبت شده است.",
        alreadyReconciled: true,
      };
    }
    if (decision === "confirmed_failure" && recheckedStatus === "refund_failed") {
      return {
        success: true,
        message: "این پرداخت قبلاً به عنوان استرداد ناموفق ثبت شده است و اکنون قابل تلاش مجدد است.",
        alreadyReconciled: true,
      };
    }
  }

  const reconcileExecution = (async () => {
    // REQUIREMENT 2: Refund amount must be server-authoritative
    const info = calculateRefundableAmount(db, orderId, payment.id);
    const refundable = info.refundableAmount;
    if (decision === "confirmed_success" && refundable <= 0) {
      return {
        success: false,
        message: "مبلغی برای استرداد برای این پرداخت وجود ندارد.",
        error: "NO_REFUNDABLE_AMOUNT",
      };
    }

    // REQUIREMENT 6: Protect with database transaction & DB-level condition
    let inTx = false;
    try {
      db.run("BEGIN TRANSACTION;");
      inTx = true;

      // Test seam for TEST F: database failure during reconciliation
      if (simulatedReconcileDbFailure) {
        throw new Error("SIMULATED_DATABASE_FAILURE_DURING_RECONCILE");
      }

      const nextPaymentStatus = decision === "confirmed_success" ? "refunded" : "refund_failed";

      db.run(
        `UPDATE payments SET status = ?, updated_at = ? WHERE id = ? AND status IN ('refund_unknown', 'refund_processing')`,
        [nextPaymentStatus, now, payment.id]
      );
      const modified = typeof db.getRowsModified === "function" ? db.getRowsModified() : 1;
      if (modified === 0) {
        // Concurrency conflict: Another worker modified it
        const recheck = queryRows(db, `SELECT status FROM payments WHERE id = ?`, [payment.id]);
        const recheckStatus = String(recheck[0]?.status || "").toLowerCase();
        db.run("ROLLBACK;");
        inTx = false;

        if (
          (decision === "confirmed_success" && recheckStatus === "refunded") ||
          (decision === "confirmed_failure" && recheckStatus === "refund_failed")
        ) {
          return {
            success: true,
            message: "این پرداخت همزمان توسط درخواست دیگری با موفقیت تطبیق داده شد.",
            alreadyReconciled: true,
          };
        }
        return {
          success: false,
          message: "وضعیت پرداخت در حین تطبیق تغییر کرد.",
          error: "CONCURRENT_MODIFICATION_CONFLICT",
        };
      }

      if (decision === "confirmed_success") {
        const reconcileKey = `reconcile_success_${payment.id}`;
        db.run(
          `INSERT INTO payment_transactions (
            payment_id, order_id, gateway, event_type, status, amount, currency, reference_id, idempotency_key, payload, is_reconciled, created_at
          ) VALUES (?, ?, ?, 'refund', 'successful', ?, ?, ?, ?, ?, 1, ?)
          ON CONFLICT (idempotency_key) DO NOTHING`,
          [
            payment.id,
            orderId,
            payment.gateway,
            refundable,
            payment.currency || "IRR",
            cleanRef,
            reconcileKey,
            JSON.stringify({ decision, notes, reconciled_by: adminUserId, reconciled_at: now }),
            now,
          ]
        );

        db.run(`UPDATE orders SET status = 'refunded', payment_status = 'refunded', updated_at = ? WHERE id = ?`, [now, orderId]);

        // REQUIREMENT 7: Restore inventory exactly once inside the transaction
        restoreOrderInventory(db, orderId, "refund_reconciliation", false);

        // REQUIREMENT 8: Audit log
        recordAuditLog(db, {
          userId: adminUserId,
          action: "admin_reconcile_refund_success",
          entityType: "payment",
          entityId: payment.id,
          metadata: {
            order_id: orderId,
            payment_id: payment.id,
            previous_state: currentStatus,
            new_state: "refunded",
            reconciliation_result: decision,
            amount: refundable,
            external_reference: cleanRef,
            notes: notes || null,
            timestamp: now,
          },
        });

        db.run("COMMIT;");
        inTx = false;
        await persistDatabase();
        return { success: true, message: "وضعیت پرداخت با موفقیت به عنوان 'refunded' تطبیق داده شد." };
      } else {
        // REQUIREMENT 4: confirmed_failure must not create successful refund, wallet credit, or inventory restoration
        const reconcileKey = `reconcile_fail_${payment.id}`;
        db.run(
          `INSERT INTO payment_transactions (
            payment_id, order_id, gateway, event_type, status, amount, currency, reference_id, idempotency_key, payload, is_reconciled, created_at
          ) VALUES (?, ?, ?, 'refund', 'failed', ?, ?, ?, ?, ?, 1, ?)
          ON CONFLICT (idempotency_key) DO NOTHING`,
          [
            payment.id,
            orderId,
            payment.gateway,
            refundable,
            payment.currency || "IRR",
            cleanRef || payment.reference_id || null,
            reconcileKey,
            JSON.stringify({ decision, notes, reconciled_by: adminUserId, reconciled_at: now }),
            now,
          ]
        );

        // REQUIREMENT 8: Audit log
        recordAuditLog(db, {
          userId: adminUserId,
          action: "admin_reconcile_refund_failure",
          entityType: "payment",
          entityId: payment.id,
          metadata: {
            order_id: orderId,
            payment_id: payment.id,
            previous_state: currentStatus,
            new_state: "refund_failed",
            reconciliation_result: decision,
            amount: refundable,
            external_reference: cleanRef || null,
            notes: notes || null,
            timestamp: now,
          },
        });

        db.run("COMMIT;");
        inTx = false;
        await persistDatabase();
        return {
          success: true,
          message: "وضعیت پرداخت به عنوان 'refund_failed' ثبت شد و اکنون قابل تلاش مجدد است.",
        };
      }
    } catch (err: any) {
      if (inTx) {
        try {
          db.run("ROLLBACK;");
        } catch (rbErr) {
          console.error("[reconcileUnknownRefund] Rollback error:", rbErr);
        }
      }
      return {
        success: false,
        message: "خطا در فرآیند تطبیق استرداد: " + (err?.message || "خطای پایگاه داده"),
        error: err?.message || "RECONCILE_TRANSACTION_FAILED",
      };
    }
  })();

  inFlightReconcilePromises.set(payment.id, reconcileExecution);
  try {
    return await reconcileExecution;
  } finally {
    inFlightReconcilePromises.delete(payment.id);
  }
}
