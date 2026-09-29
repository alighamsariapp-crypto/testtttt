import { Request, Response } from "express";
import crypto from "crypto";
import { getDatabase, persistDatabase, recordAuditLog, runInTransaction } from "./db";
import { authenticateToken } from "./authRoutes";
import { findProductAndVariant, getAvailableStock, getEffectivePrice, getVariantImage } from "./cartRoutes";
import { decrementProductStock, restoreProductStock, restoreOrderInventory, queryRows } from "./adminRoutes";
import { getZibalConfig, requestZibalPayment } from "./services/zibalService";
import { processOrderRefund } from "./services/refundService";
import { transitionOrderStatus } from "./services/orderStateMachine";

export const __testCheckoutFailureInjection = {
  failAfterStockDecrement: false,
  failAfterOrderCreation: false,
  failAfterOrderItemsCreation: false,
  failAfterCouponUpdate: false,
  failAfterPaymentCreation: false,
};

function success(res: Response, data: any, message: string = "عملیات با موفقیت انجام شد.", status: number = 200) {
  return res.status(status).json({
    success: true,
    data,
    message,
  });
}

function error(res: Response, message: string, status: number = 400, errors?: any, errorCode?: string) {
  return res.status(status).json({
    success: false,
    message,
    error_code: errorCode,
    errors,
  });
}

export interface CouponValidationResult {
  valid: boolean;
  error?: string;
  code?: string;
  status?: number;
  coupon?: any;
  discountTotal?: number;
}

export function validateAndCalculateDiscount(
  db: any,
  rawCode: string,
  subtotal: number
): CouponValidationResult {
  const cleanCode = String(rawCode || "").trim().toUpperCase();
  if (!cleanCode) {
    return { valid: false, error: "کد تخفیف الزامی است.", code: "MISSING_COUPON_CODE", status: 422 };
  }

  const rows = queryRows(
    db,
    `SELECT id, code, title, discount_type, discount_value, min_order_amount,
            max_discount_amount, usage_limit, usage_count, starts_at, expires_at,
            is_active, created_at, updated_at
     FROM discount_coupons
     WHERE UPPER(TRIM(code)) = ?
     LIMIT 1`,
    [cleanCode]
  );

  if (rows.length === 0) {
    return {
      valid: false,
      error: `کد تخفیف «${cleanCode}» معتبر نیست یا یافت نشد.`,
      code: "INVALID_COUPON",
      status: 422,
    };
  }

  const coupon = rows[0];

  // Check active status
  if (!coupon.is_active || Number(coupon.is_active) === 0) {
    return {
      valid: false,
      error: `کد تخفیف «${cleanCode}» در حال حاضر غیرفعال است.`,
      code: "COUPON_INACTIVE",
      status: 422,
    };
  }

  // Check start date
  if (coupon.starts_at) {
    const startTime = Date.parse(coupon.starts_at);
    if (!isNaN(startTime) && Date.now() < startTime) {
      return {
        valid: false,
        error: `زمان استفاده از کد تخفیف «${cleanCode}» هنوز فرا نرسیده است.`,
        code: "COUPON_NOT_STARTED",
        status: 422,
      };
    }
  }

  // Check expiration date
  if (coupon.expires_at) {
    const expiryTime = Date.parse(coupon.expires_at);
    if (!isNaN(expiryTime) && Date.now() > expiryTime) {
      return {
        valid: false,
        error: `کد تخفیف «${cleanCode}» منقضی شده است.`,
        code: "COUPON_EXPIRED",
        status: 422,
      };
    }
  }

  // Check usage limit
  const usageLimit = Number(coupon.usage_limit || 0);
  const usageCount = Number(coupon.usage_count || 0);
  if (usageLimit > 0 && usageCount >= usageLimit) {
    return {
      valid: false,
      error: `سقف تعداد دفعات استفاده از کد تخفیف «${cleanCode}» به پایان رسیده است.`,
      code: "COUPON_LIMIT_REACHED",
      status: 422,
    };
  }

  // Check minimum order amount
  const minOrder = Number(coupon.min_order_amount || 0);
  if (minOrder > 0 && subtotal < minOrder) {
    return {
      valid: false,
      error: `حداقل مبلغ خرید برای اعمال کد تخفیف «${cleanCode}»، ${minOrder.toLocaleString("fa-IR")} ریال است.`,
      code: "COUPON_MIN_ORDER_NOT_MET",
      status: 422,
    };
  }

  // Calculate discount
  const discountType = String(coupon.discount_type || "fixed").toLowerCase();
  const discountValue = Number(coupon.discount_value || 0);
  if (discountValue <= 0) {
    return {
      valid: false,
      error: "مقدار تخفیف کوپن نامعتبر است.",
      code: "INVALID_COUPON_VALUE",
      status: 422,
    };
  }

  let calculatedDiscount = 0;
  if (discountType === "percentage") {
    const percent = Math.min(100, Math.max(0, discountValue));
    calculatedDiscount = Math.round((subtotal * percent) / 100);
    const maxDiscount = coupon.max_discount_amount != null && Number(coupon.max_discount_amount) > 0
      ? Number(coupon.max_discount_amount)
      : 0;
    if (maxDiscount > 0) {
      calculatedDiscount = Math.min(calculatedDiscount, maxDiscount);
    }
  } else {
    calculatedDiscount = discountValue;
  }

  // Total discount cannot exceed subtotal
  calculatedDiscount = Math.max(0, Math.min(calculatedDiscount, subtotal));

  return {
    valid: true,
    coupon,
    discountTotal: calculatedDiscount,
  };
}

// Validation endpoint for customer preview (both guest and authenticated)
export async function handleValidateCoupon(req: Request, res: Response) {
  const rawCode = req.body?.code || req.body?.coupon_code || req.body?.coupon || req.query?.code;
  if (!rawCode || typeof rawCode !== "string" || !rawCode.trim()) {
    return error(res, "کد تخفیف الزامی است.", 422, undefined, "MISSING_COUPON_CODE");
  }

  const db = await getDatabase();
  let subtotal = Number(req.body?.subtotal || 0);

  // If subtotal not provided, try to calculate from user's active cart
  if (subtotal <= 0) {
    const user = await authenticateToken(req);
    if (user) {
      const cartQuery = db.exec(`SELECT id FROM carts WHERE user_id = ${user.id} LIMIT 1`);
      if (cartQuery.length > 0 && cartQuery[0].values.length > 0) {
        const cartId = Number(cartQuery[0].values[0][0]);
        const itemsQuery = db.exec(`SELECT product_variant_id, quantity FROM cart_items WHERE cart_id = ${cartId}`);
        if (itemsQuery.length > 0) {
          for (const row of itemsQuery[0].values) {
            const pv = findProductAndVariant(Number(row[0]), db);
            if (pv) {
              subtotal += getEffectivePrice(pv.product, pv.variant, db) * Number(row[1]);
            }
          }
        }
      }
    }
  }

  const result = validateAndCalculateDiscount(db, rawCode, subtotal);
  if (!result.valid) {
    return error(res, result.error!, result.status || 422, undefined, result.code);
  }

  const coupon = result.coupon;
  return success(
    res,
    {
      valid: true,
      code: coupon.code,
      title: coupon.title,
      discount_type: coupon.discount_type,
      discount_value: Number(coupon.discount_value),
      discount_amount: result.discountTotal,
      min_order_amount: Number(coupon.min_order_amount || 0),
      max_discount_amount: coupon.max_discount_amount != null ? Number(coupon.max_discount_amount) : null,
    },
    `کد تخفیف «${coupon.code}» با موفقیت تأیید شد.`
  );
}

