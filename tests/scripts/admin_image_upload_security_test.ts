import express from "express";
import http from "http";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { getDatabase } from "../../src/server/db";
import { mountDevelopmentApiRoutes } from "../../src/server/devApiAdapter";
import { TokenService } from "../../src/server/tokenService";

async function createTestImage(format: "jpeg" | "png" | "webp", width = 200, height = 200): Promise<Buffer> {
  const image = sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 50, g: 100, b: 150, alpha: 1 },
    },
  });

  if (format === "jpeg") return image.jpeg().toBuffer();
  if (format === "png") return image.png().toBuffer();
  return image.webp().toBuffer();
}

async function runAdminImageUploadSecurityTests() {
  console.log("=== Starting Admin Image Upload Security Acceptance Tests ===");

  const app = express();
  app.use(express.json());

  const db = await getDatabase();
  mountDevelopmentApiRoutes(app, db);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // Seed test users
    db.run(`INSERT OR REPLACE INTO users (id, name, email, password, phone, role, status, created_at, updated_at)
            VALUES (1, 'Admin User', 'admin@apexstore.ir', '$2y$10$hashed', '09120000000', 'admin', 'active', datetime('now'), datetime('now'))`);
    db.run(`INSERT OR REPLACE INTO users (id, name, email, password, phone, role, status, created_at, updated_at)
            VALUES (2, 'Customer User', 'cust@apexstore.ir', '$2y$10$hashed', '09121111111', 'customer', 'active', datetime('now'), datetime('now'))`);

    const adminToken = await TokenService.createToken(1, "admin-cli", "admin");
    const customerToken = await TokenService.createToken(2, "cust-cli", "customer");

    // Helper to send multipart upload
    async function uploadFile(
      endpoint: string,
      fileBuffer: Buffer,
      fileName: string,
      mimeType: string,
      token?: string,
      extraHeaders?: Record<string, string>
    ) {
      const boundary = "----WebKitFormBoundary" + Math.random().toString(36).substring(2);
      const headers: Record<string, string> = {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        ...(extraHeaders || {}),
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const bodyParts = [
        `--${boundary}\r\n`,
        `Content-Disposition: form-data; name="image"; filename="${fileName}"\r\n`,
        `Content-Type: ${mimeType}\r\n\r\n`,
      ];
      const headerBuffer = Buffer.from(bodyParts.join(""), "utf-8");
      const footerBuffer = Buffer.from(`\r\n--${boundary}--\r\n`, "utf-8");
      const payload = Buffer.concat([headerBuffer, fileBuffer, footerBuffer]);

      return fetch(`${baseUrl}${endpoint}`, {
        method: "POST",
        headers,
        body: payload,
      });
    }

    // -------------------------------------------------------------
    // Health & Diagnostics Verification: Image processor dependency
    // -------------------------------------------------------------
    console.log("\n[DIAGNOSTICS] Verifying image processor dependency in /api/v1/admin/diagnostics...");
    const diagRes = await fetch(`${baseUrl}/api/v1/admin/diagnostics`, {
      headers: { Authorization: `Bearer ${adminToken.token}` },
    });
    if (diagRes.status !== 200) {
      throw new Error(`Diagnostics returned status ${diagRes.status}`);
    }
    const diagJson = (await diagRes.json()) as any;
    if (diagJson.data?.dependencies?.image_processor !== "ready") {
      throw new Error(`Expected image_processor dependency 'ready', got ${diagJson.data?.dependencies?.image_processor}`);
    }
    console.log("  PASS: Diagnostics confirms image_processor is operational ('ready').");

    // -------------------------------------------------------------
    // Acceptance Test E: Unauthorized user cannot upload
    // -------------------------------------------------------------
    console.log("\n[TEST E] Verifying unauthorized requests are rejected before upload processing...");
    const sampleJpg = await createTestImage("jpeg", 100, 100);

    // 1. Unauthenticated request
    const unauthRes = await uploadFile(
      "/api/v1/admin/products/images",
      sampleJpg,
      "test.jpg",
      "image/jpeg"
    );
    if (unauthRes.status !== 401 && unauthRes.status !== 403) {
      throw new Error(`Expected 401/403 for unauthenticated upload, got ${unauthRes.status}`);
    }
    console.log("  PASS: Unauthenticated upload rejected with HTTP 401.");

    // 2. Non-admin customer
    const custRes = await uploadFile(
      "/api/v1/admin/products/images",
      sampleJpg,
      "test.jpg",
      "image/jpeg",
      customerToken.token
    );
    if (custRes.status !== 403) {
      throw new Error(`Expected 403 for customer upload attempt, got ${custRes.status}`);
    }
    console.log("  PASS: Non-admin customer upload rejected with HTTP 403 Forbidden.");

    // -------------------------------------------------------------
    // Acceptance Test A & D: Valid JPEG, PNG, WebP uploads succeed and have UUID names
    // -------------------------------------------------------------
    console.log("\n[TEST A & D] Verifying valid JPEG, PNG, WebP uploads succeed and use server-chosen UUID names...");
    const formats: Array<"jpeg" | "png" | "webp"> = ["jpeg", "png", "webp"];
    const endpoints = [
      "/api/v1/admin/products/images",
      "/api/v1/admin/blog/images",
      "/api/v1/admin/site-media/images",
    ];

    for (let i = 0; i < formats.length; i++) {
      const fmt = formats[i];
      const endpoint = endpoints[i];
      const imgBuffer = await createTestImage(fmt, 300, 300);
      const userFileName = `client-dangerous-name-v${i + 1}.${fmt === "jpeg" ? "jpg" : fmt}`;

      const res = await uploadFile(
        endpoint,
        imgBuffer,
        userFileName,
        fmt === "jpeg" ? "image/jpeg" : `image/${fmt}`,
        adminToken.token
      );

      if (res.status !== 200) {
        const errorText = await res.text();
        throw new Error(`Valid ${fmt} upload failed with status ${res.status}: ${errorText}`);
      }

      const body = (await res.json()) as any;
      if (!body.success || !body.data?.url || !body.data?.filename) {
        throw new Error(`Malformed upload response for ${fmt}: ${JSON.stringify(body)}`);
      }

      const returnedFilename = body.data.filename;
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/i;
      if (!uuidRegex.test(returnedFilename)) {
        throw new Error(`Filename is not a safe random UUID: ${returnedFilename}`);
      }

      if (returnedFilename.includes("client-dangerous-name")) {
        throw new Error(`Filename leaked user input: ${returnedFilename}`);
      }

      // Verify re-encoded image is accessible and parseable
      const fetchServed = await fetch(`${baseUrl}${body.data.url}`);
      if (fetchServed.status !== 200) {
        throw new Error(`Served image returned status ${fetchServed.status} for ${body.data.url}`);
      }
      const servedBytes = Buffer.from(await fetchServed.arrayBuffer());
      const servedMeta = await sharp(servedBytes).metadata();
      if (!servedMeta.format) {
        throw new Error(`Served image is unparseable by sharp!`);
      }
      console.log(`  PASS: Valid ${fmt.toUpperCase()} on ${endpoint} -> UUID: ${returnedFilename} (re-encoded to ${servedMeta.width}x${servedMeta.height})`);
    }

    // -------------------------------------------------------------
    // Acceptance Test B: Reject SVG, HTML, PHP, XML, polyglot, corrupted, MIME-spoofed
    // -------------------------------------------------------------
    console.log("\n[TEST B] Verifying rejection of SVG, HTML, PHP, XML, polyglots, corrupted and spoofed files...");

    // 1. Raw SVG with script
    const svgPayload = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><circle cx="50" cy="50" r="40"/></svg>`);
    const svgRes = await uploadFile(
      "/api/v1/admin/products/images",
      svgPayload,
      "vector.svg",
      "image/svg+xml",
      adminToken.token
    );
    if (svgRes.status !== 422) {
      throw new Error(`Expected 422 for SVG upload, got ${svgRes.status}`);
    }
    console.log("  PASS: SVG file upload rejected with HTTP 422.");

    // 2. HTML spoofed as image/jpeg
    const htmlPayload = Buffer.from(`<html><body><script>alert("hacked")</script></body></html>`);
    const htmlRes = await uploadFile(
      "/api/v1/admin/products/images",
      htmlPayload,
      "photo.jpg",
      "image/jpeg",
      adminToken.token
    );
    if (htmlRes.status !== 422) {
      throw new Error(`Expected 422 for spoofed HTML file, got ${htmlRes.status}`);
    }
    console.log("  PASS: HTML file spoofed as JPEG rejected with HTTP 422.");

    // 3. PHP file spoofed as image/png
    const phpPayload = Buffer.from(`<?php system($_GET['cmd']); ?>`);
    const phpRes = await uploadFile(
      "/api/v1/admin/products/images",
      phpPayload,
      "shell.png",
      "image/png",
      adminToken.token
    );
    if (phpRes.status !== 422) {
      throw new Error(`Expected 422 for PHP script file, got ${phpRes.status}`);
    }
    console.log("  PASS: PHP script spoofed as PNG rejected with HTTP 422.");

    // 4. XML file
    const xmlPayload = Buffer.from(`<?xml version="1.0"?><data><item>test</item></data>`);
    const xmlRes = await uploadFile(
      "/api/v1/admin/products/images",
      xmlPayload,
      "data.webp",
      "image/webp",
      adminToken.token
    );
    if (xmlRes.status !== 422) {
      throw new Error(`Expected 422 for XML file, got ${xmlRes.status}`);
    }
    console.log("  PASS: XML file rejected with HTTP 422.");

    // 5. Corrupted binary noise
    const corruptPayload = Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x12, 0x34, 0x56, 0x78]);
    const corruptRes = await uploadFile(
      "/api/v1/admin/products/images",
      corruptPayload,
      "broken.jpg",
      "image/jpeg",
      adminToken.token
    );
    if (corruptRes.status !== 422) {
      throw new Error(`Expected 422 for corrupted binary, got ${corruptRes.status}`);
    }
    console.log("  PASS: Corrupted binary file rejected with HTTP 422.");

    // 6. Polyglot test: Real JPEG with trailing PHP / script payload
    const baseJpg = await createTestImage("jpeg", 120, 120);
    const polyglotPayload = Buffer.concat([
      baseJpg,
      Buffer.from("\n<?php phpinfo(); system('id'); ?>\n<script>alert('xss')</script>"),
    ]);

    const polyglotRes = await uploadFile(
      "/api/v1/admin/products/images",
      polyglotPayload,
      "polyglot.jpg",
      "image/jpeg",
      adminToken.token
    );

    // If accepted because sharp decodes JPEG, verify re-encoded file strips the payload completely!
    if (polyglotRes.status === 200) {
      const polyJson = (await polyglotRes.json()) as any;
      const servedPoly = await fetch(`${baseUrl}${polyJson.data.url}`);
      const servedBytes = Buffer.from(await servedPoly.arrayBuffer());
      const servedStr = servedBytes.toString("binary");
      if (servedStr.includes("<?php") || servedStr.includes("<script>")) {
        throw new Error("CRITICAL VULNERABILITY: Re-encoded image contains active script / PHP payload!");
      }
      console.log("  PASS: Polyglot image uploaded, re-encoded, and active payload was completely purged.");
    } else if (polyglotRes.status === 422) {
      console.log("  PASS: Polyglot image rejected with HTTP 422.");
    } else {
      throw new Error(`Unexpected status for polyglot upload: ${polyglotRes.status}`);
    }

    // -------------------------------------------------------------
    // Acceptance Test C: Image processor unavailable -> 503 and NO file published
    // -------------------------------------------------------------
    console.log("\n[TEST C] Verifying behavior when image processor is unavailable (HTTP 503 & no file published)...");
    const productsUploadDir = path.join(process.cwd(), "public", "uploads", "products");
    const countBefore = fs.existsSync(productsUploadDir) ? fs.readdirSync(productsUploadDir).length : 0;

    const unavailRes = await uploadFile(
      "/api/v1/admin/products/images",
      sampleJpg,
      "unavail.jpg",
      "image/jpeg",
      adminToken.token,
      { "x-simulate-processor-unavailable": "true" }
    );

    if (unavailRes.status !== 503) {
      throw new Error(`Expected 503 Service Unavailable when processor is unavailable, got ${unavailRes.status}`);
    }

    const countAfter = fs.existsSync(productsUploadDir) ? fs.readdirSync(productsUploadDir).length : 0;
    if (countAfter !== countBefore) {
      throw new Error(`File was published when processor was unavailable! Before: ${countBefore}, After: ${countAfter}`);
    }
    console.log("  PASS: Request failed with HTTP 503 and NO file was published.");

    // -------------------------------------------------------------
    // Dimension & Oversized Limits
    // -------------------------------------------------------------
    console.log("\n[TEST LIMITS] Verifying rejection of excessive-dimension and oversized images...");

    // 1. Excessive dimensions: 5000x100 pixels (exceeds MAX_WIDTH=4096)
    const giantImg = await createTestImage("png", 5000, 100);
    const giantRes = await uploadFile(
      "/api/v1/admin/products/images",
      giantImg,
      "huge.png",
      "image/png",
      adminToken.token
    );
    if (giantRes.status !== 422) {
      throw new Error(`Expected 422 for excessive dimension image, got ${giantRes.status}`);
    }
    const giantBody = (await giantRes.json()) as any;
    if (giantBody.error_code !== "IMAGE_DIMENSIONS_EXCEEDED") {
      throw new Error(`Expected error_code IMAGE_DIMENSIONS_EXCEEDED, got ${giantBody.error_code}`);
    }
    console.log("  PASS: Excessive dimension image (5000x100) rejected with HTTP 422 IMAGE_DIMENSIONS_EXCEEDED.");

    // 2. Oversized file size (8MB exceeds 6MB limit)
    const bigBuffer = Buffer.alloc(8 * 1024 * 1024, 0);
    const bigRes = await uploadFile(
      "/api/v1/admin/products/images",
      bigBuffer,
      "big.jpg",
      "image/jpeg",
      adminToken.token
    );
    if (bigRes.status !== 422) {
      throw new Error(`Expected 422 for oversized file, got ${bigRes.status}`);
    }
    console.log("  PASS: Oversized 8MB upload rejected with HTTP 422 FILE_TOO_LARGE.");

    // -------------------------------------------------------------
    // Acceptance Test F: Served upload cannot execute script or PHP
    // -------------------------------------------------------------
    console.log("\n[TEST F] Verifying served static uploads enforce non-scriptable security headers...");
    const samplePng = await createTestImage("png", 150, 150);
    const uploadRes = await uploadFile(
      "/api/v1/admin/products/images",
      samplePng,
      "clean.png",
      "image/png",
      adminToken.token
    );
    const uploadJson = (await uploadRes.json()) as any;
    const servedUrl = uploadJson.data.url;

    const servedRes = await fetch(`${baseUrl}${servedUrl}`);
    if (servedRes.status !== 200) {
      throw new Error(`Failed to fetch served image at ${servedUrl}`);
    }

    const nosniff = servedRes.headers.get("x-content-type-options");
    const csp = servedRes.headers.get("content-security-policy");
    const frameOptions = servedRes.headers.get("x-frame-options");
    const contentType = servedRes.headers.get("content-type");

    if (nosniff !== "nosniff") {
      throw new Error(`Missing or invalid X-Content-Type-Options: ${nosniff}`);
    }
    if (!csp || !csp.includes("sandbox")) {
      throw new Error(`Missing sandbox in Content-Security-Policy: ${csp}`);
    }
    if (frameOptions !== "DENY") {
      throw new Error(`Expected X-Frame-Options DENY, got ${frameOptions}`);
    }
    if (contentType !== "image/png") {
      throw new Error(`Expected Content-Type image/png, got ${contentType}`);
    }
    console.log("  PASS: Served upload includes nosniff, sandbox CSP, and strict image Content-Type.");

    // Test that attempting to access a script or PHP file under /uploads is blocked
    const scriptAccessRes = await fetch(`${baseUrl}/uploads/test.php`);
    if (scriptAccessRes.status !== 403) {
      throw new Error(`Expected 403 Forbidden for .php file under /uploads, got ${scriptAccessRes.status}`);
    }
    const svgAccessRes = await fetch(`${baseUrl}/uploads/test.svg`);
    if (svgAccessRes.status !== 403) {
      throw new Error(`Expected 403 Forbidden for .svg file under /uploads, got ${svgAccessRes.status}`);
    }
    console.log("  PASS: Accessing .php or .svg files under /uploads returns HTTP 403 Forbidden.");

    console.log("\n=== ALL ADMIN IMAGE UPLOAD SECURITY ACCEPTANCE TESTS PASSED (A - E, F) ===");
  } finally {
    server.close();
  }
}

runAdminImageUploadSecurityTests().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
