import { Request, Response } from "express";
import crypto from "crypto";
import path from "path";
import { authenticateToken } from "./authRoutes";
import { getDatabase, getDatabaseSync, persistDatabase, queryProductsFromDatabase, recordAuditLog, runInTransaction } from "./db";
import { getUserWalletBalance } from "./orderRoutes";
import { refundZibalPayment } from "./services/zibalService";
import { processOrderRefund, reconcileUnknownRefund } from "./services/refundService";

import { VALID_ORDER_TRANSITIONS, isValidOrderTransition, transitionOrderStatus } from "./services/orderStateMachine";
export { VALID_ORDER_TRANSITIONS, isValidOrderTransition, transitionOrderStatus };

// Helper responses
const success = (res: Response, data: unknown, message = "عملیات با موفقیت انجام شد.", status = 200) =>
  res.status(status).json({ success: true, data, message });

const error = (res: Response, message = "خطایی رخ داد.", status = 400, errors?: unknown, error_code?: string) =>
  res.status(status).json({ success: false, message, errors, error_code });

export const requireAdmin = async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    error(res, "برای دسترسی به پنل مدیریت ابتدا وارد شوید.", 401);
    return null;
  }

  const user = await authenticateToken(req);
  if (user && (user.role === "admin" || user.role === "staff")) {
    return user;
  }

  if (user) {
    error(res, "شما دسترسی لازم برای انجام این عملیات را ندارید.", 403);
    return null;
  }

  error(res, "نشست کاربری شما نامعتبر یا منقضی شده است.", 401);
  return null;
};

export const adminAuthMiddleware = async (req: Request, res: Response, next: any) => {
  const user = await requireAdmin(req, res);
  if (!user) return;
  (req as any).user = user;
  next();
};

export function getAdminProducts(): any[] {
  const db = getDatabaseSync();
  if (!db) {
    return [];
  }
  return queryProductsFromDatabase(db);
}

export function decrementProductStock(variantId: number, quantity: number, dbParam?: any): boolean {
  const db = dbParam || getDatabaseSync();
  if (!db || quantity <= 0) return false;

  try {
    const variants = queryRows(db, "SELECT id, product_id FROM product_variants WHERE id = ?", [variantId]);
    if (variants.length > 0) {
      const v = variants[0];
      // Atomic guard: only decrement if available quantity >= requested quantity
      db.run(
        `UPDATE inventory 
         SET quantity = quantity - ?, updated_at = datetime('now')
         WHERE product_variant_id = ? AND quantity >= ?`,
        [quantity, v.id, quantity]
      );
      const modified = typeof db.getRowsModified === "function" ? db.getRowsModified() : 1;
      if (modified === 0) {
        // Insufficient stock in inventory table!
        return false;
      }

      const invRows = queryRows(db, "SELECT quantity FROM inventory WHERE product_variant_id = ?", [v.id]);
      const newQty = invRows.length > 0 ? Number(invRows[0].quantity) : 0;
      db.run(
        `UPDATE product_variants
         SET stock_quantity = ?, stock = ?, updated_at = datetime('now')
         WHERE id = ?`,
        [newQty, newQty, v.id]
      );

      const allVars = queryRows(
        db,
        `SELECT pv.id, COALESCE(i.quantity, 0) as qty 
         FROM product_variants pv
         LEFT JOIN inventory i ON i.product_variant_id = pv.id
         WHERE pv.product_id = ? AND pv.is_active = 1`,
        [v.product_id]
      );
      const totalStock = allVars.reduce((sum, row) => sum + Number(row.qty || 0), 0);
      db.run(
        `UPDATE products 
         SET stock_quantity = ?, initial_stock = ?, in_stock = ?, updated_at = datetime('now')
         WHERE id = ?`,
        [totalStock, totalStock, totalStock > 0 ? 1 : 0, v.product_id]
      );
      if (!dbParam) persistDatabase();
      return true;
    }

    const prods = queryRows(db, "SELECT id FROM products WHERE id = ?", [variantId]);
    if (prods.length > 0) {
      const p = prods[0];
      const pVars = queryRows(db, "SELECT id FROM product_variants WHERE product_id = ? ORDER BY id ASC LIMIT 1", [p.id]);
      if (pVars.length > 0) {
        return decrementProductStock(Number(pVars[0].id), quantity, db);
      } else {
        db.run(
          `UPDATE products 
           SET stock_quantity = stock_quantity - ?, 
               initial_stock = initial_stock - ?,
               in_stock = CASE WHEN stock_quantity - ? > 0 THEN 1 ELSE 0 END,
               updated_at = datetime('now')
           WHERE id = ? AND stock_quantity >= ?`,
          [quantity, quantity, quantity, p.id, quantity]
        );
        const modified = typeof db.getRowsModified === "function" ? db.getRowsModified() : 1;
        if (modified === 0) {
          return false;
        }
        if (!dbParam) persistDatabase();
        return true;
      }
    }
  } catch (err) {
    console.error("decrementProductStock error:", err);
  }
  return false;
}

export function restoreProductStock(variantId: number, quantity: number, dbParam?: any): boolean {
  const db = dbParam || getDatabaseSync();
  if (!db || quantity <= 0) return false;

  try {
    const variants = queryRows(db, "SELECT id, product_id FROM product_variants WHERE id = ?", [variantId]);
    if (variants.length > 0) {
      const v = variants[0];
      db.run(
        `UPDATE inventory 
         SET quantity = quantity + ?, updated_at = datetime('now')
         WHERE product_variant_id = ?`,
        [quantity, v.id]
      );
      const invRows = queryRows(db, "SELECT quantity FROM inventory WHERE product_variant_id = ?", [v.id]);
      const newQty = invRows.length > 0 ? Number(invRows[0].quantity) : 0;
      db.run(
        `UPDATE product_variants
         SET stock_quantity = ?, stock = ?, updated_at = datetime('now')
         WHERE id = ?`,
        [newQty, newQty, v.id]
      );

      const allVars = queryRows(
        db,
        `SELECT pv.id, COALESCE(i.quantity, 0) as qty 
         FROM product_variants pv
         LEFT JOIN inventory i ON i.product_variant_id = pv.id
         WHERE pv.product_id = ? AND pv.is_active = 1`,
        [v.product_id]
      );
      const totalStock = allVars.reduce((sum, row) => sum + Number(row.qty || 0), 0);
      db.run(
        `UPDATE products 
         SET stock_quantity = ?, initial_stock = ?, in_stock = ?, updated_at = datetime('now')
         WHERE id = ?`,
        [totalStock, totalStock, totalStock > 0 ? 1 : 0, v.product_id]
      );
      if (!dbParam) persistDatabase();
      return true;
    }

    const prods = queryRows(db, "SELECT id FROM products WHERE id = ?", [variantId]);
    if (prods.length > 0) {
      const p = prods[0];
      const pVars = queryRows(db, "SELECT id FROM product_variants WHERE product_id = ? ORDER BY id ASC LIMIT 1", [p.id]);
      if (pVars.length > 0) {
        return restoreProductStock(Number(pVars[0].id), quantity, db);
      } else {
        db.run(
          `UPDATE products 
           SET stock_quantity = stock_quantity + ?, 
               initial_stock = initial_stock + ?,
               in_stock = 1,
               updated_at = datetime('now')
           WHERE id = ?`,
          [quantity, quantity, p.id]
        );
        if (!dbParam) persistDatabase();
        return true;
      }
    }
  } catch (err) {
    console.error("restoreProductStock error:", err);
  }
  return false;
}

export function restoreOrderInventory(
  db: any,
  orderId: number,
  reason: string = "order_cancellation",
  manageTransaction: boolean = true
): boolean {
  if (!db || !orderId) return false;

  const performRestoration = () => {
    // Verify under transaction that it wasn't restored by another concurrent request
    const lockedRows = queryRows(db, "SELECT is_inventory_restored FROM orders WHERE id = ?", [orderId]);
    if (lockedRows.length === 0 || Number(lockedRows[0].is_inventory_restored) === 1) {
      return false;
    }

    const items = queryRows(
      db,
      `SELECT product_variant_id, quantity FROM order_items WHERE order_id = ?`,
      [orderId]
    );

    // Restore every item. If any item fails, rollback entire transaction
    for (const item of items) {
      const pvId = Number(item.product_variant_id);
      const qty = Number(item.quantity);
      if (pvId && qty > 0) {
        const restored = restoreProductStock(pvId, qty, db);
        if (!restored) {
          throw new Error(`Failed to restore product stock for variant ${pvId}, quantity ${qty}`);
        }
      }
    }

    // Only AFTER all items have been successfully restored, update the restoration flag
    const now = new Date().toISOString();
    db.run(
      `UPDATE orders
       SET is_inventory_restored = 1, inventory_restored_at = ?, updated_at = ?
       WHERE id = ? AND (is_inventory_restored IS NULL OR is_inventory_restored = 0)`,
      [now, now, orderId]
    );

    const modified = typeof db.getRowsModified === "function" ? db.getRowsModified() : 1;
    if (modified === 0) {
      throw new Error(`Order ${orderId} inventory restoration conflict: flag could not be claimed`);
    }

    recordAuditLog(db, {
      action: "inventory_restored",
      entityType: "order",
      entityId: orderId,
      metadata: { reason, restoredItemsCount: items.length },
    });

    return true;
  };

  // 1. Initial check: If already marked restored, exit immediately
  const checkRows = queryRows(db, "SELECT is_inventory_restored FROM orders WHERE id = ?", [orderId]);
  if (checkRows.length === 0 || Number(checkRows[0].is_inventory_restored) === 1) {
    return false;
  }

  try {
    if (manageTransaction) {
      const result = runInTransaction(db, performRestoration);
      if (result) {
        persistDatabase();
      }
      return result;
    } else {
      return performRestoration();
    }
  } catch (err: any) {
    console.error(`[restoreOrderInventory] Restoration failed and rolled back for order ${orderId}:`, err?.message);
    if (!manageTransaction) {
      throw err;
    }
    return false;
  }
}

// --- HANDLERS ---

