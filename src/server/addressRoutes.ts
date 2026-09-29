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

function error(
  res: Response,
  message = "Error",
  status = 400,
  error_code = "BAD_REQUEST",
  errors: any = null
) {
  return res.status(status).json({
    success: false,
    error_code,
    message,
    errors,
  });
}

const normalizeDigits = (val: any): string =>
  String(val || "")
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/\D/g, "");

export async function handleGetAddresses(req: Request, res: Response) {
  try {
    const user = await authenticateToken(req);
    if (!user) {
      return error(res, "عدم دسترسی. ابتدا وارد حساب شوید.", 401, "UNAUTHORIZED");
    }

    const db = await getDatabase();
    const stmt = db.prepare(
      `SELECT id, user_id, type, title, recipient_name, phone, province, city, postal_code, address_line, is_default, created_at, updated_at
       FROM user_addresses
       WHERE user_id = :userId
       ORDER BY is_default DESC, id DESC`
    );
    stmt.bind({ ":userId": user.id });

    const addresses: any[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      addresses.push({
        id: Number(row.id),
        user_id: Number(row.user_id),
        type: String(row.type || "shipping"),
        title: String(row.title || (row.type === "billing" ? "محل کار" : "خانه")),
        recipient_name: String(row.recipient_name),
        phone: String(row.phone),
        province: String(row.province),
        city: String(row.city),
        postal_code: String(row.postal_code),
        address_line: String(row.address_line),
        is_default: Boolean(row.is_default),
        created_at: row.created_at,
        updated_at: row.updated_at,
      });
    }
    stmt.free();

    return success(res, addresses, "Addresses retrieved.", 200);
  } catch (err: any) {
    console.error("Error fetching addresses:", err);
    return error(res, err.message || "خطا در دریافت آدرس‌ها.", 500, "INTERNAL_ERROR");
  }
}

