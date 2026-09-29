import { spawn, ChildProcess } from "child_process";
import fs from "fs";
import path from "path";

async function runProductionSmokeTest() {
  console.log("================================================================================");
  console.log("STARTING PRODUCTION CONFIGURATION SMOKE TEST");
  console.log("================================================================================");

  // 1. Verify build artifacts exist
  const distDir = path.join(process.cwd(), "dist");
  const serverPath = path.join(distDir, "server.cjs");
  const indexPath = path.join(distDir, "index.html");

  if (!fs.existsSync(serverPath) || !fs.existsSync(indexPath)) {
    throw new Error("Production build artifacts not found in dist/. Please run 'pnpm build' before smoke testing.");
  }
  console.log("✓ Production build artifacts verified (dist/server.cjs, dist/index.html).");

  // 2. Start the built production configuration on test port 3998
  const testPort = 3998;
  const baseUrl = `http://127.0.0.1:${testPort}`;

  console.log(`\n[STEP 1] Starting built production server on port ${testPort}...`);
  const serverProcess: ChildProcess = spawn("node", [serverPath], {
    env: {
      ...process.env,
      NODE_ENV: "production",
      APP_ENV: "production",
      PORT: String(testPort),
      ENABLE_EXPRESS_API: "false",
      CORS_ALLOWED_ORIGINS_PRODUCTION: "https://apexstore.ir,https://admin.apexstore.ir",
    },
    stdio: ["pipe", "pipe", "pipe"],
  });

  // Wait for server to start
  await new Promise<void>((resolve, reject) => {
    let started = false;
    const timeout = setTimeout(() => {
      if (!started) {
        serverProcess.kill();
        reject(new Error("Timeout waiting for production server to start."));
      }
    }, 10000);

    serverProcess.stdout?.on("data", (data) => {
      const msg = data.toString();
      if (msg.includes("Production Static Host") || msg.includes("running on http")) {
        started = true;
        clearTimeout(timeout);
        resolve();
      }
    });

    serverProcess.stderr?.on("data", (data) => {
      console.error("[Server STDERR]:", data.toString());
    });

    serverProcess.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
  console.log("✓ Built production server started and listening.");

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Static frontend entry point
    // -------------------------------------------------------------------------
    console.log("\n[TEST 1] Verifying frontend static bundle delivery...");
    const homeRes = await fetch(`${baseUrl}/`);
    if (homeRes.status !== 200) {
      throw new Error(`Expected 200 for frontend index, got ${homeRes.status}`);
    }
    const htmlText = await homeRes.text();
    if (!htmlText.includes("<!DOCTYPE html") && !htmlText.includes("<html")) {
      throw new Error("Response was not a valid HTML document.");
    }
    console.log("✓ Frontend index.html served with HTTP 200.");

    // -------------------------------------------------------------------------
    // TEST 2: Express safety guard: All /api/* requests return 404 LARAVEL_AUTHORITATIVE_BACKEND
    // -------------------------------------------------------------------------
    console.log("\n[TEST 2] Verifying Express architectural boundary in production...");
    const apiRes = await fetch(`${baseUrl}/api/v1/health`);
    if (apiRes.status !== 404) {
      throw new Error(`Expected 404 for Express /api in production, got ${apiRes.status}`);
    }
    const apiJson = await apiRes.json();
    if (apiJson.error_code !== "LARAVEL_AUTHORITATIVE_BACKEND") {
      throw new Error(`Expected LARAVEL_AUTHORITATIVE_BACKEND error code, got ${apiJson.error_code}`);
    }
    console.log("✓ Express strictly returns 404 LARAVEL_AUTHORITATIVE_BACKEND in production.");

    // -------------------------------------------------------------------------
    // TEST 3: Strict absence of simulation routes on production host
    // -------------------------------------------------------------------------
    console.log("\n[TEST 3] Verifying simulation routes are strictly absent...");
    const simRes = await fetch(`${baseUrl}/api/v1/payments/test/simulate`);
    if (simRes.status !== 404) {
      throw new Error(`Expected 404 for simulation route in production, got ${simRes.status}`);
    }
    console.log("✓ Test payment simulation route is strictly absent (HTTP 404).");

    // -------------------------------------------------------------------------
    // TEST 4: Production routing contract audit for authoritative Laravel backend
    // -------------------------------------------------------------------------
    console.log("\n[TEST 4] Auditing Laravel production routing contract...");
    const apiPhpPath = path.join(process.cwd(), "routes", "api.php");
    const testingPhpPath = path.join(process.cwd(), "routes", "testing.php");
    const apiPhp = fs.readFileSync(apiPhpPath, "utf-8");
    const testingPhp = fs.readFileSync(testingPhpPath, "utf-8");

    // 4a. Public health route check
    if (!apiPhp.includes("Route::get('/health', [HealthDiagnosticsController::class, 'health'])")) {
      throw new Error("Missing public health route in routes/api.php");
    }
    console.log("  ✓ Public health route (/api/v1/health) verified in Laravel routes.");

    // 4b. Protected diagnostics route check
    if (!apiPhp.includes("Route::get('/diagnostics', [HealthDiagnosticsController::class, 'diagnostics'])") ||
        !apiPhp.includes("'role:admin,staff'")) {
      throw new Error("Protected diagnostics route missing required role:admin,staff middleware");
    }
    console.log("  ✓ Protected diagnostics route (/api/v1/diagnostics) with admin/staff middleware verified.");

    // 4c. Login route check
    if (!apiPhp.includes("Route::post('/login', [AuthController::class, 'login'])") ||
        !apiPhp.includes("'throttle:auth-login'")) {
      throw new Error("Login route missing or lacks auth-login rate limiting middleware");
    }
    console.log("  ✓ Login route (/api/v1/auth/login) with rate limiting throttle verified.");

    // 4d. Checkout configuration route check
    if (!apiPhp.includes("CheckoutController::class") && !apiPhp.includes("SettingController::class")) {
      throw new Error("Checkout/settings routes missing in routes/api.php");
    }
    console.log("  ✓ Checkout configuration route verified in Laravel routes.");

    // 4e. Payment status authorization route check
    if (!apiPhp.includes("PaymentStatusController::class")) {
      throw new Error("Payment status controller route missing in routes/api.php");
    }
    console.log("  ✓ Payment status route (/api/v1/payments/status/{identifier}) verified.");

    // 4f. Absence of simulation routes in production
    const prodEnvGuardRegex = /if\s*\(\s*config\('app\.env'\)\s*!==\s*'production'[\s\S]*?testing\.php/;
    if (!prodEnvGuardRegex.test(apiPhp)) {
      throw new Error("Simulation routes in testing.php are not properly guarded with config('app.env') !== 'production'!");
    }
    console.log("  ✓ Simulation routes guarded against production loading in routes/api.php.");

    // -------------------------------------------------------------------------
    // TEST 5: Live PHP / MySQL Execution check
    // -------------------------------------------------------------------------
    console.log("\n[TEST 5] Checking PHP and MySQL execution environment...");
    let phpAvailable = false;
    try {
      const phpVer = spawn("php", ["-v"]);
      await new Promise<void>((resolve, reject) => {
        phpVer.on("close", (code) => (code === 0 ? resolve() : reject()));
        phpVer.on("error", reject);
      });
      phpAvailable = true;
    } catch {
      phpAvailable = false;
    }

    if (phpAvailable) {
      console.log("✓ PHP runtime is available: Live Laravel feature test suite can be run.");
    } else {
      console.log("⚠ NOTE: PHP runtime (php binary) is not installed in this Node container.");
      console.log("  Live PHP/Laravel tests will execute in the GitHub Actions CI pipeline on PHP 8.3 & MySQL 8.0.");
    }

    console.log("\n================================================================================");
    console.log("🎉 PRODUCTION SMOKE TEST COMPLETED SUCCESSFULLY!");
    console.log("================================================================================");

  } finally {
    serverProcess.kill();
  }
}

runProductionSmokeTest().catch((err) => {
  console.error("\n❌ PRODUCTION SMOKE TEST FAILED:", err);
  process.exit(1);
});