export function getUserWalletBalance(db: any, userId: number): number {
  const cleanId = Number(userId);
  if (!cleanId || isNaN(cleanId)) return 0;
  const query = db.exec(`
    SELECT COALESCE(SUM(
      CASE 
        WHEN type IN ('deposit', 'refund', 'cashback') THEN ABS(amount)
        WHEN type IN ('purchase', 'payment', 'withdraw', 'withdrawal') THEN -ABS(amount)
        WHEN type = 'adjustment' THEN amount
        ELSE amount 
      END
    ), 0) FROM wallet_transactions WHERE user_id = ${cleanId} AND status = 'successful'
  `);
  if (query.length > 0 && query[0].values.length > 0) {
    return Number(query[0].values[0][0]);
  }
  return 0;
}

// 1. GET /api/v1/checkout/configuration
export interface AvailablePaymentGateway {
  id: string;
  name: string;
  title: string;
  display_label: string;
  description: string;
  environment: 'production' | 'sandbox' | 'internal' | 'offline' | 'staging' | string;
  environment_label: string;
  is_test: boolean;
  enabled: boolean;
  capabilities: string[];
  currencies: string[];
  disabled_reason?: string | null;
}

export function getAvailablePaymentGateways(forceProduction?: boolean): AvailablePaymentGateway[] {
  const isProduction = forceProduction !== undefined ? forceProduction : process.env.NODE_ENV === "production";
  const zibalConfig = getZibalConfig();
  const gateways: AvailablePaymentGateway[] = [];

  // 1. Zibal (Online Gateway via Shaparak)
  // In production, requires a real configured merchant code.
  // In non-production, the sandbox merchant 'zibal' is valid.
  const zibalConfigured = isProduction
    ? Boolean(zibalConfig.merchant && zibalConfig.merchant !== "zibal")
    : Boolean(zibalConfig.merchant);

  if (zibalConfigured) {
    gateways.push({
      id: "zibal",
      name: "zibal",
      title: "درگاه پرداخت اینترنتی زیبال",
      display_label: "درگاه پرداخت اینترنتی زیبال (کارت‌های بانکی عضو شتاب)",
      description: "پرداخت امن آنلاین از طریق کلیه کارت‌های عضو شبکه بانکی کشور (شاپرک)",
      environment: zibalConfig.isSandbox ? "sandbox" : "production",
      environment_label: zibalConfig.isSandbox ? "آزمایشی (سندباکس)" : "عملیاتی (شاپرک)",
      is_test: false,
      enabled: true,
      capabilities: ["cards_shetab", "instant_verification", "redirect_payment"],
      currencies: ["IRR", "IRT"],
    });
  }

  // 2. Wallet Gateway
  gateways.push({
    id: "wallet",
    name: "wallet",
    title: "کیف پول نوین‌نت",
    display_label: "کسر از اعتبار کیف پول نوین‌نت",
    description: "پرداخت آنی بدون کارمزد از مانده اعتبار حساب کاربری",
    environment: "internal",
    environment_label: "داخلی",
    is_test: false,
    enabled: true,
    capabilities: ["instant_settlement", "zero_gateway_fee"],
    currencies: ["IRR", "IRT"],
  });

  // 3. Bank Transfer Gateway
  gateways.push({
    id: "bank_transfer",
    name: "bank_transfer",
    title: "انتقال بانکی / کارت به کارت",
    display_label: "واریز به حساب / کارت به کارت بانکی",
    description: "واریز وجه و ثبت اطلاعات فیش جهت تأیید واحد مالی",
    environment: "offline",
    environment_label: "آفلاین",
    is_test: false,
    enabled: true,
    capabilities: ["offline_verification", "receipt_upload"],
    currencies: ["IRR", "IRT"],
  });

  // 4. Test Payment Gateway (STAGING / DEV / TEST ONLY - STRICTLY FORBIDDEN IN PRODUCTION)
  if (!isProduction) {
    gateways.push({
      id: "test",
      name: "test",
      title: "درگاه پرداخت شبیه‌ساز (تستی)",
      display_label: "درگاه پرداخت شبیه‌ساز (محیط آزمایشی / تستی)",
      description: "درگاه آزمایشی صرفاً جهت شبیه‌سازی و تست خرید در محیط توسعه (Staging Only)",
      environment: "staging",
      environment_label: "آزمایشی (توسعه / Staging)",
      is_test: true,
      enabled: true,
      capabilities: ["simulator_only", "staging_only"],
      currencies: ["IRR", "IRT"],
    });
  }

  return gateways;
}

export async function handleGetCheckoutConfiguration(_req: Request, res: Response) {
  const zibalConfig = getZibalConfig();
  const gateways = getAvailablePaymentGateways();

  const config = {
    payment: {
      online_enabled: gateways.some((g) => g.id === "zibal"),
      online_provider: "zibal",
      zibal_sandbox: zibalConfig.isSandbox,
      zibal_merchant: zibalConfig.isSandbox ? "zibal" : "",
      wallet_enabled: gateways.some((g) => g.id === "wallet"),
      bank_transfer_enabled: gateways.some((g) => g.id === "bank_transfer"),
      default_method: gateways.some((g) => g.id === "zibal") ? "zibal" : (gateways[0]?.id || "wallet"),
      bank_account_name: "شرکت ارتباطات نوین‌نت",
      bank_card_number: "۶۰۳۷-۹۹۷۵-۱۲۳۴-۵۶۷۸",
      bank_iban: "IR120170000000123456789001",
      gateways,
    },
    gateways,
    shipping: {
      default_method_id: "post",
      methods: [
        {
          id: "post",
          title: "پست پیشتاز",
          description: "ارسال سراسری با رهگیری مرسوله",
          enabled: true,
          base_cost: 450000,
          free_shipping_threshold: 15000000,
        },
        {
          id: "tipax",
          title: "تیپاکس",
          description: "تحویل سریع در شهرهای تحت پوشش",
          enabled: true,
          base_cost: 650000,
          free_shipping_threshold: 0,
        },
        {
          id: "courier",
          title: "پیک شهری",
          description: "ارسال فوری در محدودهٔ شهری",
          enabled: true,
          base_cost: 800000,
          free_shipping_threshold: 0,
        },
      ],
    },
  };

  return success(res, config, "تنظیمات تسویه‌حساب با موفقیت دریافت شد.");
}

