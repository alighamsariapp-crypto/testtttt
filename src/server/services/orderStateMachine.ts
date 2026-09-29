import { queryRows, recordAuditLog, persistDatabase, runInTransaction } from "../db";
import { restoreOrderInventory } from "../adminRoutes";

export const __testFailureInjection = {
  transitionFailOnHistory: false,
};

// Authoritative Order State Machine Transitions
export const VALID_ORDER_TRANSITIONS: Record<string, string[]> = {
  pending: ["awaiting_payment", "paid", "processing", "cancelled", "failed"],
  awaiting_payment: ["paid", "processing", "cancelled", "failed"],
  paid: ["processing", "preparing", "shipped", "shipping", "cancelled", "refunded"],
  processing: ["preparing", "shipped", "shipping", "cancelled", "refunded"],
  preparing: ["shipped", "shipping", "cancelled", "refunded"],
  shipped: ["shipping", "delivered", "completed", "refunded"],
  shipping: ["delivered", "completed", "refunded"],
  delivered: ["completed", "refunded"],
  completed: ["refunded"], // Terminal except for verified refund
  cancelled: ["refunded"], // Terminal except if paid order completes refund
  failed: ["awaiting_payment", "cancelled"], // Cannot jump straight to paid without payment lifecycle
  refunded: [], // Strictly terminal
};

export function isValidOrderTransition(currentStatus: string, nextStatus: string): boolean {
  const c = String(currentStatus || "").trim().toLowerCase();
  const n = String(nextStatus || "").trim().toLowerCase();
  if (c === n) return true;
  const allowed = VALID_ORDER_TRANSITIONS[c] || [];
  return allowed.includes(n);
}

export interface OrderTransitionInput {
  orderId: number;
  paymentId?: number;
  targetStatus?: string;
  targetPaymentStatus?: string;
  trackingCode?: string;
  reason?: string;
  actorId?: number;
  actorRole?: "admin" | "customer" | "gateway" | "system_payment_verification" | "wallet_payment";
  isFinancialRefundVerified?: boolean;
}

export interface OrderTransitionResult {
  success: boolean;
  error?: string;
  errorCode?: string;
  orderId?: number;
  previousStatus?: string;
  newStatus?: string;
  previousPaymentStatus?: string;
  newPaymentStatus?: string;
}

/**
 * Single Authoritative Order-State Transition Engine.
 * Enforces all lifecycle transition invariants, database-level consistency,
 * atomic inventory restoration, payment attempt isolation, and transaction boundaries.
 */