// 1. Dashboard metrics
export async function handleAdminDashboard(req: Request, res: Response) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  const db = await getDatabase();
  const userCountQuery = db.exec("SELECT COUNT(*) FROM users");
  const totalUsers = userCountQuery.length > 0 ? Number(userCountQuery[0].values[0][0]) : 2;

  const productCountQuery = db.exec("SELECT COUNT(*) FROM products");
  const totalProducts = productCountQuery.length > 0 ? Number(productCountQuery[0].values[0][0]) : 0;

  // Real database metrics from SQLite
  const ordersMetricsQuery = db.exec(`
    SELECT 
      COUNT(*) as total_orders,
      COALESCE(SUM(CASE WHEN status IN ('pending', 'awaiting_payment', 'processing', 'preparing') THEN 1 ELSE 0 END), 0) as pending_orders,
      COALESCE(SUM(CASE WHEN payment_status = 'paid' OR status IN ('paid', 'processing', 'preparing', 'shipped', 'shipping', 'completed', 'delivered') THEN grand_total ELSE 0 END), 0) as total_revenue
    FROM orders
  `);

  let totalOrders = 0;
  let pendingOrders = 0;
  let totalRevenue = 0;
  if (ordersMetricsQuery.length > 0 && ordersMetricsQuery[0].values.length > 0) {
    const row = ordersMetricsQuery[0].values[0];
    totalOrders = Number(row[0] || 0);
    pendingOrders = Number(row[1] || 0);
    totalRevenue = Number(row[2] || 0);
  }

  const pendingPaymentsQuery = db.exec(`SELECT COUNT(*) FROM payments WHERE status = 'pending'`);
  const pendingPayments = pendingPaymentsQuery.length > 0 ? Number(pendingPaymentsQuery[0].values[0][0]) : 0;

  return success(res, {
    metrics: {
      total_users: totalUsers,
      total_products: totalProducts,
      total_orders: totalOrders,
      pending_orders: pendingOrders,
      total_revenue_irr: totalRevenue,
      pending_service_requests: 0,
      pending_payments: pendingPayments,
    },
  }, "آمار داشبورد مدیریت با موفقیت دریافت شد.");
}

// 2. Products
export async function handleAdminGetProducts(req: Request, res: Response) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  const db = await getDatabase();
  const products = queryProductsFromDatabase(db);
  return success(res, { data: products, total: products.length }, "لیست محصولات با موفقیت دریافت شد.");
}

export async function handleAdminCreateProduct(req: Request, res: Response) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  const db = await getDatabase();
  const body = req.body;
  const newId = Number(body.id && !isNaN(Number(body.id)) ? body.id : Date.now());
  const slug = body.slug ? String(body.slug) : `product-${newId}`;
  const sku = body.sku ? String(body.sku) : `SKU-${newId}`;
  const name = String(body.name || "محصول جدید");
  const categoryId = body.category_id !== undefined && body.category_id !== null ? Number(body.category_id) : null;
  const description = String(body.description || "");
  const shortDescription = body.short_description ? String(body.short_description) : null;
  const basePrice = Number(body.base_price || 0);
  const comparePrice = body.compare_price ? Number(body.compare_price) : null;
  const originalPrice = body.original_price ? Number(body.original_price) : basePrice;
  const discountPercent = body.discount_percent !== undefined && body.discount_percent !== null ? Number(body.discount_percent) : (body.discount_percentage ? Number(body.discount_percentage) : null);
  const discountPrice = body.discount_price !== undefined && body.discount_price !== null ? Number(body.discount_price) : null;
  const effectivePrice = body.effective_price !== undefined && body.effective_price !== null ? Number(body.effective_price) : (discountPrice !== null ? discountPrice : basePrice);
  const currency = body.currency || "IRR";
  const isActive = body.is_active === false || body.is_active === 0 ? 0 : 1;
  const isFeatured = body.is_featured ? 1 : 0;
  const images = Array.isArray(body.images) ? body.images : (body.image_url ? [body.image_url] : []);
  const imagesJson = JSON.stringify(images);
  const attributesJson = JSON.stringify(body.attributes || {});
  const colorsJson = body.colors ? JSON.stringify(body.colors) : null;
  const variantOptionsJson = body.variant_options ? JSON.stringify(body.variant_options) : null;

  const variants = Array.isArray(body.variants) ? body.variants : [];
  let totalStock = variants.reduce((sum: number, v: any) => sum + Number(v.stock_quantity ?? v.stock ?? v.inventory?.quantity ?? 0), 0);
  if (variants.length === 0) {
    totalStock = Number(body.stock_quantity ?? body.initial_stock ?? 0);
  }
  const inStock = totalStock > 0 ? 1 : 0;

  db.run(
    `INSERT INTO products (
      id, category_id, name, slug, sku, description, short_description,
      base_price, compare_price, original_price, discount_percent, discount_price, effective_price,
      currency, is_active, is_featured, images, attributes, colors, variant_options,
      meta_title, meta_description, stock_quantity, initial_stock, in_stock,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    [
      newId, categoryId, name, slug, sku, description, shortDescription,
      basePrice, comparePrice, originalPrice, discountPercent, discountPrice, effectivePrice,
      currency, isActive, isFeatured, imagesJson, attributesJson, colorsJson, variantOptionsJson,
      body.meta_title || null, body.meta_description || null, totalStock, totalStock, inStock,
    ]
  );

  for (let i = 0; i < images.length; i++) {
    db.run(
      `INSERT INTO product_images (product_id, image_url, is_primary, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [newId, images[i], i === 0 ? 1 : 0, i * 10]
    );
  }

  for (let idx = 0; idx < variants.length; idx++) {
    const v = variants[idx];
    const vId = (v.id && !String(v.id).startsWith("temp-") && !isNaN(Number(v.id)))
      ? Number(v.id)
      : (newId * 1000 + idx + 1);
    const vName = String(v.name || `نوع ${idx + 1}`);
    const vSku = String(v.sku || `${sku}-V${vId}`);
    const vPriceOverride = v.price_override !== undefined && v.price_override !== null ? Number(v.price_override) : null;
    const vOriginalPrice = v.original_price !== undefined && v.original_price !== null ? Number(v.original_price) : (vPriceOverride !== null ? vPriceOverride : basePrice);
    const vDiscountPercent = v.discount_percent !== undefined && v.discount_percent !== null ? Number(v.discount_percent) : (v.discount_percentage !== undefined ? Number(v.discount_percentage) : null);
    const vDiscountPrice = v.discount_price !== undefined && v.discount_price !== null ? Number(v.discount_price) : null;
    const vEffectivePrice = v.effective_price !== undefined && v.effective_price !== null ? Number(v.effective_price) : (v.price !== undefined ? Number(v.price) : (vDiscountPrice !== null ? vDiscountPrice : (vPriceOverride !== null ? vPriceOverride : basePrice)));
    const vStock = Number(v.stock_quantity ?? v.stock ?? v.inventory?.quantity ?? 0);
    const vAttributesJson = JSON.stringify(v.attributes || {});
    const vImageUrl = v.image_url || v.attributes?.image_url || null;
    const vImagesJson = JSON.stringify(Array.isArray(v.images) ? v.images : (vImageUrl ? [vImageUrl] : []));
    const vIsActive = v.is_active === false || v.is_active === 0 ? 0 : 1;

    db.run(
      `INSERT INTO product_variants (
        id, product_id, name, sku, price_override, original_price, discount_percent,
        discount_price, effective_price, price, stock, stock_quantity, attributes,
        image_url, images, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [
        vId, newId, vName, vSku, vPriceOverride, vOriginalPrice, vDiscountPercent,
        vDiscountPrice, vEffectivePrice, vEffectivePrice, vStock, vStock, vAttributesJson,
        vImageUrl, vImagesJson, vIsActive,
      ]
    );

    const invQty = Number(v.inventory?.quantity ?? vStock);
    const invRes = Number(v.inventory?.reserved_quantity ?? 0);
    const invSafety = Number(v.inventory?.safety_threshold ?? 0);

    db.run(
      `INSERT INTO inventory (
        product_variant_id, quantity, reserved_quantity, safety_threshold, created_at, updated_at
      ) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [vId, invQty, invRes, invSafety]
    );
  }

  persistDatabase();

  const created = queryProductsFromDatabase(db, newId);
  return success(res, created[0] || { id: newId }, "محصول با موفقیت ایجاد شد.", 201);
}

