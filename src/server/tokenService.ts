import crypto from "crypto";
import { getDatabase, persistDatabase, queryRows } from "./db";

export interface AuthenticatedUser {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  status: string;
  created_at: string;
  current_token_id: number;
  abilities: string[];
}

export interface UserSessionItem {
  id: number;
  device: string;
  browser: string;
  os: string;
  location: string;
  ip: string;
  last_active: string;
  created_at: string;
  expires_at: string;
  is_current: boolean;
}

export class TokenService {
  public static readonly DEFAULT_EXPIRATION_DAYS = 7;
  public static readonly TOKEN_PREFIX = "apex_";

  /**
   * One-way SHA-256 hash of a bearer token.
   * Plaintext tokens must never be stored in the database.
   */
  public static hashToken(rawToken: string): string {
    return crypto.createHash("sha256").update(rawToken.trim()).digest("hex");
  }

  /**
   * Compute role-based least-privilege abilities (avoiding wildcard ['*']).
   */
  public static getAbilitiesForRole(role: string): string[] {
    switch (role) {
      case "admin":
        return [
          "admin:access",
          "products:manage",
          "orders:manage",
          "users:manage",
          "settings:manage",
          "reports:view",
          "customer:access",
          "orders:view",
          "profile:manage",
        ];
      case "staff":
        return [
          "staff:access",
          "orders:view",
          "support:manage",
          "customer:access",
        ];
      default:
        return [
          "customer:access",
          "orders:create",
          "orders:view",
          "profile:manage",
          "cart:manage",
        ];
    }
  }

