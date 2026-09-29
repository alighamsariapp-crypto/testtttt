import { Request, Response } from "express";
import crypto from "crypto";
import { authenticateToken } from "./authRoutes";
import { getDatabase, persistDatabase, queryRows } from "./db";

// Helper responses matching Laravel ApiResponseHelper format
function success(res: Response, data: unknown, message = "عملیات با موفقیت انجام شد.", status = 200) {
  return res.status(status).json({ success: true, data, message });
}

function error(res: Response, message = "خطایی رخ داد.", status = 400, errors?: unknown, error_code?: string) {
  return res.status(status).json({ success: false, message, errors: errors || { general: [message] }, error_code });
}

async function requireAdmin(req: Request, res: Response): Promise<any | null> {
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
}

function parseJsonField(val: unknown, fallback: any = []) {
  if (!val) return fallback;
  if (typeof val === "object") return val;
  try {
    return JSON.parse(val as string);
  } catch {
    return fallback;
  }
}

function formatCatalogRow(row: any) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    category: row.category || "خدمات آنلاین",
    service_category_id: row.service_category_id || null,
    short_description: row.short_description || "",
    description: row.description || "",
    estimated_base_price: row.estimated_base_price ?? null,
    currency: row.currency || "IRR",
    icon: row.icon || null,
    image_url: row.image_url || null,
    is_active: Boolean(row.is_active),
    required_fields: parseJsonField(row.required_fields, []),
    meta_title: row.meta_title || null,
    meta_description: row.meta_description || null,
    documents: parseJsonField(row.documents, []),
    steps: parseJsonField(row.steps, []),
    faq: parseJsonField(row.faq, []),
    contact_type: row.contact_type || null,
    contact_url: row.contact_url || null,
    cta_label: row.cta_label || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    serviceCategory: row.service_category_id && row.cat_name
      ? {
          id: row.service_category_id,
          name: row.cat_name,
          slug: row.cat_slug,
          is_active: Boolean(row.cat_is_active),
          sort_order: row.cat_sort_order ?? 0,
        }
      : null,
  };
}

// -------------------------------------------------------------
// PUBLIC ENDPOINTS
// -------------------------------------------------------------

export async function handleGetServices(_req: Request, res: Response) {
  try {
    const db = await getDatabase();
    const rows = queryRows(
      db,
      `SELECT c.*,
              cat.id as cat_id, cat.name as cat_name, cat.slug as cat_slug,
              cat.is_active as cat_is_active, cat.sort_order as cat_sort_order
       FROM service_catalogs c
       LEFT JOIN service_categories cat ON c.service_category_id = cat.id
       WHERE c.is_active = 1 AND (c.service_category_id IS NULL OR cat.is_active = 1)
       ORDER BY c.id ASC`
    );

    const services = rows.map(formatCatalogRow);
    return success(res, services, "Active services catalog retrieved.");
  } catch (err: any) {
    return error(res, err.message || "خطا در دریافت خدمات", 500);
  }
}

export async function handleGetServiceCategories(_req: Request, res: Response) {
  try {
    const db = await getDatabase();
    const rows = queryRows(
      db,
      `SELECT cat.*,
              (SELECT COUNT(*) FROM service_catalogs sc WHERE sc.service_category_id = cat.id AND sc.is_active = 1) as services_count
       FROM service_categories cat
       WHERE cat.is_active = 1 AND (SELECT COUNT(*) FROM service_catalogs sc WHERE sc.service_category_id = cat.id AND sc.is_active = 1) > 0
       ORDER BY cat.sort_order ASC, cat.name ASC`
    );

    const categories = rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      description: r.description || null,
      is_active: Boolean(r.is_active),
      sort_order: r.sort_order ?? 0,
      services_count: Number(r.services_count) || 0,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));

    return success(res, categories, "Active service categories retrieved.");
  } catch (err: any) {
    return error(res, err.message || "خطا در دریافت دسته‌بندی خدمات", 500);
  }
}

export async function handleGetServiceBySlug(req: Request, res: Response) {
  try {
    const { slug } = req.params;
    if (!slug) {
      return error(res, "Slug is required.", 400);
    }

    const db = await getDatabase();
    const rows = queryRows(
      db,
      `SELECT c.*,
              cat.id as cat_id, cat.name as cat_name, cat.slug as cat_slug,
              cat.is_active as cat_is_active, cat.sort_order as cat_sort_order
       FROM service_catalogs c
       LEFT JOIN service_categories cat ON c.service_category_id = cat.id
       WHERE c.slug = ? AND c.is_active = 1 AND (c.service_category_id IS NULL OR cat.is_active = 1)
       LIMIT 1`,
      [slug]
    );

    if (rows.length === 0) {
      return error(res, `Service '${slug}' not found.`, 404);
    }

    return success(res, formatCatalogRow(rows[0]), "Service details retrieved.");
  } catch (err: any) {
    return error(res, err.message || "خطا در دریافت جزئیات خدمت", 500);
  }
}

// -------------------------------------------------------------
// CUSTOMER ENDPOINTS (AUTHENTICATED)
// -------------------------------------------------------------

