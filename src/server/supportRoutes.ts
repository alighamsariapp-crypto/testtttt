import { Request, Response } from "express";
import crypto from "crypto";
import { getDatabase, persistDatabase } from "./db";
import { authenticateToken } from "./authRoutes";

function success(res: Response, data: any, message: string = "عملیات با موفقیت انجام شد.", status: number = 200) {
  return res.status(status).json({
    success: true,
    data,
    message,
  });
}

function error(res: Response, message: string, status: number = 400, errors?: any, errorCode?: string) {
  return res.status(status).json({
    success: false,
    message,
    error_code: errorCode,
    errors: errors || { general: [message] },
  });
}

function queryRows(db: any, sql: string, params: any[] = []): any[] {
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

function generateTicketNumber(): string {
  return "TKT-" + crypto.randomBytes(5).toString("hex").toUpperCase();
}

function formatTicket(ticket: any, messages: any[], currentUserName: string) {
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
        name: m.sender === "support" ? "پشتیبانی نوین‌نت" : (m.user_name || currentUserName || "شما"),
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
  };
}

// 1. GET /api/v1/users/support-tickets
export async function handleGetCustomerTickets(req: Request, res: Response) {
  try {
    const user = await authenticateToken(req);
    if (!user) {
      return error(res, "برای دسترسی به تیکت‌ها ابتدا وارد حساب کاربری خود شوید.", 401, undefined, "UNAUTHORIZED");
    }

    const db = await getDatabase();
    const tickets = queryRows(
      db,
      "SELECT id, ticket_number, user_id, title, department, status, priority, last_reply_at, closed_at, archived_at, created_at, updated_at FROM support_tickets WHERE user_id = ? ORDER BY id DESC",
      [user.id]
    );

    const formattedList = tickets.map((t) => {
      const messages = queryRows(
        db,
        "SELECT m.id, m.support_ticket_id, m.user_id, m.sender, m.message, m.attachments, m.read_at, m.created_at, m.updated_at, u.name as user_name FROM support_ticket_messages m LEFT JOIN users u ON u.id = m.user_id WHERE m.support_ticket_id = ? ORDER BY m.id ASC",
        [t.id]
      );
      return formatTicket(t, messages, user.name);
    });

    return success(
      res,
      {
        data: formattedList,
        total: formattedList.length,
        per_page: 15,
        current_page: 1,
      },
      "لیست تیکت‌ها با موفقیت دریافت شد."
    );
  } catch (err: any) {
    return error(res, err.message || "خطا در دریافت تیکت‌ها.", 500);
  }
}

// 2. GET /api/v1/users/support-tickets/:id
export async function handleGetCustomerTicket(req: Request, res: Response) {
  try {
    const user = await authenticateToken(req);
    if (!user) {
      return error(res, "ابتدا وارد حساب کاربری خود شوید.", 401, undefined, "UNAUTHORIZED");
    }

    const db = await getDatabase();
    const idOrNumber = req.params.id;

    const tickets = queryRows(
      db,
      "SELECT id, ticket_number, user_id, title, department, status, priority, last_reply_at, closed_at, archived_at, created_at, updated_at FROM support_tickets WHERE id = ? OR ticket_number = ? LIMIT 1",
      [idOrNumber, idOrNumber]
    );

    if (tickets.length === 0) {
      return error(res, "تیکت مورد نظر یافت نشد.", 404, undefined, "NOT_FOUND");
    }

    const ticket = tickets[0];
    if (Number(ticket.user_id) !== Number(user.id)) {
      return error(res, "شما دسترسی لازم برای مشاهده این تیکت را ندارید.", 403, undefined, "FORBIDDEN");
    }

    const messages = queryRows(
      db,
      "SELECT m.id, m.support_ticket_id, m.user_id, m.sender, m.message, m.attachments, m.read_at, m.created_at, m.updated_at, u.name as user_name FROM support_ticket_messages m LEFT JOIN users u ON u.id = m.user_id WHERE m.support_ticket_id = ? ORDER BY m.id ASC",
      [ticket.id]
    );

    return success(res, formatTicket(ticket, messages, user.name), "تیکت با موفقیت دریافت شد.");
  } catch (err: any) {
    return error(res, err.message || "خطا در دریافت تیکت.", 500);
  }
}

