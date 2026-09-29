import express from "express";
import { Server } from "http";
import {
  createCorsMiddleware,
  normalizeOrigin,
  resolveCorsOrigins,
  validateCorsConfig,
} from "../../src/server/corsMiddleware";

async function runCorsHardeningAcceptanceTests() {
  console.log("=== Starting CORS Security Hardening Acceptance Tests ===");

  // ---------------------------------------------------------------------------
  // TEST B: Production with wildcard or credentials fails validation
  // ---------------------------------------------------------------------------
  console.log("\n[TEST B] Verifying production and credentials validation failure...");

  // B1: Wildcard origin with credentials must fail
  let failedAsExpected = false;
  try {
    validateCorsConfig("development", ["*"], true);
  } catch (err: any) {
    if (err.message.includes("supports_credentials cannot be enabled with wildcard")) {
      failedAsExpected = true;
      console.log("  PASS: Wildcard with credentials threw validation error as expected.");
    }
  }
  if (!failedAsExpected) {
    throw new Error("Expected validation error for wildcard with credentials, but none was thrown.");
  }

  // B2: Wildcard in production must fail
  failedAsExpected = false;
  try {
    validateCorsConfig("production", ["*"], false);
  } catch (err: any) {
    if (err.message.includes("Wildcard origin ('*') is strictly prohibited in production")) {
      failedAsExpected = true;
      console.log("  PASS: Wildcard origin in production threw validation error as expected.");
    }
  }
  if (!failedAsExpected) {
    throw new Error("Expected validation error for wildcard origin in production.");
  }

  // B3: Empty origins in production must fail
  failedAsExpected = false;
  try {
    validateCorsConfig("production", [], false);
  } catch (err: any) {
    if (err.message.includes("CORS_ALLOWED_ORIGINS_PRODUCTION or CORS_ALLOWED_ORIGINS must be set in production")) {
      failedAsExpected = true;
      console.log("  PASS: Empty origins in production threw validation error as expected.");
    }
  }
  if (!failedAsExpected) {
    throw new Error("Expected validation error for empty origins in production.");
  }

  // ---------------------------------------------------------------------------
  // TEST D: Staging and production allowlists are independent
  // ---------------------------------------------------------------------------
  console.log("\n[TEST D] Verifying staging and production allowlist independence...");
  const oldProd = process.env.CORS_ALLOWED_ORIGINS_PRODUCTION;
  const oldStaging = process.env.CORS_ALLOWED_ORIGINS_STAGING;
  const oldDev = process.env.CORS_ALLOWED_ORIGINS;

  try {
    process.env.CORS_ALLOWED_ORIGINS_PRODUCTION = "https://apexstore.ir,https://admin.apexstore.ir";
    process.env.CORS_ALLOWED_ORIGINS_STAGING = "https://staging.apexstore.ir";

    const prodOrigins = resolveCorsOrigins("production");
    const stagingOrigins = resolveCorsOrigins("staging");

    if (
      prodOrigins.includes("https://apexstore.ir") &&
      prodOrigins.includes("https://admin.apexstore.ir") &&
      !prodOrigins.includes("https://staging.apexstore.ir")
    ) {
      console.log("  PASS: Production allowlist correctly resolved and isolated.");
    } else {
      throw new Error(`Production allowlist resolution failed: ${JSON.stringify(prodOrigins)}`);
    }

    if (
      stagingOrigins.includes("https://staging.apexstore.ir") &&
      !stagingOrigins.includes("https://apexstore.ir")
    ) {
      console.log("  PASS: Staging allowlist correctly resolved and isolated.");
    } else {
      throw new Error(`Staging allowlist resolution failed: ${JSON.stringify(stagingOrigins)}`);
    }
  } finally {
    process.env.CORS_ALLOWED_ORIGINS_PRODUCTION = oldProd;
    process.env.CORS_ALLOWED_ORIGINS_STAGING = oldStaging;
    process.env.CORS_ALLOWED_ORIGINS = oldDev;
  }

  // ---------------------------------------------------------------------------
  // Setup Mock Server for HTTP Acceptance Tests (A, C, E, Origin Normalization)
  // ---------------------------------------------------------------------------
  const app = express();
  app.use(express.json());

  // Mount hardened CORS middleware configured with explicit production origins
  app.use(
    createCorsMiddleware({
      appEnv: "staging",
      allowedOrigins: ["https://apexstore.ir", "https://admin.apexstore.ir"],
      supportsCredentials: false,
    })
  );

  app.get("/api/v1/health", (_req, res) => {
    res.json({ status: "ok", message: "Health check passed" });
  });

  app.post("/api/v1/auth/login", (req, res) => {
    res.json({
      success: true,
      data: {
        token: "token_mock_123",
        user: { id: 1, email: "user@apexstore.ir" },
      },
    });
  });

  let server: Server;
  const port = 3995;
  await new Promise<void>((resolve) => {
    server = app.listen(port, () => resolve());
  });

  const baseUrl = `http://127.0.0.1:${port}/api/v1`;

  try {
    // -------------------------------------------------------------------------
    // TEST A: Unknown origins receive NO permissive CORS headers
    // -------------------------------------------------------------------------
    console.log("\n[TEST A] Verifying unknown origins receive no permissive CORS headers...");

    // A1: Standard GET from unknown origin
    const unkGetRes = await fetch(`${baseUrl}/health`, {
      headers: { Origin: "https://malicious-site.com" },
    });
    const allowOrigin = unkGetRes.headers.get("access-control-allow-origin");
    if (!allowOrigin) {
      console.log("  PASS: Unknown origin GET received NO access-control-allow-origin header.");
    } else {
      throw new Error(`Expected NO access-control-allow-origin header, but got "${allowOrigin}"`);
    }

    // A2: Preflight OPTIONS from unknown origin
    const unkOptionsRes = await fetch(`${baseUrl}/health`, {
      method: "OPTIONS",
      headers: {
        Origin: "https://malicious-site.com",
        "Access-Control-Request-Method": "GET",
      },
    });
    if (unkOptionsRes.status === 403 && !unkOptionsRes.headers.get("access-control-allow-origin")) {
      console.log("  PASS: Unknown origin preflight returned 403 Forbidden with NO CORS headers.");
    } else {
      throw new Error(`Expected 403 for unknown origin preflight, got ${unkOptionsRes.status}`);
    }

    // -------------------------------------------------------------------------
    // TEST C: Allowed origin preflight returns only approved methods and headers
    // -------------------------------------------------------------------------
    console.log("\n[TEST C] Verifying allowed origin preflight returns approved methods/headers...");
    const preflightRes = await fetch(`${baseUrl}/auth/login`, {
      method: "OPTIONS",
      headers: {
        Origin: "https://apexstore.ir",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type, Authorization, X-Session-ID",
      },
    });

    if (preflightRes.status !== 204) {
      throw new Error(`Expected 204 No Content for valid preflight, got ${preflightRes.status}`);
    }

    const preflightOrigin = preflightRes.headers.get("access-control-allow-origin");
    const preflightMethods = preflightRes.headers.get("access-control-allow-methods") || "";
    const preflightHeaders = preflightRes.headers.get("access-control-allow-headers") || "";

    if (preflightOrigin === "https://apexstore.ir") {
      console.log("  PASS: Preflight Access-Control-Allow-Origin matched https://apexstore.ir exactly.");
    } else {
      throw new Error(`Expected https://apexstore.ir, got ${preflightOrigin}`);
    }

    const methods = preflightMethods.split(",").map((m) => m.trim());
    if (methods.includes("GET") && methods.includes("POST") && !methods.includes("PATCH")) {
      console.log(`  PASS: Allowed methods restricted to approved API methods: ${preflightMethods}`);
    } else {
      throw new Error(`Unexpected allowed methods: ${preflightMethods}`);
    }

    const headers = preflightHeaders.split(",").map((h) => h.trim());
    if (
      headers.includes("Authorization") &&
      headers.includes("Content-Type") &&
      headers.includes("X-Session-ID") &&
      headers.includes("X-Idempotency-Key")
    ) {
      console.log(`  PASS: Allowed headers restricted to approved client headers: ${preflightHeaders}`);
    } else {
      throw new Error(`Unexpected allowed headers: ${preflightHeaders}`);
    }

    // C2: Disallowed method in preflight
    const disallowedMethodRes = await fetch(`${baseUrl}/auth/login`, {
      method: "OPTIONS",
      headers: {
        Origin: "https://apexstore.ir",
        "Access-Control-Request-Method": "TRACE",
      },
    });
    if (disallowedMethodRes.status === 405) {
      console.log("  PASS: Disallowed preflight method TRACE rejected with 405 Method Not Allowed.");
    } else {
      throw new Error(`Expected 405 for disallowed method, got ${disallowedMethodRes.status}`);
    }

    // -------------------------------------------------------------------------
    // TEST E: Browser login / API requests work from the approved origin
    // -------------------------------------------------------------------------
    console.log("\n[TEST E] Verifying browser login/API requests from approved origin...");
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: {
        Origin: "https://apexstore.ir",
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        email: "user@apexstore.ir",
        password: "SecretPassword123",
      }),
    });

    if (loginRes.status !== 200) {
      throw new Error(`Expected 200 for login from approved origin, got ${loginRes.status}`);
    }

    const loginAllowOrigin = loginRes.headers.get("access-control-allow-origin");
    const loginVary = loginRes.headers.get("vary");
    const loginData = await loginRes.json();

    if (loginAllowOrigin === "https://apexstore.ir" && loginVary === "Origin" && loginData.success === true) {
      console.log("  PASS: Browser login succeeded from approved origin with proper CORS headers.");
    } else {
      throw new Error(`Login CORS headers or response mismatch: Origin=${loginAllowOrigin}, Vary=${loginVary}`);
    }

    // -------------------------------------------------------------------------
    // Non-CORS (Missing Origin header)
    // -------------------------------------------------------------------------
    console.log("\n[EXTRA] Verifying missing Origin header processed normally without CORS headers...");
    const directRes = await fetch(`${baseUrl}/health`);
    if (directRes.status === 200 && !directRes.headers.get("access-control-allow-origin")) {
      console.log("  PASS: Direct server request without Origin header received no CORS headers.");
    } else {
      throw new Error("Direct request should not have received CORS headers.");
    }

    // -------------------------------------------------------------------------
    // Origin normalization check
    // -------------------------------------------------------------------------
    console.log("\n[EXTRA] Verifying origin normalization rules...");
    if (
      normalizeOrigin("https://ApexStore.ir/") === "https://apexstore.ir" &&
      normalizeOrigin("https://apexstore.ir:443/") === "https://apexstore.ir" &&
      normalizeOrigin("http://localhost:3000/") === "http://localhost:3000" &&
      normalizeOrigin("http://example.com:80") === "http://example.com" &&
      normalizeOrigin("invalid-scheme://test") === null
    ) {
      console.log("  PASS: Origin normalization correctly strips default ports, trailing slashes, and lowercases.");
    } else {
      throw new Error("Origin normalization failed unexpected cases.");
    }

    console.log("\n=== ALL CORS SECURITY ACCEPTANCE TESTS PASSED (A - E) ===");
  } finally {
    server!.close();
  }
}

runCorsHardeningAcceptanceTests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("FATAL: CORS Acceptance tests failed:", err);
    process.exit(1);
  });
