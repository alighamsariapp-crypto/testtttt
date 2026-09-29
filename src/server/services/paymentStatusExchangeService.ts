import crypto from "crypto";
import { persistDatabase, queryRows } from "../db";
import { generatePaymentStatusToken } from "./paymentStatusTokenService";

export const DEFAULT_EXCHANGE_TTL_SECONDS = 120;
export const STATUS_TOKEN_TTL_SECONDS = 300;

export interface ExchangeResult {
  success: boolean;
  token?: string;
  order_id?: number;
  order_number?: string;
  expires_in?: number;
  error?: string;
  status?: number;
  message?: string;
}

/**
 * Creates a single-use, short-lived exchange code bound to an order.
 * Stored strictly as a SHA-256 hash in the database.
 */
export function createPaymentStatusExchangeCode(
  db: any,
  orderId: number,
  orderNumber: string,
  userId: number = 0,
  ttlSeconds: number = DEFAULT_EXCHANGE_TTL_SECONDS
): string {
  const code = crypto.randomBytes(32).toString("hex");
  const codeHash = crypto.createHash("sha256").update(code).digest("hex");
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  const createdAt = new Date().toISOString();

  db.run(
    `INSERT INTO payment_status_exchanges (code_hash, order_id, order_number, user_id, purpose, expires_at, created_at)
     VALUES (?, ?, ?, ?, 'payment_status', ?, ?)`,
    [codeHash, orderId, orderNumber, userId, expiresAt, createdAt]
  );

  persistDatabase();

  return code;
}

/**
 * Exchanges a single-use exchange code for a short-lived payment-status authorization token.
 * Atomically marks the exchange code as used.
 */
export function exchangeCodeForStatusToken(
  db: any,
  code: string,
  orderIdentifier: string,
  authenticatedUserId?: number
): ExchangeResult {
  const cleanCode = String(code || "").trim();
  const cleanIdentifier = String(orderIdentifier || "").trim();

  if (!cleanCode) {
    return {
      success: false,
      status: 401,
      error: "EXCHANGE_CODE_INVALID",
      message: "کد تبادل نامعتبر است.",
    };
  }

  const codeHash = crypto.createHash("sha256").update(cleanCode).digest("hex");

  const rows = queryRows(
    db,
    `SELECT id, code_hash, order_id, order_number, user_id, purpose, expires_at, used_at
     FROM payment_status_exchanges
     WHERE code_hash = ?
     LIMIT 1`,
    [codeHash]
  );

  if (rows.length === 0) {
    return {
      success: false,
      status: 401,
      error: "EXCHANGE_CODE_INVALID",
      message: "کد تبادل نامعتبر است.",
    };
  }

  const exchange = rows[0];

  if (exchange.used_at) {
    return {
      success: false,
      status: 403,
      error: "EXCHANGE_CODE_ALREADY_USED",
      message: "این کد تبادل قبلاً استفاده شده است و فاقد اعتبار است.",
    };
  }

  const expiryTime = new Date(exchange.expires_at).getTime();
  if (Date.now() > expiryTime) {
    return {
      success: false,
      status: 403,
      error: "EXCHANGE_CODE_EXPIRED",
      message: "کد تبادل منقضی شده است.",
    };
  }

  // Validate order binding
  const matchesOrderNumber = String(exchange.order_number) === cleanIdentifier;
  const matchesOrderId = String(exchange.order_id) === cleanIdentifier;
  if (!matchesOrderNumber && !matchesOrderId) {
    return {
      success: false,
      status: 403,
      error: "EXCHANGE_CODE_ORDER_MISMATCH",
      message: "کد تبادل متعلق به این سفارش نمی‌باشد.",
    };
  }

  // Validate user binding if authenticated
  if (authenticatedUserId && Number(exchange.user_id) > 0 && Number(exchange.user_id) !== Number(authenticatedUserId)) {
    return {
      success: false,
      status: 403,
      error: "EXCHANGE_CODE_USER_MISMATCH",
      message: "دسترسی غیرمجاز: کد تبادل متعلق به کاربر دیگری است.",
    };
  }

  // Atomic invalidation
  const now = new Date().toISOString();
  db.run(
    `UPDATE payment_status_exchanges SET used_at = ? WHERE id = ? AND used_at IS NULL`,
    [now, exchange.id]
  );

  const modified = typeof db.getRowsModified === "function" ? db.getRowsModified() : 1;
  if (modified === 0) {
    return {
      success: false,
      status: 403,
      error: "EXCHANGE_CODE_ALREADY_USED",
      message: "این کد تبادل قبلاً استفاده شده است.",
    };
  }

  persistDatabase();

  // Generate short-lived signed status token
  const token = generatePaymentStatusToken(
    Number(exchange.order_id),
    String(exchange.order_number),
    Number(exchange.user_id),
    STATUS_TOKEN_TTL_SECONDS
  );

  return {
    success: true,
    token,
    order_id: Number(exchange.order_id),
    order_number: String(exchange.order_number),
    expires_in: STATUS_TOKEN_TTL_SECONDS,
  };
}
