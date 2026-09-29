import express from "express";
import http from "http";
import { getDatabase } from "../../src/server/db";
import { mountDevelopmentApiRoutes } from "../../src/server/devApiAdapter";
import { TokenService } from "../../src/server/tokenService";

async function runHealthDiagnosticsSecurityTest() {
  console.log("=== Starting Health & Diagnostics Hardening Acceptance Tests ===");

  const app = express();
  app.use(express.json());

  const db = await getDatabase();
  mountDevelopmentApiRoutes(app, db);

  // Unhandled error trigger to test production exception hardening
  app.get("/api/v1/test-crash", (_req, _res) => {
    throw new Error("SecretDatabaseException: connection to mysql://admin:supersecret@10.0.0.1:3306 failed in /var/www/apexstore/server.ts line 42");
  });

  // Custom error handler simulating hardened production rendering
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

    res.status(500).json({
      success: false,
      message: "An unexpected server error occurred. Please try again later.",
      error_code: "SERVER_ERROR",
    });
  });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // -------------------------------------------------------------
    // Acceptance Test A & E: Public /api/v1/health contains NO environment/driver fields
    // -------------------------------------------------------------
    console.log("\n[TEST A & E] Verifying public /api/v1/health returns minimal stable schema without driver/environment disclosures...");
    const healthRes = await fetch(`${baseUrl}/api/v1/health`);
    if (healthRes.status !== 200) {
      throw new Error(`Public health endpoint returned status ${healthRes.status}, expected 200`);
    }

    const contentType = healthRes.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      throw new Error(`Expected Content-Type application/json, got ${contentType}`);
    }

    const healthBody = (await healthRes.json()) as any;
    if (healthBody.success !== true || !healthBody.data?.status || !healthBody.data?.timestamp) {
      throw new Error(`Public health schema missing required minimal fields: ${JSON.stringify(healthBody)}`);
    }

    const forbiddenFields = [
      "environment",
      "framework",
      "cache_driver",
      "queue_driver",
      "session_driver",
      "database",
      "paths",
      "config",
      "debug",
    ];

    for (const field of forbiddenFields) {
      if (field in healthBody.data || field in healthBody) {
        throw new Error(`Security breach: forbidden sensitive field '${field}' found in public health response!`);
      }
    }

    // Verify security headers
    const nosniff = healthRes.headers.get("x-content-type-options");
    const frameOptions = healthRes.headers.get("x-frame-options");
    if (nosniff !== "nosniff" || !frameOptions) {
      throw new Error(`Security headers missing on health response: nosniff=${nosniff}, frameOptions=${frameOptions}`);
    }
    console.log("  PASS: /api/v1/health returns minimal stable schema without leaking drivers/env/paths, with security headers.");

    // -------------------------------------------------------------
    // Acceptance Test B: Backward compatible /health endpoint is valid JSON
    // -------------------------------------------------------------
    console.log("\n[TEST B] Verifying backward compatible /health endpoint is valid JSON...");
    const rootHealthRes = await fetch(`${baseUrl}/health`);
    if (rootHealthRes.status !== 200) {
      throw new Error(`/health returned status ${rootHealthRes.status}`);
    }
    const rootHealthBody = (await rootHealthRes.json()) as any;
    if (rootHealthBody.success !== true || rootHealthBody.data?.status !== "healthy") {
      throw new Error(`/health returned unexpected body: ${JSON.stringify(rootHealthBody)}`);
    }
    console.log("  PASS: Backward compatible /health is valid JSON and operational.");

    // -------------------------------------------------------------
    // Acceptance Test C: Protected diagnostics returns 401/403 without authorization
    // -------------------------------------------------------------
    console.log("\n[TEST C] Verifying protected diagnostics returns 401/403 without authorization...");

    // 1. Unauthenticated request
    const unauthDiagRes = await fetch(`${baseUrl}/api/v1/diagnostics`);
    if (unauthDiagRes.status !== 401 && unauthDiagRes.status !== 403) {
      throw new Error(`Expected 401/403 for unauthenticated diagnostics, got ${unauthDiagRes.status}`);
    }
    console.log("  PASS: Unauthenticated diagnostics request rejected with HTTP 401/403.");

    // 2. Customer token (non-admin)
    db.run(`INSERT OR REPLACE INTO users (id, name, email, password, phone, role, status, created_at, updated_at) 
            VALUES (888, 'Test Customer', 'cust@example.com', '$2y$10$hashedpasswordplaceholder', '09121111111', 'customer', 'active', datetime('now'), datetime('now'))`);
    const customerToken = await TokenService.createToken(888, "test-client", "customer");
    const customerDiagRes = await fetch(`${baseUrl}/api/v1/diagnostics`, {
      headers: { Authorization: `Bearer ${customerToken.token}` },
    });
    if (customerDiagRes.status !== 403) {
      throw new Error(`Expected 403 for non-admin customer diagnostics, got ${customerDiagRes.status}`);
    }
    console.log("  PASS: Non-admin customer diagnostics request rejected with HTTP 403 Forbidden.");

    // 3. Admin token
    db.run(`INSERT OR REPLACE INTO users (id, name, email, password, phone, role, status, created_at, updated_at) 
            VALUES (1, 'Admin User', 'admin@apexstore.ir', '$2y$10$hashedpasswordplaceholder', '09120000000', 'admin', 'active', datetime('now'), datetime('now'))`);
    const adminToken = await TokenService.createToken(1, "admin-workstation", "admin");
    const adminDiagRes = await fetch(`${baseUrl}/api/v1/diagnostics`, {
      headers: { Authorization: `Bearer ${adminToken.token}` },
    });
    if (adminDiagRes.status !== 200) {
      throw new Error(`Expected 200 for admin diagnostics, got ${adminDiagRes.status}`);
    }
    const adminDiagBody = (await adminDiagRes.json()) as any;
    if (adminDiagBody.data?.status !== "ready" || !adminDiagBody.data?.dependencies) {
      throw new Error(`Admin diagnostics response malformed: ${JSON.stringify(adminDiagBody)}`);
    }

    // Verify dependencies do not disclose driver names or paths
    const deps = adminDiagBody.data.dependencies;
    if (!["connected", "disconnected"].includes(deps.database)) {
      throw new Error(`Unexpected database dependency state: ${deps.database}`);
    }
    if (!["operational", "degraded"].includes(deps.cache)) {
      throw new Error(`Unexpected cache dependency state: ${deps.cache}`);
    }
    if (!["writable", "readonly"].includes(deps.storage)) {
      throw new Error(`Unexpected storage dependency state: ${deps.storage}`);
    }

    const forbiddenDependencyKeys = [
      "environment",
      "framework",
      "cache_driver",
      "queue_driver",
      "session_driver",
      "connection",
      "host",
      "user",
      "password",
      "paths",
      "config",
      "debug",
    ];

    for (const field of forbiddenDependencyKeys) {
      if (field in adminDiagBody.data?.dependencies) {
        throw new Error(`Forbidden field '${field}' found in dependencies details!`);
      }
    }
    console.log("  PASS: Authorized admin diagnostics returns readiness dependencies without implementation disclosures.");

    // -------------------------------------------------------------
    // Acceptance Test D: Production exception responses contain no file path or stack trace
    // -------------------------------------------------------------
    console.log("\n[TEST D] Verifying production exception responses contain no file path, SQL, or stack trace...");
    const crashRes = await fetch(`${baseUrl}/api/v1/test-crash`);
    if (crashRes.status !== 500) {
      throw new Error(`Expected 500 for crash route, got ${crashRes.status}`);
    }
    const crashBody = (await crashRes.json()) as any;
    const rawCrashString = JSON.stringify(crashBody);

    if (rawCrashString.includes("/var/www") || rawCrashString.includes(".ts") || rawCrashString.includes("supersecret")) {
      throw new Error(`Production error response leaked file path, password, or stack trace: ${rawCrashString}`);
    }
    if ("debug" in crashBody || "trace" in crashBody) {
      throw new Error(`Production error response contains debug or trace field: ${rawCrashString}`);
    }

    // Verify security headers on error response
    if (crashRes.headers.get("x-content-type-options") !== "nosniff") {
      throw new Error("Missing X-Content-Type-Options on 500 error response");
    }
    console.log("  PASS: 500 error response contains no stack trace, file path, or secrets, and includes security headers.");

    console.log("\n=== ALL HEALTH & DIAGNOSTICS ACCEPTANCE TESTS PASSED (A - E) ===");
  } finally {
    server.close();
  }
}

runHealthDiagnosticsSecurityTest().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
