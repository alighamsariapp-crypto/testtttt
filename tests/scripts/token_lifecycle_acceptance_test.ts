import express from "express";
import { Server } from "http";
import crypto from "crypto";
import { TokenService } from "../../src/server/tokenService";
import { getDatabase, queryRows } from "../../src/server/db";
import {
  handleRegister,
  handleLogin,
  handleMe,
  handleLogout,
  handleChangePassword,
  handleGetSessions,
  handleDestroySession,
  handleDestroyOtherSessions,
} from "../../src/server/authRoutes";

async function runTokenLifecycleAcceptanceTests() {
  console.log("=== Starting Token Lifecycle Security Acceptance Tests ===");

  const app = express();
  app.use(express.json());

  app.post("/api/v1/auth/register", handleRegister);
  app.post("/api/v1/auth/login", handleLogin);
  app.get("/api/v1/auth/me", handleMe);
  app.post("/api/v1/auth/logout", handleLogout);
  app.post("/api/v1/auth/change-password", handleChangePassword);

  app.get("/api/v1/users/sessions", handleGetSessions);
  app.delete("/api/v1/users/sessions/:tokenId", handleDestroySession);
  app.delete("/api/v1/users/sessions", handleDestroyOtherSessions);

  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const db = await getDatabase();

    // -------------------------------------------------------------------------
    // TEST E: New database records do not contain plaintext bearer tokens
    // -------------------------------------------------------------------------
    console.log("\n[TEST E] Checking that newly issued tokens are never stored in plaintext...");
    const testEmail = `token_test_${Date.now()}@example.com`;
    const regRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test User",
        email: testEmail,
        password: "Password123!",
      }),
    });
    const regData = await regRes.json();
    if (!regData.success || !regData.data?.token) {
      throw new Error(`Registration failed: ${JSON.stringify(regData)}`);
    }
    const plainToken = regData.data.token;
    const userId = regData.data.user.id;

    // Check database directly: plainToken must NOT exist in the database table
    const plainMatches = queryRows(db, "SELECT * FROM personal_access_tokens WHERE token = ?", [plainToken]);
    if (plainMatches.length > 0) {
      throw new Error("FAIL: Raw plaintext token found in personal_access_tokens table!");
    }

    // Check that stored token is a 64-character SHA-256 hash
    const expectedHash = crypto.createHash("sha256").update(plainToken).digest("hex");
    const hashMatches = queryRows(db, "SELECT * FROM personal_access_tokens WHERE token = ?", [expectedHash]);
    if (hashMatches.length === 0) {
      throw new Error("FAIL: SHA-256 hashed token was not found in personal_access_tokens table!");
    }
    const tokenRecord = hashMatches[0];
    if (String(tokenRecord.token).length !== 64) {
      throw new Error(`FAIL: Token length is not 64 hex chars: ${tokenRecord.token}`);
    }
    if (!tokenRecord.expires_at) {
      throw new Error("FAIL: Token does not have an explicit expires_at timestamp!");
    }
    console.log("  PASS: Token stored as 64-char SHA-256 hash with explicit expires_at.");

    // Check least-privilege abilities (avoid wildcard ["*"])
    const abilities = JSON.parse(tokenRecord.abilities);
    if (!Array.isArray(abilities) || abilities.includes("*")) {
      throw new Error(`FAIL: Customer token has universal wildcard ability: ${tokenRecord.abilities}`);
    }
    if (!abilities.includes("customer:access") || abilities.includes("payments:simulate")) {
      throw new Error(`FAIL: Token abilities not properly scoped: ${tokenRecord.abilities}`);
    }
    console.log("  PASS: Token abilities follow least-privilege scoping (no wildcard ['*']).");

    // -------------------------------------------------------------------------
    // TEST A: A token past expiry receives 401
    // -------------------------------------------------------------------------
    console.log("\n[TEST A] Verifying expired token receives 401 Unauthenticated...");
    // Create an expired token directly in db
    const expiredRawToken = `apex_expired_${crypto.randomBytes(24).toString("hex")}`;
    const expiredHash = crypto.createHash("sha256").update(expiredRawToken).digest("hex");
    const pastDate = new Date(Date.now() - 3600 * 1000).toISOString(); // 1 hour ago
    db.run(
      `INSERT INTO personal_access_tokens 
       (tokenable_type, tokenable_id, name, token, abilities, expires_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "App\\Modules\\Users\\Models\\User",
        userId,
        "expired-device",
        expiredHash,
        JSON.stringify(["customer:access"]),
        pastDate,
        pastDate,
        pastDate,
      ]
    );

    const expiredRes = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${expiredRawToken}` },
    });
    if (expiredRes.status !== 401) {
      throw new Error(`FAIL: Expired token returned HTTP ${expiredRes.status}, expected 401.`);
    }
    console.log("  PASS: Expired token correctly rejected with 401.");

    // -------------------------------------------------------------------------
    // TEST B: Logout makes the same token unusable
    // -------------------------------------------------------------------------
    console.log("\n[TEST B] Verifying logout revokes the current token...");
    // 1. Token works before logout
    const preLogoutRes = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${plainToken}` },
    });
    if (preLogoutRes.status !== 200) {
      throw new Error(`FAIL: Valid token failed before logout with HTTP ${preLogoutRes.status}`);
    }

    // 2. Perform logout
    const logoutRes = await fetch(`${baseUrl}/api/v1/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${plainToken}` },
    });
    if (logoutRes.status !== 200) {
      throw new Error(`FAIL: Logout failed with HTTP ${logoutRes.status}`);
    }

    // 3. Same token should now be rejected with 401
    const postLogoutRes = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${plainToken}` },
    });
    if (postLogoutRes.status !== 401) {
      throw new Error(`FAIL: Revoked token still authenticated with HTTP ${postLogoutRes.status}`);
    }
    console.log("  PASS: Logout successfully invalidated the token.");

    // -------------------------------------------------------------------------
    // TEST C: Password change invalidates other sessions
    // -------------------------------------------------------------------------
    console.log("\n[TEST C] Verifying password change revokes other active sessions...");
    // Log in twice to obtain two active sessions
    const login1 = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testEmail, password: "Password123!" }),
    });
    const token1 = (await login1.json()).data.token;

    const login2 = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testEmail, password: "Password123!" }),
    });
    const token2 = (await login2.json()).data.token;

    // Both work initially
    const chk1 = await fetch(`${baseUrl}/api/v1/auth/me`, { headers: { Authorization: `Bearer ${token1}` } });
    const chk2 = await fetch(`${baseUrl}/api/v1/auth/me`, { headers: { Authorization: `Bearer ${token2}` } });
    if (chk1.status !== 200 || chk2.status !== 200) {
      throw new Error("FAIL: Initial logins did not produce working tokens.");
    }

    // Session 1 updates password
    const pwdChangeRes = await fetch(`${baseUrl}/api/v1/auth/change-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token1}`,
      },
      body: JSON.stringify({
        current_password: "Password123!",
        password: "NewPassword456!",
      }),
    });
    if (pwdChangeRes.status !== 200) {
      throw new Error(`FAIL: Change password failed with HTTP ${pwdChangeRes.status}`);
    }

    // Session 1 (token1) remains active
    const postChange1 = await fetch(`${baseUrl}/api/v1/auth/me`, { headers: { Authorization: `Bearer ${token1}` } });
    if (postChange1.status !== 200) {
      throw new Error("FAIL: Current session was unexpectedly invalidated upon password change.");
    }

    // Session 2 (token2) is revoked
    const postChange2 = await fetch(`${baseUrl}/api/v1/auth/me`, { headers: { Authorization: `Bearer ${token2}` } });
    if (postChange2.status !== 401) {
      throw new Error(`FAIL: Other active session was not revoked (HTTP ${postChange2.status}).`);
    }
    console.log("  PASS: Password change successfully revoked other active sessions.");

    // -------------------------------------------------------------------------
    // TEST D: A user cannot delete another user's session ID
    // -------------------------------------------------------------------------
    console.log("\n[TEST D] Verifying a user cannot delete another user's session...");
    // Register victim user
    const victimRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Victim User",
        email: `victim_${Date.now()}@example.com`,
        password: "Password123!",
      }),
    });
    const victimData = await victimRes.json();
    const victimToken = victimData.data.token;

    // Get victim's session list to find session ID
    const victimSessionsRes = await fetch(`${baseUrl}/api/v1/users/sessions`, {
      headers: { Authorization: `Bearer ${victimToken}` },
    });
    const victimSessions = (await victimSessionsRes.json()).data;
    const victimSessionId = victimSessions[0].id;

    // Attacker (user 1 using token1) attempts to delete victim's session
    const attackRes = await fetch(`${baseUrl}/api/v1/users/sessions/${victimSessionId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token1}` },
    });
    if (attackRes.status !== 404) {
      throw new Error(`FAIL: Attacker deleting other user's session returned HTTP ${attackRes.status}, expected 404.`);
    }

    // Victim's session still exists
    const verifyVictimRes = await fetch(`${baseUrl}/api/v1/users/sessions`, {
      headers: { Authorization: `Bearer ${victimToken}` },
    });
    const verifyVictimSessions = (await verifyVictimRes.json()).data;
    if (!verifyVictimSessions.some((s: any) => s.id === victimSessionId)) {
      throw new Error("FAIL: Victim session was deleted by unauthorized user!");
    }
    console.log("  PASS: User cannot delete another user's session ID (returns 404).");

    // -------------------------------------------------------------------------
    // TEST F: Token values are absent from logs and error responses
    // -------------------------------------------------------------------------
    console.log("\n[TEST F] Verifying token values are absent from session listings and error bodies...");
    // Session list check
    for (const s of verifyVictimSessions) {
      if (s.token || s.token_hash || s.secret) {
        throw new Error(`FAIL: Secret token or hash exposed in session list: ${JSON.stringify(s)}`);
      }
      if (!s.device || !s.created_at || !s.expires_at) {
        throw new Error(`FAIL: Session missing required metadata: ${JSON.stringify(s)}`);
      }
    }

    // Error response check
    const secretQueryToken = "super_secret_forbidden_token_value_998877";
    const errorRes = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${secretQueryToken}` },
    });
    const errorBody = await errorRes.text();
    if (errorBody.includes(secretQueryToken)) {
      throw new Error("FAIL: Bearer token value was echoed/leaked in error response!");
    }
    console.log("  PASS: Token values are never leaked in session listings or error bodies.");

    console.log("\n=== ALL ACCEPTANCE TESTS A, B, C, D, E, F PASSED SUCCESSFULLY! ===");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

runTokenLifecycleAcceptanceTests().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
