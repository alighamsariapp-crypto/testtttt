import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { getDatabase, persistDatabase, queryRows, runInTransaction } from "./db";
import { TokenService } from "./tokenService";
import { tryNormalizeIranianMobile, redactPhone } from "../utils/phone";

export { redactPhone };

export interface RateLimitConfig {
  maxLimit: number;
  decaySeconds: number;
}

export interface RateLimitCheckResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfter: number;
  resetAt: number;
}

const MAX_SQLITE_RETRIES = 5;
const INITIAL_BACKOFF_MS = 10;

/**
 * Handles SQLite busy/locked transient errors with bounded exponential backoff and jitter.
 * Prevents unbounded recursion or cascading crashes under high concurrent load.
 */
async function executeWithBoundedRetry<T>(operation: () => T): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return operation();
    } catch (err: any) {
      attempt++;
      const errorMessage = String(err?.message || "");
      const isLockedOrBusy =
        errorMessage.includes("busy") ||
        errorMessage.includes("locked") ||
        errorMessage.includes("SQLITE_BUSY") ||
        errorMessage.includes("SQLITE_LOCKED");

      if (isLockedOrBusy && attempt <= MAX_SQLITE_RETRIES) {
        const backoff = Math.min(100, INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1)) + Math.random() * 5;
        await new Promise((resolve) => setTimeout(resolve, backoff));
        continue;
      }
      throw err;
    }
  }
}

/**
 * DEVELOPMENT-ONLY EXPRESS RATE LIMITING STORE
 *
 * ARCHITECTURAL NOTICE:
 * Laravel 12 (app/Providers/AppServiceProvider.php, config/rate_limits.php) is the
 * SOLE authoritative production backend for ApexStore rate limiting, utilizing
 * database/Redis distributed caching across multi-worker clusters.
 *
 * This Express SQLite rate limiter is STRICTLY FOR LOCAL DEVELOPMENT, PREVIEW,
 * AND TEST RUNS. sql.js operates in-process WebAssembly memory; SQLite file export
 * cannot guarantee distributed multi-process atomic serialization across independent OS
 * processes without a shared cache server like Redis. Multi-process clustering with
 * sql.js is explicitly unsupported for production rate limiting.
 */
export class RateLimiterStore {
  private static operationLock: Promise<void> = Promise.resolve();
  private static persistQueue: Promise<void> = Promise.resolve();

  /**
   * Serializes in-process asynchronous calls to guarantee atomic read-modify-write cycles
   * and prevent lost increments under high concurrent event loop execution.
   */
  private static async withLock<T>(fn: () => Promise<T> | T): Promise<T> {
    let release: () => void;
    const nextLock = new Promise<void>((resolve) => {
      release = resolve;
    });
    const prevLock = RateLimiterStore.operationLock;
    RateLimiterStore.operationLock = nextLock;
    await prevLock;
    try {
      return await fn();
    } finally {
      release!();
    }
  }

  /**
   * Chains database file persistence sequentially to avoid concurrent writer collision.
   * Note: In-memory sql.js file export cannot synchronize multiple independent OS processes;
   * distributed clustering is unsupported in this development adapter.
   */
  private static schedulePersistence(): void {
    RateLimiterStore.persistQueue = RateLimiterStore.persistQueue.then(() => {
      try {
        persistDatabase();
      } catch (err) {
        console.error("[RateLimiterStore] Persistence warning:", err);
      }
    });
  }

  /**
   * Asserts whether distributed multi-worker clustering is supported.
   * Returns false because sql.js in-memory SQLite cannot synchronize across separate OS processes.
   */
  public static isDistributedSupported(): boolean {
    return false;
  }

  /**
   * Explicitly rejects unsupported multi-worker / cluster environments.
   */
  public static assertSingleProcessOnly(workerId?: string): void {
    if (workerId && workerId !== "single-process" && workerId !== "worker-main") {
      throw new Error(
        `[RateLimiterStore] Multi-worker distributed rate limiting for '${workerId}' is not supported in the development SQLite adapter. ` +
        "Use Laravel 12 with Redis/database rate limiting for production clustering."
      );
    }
  }