// 2. POST /api/v1/checkout
export async function handleCheckout(req: Request, res: Response) {
  const user = await authenticateToken(req);
  if (!user) {
    return error(res, "عدم دسترسی. لطفاً وارد حساب کاربری خود شوید.", 401, undefined, "UNAUTHENTICATED");
  }

  const { shipping_address, payment_gateway, shipping_method, notes } = req.body || {};
  const couponCode = req.body?.coupon_code || req.body?.coupon || req.body?.discount_code || req.body?.code;

  const rawKey = req.body?.idempotency_key || req.headers["idempotency-key"] || req.headers["x-idempotency-key"];
  const idempotencyKey = rawKey ? String(rawKey).trim() : null;

  const db = await getDatabase();

  const addrLine = shipping_address?.address_line || shipping_address?.address;
  if (!shipping_address || !shipping_address.recipient_name || !shipping_address.phone || !addrLine) {
    return error(res, "آدرس تحویل سفارش الزامی است و باید شامل نام گیرنده، شماره تماس و نشانی باشد.", 422, undefined, "MISSING_SHIPPING_ADDRESS");
  }

  // Authoritative Gateway Validation (Backend is Source of Truth)
  const isProduction = process.env.NODE_ENV === "production";
  const availableGateways = getAvailablePaymentGateways(isProduction);
  const availableGatewayIds = availableGateways.map((g) => g.id);

  const rawGateway = String(payment_gateway || "").trim().toLowerCase();
  // Map legacy 'online' alias to server's online provider 'zibal' if zibal is available
  const resolvedGateway = rawGateway === "online" ? "zibal" : rawGateway;

  if (!rawGateway || !availableGatewayIds.includes(resolvedGateway)) {
    return error(
      res,
      `درگاه یا روش پرداخت «${payment_gateway}» نامعتبر است یا در حال حاضر در این محیط فعال نمی‌باشد.`,
      422,
      { available_gateways: availableGatewayIds },
      "INVALID_PAYMENT_GATEWAY"
    );
  }

  const addrStr = `${shipping_address.recipient_name || ""}|${shipping_address.phone || ""}|${addrLine || ""}`.trim().toLowerCase();
  const couponStr = String(couponCode || "").trim().toLowerCase();
  const methodStr = String(shipping_method || "").trim().toLowerCase();
  const gatewayStr = resolvedGateway;

  // 1. Database-enforced Idempotency Handling (Initial Check)
  if (idempotencyKey) {
    const existingClaims = queryRows(
      db,
      `SELECT id, user_id, idempotency_key, request_hash, status, order_id, response_payload, created_at, updated_at
       FROM checkout_idempotency WHERE user_id = ? AND idempotency_key = ? LIMIT 1`,
      [user.id, idempotencyKey]
    );

    if (existingClaims.length > 0) {
      const claim = existingClaims[0];

      // Check payload mismatch if order was already recorded
      if (claim.order_id) {
        const existingOrderRows = queryRows(
          db,
          `SELECT shipping_method, shipping_address_snapshot FROM orders WHERE id = ?`,
          [claim.order_id]
        );
        if (existingOrderRows.length > 0) {
          const ord = existingOrderRows[0];
          let savedAddr: any = {};
          try { savedAddr = JSON.parse(ord.shipping_address_snapshot || "{}"); } catch {}
          const savedAddrLine = savedAddr.address_line || savedAddr.address || "";
          const savedAddrStr = `${savedAddr.recipient_name || ""}|${savedAddr.phone || ""}|${savedAddrLine}`.trim().toLowerCase();
          const savedMethodStr = String(ord.shipping_method || "").trim().toLowerCase();
          if (savedAddrStr !== addrStr || savedMethodStr !== methodStr) {
            return error(
              res,
              "کلید یکتای تسویه‌حساب با داده‌ها یا آدرس متفاوتی قبلاً ارسال شده است.",
              409,
              undefined,
              "IDEMPOTENCY_PAYLOAD_MISMATCH"
            );
          }
        }
      }

      // Completed checkout: return cached authoritative response immediately
      if (claim.status === "completed" && claim.response_payload) {
        try {
          const cached = JSON.parse(claim.response_payload);
          return res.status(200).json({
            ...cached,
            is_idempotent: true,
          });
        } catch {}
      }

      // If in-flight, poll up to 3000ms for completion
      if (claim.status === "processing") {
        const claimUpdated = claim.updated_at || claim.created_at;
        const ageMs = Date.now() - new Date(claimUpdated).getTime();
        if (ageMs > 2 * 60 * 1000) {
          // Crashed attempt recovery: cancel stale order and allow retry
          if (claim.order_id) {
            const ordRows = queryRows(db, `SELECT id, status, payment_status FROM orders WHERE id = ?`, [claim.order_id]);
            if (ordRows.length > 0) {
              const ord = ordRows[0];
              if (ord.status === "pending" || ord.payment_status === "pending") {
                transitionOrderStatus(db, {
                  orderId: Number(ord.id),
                  targetStatus: "cancelled",
                  targetPaymentStatus: "failed",
                  reason: "stale_idempotency_recovery",
                  actorRole: "system_payment_verification",
                });
              }
            }
          }
        } else {
          for (let poll = 0; poll < 30; poll++) {
            await new Promise((resolve) => setTimeout(resolve, 100));
            const polled = queryRows(
              db,
              `SELECT status, response_payload FROM checkout_idempotency WHERE id = ?`,
              [claim.id]
            );
            if (polled.length > 0) {
              if (polled[0].status === "completed" && polled[0].response_payload) {
                try {
                  const cached = JSON.parse(polled[0].response_payload);
                  return res.status(200).json(cached);
                } catch {}
              }
              if (polled[0].status === "failed") {
                break;
              }
            }
          }
          return error(
            res,
            "درخواست تسویه‌حساب با این کلید هم‌اکنون در حال پردازش است. لطفاً چند لحظه دیگر دوباره تلاش کنید.",
            409,
            undefined,
            "IDEMPOTENCY_IN_FLIGHT"
          );
        }
      }
    }
  }

  // Find user's cart
  const cartQuery = db.exec(`SELECT id FROM carts WHERE user_id = ${user.id} LIMIT 1`);
  if (cartQuery.length === 0 || cartQuery[0].values.length === 0) {
    return error(res, "سبد خرید شما خالی است.", 422, undefined, "CART_EMPTY");
  }
  const cartId = Number(cartQuery[0].values[0][0]);

  const itemsQuery = db.exec(`SELECT id, product_variant_id, quantity FROM cart_items WHERE cart_id = ${cartId}`);
  if (itemsQuery.length === 0 || itemsQuery[0].values.length === 0) {
    return error(res, "سبد خرید شما خالی است.", 422, undefined, "CART_EMPTY");
  }

  // Authoritative Request Hash for Idempotency
  const sortedItems = [...itemsQuery[0].values].sort((a, b) => Number(a[1]) - Number(b[1]));
  const itemsStr = sortedItems.map((r) => `${r[1]}:${r[2]}`).join(",");
  const rawHashString = `${user.id}_${itemsStr}_${addrStr}_${couponStr}_${methodStr}_${gatewayStr}`;
  const requestHash = crypto.createHash("sha256").update(rawHashString).digest("hex");

  let isIdempotencyClaimed = false;

  // Claim or verify idempotency key atomically via DB
  if (idempotencyKey) {
    const claimTime = new Date().toISOString();
    const existingClaims = queryRows(
      db,
      `SELECT id, user_id, idempotency_key, request_hash, status, order_id, response_payload, created_at, updated_at
       FROM checkout_idempotency WHERE user_id = ? AND idempotency_key = ? LIMIT 1`,
      [user.id, idempotencyKey]
    );

    if (existingClaims.length > 0) {
      const claim = existingClaims[0];

      // Payload mismatch: conflict
      if (claim.request_hash && claim.request_hash !== requestHash) {
        return error(
          res,
          "کلید یکتای تسویه‌حساب با داده‌ها یا سبد خرید متفاوتی قبلاً ارسال شده است.",
          409,
          undefined,
          "IDEMPOTENCY_PAYLOAD_MISMATCH"
        );
      }

      if (claim.status === "completed" && claim.response_payload) {
        try {
          return res.status(200).json(JSON.parse(claim.response_payload));
        } catch {}
      }

      // Retry failed/stale attempt
      db.run(
        `UPDATE checkout_idempotency SET status = 'processing', request_hash = ?, order_id = NULL, response_payload = NULL, updated_at = ? WHERE id = ?`,
        [requestHash, claimTime, claim.id]
      );
      isIdempotencyClaimed = true;
    } else {
      // First attempt: atomically claim processing status via UNIQUE constraint
      try {
        db.run(
          `INSERT INTO checkout_idempotency (user_id, idempotency_key, request_hash, status, created_at, updated_at)
           VALUES (?, ?, ?, 'processing', ?, ?)`,
          [user.id, idempotencyKey, requestHash, claimTime, claimTime]
        );
        isIdempotencyClaimed = true;
      } catch (claimErr: any) {
        // Another concurrent request claimed it just now: poll for completion
        const polled = queryRows(
          db,
          `SELECT id, status, request_hash, response_payload FROM checkout_idempotency WHERE user_id = ? AND idempotency_key = ? LIMIT 1`,
          [user.id, idempotencyKey]
        );
        if (polled.length > 0) {
          if (polled[0].request_hash && polled[0].request_hash !== requestHash) {
            return error(res, "کلید یکتای تسویه‌حساب با داده‌ها یا سبد خرید متفاوتی قبلاً ارسال شده است.", 409, undefined, "IDEMPOTENCY_PAYLOAD_MISMATCH");
          }
          if (polled[0].status === "completed" && polled[0].response_payload) {
            try {
              return res.status(200).json(JSON.parse(polled[0].response_payload));
            } catch {}
          }
          for (let poll = 0; poll < 30; poll++) {
            await new Promise((resolve) => setTimeout(resolve, 100));
            const repoll = queryRows(db, `SELECT status, response_payload FROM checkout_idempotency WHERE id = ?`, [polled[0].id]);
            if (repoll.length > 0 && repoll[0].status === "completed" && repoll[0].response_payload) {
              try {
                return res.status(200).json(JSON.parse(repoll[0].response_payload));
              } catch {}
            }
          }
        }
        return error(res, "درخواست تسویه‌حساب با این کلید هم‌اکنون در حال پردازش است. لطفاً چند لحظه دیگر دوباره تلاش کنید.", 409, undefined, "IDEMPOTENCY_IN_FLIGHT");
      }
    }
  }

  // Pre-validate all items, quantities and calculate authoritative server-side totals
  interface PreparedItem {
    product: any;
    variant: any;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }
  const preparedItems: PreparedItem[] = [];
  let subtotal = 0;

  for (const row of itemsQuery[0].values) {
    const pvId = Number(row[1]);
    const quantity = Number(row[2]);

    const pv = findProductAndVariant(pvId, db);
    if (!pv) {
      if (isIdempotencyClaimed) {
        db.run(`DELETE FROM checkout_idempotency WHERE user_id = ? AND idempotency_key = ?`, [user.id, idempotencyKey]);
      }
      return error(res, `کالای مورد نظر در سبد خرید یافت نشد (شناسهٔ ${pvId}).`, 422, undefined, "PRODUCT_UNAVAILABLE");
    }

    const { product, variant } = pv;
    const availableStock = getAvailableStock(product, variant, db);
    if (quantity > availableStock) {
      if (isIdempotencyClaimed) {
        db.run(`DELETE FROM checkout_idempotency WHERE user_id = ? AND idempotency_key = ?`, [user.id, idempotencyKey]);
      }
      return error(
        res,
        `موجودی کالای «${product.name}» کافی نیست. موجودی فعلی: ${availableStock}، تعداد درخواستی: ${quantity}`,
        422,
        undefined,
        "INSUFFICIENT_STOCK"
      );
    }

    const unitPrice = getEffectivePrice(product, variant, db);
    const totalPrice = unitPrice * quantity;
    subtotal += totalPrice;

    preparedItems.push({
      product,
      variant,
      quantity,
      unitPrice,
      totalPrice,
    });
  }

  // Server-authoritative calculations
  const taxTotal = Math.round(subtotal * 0.09); // 9% tax

  // Shipping cost resolution
  const selectedMethodId = (shipping_method || "post").toLowerCase();
  let baseShippingCost = 450000;
  let freeShippingThreshold = 15000000;

  if (selectedMethodId === "tipax") {
    baseShippingCost = 650000;
    freeShippingThreshold = 0;
  } else if (selectedMethodId === "courier") {
    baseShippingCost = 800000;
    freeShippingThreshold = 0;
  }

  const shippingCost = freeShippingThreshold > 0 && subtotal >= freeShippingThreshold ? 0 : baseShippingCost;

  // Server-authoritative discount validation & calculation (client totals are strictly ignored)
  let discountTotal = 0;
  let appliedCoupon: any = null;

  if (couponCode && typeof couponCode === "string" && couponCode.trim()) {
    const discountResult = validateAndCalculateDiscount(db, couponCode, subtotal);
    if (!discountResult.valid) {
      if (isIdempotencyClaimed) {
        db.run(`DELETE FROM checkout_idempotency WHERE user_id = ? AND idempotency_key = ?`, [user.id, idempotencyKey]);
      }
      return error(res, discountResult.error!, discountResult.status || 422, undefined, discountResult.code);
    }
    discountTotal = discountResult.discountTotal || 0;
    appliedCoupon = discountResult.coupon;
  }

  const grandTotal = Math.max(0, subtotal + taxTotal + shippingCost - discountTotal);

  // Authoritative server-resolved payment gateway
  const gateway = resolvedGateway;

  if (gateway === "wallet") {
    const currentBalance = getUserWalletBalance(db, user.id);
    if (currentBalance < grandTotal) {
      if (isIdempotencyClaimed) {
        db.run(`DELETE FROM checkout_idempotency WHERE user_id = ? AND idempotency_key = ?`, [user.id, idempotencyKey]);
      }
      return error(
        res,
        `موجودی کیف پول شما (${currentBalance.toLocaleString("fa-IR")} ریال) برای پرداخت این سفارش (${grandTotal.toLocaleString("fa-IR")} ریال) کافی نیست.`,
        422,
        undefined,
        "INSUFFICIENT_WALLET_BALANCE"
      );
    }
  }

  // Generate unique order number & tracking codes
  const uniqueNum = Math.floor(1000 + Math.random() * 9000);
  const orderNumber = `ORD-1403-${uniqueNum}`;
  const trackingCode = `TRK-${Date.now().toString().slice(-6)}${Math.floor(10 + Math.random() * 90)}`;
  const referenceId = `REF-${crypto.randomBytes(6).toString("hex").toUpperCase()}`;

  let orderStatus = gateway === "wallet" ? "processing" : "pending";
  let paymentStatus = gateway === "wallet" ? "paid" : "pending";
  let paymentUrl: string | undefined = undefined;
  let paymentInstructions = "";
  let zibalTrackId: number | undefined = undefined;
  let gatewayPaymentId = referenceId;
  let paymentGatewayResponse = JSON.stringify({ note: "Order placed" });

  if (gateway === "wallet") {
    paymentInstructions = "مبلغ سفارش با موفقیت از اعتبار کیف پول شما کسر گردید.";
  } else if (gateway === "bank_transfer") {
    paymentInstructions = "سفارش ثبت شد. لطفاً فیش واریز را پس از انتقال وجه در بخش پشتیبانی ثبت نمایید.";
  } else if (gateway === "test") {
    paymentInstructions = "سفارش آزمایشی با درگاه شبیه‌ساز (تستی) با موفقیت ثبت شد.";
  }

  const now = new Date().toISOString();

  const shippingSnapshot = JSON.stringify({
    recipient_name: shipping_address.recipient_name,
    phone: shipping_address.phone,
    province: shipping_address.province || "",
    city: shipping_address.city || "",
    postal_code: shipping_address.postal_code || "",
    address_line: addrLine,
  });

  // =========================================================================
  // Phase A: Local Database Operations (Wrapped in an Atomic Transaction)
  // =========================================================================
  let localResult: {
    orderId: number;
    paymentId: number;
    itemsResponse: any[];
  };

  try {
    localResult = runInTransaction(db, () => {
      // 1. Atomically decrement stock for all items
      for (const item of preparedItems) {
        const ok = decrementProductStock(item.variant.id, item.quantity, db);
        if (!ok) {
          throw new Error(`INSUFFICIENT_STOCK: موجودی کالای «${item.product.name}» کافی نیست یا حین ثبت سفارش به اتمام رسید.`);
        }
      }

      if (__testCheckoutFailureInjection.failAfterStockDecrement) {
        throw new Error("SIMULATED_FAIL_AFTER_STOCK_DECREMENT");
      }

      // 2. Insert Order
      db.run(
        `INSERT INTO orders (
          order_number, user_id, status, payment_status, tracking_code,
          subtotal, discount_total, tax_total, shipping_total, grand_total, currency,
          shipping_method, shipping_address_snapshot, billing_address_snapshot, notes,
          idempotency_key, is_inventory_restored, created_at, updated_at
        ) VALUES (?, ?, 'pending', 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
        [
          orderNumber,
          user.id,
          trackingCode,
          subtotal,
          discountTotal,
          taxTotal,
          shippingCost,
          grandTotal,
          "IRR",
          selectedMethodId,
          shippingSnapshot,
          shippingSnapshot,
          notes || "",
          idempotencyKey || null,
          now,
          now,
        ]
      );

      const orderIdQuery = queryRows(db, `SELECT id FROM orders WHERE order_number = ? LIMIT 1`, [orderNumber]);
      if (orderIdQuery.length === 0) {
        throw new Error("FAILED_TO_CREATE_ORDER");
      }
      const orderId = Number(orderIdQuery[0].id);

      if (__testCheckoutFailureInjection.failAfterOrderCreation) {
        throw new Error("SIMULATED_FAIL_AFTER_ORDER_CREATION");
      }

      // 3. Insert Order Items
      const itemsResponse = [];
      for (const item of preparedItems) {
        const variantAttributes = item.variant.attributes ? JSON.stringify(item.variant.attributes) : null;
        const itemDiscount = (discountTotal > 0 && subtotal > 0)
          ? Math.round((item.totalPrice / subtotal) * discountTotal)
          : 0;
        const itemFinalPrice = Math.max(0, item.totalPrice - itemDiscount);

        db.run(
          `INSERT INTO order_items (
            order_id, product_id, product_variant_id, product_name_snapshot,
            variant_sku_snapshot, variant_attributes_snapshot, unit_price, quantity,
            discount_amount, tax_amount, total_price, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            orderId,
            item.product.id,
            item.variant.id,
            item.product.name,
            item.variant.sku || item.product.sku || "",
            variantAttributes,
            item.unitPrice,
            item.quantity,
            itemDiscount,
            0,
            itemFinalPrice,
            now,
            now,
          ]
        );

        itemsResponse.push({
          product_id: item.product.id,
          product_name_snapshot: item.product.name,
          variant_sku_snapshot: item.variant.sku || item.product.sku,
          unit_price: item.unitPrice,
          quantity: item.quantity,
          total_price: itemFinalPrice,
          discount_amount: itemDiscount,
          image_url: getVariantImage(item.product, item.variant, db),
        });
      }

      if (__testCheckoutFailureInjection.failAfterOrderItemsCreation) {
        throw new Error("SIMULATED_FAIL_AFTER_ORDER_ITEMS_CREATION");
      }

      // 4. Atomically increment coupon usage
      if (appliedCoupon) {
        db.run(
          `UPDATE discount_coupons SET usage_count = usage_count + 1, updated_at = ? WHERE id = ?`,
          [now, appliedCoupon.id]
        );
      }

      if (__testCheckoutFailureInjection.failAfterCouponUpdate) {
        throw new Error("SIMULATED_FAIL_AFTER_COUPON_UPDATE");
      }

      // 5. Create initial payment record
      const initialPaymentGateway = gateway;
      const initialPaymentStatus = gateway === "wallet" ? "paid" : "pending";
      const initialGatewayResponse = gateway === "wallet"
        ? JSON.stringify({ method: "wallet", debited: grandTotal })
        : (gateway === "bank_transfer"
            ? JSON.stringify({ method: "bank_transfer" })
            : gateway === "test"
            ? JSON.stringify({ method: "test", mode: "staging_simulator", reference: referenceId })
            : JSON.stringify({ note: "Order placed" }));

      db.run(
        `INSERT INTO payments (
          order_id, user_id, gateway, amount, currency, status,
          reference_id, gateway_payment_id, payment_url, gateway_response, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'IRR', ?, ?, ?, NULL, ?, ?, ?)`,
        [
          orderId,
          user.id,
          initialPaymentGateway,
          grandTotal,
          initialPaymentStatus,
          referenceId,
          referenceId,
          initialGatewayResponse,
          now,
          now,
        ]
      );

      const paymentIdQuery = queryRows(db, `SELECT id FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1`, [orderId]);
      const paymentId = paymentIdQuery.length > 0 ? Number(paymentIdQuery[0].id) : 0;

      // If wallet payment, process wallet debit and status transition atomically inside transaction
      if (gateway === "wallet") {
        const walletBal = getUserWalletBalance(db, user.id);
        if (walletBal < grandTotal) {
          throw new Error("INSUFFICIENT_WALLET_BALANCE");
        }

        db.run(
          `INSERT INTO wallet_transactions (
            user_id, order_id, type, amount, currency, status, reference, description, created_at, updated_at
          ) VALUES (?, ?, 'purchase', ?, 'IRR', 'successful', ?, ?, ?, ?)`,
          [user.id, orderId, grandTotal, referenceId, `پرداخت سفارش ${orderNumber}`, now, now]
        );

        transitionOrderStatus(db, {
          orderId,
          paymentId,
          targetStatus: "processing",
          targetPaymentStatus: "paid",
          reason: "wallet_payment_deducted",
          actorId: user.id,
          actorRole: "customer",
        });
      }

      if (__testCheckoutFailureInjection.failAfterPaymentCreation) {
        throw new Error("SIMULATED_FAIL_AFTER_PAYMENT_CREATION");
      }

      // Link idempotency to order_id
      if (idempotencyKey) {
        db.run(
          `UPDATE checkout_idempotency SET order_id = ?, updated_at = ? WHERE user_id = ? AND idempotency_key = ?`,
          [orderId, now, user.id, idempotencyKey]
        );
      }

      return {
        orderId,
        paymentId,
        itemsResponse,
      };
    });
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    if (isIdempotencyClaimed) {
      db.run(
        `UPDATE checkout_idempotency SET status = 'failed', updated_at = ? WHERE user_id = ? AND idempotency_key = ?`,
        [new Date().toISOString(), user.id, idempotencyKey]
      );
    }
    persistDatabase();

    if (errMsg.startsWith("INSUFFICIENT_STOCK")) {
      const displayMsg = errMsg.replace("INSUFFICIENT_STOCK: ", "").trim();
      return error(res, displayMsg, 422, undefined, "INSUFFICIENT_STOCK");
    }
    if (errMsg === "INSUFFICIENT_WALLET_BALANCE") {
      return error(res, "موجودی کیف پول شما برای این سفارش کافی نیست.", 422, undefined, "INSUFFICIENT_WALLET_BALANCE");
    }

    return error(res, `خطا در ثبت تراکنش سفارش: ${errMsg}`, 500, undefined, "CHECKOUT_TRANSACTION_FAILED");
  }

  const { orderId, paymentId, itemsResponse } = localResult;

  // =========================================================================
  // Phase B: External Gateway Call / Response Finalization
  // =========================================================================
  if (gateway === "zibal") {
    // Online gateway (Zibal)
    const zibalConfig = getZibalConfig();
    const protocol = (req.headers["x-forwarded-proto"] as string) || req.protocol || "http";
    const host = (req.headers["x-forwarded-host"] as string) || req.get("host") || "localhost:3000";
    const callbackUrl = zibalConfig.customCallbackUrl || `${protocol}://${host}/api/v1/payments/zibal/callback`;

    let zibalSuccess = false;
    let zibalErrorMsg = "خطا در برقراری ارتباط با درگاه پرداخت زیبال.";

    try {
      const zibalResult = await requestZibalPayment({
        amount: grandTotal,
        callbackUrl,
        description: `پرداخت سفارش ${orderNumber}`,
        orderId: orderNumber,
        mobile: shipping_address.phone,
      });

      if (zibalResult.result === 100 && zibalResult.trackId > 0) {
        zibalSuccess = true;
        zibalTrackId = zibalResult.trackId;
        gatewayPaymentId = String(zibalResult.trackId);
        paymentUrl = zibalResult.paymentUrl;
        paymentInstructions = "سفارش شما با موفقیت ثبت شد و به درگاه امن زیبال هدایت می‌شوید.";
        paymentGatewayResponse = JSON.stringify({
          trackId: zibalResult.trackId,
          result: zibalResult.result,
          message: zibalResult.message,
          requestedAt: now,
        });

        db.run(
          `UPDATE payments SET
            gateway_payment_id = ?, payment_url = ?, gateway_response = ?, updated_at = ?
           WHERE id = ?`,
          [gatewayPaymentId, paymentUrl, paymentGatewayResponse, now, paymentId]
        );

        db.run(`UPDATE orders SET tracking_code = ?, updated_at = ? WHERE id = ?`, [gatewayPaymentId, now, orderId]);
      } else {
        zibalErrorMsg = zibalResult.message || "خطا در درخواست تراکنش از درگاه زیبال.";
        paymentGatewayResponse = JSON.stringify({
          error: "ZIBAL_REQUEST_REJECTED",
          result: zibalResult.result,
          message: zibalResult.message,
        });
      }
    } catch (err: any) {
      console.error("[Zibal] Error requesting payment:", err?.message);
      zibalErrorMsg = "خطا در اتصال به درگاه زیبال. لطفاً مجدداً تلاش نمایید.";
      paymentGatewayResponse = JSON.stringify({
        error: "ZIBAL_EXCEPTION",
        message: err?.message,
      });
    }

    if (!zibalSuccess) {
      // Record failed payment attempt
      db.run(
        `UPDATE payments SET status = 'failed', gateway_response = ?, updated_at = ? WHERE id = ?`,
        [paymentGatewayResponse, now, paymentId]
      );

      // Transition order to cancelled and restore inventory atomically via state machine
      transitionOrderStatus(db, {
        orderId,
        paymentId,
        targetStatus: "cancelled",
        targetPaymentStatus: "failed",
        reason: "gateway_request_failed",
        actorRole: "system_payment_verification",
      });

      // Roll back coupon usage if applied
      if (appliedCoupon) {
        db.run(`UPDATE discount_coupons SET usage_count = MAX(0, usage_count - 1), updated_at = ? WHERE id = ?`, [now, appliedCoupon.id]);
      }

      if (isIdempotencyClaimed) {
        db.run(
          `UPDATE checkout_idempotency SET status = 'failed', order_id = ?, updated_at = ? WHERE user_id = ? AND idempotency_key = ?`,
          [orderId, now, user.id, idempotencyKey]
        );
      }

      recordAuditLog(db, {
        userId: user.id,
        action: "checkout_gateway_failed",
        entityType: "order",
        entityId: orderId,
        metadata: { order_number: orderNumber, error: zibalErrorMsg },
      });

      persistDatabase();

      return error(
        res,
        zibalErrorMsg,
        502,
        { order_id: orderId, order_number: orderNumber },
        "ZIBAL_REQUEST_FAILED"
      );
    }
  } else if (gateway === "test") {
    gatewayPaymentId = referenceId;
    paymentUrl = `/payment-status?order_number=${encodeURIComponent(orderNumber)}&payment_status=success`;
    paymentInstructions = "سفارش با موفقیت از طریق درگاه شبیه‌ساز (تستی) ثبت شد.";
    paymentGatewayResponse = JSON.stringify({
      mode: "staging_simulator",
      reference: referenceId,
      gateway: "test",
      requestedAt: now,
    });
    db.run(
      `UPDATE payments SET gateway = 'test', gateway_payment_id = ?, payment_url = ?, gateway_response = ?, updated_at = ? WHERE id = ?`,
      [gatewayPaymentId, paymentUrl, paymentGatewayResponse, now, paymentId]
    );
  }

  // Clear user cart only after successful order creation and payment initialization
  db.run(`DELETE FROM cart_items WHERE cart_id = ?`, [cartId]);

  const paymentIntent = {
    gateway,
    payment_status: paymentStatus,
    payment_url: paymentUrl,
    reference_id: referenceId,
    track_id: zibalTrackId ? String(zibalTrackId) : gatewayPaymentId,
    action: paymentUrl ? "redirect" : "ready",
    instructions: paymentInstructions,
  };

  const responsePayload = {
    id: orderId,
    order_id: orderId,
    order_number: orderNumber,
    status: orderStatus,
    payment_status: paymentStatus,
    tracking_code: trackingCode,
    subtotal,
    discount_total: discountTotal,
    tax_total: taxTotal,
    shipping_total: shippingCost,
    grand_total: grandTotal,
    coupon_code: appliedCoupon ? appliedCoupon.code : null,
    currency: "IRR",
    shipping_address_snapshot: JSON.parse(shippingSnapshot),
    items: itemsResponse,
    payment_intent: paymentIntent,
    created_at: now,
  };

  const successResponse = {
    success: true,
    message: "سفارش شما با موفقیت ثبت شد.",
    data: responsePayload,
    order_id: orderId,
    order_number: orderNumber,
    subtotal,
    discount_total: discountTotal,
    tax_total: taxTotal,
    shipping_total: shippingCost,
    grand_total: grandTotal,
    currency: "IRR",
    status: orderStatus,
    payment_status: paymentStatus,
    payment_intent: paymentIntent,
  };

  if (isIdempotencyClaimed) {
    db.run(
      `UPDATE checkout_idempotency SET status = 'completed', order_id = ?, response_payload = ?, updated_at = ?
       WHERE user_id = ? AND idempotency_key = ?`,
      [orderId, JSON.stringify(successResponse), now, user.id, idempotencyKey]
    );
  }

  persistDatabase();

  return res.status(201).json(successResponse);
}

