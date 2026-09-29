import express from "express";
import { Server } from "http";
import { getDatabase, persistDatabase } from "../../src/server/db";
import { authenticateToken, handleMe, handleLogout } from "../../src/server/authRoutes";
import {
  handleAdminDashboard,
  handleAdminGetProducts,
  adminAuthMiddleware,
  handleAdminServicesCatalog,
} from "../../src/server/adminRoutes";
import { handleAdminGetCategories } from "../../src/server/categoryRoutes";
import { handleGetOrders } from "../../src/server/orderRoutes";
import { TokenService } from "../../src/server/tokenService";

async function runSecurityTests() {
  console.log("=== Running Security Hardening Automated Verification Suite ===");

  const db = await getDatabase();
  const now = new Date();
  const nowIso = now.toISOString();
  const expiresIso = new Date(now.getTime() + 7 * 86400000).toISOString();

  // 1. Ensure test users and personal_access_tokens in database
  // Admin user (id: 1, role: 'admin')
  db.run(`
    INSERT OR REPLACE INTO users (id, name, email, phone, password, role, status, created_at, updated_at)
    VALUES (1, 'مدیر سیستم', 'admin@apexstore.local', '09120000000', 'hashed_pass', 'admin', 'active', '${nowIso}', '${nowIso}');
  `);
  db.run(`
    INSERT OR REPLACE INTO personal_access_tokens (id, tokenable_type, tokenable_id, name, token, abilities, expires_at, created_at, updated_at)
    VALUES (901, 'App\\\\Modules\\\\Users\\\\Models\\\\User', 1, 'admin-test', '${TokenService.hashToken("sec_test_admin_token")}', '["admin:access"]', '${expiresIso}', '${nowIso}', '${nowIso}');
  `);

  // Standard customer user (id: 3, role: 'customer')
  db.run(`
    INSERT OR REPLACE INTO users (id, name, email, phone, password, role, status, created_at, updated_at)
    VALUES (3, 'کاربر مشتری', 'customer@apexstore.local', '09121111111', 'hashed_pass', 'customer', 'active', '${nowIso}', '${nowIso}');
  `);
  db.run(`
    INSERT OR REPLACE INTO personal_access_tokens (id, tokenable_type, tokenable_id, name, token, abilities, expires_at, created_at, updated_at)
    VALUES (903, 'App\\\\Modules\\\\Users\\\\Models\\\\User', 3, 'customer-test', '${TokenService.hashToken("sec_test_customer_token")}', '["customer:access"]', '${expiresIso}', '${nowIso}', '${nowIso}');
  `);

  // Former hardcoded admin email user: Ali Ghamsari (id: 2, role: 'customer')
  db.run(`
    INSERT OR REPLACE INTO users (id, name, email, phone, password, role, status, created_at, updated_at)
    VALUES (2, 'علی قمصری', 'alighamsariapp@gmail.com', '09123456789', 'hashed_pass', 'customer', 'active', '${nowIso}', '${nowIso}');
  `);
  db.run(`
    INSERT OR REPLACE INTO personal_access_tokens (id, tokenable_type, tokenable_id, name, token, abilities, expires_at, created_at, updated_at)
    VALUES (902, 'App\\\\Modules\\\\Users\\\\Models\\\\User', 2, 'ali-customer-test', '${TokenService.hashToken("sec_test_ali_customer_token")}', '["customer:access"]', '${expiresIso}', '${nowIso}', '${nowIso}');
  `);

  // User with email containing 'admin' but persisted role is 'customer' (id: 904)
  db.run(`
    INSERT OR REPLACE INTO users (id, name, email, phone, password, role, status, created_at, updated_at)
    VALUES (904, 'کاربر شبیه مدیر', 'admin-impersonator@apexstore.local', '09129999904', 'hashed_pass', 'customer', 'active', '${nowIso}', '${nowIso}');
  `);
  db.run(`
    INSERT OR REPLACE INTO personal_access_tokens (id, tokenable_type, tokenable_id, name, token, abilities, expires_at, created_at, updated_at)
    VALUES (904, 'App\\\\Modules\\\\Users\\\\Models\\\\User', 904, 'impersonator-test', '${TokenService.hashToken("sec_test_impersonator_token")}', '["customer:access"]', '${expiresIso}', '${nowIso}', '${nowIso}');
  `);

  // Suspended user (id: 905, status: 'suspended')
  db.run(`
    INSERT OR REPLACE INTO users (id, name, email, phone, password, role, status, created_at, updated_at)
    VALUES (905, 'کاربر معلق', 'suspended@apexstore.local', '09129999905', 'hashed_pass', 'customer', 'suspended', '${nowIso}', '${nowIso}');
  `);
  db.run(`
    INSERT OR REPLACE INTO personal_access_tokens (id, tokenable_type, tokenable_id, name, token, abilities, expires_at, created_at, updated_at)
    VALUES (905, 'App\\\\Modules\\\\Users\\\\Models\\\\User', 905, 'suspended-test', '${TokenService.hashToken("sec_test_suspended_token")}', '["customer:access"]', '${expiresIso}', '${nowIso}', '${nowIso}');
  `);

  persistDatabase();

  // 2. Set up Express application for testing
  const app = express();
  app.use(express.json());

  // Mount auth routes
  app.get("/api/v1/auth/me", handleMe);
  app.post("/api/v1/auth/logout", handleLogout);

  // Mount customer protected routes
  app.get("/api/v1/orders", handleGetOrders);

  // Mount admin protected routes
  app.get("/api/v1/admin/dashboard", handleAdminDashboard);
  app.get("/api/v1/admin/products", handleAdminGetProducts);
  app.get("/api/v1/admin/categories", handleAdminGetCategories);
  app.get("/api/v1/admin/services/catalog", handleAdminServicesCatalog);
  app.post("/api/v1/admin/products/images", adminAuthMiddleware, (req, res) => {
    res.status(200).json({ success: true, message: "Upload authorized" });
  });

  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });

  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 4444;
  const baseUrl = `http://localhost:${port}`;

  try {
    // =========================================================================
    // Test Case 1: Unauthenticated request to protected endpoints -> 401
    // =========================================================================
    console.log("\n[Test 1] Testing Unauthenticated Requests to Protected Endpoints...");

    const protectedEndpoints = [
      { path: "/api/v1/admin/dashboard", method: "GET" },
      { path: "/api/v1/admin/products", method: "GET" },
      { path: "/api/v1/admin/categories", method: "GET" },
      { path: "/api/v1/admin/services/catalog", method: "GET" },
      { path: "/api/v1/admin/products/images", method: "POST" },
      { path: "/api/v1/orders", method: "GET" },
      { path: "/api/v1/auth/me", method: "GET" },
    ];

    for (const ep of protectedEndpoints) {
      const res = await fetch(`${baseUrl}${ep.path}`, { method: ep.method });
      if (res.status !== 401) {
        throw new Error(`Expected 401 for unauthenticated ${ep.method} ${ep.path}, got ${res.status}`);
      }
      const data = await res.json();
      if (data.success !== false) {
        throw new Error(`Expected success: false for unauthenticated ${ep.path}`);
      }
      console.log(`  ✓ 401 returned for unauthenticated ${ep.method} ${ep.path}`);
    }

    // =========================================================================
    // Test Case 2: Authenticated customer request to privileged admin endpoint -> 403
    // =========================================================================
    console.log("\n[Test 2] Testing Authenticated Customer Requests to Privileged Admin Endpoints...");

    const customerHeaders = {
      Authorization: "Bearer sec_test_customer_token",
      "Content-Type": "application/json",
    };

    const adminEndpoints = [
      { path: "/api/v1/admin/dashboard", method: "GET" },
      { path: "/api/v1/admin/products", method: "GET" },
      { path: "/api/v1/admin/categories", method: "GET" },
      { path: "/api/v1/admin/services/catalog", method: "GET" },
      { path: "/api/v1/admin/products/images", method: "POST" },
    ];

    for (const ep of adminEndpoints) {
      const res = await fetch(`${baseUrl}${ep.path}`, {
        method: ep.method,
        headers: customerHeaders,
      });
      if (res.status !== 403) {
        throw new Error(`Expected 403 for customer accessing ${ep.method} ${ep.path}, got ${res.status}`);
      }
      const data = await res.json();
      if (data.success !== false) {
        throw new Error(`Expected success: false for unauthorized access to ${ep.path}`);
      }
      console.log(`  ✓ 403 returned for customer accessing ${ep.method} ${ep.path}`);
    }

    // But customer CAN access their own customer routes
    const customerMeRes = await fetch(`${baseUrl}/api/v1/auth/me`, { headers: customerHeaders });
    if (customerMeRes.status !== 200) {
      throw new Error(`Expected 200 for customer /auth/me, got ${customerMeRes.status}`);
    }
    const customerMeData = await customerMeRes.json();
    if (customerMeData.data.user.role !== "customer") {
      throw new Error(`Expected customer role in /auth/me, got ${customerMeData.data.user.role}`);
    }
    console.log("  ✓ Customer can legitimately access /api/v1/auth/me (role='customer')");

    // =========================================================================
    // Test Case 3: Authenticated admin request using real admin credentials/role -> 200
    // =========================================================================
    console.log("\n[Test 3] Testing Authenticated Admin Requests using Real Admin Credentials/Role...");

    const adminHeaders = {
      Authorization: "Bearer sec_test_admin_token",
      "Content-Type": "application/json",
    };

    const adminDashboardRes = await fetch(`${baseUrl}/api/v1/admin/dashboard`, { headers: adminHeaders });
    if (adminDashboardRes.status !== 200) {
      throw new Error(`Expected 200 for admin /admin/dashboard, got ${adminDashboardRes.status}`);
    }
    const dashboardData = await adminDashboardRes.json();
    if (!dashboardData.success) {
      throw new Error(`Expected success: true for admin /admin/dashboard`);
    }
    console.log("  ✓ 200 returned for admin /api/v1/admin/dashboard");

    const adminProductsRes = await fetch(`${baseUrl}/api/v1/admin/products`, { headers: adminHeaders });
    if (adminProductsRes.status !== 200) {
      throw new Error(`Expected 200 for admin /admin/products, got ${adminProductsRes.status}`);
    }
    console.log("  ✓ 200 returned for admin /api/v1/admin/products");

    const adminCategoriesRes = await fetch(`${baseUrl}/api/v1/admin/categories`, { headers: adminHeaders });
    if (adminCategoriesRes.status !== 200) {
      throw new Error(`Expected 200 for admin /admin/categories, got ${adminCategoriesRes.status}`);
    }
    console.log("  ✓ 200 returned for admin /api/v1/admin/categories");

    const adminMeRes = await fetch(`${baseUrl}/api/v1/auth/me`, { headers: adminHeaders });
    if (adminMeRes.status !== 200) {
      throw new Error(`Expected 200 for admin /auth/me, got ${adminMeRes.status}`);
    }
    const adminMeData = await adminMeRes.json();
    if (adminMeData.data.user.role !== "admin") {
      throw new Error(`Expected admin role for real admin user, got ${adminMeData.data.user.role}`);
    }
    console.log("  ✓ Admin role confirmed as 'admin' in /api/v1/auth/me");

    // =========================================================================
    // Test Case 4: Tampered / invalid Bearer token -> 401
    // =========================================================================
    console.log("\n[Test 4] Testing Tampered and Invalid Bearer Tokens...");

    const invalidTokens = [
      "Bearer tampered_token_xyz_123",
      "Bearer admin_demo_token_nonexistent",
      "Bearer ",
      "Basic invalid_scheme_credentials",
    ];

    for (const invalidTokenHeader of invalidTokens) {
      const res = await fetch(`${baseUrl}/api/v1/admin/dashboard`, {
        headers: { Authorization: invalidTokenHeader },
      });
      if (res.status !== 401) {
        throw new Error(`Expected 401 for token '${invalidTokenHeader}', got ${res.status}`);
      }
      console.log(`  ✓ 401 returned for invalid token header '${invalidTokenHeader}'`);
    }

    // =========================================================================
    // Test Case 5: User whose email matches former hardcoded admin identity but database role is 'customer' -> remains 'customer'
    // =========================================================================
    console.log("\n[Test 5] Testing Former Hardcoded Identities with Database Role = 'customer'...");

    // User: alighamsariapp@gmail.com
    const aliHeaders = {
      Authorization: "Bearer sec_test_ali_customer_token",
      "Content-Type": "application/json",
    };

    const aliMeRes = await fetch(`${baseUrl}/api/v1/auth/me`, { headers: aliHeaders });
    if (aliMeRes.status !== 200) {
      throw new Error(`Expected 200 for Ali /auth/me, got ${aliMeRes.status}`);
    }
    const aliMeData = await aliMeRes.json();
    if (aliMeData.data.user.role !== "customer") {
      throw new Error(
        `SECURITY VIOLATION: alighamsariapp@gmail.com was promoted to '${aliMeData.data.user.role}' instead of persisted role 'customer'!`
      );
    }
    console.log("  ✓ alighamsariapp@gmail.com returns persisted database role: 'customer'");

    // Ensure Ali cannot access admin dashboard or admin endpoints
    const aliAdminRes = await fetch(`${baseUrl}/api/v1/admin/dashboard`, { headers: aliHeaders });
    if (aliAdminRes.status !== 403) {
      throw new Error(
        `SECURITY VIOLATION: alighamsariapp@gmail.com accessed admin dashboard with status ${aliAdminRes.status} (expected 403 Forbidden)!`
      );
    }
    console.log("  ✓ alighamsariapp@gmail.com is strictly rejected with 403 from /api/v1/admin/dashboard");

    const aliProductsRes = await fetch(`${baseUrl}/api/v1/admin/products`, { headers: aliHeaders });
    if (aliProductsRes.status !== 403) {
      throw new Error(`SECURITY VIOLATION: alighamsariapp@gmail.com accessed admin products with status ${aliProductsRes.status}!`);
    }
    console.log("  ✓ alighamsariapp@gmail.com is strictly rejected with 403 from /api/v1/admin/products");

    // Impersonator user (admin-impersonator@apexstore.local)
    const impHeaders = {
      Authorization: "Bearer sec_test_impersonator_token",
    };
    const impRes = await fetch(`${baseUrl}/api/v1/admin/dashboard`, { headers: impHeaders });
    if (impRes.status !== 403) {
      throw new Error(`Expected 403 for impersonator, got ${impRes.status}`);
    }
    console.log("  ✓ admin-impersonator user is strictly rejected with 403 from admin endpoints");

    // =========================================================================
    // Test Case 6: Suspended user token validation -> 401
    // =========================================================================
    console.log("\n[Test 6] Testing Inactive / Suspended User Token...");
    const suspendedRes = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Authorization: "Bearer sec_test_suspended_token" },
    });
    if (suspendedRes.status !== 401) {
      throw new Error(`Expected 401 for suspended user token, got ${suspendedRes.status}`);
    }
    console.log("  ✓ 401 returned for suspended user token");

    // =========================================================================
    // Test Case 7: Logout token revocation
    // =========================================================================
    console.log("\n[Test 7] Testing Token Revocation on Logout...");
    const logoutRes = await fetch(`${baseUrl}/api/v1/auth/logout`, {
      method: "POST",
      headers: customerHeaders,
    });
    if (logoutRes.status !== 200) {
      throw new Error(`Expected 200 for logout, got ${logoutRes.status}`);
    }
    // Trying to use the token after logout must now return 401
    const postLogoutRes = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: customerHeaders,
    });
    if (postLogoutRes.status !== 401) {
      throw new Error(`Expected 401 after logout token revocation, got ${postLogoutRes.status}`);
    }
    console.log("  ✓ Revoked token correctly returns 401 after logout");

    // =========================================================================
    // Test Case 8: Security leakage audit (No password in response)
    // =========================================================================
    console.log("\n[Test 8] Testing Information Leakage (No Passwords Returned)...");
    const meCheck = await fetch(`${baseUrl}/api/v1/auth/me`, { headers: adminHeaders });
    const meBody = await meCheck.json();
    if (meBody.data.user.password !== undefined) {
      throw new Error("SECURITY LEAK: user password field was returned in /api/v1/auth/me!");
    }
    console.log("  ✓ No password field exposed in user profile endpoint");

    console.log("\n============================================================");
    console.log("ALL 8 SECURITY HARDENING CHECKS PASSED WITH 100% SUCCESS!");
    console.log("============================================================\n");
  } finally {
    server.close();
  }
}

runSecurityTests().catch((err) => {
  console.error("TEST FAILED:", err);
  process.exit(1);
});
