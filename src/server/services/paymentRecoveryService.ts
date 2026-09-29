import { queryRows, recordAuditLog, persistDatabase, runInTransaction } from "../db";
import { transitionOrderStatus } from "./orderStateMachine";

export const __testFailureInjection = {
  reconcileFailOnTransaction: false,
};

export interface ReconcileUnknownPaymentParams {
  paymentId: number;
  orderId: number;
  outcome: "confirmed_success" | "confirmed_failure";
  externalReference?: string;
  adminUserId?: number;
  reason?: string;
}

export interface ReconcileUnknownPaymentResult {
  success: boolean;
  message: string;
  isIdempotent?: boolean;
  error?: string;
  errorCode?: string;
}

/**
 * Authoritative manual/system reconciliation for payments in 'payment_unknown' or ambiguous states.
 * Safely resolves unknown gateway outcomes without duplicate financial actions or double inventory restoration.
 */
export async function reconcileUnknownPayment(
  db: any,
  params: ReconcileUnknownPaymentParams
): Promise<ReconcileUnknownPaymentResult> {
  const { paymentId, orderId, outcome, externalReference, adminUserId, reason } = params;

  if (!paymentId || !orderId || !outcome) {
    return {
      success: false,
      message: "شناسه پرداخت، شناسه سفارش و نتیجه تطبیق الزامی هستند.",
      errorCode: "INVALID_PARAMETERS",
    };
  }

  const paymentRows = queryRows(
    db,
    `SELECT id, order_id, gateway, amount, currency, status, reference_id, gateway_payment_id
     FROM payments WHERE id = ? LIMIT 1`,
    [Number(paymentId)]
  );

  if (paymentRows.length === 0) {
    return {
      success: false,
      message: "پرداخت مورد نظر یافت نشد.",
      errorCode: "PAYMENT_NOT_FOUND",
    };
  }

  const payment = paymentRows[0];

  if (Number(payment.order_id) !== Number(orderId)) {
    return {
      success: false,
      message: "شناسه پرداخت با شناسه سفارش همخوانی ندارد.",
      errorCode: "PAYMENT_ORDER_MISMATCH",
    };
  }

  const currentStatus = String(payment.status || "").toLowerCase();

  // Idempotency guard: if payment has already been reconciled to this exact outcome
  if (currentStatus === "paid" && outcome === "confirmed_success") {
    return {
      success: true,
      message: "این پرداخت قبلاً تطبیق داده شده و با موفقیت ثبت شده است.",
      isIdempotent: true,
    };
  }

  if (currentStatus === "failed" && outcome === "confirmed_failure") {
    return {
      success: true,
      message: "این پرداخت قبلاً تطبیق داده شده و به عنوان ناموفق ثبت شده است.",
      isIdempotent: true,
    };
  }

  // Only allow reconciliation for payment_unknown, unknown, verifying, or pending
  if (currentStatus !== "payment_unknown" && currentStatus !== "unknown" && currentStatus !== "verifying" && currentStatus !== "pending") {
    return {
      success: false,
      message: `وضعیت فعلی پرداخت (${currentStatus}) نیازی به تطبیق ندارد.`,
      errorCode: "INVALID_PAYMENT_STATUS_FOR_RECONCILIATION",
    };
  }

  const now = new Date().toISOString();

  if (outcome === "confirmed_success") {
    const ref = (externalReference && typeof externalReference === "string" && externalReference.trim()) 
      ? externalReference.trim() 
      : (payment.reference_id || payment.gateway_payment_id || "");

    if (!ref) {
      return {
        success: false,
        message: "ثبت تأیید پرداخت نیازمند کد پیگیری/مرجع معتبر درگاه بانکی است.",
        errorCode: "MISSING_EXTERNAL_REFERENCE",
      };
    }

    try {
      runInTransaction(db, () => {
        // 1. Transition order to paid (isolated payment attempt!)
        const transitionRes = transitionOrderStatus(db, {
          orderId: Number(orderId),
          paymentId: Number(payment.id),
          targetStatus: "paid",
          targetPaymentStatus: "paid",
          reason: reason || "admin_reconcile_confirmed_success",
          actorId: adminUserId,
          actorRole: "system_payment_verification",
        });

        if (!transitionRes.success) {
          throw new Error(transitionRes.error || "خطا در تغییر وضعیت سفارش به پرداخت شده.");
        }

        // 2. Update payment record
        db.run(
          `UPDATE payments SET status = 'paid', reference_id = ?, updated_at = ? WHERE id = ?`,
          [ref, now, payment.id]
        );

        // Failure injection hook for test
        if (__testFailureInjection.reconcileFailOnTransaction) {
          throw new Error("SIMULATED_FAILURE_ON_RECONCILE");
        }

        // 3. Record transaction
        db.run(
          `INSERT OR IGNORE INTO payment_transactions (
            payment_id, order_id, gateway, event_type, status, amount, currency, reference_id, idempotency_key, is_reconciled, payload, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
          [
            payment.id,
            orderId,
            payment.gateway || "zibal",
            "reconciliation_confirmed_success",
            "successful",
            Number(payment.amount),
            payment.currency || "IRR",
            ref,
            `reconcile_success_${payment.id}_${Date.now()}`,
            JSON.stringify({ outcome: "confirmed_success", adminUserId, reason, reference: ref }),
            now,
          ]
        );

        recordAuditLog(db, {
          userId: adminUserId || 0,
          action: "reconcile_payment_confirmed_success",
          entityType: "payment",
          entityId: payment.id,
          metadata: { order_id: orderId, reference: ref, reason },
        });
      });

      await persistDatabase();

      return {
        success: true,
        message: "پرداخت با موفقیت تطبیق داده شد و سفارش پرداخت شده ثبت گردید.",
      };
    } catch (err: any) {
      console.error("[reconcileUnknownPayment] Success reconciliation failed and rolled back:", err?.message);
      return {
        success: false,
        message: err?.message || "خطا در فرآیند تطبیق پرداخت.",
        errorCode: "RECONCILIATION_TRANSACTION_FAILED",
      };
    }
  }

  if (outcome === "confirmed_failure") {
    try {
      runInTransaction(db, () => {
        // 1. Transition order to failed and safely restore inventory exactly once (isolated payment attempt!)
        const transitionRes = transitionOrderStatus(db, {
          orderId: Number(orderId),
          paymentId: Number(payment.id),
          targetStatus: "failed",
          targetPaymentStatus: "failed",
          reason: reason || "admin_reconcile_confirmed_failure",
          actorId: adminUserId,
          actorRole: "admin",
        });

        if (!transitionRes.success) {
          throw new Error(transitionRes.error || "خطا در تغییر وضعیت سفارش به ناموفق.");
        }

        // 2. Update payment record
        db.run(
          `UPDATE payments SET status = 'failed', updated_at = ? WHERE id = ?`,
          [now, payment.id]
        );

        // Failure injection hook for test
        if (__testFailureInjection.reconcileFailOnTransaction) {
          throw new Error("SIMULATED_FAILURE_ON_RECONCILE");
        }

        // 3. Record transaction
        db.run(
          `INSERT OR IGNORE INTO payment_transactions (
            payment_id, order_id, gateway, event_type, status, amount, currency, reference_id, idempotency_key, is_reconciled, payload, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
          [
            payment.id,
            orderId,
            payment.gateway || "zibal",
            "reconciliation_confirmed_failure",
            "failed",
            Number(payment.amount),
            payment.currency || "IRR",
            payment.reference_id || payment.gateway_payment_id || null,
            `reconcile_failure_${payment.id}_${Date.now()}`,
            JSON.stringify({ outcome: "confirmed_failure", adminUserId, reason }),
            now,
          ]
        );

        recordAuditLog(db, {
          userId: adminUserId || 0,
          action: "reconcile_payment_confirmed_failure",
          entityType: "payment",
          entityId: payment.id,
          metadata: { order_id: orderId, reason },
        });
      });

      await persistDatabase();

      return {
        success: true,
        message: "پرداخت با موفقیت تطبیق داده شد، به عنوان ناموفق ثبت گردید و موجودی انبار بازگردانده شد.",
      };
    } catch (err: any) {
      console.error("[reconcileUnknownPayment] Failure reconciliation failed and rolled back:", err?.message);
      return {
        success: false,
        message: err?.message || "خطا در فرآیند تطبیق پرداخت.",
        errorCode: "RECONCILIATION_TRANSACTION_FAILED",
      };
    }
  }

  return {
    success: false,
    message: "نتیجه تطبیق نامعتبر است.",
    errorCode: "INVALID_OUTCOME",
  };
}