export async function handleGetCustomerServiceRequests(req: Request, res: Response) {
  try {
    const user = await authenticateToken(req);
    if (!user) {
      return error(res, "Unauthenticated.", 401);
    }

    const perPage = Math.min(Math.max(parseInt(req.query.per_page as string, 10) || 15, 1), 50);
    const page = Math.max(parseInt(req.query.page as string, 10) || 1, 1);
    const offset = (page - 1) * perPage;

    const db = await getDatabase();

    const countRows = queryRows(
      db,
      "SELECT COUNT(*) as total FROM service_requests WHERE user_id = ?",
      [user.id]
    );
    const total = Number(countRows[0]?.total) || 0;

    const rows = queryRows(
      db,
      `SELECT sr.*,
              sc.name as catalog_name, sc.slug as catalog_slug, sc.category as catalog_category,
              sc.short_description as catalog_short_description
       FROM service_requests sr
       LEFT JOIN service_catalogs sc ON sr.service_catalog_id = sc.id
       WHERE sr.user_id = ?
       ORDER BY sr.created_at DESC
       LIMIT ? OFFSET ?`,
      [user.id, perPage, offset]
    );

    const data = rows.map((r) => {
      const quotes = queryRows(
        db,
        "SELECT * FROM service_quotes WHERE service_request_id = ? ORDER BY id ASC",
        [r.id]
      );
      const timelines = queryRows(
        db,
        "SELECT * FROM service_timelines WHERE service_request_id = ? ORDER BY id ASC",
        [r.id]
      );

      return {
        id: r.id,
        request_number: r.request_number,
        user_id: r.user_id,
        service_catalog_id: r.service_catalog_id,
        title: r.title,
        requirements: r.requirements,
        status: r.status,
        assigned_staff_id: r.assigned_staff_id,
        custom_attributes: parseJsonField(r.custom_attributes, null),
        attachments: parseJsonField(r.attachments, null),
        created_at: r.created_at,
        updated_at: r.updated_at,
        catalog: r.service_catalog_id
          ? {
              id: r.service_catalog_id,
              name: r.catalog_name,
              slug: r.catalog_slug,
              category: r.catalog_category,
              short_description: r.catalog_short_description,
            }
          : null,
        quotes: quotes.map((q) => ({
          id: q.id,
          service_request_id: q.service_request_id,
          amount: q.amount,
          currency: q.currency,
          scope_of_work: q.scope_of_work,
          terms: q.terms,
          valid_until: q.valid_until,
          status: q.status,
          responded_at: q.responded_at,
          created_at: q.created_at,
        })),
        timelines: timelines.map((t) => ({
          id: t.id,
          service_request_id: t.service_request_id,
          title: t.title,
          description: t.description,
          status: t.status,
          due_date: t.due_date,
          completed_at: t.completed_at,
          created_at: t.created_at,
        })),
      };
    });

    return success(
      res,
      {
        data,
        current_page: page,
        per_page: perPage,
        total,
        last_page: Math.ceil(total / perPage) || 1,
      },
      "Customer service requests retrieved."
    );
  } catch (err: any) {
    return error(res, err.message || "خطا در دریافت درخواست‌های خدمات", 500);
  }
}

export async function handleCreateCustomerServiceRequest(req: Request, res: Response) {
  try {
    const user = await authenticateToken(req);
    if (!user) {
      return error(res, "Unauthenticated.", 401);
    }

    const { service_catalog_id, title, requirements, custom_attributes, attachments } = req.body;

    if (!title || !title.trim()) {
      return error(res, "عنوان درخواست الزامی است.", 422, { title: ["عنوان درخواست الزامی است."] });
    }
    if (!requirements || !requirements.trim()) {
      return error(res, "شرح نیازمندی‌ها الزامی است.", 422, { requirements: ["شرح نیازمندی‌ها الزامی است."] });
    }

    const db = await getDatabase();

    if (service_catalog_id) {
      const catalogCheck = queryRows(db, "SELECT id, name FROM service_catalogs WHERE id = ?", [service_catalog_id]);
      if (catalogCheck.length === 0) {
        return error(res, "خدمت مورد نظر یافت نشد.", 422, { service_catalog_id: ["خدمت مورد نظر یافت نشد."] });
      }
    }

    // Generate unique request number: SRV-YYYYMMDD-XXXXXX
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    let requestNumber = "";
    let exists = true;
    while (exists) {
      const rand = crypto.randomBytes(3).toString("hex").toUpperCase();
      requestNumber = `SRV-${dateStr}-${rand}`;
      const check = queryRows(db, "SELECT id FROM service_requests WHERE request_number = ?", [requestNumber]);
      if (check.length === 0) {
        exists = false;
      }
    }

    const now = new Date().toISOString();
    db.run(
      `INSERT INTO service_requests (
        request_number, user_id, service_catalog_id, title, requirements, status,
        custom_attributes, attachments, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'submitted', ?, ?, ?, ?)`,
      [
        requestNumber,
        user.id,
        service_catalog_id || null,
        title.trim(),
        requirements.trim(),
        custom_attributes ? JSON.stringify(custom_attributes) : null,
        attachments ? JSON.stringify(attachments) : null,
        now,
        now,
      ]
    );

    const inserted = queryRows(db, "SELECT id FROM service_requests WHERE request_number = ?", [requestNumber]);
    const newRequestId = inserted[0]?.id;

    // Create initial timeline step
    db.run(
      `INSERT INTO service_timelines (service_request_id, title, description, status, completed_at, created_at, updated_at)
       VALUES (?, 'ثبت درخواست', 'درخواست با موفقیت ثبت شد و در انتظار بررسی کارشناسان است.', 'completed', ?, ?, ?)`,
      [newRequestId, now, now, now]
    );

    persistDatabase();

    const catalogRow = service_catalog_id
      ? queryRows(db, "SELECT id, name, slug, category, short_description FROM service_catalogs WHERE id = ?", [service_catalog_id])[0]
      : null;

    const responseData = {
      id: newRequestId,
      request_number: requestNumber,
      user_id: user.id,
      service_catalog_id: service_catalog_id || null,
      title: title.trim(),
      requirements: requirements.trim(),
      status: "submitted",
      assigned_staff_id: null,
      custom_attributes: custom_attributes || null,
      attachments: attachments || null,
      created_at: now,
      updated_at: now,
      catalog: catalogRow,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    };

    return success(res, responseData, "Service request submitted successfully.", 201);
  } catch (err: any) {
    return error(res, err.message || "خطا در ثبت درخواست خدمت", 500);
  }
}