// 3. GET /api/v1/orders
export async function handleGetOrders(req: Request, res: Response) {
  const user = await authenticateToken(req);
  if (!user) {
    return error(res, "عدم دسترسی. لطفاً وارد شوید.", 401, undefined, "UNAUTHENTICATED");
  }

  const db = await getDatabase();
  const ordersQuery = db.exec(
    `SELECT id, order_number, user_id, status, payment_status, tracking_code,
            subtotal, discount_total, tax_total, shipping_total, grand_total, currency,
            shipping_method, shipping_address_snapshot, notes, created_at, updated_at
     FROM orders WHERE user_id = ${user.id} ORDER BY id DESC`
  );

  if (ordersQuery.length === 0 || ordersQuery[0].values.length === 0) {
    return success(res, { data: [], total: 0 }, "لیست سفارش‌ها خالی است.");
  }

  const orders = [];
  for (const row of ordersQuery[0].values) {
    const orderId = Number(row[0]);
    let addressSnapshot: any = {};
    try {
      addressSnapshot = JSON.parse(String(row[13] || "{}"));
    } catch {
      addressSnapshot = {};
    }

    const itemsQuery = db.exec(
      `SELECT id, product_id, product_variant_id, product_name_snapshot,
              variant_sku_snapshot, variant_attributes_snapshot, unit_price, quantity,
              discount_amount, tax_amount, total_price
       FROM order_items WHERE order_id = ${orderId}`
    );

    const items = [];
    if (itemsQuery.length > 0 && itemsQuery[0].values.length > 0) {
      for (const itemRow of itemsQuery[0].values) {
        items.push({
          id: Number(itemRow[0]),
          product_id: Number(itemRow[1]),
          product_variant_id: Number(itemRow[2]),
          product_name_snapshot: String(itemRow[3]),
          variant_sku_snapshot: itemRow[4] ? String(itemRow[4]) : undefined,
          unit_price: Number(itemRow[6]),
          quantity: Number(itemRow[7]),
          total_price: Number(itemRow[10]),
        });
      }
    }

    orders.push({
      id: orderId,
      order_number: String(row[1]),
      user_id: Number(row[2]),
      status: String(row[3]),
      payment_status: String(row[4]),
      tracking_code: row[5] ? String(row[5]) : undefined,
      subtotal: Number(row[6]),
      discount_total: Number(row[7]),
      tax_total: Number(row[8]),
      shipping_total: Number(row[9]),
      grand_total: Number(row[10]),
      currency: String(row[11] || "IRR"),
      shipping_method: String(row[12] || "post"),
      shipping_address_snapshot: addressSnapshot,
      notes: row[14] ? String(row[14]) : undefined,
      items,
      created_at: String(row[15]),
      updated_at: String(row[16]),
    });
  }

  return success(res, { data: orders, total: orders.length }, "لیست سفارش‌ها با موفقیت دریافت شد.");
}

