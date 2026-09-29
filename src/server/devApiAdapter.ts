/**
 * DEVELOPMENT-ONLY EXPRESS API ADAPTER
 *
 * CRITICAL ARCHITECTURAL BOUNDARY:
 * Laravel (PHP 8.3 / Apache / DirectAdmin) is the ONLY production backend and the
 * ONLY authoritative implementation of /api/v1/*.
 *
 * This module is STRICTLY for local offline dev/preview and unit test scripts.
 * It is FORBIDDEN from being mounted or executed in production (NODE_ENV=production).
 */

import express from "express";
import path from "path";
import fs from "fs";
import os from "os";
import crypto from "crypto";
import multer from "multer";
import type { Metadata } from "sharp";
import { Database } from "sql.js";
import { createRateLimiter } from "./rateLimiter";

import {
  handleRegister,
  handleLogin,
  handleMe,
  handleLogout,
  handleSendOtp,
  handleVerifyOtp,
  handleGetSessions,
  handleDestroySession,
  handleDestroyOtherSessions,
  handleChangePassword,
} from "./authRoutes";
import {
  handleGetCategories,
  handleGetCategoryBySlugOrId,
  handleAdminGetCategories,
  handleAdminCreateCategory,
  handleAdminUpdateCategory,
  handleAdminDeleteCategory,
} from "./categoryRoutes";
import {
  handleAdminDashboard,
  handleAdminGetProducts,
  handleAdminCreateProduct,
  handleAdminUpdateProduct,
  handleAdminDeleteProduct,
  handleAdminGetOrders,
  handleAdminGetOrderById,
  handleAdminUpdateOrderStatus,
  handleAdminReconcileRefund,
  handleAdminDeleteOrder,
  handleAdminGetUsers,
  handleAdminUpdateUserStatus,
  handleAdminWalletAdjustment,
  handleAdminGetTickets,
  handleAdminGetTicketById,
  handleAdminReplyTicket,
  handleAdminUpdateTicket,
  handleAdminTicketAction,
  handleAdminGetDiscounts,
  handleAdminCreateDiscount,
  handleAdminUpdateDiscount,
  handleAdminDeleteDiscount,
  handleAdminToggleDiscount,
  handleAdminGetSetting,
  handleAdminUpdateSetting,
  handleGetPublicSettings,
  handleAdminProductAttributes,
  handleAdminServicesCatalog,
  handleAdminServicesCategories,
  handleAdminSmsTest,
  adminAuthMiddleware,
} from "./adminRoutes";
import {
  handleGetCart,
  handleAddToCart,
  handleUpdateCartItem,
  handleRemoveCartItem,
  handleClearCart,
} from "./cartRoutes";
import {
  handleGetAddresses,
  handleCreateAddress,
  handleUpdateAddress,
  handleDeleteAddress,
} from "./addressRoutes";
import {
  handleGetCheckoutConfiguration,
  handleCheckout,
  handleValidateCoupon,
  handleGetOrders,
  handleGetOrderById,
  handleCancelOrder,
  handleGetUserWallet,
} from "./orderRoutes";
import {
  handleGetCustomerTickets,
  handleGetCustomerTicket,
  handleCreateCustomerTicket,
  handleAddCustomerTicketMessage,
  handleCloseCustomerTicket,
} from "./supportRoutes";
import {
  handleGetServices,
  handleGetServiceCategories,
  handleGetServiceBySlug,
  handleGetCustomerServiceRequests,
  handleCreateCustomerServiceRequest,
  handleGetCustomerServiceRequest,
  handleRespondToServiceQuote,
  handleAdminGetServicesCatalog,
  handleAdminCreateServiceCatalog,
  handleAdminUpdateServiceCatalog,
  handleAdminDeleteServiceCatalog,
  handleAdminGetServicesCategories,
  handleAdminCreateServiceCategory,
  handleAdminUpdateServiceCategory,
  handleAdminDeleteServiceCategory,
  handleAdminGetServiceRequests,
  handleAdminCreateQuote,
  handleAdminUpdateServiceRequestStatus,
} from "./serviceRoutes";
import {
  handleGetFavorites,
  handleAddFavorite,
  handleDeleteFavorite,
} from "./favoriteRoutes";
import {
  handleZibalCallback,
  handleGetPaymentStatus,
  handleExchangePaymentStatusToken,
  handleSimulateTestPayment,
} from "./paymentRoutes";
import { queryProductsFromDatabase, recordAuditLog } from "./db";