export async function handleGetCustomerServiceRequest(req: Request, res: Response) {
  try {
    const user = await authenticateToken(req);
    if (!user) {
      return error(res, "Unauthenticated.", 401);
    }

    const { requestIdOrNumber } = req.params;
    if (!requestIdOrNumber) {
      return error(res, "شناسه یا شماره درخواست الزامی است.", 400);
    }

    const db = await getDatabase();
    const isNum = /^\d+$/.test(requestIdOrNumber);

    const rows = isNum
      ? queryRows(
          db,
          `SELECT sr.*,
                  sc.name as catalog_name, sc.slug as catalog_slug, sc.category as catalog_category,
                  sc.short_description as catalog_short_description
           FROM service_requests sr
           LEFT JOIN service_catalogs sc ON sr.service_catalog_id = sc.id
           WHERE sr.id = ?`,
          [parseInt(requestIdOrNumber, 10)]
        )
      : queryRows(
          db,
          `SELECT sr.*,
                  sc.name as catalog_name, sc.slug as catalog_slug, sc.category as catalog_category,
                  sc.short_description as catalog_short_description
           FROM service_requests sr
           LEFT JOIN service_catalogs sc ON sr.service_catalog_id = sc.id
           WHERE sr.request_number = ?`,
          [requestIdOrNumber]
        );

    // Strict customer ownership isolation
    if (rows.length === 0 || rows[0].user_id !== user.id) {
      return error(res, "Service request not found or access is denied.", 404);
    }

    const r = rows[0];
    const quotes = queryRows(
      db,
      "SELECT * FROM service_quotes WHERE service_request_id = ? ORDER BY id ASC",
      [r.id]
    );
    const timelines = queryRows(
      db,
      "SELECT * FROM service_timelines WHERE service_request_id = ? ORDER BY id ASC",
      [r.id]
    );

    const data = {
      id: r.id,
      request_number: r.request_number,
      user_id: r.user_id,
      service_catalog_id: r.service_catalog_id,
      title: r.title,
      requirements: r.requirements,
      status: r.status,
      assigned_staff_id: r.assigned_staff_id,
      custom_attributes: parseJsonField(r.custom_attributes, null),
      attachments: parseJsonField(r.attachments, null),
      created_at: r.created_at,
      updated_at: r.updated_at,
      catalog: r.service_catalog_id
        ? {
            id: r.service_catalog_id,
            name: r.catalog_name,
            slug: r.catalog_slug,
            category: r.catalog_category,
            short_description: r.catalog_short_description,
          }
        : null,
      quotes: quotes.map((q) => ({
        id: q.id,
        service_request_id: q.service_request_id,
        amount: q.amount,
        currency: q.currency,
        scope_of_work: q.scope_of_work,
        terms: q.terms,
        valid_until: q.valid_until,
        status: q.status,
        responded_at: q.responded_at,
        created_at: q.created_at,
      })),
      timelines: timelines.map((t) => ({
        id: t.id,
        service_request_id: t.service_request_id,
        title: t.title,
        description: t.description,
        status: t.status,
        due_date: t.due_date,
        completed_at: t.completed_at,
        created_at: t.created_at,
      })),
    };

    return success(res, data, "Service request details retrieved.");
  } catch (err: any) {
    return error(res, err.message || "خطا در دریافت جزئیات درخواست خدمت", 500);
  }
}