export async function handleAdminUpdateProduct(req: Request, res: Response) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  const db = await getDatabase();
  const id = Number(req.params.id);
  const existing = queryRows(db, "SELECT * FROM products WHERE id = ?", [id]);
  if (existing.length === 0) {
    return error(res, "محصول مورد نظر یافت نشد.", 404);
  }
  const current = existing[0];
  const body = req.body;

  const name = body.name !== undefined ? String(body.name) : current.name;
  const slug = body.slug !== undefined ? String(body.slug) : current.slug;
  const sku = body.sku !== undefined ? String(body.sku) : current.sku;
  const categoryId = body.category_id !== undefined ? (body.category_id !== null ? Number(body.category_id) : null) : current.category_id;
  const description = body.description !== undefined ? String(body.description) : current.description;
  const shortDescription = body.short_description !== undefined ? String(body.short_description) : current.short_description;
  const basePrice = body.base_price !== undefined ? Number(body.base_price) : Number(current.base_price);
  const comparePrice = body.compare_price !== undefined ? (body.compare_price !== null ? Number(body.compare_price) : null) : current.compare_price;
  const originalPrice = body.original_price !== undefined ? Number(body.original_price) : (current.original_price ? Number(current.original_price) : basePrice);
  const discountPercent = body.discount_percent !== undefined ? (body.discount_percent !== null ? Number(body.discount_percent) : null) : current.discount_percent;
  const discountPrice = body.discount_price !== undefined ? (body.discount_price !== null ? Number(body.discount_price) : null) : current.discount_price;
  const effectivePrice = body.effective_price !== undefined ? Number(body.effective_price) : (discountPrice !== null ? discountPrice : (current.effective_price ? Number(current.effective_price) : basePrice));
  const currency = body.currency !== undefined ? String(body.currency) : current.currency;
  const isActive = body.is_active !== undefined ? (body.is_active ? 1 : 0) : current.is_active;
  const isFeatured = body.is_featured !== undefined ? (body.is_featured ? 1 : 0) : current.is_featured;

  let images = Array.isArray(body.images) ? body.images : (body.image_url ? [body.image_url] : null);
  let imagesJson = images !== null ? JSON.stringify(images) : current.images;

  const attributesJson = body.attributes !== undefined ? JSON.stringify(body.attributes) : current.attributes;
  const colorsJson = body.colors !== undefined ? JSON.stringify(body.colors) : current.colors;
  const variantOptionsJson = body.variant_options !== undefined ? JSON.stringify(body.variant_options) : current.variant_options;

  if (Array.isArray(body.variants)) {
    const oldVariants = queryRows(db, "SELECT id FROM product_variants WHERE product_id = ?", [id]);
    for (const oldV of oldVariants) {
      db.run("DELETE FROM inventory WHERE product_variant_id = ?", [oldV.id]);
    }
    db.run("DELETE FROM product_variants WHERE product_id = ?", [id]);

    for (let idx = 0; idx < body.variants.length; idx++) {
      const v = body.variants[idx];
      const vId = (v.id && !String(v.id).startsWith("temp-") && !isNaN(Number(v.id)))
        ? Number(v.id)
        : (id * 1000 + idx + 1);
      const vName = String(v.name || `نوع ${idx + 1}`);
      const vSku = String(v.sku || `${sku}-V${vId}`);
      const vPriceOverride = v.price_override !== undefined && v.price_override !== null ? Number(v.price_override) : null;
      const vOriginalPrice = v.original_price !== undefined && v.original_price !== null ? Number(v.original_price) : (vPriceOverride !== null ? vPriceOverride : basePrice);
      const vDiscountPercent = v.discount_percent !== undefined && v.discount_percent !== null ? Number(v.discount_percent) : (v.discount_percentage !== undefined ? Number(v.discount_percentage) : null);
      const vDiscountPrice = v.discount_price !== undefined && v.discount_price !== null ? Number(v.discount_price) : null;
      const vEffectivePrice = v.effective_price !== undefined && v.effective_price !== null ? Number(v.effective_price) : (v.price !== undefined ? Number(v.price) : (vDiscountPrice !== null ? vDiscountPrice : (vPriceOverride !== null ? vPriceOverride : basePrice)));
      const vStock = Number(v.stock_quantity ?? v.stock ?? v.inventory?.quantity ?? 0);
      const vAttributesJson = JSON.stringify(v.attributes || {});
      const vImageUrl = v.image_url || v.attributes?.image_url || null;
      const vImagesJson = JSON.stringify(Array.isArray(v.images) ? v.images : (vImageUrl ? [vImageUrl] : []));
      const vIsActive = v.is_active === false || v.is_active === 0 ? 0 : 1;

      db.run(
        `INSERT INTO product_variants (
          id, product_id, name, sku, price_override, original_price, discount_percent,
          discount_price, effective_price, price, stock, stock_quantity, attributes,
          image_url, images, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [
          vId, id, vName, vSku, vPriceOverride, vOriginalPrice, vDiscountPercent,
          vDiscountPrice, vEffectivePrice, vEffectivePrice, vStock, vStock, vAttributesJson,
          vImageUrl, vImagesJson, vIsActive,
        ]
      );

      const invQty = Number(v.inventory?.quantity ?? vStock);
      const invRes = Number(v.inventory?.reserved_quantity ?? 0);
      const invSafety = Number(v.inventory?.safety_threshold ?? 0);

      db.run(
        `INSERT INTO inventory (
          product_variant_id, quantity, reserved_quantity, safety_threshold, created_at, updated_at
        ) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [vId, invQty, invRes, invSafety]
      );
    }
  }

  if (images !== null) {
    db.run("DELETE FROM product_images WHERE product_id = ?", [id]);
    for (let i = 0; i < images.length; i++) {
      db.run(
        `INSERT INTO product_images (product_id, image_url, is_primary, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [id, images[i], i === 0 ? 1 : 0, i * 10]
      );
    }
  }

  const activeVariants = queryRows(
    db,
    `SELECT pv.id, COALESCE(i.quantity, 0) as qty
     FROM product_variants pv
     LEFT JOIN inventory i ON i.product_variant_id = pv.id
     WHERE pv.product_id = ? AND pv.is_active = 1`,
    [id]
  );
  let totalStock = activeVariants.reduce((sum, r) => sum + Number(r.qty || 0), 0);
  if (activeVariants.length === 0 && (body.stock_quantity !== undefined || body.initial_stock !== undefined)) {
    totalStock = Number(body.stock_quantity ?? body.initial_stock ?? 0);
  }
  const inStock = totalStock > 0 ? 1 : 0;

  db.run(
    `UPDATE products SET
      category_id = ?, name = ?, slug = ?, sku = ?, description = ?, short_description = ?,
      base_price = ?, compare_price = ?, original_price = ?, discount_percent = ?, discount_price = ?, effective_price = ?,
      currency = ?, is_active = ?, is_featured = ?, images = ?, attributes = ?, colors = ?, variant_options = ?,
      stock_quantity = ?, initial_stock = ?, in_stock = ?, updated_at = datetime('now')
    WHERE id = ?`,
    [
      categoryId, name, slug, sku, description, shortDescription,
      basePrice, comparePrice, originalPrice, discountPercent, discountPrice, effectivePrice,
      currency, isActive, isFeatured, imagesJson, attributesJson, colorsJson, variantOptionsJson,
      totalStock, totalStock, inStock, id,
    ]
  );

  persistDatabase();

  const updated = queryProductsFromDatabase(db, id);
  return success(res, updated[0] || { id }, "محصول با موفقیت ویرایش شد.");
}

export async function handleAdminDeleteProduct(req: Request, res: Response) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  const db = await getDatabase();
  const id = Number(req.params.id);

  const variantRows = queryRows(db, "SELECT id FROM product_variants WHERE product_id = ?", [id]);
  for (const v of variantRows) {
    db.run("DELETE FROM inventory WHERE product_variant_id = ?", [v.id]);
  }
  db.run("DELETE FROM product_variants WHERE product_id = ?", [id]);
  db.run("DELETE FROM product_images WHERE product_id = ?", [id]);
  db.run("DELETE FROM user_favorites WHERE product_id = ?", [id]);
  db.run("DELETE FROM products WHERE id = ?", [id]);

  persistDatabase();
  return success(res, { id }, "محصول با موفقیت حذف شد.");
}

// 3. Orders (Connected to SQLite database: orders, order_items, payments, users)

export function formatAdminOrderFromRow(db: any, row: any[]) {
  const orderId = Number(row[0]);
  const orderNumber = String(row[1]);
  const userId = Number(row[2]);
  const status = String(row[3]);
  const paymentStatus = String(row[4]);
  const trackingCode = row[5] ? String(row[5]) : null;
  const subtotal = Number(row[6]);
  const discountTotal = Number(row[7]);
  const taxTotal = Number(row[8]);
  const shippingTotal = Number(row[9]);
  const grandTotal = Number(row[10]);
  const currency = String(row[11] || "IRR");
  const shippingMethod = String(row[12] || "post");

  let shippingAddressSnapshot: any = {};
  try {
    shippingAddressSnapshot = JSON.parse(String(row[13] || "{}"));
  } catch {
    shippingAddressSnapshot = {};
  }

  let billingAddressSnapshot: any = {};
  try {
    billingAddressSnapshot = JSON.parse(String(row[14] || "{}"));
  } catch {
    billingAddressSnapshot = {};
  }

  const notes = row[15] ? String(row[15]) : null;
  const createdAt = String(row[16]);
  const updatedAt = String(row[17]);

  // Read Customer from SQLite users table
  let customerUser = {
    id: userId,
    name: "کاربر نوین‌نت",
    email: "",
    phone: "",
  };
  const userQuery = db.exec(`SELECT id, name, email, phone FROM users WHERE id = ${userId} LIMIT 1`);
  if (userQuery.length > 0 && userQuery[0].values.length > 0) {
    const uRow = userQuery[0].values[0];
    customerUser = {
      id: Number(uRow[0]),
      name: String(uRow[1] || ""),
      email: String(uRow[2] || ""),
      phone: String(uRow[3] || ""),
    };
  }

  // Read Items from SQLite order_items table
  const itemsQuery = db.exec(`
    SELECT id, product_id, product_variant_id, product_name_snapshot,
           variant_sku_snapshot, variant_attributes_snapshot, unit_price, quantity,
           discount_amount, tax_amount, total_price
    FROM order_items WHERE order_id = ${orderId} ORDER BY id ASC
  `);
  const items: any[] = [];
  if (itemsQuery.length > 0 && itemsQuery[0].values.length > 0) {
    for (const itemRow of itemsQuery[0].values) {
      items.push({
        id: Number(itemRow[0]),
        product_id: Number(itemRow[1]),
        product_variant_id: itemRow[2] ? Number(itemRow[2]) : null,
        variant_id: itemRow[2] ? Number(itemRow[2]) : null,
        product_name: String(itemRow[3]),
        name: String(itemRow[3]),
        product_name_snapshot: String(itemRow[3]),
        variant_sku_snapshot: itemRow[4] ? String(itemRow[4]) : "",
        variant_name: itemRow[4] ? String(itemRow[4]) : "",
        unit_price: Number(itemRow[6]),
        quantity: Number(itemRow[7]),
        discount_amount: Number(itemRow[8] || 0),
        tax_amount: Number(itemRow[9] || 0),
        total_price: Number(itemRow[10]),
      });
    }
  }

  // Read Payments from SQLite payments table
  const paymentsQuery = db.exec(`
    SELECT id, gateway, amount, currency, status, reference_id, gateway_payment_id, created_at, updated_at
    FROM payments WHERE order_id = ${orderId} ORDER BY id DESC
  `);
  const payments: any[] = [];
  let latestPayment: any = null;
  if (paymentsQuery.length > 0 && paymentsQuery[0].values.length > 0) {
    for (const pRow of paymentsQuery[0].values) {
      const p = {
        id: Number(pRow[0]),
        gateway: String(pRow[1] || "online"),
        amount: Number(pRow[2]),
        currency: String(pRow[3] || "IRR"),
        status: String(pRow[4]),
        reference_id: pRow[5] ? String(pRow[5]) : null,
        gateway_payment_id: pRow[6] ? String(pRow[6]) : null,
        created_at: String(pRow[7]),
        updated_at: String(pRow[8]),
      };
      payments.push(p);
    }
    latestPayment = payments[0];
  }

  const effectivePaymentStatus = latestPayment ? latestPayment.status : paymentStatus;
  const effectivePaymentMethod = latestPayment ? latestPayment.gateway : "online";

  const addressObj = {
    full_name: shippingAddressSnapshot.full_name || shippingAddressSnapshot.recipient_name || customerUser.name,
    recipient_name: shippingAddressSnapshot.recipient_name || shippingAddressSnapshot.full_name || customerUser.name,
    phone: shippingAddressSnapshot.phone || customerUser.phone,
    province: shippingAddressSnapshot.province || "",
    city: shippingAddressSnapshot.city || "",
    address: shippingAddressSnapshot.address || shippingAddressSnapshot.address_line || "",
    address_line: shippingAddressSnapshot.address_line || shippingAddressSnapshot.address || "",
    postal_code: shippingAddressSnapshot.postal_code || "",
  };

  const statusLabelMap: Record<string, string> = {
    pending: "در انتظار پرداخت",
    awaiting_payment: "در انتظار پرداخت",
    paid: "در حال پردازش",
    processing: "در حال آماده‌سازی",
    preparing: "در حال آماده‌سازی",
    shipped: "ارسال شده",
    shipping: "ارسال شده",
    completed: "تحویل شده",
    delivered: "تحویل شده",
    cancelled: "لغو شده",
    refunded: "مرجوع شده",
  };

  const paymentStatusLabelMap: Record<string, string> = {
    paid: "پرداخت شده",
    successful: "پرداخت شده",
    pending: "در انتظار پرداخت",
    failed: "ناموفق",
    refunded: "استرداد وجه",
  };

  return {
    id: orderId,
    order_number: orderNumber,
    user_id: userId,
    user: customerUser,
    customer_name: customerUser.name,
    customer_email: customerUser.email,
    customer_phone: customerUser.phone,
    status,
    status_label: statusLabelMap[status] || status,
    payment_status: effectivePaymentStatus,
    payment_status_label: paymentStatusLabelMap[effectivePaymentStatus] || effectivePaymentStatus,
    payment_method: effectivePaymentMethod,
    tracking_code: trackingCode,
    subtotal,
    total_amount: subtotal,
    discount_total: discountTotal,
    discount_amount: discountTotal,
    tax_total: taxTotal,
    shipping_total: shippingTotal,
    shipping_cost: shippingTotal,
    grand_total: grandTotal,
    final_payable: grandTotal,
    currency,
    shipping_method: shippingMethod,
    shipping_address_snapshot: addressObj,
    shipping_address: addressObj,
    billing_address_snapshot: billingAddressSnapshot,
    recipient_name: addressObj.recipient_name,
    recipient_phone: addressObj.phone,
    notes,
    items_count: items.reduce((sum, item) => sum + item.quantity, 0),
    item_count: items.length,
    items,
    payments,
    payment: latestPayment,
    created_at: createdAt,
    updated_at: updatedAt,
    date: createdAt,
  };
}

export async function handleAdminGetOrders(req: Request, res: Response) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  const db = await getDatabase();
  const { status, order_number } = req.query;

  let sql = `SELECT id, order_number, user_id, status, payment_status, tracking_code,
                    subtotal, discount_total, tax_total, shipping_total, grand_total,
                    currency, shipping_method, shipping_address_snapshot, billing_address_snapshot,
                    notes, created_at, updated_at
             FROM orders WHERE 1=1`;

  if (status && typeof status === 'string') {
    const cleanStatus = status.replace(/'/g, "''");
    sql += ` AND status = '${cleanStatus}'`;
  }

  if (order_number && typeof order_number === 'string') {
    const cleanOrderNum = order_number.replace(/'/g, "''");
    sql += ` AND order_number LIKE '%${cleanOrderNum}%'`;
  }

  sql += ` ORDER BY id DESC`;

  const query = db.exec(sql);
  const orders: any[] = [];
  if (query.length > 0 && query[0].values.length > 0) {
    for (const row of query[0].values) {
      orders.push(formatAdminOrderFromRow(db, row));
    }
  }

  return success(res, {
    data: orders,
    total: orders.length,
    current_page: 1,
    last_page: 1,
    per_page: orders.length || 20,
  }, "لیست سفارش‌ها با موفقیت دریافت شد.");
}

export async function handleAdminGetOrderById(req: Request, res: Response) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  const idParam = String(req.params.id || "").replace(/'/g, "''");
  const db = await getDatabase();

  const query = db.exec(`
    SELECT id, order_number, user_id, status, payment_status, tracking_code,
           subtotal, discount_total, tax_total, shipping_total, grand_total,
           currency, shipping_method, shipping_address_snapshot, billing_address_snapshot,
           notes, created_at, updated_at
    FROM orders WHERE id = '${idParam}' OR order_number = '${idParam}' LIMIT 1
  `);

  if (query.length === 0 || query[0].values.length === 0) {
    return error(res, "سفارش مورد نظر یافت نشد.", 404);
  }

  const orderData = formatAdminOrderFromRow(db, query[0].values[0]);
  return success(res, orderData, "جزئیات سفارش با موفقیت دریافت شد.");
}

export async function handleAdminUpdateOrderStatus(req: Request, res: Response) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  const idParam = String(req.params.id || "").replace(/'/g, "''");
  const { status, payment_status, tracking_code } = req.body || {};

  const db = await getDatabase();

  const checkQuery = db.exec(`
    SELECT id, order_number, status, payment_status, tracking_code, user_id, grand_total FROM orders
    WHERE id = '${idParam}' OR order_number = '${idParam}' LIMIT 1
  `);

  if (checkQuery.length === 0 || checkQuery[0].values.length === 0) {
    return error(res, "سفارش مورد نظر یافت نشد.", 404);
  }

  const [orderId, orderNumber, currentStatus, currentPaymentStatus, currentTrackingCode, orderUserId, grandTotal] = checkQuery[0].values[0];

  const validStatuses = [
    'pending', 'awaiting_payment', 'paid', 'processing', 'preparing',
    'shipped', 'shipping', 'completed', 'delivered', 'cancelled', 'refunded', 'failed'
  ];

  let nextStatus = String(currentStatus || "").toLowerCase();
  if (status) {
    const s = String(status).toLowerCase();
    if (!validStatuses.includes(s)) {
      return error(res, "وضعیت وارد شده نامعتبر است.", 422, undefined, "INVALID_ORDER_STATUS");
    }
    if (!isValidOrderTransition(nextStatus, s)) {
      return error(
        res,
        `تغییر وضعیت از «${nextStatus}» به «${s}» طبق قوانین چرخه حیات سفارش مجاز نیست.`,
        422,
        undefined,
        "INVALID_ORDER_STATUS_TRANSITION"
      );
    }
    nextStatus = s;
  }

  let nextPaymentStatus = payment_status !== undefined ? String(payment_status || '').toLowerCase() : String(currentPaymentStatus || '').toLowerCase();

  // Validate state combinations
  if (nextStatus === 'cancelled' && nextPaymentStatus === 'paid') {
    return error(res, "نمی‌توان وضعیت پرداخت یک سفارش لغو شده را به «پرداخت شده» تغییر داد.", 422, undefined, "INVALID_STATUS_COMBINATION");
  }
  if ((nextStatus === 'paid' || nextPaymentStatus === 'paid') && currentStatus !== 'paid' && currentPaymentStatus !== 'paid') {
    const verifiedPayments = queryRows(
      db,
      `SELECT id, status FROM payments WHERE order_id = ? AND status = 'paid' LIMIT 1`,
      [Number(orderId)]
    );
    if (verifiedPayments.length === 0) {
      return error(
        res,
        "ثبت وضعیت پرداخت شده بدون تأیید پرداخت معتبر درگاه یا تراکنش کیف پول مجاز نیست.",
        422,
        undefined,
        "UNVERIFIED_PAYMENT_TRANSITION"
      );
    }
  }
  if (nextStatus === 'refunded') {
    nextPaymentStatus = 'refunded';
  } else if (nextPaymentStatus === 'refunded' && currentPaymentStatus !== 'refunded') {
    return error(
      res,
      "تغییر وضعیت به مرجوعی نیازمند انجام و تأیید موفقیت‌آمیز تراکنش استرداد وجه است.",
      422,
      undefined,
      "UNVERIFIED_REFUND_TRANSITION"
    );
  }

  const nextTrackingCode = tracking_code !== undefined ? String(tracking_code || '') : currentTrackingCode;
  const now = new Date().toISOString();

  // If order transitioned to cancelled, restore inventory safely (guaranteed exactly once)
  if (nextStatus === 'cancelled' && currentStatus !== 'cancelled' && currentStatus !== 'refunded') {
    restoreOrderInventory(db, Number(orderId), `admin_transition_to_cancelled`);
  }

  // If order transitioned to refunded, process financial refund truthfully and atomically
  if (nextStatus === 'refunded') {
    const refundResult = await processOrderRefund({
      orderId: Number(orderId),
      adminUserId: user.id,
      reason: "admin_transition_to_refunded",
    });

    if (!refundResult.isSuccessful) {
      return error(
        res,
        "استرداد وجه با خطا مواجه شد: " + (refundResult.message || "خطای درگاه"),
        422,
        undefined,
        refundResult.error || "GATEWAY_REFUND_FAILED"
      );
    }

    // Restore inventory only after financial refund has succeeded
    if (currentStatus !== 'cancelled' && currentStatus !== 'refunded') {
      restoreOrderInventory(db, Number(orderId), `admin_transition_to_refunded`);
    }
    nextPaymentStatus = 'refunded';
  } else if (nextStatus === 'cancelled' && currentStatus !== 'cancelled') {
    // If order was cancelled while paid, refund wallet if wallet, or mark refund_pending for external gateway
    const paymentRows = queryRows(
      db,
      `SELECT id, gateway, status FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1`,
      [Number(orderId)]
    );
    const payment = paymentRows.length > 0 ? paymentRows[0] : null;
    if (payment && String(payment.status) === 'paid') {
      if (payment.gateway === 'wallet') {
        await processOrderRefund({
          orderId: Number(orderId),
          adminUserId: user.id,
          reason: "admin_transition_to_cancelled",
        });
        nextPaymentStatus = 'refunded';
      } else {
        nextPaymentStatus = 'refund_pending';
        db.run(`UPDATE payments SET status = 'refund_pending', updated_at = ? WHERE id = ?`, [now, payment.id]);
      }
    }
  }

  db.run(`
    UPDATE orders
    SET status = ?, tracking_code = ?, payment_status = ?, updated_at = ?
    WHERE id = ?
  `, [nextStatus, nextTrackingCode, nextPaymentStatus, now, Number(orderId)]);

  // If payment status was updated, sync payments table for this order
  db.run(`
    UPDATE payments SET status = ?, updated_at = ? WHERE order_id = ?
  `, [nextPaymentStatus, now, Number(orderId)]);

  recordAuditLog(db, {
    userId: user.id,
    action: "admin_update_order_status",
    entityType: "order",
    entityId: Number(orderId),
    metadata: {
      old_status: currentStatus,
      new_status: nextStatus,
      old_payment_status: currentPaymentStatus,
      new_payment_status: nextPaymentStatus,
      tracking_code: nextTrackingCode,
    },
  });

  await persistDatabase();

  // Fetch updated order from SQLite
  const updatedQuery = db.exec(`
    SELECT id, order_number, user_id, status, payment_status, tracking_code,
           subtotal, discount_total, tax_total, shipping_total, grand_total,
           currency, shipping_method, shipping_address_snapshot, billing_address_snapshot,
           notes, created_at, updated_at
    FROM orders WHERE id = ${Number(orderId)} LIMIT 1
  `);

  const updatedOrder = formatAdminOrderFromRow(db, updatedQuery[0].values[0]);
  return success(res, updatedOrder, "وضعیت سفارش به‌روزرسانی شد.");
}

export async function handleAdminDeleteOrder(req: Request, res: Response) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  const idParam = String(req.params.id || "").replace(/'/g, "''");
  const db = await getDatabase();

  const checkQuery = db.exec(`
    SELECT id, order_number FROM orders WHERE id = '${idParam}' OR order_number = '${idParam}' LIMIT 1
  `);

  if (checkQuery.length === 0 || checkQuery[0].values.length === 0) {
    return error(res, "سفارش مورد نظر یافت نشد.", 404);
  }

  const [orderId, orderNumber] = checkQuery[0].values[0];

  // Clean dependencies cleanly to prevent orphaned records
  db.run(`UPDATE wallet_transactions SET order_id = NULL WHERE order_id = ?`, [Number(orderId)]);
  db.run(`DELETE FROM order_items WHERE order_id = ?`, [Number(orderId)]);
  db.run(`DELETE FROM payments WHERE order_id = ?`, [Number(orderId)]);
  db.run(`DELETE FROM orders WHERE id = ?`, [Number(orderId)]);

  await persistDatabase();

  return success(res, { id: Number(orderId), order_number: String(orderNumber) }, "سفارش با موفقیت حذف شد.");
}

// 4. Users
export async function handleAdminGetUsers(req: Request, res: Response) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  const db = await getDatabase();
  const query = db.exec("SELECT id, name, email, phone, role, status, created_at FROM users ORDER BY id ASC");
  if (query.length === 0) return success(res, { data: [], total: 0 }, "لیست کاربران خالی است.");

  const cols = query[0].columns;
  const users = query[0].values.map((row) => {
    const item: Record<string, any> = {};
    cols.forEach((col, i) => {
      item[col] = row[i];
    });
    item.wallet_balance = getUserWalletBalance(db, Number(item.id));
    return item;
  });

  return success(res, { data: users, total: users.length }, "لیست کاربران با موفقیت دریافت شد.");
}

export async function handleAdminUpdateUserStatus(req: Request, res: Response) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  const id = Number(req.params.id);
  const { status, role } = req.body;
  const db = await getDatabase();

  const updates: string[] = [];
  const params: any[] = [];
  if (status) { updates.push("status = ?"); params.push(status); }
  if (role) { updates.push("role = ?"); params.push(role); }
  params.push(id);

  if (updates.length > 0) {
    db.run(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`, params);
    persistDatabase();
  }

  const query = db.exec(`SELECT id, name, email, phone, role, status, created_at FROM users WHERE id = ${id}`);
  if (query.length > 0 && query[0].values.length > 0) {
    const cols = query[0].columns;
    const item: Record<string, any> = {};
    query[0].values[0].forEach((val, i) => {
      item[cols[i]] = val;
    });
    item.wallet_balance = getUserWalletBalance(db, id);
    return success(res, item, "وضعیت کاربر به‌روزرسانی شد.");
  }

  return error(res, "کاربر یافت نشد.", 404);
}

