import { Request, Response } from "express";
import { getDatabase, persistDatabase, queryRows, recordAuditLog } from "./db";
import { TokenService } from "./tokenService";
import { verifyZibalPayment } from "./services/zibalService";
import { restoreOrderInventory } from "./adminRoutes";
import { transitionOrderStatus } from "./services/orderStateMachine";
import { reconcileUnknownPayment } from "./services/paymentRecoveryService";
import {
  generatePaymentStatusToken,
  verifyPaymentStatusToken,
} from "./services/paymentStatusTokenService";
import {
  createPaymentStatusExchangeCode,
  exchangeCodeForStatusToken,
} from "./services/paymentStatusExchangeService";
import { PaymentStatusType } from "../types";

/**
 * Handle Zibal Payment Gateway Callback (GET & POST)
 * Route: /api/v1/payments/zibal/callback
 *
 * Requirements:
 * 1. Receive callback parameters (trackId, success, status, orderId).
 * 2. Locate associated payment and order in SQLite database.
 * 3. Idempotent: safe if customer refreshes or visits multiple times.
 * 4. Cancellation handling: if customer cancelled or gateway failed, mark cancelled/failed.
 * 5. Server-side verification: call official Zibal /v1/verify endpoint.
 * 6. Amount validation: ensure verified amount equals order grand total.
 * 7. Mark as paid only after successful server-side verification.
 * 8. Redirect customer to /payment-status?status=... for seamless UX.
 */