export async function handleRespondToServiceQuote(req: Request, res: Response) {
  try {
    const user = await authenticateToken(req);
    if (!user) {
      return error(res, "Unauthenticated.", 401);
    }

    const quoteId = parseInt(req.params.quoteId, 10);
    const { action } = req.body;

    if (action !== "accept" && action !== "reject") {
      return error(res, `Invalid action: ${action}. Must be 'accept' or 'reject'.`, 400, null, "INVALID_ACTION");
    }

    const db = await getDatabase();
    const quoteRows = queryRows(db, "SELECT * FROM service_quotes WHERE id = ?", [quoteId]);
    if (quoteRows.length === 0) {
      return error(res, "Service quote not found or access is denied.", 404);
    }

    const quote = quoteRows[0];
    const requestRows = queryRows(db, "SELECT * FROM service_requests WHERE id = ?", [quote.service_request_id]);
    if (requestRows.length === 0 || requestRows[0].user_id !== user.id) {
      return error(res, "Service quote not found or access is denied.", 404);
    }

    if (quote.status !== "pending") {
      return error(res, "Quote has already been responded to or expired.", 400, null, "INVALID_QUOTE_STATUS");
    }

    const now = new Date().toISOString();

    if (action === "accept") {
      db.run(
        "UPDATE service_quotes SET status = 'accepted', responded_at = ?, updated_at = ? WHERE id = ?",
        [now, now, quoteId]
      );
      db.run(
        "UPDATE service_requests SET status = 'customer_accepted', updated_at = ? WHERE id = ?",
        [now, quote.service_request_id]
      );
      db.run(
        `INSERT INTO service_timelines (service_request_id, title, description, status, completed_at, created_at, updated_at)
         VALUES (?, 'تأیید پیش‌فاکتور', 'پیش‌فاکتور توسط مشتری پذیرفته شد و سفارش آماده ورود به فاز اجرایی است.', 'completed', ?, ?, ?)`,
        [quote.service_request_id, now, now, now]
      );
    } else {
      db.run(
        "UPDATE service_quotes SET status = 'rejected', responded_at = ?, updated_at = ? WHERE id = ?",
        [now, now, quoteId]
      );
      db.run(
        "UPDATE service_requests SET status = 'reviewing', updated_at = ? WHERE id = ?",
        [now, quote.service_request_id]
      );
      db.run(
        `INSERT INTO service_timelines (service_request_id, title, description, status, completed_at, created_at, updated_at)
         VALUES (?, 'رد پیش‌فاکتور', 'پیش‌فاکتور توسط مشتری رد شد و برای بازبینی شرایط به کارشناسان ارجاع یافت.', 'completed', ?, ?, ?)`,
        [quote.service_request_id, now, now, now]
      );
    }

    persistDatabase();

    const updatedQuoteRows = queryRows(db, "SELECT * FROM service_quotes WHERE id = ?", [quoteId]);
    const updatedQuote = updatedQuoteRows[0];

    return success(res, updatedQuote, `Quote successfully ${updatedQuote.status}.`);
  } catch (err: any) {
    return error(res, err.message || "خطا در ثبت پاسخ پیش‌فاکتور", 500);
  }
}

// -------------------------------------------------------------
// ADMIN ENDPOINTS (CATEGORIES & CATALOG)
// -------------------------------------------------------------

export async function handleAdminGetServicesCategories(req: Request, res: Response) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  try {
    const db = await getDatabase();
    const rows = queryRows(
      db,
      `SELECT cat.*,
              (SELECT COUNT(*) FROM service_catalogs sc WHERE sc.service_category_id = cat.id) as services_count
       FROM service_categories cat
       ORDER BY cat.sort_order ASC, cat.name ASC`
    );

    const categories = rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      description: r.description || null,
      is_active: Boolean(r.is_active),
      sort_order: r.sort_order ?? 0,
      services_count: Number(r.services_count) || 0,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));

    return success(res, categories, "دسته‌بندی خدمات دریافت شد.");
  } catch (err: any) {
    return error(res, err.message || "خطا در دریافت دسته‌بندی‌های خدمات", 500);
  }
}