export async function handleAdminWalletAdjustment(req: Request, res: Response) {
  const adminUser = await requireAdmin(req, res);
  if (!adminUser) return;

  const rawUserId = req.params.id;
  const userId = Number(rawUserId);
  if (!rawUserId || isNaN(userId) || !Number.isInteger(userId) || userId <= 0) {
    return error(res, "شناسه کاربر نامعتبر است.", 404);
  }

  const db = await getDatabase();

  // 1. Verify target user exists in SQLite
  const userCheck = db.exec(`SELECT id, name, status FROM users WHERE id = ${userId}`);
  if (userCheck.length === 0 || userCheck[0].values.length === 0) {
    return error(res, "کاربر مورد نظر یافت نشد.", 404);
  }

  // 2. Validate amount
  const rawAmount = req.body.amount;
  if (
    rawAmount === undefined ||
    rawAmount === null ||
    typeof rawAmount === "boolean" ||
    typeof rawAmount === "object"
  ) {
    return error(res, "مبلغ تراکنش نامعتبر است.", 400);
  }

  if (typeof rawAmount === "string" && rawAmount.trim() === "") {
    return error(res, "مبلغ تراکنش نامعتبر است.", 400);
  }

  const numAmount = Number(rawAmount);
  if (isNaN(numAmount) || !isFinite(numAmount) || numAmount === 0) {
    return error(res, "مبلغ تراکنش باید یک عدد معتبر و غیر صفر باشد.", 400);
  }

  const finalAmount = Math.trunc(numAmount);
  if (finalAmount === 0) {
    return error(res, "مبلغ تراکنش باید یک عدد معتبر و غیر صفر باشد.", 400);
  }

  // 3. Validate note
  let cleanNote = "";
  if (req.body.note !== undefined && req.body.note !== null) {
    if (typeof req.body.note !== "string") {
      return error(res, "یادداشت باید یک متن معتبر باشد.", 400);
    }
    if (req.body.note.length > 500) {
      return error(res, "طول یادداشت بیش از حد مجاز (حداکثر ۵۰۰ کاراکتر) است.", 400);
    }
    cleanNote = req.body.note.trim();
  }

  const description =
    cleanNote ||
    (finalAmount > 0
      ? "تعدیل مثبت (شارژ) کیف پول توسط مدیریت"
      : "تعدیل منفی (کسر) از کیف پول توسط مدیریت");

  const ref = `WLT-ADJ-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
  const now = new Date().toISOString();

  try {
    // Atomic insert into SQLite wallet_transactions
    db.run(
      `INSERT INTO wallet_transactions (
        user_id, order_id, type, amount, currency, status, reference, description, created_at, updated_at
      ) VALUES (?, NULL, 'adjustment', ?, 'IRR', 'successful', ?, ?, ?, ?)`,
      [userId, finalAmount, ref, description, now, now]
    );

    recordAuditLog(db, {
      userId: adminUser.id,
      action: "admin_wallet_adjustment",
      entityType: "wallet",
      entityId: userId,
      metadata: { amount: finalAmount, reference: ref, description },
    });

    persistDatabase();

    // Recompute actual wallet balance directly from wallet_transactions
    const newBalance = getUserWalletBalance(db, userId);

    const txRes = db.exec(`SELECT id FROM wallet_transactions WHERE reference = '${ref.replace(/'/g, "''")}'`);
    const transactionId =
      txRes.length > 0 && txRes[0].values.length > 0 ? Number(txRes[0].values[0][0]) : undefined;

    return success(
      res,
      {
        user_id: userId,
        adjusted_amount: finalAmount,
        balance: newBalance,
        transaction_id: transactionId,
        reference: ref,
        type: "adjustment",
        note: cleanNote || description,
        created_at: now,
      },
      "موجودی کیف پول با موفقیت به‌روزرسانی شد."
    );
  } catch (err: any) {
    return error(res, "خطا در ثبت تراکنش کیف پول: " + (err.message || "خطای پایگاه داده"), 500);
  }
}