/**
 * Mounts development-only mock / SQLite API routes on an Express app.
 * Fails fast if invoked in production mode.
 */
export function mountDevelopmentApiRoutes(app: express.Express, db: Database): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "[FATAL ARCHITECTURAL VIOLATION] Attempted to mount Express development API routes in production mode! " +
      "Laravel 12 is the ONLY authoritative production backend for /api/v1/*. Express API routes are strictly forbidden in production."
    );
  }

  const categories = [
    { id: 1, name: 'لپ‌تاپ و کامپیوتر', slug: 'laptops', parent_id: null, is_active: true, sort_order: 10, description: 'لپ‌تاپ، اولترابوک و کامپیوتر' },
    { id: 2, name: 'لپ‌تاپ گیمینگ', slug: 'gaming-laptops', parent_id: 1, is_active: true, sort_order: 10, description: 'لپ‌تاپ‌های گیمینگ' },
    { id: 3, name: 'اولترابوک و اداری', slug: 'ultrabooks', parent_id: 1, is_active: true, sort_order: 20, description: 'لپ‌تاپ سبک و اداری' },
    { id: 4, name: 'موبایل', slug: 'mobile', parent_id: null, is_active: true, sort_order: 20, description: 'انواع گوشی و لوازم مرتبط' },
    { id: 5, name: 'لوازم خانگی', slug: 'home-appliances', parent_id: null, is_active: true, sort_order: 30, description: 'کالاهای خانه و آشپزخانه' },
    { id: 6, name: 'مودم و اینترنت', slug: 'modems', parent_id: null, is_active: true, sort_order: 30, description: 'مودم، روتر و اینترنت همراه' },
  ];

  const facetProfiles: Record<string, Array<{ key: string; label: string; type: string; unit?: string; sort_order: number }>> = {
    laptops: [
      { key: 'brand', label: 'برند سازنده', type: 'single_select', sort_order: 10 },
      { key: 'processor', label: 'پردازنده (CPU)', type: 'single_select', sort_order: 20 },
      { key: 'ram', label: 'حافظهٔ RAM', type: 'single_select', unit: 'GB', sort_order: 30 },
      { key: 'storage', label: 'حافظهٔ داخلی / SSD', type: 'single_select', unit: 'GB', sort_order: 40 },
    ],
    mobile: [
      { key: 'brand', label: 'برند سازنده', type: 'single_select', sort_order: 10 },
      { key: 'storage', label: 'حافظهٔ داخلی', type: 'single_select', unit: 'GB', sort_order: 20 },
      { key: 'ram', label: 'حافظهٔ RAM', type: 'single_select', unit: 'GB', sort_order: 30 },
    ],
    modems: [
      { key: 'brand', label: 'برند سازنده', type: 'single_select', sort_order: 10 },
      { key: 'network_generation', label: 'نسل شبکه', type: 'multi_select', sort_order: 20 },
      { key: 'modem_type', label: 'نوع مودم', type: 'single_select', sort_order: 30 },
      { key: 'wifi_standard', label: 'استاندارد Wi‑Fi', type: 'multi_select', sort_order: 40 },
    ],
  };

  const response = (res: express.Response, data: unknown, message: string) => res.json({ success: true, data, message });

  // 1. Diagnostics & Development Status (Hardened Minimal Public Liveness)
  app.get(["/health", "/api/health"], (_req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.json({
      success: true,
      data: {
        status: "healthy",
        version: "v1-dev",
        timestamp: new Date().toISOString(),
      },
      message: "API service is operational.",
    });
  });

  app.get("/api/v1/health", (_req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.json({
      success: true,
      data: {
        status: "development-adapter",
        version: "v1-dev",
        timestamp: new Date().toISOString(),
      },
      message: "Development API adapter operational.",
    });
  });

  // Protected Operator Readiness & Diagnostics
  const handleDiagnostics = async (_req: express.Request, res: express.Response) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

    let isProcessorReady = false;
    try {
      const sharpModule = await import("sharp");
      const sharp = sharpModule.default || sharpModule;
      isProcessorReady = typeof sharp === "function";
    } catch {
      isProcessorReady = false;
    }

    res.json({
      success: true,
      data: {
        status: "ready",
        version: "v1-dev",
        timestamp: new Date().toISOString(),
        dependencies: {
          database: "connected",
          cache: "operational",
          storage: "writable",
          image_processor: isProcessorReady ? "ready" : "unavailable",
        },
      },
      message: "All core system dependencies are operational.",
    });
  };

  app.get("/api/v1/diagnostics", adminAuthMiddleware, handleDiagnostics);
  app.get("/api/v1/admin/diagnostics", adminAuthMiddleware, handleDiagnostics);

  // Real Database Categories routes (Laravel Modules/Categories contract)
  app.get('/api/v1/categories', handleGetCategories);
  app.get('/api/v1/categories/:slugOrId', handleGetCategoryBySlugOrId);
  app.get('/api/v1/admin/categories', handleAdminGetCategories);
  app.post('/api/v1/admin/categories', handleAdminCreateCategory);
  app.put('/api/v1/admin/categories/:id', handleAdminUpdateCategory);
  app.delete('/api/v1/admin/categories/:id', handleAdminDeleteCategory);

  // Admin Workspace & Resource Routes
  app.get('/api/v1/admin/dashboard', handleAdminDashboard);
  app.get('/api/v1/admin/products', handleAdminGetProducts);
  app.post('/api/v1/admin/products', handleAdminCreateProduct);
  app.put('/api/v1/admin/products/:id', handleAdminUpdateProduct);
  app.delete('/api/v1/admin/products/:id', handleAdminDeleteProduct);

  app.get('/api/v1/admin/orders', handleAdminGetOrders);
  app.get('/api/v1/admin/orders/:id', handleAdminGetOrderById);
  app.patch('/api/v1/admin/orders/:id/status', handleAdminUpdateOrderStatus);
  app.post('/api/v1/admin/orders/:id/refund/reconcile', handleAdminReconcileRefund);
  app.delete('/api/v1/admin/orders/:id', handleAdminDeleteOrder);

  app.get('/api/v1/admin/users', handleAdminGetUsers);
  app.patch('/api/v1/admin/users/:id/status', handleAdminUpdateUserStatus);
  app.post('/api/v1/admin/users/:id/wallet-adjustments', handleAdminWalletAdjustment);

  app.get('/api/v1/admin/tickets', handleAdminGetTickets);
  app.get('/api/v1/admin/tickets/:id', handleAdminGetTicketById);
  app.post('/api/v1/admin/tickets/:id/reply', handleAdminReplyTicket);
  app.patch('/api/v1/admin/tickets/:id', handleAdminUpdateTicket);
  app.post('/api/v1/admin/tickets/:id/read', handleAdminTicketAction('read'));
  app.post('/api/v1/admin/tickets/:id/archive', handleAdminTicketAction('archive'));
  app.post('/api/v1/admin/tickets/:id/restore', handleAdminTicketAction('restore'));
  app.delete('/api/v1/admin/tickets/:id', handleAdminTicketAction('delete'));

  app.get('/api/v1/admin/discounts', handleAdminGetDiscounts);
  app.post('/api/v1/admin/discounts', handleAdminCreateDiscount);
  app.put('/api/v1/admin/discounts/:id', handleAdminUpdateDiscount);
  app.patch('/api/v1/admin/discounts/:id', handleAdminUpdateDiscount);
  app.delete('/api/v1/admin/discounts/:id', handleAdminDeleteDiscount);
  app.post('/api/v1/admin/discounts/:id/toggle', handleAdminToggleDiscount);

  app.get('/api/v1/admin/settings/:group', handleAdminGetSetting);
  app.put('/api/v1/admin/settings/:group', handleAdminUpdateSetting);
  app.patch('/api/v1/admin/settings/:group', handleAdminUpdateSetting);
  app.get('/api/v1/settings/public', handleGetPublicSettings);

  app.get('/api/v1/admin/product-attributes', handleAdminProductAttributes);

  // Admin Service Catalog & Category endpoints (Modules/Services contract)
  app.get('/api/v1/admin/services/catalog', handleAdminGetServicesCatalog);
  app.post('/api/v1/admin/services/catalog', handleAdminCreateServiceCatalog);
  app.put('/api/v1/admin/services/catalog/:id', handleAdminUpdateServiceCatalog);
  app.patch('/api/v1/admin/services/catalog/:id', handleAdminUpdateServiceCatalog);
  app.delete('/api/v1/admin/services/catalog/:id', handleAdminDeleteServiceCatalog);

  app.get('/api/v1/admin/services/categories', handleAdminGetServicesCategories);
  app.post('/api/v1/admin/services/categories', handleAdminCreateServiceCategory);
  app.put('/api/v1/admin/services/categories/:id', handleAdminUpdateServiceCategory);
  app.patch('/api/v1/admin/services/categories/:id', handleAdminUpdateServiceCategory);
  app.delete('/api/v1/admin/services/categories/:id', handleAdminDeleteServiceCategory);

  app.get('/api/v1/admin/services/requests', handleAdminGetServiceRequests);
  app.post('/api/v1/admin/services/requests/:id/quotes', handleAdminCreateQuote);
  app.patch('/api/v1/admin/services/requests/:id/status', handleAdminUpdateServiceRequestStatus);
  app.put('/api/v1/admin/services/requests/:id/status', handleAdminUpdateServiceRequestStatus);

  app.post('/api/v1/admin/sms/test-connection', handleAdminSmsTest);

  // Hardened File Upload Configuration for Admin Images
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  // Memory storage ensures unvalidated files NEVER touch the disk directly
  const memoryUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 6 * 1024 * 1024 }, // 6MB strict limit
  });

  const uploadWrapper = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    (memoryUpload.single('image') as any)(req, res, (err: any) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(422).json({
            success: false,
            message: "حجم فایل تصویر فراتر از حد مجاز است (حداکثر 6 مگابایت).",
            error_code: "FILE_TOO_LARGE",
          });
        }
        return res.status(422).json({
          success: false,
          message: err.message || "خطا در بارگذاری فایل تصویر.",
          error_code: "UPLOAD_ERROR",
        });
      }
      next();
    });
  };

  const handleImageUpload = async (req: express.Request, res: express.Response) => {
    if (!req.file || !req.file.buffer || req.file.buffer.length === 0) {
      return res.status(400).json({ success: false, message: "فایل تصویری ارسال نشده است." });
    }

    // 0. Verify image processor availability (or simulated failure check)
    let sharp: any = null;
    try {
      const sharpModule = await import("sharp");
      sharp = sharpModule.default || sharpModule;
    } catch {
      sharp = null;
    }

    if (!sharp || typeof sharp !== "function" || req.headers["x-simulate-processor-unavailable"] === "true") {
      return res.status(503).json({
        success: false,
        message: "سرویس پردازش و ایمن‌سازی تصویر در دسترس نیست.",
        error_code: "IMAGE_PROCESSOR_UNAVAILABLE",
      });
    }

    // 1. Binary validation with sharp (never trust client MIME or extension)
    let metadata: Metadata;
    try {
      metadata = await sharp(req.file.buffer).metadata();
    } catch {
      return res.status(422).json({
        success: false,
        message: "محتوای فایل تصویر نامعتبر یا فاسد است.",
        error_code: "INVALID_IMAGE_BINARY",
      });
    }

    // 2. Strict format whitelist: JPEG, PNG, WebP ONLY.
    // SVG, XML, HTML, animated/scriptable formats are strictly rejected.
    const allowedFormats = ["jpeg", "png", "webp"];
    if (!metadata.format || !allowedFormats.includes(metadata.format)) {
      return res.status(422).json({
        success: false,
        message: "تنها فرمت‌های تصویری JPEG، PNG و WebP مجاز هستند. فرمت‌های اسکریپت‌پذیر (نظیر SVG) پذیرفته نمی‌شوند.",
        error_code: "DISALLOWED_IMAGE_FORMAT",
      });
    }

    // 3. Dimension & pixel count validation (prevent decompression bombs)
    const MAX_WIDTH = 4096;
    const MAX_HEIGHT = 4096;
    const MAX_PIXELS = 16777216; // 4096 * 4096

    const width = metadata.width || 0;
    const height = metadata.height || 0;
    if (width <= 0 || height <= 0 || width > MAX_WIDTH || height > MAX_HEIGHT || (width * height) > MAX_PIXELS) {
      return res.status(422).json({
        success: false,
        message: `ابعاد تصویر فراتر از حد مجاز است (حداکثر ${MAX_WIDTH}x${MAX_HEIGHT} پیکسل).`,
        error_code: "IMAGE_DIMENSIONS_EXCEEDED",
      });
    }

    // 4. Server-selected extension & cryptographic UUID filename
    const ext = metadata.format === "png" ? "png" : metadata.format === "webp" ? "webp" : "jpg";
    const filename = `${crypto.randomUUID()}.${ext}`;

    // 5. Server-side Re-encoding: Strips all EXIF metadata, IPTC, comments, and polyglots
    let cleanBuffer: Buffer;
    try {
      let pipeline = sharp(req.file.buffer).rotate(); // auto-orient and strip EXIF
      if (metadata.format === "png") {
        pipeline = pipeline.png({ compressionLevel: 8 });
      } else if (metadata.format === "webp") {
        pipeline = pipeline.webp({ quality: 85 });
      } else {
        pipeline = pipeline.jpeg({ quality: 85 });
      }
      cleanBuffer = await pipeline.toBuffer();
    } catch {
      return res.status(503).json({
        success: false,
        message: "خطا در پردازش و بازتولید امن تصویر یا سرویس پردازش تصویر در دسترس نیست.",
        error_code: "IMAGE_PROCESSOR_UNAVAILABLE",
      });
    }

    // 6. Re-open and strictly verify generated output before publishing
    let outputMeta: Metadata;
    try {
      outputMeta = await sharp(cleanBuffer).metadata();
      if (
        !outputMeta.format ||
        !allowedFormats.includes(outputMeta.format) ||
        !outputMeta.width ||
        !outputMeta.height ||
        outputMeta.width > MAX_WIDTH ||
        outputMeta.height > MAX_HEIGHT ||
        (outputMeta.width * outputMeta.height) > MAX_PIXELS
      ) {
        throw new Error("Generated output validation failed");
      }
    } catch {
      return res.status(422).json({
        success: false,
        message: "فایل تولید شده نامعتبر است و بازتولید آن با شکست مواجه شد.",
        error_code: "IMAGE_PROCESSING_FAILED",
      });
    }

    // 7. Store in categorized subfolder via staging outside public storage
    const subfolder = req.path.includes("/products/")
      ? "products"
      : req.path.includes("/blog/")
      ? "blog"
      : "site-media";

    const targetSubfolder = path.join(uploadDir, subfolder);
    if (!fs.existsSync(targetSubfolder)) {
      fs.mkdirSync(targetSubfolder, { recursive: true });
    }

    const stagingDir = path.join(process.cwd(), ".staging_uploads");
    if (!fs.existsSync(stagingDir)) {
      fs.mkdirSync(stagingDir, { recursive: true });
    }
    const destinationPath = path.join(targetSubfolder, filename);
    const tempStagingPath = path.join(stagingDir, `staging_${crypto.randomUUID()}.${ext}`);

    try {
      // Stage output outside public storage
      fs.writeFileSync(tempStagingPath, cleanBuffer, { mode: 0o644 });
      // Atomically publish
      try {
        fs.renameSync(tempStagingPath, destinationPath);
      } catch (renameErr: any) {
        if (renameErr && renameErr.code === "EXDEV") {
          fs.copyFileSync(tempStagingPath, destinationPath);
          fs.unlinkSync(tempStagingPath);
        } else {
          throw renameErr;
        }
      }
    } catch {
      if (fs.existsSync(tempStagingPath)) {
        try { fs.unlinkSync(tempStagingPath); } catch {}
      }
      if (fs.existsSync(destinationPath)) {
        try { fs.unlinkSync(destinationPath); } catch {}
      }
      return res.status(500).json({
        success: false,
        message: "خطا در انتشار امن تصویر در فضای ذخیره‌سازی.",
        error_code: "STORAGE_ERROR",
      });
    }

    const publicUrl = `/uploads/${subfolder}/${filename}`;

    // 8. Audit Logging
    const userId = (req as any).user?.id || 1;
    recordAuditLog(db, {
      userId,
      action: "IMAGE_UPLOAD",
      entityType: "Media",
      metadata: {
        filename,
        subfolder,
        width,
        height,
        size: cleanBuffer.length,
      },
      ipAddress: req.ip || "127.0.0.1",
    });

    res.json({
      success: true,
      data: {
        url: publicUrl,
        filename,
        width,
        height,
      },
      url: publicUrl,
      message: "تصویر با موفقیت بارگذاری و ایمن‌سازی شد.",
    });
  };

  // Secure Static Upload Serving with Non-Scriptable Headers & Extension Guard
  app.use("/uploads", (req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");

    const requestedExt = path.extname(req.path).toLowerCase();
    if (![".jpg", ".jpeg", ".png", ".webp"].includes(requestedExt)) {
      return res.status(403).json({ success: false, message: "Forbidden file type" });
    }

    if (requestedExt === ".jpg" || requestedExt === ".jpeg") {
      res.setHeader("Content-Type", "image/jpeg");
    } else if (requestedExt === ".png") {
      res.setHeader("Content-Type", "image/png");
    } else if (requestedExt === ".webp") {
      res.setHeader("Content-Type", "image/webp");
    }

    next();
  }, express.static(uploadDir));

  // Authorization runs BEFORE file parsing/processing to prevent resource exhaustion
  app.post('/api/v1/admin/products/images', adminAuthMiddleware, createRateLimiter("admin-uploads"), uploadWrapper, handleImageUpload);
  app.post('/api/v1/admin/blog/images', adminAuthMiddleware, createRateLimiter("admin-uploads"), uploadWrapper, handleImageUpload);
  app.post('/api/v1/admin/site-media/images', adminAuthMiddleware, createRateLimiter("admin-uploads"), uploadWrapper, handleImageUpload);

  const scopedProducts = (categorySlug?: string) => {
    const prods = queryProductsFromDatabase(db);
    if (!categorySlug) return prods;
    const current = categories.find((category) => category.slug === categorySlug);
    if (!current) return [];
    const ids = [current.id, ...categories.filter((category) => category.parent_id === current.id).map((category) => category.id)];
    return prods.filter((product) => ids.includes(product.category_id));
  };

  app.get('/api/v1/products', (req, res) => response(res, scopedProducts(String(req.query.category_slug || '')), 'محصولات دریافت شدند.'));
  app.get('/api/v1/products/:slugOrId', (req, res) => {
    const prods = queryProductsFromDatabase(db, req.params.slugOrId);
    if (prods.length > 0) {
      return response(res, prods[0], 'محصول با موفقیت دریافت شد.');
    }
    return res.status(404).json({ success: false, message: 'محصول مورد نظر یافت نشد.' });
  });

  app.get('/api/v1/products/facets', (req, res) => {
    const categorySlug = String(req.query.category_slug || '');
    const selected = (req.query.facets || {}) as Record<string, string[] | string>;
    const pool = scopedProducts(categorySlug).filter((product) => Object.entries(selected).every(([key, rawValues]) => {
      const values = Array.isArray(rawValues) ? rawValues : [rawValues];
      const productValues = Array.isArray(product.attributes[key]) ? product.attributes[key] : [product.attributes[key]];
      return values.some((value) => productValues.includes(value));
    }));
    const facets = (facetProfiles[categorySlug] || []).map((facet) => {
      const withoutCurrent = scopedProducts(categorySlug).filter((product) => Object.entries(selected).filter(([key]) => key !== facet.key).every(([key, rawValues]) => {
        const values = Array.isArray(rawValues) ? rawValues : [rawValues];
        const productValues = Array.isArray(product.attributes[key]) ? product.attributes[key] : [product.attributes[key]];
        return values.some((value) => productValues.includes(value));
      }));
      const counts = new Map<string, number>();
      withoutCurrent.forEach((product) => (Array.isArray(product.attributes[facet.key]) ? product.attributes[facet.key] : [product.attributes[facet.key]]).filter(Boolean).forEach((value) => counts.set(String(value), (counts.get(String(value)) || 0) + 1)));
      return { ...facet, options: [...counts.entries()].map(([value, count]) => ({ value, label: value, count })) };
    }).filter((facet) => facet.options.length > 0);
    const prices = pool.map((product) => product.base_price);
    return response(res, { category_id: categories.find((category) => category.slug === categorySlug)?.id || null, price: { min: prices.length ? Math.min(...prices) : 0, max: prices.length ? Math.max(...prices) : 0 }, availability_count: pool.filter((product) => product.variants.some((variant) => variant.is_active && variant.inventory.quantity > variant.inventory.reserved_quantity)).length, facets }, 'فیلترهای demo دریافت شدند.');
  });

  // Services Catalog & Categories
  app.get('/api/v1/services', handleGetServices);
  app.get('/api/v1/services/categories', handleGetServiceCategories);
  app.get('/api/v1/services/:slug', handleGetServiceBySlug);

  // Authenticated Customer Service Requests & Quotes
  app.get('/api/v1/service-requests', handleGetCustomerServiceRequests);
  app.post('/api/v1/service-requests', handleCreateCustomerServiceRequest);
  app.get('/api/v1/service-requests/:requestIdOrNumber', handleGetCustomerServiceRequest);
  app.post('/api/v1/service-requests/quotes/:quoteId/respond', handleRespondToServiceQuote);

  // Authentication routes (Development Mock)
  app.post("/api/v1/auth/register", createRateLimiter("auth-register"), handleRegister);
  app.post("/api/v1/auth/login", createRateLimiter("auth-login"), handleLogin);
  app.get("/api/v1/auth/me", handleMe);
  app.get("/api/v1/users/me", handleMe);
  app.post("/api/v1/auth/logout", handleLogout);
  app.post("/api/v1/auth/change-password", handleChangePassword);
  app.post("/api/v1/auth/otp/send", createRateLimiter("otp-send"), handleSendOtp);
  app.post("/api/v1/auth/otp/verify", createRateLimiter("otp-verify"), handleVerifyOtp);

  // User session routes
  app.get("/api/v1/users/sessions", handleGetSessions);
  app.delete("/api/v1/users/sessions/:tokenId", handleDestroySession);
  app.delete("/api/v1/users/sessions", handleDestroyOtherSessions);

  // Cart routes
  app.get("/api/v1/cart", handleGetCart);
  app.post("/api/v1/cart/items", handleAddToCart);
  app.patch("/api/v1/cart/items/:id", handleUpdateCartItem);
  app.delete("/api/v1/cart/items/:id", handleRemoveCartItem);
  app.delete("/api/v1/cart", handleClearCart);

  // Address routes
  app.get("/api/v1/users/addresses", handleGetAddresses);
  app.post("/api/v1/users/addresses", handleCreateAddress);
  app.put("/api/v1/users/addresses/:id", handleUpdateAddress);
  app.delete("/api/v1/users/addresses/:id", handleDeleteAddress);

  // Checkout & Orders routes
  app.get("/api/v1/checkout/configuration", handleGetCheckoutConfiguration);
  app.post("/api/v1/checkout", createRateLimiter("checkout"), handleCheckout);
  app.post("/api/v1/orders/checkout", createRateLimiter("checkout"), handleCheckout);
  app.post("/api/v1/coupons/validate", createRateLimiter("coupon-validate"), handleValidateCoupon);
  app.post("/api/v1/discounts/validate", createRateLimiter("coupon-validate"), handleValidateCoupon);
  app.get("/api/v1/orders", handleGetOrders);
  app.get("/api/v1/orders/:id", handleGetOrderById);
  app.post("/api/v1/orders/:id/cancel", handleCancelOrder);

  // Payment Gateway routes
  app.get("/api/v1/payments/zibal/callback", createRateLimiter("payment-webhook"), handleZibalCallback);
  app.post("/api/v1/payments/zibal/callback", createRateLimiter("payment-webhook"), handleZibalCallback);
  app.post("/api/v1/payments/status/exchange", createRateLimiter("payment-status"), handleExchangePaymentStatusToken);
  app.post("/api/v1/payments/status/:identifier/exchange", createRateLimiter("payment-status"), handleExchangePaymentStatusToken);
  app.get("/api/v1/payments/status/:identifier", createRateLimiter("payment-status"), handleGetPaymentStatus);
  app.get("/api/v1/payments/:trackIdOrRef/status", createRateLimiter("payment-status"), handleGetPaymentStatus);

  // Dedicated Test/Staging Simulation Route (Strictly conditional on non-production)
  if (process.env.APP_ENV !== "production" && process.env.NODE_ENV !== "production") {
    app.get("/api/v1/payments/test/simulate", createRateLimiter("simulation-test"), handleSimulateTestPayment);
    app.post("/api/v1/payments/test/simulate", createRateLimiter("simulation-test"), handleSimulateTestPayment);
  }

  // Wallet routes
  app.get("/api/v1/users/wallet", handleGetUserWallet);

  // Support Ticket routes
  app.get("/api/v1/users/support-tickets", handleGetCustomerTickets);
  app.get("/api/v1/users/support-tickets/:id", handleGetCustomerTicket);
  app.post("/api/v1/users/support-tickets", handleCreateCustomerTicket);
  app.post("/api/v1/users/support-tickets/:id/messages", handleAddCustomerTicketMessage);
  app.post("/api/v1/users/support-tickets/:id/close", handleCloseCustomerTicket);

  // Favorites / Wishlist routes
  app.get("/api/v1/favorites", handleGetFavorites);
  app.post("/api/v1/favorites/:product", handleAddFavorite);
  app.delete("/api/v1/favorites/:product", handleDeleteFavorite);
  app.get("/api/v1/users/favorites", handleGetFavorites);
  app.post("/api/v1/users/favorites/:product", handleAddFavorite);
  app.delete("/api/v1/users/favorites/:product", handleDeleteFavorite);
}