export async function handleAdminCreateServiceCategory(req: Request, res: Response) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  try {
    const { name, slug, description, is_active, sort_order } = req.body;
    if (!name || !name.trim()) {
      return error(res, "نام دسته الزامی است.", 422, { name: ["نام دسته الزامی است."] });
    }

    const cleanName = name.trim();
    const cleanSlug = (slug && slug.trim())
      ? slug.trim().toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]+/g, "-")
      : cleanName.toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]+/g, "-");

    const db = await getDatabase();

    const nameExists = queryRows(db, "SELECT id FROM service_categories WHERE name = ?", [cleanName]);
    if (nameExists.length > 0) {
      return error(res, "دسته‌ای با این نام قبلاً ثبت شده است.", 422, { name: ["این نام تکراری است."] });
    }

    const slugExists = queryRows(db, "SELECT id FROM service_categories WHERE slug = ?", [cleanSlug]);
    if (slugExists.length > 0) {
      return error(res, "دسته‌ای با این اسلاگ قبلاً ثبت شده است.", 422, { slug: ["این اسلاگ تکراری است."] });
    }

    const now = new Date().toISOString();
    db.run(
      `INSERT INTO service_categories (name, slug, description, is_active, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        cleanName,
        cleanSlug,
        description ? description.trim() : null,
        is_active === false || is_active === 0 ? 0 : 1,
        Number(sort_order) || 0,
        now,
        now,
      ]
    );

    persistDatabase();

    const createdRows = queryRows(db, "SELECT * FROM service_categories WHERE slug = ?", [cleanSlug]);
    const created = createdRows[0];

    return success(
      res,
      {
        id: created.id,
        name: created.name,
        slug: created.slug,
        description: created.description,
        is_active: Boolean(created.is_active),
        sort_order: created.sort_order,
        services_count: 0,
        created_at: created.created_at,
        updated_at: created.updated_at,
      },
      "دستهٔ خدمات ایجاد شد.",
      201
    );
  } catch (err: any) {
    return error(res, err.message || "خطا در ایجاد دسته خدمات", 500);
  }
}

export async function handleAdminUpdateServiceCategory(req: Request, res: Response) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  try {
    const id = parseInt(req.params.id || req.params.serviceCategory, 10);
    const { name, slug, description, is_active, sort_order } = req.body;

    const db = await getDatabase();
    const existingRows = queryRows(db, "SELECT * FROM service_categories WHERE id = ?", [id]);
    if (existingRows.length === 0) {
      return error(res, "دستهٔ خدمات یافت نشد.", 404);
    }

    const cleanName = name ? name.trim() : existingRows[0].name;
    const cleanSlug = slug
      ? slug.trim().toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]+/g, "-")
      : existingRows[0].slug;

    if (cleanName !== existingRows[0].name) {
      const nameCheck = queryRows(db, "SELECT id FROM service_categories WHERE name = ? AND id != ?", [cleanName, id]);
      if (nameCheck.length > 0) {
        return error(res, "دسته‌ای با این نام قبلاً ثبت شده است.", 422, { name: ["این نام تکراری است."] });
      }
    }

    if (cleanSlug !== existingRows[0].slug) {
      const slugCheck = queryRows(db, "SELECT id FROM service_categories WHERE slug = ? AND id != ?", [cleanSlug, id]);
      if (slugCheck.length > 0) {
        return error(res, "دسته‌ای با این اسلاگ قبلاً ثبت شده است.", 422, { slug: ["این اسلاگ تکراری است."] });
      }
    }

    const now = new Date().toISOString();
    db.run(
      `UPDATE service_categories
       SET name = ?, slug = ?, description = ?, is_active = ?, sort_order = ?, updated_at = ?
       WHERE id = ?`,
      [
        cleanName,
        cleanSlug,
        description !== undefined ? (description ? description.trim() : null) : existingRows[0].description,
        is_active !== undefined ? (is_active ? 1 : 0) : existingRows[0].is_active,
        sort_order !== undefined ? Number(sort_order) : existingRows[0].sort_order,
        now,
        id,
      ]
    );

    // Keep denormalized category title in sync on linked service_catalogs
    db.run("UPDATE service_catalogs SET category = ?, updated_at = ? WHERE service_category_id = ?", [
      cleanName,
      now,
      id,
    ]);

    persistDatabase();

    const updatedRows = queryRows(
      db,
      `SELECT cat.*,
              (SELECT COUNT(*) FROM service_catalogs sc WHERE sc.service_category_id = cat.id) as services_count
       FROM service_categories cat
       WHERE cat.id = ?`,
      [id]
    );
    const updated = updatedRows[0];

    return success(
      res,
      {
        id: updated.id,
        name: updated.name,
        slug: updated.slug,
        description: updated.description,
        is_active: Boolean(updated.is_active),
        sort_order: updated.sort_order,
        services_count: Number(updated.services_count) || 0,
        created_at: updated.created_at,
        updated_at: updated.updated_at,
      },
      "دستهٔ خدمات ویرایش شد."
    );
  } catch (err: any) {
    return error(res, err.message || "خطا در ویرایش دسته خدمات", 500);
  }
}

export async function handleAdminDeleteServiceCategory(req: Request, res: Response) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  try {
    const id = parseInt(req.params.id || req.params.serviceCategory, 10);
    const db = await getDatabase();

    const existing = queryRows(db, "SELECT * FROM service_categories WHERE id = ?", [id]);
    if (existing.length === 0) {
      return error(res, "دستهٔ خدمات یافت نشد.", 404);
    }

    const linkedServices = queryRows(
      db,
      "SELECT COUNT(*) as count FROM service_catalogs WHERE service_category_id = ?",
      [id]
    );
    if ((Number(linkedServices[0]?.count) || 0) > 0) {
      return error(res, "این دسته دارای خدمت است. ابتدا خدمت‌ها را به دستهٔ دیگری منتقل یا غیرفعال کنید.", 422);
    }

    db.run("DELETE FROM service_categories WHERE id = ?", [id]);
    persistDatabase();

    return success(res, null, "دستهٔ خدمات حذف شد.");
  } catch (err: any) {
    return error(res, err.message || "خطا در حذف دسته خدمات", 500);
  }
}

export async function handleAdminGetServicesCatalog(req: Request, res: Response) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  try {
    const db = await getDatabase();
    const rows = queryRows(
      db,
      `SELECT c.*,
              cat.id as cat_id, cat.name as cat_name, cat.slug as cat_slug,
              cat.is_active as cat_is_active, cat.sort_order as cat_sort_order
       FROM service_catalogs c
       LEFT JOIN service_categories cat ON c.service_category_id = cat.id
       ORDER BY c.updated_at DESC`
    );

    const catalog = rows.map(formatCatalogRow);
    return success(res, catalog, "کاتالوگ خدمات دریافت شد.");
  } catch (err: any) {
    return error(res, err.message || "خطا در دریافت کاتالوگ خدمات", 500);
  }
}

export async function handleAdminCreateServiceCatalog(req: Request, res: Response) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  try {
    const {
      name,
      slug,
      service_category_id,
      short_description,
      description,
      estimated_base_price,
      currency,
      icon,
      image_url,
      is_active,
      required_fields,
      documents,
      steps,
      faq,
      contact_type,
      contact_url,
      cta_label,
    } = req.body;

    if (!name || !name.trim()) {
      return error(res, "عنوان خدمت الزامی است.", 422, { name: ["عنوان خدمت الزامی است."] });
    }

    const cleanName = name.trim();
    const cleanSlug = (slug && slug.trim())
      ? slug.trim().toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]+/g, "-")
      : cleanName.toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]+/g, "-");

    const db = await getDatabase();

    const slugCheck = queryRows(db, "SELECT id FROM service_catalogs WHERE slug = ?", [cleanSlug]);
    if (slugCheck.length > 0) {
      return error(res, "خدمتی با این شناسهٔ آدرس (اسلاگ) قبلاً ثبت شده است.", 422, { slug: ["اسلاگ تکراری است."] });
    }

    let categoryTitle = "خدمات آنلاین";
    let categoryId: number | null = null;

    if (service_category_id) {
      const catCheck = queryRows(db, "SELECT id, name FROM service_categories WHERE id = ?", [service_category_id]);
      if (catCheck.length > 0) {
        categoryId = catCheck[0].id;
        categoryTitle = catCheck[0].name;
      }
    }

    const now = new Date().toISOString();
    db.run(
      `INSERT INTO service_catalogs (
        name, slug, category, service_category_id, short_description, description,
        estimated_base_price, currency, icon, image_url, is_active, required_fields,
        documents, steps, faq, contact_type, contact_url, cta_label, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        cleanName,
        cleanSlug,
        categoryTitle,
        categoryId,
        short_description ? short_description.trim() : "",
        description ? description.trim() : "",
        estimated_base_price !== undefined && estimated_base_price !== null ? Number(estimated_base_price) : null,
        currency || "IRR",
        icon || null,
        image_url || null,
        is_active === false || is_active === 0 ? 0 : 1,
        required_fields ? JSON.stringify(required_fields) : null,
        documents ? JSON.stringify(documents) : null,
        steps ? JSON.stringify(steps) : null,
        faq ? JSON.stringify(faq) : null,
        contact_type || null,
        contact_url || null,
        cta_label || null,
        now,
        now,
      ]
    );

    persistDatabase();

    const createdRows = queryRows(
      db,
      `SELECT c.*,
              cat.id as cat_id, cat.name as cat_name, cat.slug as cat_slug,
              cat.is_active as cat_is_active, cat.sort_order as cat_sort_order
       FROM service_catalogs c
       LEFT JOIN service_categories cat ON c.service_category_id = cat.id
       WHERE c.slug = ?`,
      [cleanSlug]
    );

    return success(res, formatCatalogRow(createdRows[0]), "خدمت آنلاین با موفقیت ایجاد شد.", 201);
  } catch (err: any) {
    return error(res, err.message || "خطا در ایجاد خدمت آنلاین", 500);
  }
}