export async function handleCreateAddress(req: Request, res: Response) {
  try {
    const user = await authenticateToken(req);
    if (!user) {
      return error(res, "عدم دسترسی. ابتدا وارد حساب شوید.", 401, "UNAUTHORIZED");
    }

    const {
      recipient_name,
      phone,
      province,
      city,
      postal_code,
      address_line,
      type = "shipping",
      title,
      is_default,
    } = req.body || {};

    const validationErrors: Record<string, string[]> = {};
    if (!recipient_name || String(recipient_name).trim().length === 0) {
      validationErrors.recipient_name = ["نام گیرنده الزامی است."];
    }
    const cleanPhone = normalizeDigits(phone);
    if (!cleanPhone || !/^09\d{9}$/.test(cleanPhone)) {
      validationErrors.phone = ["شماره موبایل باید ۱۱ رقم بوده و با ۰۹ شروع شود."];
    }
    if (!province || String(province).trim().length === 0) {
      validationErrors.province = ["استان الزامی است."];
    }
    if (!city || String(city).trim().length === 0) {
      validationErrors.city = ["شهر الزامی است."];
    }
    const cleanPostalCode = normalizeDigits(postal_code);
    if (!cleanPostalCode || cleanPostalCode.length !== 10) {
      validationErrors.postal_code = ["کد پستی باید ۱۰ رقم باشد."];
    }
    if (!address_line || String(address_line).trim().length < 10) {
      validationErrors.address_line = ["آدرس پستی باید حداقل ۱۰ کاراکتر باشد."];
    }
    if (type && type !== "shipping" && type !== "billing") {
      validationErrors.type = ["نوع آدرس نامعتبر است."];
    }

    if (Object.keys(validationErrors).length > 0) {
      return error(res, "اطلاعات ارسالی نامعتبر است.", 422, "VALIDATION_ERROR", validationErrors);
    }

    const db = await getDatabase();
    const addressType = type === "billing" ? "billing" : "shipping";
    const addressTitle =
      title && String(title).trim().length > 0
        ? String(title).trim()
        : addressType === "billing"
        ? "محل کار"
        : "خانه";

    // Check count of user's addresses of this type
    const countStmt = db.prepare(
      "SELECT COUNT(*) as count FROM user_addresses WHERE user_id = :userId AND type = :type"
    );
    countStmt.bind({ ":userId": user.id, ":type": addressType });
    let currentCount = 0;
    if (countStmt.step()) {
      currentCount = Number(countStmt.getAsObject().count || 0);
    }
    countStmt.free();

    const shouldBeDefault = Boolean(is_default) || currentCount === 0;
    if (shouldBeDefault) {
      db.run(
        "UPDATE user_addresses SET is_default = 0, updated_at = datetime('now') WHERE user_id = ? AND type = ?",
        [user.id, addressType]
      );
    }
    const isDefaultVal = shouldBeDefault ? 1 : 0;

    db.run(
      `INSERT INTO user_addresses (user_id, type, title, recipient_name, phone, province, city, postal_code, address_line, is_default, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [
        user.id,
        addressType,
        addressTitle,
        String(recipient_name).trim(),
        cleanPhone,
        String(province).trim(),
        String(city).trim(),
        cleanPostalCode,
        String(address_line).trim(),
        isDefaultVal,
      ]
    );

    const lastIdQuery = db.exec("SELECT last_insert_rowid() as id");
    const newId =
      lastIdQuery.length > 0 && lastIdQuery[0].values.length > 0
        ? Number(lastIdQuery[0].values[0][0])
        : 0;

    const getStmt = db.prepare(
      `SELECT id, user_id, type, title, recipient_name, phone, province, city, postal_code, address_line, is_default, created_at, updated_at
       FROM user_addresses WHERE id = :id`
    );
    getStmt.bind({ ":id": newId });
    let createdAddress: any = null;
    if (getStmt.step()) {
      const row = getStmt.getAsObject();
      createdAddress = {
        id: Number(row.id),
        user_id: Number(row.user_id),
        type: String(row.type || "shipping"),
        title: String(row.title || "خانه"),
        recipient_name: String(row.recipient_name),
        phone: String(row.phone),
        province: String(row.province),
        city: String(row.city),
        postal_code: String(row.postal_code),
        address_line: String(row.address_line),
        is_default: Boolean(row.is_default),
        created_at: row.created_at,
        updated_at: row.updated_at,
      };
    }
    getStmt.free();

    persistDatabase();

    return success(res, createdAddress, "Address saved successfully.", 201);
  } catch (err: any) {
    console.error("Error creating address:", err);
    return error(res, err.message || "خطا در ثبت آدرس.", 500, "INTERNAL_ERROR");
  }
}

export async function handleUpdateAddress(req: Request, res: Response) {
  try {
    const user = await authenticateToken(req);
    if (!user) {
      return error(res, "عدم دسترسی. ابتدا وارد حساب شوید.", 401, "UNAUTHORIZED");
    }

    const addressId = Number(req.params.id);
    if (isNaN(addressId) || addressId <= 0) {
      return error(res, "شناسه آدرس نامعتبر است.", 422, "VALIDATION_ERROR");
    }

    const db = await getDatabase();
    const checkStmt = db.prepare(
      `SELECT id, user_id, type, title, recipient_name, phone, province, city, postal_code, address_line, is_default
       FROM user_addresses WHERE id = :id`
    );
    checkStmt.bind({ ":id": addressId });
    if (!checkStmt.step()) {
      checkStmt.free();
      return error(res, "آدرس مورد نظر یافت نشد.", 404, "NOT_FOUND");
    }
    const existing = checkStmt.getAsObject();
    checkStmt.free();

    if (Number(existing.user_id) !== Number(user.id)) {
      return error(res, "شما اجازه ویرایش این آدرس را ندارید.", 403, "FORBIDDEN");
    }

    const {
      recipient_name,
      phone,
      province,
      city,
      postal_code,
      address_line,
      type,
      title,
      is_default,
    } = req.body || {};

    const validationErrors: Record<string, string[]> = {};
    if (recipient_name !== undefined && String(recipient_name).trim().length === 0) {
      validationErrors.recipient_name = ["نام گیرنده نمی‌تواند خالی باشد."];
    }
    if (phone !== undefined) {
      const cleanPhone = normalizeDigits(phone);
      if (!cleanPhone || !/^09\d{9}$/.test(cleanPhone)) {
        validationErrors.phone = ["شماره موبایل باید ۱۱ رقم بوده و با ۰۹ شروع شود."];
      }
    }
    if (province !== undefined && String(province).trim().length === 0) {
      validationErrors.province = ["استان الزامی است."];
    }
    if (city !== undefined && String(city).trim().length === 0) {
      validationErrors.city = ["شهر الزامی است."];
    }
    if (postal_code !== undefined) {
      const cleanPostalCode = normalizeDigits(postal_code);
      if (!cleanPostalCode || cleanPostalCode.length !== 10) {
        validationErrors.postal_code = ["کد پستی باید ۱۰ رقم باشد."];
      }
    }
    if (address_line !== undefined && String(address_line).trim().length < 10) {
      validationErrors.address_line = ["آدرس پستی باید حداقل ۱۰ کاراکتر باشد."];
    }
    if (type !== undefined && type !== "shipping" && type !== "billing") {
      validationErrors.type = ["نوع آدرس نامعتبر است."];
    }

    if (Object.keys(validationErrors).length > 0) {
      return error(res, "اطلاعات ارسالی نامعتبر است.", 422, "VALIDATION_ERROR", validationErrors);
    }

    const finalType = type !== undefined ? type : existing.type;
    const finalTitle = title !== undefined ? String(title).trim() : existing.title;
    const finalRecipient =
      recipient_name !== undefined ? String(recipient_name).trim() : existing.recipient_name;
    const finalPhone = phone !== undefined ? normalizeDigits(phone) : existing.phone;
    const finalProvince =
      province !== undefined ? String(province).trim() : existing.province;
    const finalCity = city !== undefined ? String(city).trim() : existing.city;
    const finalPostalCode =
      postal_code !== undefined ? normalizeDigits(postal_code) : existing.postal_code;
    const finalAddressLine =
      address_line !== undefined ? String(address_line).trim() : existing.address_line;
    let finalIsDefault = existing.is_default;

    if (is_default !== undefined) {
      if (Boolean(is_default)) {
        db.run(
          "UPDATE user_addresses SET is_default = 0, updated_at = datetime('now') WHERE user_id = ? AND type = ?",
          [user.id, finalType]
        );
        finalIsDefault = 1;
      } else {
        finalIsDefault = 0;
      }
    }

    db.run(
      `UPDATE user_addresses
       SET type = ?, title = ?, recipient_name = ?, phone = ?, province = ?, city = ?, postal_code = ?, address_line = ?, is_default = ?, updated_at = datetime('now')
       WHERE id = ? AND user_id = ?`,
      [
        finalType,
        finalTitle,
        finalRecipient,
        finalPhone,
        finalProvince,
        finalCity,
        finalPostalCode,
        finalAddressLine,
        finalIsDefault,
        addressId,
        user.id,
      ]
    );
    persistDatabase();

    const getStmt = db.prepare(
      `SELECT id, user_id, type, title, recipient_name, phone, province, city, postal_code, address_line, is_default, created_at, updated_at
       FROM user_addresses WHERE id = :id`
    );
    getStmt.bind({ ":id": addressId });
    let updatedAddress: any = null;
    if (getStmt.step()) {
      const row = getStmt.getAsObject();
      updatedAddress = {
        id: Number(row.id),
        user_id: Number(row.user_id),
        type: String(row.type || "shipping"),
        title: String(row.title || "خانه"),
        recipient_name: String(row.recipient_name),
        phone: String(row.phone),
        province: String(row.province),
        city: String(row.city),
        postal_code: String(row.postal_code),
        address_line: String(row.address_line),
        is_default: Boolean(row.is_default),
        created_at: row.created_at,
        updated_at: row.updated_at,
      };
    }
    getStmt.free();

    return success(res, updatedAddress, "Address updated successfully.", 200);
  } catch (err: any) {
    console.error("Error updating address:", err);
    return error(res, err.message || "خطا در ویرایش آدرس.", 500, "INTERNAL_ERROR");
  }
}

export async function handleDeleteAddress(req: Request, res: Response) {
  try {
    const user = await authenticateToken(req);
    if (!user) {
      return error(res, "عدم دسترسی. ابتدا وارد حساب شوید.", 401, "UNAUTHORIZED");
    }

    const addressId = Number(req.params.id);
    if (isNaN(addressId) || addressId <= 0) {
      return error(res, "شناسه آدرس نامعتبر است.", 422, "VALIDATION_ERROR");
    }

    const db = await getDatabase();
    const checkStmt = db.prepare(
      "SELECT id, user_id FROM user_addresses WHERE id = :id"
    );
    checkStmt.bind({ ":id": addressId });
    if (!checkStmt.step()) {
      checkStmt.free();
      return error(res, "آدرس مورد نظر یافت نشد.", 404, "NOT_FOUND");
    }
    const existing = checkStmt.getAsObject();
    checkStmt.free();

    if (Number(existing.user_id) !== Number(user.id)) {
      return error(res, "شما اجازه حذف این آدرس را ندارید.", 403, "FORBIDDEN");
    }

    db.run("DELETE FROM user_addresses WHERE id = ? AND user_id = ?", [addressId, user.id]);
    persistDatabase();

    return success(res, null, "Address deleted successfully.", 200);
  } catch (err: any) {
    console.error("Error deleting address:", err);
    return error(res, err.message || "خطا در حذف آدرس.", 500, "INTERNAL_ERROR");
  }
}
