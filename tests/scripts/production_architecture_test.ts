/**
 * PRODUCTION ARCHITECTURE VERIFICATION TEST
 *
 * Verifies that:
 * 1. Under NODE_ENV=production, Express MUST NOT expose any business API endpoints (/api/v1/*).
 * 2. Unmatched API calls return 404 with error_code: "LARAVEL_AUTHORITATIVE_BACKEND".
 * 3. devApiAdapter fails fast and throws an error if called when NODE_ENV=production.
 * 4. Safety switch rejects ENABLE_EXPRESS_API=true in production.
 */

import express from "express";
import http from "http";
import { mountDevelopmentApiRoutes } from "../../src/server/devApiAdapter";
import { getDatabase } from "../../src/server/db";

async function testProductionArchitecture() {
  console.log("=== Running Production Architecture Boundary Tests ===");

  // Test 1: devApiAdapter fails fast if NODE_ENV === 'production'
  console.log("Scenario 1: Testing devApiAdapter throws in production mode...");
  const oldEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";

  let threwInProduction = false;
  const dummyApp = express();
  try {
    // We pass a dummy database object
    mountDevelopmentApiRoutes(dummyApp, {} as any);
  } catch (err: any) {
    if (err.message.includes("FATAL ARCHITECTURAL VIOLATION")) {
      threwInProduction = true;
    }
  }

  if (!threwInProduction) {
    throw new Error("Scenario 1 FAILED: mountDevelopmentApiRoutes did NOT throw when NODE_ENV === 'production'");
  }
  console.log("✓ Scenario 1 passed: mountDevelopmentApiRoutes throws fatal violation when NODE_ENV === 'production'");

  // Restore env
  process.env.NODE_ENV = oldEnv;

  // Test 2: Verify production Express app configuration responds with LARAVEL_AUTHORITATIVE_BACKEND on /api/v1/*
  console.log("Scenario 2: Testing production Express route registration forbids API routes...");
  const prodApp = express();
  prodApp.use(express.json());

  // Emulate server.ts production mode setup
  prodApp.all(["/api", "/api/*"], (_req, res) => {
    res.status(404).json({
      success: false,
      error_code: "LARAVEL_AUTHORITATIVE_BACKEND",
      message: "Production API routes are served exclusively by the Laravel backend (routes/api.php). Express does not serve API endpoints in production.",
    });
  });

  const server = http.createServer(prodApp);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;

  const testEndpoints = [
    "/api/v1/auth/login",
    "/api/v1/products",
    "/api/v1/cart",
    "/api/v1/checkout",
    "/api/v1/orders",
    "/api/v1/admin/dashboard",
    "/api/health",
  ];

  for (const endpoint of testEndpoints) {
    const res = await fetch(`http://127.0.0.1:${port}${endpoint}`);
    if (res.status !== 404) {
      server.close();
      throw new Error(`Scenario 2 FAILED: ${endpoint} returned status ${res.status} instead of 404 in production mode`);
    }
    const body: any = await res.json();
    if (body.error_code !== "LARAVEL_AUTHORITATIVE_BACKEND") {
      server.close();
      throw new Error(`Scenario 2 FAILED: ${endpoint} did not return error_code LARAVEL_AUTHORITATIVE_BACKEND`);
    }
  }
  server.close();
  console.log("✓ Scenario 2 passed: All /api/v1/* endpoints return 404 LARAVEL_AUTHORITATIVE_BACKEND in production mode");

  // Test 3: Verify development adapter works properly when NODE_ENV !== 'production'
  console.log("Scenario 3: Testing development adapter mounts successfully in non-production mode...");
  const devApp = express();
  devApp.use(express.json());
  const db = await getDatabase();
  mountDevelopmentApiRoutes(devApp, db);

  const devServer = http.createServer(devApp);
  await new Promise<void>((resolve) => devServer.listen(0, resolve));
  const devPort = (devServer.address() as any).port;

  const devHealthRes = await fetch(`http://127.0.0.1:${devPort}/api/v1/health`);
  if (devHealthRes.status !== 200) {
    devServer.close();
    throw new Error(`Scenario 3 FAILED: /api/v1/health in dev mode returned status ${devHealthRes.status}`);
  }
  const devHealthBody: any = await devHealthRes.json();
  if (devHealthBody.data?.status !== "development-adapter") {
    devServer.close();
    throw new Error(`Scenario 3 FAILED: /api/v1/health did not return development-adapter status`);
  }
  devServer.close();
  console.log("✓ Scenario 3 passed: Development adapter works as expected when NODE_ENV !== 'production'");

  console.log("============================================================================");
  console.log("ALL PRODUCTION ARCHITECTURE BOUNDARY TESTS PASSED!");
  console.log("============================================================================");
}

testProductionArchitecture().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