export async function handleAdminUpdateServiceCatalog(req: Request, res: Response) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  try {
    const id = parseInt(req.params.id || req.params.service, 10);
    const db = await getDatabase();

    const existingRows = queryRows(db, "SELECT * FROM service_catalogs WHERE id = ?", [id]);
    if (existingRows.length === 0) {
      return error(res, "خدمت آنلاین یافت نشد.", 404);
    }

    const existing = existingRows[0];
    const {
      name,
      slug,
      service_category_id,
      short_description,
      description,
      estimated_base_price,
      currency,
      icon,
      image_url,
      is_active,
      required_fields,
      documents,
      steps,
      faq,
      contact_type,
      contact_url,
      cta_label,
    } = req.body;

    const cleanName = name ? name.trim() : existing.name;
    const cleanSlug = slug
      ? slug.trim().toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]+/g, "-")
      : existing.slug;

    if (cleanSlug !== existing.slug) {
      const slugCheck = queryRows(db, "SELECT id FROM service_catalogs WHERE slug = ? AND id != ?", [cleanSlug, id]);
      if (slugCheck.length > 0) {
        return error(res, "خدمتی با این شناسهٔ آدرس (اسلاگ) قبلاً ثبت شده است.", 422, { slug: ["اسلاگ تکراری است."] });
      }
    }

    let categoryTitle = existing.category;
    let categoryId = existing.service_category_id;

    if (service_category_id !== undefined) {
      if (service_category_id) {
        const catCheck = queryRows(db, "SELECT id, name FROM service_categories WHERE id = ?", [service_category_id]);
        if (catCheck.length > 0) {
          categoryId = catCheck[0].id;
          categoryTitle = catCheck[0].name;
        }
      } else {
        categoryId = null;
        categoryTitle = "خدمات آنلاین";
      }
    }

    const now = new Date().toISOString();
    db.run(
      `UPDATE service_catalogs
       SET name = ?, slug = ?, category = ?, service_category_id = ?, short_description = ?,
           description = ?, estimated_base_price = ?, currency = ?, icon = ?, image_url = ?,
           is_active = ?, required_fields = ?, documents = ?, steps = ?, faq = ?,
           contact_type = ?, contact_url = ?, cta_label = ?, updated_at = ?
       WHERE id = ?`,
      [
        cleanName,
        cleanSlug,
        categoryTitle,
        categoryId,
        short_description !== undefined ? (short_description ? short_description.trim() : "") : existing.short_description,
        description !== undefined ? (description ? description.trim() : "") : existing.description,
        estimated_base_price !== undefined ? (estimated_base_price !== null ? Number(estimated_base_price) : null) : existing.estimated_base_price,
        currency !== undefined ? currency : existing.currency,
        icon !== undefined ? icon : existing.icon,
        image_url !== undefined ? image_url : existing.image_url,
        is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
        required_fields !== undefined ? JSON.stringify(required_fields) : existing.required_fields,
        documents !== undefined ? JSON.stringify(documents) : existing.documents,
        steps !== undefined ? JSON.stringify(steps) : existing.steps,
        faq !== undefined ? JSON.stringify(faq) : existing.faq,
        contact_type !== undefined ? contact_type : existing.contact_type,
        contact_url !== undefined ? contact_url : existing.contact_url,
        cta_label !== undefined ? cta_label : existing.cta_label,
        now,
        id,
      ]
    );

    persistDatabase();

    const updatedRows = queryRows(
      db,
      `SELECT c.*,
              cat.id as cat_id, cat.name as cat_name, cat.slug as cat_slug,
              cat.is_active as cat_is_active, cat.sort_order as cat_sort_order
       FROM service_catalogs c
       LEFT JOIN service_categories cat ON c.service_category_id = cat.id
       WHERE c.id = ?`,
      [id]
    );

    return success(res, formatCatalogRow(updatedRows[0]), "خدمت آنلاین ویرایش شد.");
  } catch (err: any) {
    return error(res, err.message || "خطا در ویرایش خدمت آنلاین", 500);
  }
}