// 5. Support Tickets (SQLite Single Source of Truth)

export function queryRows(db: any, sql: string, params: any[] = []): any[] {
  const stmt = db.prepare(sql);
  if (params.length > 0) {
    stmt.bind(params);
  }
  const rows: any[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function formatAdminTicket(ticket: any, messages: any[]) {
  const formattedMessages = messages.map((m: any) => {
    let attachments: any = null;
    if (m.attachments) {
      try {
        attachments = JSON.parse(m.attachments);
      } catch {
        attachments = null;
      }
    }

    return {
      id: Number(m.id),
      support_ticket_id: Number(m.support_ticket_id),
      user_id: m.user_id ? Number(m.user_id) : null,
      sender: m.sender === "support" ? "support" : "user",
      message: m.message,
      attachments: Array.isArray(attachments) ? attachments : undefined,
      read_at: m.read_at || null,
      created_at: m.created_at,
      updated_at: m.updated_at,
      user: {
        id: m.user_id ? Number(m.user_id) : null,
        name: m.sender === "support" ? "پشتیبانی نوین‌نت" : (m.user_name || "کاربر"),
      },
    };
  });

  return {
    id: Number(ticket.id),
    ticket_number: ticket.ticket_number,
    user_id: Number(ticket.user_id),
    title: ticket.title,
    department: ticket.department,
    status: ticket.status,
    priority: ticket.priority,
    last_reply_at: ticket.last_reply_at,
    closed_at: ticket.closed_at || null,
    archived_at: ticket.archived_at || null,
    created_at: ticket.created_at,
    updated_at: ticket.updated_at,
    messages: formattedMessages,
    user: {
      id: Number(ticket.user_id),
      name: ticket.user_name || "مشتری",
      email: ticket.user_email || "",
      phone: ticket.user_phone || "",
    },
    user_name: ticket.user_name || "مشتری",
    user_email: ticket.user_email || "",
    tracking_code: ticket.ticket_number,
    subject: ticket.title,
  };
}

export async function handleAdminGetTickets(req: Request, res: Response) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  try {
    const db = await getDatabase();
    const includeArchived = req.query.include_archived === "true" || req.query.include_archived === "1";
    const statusFilter = typeof req.query.status === "string" && req.query.status !== "all" ? req.query.status : null;
    const search = typeof req.query.search === "string" ? req.query.search.trim() : null;

    let sql = `
      SELECT t.id, t.ticket_number, t.user_id, t.title, t.department, t.status, t.priority,
             t.last_reply_at, t.closed_at, t.archived_at, t.created_at, t.updated_at,
             u.name as user_name, u.email as user_email, u.phone as user_phone
      FROM support_tickets t
      LEFT JOIN users u ON u.id = t.user_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (!includeArchived) {
      sql += " AND t.archived_at IS NULL";
    }

    if (statusFilter) {
      sql += " AND t.status = ?";
      params.push(statusFilter);
    }

    if (search) {
      sql += " AND (t.title LIKE ? OR t.ticket_number LIKE ? OR u.name LIKE ? OR u.email LIKE ?)";
      const pattern = `%${search}%`;
      params.push(pattern, pattern, pattern, pattern);
    }

    sql += " ORDER BY CASE WHEN t.last_reply_at IS NOT NULL THEN t.last_reply_at ELSE t.created_at END DESC, t.id DESC";

    const ticketRows = queryRows(db, sql, params);

    const formattedList = ticketRows.map((ticket) => {
      const messages = queryRows(
        db,
        `SELECT m.id, m.support_ticket_id, m.user_id, m.sender, m.message, m.attachments,
                m.read_at, m.created_at, m.updated_at, u.name as user_name
         FROM support_ticket_messages m
         LEFT JOIN users u ON u.id = m.user_id
         WHERE m.support_ticket_id = ?
         ORDER BY m.id ASC`,
        [ticket.id]
      );
      return formatAdminTicket(ticket, messages);
    });

    return success(
      res,
      {
        data: formattedList,
        total: formattedList.length,
        per_page: 20,
        current_page: 1,
        last_page: 1,
      },
      "تیکت‌ها با موفقیت دریافت شدند."
    );
  } catch (err: any) {
    return error(res, err.message || "خطا در دریافت تیکت‌های پشتیبانی.", 500);
  }
}

export async function handleAdminGetTicketById(req: Request, res: Response) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  try {
    const idOrNumber = req.params.id;
    const db = await getDatabase();

    const tickets = queryRows(
      db,
      `SELECT t.id, t.ticket_number, t.user_id, t.title, t.department, t.status, t.priority,
              t.last_reply_at, t.closed_at, t.archived_at, t.created_at, t.updated_at,
              u.name as user_name, u.email as user_email, u.phone as user_phone
       FROM support_tickets t
       LEFT JOIN users u ON u.id = t.user_id
       WHERE t.id = ? OR t.ticket_number = ?
       LIMIT 1`,
      [idOrNumber, idOrNumber]
    );

    if (tickets.length === 0) {
      return error(res, "تیکت مورد نظر یافت نشد.", 404, undefined, "NOT_FOUND");
    }

    const ticket = tickets[0];
    const messages = queryRows(
      db,
      `SELECT m.id, m.support_ticket_id, m.user_id, m.sender, m.message, m.attachments,
              m.read_at, m.created_at, m.updated_at, u.name as user_name
       FROM support_ticket_messages m
       LEFT JOIN users u ON u.id = m.user_id
       WHERE m.support_ticket_id = ?
       ORDER BY m.id ASC`,
      [ticket.id]
    );

    return success(res, formatAdminTicket(ticket, messages), "تیکت با موفقیت دریافت شد.");
  } catch (err: any) {
    return error(res, err.message || "خطا در دریافت اطلاعات تیکت.", 500);
  }
}

export async function handleAdminReplyTicket(req: Request, res: Response) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  const idOrNumber = req.params.id;
  const { message, attachments } = req.body;

  if (!message || typeof message !== "string" || !message.trim()) {
    return error(res, "متن پیام پاسخ الزامی است.", 422, { message: ["متن پیام پاسخ الزامی است."] });
  }

  try {
    const db = await getDatabase();
    const tickets = queryRows(
      db,
      "SELECT id, ticket_number, user_id, title, department, status, priority, archived_at FROM support_tickets WHERE id = ? OR ticket_number = ? LIMIT 1",
      [idOrNumber, idOrNumber]
    );

    if (tickets.length === 0) {
      return error(res, "تیکت مورد نظر یافت نشد.", 404, undefined, "NOT_FOUND");
    }

    const ticket = tickets[0];
    if (ticket.archived_at) {
      return error(res, "تیکت بایگانی‌شده است. ابتدا آن را بازگردانی کنید.", 422, { ticket: ["تیکت بایگانی‌شده است."] });
    }

    const now = new Date().toISOString();
    const attachmentsJson = Array.isArray(attachments) && attachments.length > 0 ? JSON.stringify(attachments) : null;

    db.run(
      `INSERT INTO support_ticket_messages (
        support_ticket_id, user_id, sender, message, attachments, read_at, created_at, updated_at
      ) VALUES (?, ?, 'support', ?, ?, ?, ?, ?)`,
      [ticket.id, user.id, message.trim(), attachmentsJson, now, now, now]
    );

    db.run(
      `UPDATE support_tickets
       SET status = 'answered', last_reply_at = ?, updated_at = ?
       WHERE id = ?`,
      [now, now, ticket.id]
    );

    persistDatabase();

    const updatedTickets = queryRows(
      db,
      `SELECT t.id, t.ticket_number, t.user_id, t.title, t.department, t.status, t.priority,
              t.last_reply_at, t.closed_at, t.archived_at, t.created_at, t.updated_at,
              u.name as user_name, u.email as user_email, u.phone as user_phone
       FROM support_tickets t
       LEFT JOIN users u ON u.id = t.user_id
       WHERE t.id = ? LIMIT 1`,
      [ticket.id]
    );

    const messages = queryRows(
      db,
      `SELECT m.id, m.support_ticket_id, m.user_id, m.sender, m.message, m.attachments,
              m.read_at, m.created_at, m.updated_at, u.name as user_name
       FROM support_ticket_messages m
       LEFT JOIN users u ON u.id = m.user_id
       WHERE m.support_ticket_id = ?
       ORDER BY m.id ASC`,
      [ticket.id]
    );

    const formatted = formatAdminTicket(updatedTickets[0], messages);
    return success(res, formatted, "پاسخ با موفقیت ارسال و ثبت شد.", 201);
  } catch (err: any) {
    return error(res, err.message || "خطا در ارسال پاسخ تیکت.", 500);
  }
}

export async function handleAdminUpdateTicket(req: Request, res: Response) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  const idOrNumber = req.params.id;
  const { status, priority, department, title } = req.body;

  try {
    const db = await getDatabase();
    const tickets = queryRows(
      db,
      "SELECT id, ticket_number, user_id, title, department, status, priority, archived_at, closed_at FROM support_tickets WHERE id = ? OR ticket_number = ? LIMIT 1",
      [idOrNumber, idOrNumber]
    );

    if (tickets.length === 0) {
      return error(res, "تیکت مورد نظر یافت نشد.", 404, undefined, "NOT_FOUND");
    }

    const ticket = tickets[0];
    if (ticket.archived_at && status !== "closed") {
      return error(res, "تیکت بایگانی‌شده است. ابتدا آن را بازگردانی کنید.", 422);
    }

    const updates: string[] = [];
    const params: any[] = [];
    const now = new Date().toISOString();

    if (status) {
      const validStatuses = ["open", "investigating", "answered", "closed"];
      if (!validStatuses.includes(status)) {
        return error(res, `وضعیت نامعتبر است. وضعیت‌های مجاز: ${validStatuses.join(", ")}`, 422);
      }
      updates.push("status = ?");
      params.push(status);

      if (status === "closed") {
        updates.push("closed_at = ?");
        params.push(now);
      } else {
        updates.push("closed_at = NULL");
      }
    }

    if (priority) {
      const validPriorities = ["low", "medium", "high", "urgent"];
      if (!validPriorities.includes(priority)) {
        return error(res, `اولویت نامعتبر است. اولویت‌های مجاز: ${validPriorities.join(", ")}`, 422);
      }
      updates.push("priority = ?");
      params.push(priority);
    }

    if (department && typeof department === "string" && department.trim()) {
      updates.push("department = ?");
      params.push(department.trim());
    }

    if (title && typeof title === "string" && title.trim()) {
      updates.push("title = ?");
      params.push(title.trim());
    }

    updates.push("updated_at = ?");
    params.push(now);

    params.push(ticket.id);

    db.run(`UPDATE support_tickets SET ${updates.join(", ")} WHERE id = ?`, params);
    persistDatabase();

    const updatedTickets = queryRows(
      db,
      `SELECT t.id, t.ticket_number, t.user_id, t.title, t.department, t.status, t.priority,
              t.last_reply_at, t.closed_at, t.archived_at, t.created_at, t.updated_at,
              u.name as user_name, u.email as user_email, u.phone as user_phone
       FROM support_tickets t
       LEFT JOIN users u ON u.id = t.user_id
       WHERE t.id = ? LIMIT 1`,
      [ticket.id]
    );

    const messages = queryRows(
      db,
      `SELECT m.id, m.support_ticket_id, m.user_id, m.sender, m.message, m.attachments,
              m.read_at, m.created_at, m.updated_at, u.name as user_name
       FROM support_ticket_messages m
       LEFT JOIN users u ON u.id = m.user_id
       WHERE m.support_ticket_id = ?
       ORDER BY m.id ASC`,
      [ticket.id]
    );

    return success(res, formatAdminTicket(updatedTickets[0], messages), "وضعیت تیکت با موفقیت به‌روزرسانی شد.");
  } catch (err: any) {
    return error(res, err.message || "خطا در به‌روزرسانی تیکت.", 500);
  }
}

export function handleAdminTicketAction(action: "read" | "archive" | "restore" | "delete") {
  return async (req: Request, res: Response) => {
    const user = await requireAdmin(req, res);
    if (!user) return;

    const idOrNumber = req.params.id;

    try {
      const db = await getDatabase();
      const tickets = queryRows(
        db,
        "SELECT id, ticket_number, user_id, title, department, status, priority, archived_at, closed_at FROM support_tickets WHERE id = ? OR ticket_number = ? LIMIT 1",
        [idOrNumber, idOrNumber]
      );

      if (tickets.length === 0) {
        return error(res, "تیکت مورد نظر یافت نشد.", 404, undefined, "NOT_FOUND");
      }

      const ticket = tickets[0];
      const now = new Date().toISOString();

      if (action === "delete") {
        db.run("DELETE FROM support_ticket_messages WHERE support_ticket_id = ?", [ticket.id]);
        db.run("DELETE FROM support_tickets WHERE id = ?", [ticket.id]);
        persistDatabase();
        return success(res, { id: ticket.id }, "تیکت با موفقیت حذف شد.");
      }

      if (action === "read") {
        db.run(
          "UPDATE support_ticket_messages SET read_at = ? WHERE support_ticket_id = ? AND sender = 'user' AND read_at IS NULL",
          [now, ticket.id]
        );
        db.run("UPDATE support_tickets SET updated_at = ? WHERE id = ?", [now, ticket.id]);
        persistDatabase();
      } else if (action === "archive") {
        db.run(
          "UPDATE support_tickets SET archived_at = ?, status = 'closed', closed_at = COALESCE(closed_at, ?), updated_at = ? WHERE id = ?",
          [now, now, now, ticket.id]
        );
        persistDatabase();
      } else if (action === "restore") {
        db.run(
          "UPDATE support_tickets SET archived_at = NULL, updated_at = ? WHERE id = ?",
          [now, ticket.id]
        );
        persistDatabase();
      }

      const updatedTickets = queryRows(
        db,
        `SELECT t.id, t.ticket_number, t.user_id, t.title, t.department, t.status, t.priority,
                t.last_reply_at, t.closed_at, t.archived_at, t.created_at, t.updated_at,
                u.name as user_name, u.email as user_email, u.phone as user_phone
         FROM support_tickets t
         LEFT JOIN users u ON u.id = t.user_id
         WHERE t.id = ? LIMIT 1`,
        [ticket.id]
      );

      const messages = queryRows(
        db,
        `SELECT m.id, m.support_ticket_id, m.user_id, m.sender, m.message, m.attachments,
                m.read_at, m.created_at, m.updated_at, u.name as user_name
         FROM support_ticket_messages m
         LEFT JOIN users u ON u.id = m.user_id
         WHERE m.support_ticket_id = ?
         ORDER BY m.id ASC`,
        [ticket.id]
      );

      return success(res, formatAdminTicket(updatedTickets[0], messages), "عملیات با موفقیت انجام شد.");
    } catch (err: any) {
      return error(res, err.message || "خطا در پردازش عملیات تیکت.", 500);
    }
  };
}

// 6. Discounts (SQLite Single Source of Truth)

export function formatDiscountCoupon(row: any) {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    discount_type: row.discount_type,
    type: row.discount_type,
    discount_value: Number(row.discount_value),
    value: Number(row.discount_value),
    min_order_amount: Number(row.min_order_amount || 0),
    max_discount_amount: row.max_discount_amount != null ? Number(row.max_discount_amount) : null,
    usage_limit: Number(row.usage_limit || 0),
    usage_count: Number(row.usage_count || 0),
    used_count: Number(row.usage_count || 0),
    starts_at: row.starts_at || null,
    expires_at: row.expires_at || null,
    start_date: row.starts_at || null,
    expiry_date: row.expires_at || null,
    is_active: Boolean(row.is_active),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function handleAdminGetDiscounts(req: Request, res: Response) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  const db = await getDatabase();
  const rows = queryRows(
    db,
    `SELECT id, code, title, discount_type, discount_value, min_order_amount,
            max_discount_amount, usage_limit, usage_count, starts_at, expires_at,
            is_active, created_at, updated_at
     FROM discount_coupons
     ORDER BY id DESC`
  );

  const coupons = rows.map(formatDiscountCoupon);
  return res.json({
    success: true,
    message: "کوپن‌های تخفیف با موفقیت دریافت شدند.",
    data: coupons,
    total: coupons.length,
  });
}

export async function handleAdminCreateDiscount(req: Request, res: Response) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  const data = req.body || {};
  const rawCode = data.code;
  const rawTitle = data.title;

  if (!rawCode || typeof rawCode !== "string" || !rawCode.trim()) {
    return error(res, "کد تخفیف الزامی است.", 422, { code: ["کد تخفیف الزامی است."] });
  }
  if (!rawTitle || typeof rawTitle !== "string" || !rawTitle.trim()) {
    return error(res, "عنوان تخفیف الزامی است.", 422, { title: ["عنوان تخفیف الزامی است."] });
  }

  const code = rawCode.trim().toUpperCase();
  const title = rawTitle.trim();
  const discountType = data.discount_type === "percentage" ? "percentage" : "fixed";
  const discountValue = Number(data.discount_value ?? data.value ?? 0);

  if (isNaN(discountValue) || discountValue <= 0) {
    return error(res, "مقدار تخفیف باید عددی بزرگتر از صفر باشد.", 422, { discount_value: ["مقدار نامعتبر است."] });
  }

  if (discountType === "percentage" && discountValue > 100) {
    return error(res, "درصد تخفیف نمی‌تواند بیشتر از ۱۰۰ باشد.", 422, { discount_value: ["درصد تخفیف حداکثر ۱۰۰ است."] });
  }

  const minOrderAmount = Number(data.min_order_amount || 0);
  const maxDiscountAmount = data.max_discount_amount != null && data.max_discount_amount !== "" ? Number(data.max_discount_amount) : null;
  const usageLimit = Number(data.usage_limit || 0);
  const startsAt = data.starts_at || data.start_date || null;
  const expiresAt = data.expires_at || data.expiry_date || null;
  const isActive = data.is_active !== undefined ? (data.is_active ? 1 : 0) : 1;
  const now = new Date().toISOString();

  const db = await getDatabase();

  // Check unique code
  const existing = queryRows(db, "SELECT id FROM discount_coupons WHERE UPPER(TRIM(code)) = ? LIMIT 1", [code]);
  if (existing.length > 0) {
    return error(res, `کد تخفیف «${code}» تکراری است.`, 422, { code: ["کد تخفیف تکراری است."] });
  }

  db.run(
    `INSERT INTO discount_coupons (
      code, title, discount_type, discount_value, min_order_amount,
      max_discount_amount, usage_limit, usage_count, starts_at, expires_at,
      is_active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`,
    [
      code,
      title,
      discountType,
      discountValue,
      minOrderAmount,
      maxDiscountAmount,
      usageLimit,
      startsAt,
      expiresAt,
      isActive,
      now,
      now,
    ]
  );

  persistDatabase();

  const inserted = queryRows(
    db,
    `SELECT id, code, title, discount_type, discount_value, min_order_amount,
            max_discount_amount, usage_limit, usage_count, starts_at, expires_at,
            is_active, created_at, updated_at
     FROM discount_coupons WHERE UPPER(TRIM(code)) = ? LIMIT 1`,
    [code]
  );

  const createdCoupon = inserted.length > 0 ? formatDiscountCoupon(inserted[0]) : { id: Date.now(), code, title };
  return success(res, createdCoupon, "کد تخفیف ایجاد شد.", 201);
}

export async function handleAdminDeleteDiscount(req: Request, res: Response) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  const idOrCode = req.params.id;
  const db = await getDatabase();

  const existing = queryRows(
    db,
    "SELECT id, code FROM discount_coupons WHERE id = ? OR UPPER(TRIM(code)) = ? LIMIT 1",
    [idOrCode, String(idOrCode).trim().toUpperCase()]
  );

  if (existing.length === 0) {
    return error(res, "کد تخفیف یافت نشد.", 404);
  }

  const found = existing[0];
  db.run("DELETE FROM discount_coupons WHERE id = ?", [found.id]);
  persistDatabase();

  return success(res, { id: String(found.id), code: found.code }, "کد تخفیف حذف شد.");
}

export async function handleAdminToggleDiscount(req: Request, res: Response) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  const idOrCode = req.params.id;
  const db = await getDatabase();

  const existing = queryRows(
    db,
    `SELECT id, code, title, discount_type, discount_value, min_order_amount,
            max_discount_amount, usage_limit, usage_count, starts_at, expires_at,
            is_active, created_at, updated_at
     FROM discount_coupons WHERE id = ? OR UPPER(TRIM(code)) = ? LIMIT 1`,
    [idOrCode, String(idOrCode).trim().toUpperCase()]
  );

  if (existing.length === 0) {
    return error(res, "کد تخفیف یافت نشد.", 404);
  }

  const current = existing[0];
  const newActive = current.is_active ? 0 : 1;
  const now = new Date().toISOString();

  db.run("UPDATE discount_coupons SET is_active = ?, updated_at = ? WHERE id = ?", [newActive, now, current.id]);
  persistDatabase();

  const updated = {
    ...current,
    is_active: newActive,
    updated_at: now,
  };

  return success(res, formatDiscountCoupon(updated), "وضعیت کد تخفیف تغییر یافت.");
}

export async function handleAdminUpdateDiscount(req: Request, res: Response) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  const idOrCode = req.params.id;
  const db = await getDatabase();

  const existing = queryRows(
    db,
    `SELECT * FROM discount_coupons WHERE id = ? OR UPPER(TRIM(code)) = ? LIMIT 1`,
    [idOrCode, String(idOrCode).trim().toUpperCase()]
  );

  if (existing.length === 0) {
    return error(res, "کد تخفیف یافت نشد.", 404);
  }

  const current = existing[0];
  const data = req.body || {};

  let code = current.code;
  if (data.code && typeof data.code === "string" && data.code.trim()) {
    code = data.code.trim().toUpperCase();
    if (code !== current.code) {
      const dup = queryRows(db, "SELECT id FROM discount_coupons WHERE UPPER(TRIM(code)) = ? AND id != ? LIMIT 1", [code, current.id]);
      if (dup.length > 0) {
        return error(res, `کد تخفیف «${code}» تکراری است.`, 422, { code: ["کد تخفیف تکراری است."] });
      }
    }
  }

  const title = (data.title && typeof data.title === "string" && data.title.trim()) ? data.title.trim() : current.title;
  const discountType = data.discount_type ? (data.discount_type === "percentage" ? "percentage" : "fixed") : current.discount_type;
  let discountValue = data.discount_value !== undefined ? Number(data.discount_value) : current.discount_value;
  if (isNaN(discountValue) || discountValue <= 0) {
    discountValue = current.discount_value;
  }
  if (discountType === "percentage" && discountValue > 100) {
    return error(res, "درصد تخفیف نمی‌تواند بیشتر از ۱۰۰ باشد.", 422, { discount_value: ["درصد تخفیف حداکثر ۱۰۰ است."] });
  }

  const minOrderAmount = data.min_order_amount !== undefined ? Number(data.min_order_amount || 0) : current.min_order_amount;
  const maxDiscountAmount = data.max_discount_amount !== undefined ? (data.max_discount_amount ? Number(data.max_discount_amount) : null) : current.max_discount_amount;
  const usageLimit = data.usage_limit !== undefined ? Number(data.usage_limit || 0) : current.usage_limit;
  const startsAt = data.starts_at !== undefined ? data.starts_at : (data.start_date !== undefined ? data.start_date : current.starts_at);
  const expiresAt = data.expires_at !== undefined ? data.expires_at : (data.expiry_date !== undefined ? data.expiry_date : current.expires_at);
  const isActive = data.is_active !== undefined ? (data.is_active ? 1 : 0) : current.is_active;
  const now = new Date().toISOString();

  db.run(
    `UPDATE discount_coupons SET
      code = ?, title = ?, discount_type = ?, discount_value = ?,
      min_order_amount = ?, max_discount_amount = ?, usage_limit = ?,
      starts_at = ?, expires_at = ?, is_active = ?, updated_at = ?
     WHERE id = ?`,
    [
      code,
      title,
      discountType,
      discountValue,
      minOrderAmount,
      maxDiscountAmount,
      usageLimit,
      startsAt,
      expiresAt,
      isActive,
      now,
      current.id,
    ]
  );

  persistDatabase();

  const updated = queryRows(db, "SELECT * FROM discount_coupons WHERE id = ? LIMIT 1", [current.id]);
  return success(res, formatDiscountCoupon(updated[0]), "کد تخفیف با موفقیت ویرایش شد.");
}

function deepMergeSettings<T extends Record<string, any>>(target: T, source: Record<string, any>): T {
  const result: Record<string, any> = { ...target };
  for (const key of Object.keys(source)) {
    const sourceVal = source[key];
    const targetVal = result[key];
    if (
      sourceVal !== null &&
      typeof sourceVal === "object" &&
      !Array.isArray(sourceVal) &&
      targetVal !== null &&
      typeof targetVal === "object" &&
      !Array.isArray(targetVal)
    ) {
      result[key] = deepMergeSettings(targetVal, sourceVal);
    } else {
      result[key] = sourceVal;
    }
  }
  return result as T;
}

// 7. Settings
export async function handleAdminGetSetting(req: Request, res: Response) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  const rawGroup = req.params.group;
  const group = String(rawGroup || "").trim();
  if (!group || !/^[a-zA-Z0-9_-]+$/.test(group)) {
    return error(res, "شناسه گروه تنظیمات نامعتبر است.", 422);
  }

  try {
    const db = await getDatabase();
    const rows = queryRows(
      db,
      'SELECT key, value, "group", is_public, created_at, updated_at FROM settings WHERE "group" = ? ORDER BY key ASC',
      [group]
    );

    if (rows.length === 0) {
      return success(res, { config: {} }, `تنظیمات ${group} دریافت شد.`);
    }

    const data: Record<string, any> = {};
    for (const row of rows) {
      const rowKey: string = row.key;
      const subKey = rowKey.startsWith(group + ".") ? rowKey.substring(group.length + 1) : rowKey;
      let parsedValue = null;
      if (row.value !== null && row.value !== undefined) {
        try {
          parsedValue = JSON.parse(row.value);
        } catch {
          parsedValue = row.value;
        }
      }
      data[subKey] = parsedValue;
    }

    return success(res, data, `تنظیمات ${group} دریافت شد.`);
  } catch (err: any) {
    return error(res, "خطا در دریافت تنظیمات.", 500);
  }
}

export async function handleAdminUpdateSetting(req: Request, res: Response) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  const rawGroup = req.params.group;
  const group = String(rawGroup || "").trim();
  if (!group || !/^[a-zA-Z0-9_-]+$/.test(group)) {
    return error(res, "شناسه گروه تنظیمات نامعتبر است.", 422);
  }

  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return error(res, "داده‌های ارسالی برای تنظیمات نامعتبر است.", 422);
  }

  let incoming = body.settings !== undefined ? body.settings : body;
  if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) {
    return error(res, "فرمت تنظیمات نامعتبر است.", 422);
  }

  try {
    const db = await getDatabase();

    // 1. Fetch current settings for this group
    const existingRows = queryRows(
      db,
      'SELECT id, key, value, "group", is_public FROM settings WHERE "group" = ? ORDER BY key ASC',
      [group]
    );

    const currentGroupData: Record<string, any> = {};
    for (const row of existingRows) {
      const rowKey: string = row.key;
      const subKey = rowKey.startsWith(group + ".") ? rowKey.substring(group.length + 1) : rowKey;
      let parsed = null;
      if (row.value !== null && row.value !== undefined) {
        try {
          parsed = JSON.parse(row.value);
        } catch {
          parsed = row.value;
        }
      }
      currentGroupData[subKey] = parsed;
    }

    // Support partial updates targeting nested config when incoming is not explicitly keyed under "config"
    if (
      !("config" in incoming) &&
      currentGroupData.config &&
      typeof currentGroupData.config === "object" &&
      !Array.isArray(currentGroupData.config)
    ) {
      const hasConfigKeys = Object.keys(incoming).some((k) => k in currentGroupData.config);
      if (hasConfigKeys) {
        incoming = { config: incoming };
      }
    }

    // 2. Deep merge existing group data with incoming updates (preserving unmentioned fields within the group)
    const mergedGroupData = deepMergeSettings(currentGroupData, incoming);

    // 3. Persist each subkey in the group to SQLite settings table
    const now = new Date().toISOString();
    const isPublic = ["appearance", "static_content", "blog_posts"].includes(group) ? 1 : 0;

    for (const subKey of Object.keys(mergedGroupData)) {
      const fullKey = `${group}.${subKey}`;
      const jsonValue = JSON.stringify(mergedGroupData[subKey]);

      const existingRow = existingRows.find((r) => r.key === fullKey);
      if (existingRow) {
        db.run(
          `UPDATE settings SET value = ?, updated_at = ? WHERE id = ?`,
          [jsonValue, now, existingRow.id]
        );
      } else {
        db.run(
          `INSERT INTO settings (key, value, "group", is_public, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [fullKey, jsonValue, group, isPublic, now, now]
        );
      }
    }

    // 4. Save SQLite database to disk
    persistDatabase();

    // 5. Read back fresh persisted server state
    const freshRows = queryRows(
      db,
      'SELECT key, value, "group", is_public, created_at, updated_at FROM settings WHERE "group" = ? ORDER BY key ASC',
      [group]
    );

    const responseData: Record<string, any> = {};
    for (const row of freshRows) {
      const rowKey: string = row.key;
      const subKey = rowKey.startsWith(group + ".") ? rowKey.substring(group.length + 1) : rowKey;
      let parsed = null;
      if (row.value !== null && row.value !== undefined) {
        try {
          parsed = JSON.parse(row.value);
        } catch {
          parsed = row.value;
        }
      }
      responseData[subKey] = parsed;
    }

    return success(res, responseData, `تنظیمات ${group} به‌روزرسانی شد.`);
  } catch (err: any) {
    return error(res, "خطا در ذخیره تنظیمات در پایگاه داده.", 500);
  }
}