// 3. POST /api/v1/users/support-tickets
export async function handleCreateCustomerTicket(req: Request, res: Response) {
  let inTransaction = false;
  try {
    const user = await authenticateToken(req);
    if (!user) {
      return error(res, "برای ثبت تیکت ابتدا وارد حساب کاربری خود شوید.", 401, undefined, "UNAUTHORIZED");
    }

    const rawTitle = req.body.title || req.body.subject;
    const rawDepartment = req.body.department || req.body.category;
    const { priority = "medium", message } = req.body;
    const title = typeof rawTitle === "string" ? rawTitle : "";
    const department = typeof rawDepartment === "string" ? rawDepartment : "";

    const validationErrors: Record<string, string[]> = {};
    if (!title || typeof title !== "string" || !title.trim()) {
      validationErrors.title = ["عنوان تیکت الزامی است."];
    } else if (title.trim().length > 255) {
      validationErrors.title = ["عنوان تیکت نباید بیشتر از ۲۵۵ کاراکتر باشد."];
    }

    if (!department || typeof department !== "string" || !department.trim()) {
      validationErrors.department = ["انتخاب بخش مربوطه الزامی است."];
    }

    const allowedPriorities = ["low", "medium", "high", "urgent"];
    if (!priority || !allowedPriorities.includes(priority)) {
      validationErrors.priority = ["اولویت تیکت نامعتبر است."];
    }

    if (!message || typeof message !== "string" || !message.trim()) {
      validationErrors.message = ["متن پیام تیکت الزامی است."];
    } else if (message.trim().length > 10000) {
      validationErrors.message = ["متن پیام نباید بیشتر از ۱۰۰۰۰ کاراکتر باشد."];
    }

    if (Object.keys(validationErrors).length > 0) {
      return error(res, "داده‌های ارسالی معتبر نیستند.", 422, validationErrors, "VALIDATION_ERROR");
    }

    const db = await getDatabase();
    const now = new Date().toISOString();
    const ticketNumber = generateTicketNumber();

    // Transaction safety
    db.run("BEGIN TRANSACTION");
    inTransaction = true;

    db.run(
      `INSERT INTO support_tickets (ticket_number, user_id, title, department, status, priority, last_reply_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'open', ?, ?, ?, ?)`,
      [ticketNumber, user.id, title.trim(), department.trim(), priority, now, now, now]
    );

    const ticketIdResult = db.exec("SELECT last_insert_rowid()");
    const ticketId = Number(ticketIdResult[0].values[0][0]);

    db.run(
      `INSERT INTO support_ticket_messages (support_ticket_id, user_id, sender, message, created_at, updated_at)
       VALUES (?, ?, 'user', ?, ?, ?)`,
      [ticketId, user.id, message.trim(), now, now]
    );

    db.run("COMMIT");
    inTransaction = false;
    persistDatabase();

    const createdTicket = queryRows(
      db,
      "SELECT id, ticket_number, user_id, title, department, status, priority, last_reply_at, closed_at, archived_at, created_at, updated_at FROM support_tickets WHERE id = ?",
      [ticketId]
    )[0];

    const createdMessages = queryRows(
      db,
      "SELECT m.id, m.support_ticket_id, m.user_id, m.sender, m.message, m.attachments, m.read_at, m.created_at, m.updated_at, u.name as user_name FROM support_ticket_messages m LEFT JOIN users u ON u.id = m.user_id WHERE m.support_ticket_id = ? ORDER BY m.id ASC",
      [ticketId]
    );

    return success(
      res,
      formatTicket(createdTicket, createdMessages, user.name),
      "تیکت با موفقیت ثبت شد.",
      201
    );
  } catch (err: any) {
    if (inTransaction) {
      try {
        const db = await getDatabase();
        db.run("ROLLBACK");
      } catch {
        // Rollback attempt failed
      }
    }
    return error(res, err.message || "خطای سرور در ثبت تیکت.", 500);
  }
}