export async function handleAdminDeleteServiceCatalog(req: Request, res: Response) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  try {
    const id = parseInt(req.params.id || req.params.service, 10);
    const db = await getDatabase();

    const existing = queryRows(db, "SELECT * FROM service_catalogs WHERE id = ?", [id]);
    if (existing.length === 0) {
      return error(res, "خدمت آنلاین یافت نشد.", 404);
    }

    const linkedRequests = queryRows(
      db,
      "SELECT COUNT(*) as count FROM service_requests WHERE service_catalog_id = ?",
      [id]
    );
    if ((Number(linkedRequests[0]?.count) || 0) > 0) {
      return error(res, "این خدمت درخواست ثبت‌شده دارد؛ آن را غیرفعال کنید و حذف نکنید.", 422);
    }

    db.run("DELETE FROM service_catalogs WHERE id = ?", [id]);
    persistDatabase();

    return success(res, null, "خدمت با موفقیت حذف شد.");
  } catch (err: any) {
    return error(res, err.message || "خطا در حذف خدمت آنلاین", 500);
  }
}

// -------------------------------------------------------------
// ADMIN SERVICE REQUESTS & QUOTES
// -------------------------------------------------------------

export async function handleAdminGetServiceRequests(req: Request, res: Response) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  try {
    const status = req.query.status as string | undefined;
    const perPage = Math.min(Math.max(parseInt(req.query.per_page as string, 10) || 20, 1), 100);
    const page = Math.max(parseInt(req.query.page as string, 10) || 1, 1);
    const offset = (page - 1) * perPage;

    const db = await getDatabase();

    let countSql = "SELECT COUNT(*) as total FROM service_requests";
    const countParams: any[] = [];
    if (status) {
      countSql += " WHERE status = ?";
      countParams.push(status);
    }

    const countRows = queryRows(db, countSql, countParams);
    const total = Number(countRows[0]?.total) || 0;

    let querySql = `
      SELECT sr.*,
             u.name as user_name, u.email as user_email, u.phone as user_phone,
             sc.name as catalog_name, sc.slug as catalog_slug, sc.category as catalog_category,
             staff.name as staff_name
      FROM service_requests sr
      JOIN users u ON sr.user_id = u.id
      LEFT JOIN service_catalogs sc ON sr.service_catalog_id = sc.id
      LEFT JOIN users staff ON sr.assigned_staff_id = staff.id
    `;
    const queryParams: any[] = [];
    if (status) {
      querySql += " WHERE sr.status = ?";
      queryParams.push(status);
    }
    querySql += " ORDER BY sr.created_at DESC LIMIT ? OFFSET ?";
    queryParams.push(perPage, offset);

    const rows = queryRows(db, querySql, queryParams);

    const data = rows.map((r) => {
      const quotes = queryRows(
        db,
        "SELECT * FROM service_quotes WHERE service_request_id = ? ORDER BY id ASC",
        [r.id]
      );
      const timelines = queryRows(
        db,
        "SELECT * FROM service_timelines WHERE service_request_id = ? ORDER BY id ASC",
        [r.id]
      );

      return {
        id: r.id,
        request_number: r.request_number,
        user_id: r.user_id,
        service_catalog_id: r.service_catalog_id,
        title: r.title,
        requirements: r.requirements,
        status: r.status,
        assigned_staff_id: r.assigned_staff_id,
        assigned_staff_name: r.staff_name || null,
        custom_attributes: parseJsonField(r.custom_attributes, null),
        attachments: parseJsonField(r.attachments, null),
        created_at: r.created_at,
        updated_at: r.updated_at,
        user: {
          id: r.user_id,
          name: r.user_name,
          email: r.user_email,
          phone: r.user_phone,
        },
        catalog: r.service_catalog_id
          ? {
              id: r.service_catalog_id,
              name: r.catalog_name,
              slug: r.catalog_slug,
              category: r.catalog_category,
            }
          : null,
        quotes: quotes.map((q) => ({
          id: q.id,
          service_request_id: q.service_request_id,
          amount: q.amount,
          currency: q.currency,
          scope_of_work: q.scope_of_work,
          terms: q.terms,
          valid_until: q.valid_until,
          status: q.status,
          responded_at: q.responded_at,
          created_by_staff_id: q.created_by_staff_id,
          created_at: q.created_at,
        })),
        timelines: timelines.map((t) => ({
          id: t.id,
          service_request_id: t.service_request_id,
          title: t.title,
          description: t.description,
          status: t.status,
          due_date: t.due_date,
          completed_at: t.completed_at,
          created_at: t.created_at,
        })),
      };
    });

    return success(
      res,
      {
        data,
        current_page: page,
        per_page: perPage,
        total,
        last_page: Math.ceil(total / perPage) || 1,
      },
      "فهرست درخواست‌های خدمات دریافت شد."
    );
  } catch (err: any) {
    return error(res, err.message || "خطا در دریافت درخواست‌های خدمات", 500);
  }
}

