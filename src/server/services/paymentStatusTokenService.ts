import crypto from "crypto";

export interface PaymentStatusTokenPayload {
  order_id: number;
  order_number: string;
  user_id: number;
  purpose: "payment_status";
  exp: number;
  nonce: string;
}

const FORBIDDEN_PLACEHOLDERS = [
  "SomeRandomString",
  "CHANGEME",
  "base64:CHANGEME",
  "YOUR_APP_KEY",
  "secret",
  "placeholder",
];

/**
 * Validates and retrieves the status token signing key.
 * Never uses insecure fallback secrets.
 */
export function getPaymentStatusSigningKey(): string {
  const key = process.env.APP_KEY || process.env.PAYMENT_STATUS_TOKEN_SECRET || process.env.JWT_SECRET;
  const env = (process.env.APP_ENV || process.env.NODE_ENV || "production").trim().toLowerCase();
  const nodeEnv = (process.env.NODE_ENV || "").trim().toLowerCase();
  const isProd = env === "production" || env === "prod";
  const isTest = env === "test" || nodeEnv === "test";

  if (!key) {
    if (isProd) {
      throw new Error("[SECURITY FATAL] APP_KEY is missing in production.");
    }
    if (isTest) {
      return "base64:zP7F+6U556w3Fp6x856vT6l6L9k5z5f6G7h8j9k0l1m=";
    }
    throw new Error("[SECURITY FATAL] APP_KEY is not configured.");
  }

  for (const placeholder of FORBIDDEN_PLACEHOLDERS) {
    if (key.toLowerCase().includes(placeholder.toLowerCase())) {
      throw new Error("[SECURITY FATAL] APP_KEY contains an insecure placeholder.");
    }
  }

  if (key.startsWith("base64:")) {
    const buf = Buffer.from(key.slice(7), "base64");
    if (buf.length < 32) {
      throw new Error("[SECURITY FATAL] APP_KEY base64 decoded length must be at least 32 bytes.");
    }
  } else if (key.length < 32) {
    throw new Error("[SECURITY FATAL] APP_KEY length must be at least 32 characters.");
  }

  return key;
}

/**
 * Retrieves candidate keys for signature verification, supporting key rotation.
 */
export function getPaymentStatusCandidateKeys(): string[] {
  const primary = getPaymentStatusSigningKey();
  const previous = (process.env.APP_PREVIOUS_KEYS || "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  return [primary, ...previous];
}

/**
 * Generates a tamper-proof HMAC-SHA256 signed status token for an order/payment.
 * Strict purpose scope and bounded TTL (default: 30 minutes).
 */
export function generatePaymentStatusToken(
  orderId: number,
  orderNumber: string,
  userId: number,
  ttlSeconds = 1800
): string {
  const payload: PaymentStatusTokenPayload = {
    order_id: orderId,
    order_number: orderNumber,
    user_id: userId,
    purpose: "payment_status",
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
    nonce: crypto.randomBytes(8).toString("hex"),
  };
  const json = JSON.stringify(payload);
  const b64 = Buffer.from(json, "utf-8").toString("base64url");
  const key = getPaymentStatusSigningKey();
  const hmac = crypto.createHmac("sha256", key).update(b64).digest("hex");
  return `${b64}.${hmac}`;
}

/**
 * Validates the HMAC signature, expiration, purpose, and order ownership.
 * Returns the decoded payload if valid, or null if tampered/expired/mismatched.
 */
export function verifyPaymentStatusToken(
  token: string | undefined | null,
  orderId: number,
  orderNumber: string
): PaymentStatusTokenPayload | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.trim().split(".");
  if (parts.length !== 2) return null;

  const [b64, providedHmac] = parts;
  const candidateKeys = getPaymentStatusCandidateKeys();

  let signatureValid = false;
  for (const candidateKey of candidateKeys) {
    try {
      const expectedHmac = crypto.createHmac("sha256", candidateKey).update(b64).digest("hex");
      const providedBuf = Buffer.from(providedHmac, "hex");
      const expectedBuf = Buffer.from(expectedHmac, "hex");
      if (providedBuf.length === expectedBuf.length && crypto.timingSafeEqual(providedBuf, expectedBuf)) {
        signatureValid = true;
        break;
      }
    } catch {
      // Continue to next candidate
    }
  }

  if (!signatureValid) {
    return null;
  }

  try {
    const json = Buffer.from(b64, "base64url").toString("utf-8");
    const payload = JSON.parse(json) as PaymentStatusTokenPayload;
    if (payload.purpose !== "payment_status") return null;
    if (typeof payload.exp !== "number" || Math.floor(Date.now() / 1000) > payload.exp) return null;
    if (orderId > 0 && payload.order_id !== orderId) return null;
    if (orderNumber && payload.order_number !== orderNumber) return null;
    return payload;
  } catch {
    return null;
  }
}