export function transitionOrderStatus(
  db: any,
  params: OrderTransitionInput
): OrderTransitionResult {
  const { orderId, paymentId, targetStatus, targetPaymentStatus, trackingCode, reason, actorId, actorRole, isFinancialRefundVerified } = params;

  if (!orderId || !Number.isFinite(Number(orderId))) {
    return { success: false, error: "شناسه سفارش نامعتبر است.", errorCode: "INVALID_ORDER_ID" };
  }

  const orderRows = queryRows(
    db,
    `SELECT id, order_number, user_id, status, payment_status, tracking_code, grand_total, is_inventory_restored
     FROM orders WHERE id = ? LIMIT 1`,
    [Number(orderId)]
  );

  if (orderRows.length === 0) {
    return { success: false, error: "سفارش مورد نظر یافت نشد.", errorCode: "ORDER_NOT_FOUND" };
  }

  const order = orderRows[0];
  const currentStatus = String(order.status || "").toLowerCase();
  const currentPaymentStatus = String(order.payment_status || "").toLowerCase();
  const nextStatus = targetStatus ? String(targetStatus).trim().toLowerCase() : currentStatus;
  let nextPaymentStatus = targetPaymentStatus ? String(targetPaymentStatus).trim().toLowerCase() : currentPaymentStatus;

  // 1. Validate status transition validity
  if (nextStatus !== currentStatus) {
    if (!isValidOrderTransition(currentStatus, nextStatus)) {
      return {
        success: false,
        error: `تغییر وضعیت از «${currentStatus}» به «${nextStatus}» طبق قوانین چرخه حیات سفارش مجاز نیست.`,
        errorCode: "INVALID_ORDER_STATUS_TRANSITION",
        previousStatus: currentStatus,
        newStatus: nextStatus,
      };
    }
  }

  // 2. Prevent impossible / conflicting combinations
  if (nextStatus === "cancelled" && nextPaymentStatus === "paid") {
    return {
      success: false,
      error: "نمی‌توان وضعیت پرداخت یک سفارش لغو شده را به «پرداخت شده» تغییر داد.",
      errorCode: "INVALID_STATUS_COMBINATION",
    };
  }

  // 3. Paid Verification Invariant:
  // Never mark an order paid without successful server-side payment verification
  if ((nextStatus === "paid" || nextPaymentStatus === "paid") && currentStatus !== "paid" && currentPaymentStatus !== "paid") {
    const isAuthorizedPaymentActor = actorRole === "system_payment_verification" || actorRole === "wallet_payment";
    if (!isAuthorizedPaymentActor) {
      // Check if there is an existing verified paid payment in the database
      const verifiedPayments = queryRows(
        db,
        `SELECT id, status FROM payments WHERE order_id = ? AND status = 'paid' LIMIT 1`,
        [order.id]
      );
      if (verifiedPayments.length === 0) {
        return {
          success: false,
          error: "ثبت وضعیت پرداخت شده بدون تأیید پرداخت معتبر درگاه یا تراکنش کیف پول مجاز نیست.",
          errorCode: "UNVERIFIED_PAYMENT_TRANSITION",
        };
      }
    }
  }

  // 4. Refund Verification Invariant:
  // Never mark an order refunded merely because its status was manually changed
  if ((nextStatus === "refunded" || nextPaymentStatus === "refunded") && currentStatus !== "refunded" && currentPaymentStatus !== "refunded") {
    if (!isFinancialRefundVerified) {
      // Check if there is an existing refunded payment record
      const refundedPayments = queryRows(
        db,
        `SELECT id, status FROM payments WHERE order_id = ? AND status = 'refunded' LIMIT 1`,
        [order.id]
      );
      if (refundedPayments.length === 0) {
        return {
          success: false,
          error: "تغییر وضعیت به مرجوعی نیازمند انجام و تأیید موفقیت‌آمیز تراکنش استرداد وجه است.",
          errorCode: "UNVERIFIED_REFUND_TRANSITION",
        };
      }
    }
    nextPaymentStatus = "refunded";
  }

  const now = new Date().toISOString();

  // ATOMIC TRANSACTION BOUNDARY:
  // Inventory restoration, orders update, payments update, order_transition_history insert,
  // and audit log are strictly atomic. Any failure (including history insert) rolls back ALL operations.
  try {
    return runInTransaction(db, () => {
      // 5. Inventory Restoration Rules:
      // Guaranteed atomic and exactly once. Never restore inventory twice.
      if (nextStatus === "cancelled" || nextStatus === "failed") {
        if (currentStatus !== "cancelled" && currentStatus !== "failed" && currentStatus !== "refunded") {
          const restored = restoreOrderInventory(db, Number(order.id), reason || `transition_to_${nextStatus}`, false);
          if (!restored) {
            throw new Error(`Inventory restoration failed for order ${order.id}`);
          }
        }
      } else if (nextStatus === "refunded") {
        // If order was already cancelled, inventory was already restored by cancellation!
        if (currentStatus !== "cancelled" && currentStatus !== "refunded") {
          const restored = restoreOrderInventory(db, Number(order.id), reason || "transition_to_refunded", false);
          if (!restored) {
            throw new Error(`Inventory restoration failed for order ${order.id}`);
          }
        }
      }

      // 6. Execute atomic update on orders
      const effectiveTrackingCode = trackingCode !== undefined ? trackingCode : order.tracking_code;

      db.run(
        `UPDATE orders
         SET status = ?, payment_status = ?, tracking_code = ?, updated_at = ?
         WHERE id = ?`,
        [nextStatus, nextPaymentStatus, effectiveTrackingCode, now, order.id]
      );

      // 7. Payment Attempt Isolation:
      // Only update payments if an explicit paymentId is supplied for this specific attempt.
      // Never update all payments of an order indiscriminately.
      if (paymentId && Number.isFinite(Number(paymentId))) {
        db.run(
          `UPDATE payments SET status = ?, updated_at = ? WHERE id = ?`,
          [nextPaymentStatus, now, Number(paymentId)]
        );
      }

      // Test Failure Injection Hook: transition-history failure rollback
      if (__testFailureInjection.transitionFailOnHistory) {
        throw new Error("SIMULATED_FAILURE_ON_HISTORY");
      }

      // 8. Record dedicated order transition history (MANDATORY write; failure causes full rollback)
      db.run(
        `INSERT INTO order_transition_history (order_id, from_status, to_status, from_payment_status, to_payment_status, reason, actor_role, actor_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          Number(order.id),
          currentStatus,
          nextStatus,
          currentPaymentStatus,
          nextPaymentStatus,
          reason || "state_machine_transition",
          actorRole || "system",
          actorId || order.user_id,
          now,
        ]
      );

      // 9. Record audit log
      recordAuditLog(db, {
        userId: actorId || order.user_id,
        action: `order_transition_${currentStatus}_to_${nextStatus}`,
        entityType: "order",
        entityId: Number(order.id),
        metadata: {
          order_number: order.order_number,
          old_status: currentStatus,
          new_status: nextStatus,
          old_payment_status: currentPaymentStatus,
          new_payment_status: nextPaymentStatus,
          reason: reason || "state_machine_transition",
          actor_role: actorRole || "system",
        },
      });

      return {
        success: true,
        orderId: Number(order.id),
        previousStatus: currentStatus,
        newStatus: nextStatus,
        previousPaymentStatus: currentPaymentStatus,
        newPaymentStatus: nextPaymentStatus,
      };
    });
  } catch (txErr: any) {
    console.error(`[transitionOrderStatus] Transaction failed and rolled back for order ${orderId}:`, txErr?.message);
    return {
      success: false,
      error: txErr?.message || "خطا در تراکنش تغییر وضعیت سفارش.",
      errorCode: "TRANSACTION_FAILED",
      previousStatus: currentStatus,
      newStatus: currentStatus,
    };
  }
}