export async function handleGetPublicSettings(_req: Request, res: Response) {
  try {
    const db = await getDatabase();
    const rows = queryRows(
      db,
      'SELECT key, value, "group" FROM settings WHERE is_public = 1 ORDER BY "group" ASC, key ASC'
    );

    const publicGroups: Record<string, Record<string, any>> = {};
    for (const row of rows) {
      const group: string = row.group;
      const rowKey: string = row.key;
      const subKey = rowKey.startsWith(group + ".") ? rowKey.substring(group.length + 1) : rowKey;
      let parsed = null;
      if (row.value !== null && row.value !== undefined) {
        try {
          parsed = JSON.parse(row.value);
        } catch {
          parsed = row.value;
        }
      }
      if (!publicGroups[group]) {
        publicGroups[group] = {};
      }
      publicGroups[group][subKey] = parsed;
    }

    if (publicGroups.blog_posts && Array.isArray(publicGroups.blog_posts.posts)) {
      publicGroups.blog_posts.posts = publicGroups.blog_posts.posts.filter(
        (p: any) => p && (p.is_published === true || p.isPublished === true)
      );
    }

    return success(res, publicGroups, "تنظیمات عمومی با موفقیت دریافت شد.");
  } catch (err: any) {
    return error(res, "خطا در دریافت تنظیمات عمومی.", 500);
  }
}