// 4. GET /api/v1/orders/:id
export async function handleGetOrderById(req: Request, res: Response) {
  const user = await authenticateToken(req);
  if (!user) {
    return error(res, "عدم دسترسی. لطفاً وارد شوید.", 401, undefined, "UNAUTHENTICATED");
  }

  const idParam = req.params.id;
  const db = await getDatabase();

  const cleanParam = idParam.replace(/'/g, "''");
  const orderQuery = db.exec(
    `SELECT id, order_number, user_id, status, payment_status, tracking_code,
            subtotal, discount_total, tax_total, shipping_total, grand_total, currency,
            shipping_method, shipping_address_snapshot, notes, created_at, updated_at
     FROM orders WHERE (id = '${cleanParam}' OR order_number = '${cleanParam}') LIMIT 1`
  );

  if (orderQuery.length === 0 || orderQuery[0].values.length === 0) {
    return error(res, "سفارش مورد نظر یافت نشد.", 404);
  }

  const row = orderQuery[0].values[0];
  const orderId = Number(row[0]);
  const orderUserId = Number(row[2]);

  if (orderUserId !== user.id && user.role !== "admin") {
    return error(res, "شما به این سفارش دسترسی ندارید.", 403);
  }

  let addressSnapshot: any = {};
  try {
    addressSnapshot = JSON.parse(String(row[13] || "{}"));
  } catch {
    addressSnapshot = {};
  }

  const itemsQuery = db.exec(
    `SELECT id, product_id, product_variant_id, product_name_snapshot,
            variant_sku_snapshot, variant_attributes_snapshot, unit_price, quantity,
            discount_amount, tax_amount, total_price
     FROM order_items WHERE order_id = ${orderId}`
  );

  const items = [];
  if (itemsQuery.length > 0 && itemsQuery[0].values.length > 0) {
    for (const itemRow of itemsQuery[0].values) {
      items.push({
        id: Number(itemRow[0]),
        product_id: Number(itemRow[1]),
        product_variant_id: Number(itemRow[2]),
        product_name_snapshot: String(itemRow[3]),
        variant_sku_snapshot: itemRow[4] ? String(itemRow[4]) : undefined,
        unit_price: Number(itemRow[6]),
        quantity: Number(itemRow[7]),
        total_price: Number(itemRow[10]),
      });
    }
  }

  const paymentsQuery = db.exec(
    `SELECT id, gateway, amount, currency, status, reference_id, gateway_payment_id, payment_url, created_at
     FROM payments WHERE order_id = ${orderId} ORDER BY id DESC`
  );
  const payments = [];
  if (paymentsQuery.length > 0 && paymentsQuery[0].values.length > 0) {
    for (const pRow of paymentsQuery[0].values) {
      payments.push({
        id: Number(pRow[0]),
        gateway: String(pRow[1]),
        amount: Number(pRow[2]),
        currency: String(pRow[3]),
        status: String(pRow[4]),
        reference_id: pRow[5] ? String(pRow[5]) : undefined,
        gateway_payment_id: pRow[6] ? String(pRow[6]) : undefined,
        payment_url: pRow[7] ? String(pRow[7]) : undefined,
        created_at: String(pRow[8]),
      });
    }
  }

  const orderData = {
    id: orderId,
    order_number: String(row[1]),
    user_id: orderUserId,
    status: String(row[3]),
    payment_status: String(row[4]),
    tracking_code: row[5] ? String(row[5]) : undefined,
    subtotal: Number(row[6]),
    discount_total: Number(row[7]),
    tax_total: Number(row[8]),
    shipping_total: Number(row[9]),
    grand_total: Number(row[10]),
    currency: String(row[11] || "IRR"),
    shipping_method: String(row[12] || "post"),
    shipping_address_snapshot: addressSnapshot,
    notes: row[14] ? String(row[14]) : undefined,
    items,
    payments,
    created_at: String(row[15]),
    updated_at: String(row[16]),
  };

  return success(res, orderData, "اطلاعات سفارش دریافت شد.");
}

// 5. POST /api/v1/orders/:id/cancel
export async function handleCancelOrder(req: Request, res: Response) {
  const user = await authenticateToken(req);
  if (!user) {
    return error(res, "عدم دسترسی. لطفاً وارد شوید.", 401, undefined, "UNAUTHENTICATED");
  }

  const idParam = req.params.id;
  const db = await getDatabase();
  const cleanParam = idParam.replace(/'/g, "''");

  const orderQuery = db.exec(
    `SELECT id, order_number, user_id, status, payment_status, grand_total, shipping_address_snapshot FROM orders WHERE (id = '${cleanParam}' OR order_number = '${cleanParam}') LIMIT 1`
  );

  if (orderQuery.length === 0 || orderQuery[0].values.length === 0) {
    return error(res, "سفارش مورد نظر یافت نشد.", 404);
  }

  const [orderId, orderNumber, orderUserId, status, paymentStatus, grandTotal, rawAddress] = orderQuery[0].values[0];

  if (Number(orderUserId) !== user.id && user.role !== "admin") {
    return error(res, "شما به لغو این سفارش دسترسی ندارید.", 403, undefined, "FORBIDDEN");
  }

  const currentStatusStr = String(status).toLowerCase();
  if (currentStatusStr === "cancelled") {
    return error(res, "این سفارش قبلاً لغو شده است.", 422, undefined, "ORDER_ALREADY_CANCELLED");
  }
  if (currentStatusStr === "refunded") {
    return error(res, "این سفارش قبلاً مرجوع و تسویه شده است.", 422, undefined, "ORDER_ALREADY_REFUNDED");
  }
  if (
    currentStatusStr === "delivered" ||
    currentStatusStr === "shipping" ||
    currentStatusStr === "shipped" ||
    currentStatusStr === "completed"
  ) {
    return error(res, "سفارش ارسال شده یا تکمیل شده قابل لغو نیست.", 422, undefined, "ORDER_CANNOT_BE_CANCELLED");
  }

  const now = new Date().toISOString();

  let nextPaymentStatus = String(paymentStatus);

  // If order was paid, handle refund accurately based on payment method
  if (String(paymentStatus) === "paid") {
    const paymentRows = queryRows(
      db,
      `SELECT id, gateway, amount, status FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1`,
      [Number(orderId)]
    );
    const payment = paymentRows.length > 0 ? paymentRows[0] : null;

    if (payment && payment.gateway === "wallet") {
      const refundRes = await processOrderRefund({
        orderId: Number(orderId),
        userId: user.id,
        reason: "user_cancel_order",
      });
      nextPaymentStatus = refundRes.isSuccessful ? "refunded" : "refund_failed";
    } else {
      // If paid via external gateway (e.g. Zibal), do NOT invent fake wallet credits.
      // Set payment status to 'refund_pending' so financial ledger remains truthful.
      nextPaymentStatus = "refund_pending";
      db.run(`UPDATE payments SET status = 'refund_pending', updated_at = ? WHERE order_id = ?`, [now, orderId]);
    }
  }

  // Transition order status and restore inventory atomically via authoritative state machine
  transitionOrderStatus(db, {
    orderId: Number(orderId),
    targetStatus: "cancelled",
    targetPaymentStatus: nextPaymentStatus,
    reason: "user_cancel_order",
    actorId: user.id,
    actorRole: user.role === "admin" ? "admin" : "customer",
  });

  recordAuditLog(db, {
    userId: user.id,
    action: "cancel_order",
    entityType: "order",
    entityId: Number(orderId),
    metadata: {
      order_number: orderNumber,
      old_status: status,
      new_status: "cancelled",
      old_payment_status: paymentStatus,
      new_payment_status: nextPaymentStatus,
    },
  });

  persistDatabase();

  let addressSnapshot = {};
  try {
    addressSnapshot = JSON.parse(String(rawAddress || "{}"));
  } catch {}

  return success(
    res,
    {
      id: orderId,
      order_number: orderNumber,
      status: "cancelled",
      payment_status: nextPaymentStatus,
      grand_total: Number(grandTotal),
      shipping_address_snapshot: addressSnapshot,
      updated_at: now,
    },
    "سفارش با موفقیت لغو شد و موجودی به انبار بازگردانده شد."
  );
}

// 6. GET /api/v1/users/wallet
export async function handleGetUserWallet(req: Request, res: Response) {
  const user = await authenticateToken(req);
  if (!user) {
    return error(res, "عدم دسترسی. لطفاً وارد شوید.", 401, undefined, "UNAUTHENTICATED");
  }

  const db = await getDatabase();
  const balance = getUserWalletBalance(db, user.id);

  const txQuery = db.exec(
    `SELECT id, order_id, type, amount, currency, status, reference, description, created_at
     FROM wallet_transactions WHERE user_id = ${user.id} ORDER BY id DESC`
  );

  const transactions = [];
  if (txQuery.length > 0 && txQuery[0].values.length > 0) {
    for (const row of txQuery[0].values) {
      transactions.push({
        id: Number(row[0]),
        order_id: row[1] ? Number(row[1]) : undefined,
        type: String(row[2]),
        amount: Number(row[3]),
        currency: String(row[4] || "IRR"),
        status: String(row[5]),
        reference: row[6] ? String(row[6]) : undefined,
        description: row[7] ? String(row[7]) : undefined,
        created_at: String(row[8]),
      });
    }
  }

  return success(
    res,
    {
      balance,
      currency: "IRR",
      transactions: {
        data: transactions,
        total: transactions.length,
      },
    },
    "اطلاعات کیف پول دریافت شد."
  );
}