  /**
   * Create a new secure Personal Access Token for a user.
   * Stored as a SHA-256 hash with explicit expiration and least-privilege abilities.
   */
  public static async createToken(
    userId: number,
    deviceName: string = "web-client",
    role: string = "customer",
    customExpirationDays: number = TokenService.DEFAULT_EXPIRATION_DAYS
  ): Promise<{ token: string; tokenId: number; expiresAt: string }> {
    const db = await getDatabase();

    // Cryptographically strong random token
    const rawSecret = crypto.randomBytes(32).toString("hex");
    const rawToken = `${TokenService.TOKEN_PREFIX}${rawSecret}`;
    const tokenHash = TokenService.hashToken(rawToken);

    const now = new Date();
    const expiresAtDate = new Date(now.getTime() + customExpirationDays * 24 * 60 * 60 * 1000);
    const nowIso = now.toISOString();
    const expiresAtIso = expiresAtDate.toISOString();

    const sanitizedDevice = (deviceName || "web-client").trim().slice(0, 50);
    const abilities = JSON.stringify(TokenService.getAbilitiesForRole(role));

    db.run(
      `INSERT INTO personal_access_tokens 
       (tokenable_type, tokenable_id, name, token, abilities, expires_at, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "App\\Modules\\Users\\Models\\User",
        userId,
        sanitizedDevice,
        tokenHash,
        abilities,
        expiresAtIso,
        nowIso,
        nowIso,
      ]
    );

    const idQuery = db.exec("SELECT last_insert_rowid()");
    const tokenId = idQuery[0].values[0][0] as number;

    persistDatabase();

    return {
      token: rawToken,
      tokenId,
      expiresAt: expiresAtIso,
    };
  }

  /**
   * Verify and authenticate a Bearer token.
   * Checks SHA-256 hash, expiration date, active user status, and updates last_used_at.
   */
  public static async authenticateBearerToken(
    authHeader: string | undefined
  ): Promise<AuthenticatedUser | null> {
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return null;
    }

    const rawToken = authHeader.substring(7).trim();
    if (!rawToken) {
      return null;
    }

    const tokenHash = TokenService.hashToken(rawToken);
    const db = await getDatabase();

    const rows = queryRows(
      db,
      `SELECT t.id as token_id, t.tokenable_id, t.abilities, t.expires_at, t.created_at as token_created_at,
              u.id as user_id, u.name, u.email, u.phone, u.role, u.status, u.created_at as user_created_at
       FROM personal_access_tokens t
       JOIN users u ON u.id = t.tokenable_id
       WHERE (t.token = ? OR t.token = ?) LIMIT 1`,
      [tokenHash, rawToken]
    );

    if (!rows || rows.length === 0) {
      return null;
    }

    const record = rows[0];

    // Check expiration policy
    const nowMs = Date.now();
    if (record.expires_at) {
      const expiresAtMs = new Date(String(record.expires_at)).getTime();
      if (expiresAtMs <= nowMs) {
        // Token is expired
        return null;
      }
    } else if (record.token_created_at) {
      // Fallback: 7 days max lifetime if expires_at was somehow missing
      const createdMs = new Date(String(record.token_created_at)).getTime();
      if (nowMs - createdMs > TokenService.DEFAULT_EXPIRATION_DAYS * 24 * 60 * 60 * 1000) {
        return null;
      }
    }

    // Check account status
    if (record.status && record.status !== "active") {
      return null;
    }

    // Update last_used_at timestamp without leaking secret
    const nowIso = new Date().toISOString();
    db.run("UPDATE personal_access_tokens SET last_used_at = ? WHERE id = ?", [nowIso, record.token_id]);
    persistDatabase();

    let abilities: string[] = [];
    try {
      abilities = record.abilities ? JSON.parse(String(record.abilities)) : [];
    } catch {
      abilities = [];
    }

    return {
      id: Number(record.user_id),
      name: String(record.name),
      email: String(record.email),
      phone: record.phone ? String(record.phone) : null,
      role: String(record.role || "customer"),
      status: String(record.status || "active"),
      created_at: String(record.user_created_at),
      current_token_id: Number(record.token_id),
      abilities,
    };
  }

  /**
   * Revoke the specific token from the current request (Logout).
   */
  public static async revokeToken(rawToken: string): Promise<boolean> {
    const tokenHash = TokenService.hashToken(rawToken);
    const db = await getDatabase();
    db.run("DELETE FROM personal_access_tokens WHERE token = ?", [tokenHash]);
    const modified = db.getRowsModified();
    persistDatabase();
    return modified > 0;
  }

  /**
   * Revoke all tokens for a user (e.g. after password reset).
   */
  public static async revokeAllUserTokens(userId: number): Promise<number> {
    const db = await getDatabase();
    db.run("DELETE FROM personal_access_tokens WHERE tokenable_id = ?", [userId]);
    const count = db.getRowsModified();
    persistDatabase();
    return count;
  }

  /**
   * Revoke other active tokens for a user (e.g. after password change), preserving current session.
   */
  public static async revokeOtherUserTokens(userId: number, currentTokenId: number): Promise<number> {
    const db = await getDatabase();
    db.run(
      "DELETE FROM personal_access_tokens WHERE tokenable_id = ? AND id != ?",
      [userId, currentTokenId]
    );
    const count = db.getRowsModified();
    persistDatabase();
    return count;
  }

  /**
   * List all active sessions for a user without leaking any token hashes or secrets.
   */
  public static async listUserSessions(
    userId: number,
    currentTokenId: number
  ): Promise<UserSessionItem[]> {
    const db = await getDatabase();
    const rows = queryRows(
      db,
      `SELECT id, name, last_used_at, expires_at, created_at 
       FROM personal_access_tokens 
       WHERE tokenable_id = ? 
       ORDER BY COALESCE(last_used_at, created_at) DESC`,
      [userId]
    );

    return (rows || []).map((row: any) => ({
      id: Number(row.id),
      device: String(row.name || "دستگاه ناشناس"),
      browser: "توکن دسترسی",
      os: "",
      location: "",
      ip: "",
      last_active: String(row.last_used_at || row.created_at),
      created_at: String(row.created_at),
      expires_at: String(row.expires_at || ""),
      is_current: Number(row.id) === Number(currentTokenId),
    }));
  }

  /**
   * Terminate a specific session.
   * Prevents deleting another user's session and prevents deleting current session via destroy.
   */
  public static async destroyUserSession(
    userId: number,
    sessionIdToDestroy: number,
    currentTokenId: number
  ): Promise<{ success: boolean; error?: string; message: string; statusCode: number }> {
    if (Number(sessionIdToDestroy) === Number(currentTokenId)) {
      return {
        success: false,
        error: "CURRENT_SESSION",
        message: "Use logout to terminate the current session.",
        statusCode: 422,
      };
    }

    const db = await getDatabase();
    db.run(
      "DELETE FROM personal_access_tokens WHERE id = ? AND tokenable_id = ?",
      [sessionIdToDestroy, userId]
    );

    const deleted = db.getRowsModified();
    persistDatabase();

    if (deleted === 0) {
      return {
        success: false,
        error: "SESSION_NOT_FOUND",
        message: "Session not found.",
        statusCode: 404,
      };
    }

    return {
      success: true,
      message: "Session terminated successfully.",
      statusCode: 200,
    };
  }

  /**
   * Migration / Startup safety: Invalidate legacy plaintext tokens (length != 64 hex characters)
   * rather than preserving unhashed secrets in the database.
   */
  public static async invalidateLegacyPlaintextTokens(): Promise<number> {
    const db = await getDatabase();
    // A SHA-256 hex string is exactly 64 hexadecimal characters
    db.run("DELETE FROM personal_access_tokens WHERE length(token) != 64");
    const count = db.getRowsModified();
    if (count > 0) {
      persistDatabase();
    }
    return count;
  }
}