export async function handleAdminCreateQuote(req: Request, res: Response) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  try {
    const requestId = parseInt(req.params.id, 10);
    const { amount, currency, scope_of_work, terms, valid_until } = req.body;

    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return error(res, "مبلغ پیش‌فاکتور باید عدد مثبت باشد.", 422, { amount: ["مبلغ نامعتبر است."] });
    }

    const db = await getDatabase();
    const requestRows = queryRows(db, "SELECT * FROM service_requests WHERE id = ?", [requestId]);
    if (requestRows.length === 0) {
      return error(res, "درخواست خدمات یافت نشد.", 404);
    }

    const now = new Date().toISOString();
    db.run(
      `INSERT INTO service_quotes (
        service_request_id, amount, currency, scope_of_work, terms, valid_until,
        status, created_by_staff_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
      [
        requestId,
        Math.round(Number(amount)),
        currency || "IRR",
        scope_of_work ? scope_of_work.trim() : null,
        terms ? terms.trim() : null,
        valid_until || null,
        user.id,
        now,
        now,
      ]
    );

    // Transition request status to 'quoted'
    db.run(
      "UPDATE service_requests SET status = 'quoted', updated_at = ? WHERE id = ?",
      [now, requestId]
    );

    // Add timeline entry
    const formattedAmount = Number(amount).toLocaleString("fa-IR");
    db.run(
      `INSERT INTO service_timelines (service_request_id, title, description, status, completed_at, created_at, updated_at)
       VALUES (?, 'صدور پیش‌فاکتور', ?, 'completed', ?, ?, ?)`,
      [
        requestId,
        `پیش‌فاکتور رسمی به مبلغ ${formattedAmount} ریال برای مشتری صادر شد.`,
        now,
        now,
        now,
      ]
    );

    persistDatabase();

    const createdRows = queryRows(
      db,
      "SELECT * FROM service_quotes WHERE service_request_id = ? ORDER BY id DESC LIMIT 1",
      [requestId]
    );

    return success(res, createdRows[0], "پیش‌فاکتور با موفقیت برای مشتری صادر شد.", 201);
  } catch (err: any) {
    return error(res, err.message || "خطا در صدور پیش‌فاکتور", 500);
  }
}

export async function handleAdminUpdateServiceRequestStatus(req: Request, res: Response) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  try {
    const requestId = parseInt(req.params.id, 10);
    const { status: nextStatus, assigned_staff_id } = req.body;

    const allowedStatuses = [
      "submitted",
      "reviewing",
      "quoted",
      "customer_accepted",
      "in_progress",
      "waiting_customer",
      "completed",
      "cancelled",
      "rejected",
    ];

    if (nextStatus && !allowedStatuses.includes(nextStatus)) {
      return error(res, "وضعیت واردشده نامعتبر است.", 422, { status: ["وضعیت نامعتبر است."] });
    }

    const db = await getDatabase();
    const requestRows = queryRows(db, "SELECT * FROM service_requests WHERE id = ?", [requestId]);
    if (requestRows.length === 0) {
      return error(res, "درخواست خدمات یافت نشد.", 404);
    }

    const current = requestRows[0];
    const now = new Date().toISOString();

    const finalStatus = nextStatus || current.status;
    const finalStaffId = assigned_staff_id !== undefined ? (assigned_staff_id ? Number(assigned_staff_id) : null) : current.assigned_staff_id;

    db.run(
      "UPDATE service_requests SET status = ?, assigned_staff_id = ?, updated_at = ? WHERE id = ?",
      [finalStatus, finalStaffId, now, requestId]
    );

    if (nextStatus && nextStatus !== current.status) {
      const statusLabels: Record<string, string> = {
        submitted: "ثبت‌شده",
        reviewing: "در حال بررسی فنی",
        quoted: "پیش‌فاکتور صادرشده",
        customer_accepted: "تأییدشده توسط مشتری",
        in_progress: "در حال اجرا",
        waiting_customer: "در انتظار پاسخ مشتری",
        completed: "تکمیل و تحویل‌شده",
        cancelled: "لغوشده",
        rejected: "ردشده",
      };

      db.run(
        `INSERT INTO service_timelines (service_request_id, title, description, status, completed_at, created_at, updated_at)
         VALUES (?, 'تغییر وضعیت درخواست', ?, 'completed', ?, ?, ?)`,
        [
          requestId,
          `وضعیت درخواست به «${statusLabels[nextStatus] || nextStatus}» تغییر یافت.`,
          now,
          now,
          now,
        ]
      );
    }

    persistDatabase();

    const updatedRows = queryRows(db, "SELECT * FROM service_requests WHERE id = ?", [requestId]);
    return success(res, updatedRows[0], "وضعیت درخواست با موفقیت به‌روزرسانی شد.");
  } catch (err: any) {
    return error(res, err.message || "خطا در به‌روزرسانی وضعیت درخواست", 500);
  }
}
