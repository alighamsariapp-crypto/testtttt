/**
 * Zibal Payment Gateway Service
 *
 * Implements the official Zibal payment gateway contract (Request, Verify, Start).
 * Keeps credentials, secrets, and URLs isolated behind environment configuration.
 * Provides safe diagnostic logging without leaking secrets or customer data.
 */

export interface ZibalConfig {
  merchant: string;
  isSandbox: boolean;
  baseUrl: string;
  customCallbackUrl?: string;
}

export interface ZibalPaymentRequestParams {
  merchant?: string;
  amount: number; // authoritative amount in IRR (Rials)
  callbackUrl: string;
  description: string;
  orderId: string;
  mobile?: string;
}

export interface ZibalPaymentRequestResult {
  trackId: number;
  result: number;
  message: string;
  paymentUrl: string;
  raw?: any;
}

export interface ZibalVerifyRequestParams {
  merchant?: string;
  trackId: number | string;
}

export interface ZibalVerifyRequestResult {
  isValid: boolean;
  result: number;
  amount?: number; // verified amount in IRR
  refNumber?: string | number;
  cardNumber?: string;
  status?: number;
  paidAt?: string;
  description?: string;
  message?: string;
  raw?: any;
}

export type ZibalHttpClient = (
  endpoint: string,
  payload: Record<string, any>
) => Promise<any>;

let customHttpClient: ZibalHttpClient | null = null;

/**
 * Test seam: allow injecting a custom HTTP client for isolated testing.
 */
export function setZibalHttpClient(client: ZibalHttpClient | null): void {
  customHttpClient = client;
}

/**
 * Resolve active Zibal configuration from environment.
 * Default merchant is 'zibal' in non-production environments to support sandbox testing.
 */
export function getZibalConfig(): ZibalConfig {
  const envMerchant = (process.env.ZIBAL_MERCHANT || "").trim();
  const defaultMerchant = process.env.NODE_ENV !== "production" ? "zibal" : "";
  const merchant = envMerchant || defaultMerchant;

  const isSandbox = process.env.ZIBAL_SANDBOX !== undefined
    ? process.env.ZIBAL_SANDBOX === "true"
    : merchant === "zibal";

  const baseUrl = (process.env.ZIBAL_API_BASE_URL || "https://gateway.zibal.ir").replace(/\/+$/, "");
  const customCallbackUrl = (process.env.ZIBAL_CALLBACK_URL || "").trim();

  return {
    merchant,
    isSandbox,
    baseUrl,
    customCallbackUrl,
  };
}

/**
 * Initiate an online payment request to Zibal.
 * Official endpoint: POST {baseUrl}/v1/request
 */
export async function requestZibalPayment(
  params: ZibalPaymentRequestParams
): Promise<ZibalPaymentRequestResult> {
  const config = getZibalConfig();
  const merchant = params.merchant || config.merchant;

  if (!merchant) {
    console.error("[Zibal] Error: Zibal merchant is not configured in the active environment.");
    throw new Error("ZIBAL_MERCHANT_NOT_CONFIGURED");
  }

  const payload: Record<string, any> = {
    merchant,
    amount: Math.round(params.amount),
    callbackUrl: params.callbackUrl,
    description: params.description,
    orderId: params.orderId,
  };

  if (params.mobile) {
    payload.mobile = String(params.mobile).trim();
  }

  console.log(`[Zibal] Initiating payment request for order: ${params.orderId}, amount: ${payload.amount} IRR`);

  let responseData: any;

  if (customHttpClient) {
    responseData = await customHttpClient("/v1/request", payload);
  } else {
    const url = `${config.baseUrl}/v1/request`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(`[Zibal] HTTP error during payment request. Status: ${response.status}`);
      return {
        trackId: 0,
        result: response.status,
        message: `HTTP error ${response.status}`,
        paymentUrl: "",
      };
    }

    responseData = await response.json();
  }

  const result = typeof responseData?.result === "number" ? responseData.result : Number(responseData?.result ?? 0);
  const trackId = Number(responseData?.trackId);
  const message = String(responseData?.message || "");

  console.log(`[Zibal] Payment request response received: result=${result}, trackId=${trackId}`);

  if (result !== 100 || !Number.isFinite(trackId) || trackId <= 0) {
    return {
      trackId: 0,
      result,
      message: message || "خطا در ایجاد تراکنش درگاه زیبال",
      paymentUrl: "",
      raw: responseData,
    };
  }

  const paymentUrl = `${config.baseUrl}/start/${trackId}`;

  return {
    trackId,
    result,
    message,
    paymentUrl,
    raw: responseData,
  };
}

/**
 * Perform server-to-server payment verification with Zibal.
 * Official endpoint: POST {baseUrl}/v1/verify
 * Result 100: Successfully verified (paid)
 * Result 201: Already verified
 */
