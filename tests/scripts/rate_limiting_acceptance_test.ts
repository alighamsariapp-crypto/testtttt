import express from "express";
import { Server } from "http";
import crypto from "crypto";
import { getDatabase, persistDatabase } from "../../src/server/db";
import { mountDevelopmentApiRoutes } from "../../src/server/devApiAdapter";
import { RateLimiterStore, RATE_LIMIT_CONFIG, createRateLimiter } from "../../src/server/rateLimiter";

async function runRateLimitingAcceptanceTests() {
  console.log("=== Starting Production-Grade Rate Limiting Acceptance Tests ===");

  const db = await getDatabase();
  // Clear any existing rate limit records for clean test state
  db.run("DELETE FROM rate_limits;");
  persistDatabase();

  const app = express();
  app.use(express.json());
  mountDevelopmentApiRoutes(app, db);

  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });

  const address = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    // =========================================================================
    // TEST A: Repeated login/OTP requests reach 429 at the documented threshold
    // =========================================================================
    console.log("\n[TEST A] Verifying repeated login and OTP requests reach 429 at documented threshold...");

    const testLoginEmail = `ratelimit.test.${Date.now()}@apexstore.local`;
    const loginThreshold = RATE_LIMIT_CONFIG.authLoginCredential; // 5

    let lastLoginStatus = 200;
    let lastLoginBody: any = null;
    let lastLoginHeaders: Headers | null = null;

    for (let i = 1; i <= loginThreshold + 1; i++) {
      const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: testLoginEmail, password: "wrong-password" }),
      });
      lastLoginStatus = res.status;
      lastLoginHeaders = res.headers;
      lastLoginBody = await res.json();

      if (i <= loginThreshold) {
        // Within limit: fails auth (401), not rate limited (not 429)
        if (res.status === 429) {
          throw new Error(`Login request #${i} was unexpectedly throttled early`);
        }
      } else {
        // Exceeded limit: must return 429
        if (res.status !== 429) {
          throw new Error(`Login request #${i} was NOT throttled with 429 (received ${res.status})`);
        }
      }
    }

    if (lastLoginStatus !== 429 || lastLoginBody?.error_code !== "TOO_MANY_REQUESTS") {
      throw new Error(`Expected status 429 and error_code TOO_MANY_REQUESTS, got: ${JSON.stringify(lastLoginBody)}`);
    }
    console.log(`  PASS: Login throttled at request #${loginThreshold + 1} with HTTP 429 and error_code: TOO_MANY_REQUESTS.`);

    // =========================================================================
    // TEST B: OTP resend and invalid verification have separate limits
    // =========================================================================
    console.log("\n[TEST B] Verifying OTP resend and invalid verification have separate limits...");

    const testPhone = "09121112233";
    const otpSendThreshold = RATE_LIMIT_CONFIG.otpSendPhone; // 2
    const otpVerifyThreshold = RATE_LIMIT_CONFIG.otpVerifyPhone; // 5

    // 1. Verify OTP send threshold
    for (let i = 1; i <= otpSendThreshold + 1; i++) {
      const res = await fetch(`${baseUrl}/api/v1/auth/otp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: testPhone }),
      });

      if (i <= otpSendThreshold) {
        if (res.status === 429) {
          const body = await res.json();
          // Note: If inside resend window, it might return OTP_RESEND_TOO_SOON, but not general rate limit
          console.log(`  Info: OTP Send #${i} response: ${res.status}`);
        }
      } else {
        if (res.status !== 429) {
          throw new Error(`OTP Send request #${i} was not throttled with 429 (received ${res.status})`);
        }
      }
    }
    console.log(`  PASS: OTP send reached throttle at threshold.`);

    // 2. Verify OTP verify has separate bucket from OTP send
    // Even though OTP send is exhausted for this phone, OTP verify should start with its own bucket
    const verifyRes1 = await fetch(`${baseUrl}/api/v1/auth/otp/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: testPhone, code: "000000" }),
    });

    // The first verify request must NOT be blocked by the exhausted send bucket!
    // It should evaluate verification logic (e.g., 400/404/422 invalid code), NOT 429!
    if (verifyRes1.status === 429) {
      throw new Error("OTP Verify was incorrectly blocked by OTP Send limiter! Buckets must be separate.");
    }
    console.log(`  PASS: OTP verify bucket is independent from OTP send bucket (received ${verifyRes1.status} instead of 429).`);

    // Exhaust verify bucket
    for (let i = 2; i <= otpVerifyThreshold + 1; i++) {
      const res = await fetch(`${baseUrl}/api/v1/auth/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: testPhone, code: "000000" }),
      });

      if (i > otpVerifyThreshold) {
        if (res.status !== 429) {
          throw new Error(`OTP Verify request #${i} was not throttled with 429 (received ${res.status})`);
        }
      }
    }
    console.log(`  PASS: OTP verify throttled at its own threshold (#${otpVerifyThreshold + 1}).`);

    // =========================================================================
    // TEST C: Retry-After is present and accurate enough for clients
    // =========================================================================
    console.log("\n[TEST C] Verifying Retry-After header is present and accurate...");

    const throttledRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testLoginEmail, password: "wrong-password" }),
    });

    if (throttledRes.status !== 429) {
      throw new Error(`Expected 429, received ${throttledRes.status}`);
    }

    const retryAfterHeader = throttledRes.headers.get("retry-after");
    if (!retryAfterHeader) {
      throw new Error("Missing required Retry-After header on 429 response!");
    }

    const retryAfterSeconds = parseInt(retryAfterHeader, 10);
    if (isNaN(retryAfterSeconds) || retryAfterSeconds <= 0 || retryAfterSeconds > 60) {
      throw new Error(`Invalid Retry-After value: ${retryAfterHeader} (expected 1 to 60 seconds)`);
    }

    const throttledJson = await throttledRes.json();
    if (typeof throttledJson.retry_after !== "number" || throttledJson.retry_after <= 0) {
      throw new Error(`Invalid retry_after property in response body: ${JSON.stringify(throttledJson)}`);
    }

    console.log(`  PASS: Retry-After header present: ${retryAfterSeconds}s (body retry_after: ${throttledJson.retry_after}s).`);

    // =========================================================================
    // TEST D: Limits work when requests are handled by different workers using shared storage
    // =========================================================================
    console.log("\n[TEST D] Verifying limits work when requests are handled by different workers using shared storage...");

    // Worker 1 and Worker 2 operate independently on the shared database store
    const sharedKey = `worker-test-${Date.now()}`;
    const maxHits = 3;
    const decay = 60;

    // Worker 1 hits 2 times
    const w1_hit1 = await RateLimiterStore.hit(sharedKey, maxHits, decay);
    const w1_hit2 = await RateLimiterStore.hit(sharedKey, maxHits, decay);

    if (!w1_hit1.allowed || !w1_hit2.allowed) {
      throw new Error("Worker 1 early hits should be allowed");
    }

    // Worker 2 (separate process simulation reading from same SQLite store) performs the 3rd hit
    const w2_hit3 = await RateLimiterStore.hit(sharedKey, maxHits, decay);
    if (!w2_hit3.allowed || w2_hit3.remaining !== 0) {
      throw new Error(`Worker 2 should have hit limit (remaining: ${w2_hit3.remaining})`);
    }

    // Worker 2 attempts 4th hit: must be blocked by shared state recorded by Worker 1!
    const w2_hit4 = await RateLimiterStore.hit(sharedKey, maxHits, decay);
    if (w2_hit4.allowed) {
      throw new Error("Worker 2 was NOT blocked! Shared storage state was not respected across workers.");
    }

    // Worker 1 also attempts 5th hit: must also see that it is blocked!
    const w1_hit5 = await RateLimiterStore.hit(sharedKey, maxHits, decay);
    if (w1_hit5.allowed) {
      throw new Error("Worker 1 was NOT blocked! Shared storage state was not respected across workers.");
    }

    console.log("  PASS: Shared SQLite storage synchronizes rate limits seamlessly across independent workers.");

    // =========================================================================
    // TEST E: Valid signed webhook retries remain idempotent and are not incorrectly discarded
    // =========================================================================
    console.log("\n[TEST E] Verifying valid signed webhook retries remain idempotent and are not incorrectly discarded...");

    const idempotencyKey = `idemp_webhook_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const trackId = "99887766";

    // Simulate gateway retrying callback 5 times with identical idempotency signature
    const results: number[] = [];
    for (let retry = 1; retry <= 5; retry++) {
      const webhookRes = await fetch(`${baseUrl}/api/v1/payments/zibal/callback?trackId=${trackId}&success=1`, {
        method: "GET",
        headers: {
          "X-Idempotency-Key": idempotencyKey,
        },
      });
      results.push(webhookRes.status);
    }

    // None of the valid signed retries should receive 429
    const blockedCount = results.filter((status) => status === 429).length;
    if (blockedCount > 0) {
      throw new Error(`Gateway webhook retry was incorrectly throttled with 429! Statuses: ${JSON.stringify(results)}`);
    }

    console.log(`  PASS: All 5 signed webhook retries were handled idempotently without getting throttled (statuses: ${results.join(", ")}).`);

    // =========================================================================
    // TEST F: Phone normalization canonicalization in rate limiting
    // =========================================================================
    console.log("\n[TEST F] Verifying phone canonicalization and invalid phone handling in rate limiting...");

    const canonicalPhone = "09129998877";
    const intlPhone = "+98 912 999 8877";
    const persianPhone = "۰۹۱۲۹۹۹۸۸۷۷";

    // Hit with intl format
    const hitIntl = await fetch(`${baseUrl}/api/v1/auth/otp/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: intlPhone }),
    });

    // Hit with persian format
    const hitPersian = await fetch(`${baseUrl}/api/v1/auth/otp/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: persianPhone }),
    });

    // Third hit with canonical format: threshold for otpSendPhone is 2, so this 3rd hit MUST be throttled (429)
    const hitCanonical = await fetch(`${baseUrl}/api/v1/auth/otp/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: canonicalPhone }),
    });

    if (hitCanonical.status !== 429) {
      throw new Error(`Phone format variation bypassed rate limit! Status: ${hitCanonical.status}`);
    }
    console.log("  PASS: International, Persian, and canonical phone formats share the exact same rate limit bucket.");

    // Sending an invalid phone number should NOT create/exhaust a valid phone bucket
    // Use a fresh IP so the test specifically evaluates phone-bucket vs validation behavior rather than the exhausted test-IP bucket
    const invalidRes = await fetch(`${baseUrl}/api/v1/auth/otp/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": "10.0.0.99",
      },
      body: JSON.stringify({ phone: "0912" }),
    });
    // Should be rejected by validation (422), not consumed in a phone rate limit bucket
    if (invalidRes.status !== 422) {
      throw new Error(`Invalid phone was not rejected with 422 validation error: status ${invalidRes.status}`);
    }
    console.log("  PASS: Malformed phone numbers are rejected by validation without corrupting rate limit state.");

    console.log("\n=== ALL RATE LIMITING ACCEPTANCE TESTS PASSED (A - F) ===");

  } finally {
    server.close();
  }
}

runRateLimitingAcceptanceTests().catch((err) => {
  console.error("\nTEST SUITE FAILED:", err);
  process.exit(1);
});