  /**
   * Atomically records a hit against a key and returns the rate limit status.
   * Utilizes a single atomic SQLite UPSERT with conditional reset/update within a transaction,
   * bounded retries for transient locks, and in-process mutual exclusion to eliminate lost increments.
   */
  public static async hit(key: string, maxLimit: number, decaySeconds: number): Promise<RateLimitCheckResult> {
    return RateLimiterStore.withLock(async () => {
      const db = await getDatabase();
      const now = Math.floor(Date.now() / 1000);
      const newResetAt = now + decaySeconds;

      const { hits, resetAt } = await executeWithBoundedRetry(() => {
        return runInTransaction(db, () => {
          // Atomic SQLite UPSERT:
          // If key does not exist: insert with hits=1 and reset_at=newResetAt.
          // If key exists: if existing reset_at > now, increment hits; otherwise reset hits to 1 and reset_at to newResetAt.
          db.run(
            `INSERT INTO rate_limits (key, hits, reset_at)
             VALUES (?, 1, ?)
             ON CONFLICT(key) DO UPDATE SET
               hits = CASE WHEN rate_limits.reset_at > ? THEN rate_limits.hits + 1 ELSE 1 END,
               reset_at = CASE WHEN rate_limits.reset_at > ? THEN rate_limits.reset_at ELSE ? END;`,
            [key, newResetAt, now, now, newResetAt]
          );

          const rows = queryRows(
            db,
            "SELECT hits, reset_at FROM rate_limits WHERE key = ?",
            [key]
          ) as { hits: number; reset_at: number }[];

          if (!rows || rows.length === 0) {
            return { hits: 1, resetAt: newResetAt };
          }

          return { hits: rows[0].hits, resetAt: rows[0].reset_at };
        });
      });

      RateLimiterStore.schedulePersistence();

      const allowed = hits <= maxLimit;
      const remaining = Math.max(0, maxLimit - hits);
      const retryAfter = Math.max(1, resetAt - now);

      return {
        allowed,
        limit: maxLimit,
        remaining,
        retryAfter,
        resetAt,
      };
    });
  }

  /**
   * Clears rate limit state for a key.
   */
  public static async reset(key: string): Promise<void> {
    return RateLimiterStore.withLock(async () => {
      const db = await getDatabase();
      await executeWithBoundedRetry(() => {
        runInTransaction(db, () => {
          db.run("DELETE FROM rate_limits WHERE key = ?", [key]);
        });
      });
      RateLimiterStore.schedulePersistence();
    });
  }

  /**
   * Cleans up expired rate limit entries.
   */
  public static async cleanExpired(): Promise<void> {
    return RateLimiterStore.withLock(async () => {
      const db = await getDatabase();
      const now = Math.floor(Date.now() / 1000);
      await executeWithBoundedRetry(() => {
        runInTransaction(db, () => {
          db.run("DELETE FROM rate_limits WHERE reset_at <= ?", [now]);
        });
      });
      RateLimiterStore.schedulePersistence();
    });
  }
}

/**
 * Production-Safe Default Rate Limit Values
 * Configurable via environment variables.
 */
export const RATE_LIMIT_CONFIG = {
  authRegister: Number(process.env.RATE_LIMIT_AUTH_REGISTER || 10),
  authLoginIp: Number(process.env.RATE_LIMIT_AUTH_LOGIN_IP || 15),
  authLoginCredential: Number(process.env.RATE_LIMIT_AUTH_LOGIN_CREDENTIAL || 5),
  otpSendIp: Number(process.env.RATE_LIMIT_OTP_SEND_IP || 3),
  otpSendPhone: Number(process.env.RATE_LIMIT_OTP_SEND_PHONE || 2),
  otpVerifyIp: Number(process.env.RATE_LIMIT_OTP_VERIFY_IP || 10),
  otpVerifyPhone: Number(process.env.RATE_LIMIT_OTP_VERIFY_PHONE || 5),
  passwordResetIp: Number(process.env.RATE_LIMIT_PASSWORD_RESET_IP || 5),
  passwordResetEmail: Number(process.env.RATE_LIMIT_PASSWORD_RESET_EMAIL || 3),
  passwordResetSmsSendIp: Number(process.env.RATE_LIMIT_PASSWORD_RESET_SMS_SEND_IP || 3),
  passwordResetSmsSendPhone: Number(process.env.RATE_LIMIT_PASSWORD_RESET_SMS_SEND_PHONE || 2),
  passwordResetSmsConfirmIp: Number(process.env.RATE_LIMIT_PASSWORD_RESET_SMS_CONFIRM_IP || 10),
  passwordResetSmsConfirmPhone: Number(process.env.RATE_LIMIT_PASSWORD_RESET_SMS_CONFIRM_PHONE || 5),
  oauthGoogle: Number(process.env.RATE_LIMIT_OAUTH_GOOGLE || 15),
  checkout: Number(process.env.RATE_LIMIT_CHECKOUT || 10),
  couponValidate: Number(process.env.RATE_LIMIT_COUPON_VALIDATE || 20),
  paymentWebhook: Number(process.env.RATE_LIMIT_PAYMENT_WEBHOOK || 120),
  paymentStatus: Number(process.env.RATE_LIMIT_PAYMENT_STATUS || 60),
  adminUploads: Number(process.env.RATE_LIMIT_ADMIN_UPLOADS || 30),
  adminMutations: Number(process.env.RATE_LIMIT_ADMIN_MUTATIONS || 60),
  simulationTest: Number(process.env.RATE_LIMIT_SIMULATION_TEST || 10),
};