export async function verifyZibalPayment(
  params: ZibalVerifyRequestParams
): Promise<ZibalVerifyRequestResult> {
  const config = getZibalConfig();
  const merchant = params.merchant || config.merchant;

  if (!merchant) {
    console.error("[Zibal] Error: Zibal merchant is not configured for verification.");
    throw new Error("ZIBAL_MERCHANT_NOT_CONFIGURED");
  }

  const trackIdNum = Number(params.trackId);
  const payload = {
    merchant,
    trackId: trackIdNum,
  };

  console.log(`[Zibal] Initiating server-to-server verification for trackId: ${trackIdNum}`);

  let responseData: any;

  if (customHttpClient) {
    responseData = await customHttpClient("/v1/verify", payload);
  } else {
    const url = `${config.baseUrl}/v1/verify`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(`[Zibal] HTTP error during verification. Status: ${response.status}`);
      return {
        isValid: false,
        result: response.status,
        message: `HTTP error ${response.status}`,
      };
    }

    responseData = await response.json();
  }

  const result = typeof responseData?.result === "number" ? responseData.result : Number(responseData?.result ?? 0);
  const isValid = result === 100 || result === 201;
  const amount = responseData?.amount !== undefined ? Number(responseData.amount) : undefined;
  const refNumber = responseData?.refNumber ?? responseData?.referenceId;
  const cardNumber = responseData?.cardNumber ? String(responseData.cardNumber) : undefined;
  const status = responseData?.status !== undefined ? Number(responseData.status) : undefined;

  console.log(`[Zibal] Verification response: result=${result}, isValid=${isValid}, verifiedAmount=${amount}, refNumber=${refNumber}`);

  return {
    isValid,
    result,
    amount,
    refNumber,
    cardNumber,
    status,
    paidAt: responseData?.paidAt ? String(responseData.paidAt) : undefined,
    description: responseData?.description ? String(responseData.description) : undefined,
    message: responseData?.message ? String(responseData.message) : undefined,
    raw: responseData,
  };
}

export type ZibalRefundOutcome = "SUCCESS" | "FAILURE" | "UNKNOWN";

export interface ZibalRefundRequestParams {
  merchant?: string;
  trackId: number | string;
  amount: number;
}

export interface ZibalRefundRequestResult {
  outcome: ZibalRefundOutcome;
  isSuccessful: boolean;
  result: number;
  message?: string;
  raw?: any;
}

/**
 * Request an authoritative refund from Zibal gateway for a previously paid transaction.
 * Distinguishes SUCCESS, FAILURE, and UNKNOWN (timeout / network error / ambiguous response).
 */
export async function refundZibalPayment(
  params: ZibalRefundRequestParams
): Promise<ZibalRefundRequestResult> {
  const config = getZibalConfig();
  const merchant = params.merchant || config.merchant;
  const trackIdNum = Number(params.trackId);
  const amountNum = Number(params.amount);

  const payload = {
    merchant,
    trackId: trackIdNum,
    amount: amountNum,
  };

  console.log(`[Zibal] Initiating authoritative refund for trackId: ${trackIdNum}, amount: ${amountNum}`);

  let responseData: any;
  try {
    if (customHttpClient) {
      responseData = await customHttpClient("/v1/refund", payload);
    } else {
      const url = `${config.baseUrl}/v1/refund`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.error(`[Zibal] HTTP error during refund request: status ${response.status}`);
        // 502 Bad Gateway, 503 Service Unavailable, 504 Gateway Timeout: Gateway state is UNKNOWN
        const isAmbiguousHttp = [502, 503, 504, 520, 521, 522, 524].includes(response.status);
        return {
          outcome: isAmbiguousHttp ? "UNKNOWN" : "FAILURE",
          isSuccessful: false,
          result: response.status,
          message: `HTTP error ${response.status}`,
        };
      }

      responseData = await response.json();
    }
  } catch (err: any) {
    console.error(`[Zibal] Network/timeout error during refund:`, err?.message);
    return {
      outcome: "UNKNOWN",
      isSuccessful: false,
      result: -1,
      message: err?.message || "خطای ارتباط یا تایم‌اوت درگاه پرداخت",
    };
  }

  // If injected test mock or client explicitly supplied outcome
  if (responseData?.outcome) {
    const outcome = responseData.outcome as ZibalRefundOutcome;
    return {
      outcome,
      isSuccessful: outcome === "SUCCESS",
      result: Number(responseData.result ?? (outcome === "SUCCESS" ? 100 : 500)),
      message: responseData.message,
      raw: responseData,
    };
  }

  const result = typeof responseData?.result === "number" ? responseData.result : Number(responseData?.result ?? 0);

  // Official Zibal successful refund codes:
  // 100: عملیات با موفقیت انجام شد
  // 1: عملیات موفق
  // 201: تراکنش قبلاً استرداد شده است (موفقیت‌آمیز / قبلاً اعمال شده)
  if (result === 100 || result === 1 || result === 201) {
    console.log(`[Zibal] Refund response received: result=${result}, outcome=SUCCESS`);
    return {
      outcome: "SUCCESS",
      isSuccessful: true,
      result,
      message: responseData?.message || "استرداد وجه با موفقیت انجام شد",
      raw: responseData,
    };
  }

  // Check for timeout / ambiguous indicator in responseData
  if (result === -1 || String(responseData?.message || "").includes("timeout") || String(responseData?.message || "").includes("unknown")) {
    console.log(`[Zibal] Refund response received: result=${result}, outcome=UNKNOWN`);
    return {
      outcome: "UNKNOWN",
      isSuccessful: false,
      result,
      message: responseData?.message || "نتیجه استرداد نامشخص است",
      raw: responseData,
    };
  }

  // Explicit failure response returned by Zibal API
  console.log(`[Zibal] Refund response received: result=${result}, outcome=FAILURE`);
  return {
    outcome: "FAILURE",
    isSuccessful: false,
    result,
    message: responseData?.message || "درخواست استرداد توسط درگاه رد شد",
    raw: responseData,
  };
}