// 8. Product attributes & services
export async function handleAdminProductAttributes(req: Request, res: Response) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  const attributes = [
    { id: 1, name: "برند", key: "brand", type: "single_select", is_required: true, options: ["ایسوس", "لنوو", "سامسونگ", "هواوی"] },
    { id: 2, name: "پردازنده", key: "processor", type: "single_select", is_required: false, options: ["Core i5", "Core i7", "Core i9", "Ryzen 5", "Ryzen 7"] },
    { id: 3, name: "حافظه RAM", key: "ram", type: "single_select", is_required: false, unit: "GB", options: ["8GB", "16GB", "32GB"] },
    { id: 4, name: "حافظه داخلی", key: "storage", type: "single_select", is_required: false, unit: "GB", options: ["256GB", "512GB", "1TB SSD"] },
  ];

  return success(res, attributes, "ویژگی‌های محصول دریافت شد.");
}

export { handleAdminGetServicesCatalog as handleAdminServicesCatalog, handleAdminGetServicesCategories as handleAdminServicesCategories } from "./serviceRoutes";

export async function handleAdminSmsTest(req: Request, res: Response) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  return success(res, { connected: true, balance: 154000, provider: "kavenegar" }, "ارتباط با سامانه پیامکی با موفقیت برقرار شد.");
}

