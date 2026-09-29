import { Request, Response } from "express";
import { authenticateToken } from "./authRoutes";
import { getDatabase, persistDatabase, queryRows, queryProductsFromDatabase } from "./db";

function success(res: Response, data: unknown, message = "عملیات با موفقیت انجام شد.", status = 200) {
  return res.status(status).json({
    success: true,
    data,
    message,
  });
}

function error(res: Response, message: string, status = 400, errors?: unknown, error_code?: string) {
  return res.status(status).json({
    success: false,
    message,
    errors: errors || { general: [message] },
    error_code,
  });
}

/**
 * Format favorite entity with its associated product data
 */
function formatFavorite(favRow: any, product?: any) {
  return {
    id: Number(favRow.id),
    user_id: Number(favRow.user_id),
    product_id: Number(favRow.product_id),
    created_at: favRow.created_at,
    updated_at: favRow.updated_at,
    product: product || null,
  };
}

/**
 * GET /api/v1/favorites
 * Return only the authenticated user's favorites with associated product data.
 */
export async function handleGetFavorites(req: Request, res: Response) {
  try {
    const user = await authenticateToken(req);
    if (!user) {
      return error(res, "برای مشاهده علاقه‌مندی‌ها ابتدا وارد حساب کاربری خود شوید.", 401, undefined, "UNAUTHENTICATED");
    }

    const db = await getDatabase();
    const rows = queryRows(
      db,
      "SELECT id, user_id, product_id, created_at, updated_at FROM user_favorites WHERE user_id = ? ORDER BY id DESC",
      [user.id]
    );

    const allProducts = queryProductsFromDatabase(db);
    const results = rows.map((row) => {
      const product = allProducts.find((p: any) => Number(p.id) === Number(row.product_id));
      return formatFavorite(row, product);
    });

    return success(res, results, "علاقه‌مندی‌ها با موفقیت دریافت شدند.");
  } catch (err: any) {
    return error(res, err.message || "خطا در دریافت لیست علاقه‌مندی‌ها.", 500);
  }
}

/**
 * POST /api/v1/favorites/:product
 * Product must exist and be active.
 * Idempotent: duplicate requests return existing favorite without duplicate rows.
 */
export async function handleAddFavorite(req: Request, res: Response) {
  try {
    const user = await authenticateToken(req);
    if (!user) {
      return error(res, "برای افزودن به علاقه‌مندی‌ها ابتدا وارد حساب کاربری خود شوید.", 401, undefined, "UNAUTHENTICATED");
    }

    const productId = Number(req.params.product);
    if (!productId || isNaN(productId)) {
      return error(res, "شناسه محصول نامعتبر است.", 422);
    }

    const db = await getDatabase();
    const matched = queryProductsFromDatabase(db, productId);
    const product = matched.length > 0 ? matched[0] : null;

    // Business rule: Product must exist and be active
    const isActive = product && (product.is_active === true || product.is_active === 1);
    if (!product || !isActive) {
      return error(res, "محصول مورد نظر یافت نشد یا غیرفعال است.", 404, undefined, "ENTITY_NOT_FOUND");
    }

    const existing = queryRows(
      db,
      "SELECT id, user_id, product_id, created_at, updated_at FROM user_favorites WHERE user_id = ? AND product_id = ?",
      [user.id, productId]
    );

    if (existing.length > 0) {
      return success(
        res,
        formatFavorite(existing[0], product),
        "محصول قبلاً در لیست علاقه‌مندی‌ها ثبت شده است.",
        201
      );
    }

    const now = new Date().toISOString();
    db.run(
      "INSERT INTO user_favorites (user_id, product_id, created_at, updated_at) VALUES (?, ?, ?, ?)",
      [user.id, productId, now, now]
    );
    persistDatabase();

    const createdRows = queryRows(
      db,
      "SELECT id, user_id, product_id, created_at, updated_at FROM user_favorites WHERE user_id = ? AND product_id = ?",
      [user.id, productId]
    );
    const createdRow = createdRows[0] || {
      id: Date.now(),
      user_id: user.id,
      product_id: productId,
      created_at: now,
      updated_at: now,
    };

    return success(
      res,
      formatFavorite(createdRow, product),
      "محصول به لیست علاقه‌مندی‌ها اضافه شد.",
      201
    );
  } catch (err: any) {
    return error(res, err.message || "خطا در افزودن به علاقه‌مندی‌ها.", 500);
  }
}

/**
 * DELETE /api/v1/favorites/:product
 * Delete only the authenticated user's favorite for the requested product.
 * Safely idempotent.
 */
export async function handleDeleteFavorite(req: Request, res: Response) {
  try {
    const user = await authenticateToken(req);
    if (!user) {
      return error(res, "برای حذف از علاقه‌مندی‌ها ابتدا وارد حساب کاربری خود شوید.", 401, undefined, "UNAUTHENTICATED");
    }

    const productId = Number(req.params.product);
    if (!productId || isNaN(productId)) {
      return error(res, "شناسه محصول نامعتبر است.", 422);
    }

    const db = await getDatabase();
    db.run(
      "DELETE FROM user_favorites WHERE user_id = ? AND product_id = ?",
      [user.id, productId]
    );
    persistDatabase();

    return success(res, null, "محصول از لیست علاقه‌مندی‌ها حذف شد.");
  } catch (err: any) {
    return error(res, err.message || "خطا در حذف از علاقه‌مندی‌ها.", 500);
  }
}