export type RateLimiterType =
  | "auth-register"
  | "auth-login"
  | "otp-send"
  | "otp-verify"
  | "password-reset"
  | "password-reset-sms-send"
  | "password-reset-sms-confirm"
  | "oauth-google"
  | "checkout"
  | "coupon-validate"
  | "payment-webhook"
  | "payment-status"
  | "admin-uploads"
  | "admin-mutations"
  | "simulation-test";

/**
 * Extracts client IP safely from request.
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || req.socket.remoteAddress || "127.0.0.1";
}

/**
 * Normalizes phone numbers to canonical Iranian mobile format (09xxxxxxxxx).
 * Returns null if the number is not a valid Iranian mobile, preventing
 * malformed inputs from exhausting or bypassing rate-limit buckets.
 */
export function normalizePhone(raw: unknown): string | null {
  return tryNormalizeIranianMobile(raw);
}

/**
 * Normalizes email address (trimmed, lowercase).
 */
export function normalizeEmail(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.trim().toLowerCase();
}

/**
 * Express Middleware Factory for Named Rate Limiters
 */
export function createRateLimiter(type: RateLimiterType) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const ip = getClientIp(req);
    const checks: { key: string; limit: number; decay: number }[] = [];

    switch (type) {
      case "auth-register": {
        checks.push({
          key: `rate:reg:ip:${ip}`,
          limit: RATE_LIMIT_CONFIG.authRegister,
          decay: 60,
        });
        const email = normalizeEmail(req.body?.email);
        if (email) {
          checks.push({
            key: `rate:reg:email:${email}`,
            limit: 5,
            decay: 60,
          });
        }
        break;
      }

      case "auth-login": {
        checks.push({
          key: `rate:login:ip:${ip}`,
          limit: RATE_LIMIT_CONFIG.authLoginIp,
          decay: 60,
        });
        const cred = normalizeEmail(req.body?.email) || normalizePhone(req.body?.phone);
        if (cred) {
          checks.push({
            key: `rate:login:cred:${cred}`,
            limit: RATE_LIMIT_CONFIG.authLoginCredential,
            decay: 60,
          });
        }
        break;
      }

      case "otp-send": {
        checks.push({
          key: `rate:otp-send:ip:${ip}`,
          limit: RATE_LIMIT_CONFIG.otpSendIp,
          decay: 60,
        });
        const phone = normalizePhone(req.body?.phone);
        if (phone) {
          checks.push({
            key: `rate:otp-send:phone:${phone}`,
            limit: RATE_LIMIT_CONFIG.otpSendPhone,
            decay: 60,
          });
        }
        break;
      }

      case "otp-verify": {
        checks.push({
          key: `rate:otp-verify:ip:${ip}`,
          limit: RATE_LIMIT_CONFIG.otpVerifyIp,
          decay: 60,
        });
        const phone = normalizePhone(req.body?.phone);
        if (phone) {
          checks.push({
            key: `rate:otp-verify:phone:${phone}`,
            limit: RATE_LIMIT_CONFIG.otpVerifyPhone,
            decay: 60,
          });
        }
        break;
      }

      case "password-reset": {
        checks.push({
          key: `rate:pwd-reset:ip:${ip}`,
          limit: RATE_LIMIT_CONFIG.passwordResetIp,
          decay: 60,
        });
        const email = normalizeEmail(req.body?.email);
        if (email) {
          checks.push({
            key: `rate:pwd-reset:email:${email}`,
            limit: RATE_LIMIT_CONFIG.passwordResetEmail,
            decay: 60,
          });
        }
        break;
      }

      case "password-reset-sms-send": {
        checks.push({
          key: `rate:pwd-sms-send:ip:${ip}`,
          limit: RATE_LIMIT_CONFIG.passwordResetSmsSendIp,
          decay: 60,
        });
        const phone = normalizePhone(req.body?.phone);
        if (phone) {
          checks.push({
            key: `rate:pwd-sms-send:phone:${phone}`,
            limit: RATE_LIMIT_CONFIG.passwordResetSmsSendPhone,
            decay: 60,
          });
        }
        break;
      }

      case "password-reset-sms-confirm": {
        checks.push({
          key: `rate:pwd-sms-confirm:ip:${ip}`,
          limit: RATE_LIMIT_CONFIG.passwordResetSmsConfirmIp,
          decay: 60,
        });
        const phone = normalizePhone(req.body?.phone);
        if (phone) {
          checks.push({
            key: `rate:pwd-sms-confirm:phone:${phone}`,
            limit: RATE_LIMIT_CONFIG.passwordResetSmsConfirmPhone,
            decay: 60,
          });
        }
        break;
      }

      case "oauth-google": {
        checks.push({
          key: `rate:oauth-google:ip:${ip}`,
          limit: RATE_LIMIT_CONFIG.oauthGoogle,
          decay: 60,
        });
        break;
      }

      case "checkout": {
        let userId: number | null = null;
        const authUser = await TokenService.authenticateBearerToken(req.headers.authorization);
        if (authUser) {
          userId = authUser.id;
        }
        const key = userId ? `rate:checkout:user:${userId}` : `rate:checkout:ip:${ip}`;
        checks.push({
          key,
          limit: RATE_LIMIT_CONFIG.checkout,
          decay: 60,
        });
        break;
      }

      case "coupon-validate": {
        let userId: number | null = null;
        const authUser = await TokenService.authenticateBearerToken(req.headers.authorization);
        if (authUser) {
          userId = authUser.id;
        }
        const key = userId ? `rate:coupon:user:${userId}` : `rate:coupon:ip:${ip}`;
        checks.push({
          key,
          limit: RATE_LIMIT_CONFIG.couponValidate,
          decay: 60,
        });
        break;
      }

      case "payment-webhook": {
        const signature =
          req.headers["x-idempotency-key"] ||
          req.headers["stripe-signature"] ||
          req.headers["x-zibal-signature"] ||
          req.body?.trackId ||
          req.query?.trackId ||
          req.body?.reference_id;

        const key = signature
          ? `rate:webhook:sig:${crypto.createHash("sha256").update(String(signature)).digest("hex")}`
          : `rate:webhook:ip:${ip}`;

        checks.push({
          key,
          limit: RATE_LIMIT_CONFIG.paymentWebhook,
          decay: 60,
        });
        break;
      }

      case "payment-status": {
        let userId: number | null = null;
        const authUser = await TokenService.authenticateBearerToken(req.headers.authorization);
        if (authUser) {
          userId = authUser.id;
        }
        const key = userId ? `rate:payment-status:user:${userId}` : `rate:payment-status:ip:${ip}`;
        checks.push({
          key,
          limit: RATE_LIMIT_CONFIG.paymentStatus,
          decay: 60,
        });
        break;
      }

      case "admin-uploads": {
        let userId: number | null = null;
        const authUser = await TokenService.authenticateBearerToken(req.headers.authorization);
        if (authUser) {
          userId = authUser.id;
        }
        const key = userId ? `rate:admin-upload:user:${userId}` : `rate:admin-upload:ip:${ip}`;
        checks.push({
          key,
          limit: RATE_LIMIT_CONFIG.adminUploads,
          decay: 60,
        });
        break;
      }

      case "admin-mutations": {
        let userId: number | null = null;
        const authUser = await TokenService.authenticateBearerToken(req.headers.authorization);
        if (authUser) {
          userId = authUser.id;
        }
        const key = userId ? `rate:admin-mutation:user:${userId}` : `rate:admin-mutation:ip:${ip}`;
        checks.push({
          key,
          limit: RATE_LIMIT_CONFIG.adminMutations,
          decay: 60,
        });
        break;
      }

      case "simulation-test": {
        let userId: number | null = null;
        const authUser = await TokenService.authenticateBearerToken(req.headers.authorization);
        if (authUser) {
          userId = authUser.id;
        }
        const key = userId ? `rate:sim-test:user:${userId}` : `rate:sim-test:ip:${ip}`;
        checks.push({
          key,
          limit: RATE_LIMIT_CONFIG.simulationTest,
          decay: 60,
        });
        break;
      }
    }

    // Execute checks against shared storage
    for (const check of checks) {
      const resCheck = await RateLimiterStore.hit(check.key, check.limit, check.decay);

      // Set standard RateLimit headers
      res.setHeader("X-RateLimit-Limit", check.limit);
      res.setHeader("X-RateLimit-Remaining", resCheck.remaining);

      if (!resCheck.allowed) {
        res.setHeader("Retry-After", resCheck.retryAfter);

        // Audit Metric Logging (No passwords, OTPs, tokens, or payment payloads logged)
        console.warn(`[RATE_LIMIT_EXCEEDED] Rate limit threshold reached on ${type}`, {
          path: req.path,
          method: req.method,
          ip,
          retryAfter: resCheck.retryAfter,
          keyHash: crypto.createHash("sha256").update(check.key).digest("hex").substring(0, 12),
        });

        return res.status(429).json({
          success: false,
          message: "تعداد درخواست‌ها بیش از حد مجاز است. لطفاً پس از مدتی مجدداً تلاش نمایید (Too many requests).",
          error_code: "TOO_MANY_REQUESTS",
          retry_after: resCheck.retryAfter,
        });
      }
    }

    next();
  };
}
