import { Request, Response, NextFunction } from "express";

export interface CorsConfig {
  appEnv: string;
  allowedOrigins: string[];
  allowedMethods: string[];
  allowedHeaders: string[];
  exposedHeaders: string[];
  maxAge: number;
  supportsCredentials: boolean;
}

/**
 * Normalize origin to scheme://host[:port]
 * Lowers scheme and host, strips default ports (80, 443) and trailing slashes.
 */
export function normalizeOrigin(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed === "*") return "*";

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    const scheme = parsed.protocol.replace(":", "").toLowerCase();
    const host = parsed.hostname.toLowerCase();
    const port = parsed.port ? parseInt(parsed.port, 10) : null;

    if ((scheme === "http" && port === 80) || (scheme === "https" && port === 443)) {
      return `${scheme}://${host}`;
    }

    return port ? `${scheme}://${host}:${port}` : `${scheme}://${host}`;
  } catch {
    return null;
  }
}

/**
 * Resolve allowed origins based on environment
 */
export function resolveCorsOrigins(appEnv: string = process.env.APP_ENV || process.env.NODE_ENV || "production"): string[] {
  let rawOrigins = "";
  if (appEnv === "production") {
    rawOrigins = process.env.CORS_ALLOWED_ORIGINS_PRODUCTION || process.env.CORS_ALLOWED_ORIGINS || "";
  } else if (appEnv === "staging") {
    rawOrigins = process.env.CORS_ALLOWED_ORIGINS_STAGING || process.env.CORS_ALLOWED_ORIGINS || "";
  } else {
    rawOrigins = process.env.CORS_ALLOWED_ORIGINS || "http://localhost:3000,http://127.0.0.1:3000";
  }

  const parts = rawOrigins.split(",").map((p) => p.trim()).filter(Boolean);
  const normalized: string[] = [];

  for (const part of parts) {
    const cleaned = normalizeOrigin(part);
    if (cleaned && !normalized.includes(cleaned)) {
      normalized.push(cleaned);
    }
  }

  return normalized;
}

/**
 * Validate CORS configuration for safety
 */
export function validateCorsConfig(appEnv: string, allowedOrigins: string[], supportsCredentials: boolean): void {
  const hasWildcard = allowedOrigins.includes("*");

  if (supportsCredentials && hasWildcard) {
    throw new Error("CORS configuration violation: supports_credentials cannot be enabled with wildcard origins ('*').");
  }

  if (appEnv === "production") {
    if (hasWildcard) {
      throw new Error("CORS configuration violation: Wildcard origin ('*') is strictly prohibited in production.");
    }
    if (allowedOrigins.length === 0) {
      throw new Error("CORS configuration violation: CORS_ALLOWED_ORIGINS_PRODUCTION or CORS_ALLOWED_ORIGINS must be set in production.");
    }
  }
}

export function createCorsMiddleware(customConfig?: Partial<CorsConfig>) {
  const appEnv = customConfig?.appEnv || process.env.APP_ENV || process.env.NODE_ENV || "development";
  const supportsCredentials = customConfig?.supportsCredentials ?? (process.env.CORS_SUPPORTS_CREDENTIALS === "true");
  const allowedOrigins = customConfig?.allowedOrigins ?? resolveCorsOrigins(appEnv);
  const allowedMethods = customConfig?.allowedMethods ?? ["GET", "POST", "PUT", "DELETE", "OPTIONS"];
  const allowedHeaders = customConfig?.allowedHeaders ?? [
    "Content-Type",
    "Authorization",
    "Accept",
    "X-Session-ID",
    "X-Idempotency-Key",
    "X-Requested-With",
  ];
  const exposedHeaders = customConfig?.exposedHeaders ?? [
    "X-RateLimit-Limit",
    "X-RateLimit-Remaining",
    "X-RateLimit-Reset",
  ];
  const maxAge = customConfig?.maxAge ?? 86400;

  // Validate on startup
  validateCorsConfig(appEnv, allowedOrigins, supportsCredentials);

  return function corsMiddleware(req: Request, res: Response, next: NextFunction) {
    const requestOrigin = req.headers.origin;

    // Non-CORS request (missing Origin header)
    if (!requestOrigin) {
      return next();
    }

    const normalizedReqOrigin = normalizeOrigin(requestOrigin);
    const isAllowed = normalizedReqOrigin && (
      allowedOrigins.includes("*") ||
      allowedOrigins.some((allowed) => normalizeOrigin(allowed) === normalizedReqOrigin)
    );

    if (isAllowed && normalizedReqOrigin) {
      // Set matching Origin header (never reflect arbitrary unknown origin)
      res.setHeader("Access-Control-Allow-Origin", normalizedReqOrigin);
      res.setHeader("Vary", "Origin");

      if (supportsCredentials) {
        res.setHeader("Access-Control-Allow-Credentials", "true");
      }

      if (req.method === "OPTIONS") {
        // Preflight request validation
        const requestedMethod = req.headers["access-control-request-method"] as string | undefined;
        if (requestedMethod && !allowedMethods.includes(requestedMethod.toUpperCase())) {
          return res.status(405).json({
            success: false,
            message: `Method ${requestedMethod} is not allowed by CORS policy.`,
            error_code: "CORS_METHOD_DISALLOWED",
          });
        }

        res.setHeader("Access-Control-Allow-Methods", allowedMethods.join(", "));
        res.setHeader("Access-Control-Allow-Headers", allowedHeaders.join(", "));
        res.setHeader("Access-Control-Max-Age", maxAge.toString());
        return res.status(204).end();
      }

      res.setHeader("Access-Control-Expose-Headers", exposedHeaders.join(", "));
      return next();
    }

    // Origin is not allowed
    if (req.method === "OPTIONS") {
      return res.status(403).json({
        success: false,
        message: "Origin is not allowed by CORS policy.",
        error_code: "CORS_FORBIDDEN",
      });
    }

    // For standard requests from disallowed origins, do NOT send any Access-Control-Allow-Origin
    return next();
  };
}
