import { Request, Response } from "express";
import { getDatabase, persistDatabase } from "./db";
import { authenticateToken } from "./authRoutes";

function success(res: Response, data: any, message = "Success", status = 200) {
  return res.status(status).json({
    success: true,
    message,
    data,
  });
}

function error(res: Response, message = "Error", status = 400, errors?: any) {
  return res.status(status).json({
    success: false,
    message,
    errors: errors || { general: [message] },
  });
}

function generateSlug(name: string): string {
  const sanitized = name
    .trim()
    .toLowerCase()
    .replace(/[^\u0600-\u06FF\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return sanitized || `category-${Date.now()}`;
}

export async function handleGetCategories(req: Request, res: Response) {
  try {
    const db = await getDatabase();
    const query = db.exec(`
      SELECT id, parent_id, name, slug, description, image_url, is_active, sort_order, meta_title, meta_description, created_at, updated_at
      FROM categories
      WHERE is_active = 1
      ORDER BY sort_order ASC, id ASC
    `);

    if (query.length === 0 || query[0].values.length === 0) {
      return success(res, [], "لیست دسته‌بندی‌ها خالی است.");
    }

    const columns = query[0].columns;
    const allCategories = query[0].values.map((row) => {
      const item: Record<string, any> = {};
      columns.forEach((col, idx) => {
        item[col] = row[idx];
      });
      item.is_active = Boolean(item.is_active);
      return item;
    });

    // Build hierarchy tree (Root categories with children)
    const categoryMap = new Map<number, any>();
    allCategories.forEach((cat) => {
      categoryMap.set(cat.id, { ...cat, children: [] });
    });

    const tree: any[] = [];
    allCategories.forEach((cat) => {
      const node = categoryMap.get(cat.id);
      if (cat.parent_id === null || cat.parent_id === undefined || !categoryMap.has(cat.parent_id)) {
        tree.push(node);
      } else {
        const parent = categoryMap.get(cat.parent_id);
        if (parent) {
          parent.children.push(node);
        }
      }
    });

    return success(res, tree, "درخت دسته‌بندی‌ها با موفقیت دریافت شد.");
  } catch (err: any) {
    return error(res, err.message || "خطا در دریافت دسته‌بندی‌ها", 500);
  }
}

export async function handleGetCategoryBySlugOrId(req: Request, res: Response) {
  try {
    const slugOrId = req.params.slugOrId;
    if (!slugOrId) {
      return error(res, "شناسه یا اسلاگ دسته‌بندی الزامی است.", 422);
    }

    const db = await getDatabase();
    const isNum = /^\d+$/.test(slugOrId);

    const sql = isNum
      ? `SELECT id, parent_id, name, slug, description, image_url, is_active, sort_order, meta_title, meta_description, created_at, updated_at FROM categories WHERE id = ${Number(slugOrId)}`
      : `SELECT id, parent_id, name, slug, description, image_url, is_active, sort_order, meta_title, meta_description, created_at, updated_at FROM categories WHERE slug = '${slugOrId.replace(/'/g, "''")}'`;

    const query = db.exec(sql);
    if (query.length === 0 || query[0].values.length === 0) {
      return error(res, "دسته‌بندی مورد نظر یافت نشد.", 404);
    }

    const columns = query[0].columns;
    const cat: Record<string, any> = {};
    query[0].values[0].forEach((val, idx) => {
      cat[columns[idx]] = val;
    });
    cat.is_active = Boolean(cat.is_active);

    // Fetch children
    const childrenQuery = db.exec(`
      SELECT id, parent_id, name, slug, description, image_url, is_active, sort_order
      FROM categories
      WHERE parent_id = ${cat.id} AND is_active = 1
      ORDER BY sort_order ASC
    `);

    cat.children = [];
    if (childrenQuery.length > 0 && childrenQuery[0].values.length > 0) {
      const childCols = childrenQuery[0].columns;
      cat.children = childrenQuery[0].values.map((row) => {
        const child: Record<string, any> = {};
        childCols.forEach((col, idx) => {
          child[col] = row[idx];
        });
        child.is_active = Boolean(child.is_active);
        return child;
      });
    }

    return success(res, cat, "اطلاعات دسته‌بندی دریافت شد.");
  } catch (err: any) {
    return error(res, err.message || "خطا در دریافت دسته‌بندی", 500);
  }
}

export async function handleAdminGetCategories(req: Request, res: Response) {
  try {
    const user = await authenticateToken(req);
    if (!user) {
      return error(res, "برای دسترسی به پنل مدیریت ابتدا وارد شوید.", 401);
    }
    if (user.role !== "admin" && user.role !== "staff") {
      return error(res, "شما دسترسی لازم برای انجام این عملیات را ندارید.", 403);
    }

    const db = await getDatabase();
    const query = db.exec(`
      SELECT id, parent_id, name, slug, description, image_url, is_active, sort_order, meta_title, meta_description, created_at, updated_at
      FROM categories
      ORDER BY sort_order ASC, name ASC
    `);

    if (query.length === 0 || query[0].values.length === 0) {
      return success(res, [], "لیست دسته‌ها خالی است.");
    }

    const columns = query[0].columns;
    const categories = query[0].values.map((row) => {
      const item: Record<string, any> = {};
      columns.forEach((col, idx) => {
        item[col] = row[idx];
      });
      item.is_active = Boolean(item.is_active);
      return item;
    });

    return success(res, categories, "لیست دسته‌بندی‌های مدیریت با موفقیت دریافت شد.");
  } catch (err: any) {
    return error(res, err.message || "خطا در دریافت دسته‌بندی‌ها", 500);
  }
}

export async function handleAdminCreateCategory(req: Request, res: Response) {
  try {
    const user = await authenticateToken(req);
    if (!user) {
      return error(res, "برای دسترسی به پنل مدیریت ابتدا وارد شوید.", 401);
    }
    if (user.role !== "admin" && user.role !== "staff") {
      return error(res, "شما دسترسی لازم برای انجام این عملیات را ندارید.", 403);
    }

    const { name, slug, parent_id, description, image_url, is_active, sort_order, meta_title, meta_description } = req.body;
    if (!name || String(name).trim() === "") {
      return error(res, "نام دسته‌بندی الزامی است.", 422, { name: ["نام دسته‌بندی الزامی است."] });
    }

    const db = await getDatabase();
    const finalSlug = (slug && String(slug).trim() !== "") ? String(slug).trim() : generateSlug(String(name));

    // Check duplicate slug
    const existing = db.exec(`SELECT id FROM categories WHERE slug = '${finalSlug.replace(/'/g, "''")}'`);
    if (existing.length > 0 && existing[0].values.length > 0) {
      return error(res, "این نامک (slug) قبلاً برای دسته دیگری ثبت شده است.", 422, {
        slug: ["اسلاگ تکراری است."],
      });
    }

    const parentVal = (parent_id !== undefined && parent_id !== null && parent_id !== "") ? Number(parent_id) : null;
    const isActiveVal = is_active !== false && is_active !== 0 && is_active !== "0" ? 1 : 0;
    const sortVal = sort_order !== undefined ? Number(sort_order) : 0;
    const now = new Date().toISOString();

    db.run(
      `INSERT INTO categories (parent_id, name, slug, description, image_url, is_active, sort_order, meta_title, meta_description, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        parentVal,
        String(name).trim(),
        finalSlug,
        description ? String(description) : null,
        image_url ? String(image_url) : null,
        isActiveVal,
        sortVal,
        meta_title ? String(meta_title) : null,
        meta_description ? String(meta_description) : null,
        now,
        now,
      ]
    );

    const insertedQuery = db.exec(`SELECT id, parent_id, name, slug, description, image_url, is_active, sort_order, meta_title, meta_description, created_at, updated_at FROM categories WHERE slug = '${finalSlug.replace(/'/g, "''")}'`);
    const cols = insertedQuery[0].columns;
    const createdCat: Record<string, any> = {};
    insertedQuery[0].values[0].forEach((val, idx) => {
      createdCat[cols[idx]] = val;
    });
    createdCat.is_active = Boolean(createdCat.is_active);

    persistDatabase();

    return success(res, createdCat, "دسته‌بندی جدید با موفقیت در پایگاه داده ایجاد شد.", 201);
  } catch (err: any) {
    return error(res, err.message || "خطا در ایجاد دسته‌بندی", 500);
  }
}

export async function handleAdminUpdateCategory(req: Request, res: Response) {
  try {
    const user = await authenticateToken(req);
    if (!user) {
      return error(res, "برای دسترسی به پنل مدیریت ابتدا وارد شوید.", 401);
    }
    if (user.role !== "admin" && user.role !== "staff") {
      return error(res, "شما دسترسی لازم برای انجام این عملیات را ندارید.", 403);
    }

    const id = Number(req.params.id);
    if (!id || isNaN(id)) {
      return error(res, "شناسه دسته‌بندی نامعتبر است.", 422);
    }

    const db = await getDatabase();
    const existing = db.exec(`SELECT id, slug FROM categories WHERE id = ${id}`);
    if (existing.length === 0 || existing[0].values.length === 0) {
      return error(res, "دسته‌بندی مورد نظر یافت نشد.", 404);
    }

    const { name, slug, parent_id, description, image_url, is_active, sort_order, meta_title, meta_description } = req.body;

    if (slug) {
      const duplicateSlug = db.exec(`SELECT id FROM categories WHERE slug = '${String(slug).replace(/'/g, "''")}' AND id != ${id}`);
      if (duplicateSlug.length > 0 && duplicateSlug[0].values.length > 0) {
        return error(res, "این اسلاگ قبلاً برای دسته‌بندی دیگری استفاده شده است.", 422);
      }
    }

    // Check parent loop
    if (parent_id && Number(parent_id) === id) {
      return error(res, "دسته‌بندی نمی‌تواند والد خودش باشد.", 422);
    }

    const now = new Date().toISOString();
    const updates: string[] = [];
    const params: any[] = [];

    if (name !== undefined) { updates.push("name = ?"); params.push(String(name).trim()); }
    if (slug !== undefined) { updates.push("slug = ?"); params.push(String(slug).trim()); }
    if (parent_id !== undefined) { updates.push("parent_id = ?"); params.push(parent_id ? Number(parent_id) : null); }
    if (description !== undefined) { updates.push("description = ?"); params.push(description ? String(description) : null); }
    if (image_url !== undefined) { updates.push("image_url = ?"); params.push(image_url ? String(image_url) : null); }
    if (is_active !== undefined) { updates.push("is_active = ?"); params.push(is_active ? 1 : 0); }
    if (sort_order !== undefined) { updates.push("sort_order = ?"); params.push(Number(sort_order)); }
    if (meta_title !== undefined) { updates.push("meta_title = ?"); params.push(meta_title ? String(meta_title) : null); }
    if (meta_description !== undefined) { updates.push("meta_description = ?"); params.push(meta_description ? String(meta_description) : null); }

    updates.push("updated_at = ?");
    params.push(now);

    params.push(id);
    db.run(`UPDATE categories SET ${updates.join(", ")} WHERE id = ?`, params);

    const updatedQuery = db.exec(`SELECT id, parent_id, name, slug, description, image_url, is_active, sort_order, meta_title, meta_description, created_at, updated_at FROM categories WHERE id = ${id}`);
    const cols = updatedQuery[0].columns;
    const updatedCat: Record<string, any> = {};
    updatedQuery[0].values[0].forEach((val, idx) => {
      updatedCat[cols[idx]] = val;
    });
    updatedCat.is_active = Boolean(updatedCat.is_active);

    persistDatabase();

    return success(res, updatedCat, "دسته‌بندی با موفقیت در پایگاه داده ویرایش شد.");
  } catch (err: any) {
    return error(res, err.message || "خطا در ویرایش دسته‌بندی", 500);
  }
}

export async function handleAdminDeleteCategory(req: Request, res: Response) {
  try {
    const user = await authenticateToken(req);
    if (!user) {
      return error(res, "برای دسترسی به پنل مدیریت ابتدا وارد شوید.", 401);
    }
    if (user.role !== "admin" && user.role !== "staff") {
      return error(res, "شما دسترسی لازم برای انجام این عملیات را ندارید.", 403);
    }

    const id = Number(req.params.id);
    if (!id || isNaN(id)) {
      return error(res, "شناسه دسته‌بندی نامعتبر است.", 422);
    }

    const db = await getDatabase();
    const existing = db.exec(`SELECT id FROM categories WHERE id = ${id}`);
    if (existing.length === 0 || existing[0].values.length === 0) {
      return error(res, "دسته‌بندی مورد نظر یافت نشد.", 404);
    }

    // Check if category has active children
    const children = db.exec(`SELECT id FROM categories WHERE parent_id = ${id}`);
    if (children.length > 0 && children[0].values.length > 0) {
      return error(res, "این دسته دارای زیردسته است. ابتدا زیردسته‌ها را حذف یا منتقل کنید.", 422);
    }

    db.run(`DELETE FROM categories WHERE id = ?`, [id]);
    persistDatabase();

    return success(res, null, "دسته‌بندی با موفقیت از پایگاه داده حذف گردید.");
  } catch (err: any) {
    return error(res, err.message || "خطا در حذف دسته‌بندی", 500);
  }
}