// 4. POST /api/v1/users/support-tickets/:id/messages
export async function handleAddCustomerTicketMessage(req: Request, res: Response) {
  try {
    const user = await authenticateToken(req);
    if (!user) {
      return error(res, "ابتدا وارد حساب کاربری خود شوید.", 401, undefined, "UNAUTHORIZED");
    }

    const { message } = req.body;
    if (!message || typeof message !== "string" || !message.trim()) {
      return error(res, "متن پیام الزامی است.", 422, { message: ["متن پیام الزامی است."] }, "VALIDATION_ERROR");
    }
    if (message.trim().length > 10000) {
      return error(res, "متن پیام نباید بیشتر از ۱۰۰۰۰ کاراکتر باشد.", 422, { message: ["متن پیام طولانی است."] }, "VALIDATION_ERROR");
    }

    const db = await getDatabase();
    const idOrNumber = req.params.id;

    const tickets = queryRows(
      db,
      "SELECT id, ticket_number, user_id, title, department, status, priority, last_reply_at, closed_at, archived_at, created_at, updated_at FROM support_tickets WHERE id = ? OR ticket_number = ? LIMIT 1",
      [idOrNumber, idOrNumber]
    );

    if (tickets.length === 0) {
      return error(res, "تیکت مورد نظر یافت نشد.", 404, undefined, "NOT_FOUND");
    }

    const ticket = tickets[0];
    if (Number(ticket.user_id) !== Number(user.id)) {
      return error(res, "شما دسترسی لازم برای ارسال پیام در این تیکت را ندارید.", 403, undefined, "FORBIDDEN");
    }

    if (ticket.status === "closed") {
      return error(res, "این تیکت بسته شده است و امکان ارسال پیام جدید وجود ندارد.", 422, undefined, "TICKET_CLOSED");
    }

    const now = new Date().toISOString();

    db.run(
      `INSERT INTO support_ticket_messages (support_ticket_id, user_id, sender, message, created_at, updated_at)
       VALUES (?, ?, 'user', ?, ?, ?)`,
      [ticket.id, user.id, message.trim(), now, now]
    );

    db.run(
      `UPDATE support_tickets SET status = 'investigating', last_reply_at = ?, updated_at = ? WHERE id = ?`,
      [now, now, ticket.id]
    );

    persistDatabase();

    const updatedTicket = queryRows(
      db,
      "SELECT id, ticket_number, user_id, title, department, status, priority, last_reply_at, closed_at, archived_at, created_at, updated_at FROM support_tickets WHERE id = ?",
      [ticket.id]
    )[0];

    const messages = queryRows(
      db,
      "SELECT m.id, m.support_ticket_id, m.user_id, m.sender, m.message, m.attachments, m.read_at, m.created_at, m.updated_at, u.name as user_name FROM support_ticket_messages m LEFT JOIN users u ON u.id = m.user_id WHERE m.support_ticket_id = ? ORDER BY m.id ASC",
      [ticket.id]
    );

    return success(res, formatTicket(updatedTicket, messages, user.name), "پیام شما با موفقیت ارسال شد.", 201);
  } catch (err: any) {
    return error(res, err.message || "خطا در ارسال پیام تیکت.", 500);
  }
}

// 5. POST /api/v1/users/support-tickets/:id/close
export async function handleCloseCustomerTicket(req: Request, res: Response) {
  try {
    const user = await authenticateToken(req);
    if (!user) {
      return error(res, "ابتدا وارد حساب کاربری خود شوید.", 401, undefined, "UNAUTHORIZED");
    }

    const db = await getDatabase();
    const idOrNumber = req.params.id;

    const tickets = queryRows(
      db,
      "SELECT id, ticket_number, user_id, title, department, status, priority, last_reply_at, closed_at, archived_at, created_at, updated_at FROM support_tickets WHERE id = ? OR ticket_number = ? LIMIT 1",
      [idOrNumber, idOrNumber]
    );

    if (tickets.length === 0) {
      return error(res, "تیکت مورد نظر یافت نشد.", 404, undefined, "NOT_FOUND");
    }

    const ticket = tickets[0];
    if (Number(ticket.user_id) !== Number(user.id)) {
      return error(res, "شما دسترسی لازم برای بستن این تیکت را ندارید.", 403, undefined, "FORBIDDEN");
    }

    const now = new Date().toISOString();

    db.run(
      `UPDATE support_tickets SET status = 'closed', closed_at = ?, updated_at = ? WHERE id = ?`,
      [now, now, ticket.id]
    );

    persistDatabase();

    const updatedTicket = queryRows(
      db,
      "SELECT id, ticket_number, user_id, title, department, status, priority, last_reply_at, closed_at, archived_at, created_at, updated_at FROM support_tickets WHERE id = ?",
      [ticket.id]
    )[0];

    const messages = queryRows(
      db,
      "SELECT m.id, m.support_ticket_id, m.user_id, m.sender, m.message, m.attachments, m.read_at, m.created_at, m.updated_at, u.name as user_name FROM support_ticket_messages m LEFT JOIN users u ON u.id = m.user_id WHERE m.support_ticket_id = ? ORDER BY m.id ASC",
      [ticket.id]
    );

    return success(res, formatTicket(updatedTicket, messages, user.name), "تیکت با موفقیت بسته شد.");
  } catch (err: any) {
    return error(res, err.message || "خطا در بستن تیکت.", 500);
  }
}
