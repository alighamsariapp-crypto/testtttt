import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { getDatabase } from "./src/server/db";
import { mountDevelopmentApiRoutes } from "./src/server/devApiAdapter";
import { createCorsMiddleware } from "./src/server/corsMiddleware";

/**
 * PRODUCTION ARCHITECTURE ENFORCEMENT
 *
 * Laravel (PHP 8.3 / Apache / DirectAdmin) is the ONLY production backend and the
 * ONLY authoritative implementation of /api/v1/*.
 *
 * Express is strictly a development server (running Vite middleware and optional
 * local dev adapter). In production, this Node process is NOT a production API.
 * If NODE_ENV=production, startup check prevents mounting any Express API route.
 */

async function startServer() {
  const isProduction = process.env.NODE_ENV === "production";

  // Startup safety check: Fail immediately if someone attempts to run Express in production
  // with any expectation of serving business API routes.
  if (isProduction && process.env.ENABLE_EXPRESS_API === "true") {
    throw new Error(
      "[FATAL PRODUCTION ARCHITECTURE ERROR] Express business API routes cannot be enabled in production!\n" +
      "Laravel 12 (routes/api.php) is the ONLY authoritative production backend for ApexStore.\n" +
      "Express is strictly for development and cannot serve production API routes."
    );
  }

  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json());
  app.use(createCorsMiddleware());

  if (isProduction) {
    // In production mode, Express MUST NOT expose any business routes under /api/v1/*
    // or /api/*. Any request that accidentally hits this process for /api/* immediately
    // responds with a 404 or 503 explaining that Laravel is the authoritative backend.
    app.all(["/api", "/api/*"], (_req, res) => {
      res.status(404).json({
        success: false,
        error_code: "LARAVEL_AUTHORITATIVE_BACKEND",
        message: "Production API routes are served exclusively by the Laravel backend (routes/api.php). Express does not serve API endpoints in production.",
      });
    });

    // Optional static preview uses the same public/ artifact that Apache/Laravel
    // serves in the supported shared-hosting deployment.
    const publicPath = path.join(process.cwd(), "public");
    app.use(express.static(publicPath));
    app.get("*", (_req, res) => {
      const indexPath = path.join(publicPath, "index.html");
      if (fs.existsSync(indexPath)) {
        return res.sendFile(indexPath);
      }
      res.status(404).send("Frontend build not found. Please run 'pnpm build'.");
    });
  } else {
    // Development mode: Initialize local SQLite database and mount development adapter routes
    const db = await getDatabase();
    mountDevelopmentApiRoutes(app, db);

    // Development catch-all for unmatched /api routes
    app.all(["/api", "/api/*"], (_req, res) => {
      res.status(404).json({
        success: false,
        error_code: "NOT_FOUND",
        message: "API endpoint not found in development adapter.",
      });
    });

    // Vite middleware for development
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    if (isProduction) {
      console.log(`[Production Static Host] Server running on http://0.0.0.0:${PORT} (API served by Laravel)`);
    } else {
      console.log(`[Development Server] Server running on http://0.0.0.0:${PORT} (Express Dev Adapter mounted)`);
    }
  });
}

startServer();