export async function handleZibalCallback(req: Request, res: Response) {
  const db = await getDatabase();

  const rawTrackId = req.query.trackId ?? req.body?.trackId;
  const rawSuccess = req.query.success ?? req.body?.success;
  const rawStatus = req.query.status ?? req.body?.status;
  const rawOrderId = req.query.orderId ?? req.body?.orderId;

  const trackId = rawTrackId ? String(rawTrackId).trim() : "";
  const success = rawSuccess !== undefined ? String(rawSuccess).trim() : "";
  const statusParam = rawStatus !== undefined ? String(rawStatus).trim() : "";
  const orderNumberParam = rawOrderId ? String(rawOrderId).trim() : "";

  console.log(`[Zibal] Callback received. trackId=${trackId}, success=${success}, status=${statusParam}, orderId=${orderNumberParam}`);
  res.setHeader("Referrer-Policy", "no-referrer");

  if (!trackId) {
    console.warn("[Zibal] Callback missing required trackId parameter.");
    return res.redirect("/payment-status?status=failed&gateway=zibal&error=MISSING_TRACK_ID");
  }

  // 1. Resolve Payment record from SQLite
  let paymentRows = queryRows(
    db,
    `SELECT id, order_id, user_id, gateway, amount, currency, status,
            reference_id, gateway_payment_id, payment_url, gateway_response
     FROM payments
     WHERE gateway_payment_id = ? OR reference_id = ?
     ORDER BY id DESC LIMIT 1`,
    [trackId, trackId]
  );

  // Fallback: If not found by trackId, try resolving by order_number
  if (paymentRows.length === 0 && orderNumberParam) {
    paymentRows = queryRows(
      db,
      `SELECT p.id, p.order_id, p.user_id, p.gateway, p.amount, p.currency, p.status,
              p.reference_id, p.gateway_payment_id, p.payment_url, p.gateway_response
       FROM payments p
       JOIN orders o ON o.id = p.order_id
       WHERE o.order_number = ? AND (p.gateway = 'zibal' OR p.gateway = 'online')
       ORDER BY p.id DESC LIMIT 1`,
      [orderNumberParam]
    );
  }

  if (paymentRows.length === 0) {
    console.warn(`[Zibal] Payment not found in database for trackId: ${trackId}`);
    return res.redirect(`/payment-status?status=failed&gateway=zibal&reference=${encodeURIComponent(trackId)}&error=PAYMENT_NOT_FOUND`);
  }

  const payment = paymentRows[0];

  // 2. Resolve associated Order
  const orderRows = queryRows(
    db,
    `SELECT id, order_number, user_id, status, payment_status, grand_total, currency, tracking_code
     FROM orders
     WHERE id = ? LIMIT 1`,
    [payment.order_id]
  );

  if (orderRows.length === 0) {
    console.warn(`[Zibal] Associated order #${payment.order_id} not found.`);
    return res.redirect(`/payment-status?error=ORDER_NOT_FOUND`);
  }

  const order = orderRows[0];
  const orderNumber = String(order.order_number);
  const grandTotal = Number(order.grand_total);
  const currency = String(order.currency || "IRR");

  const redirectToStatusWithExchangeCode = (orderId: number, orderNum: string, userId: number) => {
    const exchangeCode = createPaymentStatusExchangeCode(db, orderId, orderNum, userId);
    res.setHeader("Referrer-Policy", "no-referrer");
    return res.redirect(`/payment-status?order=${encodeURIComponent(orderNum)}&exchange_code=${encodeURIComponent(exchangeCode)}`);
  };

  // 3. Idempotency Check
  // If payment or order is already finalized in any state, return idempotent response immediately
  if (String(payment.status) === "paid" || String(order.payment_status) === "paid") {
    console.log(`[Zibal] Payment already verified & paid for order ${orderNumber}. Returning idempotent redirect.`);
    return redirectToStatusWithExchangeCode(Number(order.id), orderNumber, Number(order.user_id));
  }

  if (String(payment.status) === "cancelled" || String(order.payment_status) === "cancelled") {
    console.log(`[Zibal] Payment already cancelled for order ${orderNumber}. Returning idempotent redirect.`);
    return redirectToStatusWithExchangeCode(Number(order.id), orderNumber, Number(order.user_id));
  }

  if (String(payment.status) === "failed" || String(order.payment_status) === "failed") {
    console.log(`[Zibal] Payment already failed for order ${orderNumber}. Returning idempotent redirect.`);
    return redirectToStatusWithExchangeCode(Number(order.id), orderNumber, Number(order.user_id));
  }

  const now = new Date().toISOString();
  let existingGatewayResponse: Record<string, any> = {};
  try {
    existingGatewayResponse = JSON.parse(payment.gateway_response || "{}");
  } catch {
    existingGatewayResponse = {};
  }

  // 4. Cancellation Check
  // If callback indicates user cancelled or gateway failed
  if (success !== "1") {
    console.log(`[Zibal] Payment cancelled or uncompleted at gateway for order ${orderNumber}. status=${statusParam}`);
    const updatedResponse = JSON.stringify({
      ...existingGatewayResponse,
      callback: {
        success,
        status: statusParam,
        trackId,
        receivedAt: now,
      },
    });

    // Atomically claim cancellation
    db.run(
      `UPDATE payments SET status = 'cancelled', gateway_response = ?, updated_at = ? WHERE id = ? AND status IN ('pending', 'awaiting_payment')`,
      [updatedResponse, now, payment.id]
    );
    const cancelClaimed = typeof db.getRowsModified === "function" ? db.getRowsModified() : 1;
    if (cancelClaimed === 0) {
      console.log(`[Zibal] Cancellation already handled concurrently for order ${orderNumber}.`);
      return redirectToStatusWithExchangeCode(Number(order.id), orderNumber, Number(order.user_id));
    }

    transitionOrderStatus(db, {
      orderId: Number(order.id),
      paymentId: Number(payment.id),
      targetStatus: "cancelled",
      targetPaymentStatus: "cancelled",
      reason: "gateway_callback_cancelled",
      actorRole: "gateway",
    });

    db.run(
      `INSERT OR IGNORE INTO payment_transactions (
        payment_id, order_id, gateway, event_type, status, amount, currency, reference_id, idempotency_key, payload, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payment.id,
        order.id,
        "zibal",
        "callback_cancelled",
        "cancelled",
        grandTotal,
        currency,
        payment.reference_id || trackId,
        `zibal_cancel_${payment.id}`,
        updatedResponse,
        now,
      ]
    );

    recordAuditLog(db, {
      userId: order.user_id,
      action: "payment_callback_cancelled",
      entityType: "payment",
      entityId: payment.id,
      metadata: { order_id: order.id, order_number: orderNumber, trackId, status: statusParam },
    });

    persistDatabase();

    return redirectToStatusWithExchangeCode(Number(order.id), orderNumber, Number(order.user_id));
  }

  // 5. Server-side Verification with Zibal
  // Atomically claim verification lock to prevent concurrent verification races
  db.run(
    `UPDATE payments SET status = 'verifying', updated_at = ? WHERE id = ? AND status IN ('pending', 'awaiting_payment', 'payment_unknown')`,
    [now, payment.id]
  );
  const verifyClaimed = typeof db.getRowsModified === "function" ? db.getRowsModified() : 1;
  if (verifyClaimed === 0) {
    // Another concurrent request claimed this payment
    return redirectToStatusWithExchangeCode(Number(order.id), orderNumber, Number(order.user_id));
  }

  console.log(`[Zibal] Performing server-side verification with Zibal for trackId: ${trackId}`);
  let isAmbiguous = false;
  let verifyResult: any;
  try {
    verifyResult = await verifyZibalPayment({ trackId });
    if (verifyResult) {
      const resNum = Number(verifyResult.result);
      const msg = String(verifyResult.message || "").toLowerCase();
      if (resNum === -1 || resNum >= 500 || msg.includes("timeout") || msg.includes("unknown") || msg.includes("gateway timeout")) {
        isAmbiguous = true;
      }
    }
  } catch (err: any) {
    console.error("[Zibal] Error / timeout during server verification call:", err?.message);
    isAmbiguous = true;
  }

  // Quarantining UNKNOWN / AMBIGUOUS results without blind status updates or inventory restoration
  if (isAmbiguous) {
    console.warn(`[Zibal] Verification ambiguous/timeout for order ${orderNumber}. Quarantining as payment_unknown.`);
    const updatedResponse = JSON.stringify({
      ...existingGatewayResponse,
      verification_status: "payment_unknown",
      trackId,
      error: "VERIFICATION_TIMEOUT_OR_AMBIGUOUS",
      verifiedAt: now,
    });

    db.run(
      `UPDATE payments SET status = 'payment_unknown', gateway_response = ?, updated_at = ? WHERE id = ?`,
      [updatedResponse, now, payment.id]
    );
    db.run(
      `UPDATE orders SET payment_status = 'payment_unknown', updated_at = ? WHERE id = ?`,
      [now, order.id]
    );

    db.run(
      `INSERT OR IGNORE INTO payment_transactions (
        payment_id, order_id, gateway, event_type, status, amount, currency, reference_id, idempotency_key, payload, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payment.id,
        order.id,
        "zibal",
        "verification_unknown",
        "unknown",
        grandTotal,
        currency,
        payment.reference_id || trackId,
        `zibal_unknown_${payment.id}_${Date.now()}`,
        updatedResponse,
        now,
      ]
    );

    recordAuditLog(db, {
      userId: order.user_id,
      action: "payment_verification_unknown",
      entityType: "payment",
      entityId: payment.id,
      metadata: { order_id: order.id, order_number: orderNumber, trackId, reason: "verification_timeout_or_ambiguous" },
    });

    persistDatabase();

    return redirectToStatusWithExchangeCode(Number(order.id), orderNumber, Number(order.user_id));
  }

  // 6. Check verification status
  if (!verifyResult.isValid) {
    console.warn(`[Zibal] Verification rejected by gateway for order ${orderNumber}. Result: ${verifyResult.result}`);
    const updatedResponse = JSON.stringify({
      ...existingGatewayResponse,
      verification: verifyResult.raw || verifyResult,
      verifiedAt: now,
    });

    db.run(
      `UPDATE payments SET status = 'failed', gateway_response = ?, updated_at = ? WHERE id = ?`,
      [updatedResponse, now, payment.id]
    );

    transitionOrderStatus(db, {
      orderId: Number(order.id),
      paymentId: Number(payment.id),
      targetStatus: "failed",
      targetPaymentStatus: "failed",
      reason: "payment_verification_rejected",
      actorRole: "gateway",
    });

    db.run(
      `INSERT OR IGNORE INTO payment_transactions (
        payment_id, order_id, gateway, event_type, status, amount, currency, reference_id, idempotency_key, payload, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payment.id,
        order.id,
        "zibal",
        "verification_rejected",
        "failed",
        grandTotal,
        currency,
        payment.reference_id || trackId,
        `zibal_rejected_${payment.id}`,
        updatedResponse,
        now,
      ]
    );

    recordAuditLog(db, {
      userId: order.user_id,
      action: "payment_verification_failed",
      entityType: "payment",
      entityId: payment.id,
      metadata: { order_id: order.id, order_number: orderNumber, trackId, result: verifyResult.result },
    });

    persistDatabase();

    return redirectToStatusWithExchangeCode(Number(order.id), orderNumber, Number(order.user_id));
  }

  // 7. Strict Payment Amount Validation
  // Gateway Amount == Payment Amount == Order Grand Total
  const orderGrandTotal = Number(order.grand_total);
  const paymentAmount = Number(payment.amount);

  // A. Verify internal consistency: payment amount in DB must strictly equal order grand total
  if (!Number.isFinite(orderGrandTotal) || orderGrandTotal <= 0 || !Number.isFinite(paymentAmount) || paymentAmount <= 0 || orderGrandTotal !== paymentAmount) {
    console.error(`[Zibal] INTERNAL AMOUNT MISMATCH for order ${orderNumber}! Order: ${orderGrandTotal}, Payment: ${paymentAmount}`);
    const updatedResponse = JSON.stringify({
      ...existingGatewayResponse,
      error: "INTERNAL_AMOUNT_INCONSISTENCY",
      order_grand_total: orderGrandTotal,
      payment_amount: paymentAmount,
      verifiedAt: now,
    });

    db.run(
      `UPDATE payments SET status = 'failed', gateway_response = ?, updated_at = ? WHERE id = ?`,
      [updatedResponse, now, payment.id]
    );
    db.run(
      `UPDATE orders SET status = 'failed', payment_status = 'failed', updated_at = ? WHERE id = ?`,
      [now, order.id]
    );

    restoreOrderInventory(db, Number(order.id), "internal_amount_inconsistency");

    db.run(
      `INSERT OR IGNORE INTO payment_transactions (
        payment_id, order_id, gateway, event_type, status, amount, currency, reference_id, idempotency_key, payload, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payment.id,
        order.id,
        "zibal",
        "internal_amount_inconsistency",
        "failed",
        paymentAmount,
        currency,
        payment.reference_id || trackId,
        `zibal_internal_amount_err_${payment.id}`,
        updatedResponse,
        now,
      ]
    );

    persistDatabase();

    return redirectToStatusWithExchangeCode(Number(order.id), orderNumber, Number(order.user_id));
  }

  // B. Strict verification of Gateway Amount:
  // Must NOT be null, undefined, empty, non-numeric, or non-positive.
  // Under NO circumstances fall back to order grand total!
  const rawGatewayAmount = verifyResult.amount;
  const isValidGatewayAmount = 
    rawGatewayAmount !== null &&
    rawGatewayAmount !== undefined &&
    rawGatewayAmount !== "" &&
    typeof rawGatewayAmount !== "boolean" &&
    !Array.isArray(rawGatewayAmount) &&
    Number.isFinite(Number(rawGatewayAmount)) &&
    Number(rawGatewayAmount) > 0;

  if (!isValidGatewayAmount) {
    console.error(`[Zibal] REJECTED: Gateway amount missing or invalid for order ${orderNumber}! raw:`, rawGatewayAmount);
    const updatedResponse = JSON.stringify({
      ...existingGatewayResponse,
      verification: verifyResult.raw || verifyResult,
      error: "GATEWAY_AMOUNT_MISSING_OR_INVALID",
      raw_gateway_amount: rawGatewayAmount,
      verifiedAt: now,
    });

    db.run(
      `UPDATE payments SET status = 'failed', gateway_response = ?, updated_at = ? WHERE id = ?`,
      [updatedResponse, now, payment.id]
    );

    transitionOrderStatus(db, {
      orderId: Number(order.id),
      paymentId: Number(payment.id),
      targetStatus: "failed",
      targetPaymentStatus: "failed",
      reason: "gateway_amount_missing_or_invalid",
      actorRole: "gateway",
    });

    db.run(
      `INSERT OR IGNORE INTO payment_transactions (
        payment_id, order_id, gateway, event_type, status, amount, currency, reference_id, idempotency_key, payload, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payment.id,
        order.id,
        "zibal",
        "gateway_amount_invalid",
        "failed",
        0,
        currency,
        payment.reference_id || trackId,
        `zibal_amount_invalid_${payment.id}`,
        updatedResponse,
        now,
      ]
    );

    persistDatabase();

    return redirectToStatusWithExchangeCode(Number(order.id), orderNumber, Number(order.user_id));
  }

  const verifiedAmount = Number(rawGatewayAmount);

  // C. Strict three-way check: Gateway Amount == Payment Amount == Order Grand Total
  if (verifiedAmount !== paymentAmount || verifiedAmount !== orderGrandTotal) {
    console.error(`[Zibal] REJECTED: AMOUNT MISMATCH for order ${orderNumber}! Gateway: ${verifiedAmount}, Payment: ${paymentAmount}, Order: ${orderGrandTotal}`);
    const updatedResponse = JSON.stringify({
      ...existingGatewayResponse,
      verification: verifyResult.raw || verifyResult,
      error: "AMOUNT_MISMATCH",
      order_grand_total: orderGrandTotal,
      payment_amount: paymentAmount,
      verified_amount: verifiedAmount,
      verifiedAt: now,
    });

    db.run(
      `UPDATE payments SET status = 'failed', gateway_response = ?, updated_at = ? WHERE id = ?`,
      [updatedResponse, now, payment.id]
    );

    transitionOrderStatus(db, {
      orderId: Number(order.id),
      paymentId: Number(payment.id),
      targetStatus: "failed",
      targetPaymentStatus: "failed",
      reason: "payment_amount_mismatch",
      actorRole: "gateway",
    });

    db.run(
      `INSERT OR IGNORE INTO payment_transactions (
        payment_id, order_id, gateway, event_type, status, amount, currency, reference_id, idempotency_key, payload, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payment.id,
        order.id,
        "zibal",
        "amount_mismatch",
        "failed",
        verifiedAmount,
        currency,
        payment.reference_id || trackId,
        `zibal_amount_mismatch_${payment.id}`,
        updatedResponse,
        now,
      ]
    );

    recordAuditLog(db, {
      userId: order.user_id,
      action: "payment_amount_mismatch",
      entityType: "payment",
      entityId: payment.id,
      metadata: {
        order_id: order.id,
        order_number: orderNumber,
        expected: grandTotal,
        payment_amount: paymentAmount,
        verified: verifiedAmount,
      },
    });

    persistDatabase();

    return redirectToStatusWithExchangeCode(Number(order.id), orderNumber, Number(order.user_id));
  }

  // 8. Finalize Payment & Order as PAID
  // Only reached when Gateway Amount == Payment Amount == Order Grand Total
  const finalRef = verifyResult.refNumber ? String(verifyResult.refNumber) : (payment.reference_id || trackId);
  const updatedResponse = JSON.stringify({
    ...existingGatewayResponse,
    verification: verifyResult.raw || verifyResult,
    verified_amount: verifiedAmount,
    ref_number: finalRef,
    card_number: verifyResult.cardNumber,
    verifiedAt: now,
  });

  db.run(
    `UPDATE payments
     SET status = 'paid', reference_id = ?, gateway_response = ?, updated_at = ?
     WHERE id = ?`,
    [finalRef, updatedResponse, now, payment.id]
  );

  transitionOrderStatus(db, {
    orderId: Number(order.id),
    paymentId: Number(payment.id),
    targetStatus: "paid",
    targetPaymentStatus: "paid",
    reason: "payment_verified",
    actorRole: "system_payment_verification",
  });

  db.run(
    `INSERT OR IGNORE INTO payment_transactions (
      payment_id, order_id, gateway, event_type, status, amount, currency, reference_id, idempotency_key, payload, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payment.id,
      order.id,
      "zibal",
      "verified",
      "paid",
      verifiedAmount,
      currency,
      finalRef,
      `zibal_success_${payment.id}`,
      updatedResponse,
      now,
    ]
  );

  recordAuditLog(db, {
    userId: order.user_id,
    action: "payment_verified_paid",
    entityType: "payment",
    entityId: payment.id,
    metadata: {
      order_id: order.id,
      order_number: orderNumber,
      amount: verifiedAmount,
      reference: finalRef,
    },
  });

  persistDatabase();

  console.log(`[Zibal] Payment verified successfully. Order ${orderNumber} transitioned to PAID. Reference: ${finalRef}`);

  return redirectToStatusWithExchangeCode(Number(order.id), orderNumber, Number(order.user_id));
}

/**
 * Exchange a single-use exchange code for a short-lived payment-status authorization token.
 * Prevents long-lived or reusable tokens from being exposed in browser URLs.
 * Route: POST /api/v1/payments/status/exchange
 *    or: POST /api/v1/payments/status/:identifier/exchange
 */
export async function handleExchangePaymentStatusToken(req: Request, res: Response) {
  res.setHeader("Referrer-Policy", "no-referrer");
  const db = await getDatabase();

  const code = (req.body?.exchange_code || req.body?.code || req.query.exchange_code || req.query.code || req.headers["x-payment-exchange-code"]) as string;
  const orderIdentifier = (req.body?.order || req.body?.order_number || req.body?.identifier || req.params.identifier || req.query.order || req.query.identifier) as string;

  if (!code || !orderIdentifier) {
    return res.status(400).json({
      success: false,
      error_code: "MISSING_EXCHANGE_PARAMETERS",
      message: "شماره سفارش و کد تبادل الزامی است.",
    });
  }

  let authUser: any = null;
  const authHeader = req.headers.authorization;
  if (authHeader) {
    authUser = await TokenService.authenticateBearerToken(authHeader);
  }

  const result = exchangeCodeForStatusToken(db, code, orderIdentifier, authUser?.id);
  if (!result.success) {
    recordAuditLog(db, {
      userId: authUser ? authUser.id : 0,
      action: "payment_status_exchange_failed",
      entityType: "order",
      metadata: {
        identifier: orderIdentifier,
        error_code: result.error,
        ip: req.ip || "127.0.0.1",
      },
    });
    persistDatabase();

    return res.status(result.status || 403).json({
      success: false,
      error_code: result.error,
      message: result.message,
    });
  }

  // Set secure cookie
  res.cookie("payment_status_token", result.token, {
    httpOnly: true,
    secure: req.secure || req.headers["x-forwarded-proto"] === "https",
    sameSite: "lax",
    maxAge: 300000,
    path: "/",
  });

  return res.json({
    success: true,
    data: {
      token: result.token,
      order_id: result.order_id,
      order_number: result.order_number,
      expires_in: result.expires_in,
    },
    message: "کد تبادل با موفقیت به توکن دسترسی تبدیل شد.",
  });
}

/**
 * Diagnostic or polling endpoint for payment status.
 * Route: GET /api/v1/payments/:trackIdOrRef/status
 *    or: GET /api/v1/payments/status/:identifier
 */
export async function handleGetPaymentStatus(req: Request, res: Response) {
  res.setHeader("Referrer-Policy", "no-referrer");
  const db = await getDatabase();
  const rawIdentifier =
    req.params.identifier ||
    req.params.trackIdOrRef ||
    (req.query.order as string) ||
    (req.query.identifier as string);
  const identifier = rawIdentifier ? String(rawIdentifier).trim() : "";

  if (!identifier) {
    return res.status(400).json({
      success: false,
      message: "شناسه پرداخت یا شماره سفارش الزامی است.",
      error_code: "MISSING_IDENTIFIER",
    });
  }

  // 1. Query order and payment records
  const rows = queryRows(
    db,
    `SELECT p.id, p.order_id, p.gateway, p.amount, p.currency, p.status,
            p.reference_id, p.gateway_payment_id, p.payment_url, p.created_at, p.updated_at,
            p.gateway_response,
            o.id AS order_table_id, o.user_id, o.order_number, o.status AS order_status,
            o.payment_status AS order_payment_status, o.grand_total
     FROM orders o
     LEFT JOIN payments p ON p.order_id = o.id
     WHERE o.order_number = ? OR CAST(o.id AS TEXT) = ? OR p.gateway_payment_id = ? OR p.reference_id = ?
     ORDER BY p.id DESC
     LIMIT 1`,
    [identifier, identifier, identifier, identifier]
  );

  if (rows.length === 0) {
    recordAuditLog(db, {
      userId: 0,
      action: "unauthorized_payment_status_lookup",
      entityType: "payment",
      metadata: { identifier, reason: "not_found", ip: req.ip || "127.0.0.1" },
    });
    persistDatabase();
    return res.status(404).json({
      success: false,
      message: "اطلاعات پرداخت یا سفارش یافت نشد.",
      error_code: "PAYMENT_NOT_FOUND",
    });
  }

  const row = rows[0];
  const orderId = Number(row.order_table_id);
  const orderNumber = String(row.order_number);
  const orderUserId = Number(row.user_id);

  // 2. Ownership & Token Authorization check
  let isAuthorized = false;
  let authUser: any = null;

  const authHeader = req.headers.authorization;
  if (authHeader) {
    authUser = await TokenService.authenticateBearerToken(authHeader);
    if (authUser) {
      if (authUser.id === orderUserId || authUser.role === "admin" || authUser.role === "staff") {
        isAuthorized = true;
      }
    }
  }

  // Token authorization: Strictly header or HttpOnly cookie (URL query token is forbidden)
  const headerToken = req.headers["x-payment-status-token"] as string;
  const cookieToken = (req as any).cookies?.payment_status_token as string;
  const statusToken = headerToken || cookieToken;

  if (!isAuthorized && statusToken) {
    const verifiedPayload = verifyPaymentStatusToken(statusToken, orderId, orderNumber);
    if (verifiedPayload) {
      isAuthorized = true;
    }
  }

  // Also support seamless on-the-fly exchange if client passed exchange_code in header
  const exchangeCodeHeader = req.headers["x-payment-exchange-code"] as string;
  if (!isAuthorized && exchangeCodeHeader) {
    const exchangeResult = exchangeCodeForStatusToken(db, exchangeCodeHeader, orderNumber, authUser?.id);
    if (exchangeResult.success) {
      isAuthorized = true;
    }
  }

  if (!isAuthorized) {
    // Record security audit log WITHOUT logging the token value
    recordAuditLog(db, {
      userId: authUser ? authUser.id : 0,
      action: "unauthorized_payment_status_lookup",
      entityType: "payment",
      entityId: row.id ? Number(row.id) : undefined,
      metadata: {
        identifier,
        order_number: orderNumber,
        reason: authUser ? "ownership_mismatch" : "missing_or_invalid_status_token",
        ip: req.ip || "127.0.0.1",
      },
    });
    persistDatabase();

    return res.status(403).json({
      success: false,
      message: "دسترسی به وضعیت این پرداخت مجاز نمی‌باشد.",
      error_code: "PAYMENT_STATUS_FORBIDDEN",
    });
  }

  // 3. Map server payment status
  const rawPaymentStatus = row.status ? String(row.status) : (row.order_payment_status || "pending");
  let displayStatus: PaymentStatusType = "pending";
  if (rawPaymentStatus === "paid") {
    displayStatus = "success";
  } else if (rawPaymentStatus === "failed") {
    displayStatus = "failed";
  } else if (rawPaymentStatus === "cancelled") {
    displayStatus = "cancelled";
  } else if (rawPaymentStatus === "payment_unknown") {
    displayStatus = "unknown";
  } else {
    displayStatus = "pending";
  }

  const gateway = row.gateway || "zibal";
  const paymentMethodName =
    gateway === "zibal"
      ? "پرداخت اینترنتی زیبال"
      : gateway === "wallet"
      ? "کیف پول"
      : gateway === "bank_transfer"
      ? "کارت به کارت / انتقال بانکی"
      : "درگاه پرداخت";

  let parsedError: string | undefined = undefined;
  if (row.gateway_response) {
    try {
      const gRes = JSON.parse(row.gateway_response);
      parsedError = gRes.error || gRes.error_code;
    } catch {}
  }

  return res.json({
    success: true,
    data: {
      order_id: orderId,
      order_number: orderNumber,
      order_status: row.order_status,
      payment_status: rawPaymentStatus,
      status: displayStatus,
      amount: Number(row.amount ?? row.grand_total ?? 0),
      currency: row.currency || "IRT",
      gateway,
      payment_method: paymentMethodName,
      payment_id: row.id ? Number(row.id) : undefined,
      reference_id: row.reference_id || undefined,
      gateway_payment_id: row.gateway_payment_id || undefined,
      track_id: row.gateway_payment_id || undefined,
      error_code: parsedError,
      created_at: row.created_at,
      updated_at: row.updated_at,
    },
    message: "وضعیت پرداخت با موفقیت دریافت شد.",
  });
}

/**
 * Strictly guarded Test Payment Simulation handler
 * Route: /api/v1/payments/test/simulate (GET & POST)
 *
 * Requirements:
 * 1. Rejected if environment or DB is production.
 * 2. Requires Bearer token from an active Admin or Staff user.
 * 3. Requires explicit "payments:simulate" or "*" ability on the token.
 * 4. Requires an existing payment with gateway="test". Rejects Zibal/live gateway payments.
 * 5. Does not accept arbitrary user IDs, amounts, order numbers, or status values from caller.
 * 6. Audit logs the action with actor, paymentId, environment, reason, timestamp.
 */
export async function handleSimulateTestPayment(req: Request, res: Response) {
  const db = await getDatabase();

  // 1. Environment and database mode guard
  const isProduction =
    process.env.APP_ENV === "production" ||
    process.env.NODE_ENV === "production" ||
    process.env.PAYMENT_MODE === "production";

  if (isProduction) {
    return res.status(403).json({
      success: false,
      message: "Test payment simulation is forbidden in production environment.",
      error_code: "SIMULATION_FORBIDDEN_IN_PRODUCTION",
    });
  }

  // 2. Authentication check
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
      error_code: "UNAUTHENTICATED",
    });
  }
  const actor = await TokenService.authenticateBearerToken(req.headers.authorization);
  if (!actor) {
    return res.status(401).json({
      success: false,
      message: "Authentication required or token expired.",
      error_code: "UNAUTHENTICATED",
    });
  }

  // 3. Role authorization check (admin or staff only)
  if (actor.role !== "admin" && actor.role !== "staff") {
    return res.status(403).json({
      success: false,
      message: "Only administrative staff may execute payment simulations.",
      error_code: "FORBIDDEN_ROLE",
    });
  }

  // 4. Token abilities check: strictly requires exact "payments:simulate". Wildcard "*" is NOT permitted.
  const abilities = actor.abilities || [];
  const hasSimulateAbility =
    Array.isArray(abilities) &&
    abilities.includes("payments:simulate");

  if (!hasSimulateAbility) {
    return res.status(403).json({
      success: false,
      message: "Token lacks explicit payments:simulate ability.",
      error_code: "FORBIDDEN_SIMULATION_ABILITY",
    });
  }

  // 5. Validate reference ONLY (strictly ignore caller-specified amount, user_id, status, etc.)
  const rawRef = req.query.reference ?? req.body?.reference;
  const reference = rawRef ? String(rawRef).trim() : "";
  if (!reference) {
    return res.status(422).json({
      success: false,
      message: "The reference field is required.",
      error_code: "VALIDATION_FAILED",
      errors: { reference: ["The reference field is required."] },
    });
  }

  // 6. Locate existing payment record
  const paymentRows = queryRows(
    db,
    `SELECT id, order_id, user_id, gateway, amount, currency, status, reference_id, gateway_payment_id, gateway_response
     FROM payments
     WHERE reference_id = ? OR gateway_payment_id = ? OR id = ?
     LIMIT 1`,
    [reference, reference, isNaN(Number(reference)) ? -1 : Number(reference)]
  );

  if (!paymentRows || paymentRows.length === 0) {
    return res.status(404).json({
      success: false,
      message: `No payment found with reference: ${reference}`,
      error_code: "PAYMENT_NOT_FOUND",
    });
  }

  const payment = paymentRows[0];

  // 7. Gateway guard: ONLY TestPaymentGateway ("test") can be simulated!
  if (payment.gateway !== "test") {
    return res.status(422).json({
      success: false,
      message: `Simulation cannot be performed on '${payment.gateway}' gateway payments. Only dedicated test gateway payments can be simulated.`,
      error_code: "LIVE_PAYMENT_SIMULATION_FORBIDDEN",
    });
  }

  // 8. Idempotency Key Handling: Client-provided X-Idempotency-Key or stable server key
  const rawIdempotencyKey = req.headers["x-idempotency-key"] || req.body?.idempotency_key;
  const idempotencyKey = rawIdempotencyKey
    ? String(rawIdempotencyKey).trim()
    : `sim_stable_${payment.reference_id || payment.id}`;

  // Check if payment is already paid or transaction already recorded with this key for this payment
  const existingTx = queryRows(
    db,
    `SELECT id, payment_id, idempotency_key FROM payment_transactions WHERE payment_id = ? AND idempotency_key = ? LIMIT 1`,
    [payment.id, idempotencyKey]
  );

  if (payment.status === "paid" || existingTx.length > 0) {
    return res.json({
      success: true,
      message: "Test payment already simulated as PAID.",
      data: {
        status: "already_paid",
        payment_id: payment.id,
        payment_status: "paid",
        order_id: payment.order_id,
        idempotency_key: idempotencyKey,
      },
    });
  }

  // 9. Update payment and order to PAID atomically
  const now = new Date().toISOString();
  let existingResponse: any = {};
  try {
    existingResponse = payment.gateway_response ? JSON.parse(payment.gateway_response) : {};
  } catch {
    existingResponse = {};
  }
  const updatedGatewayResponse = JSON.stringify({
    ...existingResponse,
    simulated: true,
    simulated_at: now,
    simulated_by: actor.id,
    idempotency_key: idempotencyKey,
  });

  db.run("BEGIN TRANSACTION");
  try {
    db.run(
      `UPDATE payments SET status = 'paid', gateway_response = ?, updated_at = ? WHERE id = ?`,
      [updatedGatewayResponse, now, payment.id]
    );

    if (payment.order_id) {
      db.run(
        `UPDATE orders SET status = 'paid', payment_status = 'paid', updated_at = ? WHERE id = ?`,
        [now, payment.order_id]
      );
    }

    db.run(
      `INSERT OR IGNORE INTO payment_transactions (payment_id, order_id, gateway, event_type, status, idempotency_key, payload, created_at)
       VALUES (?, ?, 'test', 'simulation', 'paid', ?, ?, ?)`,
      [payment.id, payment.order_id, idempotencyKey, updatedGatewayResponse, now]
    );

    // 10. Record Audit Log (without secrets)
    const reason = req.body?.reason || req.query?.reason || "Staging / automated test simulation";
    recordAuditLog(db, {
      userId: Number(actor.id),
      action: "payment.simulated",
      entityType: "payment",
      entityId: Number(payment.id),
      ipAddress: (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "",
      userAgent: (req.headers["user-agent"] as string) || "",
      metadata: {
        payment_id: payment.id,
        reference_id: payment.reference_id,
        order_id: payment.order_id,
        gateway: payment.gateway,
        amount: payment.amount,
        environment: process.env.APP_ENV || "staging",
        reason: String(reason),
        idempotency_key: idempotencyKey,
        timestamp: now,
      },
    });

    db.run("COMMIT");
    await persistDatabase();

    return res.json({
      success: true,
      message: "Test payment simulated as PAID.",
      data: {
        status: "success",
        payment_id: payment.id,
        payment_status: "paid",
        order_id: payment.order_id,
        idempotency_key: idempotencyKey,
      },
    });
  } catch (err: any) {
    db.run("ROLLBACK");
    console.error("Simulation error:", err);
    return res.status(500).json({
      success: false,
      message: "Simulation processing failed.",
      error_code: "SERVER_ERROR",
    });
  }
}

/**
 * Robust Idempotent Webhook Handler
 * Route: POST /api/v1/payments/webhook/:gateway
 */
export async function handlePaymentWebhook(req: Request, res: Response) {
  const db = await getDatabase();
  const gateway = req.params.gateway || "stripe";
  const payload = req.body || {};
  const headers = req.headers || {};

  const rawIdempKey =
    headers["x-idempotency-key"] ||
    headers["idempotency-key"] ||
    headers["stripe-signature"] ||
    payload.id ||
    payload.event_id ||
    payload.resource?.id ||
    payload.data?.object?.id;

  const referenceId =
    payload.reference_id ||
    payload.data?.object?.id ||
    payload.resource?.id ||
    payload.trackId;

  const eventType =
    payload.type === "payment_intent.succeeded" || payload.event_type === "PAYMENT.CAPTURE.COMPLETED" || payload.status === "paid"
      ? "paid"
      : payload.type === "payment_intent.payment_failed" || payload.status === "failed"
      ? "failed"
      : "pending";

  const cleanRef = referenceId ? String(referenceId).trim() : "none";
  const idempotencyKey = String(rawIdempKey || `webhook_${gateway}_${cleanRef}_${eventType}`).substring(0, 128);

  // 1. Fast check: already processed
  const existingTx = queryRows(
    db,
    `SELECT id, payment_id, idempotency_key, event_type FROM payment_transactions WHERE idempotency_key = ? LIMIT 1`,
    [idempotencyKey]
  );
  if (existingTx.length > 0) {
    return res.status(200).json({
      success: true,
      message: "Webhook processed successfully.",
      data: {
        status: "already_processed",
        idempotency_key: idempotencyKey,
        payment_id: existingTx[0].payment_id,
        payment_status: "paid",
      },
    });
  }

  // 2. Locate Payment
  const paymentRows = queryRows(
    db,
    `SELECT id, order_id, gateway, status, amount, currency, reference_id, gateway_payment_id FROM payments WHERE reference_id = ? OR gateway_payment_id = ? LIMIT 1`,
    [cleanRef, cleanRef]
  );
  if (paymentRows.length === 0) {
    return res.status(404).json({
      success: false,
      message: `Payment with reference ${cleanRef} not found.`,
      error_code: "ENTITY_NOT_FOUND",
    });
  }
  const payment = paymentRows[0];

  // Prevent downgrade if already paid
  if (payment.status === "paid" && (eventType === "failed" || eventType === "pending")) {
    db.run(
      `INSERT OR IGNORE INTO payment_transactions (payment_id, order_id, gateway, event_type, status, idempotency_key, payload, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [payment.id, payment.order_id, gateway, eventType, eventType, idempotencyKey, JSON.stringify(payload)]
    );
    persistDatabase();
    return res.status(200).json({
      success: true,
      message: "Webhook processed successfully.",
      data: {
        status: "ignored_downgrade",
        idempotency_key: idempotencyKey,
        payment_id: payment.id,
        payment_status: payment.status,
      },
    });
  }

  // 3. Atomically record transaction and transition status
  db.run("BEGIN TRANSACTION");
  try {
    db.run(
      `INSERT INTO payment_transactions (payment_id, order_id, gateway, event_type, status, idempotency_key, payload, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [payment.id, payment.order_id, gateway, eventType, eventType, idempotencyKey, JSON.stringify(payload)]
    );

    if (eventType === "paid" && payment.status !== "paid") {
      db.run(`UPDATE payments SET status = 'paid', updated_at = datetime('now') WHERE id = ?`, [payment.id]);
      if (payment.order_id) {
        db.run(`UPDATE orders SET status = 'paid', payment_status = 'paid', updated_at = datetime('now') WHERE id = ?`, [payment.order_id]);

        // Insert SMS delivery record idempotently
        const eventKey = `order-paid-${payment.order_id}`;
        db.run(
          `INSERT OR IGNORE INTO sms_deliveries (event_key, event, recipient, payload, status, created_at, updated_at)
           VALUES (?, 'order_paid', '09121234567', '{}', 'queued', datetime('now'), datetime('now'))`,
          [eventKey]
        );
      }
    } else if (eventType === "failed" && payment.status === "pending") {
      db.run(`UPDATE payments SET status = 'failed', updated_at = datetime('now') WHERE id = ?`, [payment.id]);
      if (payment.order_id) {
        db.run(`UPDATE orders SET payment_status = 'failed', updated_at = datetime('now') WHERE id = ?`, [payment.order_id]);
      }
    }

    db.run("COMMIT");
    persistDatabase();

    return res.status(200).json({
      success: true,
      message: "Webhook processed successfully.",
      data: {
        status: "success",
        idempotency_key: idempotencyKey,
        payment_id: payment.id,
        payment_status: eventType === "paid" ? "paid" : payment.status,
      },
    });
  } catch (err: any) {
    db.run("ROLLBACK");
    // Duplicate key caught
    const existing = queryRows(
      db,
      `SELECT id, payment_id, idempotency_key FROM payment_transactions WHERE idempotency_key = ? LIMIT 1`,
      [idempotencyKey]
    );
    if (existing.length > 0) {
      return res.status(200).json({
        success: true,
        message: "Webhook processed successfully.",
        data: {
          status: "already_processed",
          idempotency_key: idempotencyKey,
          payment_id: existing[0].payment_id,
          payment_status: "paid",
        },
      });
    }
    throw err;
  }
}