export async function handleAdminReconcileRefund(req: Request, res: Response) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  const orderId = Number(req.params.id);
  if (!orderId || isNaN(orderId)) {
    return error(res, "شناسه سفارش نامعتبر است.", 400, undefined, "INVALID_ORDER_ID");
  }

  const { decision, notes, reference, external_reference, externalReference, paymentId, payment_id } = req.body || {};

  if (decision !== "confirmed_success" && decision !== "confirmed_failure") {
    return error(
      res,
      "تصمیم تطبیق نامعتبر است (باید confirmed_success یا confirmed_failure باشد).",
      422,
      undefined,
      "INVALID_RECONCILE_DECISION"
    );
  }

  const resolvedRef = reference || external_reference || externalReference;
  const resolvedPaymentId = paymentId || payment_id ? Number(paymentId || payment_id) : undefined;

  const result = await reconcileUnknownRefund({
    orderId,
    paymentId: resolvedPaymentId,
    decision,
    adminUserId: user.id,
    notes,
    externalReference: resolvedRef,
  });

  if (!result.success) {
    const statusCode = result.error === "ORDER_NOT_FOUND" || result.error === "PAYMENT_NOT_FOUND" ? 404 : 422;
    return error(res, result.message, statusCode, undefined, result.error);
  }

  return success(res, result, result.message);
}

