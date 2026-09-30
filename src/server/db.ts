import initSqlJs, { Database } from "sql.js";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { DEFAULT_PRODUCTS_LIST } from "./defaultProducts";

let dbInstance: Database | null = null;
const DB_FILE_PATH = path.join(process.cwd(), "database", "apex_app.sqlite");

export function getDatabaseSync(): Database | null {
  return dbInstance;
}

export async function getDatabase(): Promise<Database> {
  if (dbInstance) return dbInstance;

  const SQL = await initSqlJs();
  const dbDir = path.dirname(DB_FILE_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  if (fs.existsSync(DB_FILE_PATH)) {
    const fileBuffer = fs.readFileSync(DB_FILE_PATH);
    dbInstance = new SQL.Database(fileBuffer);
    initSchema(dbInstance);
    seedInitialData(dbInstance);
    migrateLegacyTokens(dbInstance);
    persistDatabase();
  } else {
    dbInstance = new SQL.Database();
    initSchema(dbInstance);
    seedInitialData(dbInstance);
    migrateLegacyTokens(dbInstance);
    persistDatabase();
  }

  return dbInstance;
}

export function persistDatabase(): void {
  if (!dbInstance) return;
  const data = dbInstance.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_FILE_PATH, buffer);
}

let savepointCounter = 0;

/**
 * Executes a function inside a deterministic SQLite transaction boundary using savepoints.
 * Compatible with nested calls, automatically rolls back on thrown errors, and guarantees atomicity.
 */
export function runInTransaction<T>(db: any, fn: () => T): T {
  if (!db) {
    throw new Error("Database instance required for transaction");
  }
  const spName = `sp_tx_${Date.now()}_${++savepointCounter}`;
  db.run(`SAVEPOINT ${spName};`);
  try {
    const result = fn();
    db.run(`RELEASE SAVEPOINT ${spName};`);
    return result;
  } catch (err) {
    try {
      db.run(`ROLLBACK TO SAVEPOINT ${spName};`);
      db.run(`RELEASE SAVEPOINT ${spName};`);
    } catch (rbErr) {
      console.error(`[runInTransaction] Rollback to savepoint ${spName} failed:`, rbErr);
    }
    throw err;
  }
}

function initSchema(db: Database) {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT UNIQUE,
      email_verified_at TEXT,
      phone_verified_at TEXT,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'customer',
      status TEXT DEFAULT 'active',
      remember_token TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS personal_access_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tokenable_type TEXT NOT NULL,
      tokenable_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      abilities TEXT,
      last_used_at TEXT,
      expires_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS rate_limits (
      key TEXT PRIMARY KEY,
      hits INTEGER NOT NULL DEFAULT 1,
      reset_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS phone_verification_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT UNIQUE NOT NULL,
      code_hash TEXT NOT NULL,
      issued_at TEXT,
      resend_available_at TEXT,
      expires_at TEXT NOT NULL,
      consumed_at TEXT,
      attempts INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_addresses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT DEFAULT 'shipping',
      title TEXT DEFAULT 'خانه',
      recipient_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      province TEXT NOT NULL,
      city TEXT NOT NULL,
      postal_code TEXT NOT NULL,
      address_line TEXT NOT NULL,
      is_default INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parent_id INTEGER,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT,
      image_url TEXT,
      is_active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      meta_title TEXT,
      meta_description TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      sku TEXT UNIQUE NOT NULL,
      description TEXT,
      short_description TEXT,
      base_price INTEGER NOT NULL DEFAULT 0,
      compare_price INTEGER,
      original_price INTEGER,
      discount_percent INTEGER,
      discount_price INTEGER,
      effective_price INTEGER,
      currency TEXT DEFAULT 'IRR',
      is_active INTEGER NOT NULL DEFAULT 1,
      is_featured INTEGER NOT NULL DEFAULT 0,
      images TEXT,
      attributes TEXT,
      colors TEXT,
      variant_options TEXT,
      meta_title TEXT,
      meta_description TEXT,
      stock_quantity INTEGER DEFAULT 0,
      initial_stock INTEGER DEFAULT 0,
      in_stock INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
    CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
    CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
    CREATE INDEX IF NOT EXISTS idx_products_is_featured ON products(is_featured);

    CREATE TABLE IF NOT EXISTS product_variants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      sku TEXT UNIQUE NOT NULL,
      price_override INTEGER,
      original_price INTEGER,
      discount_percent INTEGER,
      discount_price INTEGER,
      effective_price INTEGER,
      price INTEGER,
      stock INTEGER DEFAULT 0,
      stock_quantity INTEGER DEFAULT 0,
      attributes TEXT,
      image_url TEXT,
      images TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_product_variants_sku ON product_variants(sku);
    CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants(product_id);
    CREATE INDEX IF NOT EXISTS idx_product_variants_is_active ON product_variants(is_active);

    CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_variant_id INTEGER UNIQUE NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0,
      reserved_quantity INTEGER NOT NULL DEFAULT 0,
      safety_threshold INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_variant_id) REFERENCES product_variants(id) ON DELETE CASCADE
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_variant_id ON inventory(product_variant_id);

    CREATE TABLE IF NOT EXISTS product_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      image_url TEXT NOT NULL,
      is_primary INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id);

    CREATE TABLE IF NOT EXISTS carts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      session_id TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS cart_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cart_id INTEGER NOT NULL,
      product_variant_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      payment_status TEXT DEFAULT 'pending',
      tracking_code TEXT,
      subtotal INTEGER NOT NULL DEFAULT 0,
      discount_total INTEGER NOT NULL DEFAULT 0,
      tax_total INTEGER NOT NULL DEFAULT 0,
      shipping_total INTEGER NOT NULL DEFAULT 0,
      grand_total INTEGER NOT NULL DEFAULT 0,
      currency TEXT DEFAULT 'IRR',
      shipping_method TEXT DEFAULT 'post',
      shipping_address_snapshot TEXT NOT NULL,
      billing_address_snapshot TEXT,
      notes TEXT,
      idempotency_key TEXT,
      is_inventory_restored INTEGER NOT NULL DEFAULT 0,
      inventory_restored_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER,
      product_variant_id INTEGER,
      product_name_snapshot TEXT NOT NULL,
      variant_sku_snapshot TEXT,
      variant_attributes_snapshot TEXT,
      unit_price INTEGER NOT NULL DEFAULT 0,
      quantity INTEGER NOT NULL DEFAULT 1,
      discount_amount INTEGER NOT NULL DEFAULT 0,
      tax_amount INTEGER NOT NULL DEFAULT 0,
      total_price INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      gateway TEXT NOT NULL,
      amount INTEGER NOT NULL DEFAULT 0,
      currency TEXT DEFAULT 'IRR',
      status TEXT DEFAULT 'pending',
      reference_id TEXT,
      gateway_payment_id TEXT,
      payment_url TEXT,
      gateway_response TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_payments_gateway_payment_id ON payments(gateway_payment_id);
    CREATE INDEX IF NOT EXISTS idx_payments_reference_id ON payments(reference_id);
    CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);

    CREATE TABLE IF NOT EXISTS payment_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_id INTEGER NOT NULL,
      order_id INTEGER,
      gateway TEXT,
      event_type TEXT NOT NULL,
      status TEXT,
      amount INTEGER NOT NULL DEFAULT 0,
      currency TEXT DEFAULT 'IRR',
      reference_id TEXT,
      idempotency_key TEXT UNIQUE,
      payload TEXT,
      is_reconciled INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_transactions_idempotency ON payment_transactions(idempotency_key);
    CREATE INDEX IF NOT EXISTS idx_payment_transactions_payment_id ON payment_transactions(payment_id);

    CREATE TABLE IF NOT EXISTS payment_status_exchanges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code_hash TEXT UNIQUE NOT NULL,
      order_id INTEGER NOT NULL,
      order_number TEXT NOT NULL,
      user_id INTEGER NOT NULL DEFAULT 0,
      purpose TEXT NOT NULL DEFAULT 'payment_status',
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_status_exchanges_code_hash ON payment_status_exchanges(code_hash);
    CREATE INDEX IF NOT EXISTS idx_payment_status_exchanges_order_id ON payment_status_exchanges(order_id);
    CREATE INDEX IF NOT EXISTS idx_payment_status_exchanges_order_number ON payment_status_exchanges(order_number);

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      ip_address TEXT,
      user_agent TEXT,
      redacted_metadata TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

    CREATE TABLE IF NOT EXISTS wallet_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      order_id INTEGER,
      type TEXT NOT NULL,
      amount INTEGER NOT NULL DEFAULT 0,
      currency TEXT DEFAULT 'IRR',
      status TEXT DEFAULT 'successful',
      reference TEXT UNIQUE,
      description TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS support_tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_number TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      department TEXT NOT NULL,
      status TEXT DEFAULT 'open',
      priority TEXT DEFAULT 'medium',
      last_reply_at TEXT,
      closed_at TEXT,
      archived_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS support_ticket_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      support_ticket_id INTEGER NOT NULL,
      user_id INTEGER,
      sender TEXT NOT NULL,
      message TEXT NOT NULL,
      attachments TEXT,
      read_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (support_ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets(user_id);
    CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
    CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_ticket ON support_ticket_messages(support_ticket_id);

    CREATE TABLE IF NOT EXISTS discount_coupons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      discount_type TEXT NOT NULL DEFAULT 'fixed',
      discount_value INTEGER NOT NULL,
      min_order_amount INTEGER NOT NULL DEFAULT 0,
      max_discount_amount INTEGER,
      usage_limit INTEGER NOT NULL DEFAULT 0,
      usage_count INTEGER NOT NULL DEFAULT 0,
      starts_at TEXT,
      expires_at TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_discount_coupons_code ON discount_coupons(code);
    CREATE INDEX IF NOT EXISTS idx_discount_coupons_is_active ON discount_coupons(is_active);

    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT,
      "group" TEXT NOT NULL DEFAULT 'general',
      is_public INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_settings_key ON settings(key);
    CREATE INDEX IF NOT EXISTS idx_settings_group ON settings("group");
    CREATE INDEX IF NOT EXISTS idx_settings_is_public ON settings(is_public);

    -- Service Domain Tables (Laravel Modules/Services contract)
    CREATE TABLE IF NOT EXISTS service_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      description TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_service_categories_slug ON service_categories(slug);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_service_categories_name ON service_categories(name);
    CREATE INDEX IF NOT EXISTS idx_service_categories_is_active ON service_categories(is_active);
    CREATE INDEX IF NOT EXISTS idx_service_categories_sort_order ON service_categories(sort_order);

    CREATE TABLE IF NOT EXISTS service_catalogs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      category TEXT DEFAULT 'خدمات آنلاین',
      service_category_id INTEGER,
      short_description TEXT,
      description TEXT,
      estimated_base_price INTEGER,
      currency TEXT DEFAULT 'IRR',
      icon TEXT,
      image_url TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      required_fields TEXT,
      meta_title TEXT,
      meta_description TEXT,
      documents TEXT,
      steps TEXT,
      faq TEXT,
      contact_type TEXT,
      contact_url TEXT,
      cta_label TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (service_category_id) REFERENCES service_categories(id) ON DELETE SET NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_service_catalogs_slug ON service_catalogs(slug);
    CREATE INDEX IF NOT EXISTS idx_service_catalogs_is_active ON service_catalogs(is_active);
    CREATE INDEX IF NOT EXISTS idx_service_catalogs_category_id ON service_catalogs(service_category_id);

    CREATE TABLE IF NOT EXISTS service_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_number TEXT NOT NULL UNIQUE,
      user_id INTEGER NOT NULL,
      service_catalog_id INTEGER,
      title TEXT NOT NULL,
      requirements TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'submitted',
      assigned_staff_id INTEGER,
      custom_attributes TEXT,
      attachments TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
      FOREIGN KEY (service_catalog_id) REFERENCES service_catalogs(id) ON DELETE SET NULL,
      FOREIGN KEY (assigned_staff_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_service_requests_number ON service_requests(request_number);
    CREATE INDEX IF NOT EXISTS idx_service_requests_user_id ON service_requests(user_id);
    CREATE INDEX IF NOT EXISTS idx_service_requests_status ON service_requests(status);
    CREATE INDEX IF NOT EXISTS idx_service_requests_created_at ON service_requests(created_at);

    CREATE TABLE IF NOT EXISTS service_quotes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service_request_id INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      currency TEXT DEFAULT 'IRR',
      scope_of_work TEXT,
      terms TEXT,
      valid_until TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      responded_at TEXT,
      created_by_staff_id INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (service_request_id) REFERENCES service_requests(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by_staff_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_service_quotes_request_id ON service_quotes(service_request_id);
    CREATE INDEX IF NOT EXISTS idx_service_quotes_status ON service_quotes(status);

    CREATE TABLE IF NOT EXISTS service_timelines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service_request_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      due_date TEXT,
      completed_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (service_request_id) REFERENCES service_requests(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_service_timelines_request_id ON service_timelines(service_request_id);

    -- User Favorites Table (Laravel Modules/Favorites contract)
    CREATE TABLE IF NOT EXISTS user_favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE (user_id, product_id)
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_user_favorites_user_product ON user_favorites(user_id, product_id);
    CREATE INDEX IF NOT EXISTS idx_user_favorites_user_id ON user_favorites(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_favorites_product_id ON user_favorites(product_id);
  `);

  // Safe migration check for user_favorites table
  try {
    db.run(`
      CREATE TABLE IF NOT EXISTS user_favorites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE (user_id, product_id)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_user_favorites_user_product ON user_favorites(user_id, product_id);
      CREATE INDEX IF NOT EXISTS idx_user_favorites_user_id ON user_favorites(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_favorites_product_id ON user_favorites(product_id);

      CREATE TABLE IF NOT EXISTS sms_deliveries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_key TEXT UNIQUE NOT NULL,
        event TEXT NOT NULL,
        recipient TEXT NOT NULL,
        payload TEXT,
        provider_message_id TEXT,
        provider_status INTEGER,
        status TEXT DEFAULT 'queued',
        failure_code TEXT,
        sent_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_sms_deliveries_event_key ON sms_deliveries(event_key);
    `);
  } catch (e) {
    console.error("Migration check for user_favorites failed:", e);
  }

  // Safe migration check for missing title column in existing user_addresses table
  try {
    const userAddressesColumns = db.exec("PRAGMA table_info(user_addresses)");
    if (userAddressesColumns.length > 0) {
      const colNames = userAddressesColumns[0].values.map((row) => row[1]);
      if (!colNames.includes("title")) {
        db.run("ALTER TABLE user_addresses ADD COLUMN title TEXT DEFAULT 'خانه'");
      }
    }
  } catch (e) {
    console.error("Migration check for user_addresses title column failed:", e);
  }

  // Safe migration check for Phase 1 integrity columns in existing orders table
  try {
    const otpColumns = db.exec("PRAGMA table_info(phone_verification_codes)");
    if (otpColumns.length > 0) {
      const colNames = otpColumns[0].values.map((row) => row[1]);
      if (!colNames.includes("issued_at")) {
        db.run("ALTER TABLE phone_verification_codes ADD COLUMN issued_at TEXT");
      }
      if (!colNames.includes("resend_available_at")) {
        db.run("ALTER TABLE phone_verification_codes ADD COLUMN resend_available_at TEXT");
      }
    }
  } catch (e) {
    console.error("Migration check for phone_verification_codes columns failed:", e);
  }

  try {
    const ordersColumns = db.exec("PRAGMA table_info(orders)");
    if (ordersColumns.length > 0) {
      const colNames = ordersColumns[0].values.map((row) => row[1]);
      if (!colNames.includes("idempotency_key")) {
        db.run("ALTER TABLE orders ADD COLUMN idempotency_key TEXT");
      }
      if (!colNames.includes("is_inventory_restored")) {
        db.run("ALTER TABLE orders ADD COLUMN is_inventory_restored INTEGER NOT NULL DEFAULT 0");
      }
      if (!colNames.includes("inventory_restored_at")) {
        db.run("ALTER TABLE orders ADD COLUMN inventory_restored_at TEXT");
      }
    }
    db.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idempotency_key ON orders(idempotency_key)");
    db.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_user_idempotency ON orders(user_id, idempotency_key) WHERE idempotency_key IS NOT NULL");
  } catch (e) {
    console.error("Migration check for orders phase 1 columns failed:", e);
  }

  // Safe migration check for checkout_idempotency table
  try {
    db.run(`
      CREATE TABLE IF NOT EXISTS checkout_idempotency (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        idempotency_key TEXT NOT NULL,
        request_hash TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'processing',
        order_id INTEGER,
        response_payload TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_checkout_idempotency_user_key ON checkout_idempotency(user_id, idempotency_key);
    `);
  } catch (e) {
    console.error("Migration check for checkout_idempotency table failed:", e);
  }

  // Safe migration check for payment_transactions table
  try {
    db.run(`
      CREATE TABLE IF NOT EXISTS payment_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        payment_id INTEGER NOT NULL,
        order_id INTEGER,
        gateway TEXT,
        event_type TEXT NOT NULL,
        status TEXT,
        amount INTEGER NOT NULL DEFAULT 0,
        currency TEXT DEFAULT 'IRR',
        reference_id TEXT,
        idempotency_key TEXT UNIQUE,
        payload TEXT,
        is_reconciled INTEGER NOT NULL DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_transactions_idempotency ON payment_transactions(idempotency_key);
      CREATE INDEX IF NOT EXISTS idx_payment_transactions_payment_id ON payment_transactions(payment_id);
    `);

    const ptColumns = db.exec("PRAGMA table_info(payment_transactions)");
    if (ptColumns.length > 0) {
      const colNames = ptColumns[0].values.map((row) => row[1]);
      if (!colNames.includes("order_id")) {
        db.run("ALTER TABLE payment_transactions ADD COLUMN order_id INTEGER");
      }
      if (!colNames.includes("gateway")) {
        db.run("ALTER TABLE payment_transactions ADD COLUMN gateway TEXT");
      }
      if (!colNames.includes("status")) {
        db.run("ALTER TABLE payment_transactions ADD COLUMN status TEXT");
      }
      if (!colNames.includes("currency")) {
        db.run("ALTER TABLE payment_transactions ADD COLUMN currency TEXT DEFAULT 'IRR'");
      }
      if (!colNames.includes("reference_id")) {
        db.run("ALTER TABLE payment_transactions ADD COLUMN reference_id TEXT");
      }
    }
  } catch (e) {
    console.error("Migration check for payment_transactions failed:", e);
  }

  // Safe migration check for audit_logs table
  try {
    db.run(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id INTEGER,
        ip_address TEXT,
        user_agent TEXT,
        redacted_metadata TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      );
      CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
    `);
  } catch (e) {
    console.error("Migration check for audit_logs failed:", e);
  }

  // Safe migration check for order_transition_history table
  try {
    db.run(`
      CREATE TABLE IF NOT EXISTS order_transition_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        from_status TEXT NOT NULL,
        to_status TEXT NOT NULL,
        from_payment_status TEXT,
        to_payment_status TEXT,
        reason TEXT,
        actor_role TEXT,
        actor_id INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_order_transition_history_order_id ON order_transition_history(order_id);
    `);
  } catch (e) {
    console.error("Migration check for order_transition_history failed:", e);
  }

  // Ensure non-admin users do not have hardcoded admin role persisted
  try {
    db.run("UPDATE users SET role = 'customer' WHERE email = 'alighamsariapp@gmail.com' AND role = 'admin'");
  } catch (e) {
    console.error("Migration check for user roles failed:", e);
  }
}

function migrateLegacyTokens(db: Database) {
  try {
    // Invalidate legacy plaintext tokens (length != 64 hex characters)
    db.run("DELETE FROM personal_access_tokens WHERE length(token) != 64");
    // Ensure tokens have explicit expires_at
    db.run("UPDATE personal_access_tokens SET expires_at = datetime(created_at, '+7 days') WHERE expires_at IS NULL");
  } catch (e) {
    console.error("Migration check for personal_access_tokens failed:", e);
  }
}

function seedInitialData(db: Database) {
  const adminPasswordHash = bcrypt.hashSync("Admin@123456", 10);
  const userPasswordHash = bcrypt.hashSync("User@123456", 10);

  db.run(`
    INSERT OR IGNORE INTO users (id, name, email, phone, password, role, status, created_at, updated_at)
    VALUES 
    (1, 'مدیر سیستم', 'admin@apexstore.local', '09120000000', '${adminPasswordHash}', 'admin', 'active', datetime('now'), datetime('now')),
    (2, 'علی قمصری', 'alighamsariapp@gmail.com', '09123456789', '${userPasswordHash}', 'customer', 'active', datetime('now'), datetime('now')),
    (3, 'کاربر مشتری', 'customer@apexstore.local', '09121111111', '${userPasswordHash}', 'customer', 'active', datetime('now'), datetime('now'));
  `);

  const adminDemoTokenHash = crypto.createHash('sha256').update('admin_demo_token_valid').digest('hex');
  const customerTokenHash = crypto.createHash('sha256').update('customer_token_valid').digest('hex');
  const adminAbilitiesJson = JSON.stringify([
    'admin:access', 'products:manage', 'orders:manage', 'users:manage', 'settings:manage', 'reports:view', 'customer:access', 'orders:view', 'profile:manage'
  ]);
  const customerAbilitiesJson = JSON.stringify([
    'customer:access', 'orders:create', 'orders:view', 'profile:manage', 'cart:manage'
  ]);

  db.run(`
    INSERT OR REPLACE INTO personal_access_tokens (id, tokenable_type, tokenable_id, name, token, abilities, expires_at, created_at, updated_at)
    VALUES 
    (1, 'App\\\\Modules\\\\Users\\\\Models\\\\User', 1, 'admin-demo', '${adminDemoTokenHash}', '${adminAbilitiesJson}', datetime('now', '+7 days'), datetime('now'), datetime('now')),
    (2, 'App\\\\Modules\\\\Users\\\\Models\\\\User', 3, 'customer-token', '${customerTokenHash}', '${customerAbilitiesJson}', datetime('now', '+7 days'), datetime('now'), datetime('now'));
  `);

  db.run(`
    INSERT OR IGNORE INTO categories (id, parent_id, name, slug, description, is_active, sort_order, created_at, updated_at)
    VALUES
    (1, NULL, 'لپ‌تاپ و کامپیوتر', 'laptops', 'لپ‌تاپ، اولترابوک و کامپیوترهای اداری و گیمینگ', 1, 10, datetime('now'), datetime('now')),
    (2, 1, 'لپ‌تاپ گیمینگ', 'gaming-laptops', 'لپ‌تاپ‌های گیمینگ با سخت‌افزار قدرتمند', 1, 10, datetime('now'), datetime('now')),
    (3, 1, 'اولترابوک و اداری', 'ultrabooks', 'لپ‌تاپ‌های سبک و باریک مناسب کار و دانشگاه', 1, 20, datetime('now'), datetime('now')),
    (4, NULL, 'موبایل', 'mobile', 'انواع گوشی‌های هوشمند و لوازم جانبی', 1, 20, datetime('now'), datetime('now')),
    (5, NULL, 'لوازم خانگی', 'home-appliances', 'کالاهای برقی و تجهیزات خانه و آشپزخانه', 1, 30, datetime('now'), datetime('now')),
    (6, NULL, 'مودم و اینترنت', 'modems', 'مودم‌های 5G، روتر و تجهیزات شبکه', 1, 30, datetime('now'), datetime('now'));

    INSERT OR IGNORE INTO wallet_transactions (id, user_id, type, amount, currency, status, reference, description, created_at, updated_at)
    VALUES 
    (1, 1, 'deposit', 500000000, 'IRR', 'successful', 'WLT-INIT-001', 'موجودی اولیه حساب کاربری', datetime('now'), datetime('now')),
    (2, 2, 'deposit', 500000000, 'IRR', 'successful', 'WLT-INIT-002', 'موجودی اولیه حساب کاربری', datetime('now'), datetime('now')),
    (3, 3, 'deposit', 100000000, 'IRR', 'successful', 'WLT-INIT-003', 'موجودی اولیه حساب کاربری', datetime('now'), datetime('now'));

    INSERT OR IGNORE INTO orders (
      id, order_number, user_id, status, payment_status, tracking_code,
      subtotal, discount_total, tax_total, shipping_total, grand_total,
      currency, shipping_method, shipping_address_snapshot, billing_address_snapshot,
      notes, created_at, updated_at
    ) VALUES (
      1,
      'ORD-1403-8891',
      2,
      'processing',
      'paid',
      'TRK-9823412001',
      478000000,
      0,
      0,
      0,
      478000000,
      'IRR',
      'post',
      '{"full_name":"علی قمصری","recipient_name":"علی قمصری","phone":"09123456789","province":"تهران","city":"تهران","address":"خیابان ولیعصر، نرسیده به پارک ساعی، پلاک ۱۲، واحد ۴","address_line":"خیابان ولیعصر، نرسیده به پارک ساعی، پلاک ۱۲، واحد ۴","postal_code":"1433789123"}',
      '{}',
      'لطفاً قبل از ارسال تماس بگیرید.',
      datetime('now', '-2 days'),
      datetime('now')
    ), (
      2,
      'ORD-1403-7120',
      2,
      'completed',
      'paid',
      'TRK-1122334455',
      325000000,
      25000000,
      0,
      0,
      300000000,
      'IRR',
      'express',
      '{"full_name":"علی قمصری","recipient_name":"علی قمصری","phone":"09123456789","province":"تهران","city":"تهران","address":"خیابان آزادی، خیابان حبیب‌الله، دانشگاه شریف","address_line":"خیابان آزادی، خیابان حبیب‌الله، دانشگاه شریف","postal_code":"1458889654"}',
      '{}',
      NULL,
      datetime('now', '-5 days'),
      datetime('now')
    );

    INSERT OR IGNORE INTO order_items (
      id, order_id, product_id, product_variant_id, product_name_snapshot,
      variant_sku_snapshot, variant_attributes_snapshot, unit_price, quantity,
      discount_amount, tax_amount, total_price, created_at, updated_at
    ) VALUES (
      1,
      1,
      103,
      NULL,
      'گوشی موبایل سامسونگ مدل Galaxy S24',
      'S24-256-BLK',
      '{"color":"مشکی","storage":"256GB"}',
      478000000,
      1,
      0,
      0,
      478000000,
      datetime('now', '-2 days'),
      datetime('now')
    ), (
      2,
      2,
      101,
      NULL,
      'لپ‌تاپ گیمینگ ایسوس ROG Strix G16',
      'ROG-G16-RTX4060',
      '{"ram":"16GB","storage":"1TB SSD"}',
      325000000,
      1,
      25000000,
      0,
      300000000,
      datetime('now', '-5 days'),
      datetime('now')
    );

    INSERT OR IGNORE INTO payments (
      id, order_id, user_id, gateway, amount, currency, status, reference_id,
      gateway_payment_id, created_at, updated_at
    ) VALUES (
      1,
      1,
      2,
      'shaparak_saman',
      478000000,
      'IRR',
      'paid',
      'REF-SEP-8891001',
      'GATE-SAMAN-9921',
      datetime('now', '-2 days'),
      datetime('now')
    ), (
      2,
      2,
      2,
      'shaparak_mellat',
      300000000,
      'IRR',
      'paid',
      'REF-BML-7120002',
      'GATE-MELLAT-8814',
      datetime('now', '-5 days'),
      datetime('now')
    );

    INSERT OR IGNORE INTO discount_coupons (
      id, code, title, discount_type, discount_value, min_order_amount,
      max_discount_amount, usage_limit, usage_count, starts_at, expires_at, is_active,
      created_at, updated_at
    ) VALUES (
      1,
      'NOOVIN-VIP',
      'تخفیف ویژه جشنواره نوین‌نت',
      'percentage',
      15,
      10000000,
      2000000,
      500,
      124,
      NULL,
      '2027-03-20T00:00:00.000Z',
      1,
      datetime('now'),
      datetime('now')
    ), (
      2,
      'WELCOME',
      'تخفیف خوش‌آمدگویی خرید اول',
      'fixed',
      5000000,
      20000000,
      NULL,
      1000,
      412,
      NULL,
      '2027-03-20T00:00:00.000Z',
      1,
      datetime('now'),
      datetime('now')
    );
  `);

  const defaultSettingsSeed: Array<{ group: string; key: string; value: any; is_public: number }> = [
    {
      group: "appearance",
      key: "appearance.config",
      value: {
        topBannerEnabled: true,
        topBannerText: "جشنواره تخفیف‌های بهاره نوین‌نت: تا ۴۰٪ تخفیف روی انواع مودم 5G و سیم‌کارت‌های رند",
        topBannerBgColor: "#1E3A8A",
        topBannerTextColor: "#FFFFFF",
        topBannerLinkText: "مشاهده جشنواره",
        topBannerLinkUrl: "/store",
        brandPrimaryColor: "#2563EB",
        brandSecondaryColor: "#1D4ED8",
        brandAccentColor: "#DC2626",
        heroSlides: [
          {
            id: 1,
            title: "مودم‌های 5G نوین‌نت",
            subtitle: "اینترنت فوق پرسرعت، پینگ پایین و بدون قطعی با پوشش سراسری",
            image: "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=1000&auto=format&fit=crop&q=80",
            actionText: "مشاهده و خرید",
            category: "modem-internet",
            badge: "پیشنهاد ویژه نوین‌نت",
            overlayColor: "#0F172A",
            overlayOpacity: 72,
          },
        ],
      },
      is_public: 1,
    },
    {
      group: "static_content",
      key: "static_content.config",
      value: {
        about: {
          title: "درباره نوین‌نت",
          subtitle: "پیشگام در ارائه خدمات دیجیتال و ارتباطات نوین در کشور",
          heroImage: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=1200&auto=format&fit=crop&q=80",
          storyParagraphs: ["نوین‌نت از سال ۱۳۹۵ با هدف توسعه زیرساخت‌های اینترنت پرسرعت آغاز به کار کرد."],
          stats: [
            { value: "+۱۵۰,۰۰۰", label: "کاربر فعال سراسر کشور" },
            { value: "۹۹.۹٪", label: "پایداری شبکه و اتصال" },
          ],
        },
        contact: {
          phone: "021-88990011",
          email: "support@noovinnet.ir",
          address: "تهران، خیابان ولیعصر، برج فناوری ارتباطات، طبقه ۸",
        },
        footer: {
          copyrightText: "تمامی حقوق مادی و معنوی محفوظ است.",
        },
      },
      is_public: 1,
    },
    {
      group: "blog_posts",
      key: "blog_posts.posts",
      value: [
        {
          id: 1,
          title: "راهنمای جامع انتخاب مودم 5G برای خانه و محل کار",
          slug: "guide-to-choosing-5g-modem",
          summary: "بررسی فاکتورهای کلیدی در خرید مودم‌های نسل پنجم اینترنت پرسرعت.",
          content: "مودم‌های 5G امروزه به یکی از پرکاربردترین تجهیزات اتصال به اینترنت پرسرعت تبدیل شده‌اند...",
          cover_image: "https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=800&auto=format&fit=crop&q=80",
          author_name: "تیم فنی نوین‌نت",
          category: "تجهیزات شبکه",
          tags: ["مودم", "5G", "اینترنت پرسرعت"],
          reading_time_minutes: 6,
          published_at: "۱۴۰۳/۰۲/۱۵",
          views_count: 1420,
          is_published: true,
        },
      ],
      is_public: 1,
    },
    {
      group: "payment_gateways",
      key: "payment_gateways.items",
      value: [
        { id: "zibal", title: "زیبال (شاپرک)", is_active: true, is_default: true, description: "درگاه پرداخت امن بانکی شاپرک از طریق زیبال" },
        { id: "wallet", title: "کیف پول نوین‌نت", is_active: true, is_default: false, description: "پرداخت مستقیم از اعتبار حساب" },
        { id: "bank_transfer", title: "واریز به حساب / کارت به کارت", is_active: false, is_default: false, description: "انتقال بانکی و ثبت فیش واریزی" },
      ],
      is_public: 0,
    },
    {
      group: "sms_config",
      key: "sms_config.config",
      value: {
        provider: "kavenegar",
        is_active: true,
        sender_number: "10008899",
        welcome_template: "کاربر گرامی {name}، به نوین‌نت خوش آمدید.",
        otp_template: "کد تأیید ورود شما به نوین‌نت: {code}",
        order_status_template: "سفارش {order_id} در وضعیت {status} قرار گرفت.",
      },
      is_public: 0,
    },
    {
      group: "store_settings",
      key: "store_settings.config",
      value: {
        store_name: "فروشگاه آنلاین نوین‌نت",
        store_email: "info@noovinnet.ir",
        store_phone: "021-88990011",
        currency: "IRR",
        tax_percentage: 9,
        allow_guest_checkout: true,
        min_order_amount: 500000,
      },
      is_public: 0,
    },
    {
      group: "checkout_config",
      key: "checkout_config.config",
      value: {
        shipping: {
          allow_express: true,
          express_cost: 650000,
          standard_cost: 350000,
          free_shipping_threshold: 15000000,
        },
        payment: {
          allow_card_to_card: true,
          allow_wallet: true,
          allow_online: true,
        },
      },
      is_public: 0,
    },
  ];

    for (const s of defaultSettingsSeed) {
    db.run(
      `INSERT OR IGNORE INTO settings (key, value, "group", is_public, created_at, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [s.key, JSON.stringify(s.value), s.group, s.is_public]
    );
  }

  // Seed default service categories
  const defaultServiceCategories = [
    { id: 1, name: "خدمات خودرو", slug: "car-services", description: "استعلامات و خدمات اداری مربوط به خودرو و وسایل نقلیه", is_active: 1, sort_order: 10 },
    { id: 2, name: "شبکه و زیرساخت", slug: "network-and-infrastructure", description: "خدمات طراحی، نصب و پیکربندی شبکه‌های کامپیوتری و سازمانی", is_active: 1, sort_order: 20 },
    { id: 3, name: "ارتباطات رادیویی", slug: "radio-communications", description: "بهینه‌سازی سیگنال، تقویت آنتن و لینک‌های بی‌سیم", is_active: 1, sort_order: 30 },
    { id: 4, name: "مهندسی الکترونیک و نرم‌افزار", slug: "electronic-engineering", description: "طراحی سامانه‌های توکار، فریمور و بردهای صنعتی", is_active: 1, sort_order: 40 },
    { id: 5, name: "اتوماسیون صنعتی", slug: "industrial-automation", description: "مشاوره و پیاده‌سازی پروژه‌های پایش و اتوماسیون کارخانه‌ای", is_active: 1, sort_order: 50 },
  ];

  for (const cat of defaultServiceCategories) {
    db.run(
      `INSERT OR IGNORE INTO service_categories (id, name, slug, description, is_active, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [cat.id, cat.name, cat.slug, cat.description, cat.is_active, cat.sort_order]
    );
  }

  // Seed default service catalogs
  const defaultServices = [
    {
      id: 1,
      name: "استعلام جامع خودرو و خلافی",
      slug: "car-inquiry-services",
      category: "خدمات خودرو",
      service_category_id: 1,
      short_description: "بررسی آنلاین وضعیت، خلافی و سوابق خودرو در کمترین زمان",
      description: "سرویس یکپارچه بررسی سوابق بیمه، جریمه‌ها، عوارض سالیانه شهرداری و پلاک فعال.",
      estimated_base_price: 50000,
      currency: "IRR",
      icon: "Search",
      is_active: 1,
      documents: JSON.stringify([
        "شماره پلاک خودرو به‌صورت کامل و خوانا",
        "کد ملی مالک خودرو برای تطبیق اطلاعات",
        "شماره تماس در دسترس برای دریافت نتیجه و پیگیری",
      ]),
      steps: JSON.stringify([
        "اطلاعات و مدارک بالا را پیش از ارتباط آماده کنید.",
        "از راه ارتباطی مشخص‌شده درخواست خود را ثبت کنید.",
        "کارشناس نتیجهٔ استعلام و راهنمای اقدام بعدی را اعلام می‌کند.",
      ]),
      faq: JSON.stringify([
        { question: "برای این استعلام چه اطلاعاتی لازم است؟", answer: "شماره پلاک خودرو و کد ملی مالک؛ ممکن است در موارد خاص، اطلاعات تکمیلی نیز از شما خواسته شود." },
        { question: "نتیجهٔ استعلام چه زمانی اعلام می‌شود؟", answer: "زمان پاسخ بر اساس نوع استعلام و کامل‌بودن اطلاعات تعیین می‌شود و کارشناس هنگام ثبت درخواست آن را اعلام می‌کند." },
      ]),
      contact_type: "external",
      contact_url: "https://noovinnet.ir/contact",
      cta_label: "ارتباط با پشتیبانی نوین‌نت",
      required_fields: JSON.stringify([
        { name: "plate_number", label: "شماره پلاک خودرو", type: "text", required: true },
        { name: "national_code", label: "کد ملی مالک", type: "text", required: true },
      ]),
    },
    {
      id: 2,
      name: "راه‌اندازی شبکه سازمانی و کانفیگ میکروتیک",
      slug: "enterprise-network-setup",
      category: "شبکه و زیرساخت",
      service_category_id: 2,
      short_description: "طراحی، کابل‌کشی ساخت‌یافته و کانفیگ روترها و فایروال‌های امنیتی",
      description: "پیاده‌سازی شبکه‌های سیمی و بی‌سیم امن با تضمین پهنای باند و تفکیک دسترسی‌ها.",
      estimated_base_price: 25000000,
      currency: "IRR",
      icon: "Server",
      is_active: 1,
      documents: JSON.stringify([
        "آدرس محل اجرا و ساعات مجاز بازدید",
        "تعداد کاربران، طبقات و نقاط شبکهٔ موردنیاز",
        "فهرست تجهیزات موجود مانند روتر، سوئیچ و اکسس‌پوینت",
      ]),
      steps: JSON.stringify([
        "شرح نیاز و اطلاعات اولیه را برای کارشناسان ارسال کنید.",
        "بازدید یا جلسهٔ بررسی فنی هماهنگ می‌شود.",
        "طرح اجرا، برآورد و زمان‌بندی نهایی برای تأیید ارائه می‌شود.",
      ]),
      faq: JSON.stringify([
        { question: "آیا پیش از اجرا بازدید انجام می‌شود؟", answer: "بله، برای پروژه‌هایی که به بررسی محل نیاز دارند، زمان بازدید یا جلسهٔ آنلاین هماهنگ می‌شود." },
      ]),
      contact_type: "external",
      contact_url: "https://noovinnet.ir/contact",
      cta_label: "درخواست بررسی فنی",
      required_fields: JSON.stringify([
        { name: "company_name", label: "نام شرکت یا سازمان", type: "text", required: true },
        { name: "user_count", label: "تعداد تقریبی کلاینت‌ها و کاربران", type: "number", required: true },
      ]),
    },
    {
      id: 3,
      name: "نصب و بهینه‌سازی دکل و تقویت آنتن 4G/5G",
      slug: "antenna-booster-installation",
      category: "ارتباطات رادیویی",
      service_category_id: 3,
      short_description: "سایت‌سروی میدانی، نصب آنتن‌های MIMO بیرونی و رفع نقاط کور اینترنت",
      description: "تقویت سیگنال برای کارخانجات، کارگاه‌ها و ویلاهای حاشیه شهر که با مشکل آنتن‌دهی مواجه هستند.",
      estimated_base_price: 18000000,
      currency: "IRR",
      icon: "Wifi",
      is_active: 1,
      documents: JSON.stringify([
        "آدرس دقیق محل نصب و تصویر تقریبی از محیط",
        "نام اپراتور یا اپراتورهای مورد استفاده در محل",
        "شماره تماس شخص حاضر در محل برای هماهنگی بازدید",
      ]),
      steps: JSON.stringify([
        "موقعیت و مشکل آنتن‌دهی را برای کارشناس ارسال کنید.",
        "شرایط محل و امکان‌سنجی اولیه بررسی می‌شود.",
        "زمان اجرا و تجهیزات پیشنهادی پس از تأیید شما هماهنگ خواهد شد.",
      ]),
      faq: JSON.stringify([
        { question: "آیا پیش از نصب قدرت سیگنال بررسی می‌شود؟", answer: "بله، ارزیابی اولیه برای انتخاب محل و تجهیزات مناسب انجام می‌شود." },
      ]),
      contact_type: "external",
      contact_url: "https://noovinnet.ir/contact",
      cta_label: "درخواست ارزیابی محل",
      required_fields: JSON.stringify([
        { name: "location_address", label: "آدرس دقیق موقعیت مکانی", type: "text", required: true },
      ]),
    },
    {
      id: 4,
      name: "طراحی و توسعه فریمور سامانه‌های توکار",
      slug: "embedded-firmware-development",
      category: "مهندسی الکترونیک و نرم‌افزار",
      service_category_id: 4,
      short_description: "طراحی نرم‌افزارهای بلادرنگ (RTOS) و درایورهای سخت‌افزاری سفارشی",
      description: "ارائه خدمات جامع مهندسی برای پیاده‌سازی فریمور بر روی میکروکنترلرهای ARM Cortex-M، ESP32 و بردهای صنعتی.",
      estimated_base_price: 50000000,
      currency: "IRR",
      icon: "Cpu",
      is_active: 1,
      documents: JSON.stringify([]),
      steps: JSON.stringify([
        "ارسال شرح نیازمندی‌ها و مشخصات سخت‌افزار",
        "بررسی فنی، امکان‌سنجی و برآورد زمان‌بندی",
        "صدور پیش‌فاکتور رسمی و تأیید مشتری",
        "طراحی، تست و تحویل مستندات و کد سورس",
      ]),
      faq: JSON.stringify([
        { question: "کدام میکروکنترلرها پشتیبانی می‌شوند؟", answer: "تمامی میکروکنترلرهای خانواده STM32, ESP32, NXP و بردهای صنعتی مبتنی بر هسته ARM." },
      ]),
      contact_type: "external",
      contact_url: "https://noovinnet.ir/contact",
      cta_label: "ثبت درخواست پروژه",
      required_fields: JSON.stringify([
        { name: "mcu_architecture", label: "معماری میکروکنترلر / سخت‌افزار", type: "text", required: true },
        { name: "protocols", label: "پروتکل‌های ارتباطی مورد نیاز", type: "text", required: false },
      ]),
    },
    {
      id: 5,
      name: "مشاوره و پیاده‌سازی اینترنت اشیاء صنعتی (IIoT)",
      slug: "industrial-iot-consultation",
      category: "اتوماسیون صنعتی",
      service_category_id: 5,
      short_description: "پایش برخط خطوط تولید، مانیتورینگ سنسورها و داشبوردهای اسکادا",
      description: "طراحی معماری کامل اتصال تجهیزات کارخانه‌ای به سرورهای محلی یا ابری با رعایت استانداردهای امنیت صنعتی.",
      estimated_base_price: 80000000,
      currency: "IRR",
      icon: "Activity",
      is_active: 1,
      documents: JSON.stringify([]),
      steps: JSON.stringify([
        "بررسی اولیه توپولوژی خط تولید و سنسورها",
        "ارائه معماری شبکه و انتخاب پروتکل‌های صنعتی (Modbus, MQTT, OPC-UA)",
        "پیاده‌سازی گیت‌وی و داشبورد پایش آنلاین",
      ]),
      faq: JSON.stringify([
        { question: "آیا امنیت داده‌ها در شبکه محلی حفظ می‌شود؟", answer: "بله، امکان استقرار سرور محلی (On-Premise) بدون نیاز به خروج داده‌ها از شبکه کارخانه وجود دارد." },
      ]),
      contact_type: "external",
      contact_url: "https://noovinnet.ir/contact",
      cta_label: "مشاوره فنی",
      required_fields: JSON.stringify([
        { name: "plant_scale", label: "مقیاس خط تولید و تعداد نودها", type: "text", required: true },
      ]),
    },
  ];

  for (const s of defaultServices) {
    db.run(
      `INSERT OR IGNORE INTO service_catalogs (
        id, name, slug, category, service_category_id, short_description, description,
        estimated_base_price, currency, icon, is_active, required_fields, documents,
        steps, faq, contact_type, contact_url, cta_label, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [
        s.id, s.name, s.slug, s.category, s.service_category_id, s.short_description, s.description,
        s.estimated_base_price, s.currency, s.icon, s.is_active, s.required_fields, s.documents,
        s.steps, s.faq, s.contact_type, s.contact_url, s.cta_label,
      ]
    );
  }

  // Seed Product, Variant, Inventory, and Image tables
  seedProductTables(db);
}

export function seedProductTables(db: Database): void {
  try {
    const countRes = db.exec("SELECT COUNT(*) FROM products");
    const count = countRes.length > 0 && countRes[0].values.length > 0 ? Number(countRes[0].values[0][0]) : 0;
    if (count > 0) {
      return;
    }
  } catch (err) {
    console.error("Error checking products count:", err);
    return;
  }

  let initialProducts: any[] = [];
  try {
    const jsonPath = path.join(process.cwd(), "database", "admin_products.json");
    if (fs.existsSync(jsonPath)) {
      const content = fs.readFileSync(jsonPath, "utf-8");
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        initialProducts = parsed;
      }
    }
  } catch (err) {
    console.error("Could not read admin_products.json for initial SQLite migration:", err);
  }

  for (const defProd of DEFAULT_PRODUCTS_LIST) {
    if (!initialProducts.some((p) => p.id === defProd.id)) {
      initialProducts.push(defProd);
    }
  }

  for (const p of initialProducts) {
    const categoryId = p.category_id !== undefined && p.category_id !== null ? Number(p.category_id) : null;
    const basePrice = Number(p.base_price || 0);
    const originalPrice = p.original_price !== undefined && p.original_price !== null ? Number(p.original_price) : basePrice;
    const discountPercent = p.discount_percent !== undefined && p.discount_percent !== null ? Number(p.discount_percent) : (p.discount_percentage !== undefined ? Number(p.discount_percentage) : null);
    const discountPrice = p.discount_price !== undefined && p.discount_price !== null ? Number(p.discount_price) : null;
    const effectivePrice = p.effective_price !== undefined && p.effective_price !== null ? Number(p.effective_price) : (discountPrice !== null ? discountPrice : basePrice);
    const comparePrice = p.compare_price !== undefined && p.compare_price !== null ? Number(p.compare_price) : null;
    const currency = p.currency || "IRR";
    const isActive = p.is_active === false || p.is_active === 0 ? 0 : 1;
    const isFeatured = p.is_featured ? 1 : 0;
    const imagesJson = JSON.stringify(Array.isArray(p.images) ? p.images : (p.image_url ? [p.image_url] : []));
    const attributesJson = JSON.stringify(p.attributes || {});
    const colorsJson = p.colors ? JSON.stringify(p.colors) : null;
    const variantOptionsJson = p.variant_options ? JSON.stringify(p.variant_options) : null;

    const variants = Array.isArray(p.variants) ? p.variants : [];
    let totalStock = variants.reduce((sum: number, v: any) => sum + Number(v.stock_quantity ?? v.stock ?? v.inventory?.quantity ?? 0), 0);
    if (variants.length === 0) {
      totalStock = Number(p.stock_quantity ?? p.initial_stock ?? 0);
    }
    const inStock = totalStock > 0 ? 1 : 0;

    db.run(
      `INSERT OR IGNORE INTO products (
        id, category_id, name, slug, sku, description, short_description,
        base_price, compare_price, original_price, discount_percent, discount_price, effective_price,
        currency, is_active, is_featured, images, attributes, colors, variant_options,
        meta_title, meta_description, stock_quantity, initial_stock, in_stock,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [
        p.id, categoryId, p.name, p.slug || `product-${p.id}`, p.sku || `SKU-${p.id}`,
        p.description || "", p.short_description || null,
        basePrice, comparePrice, originalPrice, discountPercent, discountPrice, effectivePrice,
        currency, isActive, isFeatured, imagesJson, attributesJson, colorsJson, variantOptionsJson,
        p.meta_title || null, p.meta_description || null, totalStock, totalStock, inStock,
      ]
    );

    const imageList: string[] = Array.isArray(p.images) && p.images.length > 0 ? p.images : (p.image_url ? [p.image_url] : []);
    for (let i = 0; i < imageList.length; i++) {
      db.run(
        `INSERT OR IGNORE INTO product_images (product_id, image_url, is_primary, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [p.id, imageList[i], i === 0 ? 1 : 0, i * 10]
      );
    }

    for (let idx = 0; idx < variants.length; idx++) {
      const v = variants[idx];
      const vId = Number(v.id || (p.id * 1000 + idx + 1));
      const vName = v.name || "استاندارد";
      const vSku = v.sku || `${p.sku || 'SKU'}-V${idx + 1}`;
      const vPriceOverride = v.price_override !== undefined && v.price_override !== null ? Number(v.price_override) : null;
      const vOriginalPrice = v.original_price !== undefined && v.original_price !== null ? Number(v.original_price) : (vPriceOverride !== null ? vPriceOverride : basePrice);
      const vDiscountPercent = v.discount_percent !== undefined && v.discount_percent !== null ? Number(v.discount_percent) : (v.discount_percentage !== undefined ? Number(v.discount_percentage) : null);
      const vDiscountPrice = v.discount_price !== undefined && v.discount_price !== null ? Number(v.discount_price) : null;
      const vEffectivePrice = v.effective_price !== undefined && v.effective_price !== null ? Number(v.effective_price) : (v.price !== undefined ? Number(v.price) : (vDiscountPrice !== null ? vDiscountPrice : (vPriceOverride !== null ? vPriceOverride : basePrice)));
      const vPrice = vEffectivePrice;
      const vStock = Number(v.stock_quantity ?? v.stock ?? v.inventory?.quantity ?? 0);
      const vAttributesJson = JSON.stringify(v.attributes || {});
      const vImageUrl = v.image_url || v.attributes?.image_url || null;
      const vImagesJson = JSON.stringify(Array.isArray(v.images) ? v.images : (vImageUrl ? [vImageUrl] : []));
      const vIsActive = v.is_active === false || v.is_active === 0 ? 0 : 1;

      db.run(
        `INSERT OR IGNORE INTO product_variants (
          id, product_id, name, sku, price_override, original_price, discount_percent,
          discount_price, effective_price, price, stock, stock_quantity, attributes,
          image_url, images, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [
          vId, p.id, vName, vSku, vPriceOverride, vOriginalPrice, vDiscountPercent,
          vDiscountPrice, vEffectivePrice, vPrice, vStock, vStock, vAttributesJson,
          vImageUrl, vImagesJson, vIsActive,
        ]
      );

      const invQuantity = Number(v.inventory?.quantity ?? vStock);
      const invReserved = Number(v.inventory?.reserved_quantity ?? 0);
      const invSafety = Number(v.inventory?.safety_threshold ?? 0);

      db.run(
        `INSERT OR IGNORE INTO inventory (
          product_variant_id, quantity, reserved_quantity, safety_threshold, created_at, updated_at
        ) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [vId, invQuantity, invReserved, invSafety]
      );
    }
  }
}

export function formatProductFromDb(db: Database, pRow: any): any {
  const pId = Number(pRow.id);

  const variantRows = queryRows(
    db,
    `SELECT pv.*, i.quantity as inv_quantity, i.reserved_quantity as inv_reserved, i.safety_threshold as inv_safety
     FROM product_variants pv
     LEFT JOIN inventory i ON i.product_variant_id = pv.id
     WHERE pv.product_id = ?
     ORDER BY pv.id ASC`,
    [pId]
  );

  const imageRows = queryRows(
    db,
    `SELECT image_url, is_primary, sort_order
     FROM product_images
     WHERE product_id = ?
     ORDER BY sort_order ASC, id ASC`,
    [pId]
  );

  let images: string[] = [];
  try {
    images = JSON.parse(pRow.images || "[]");
  } catch {
    images = [];
  }
  if (imageRows.length > 0) {
    images = imageRows.map((r: any) => r.image_url);
  }

  let attributes: Record<string, any> = {};
  try {
    attributes = JSON.parse(pRow.attributes || "{}");
  } catch {
    attributes = {};
  }

  let colors: any[] | undefined = undefined;
  if (pRow.colors) {
    try {
      colors = JSON.parse(pRow.colors);
    } catch {
      colors = undefined;
    }
  }

  let variantOptions: any[] | undefined = undefined;
  if (pRow.variant_options) {
    try {
      variantOptions = JSON.parse(pRow.variant_options);
    } catch {
      variantOptions = undefined;
    }
  }

  const basePrice = Number(pRow.base_price || 0);

  const variants = variantRows.map((vRow: any) => {
    let vAttributes: Record<string, any> = {};
    try {
      vAttributes = JSON.parse(vRow.attributes || "{}");
    } catch {
      vAttributes = {};
    }

    let vImages: string[] = [];
    try {
      vImages = JSON.parse(vRow.images || "[]");
    } catch {
      vImages = [];
    }
    if (vImages.length === 0 && vRow.image_url) {
      vImages = [vRow.image_url];
    }

    const priceOverride = vRow.price_override !== null && vRow.price_override !== undefined ? Number(vRow.price_override) : null;
    const origPrice = vRow.original_price !== null && vRow.original_price !== undefined ? Number(vRow.original_price) : (priceOverride !== null ? priceOverride : basePrice);
    const discPercent = vRow.discount_percent !== null && vRow.discount_percent !== undefined ? Number(vRow.discount_percent) : undefined;
    const discPrice = vRow.discount_price !== null && vRow.discount_price !== undefined ? Number(vRow.discount_price) : null;
    const effPrice = vRow.effective_price !== null && vRow.effective_price !== undefined ? Number(vRow.effective_price) : (vRow.price !== null && vRow.price !== undefined ? Number(vRow.price) : (discPrice !== null ? discPrice : (priceOverride !== null ? priceOverride : basePrice)));

    const invQty = Number(vRow.inv_quantity ?? vRow.stock_quantity ?? vRow.stock ?? 0);
    const invRes = Number(vRow.inv_reserved ?? 0);
    const invSafety = Number(vRow.inv_safety ?? 0);

    return {
      id: Number(vRow.id),
      product_id: pId,
      name: String(vRow.name || "استاندارد"),
      sku: String(vRow.sku || `SKU-${vRow.id}`),
      price_override: priceOverride,
      base_price: basePrice,
      original_price: origPrice,
      discount_price: discPrice,
      discount_percent: discPercent,
      discount_percentage: discPercent,
      price: effPrice,
      effective_price: effPrice,
      stock_quantity: invQty,
      stock: invQty,
      inventory: {
        quantity: invQty,
        reserved_quantity: invRes,
        safety_threshold: invSafety,
      },
      is_active: Boolean(vRow.is_active),
      image_url: vRow.image_url || undefined,
      images: vImages,
      attributes: vAttributes,
    };
  });

  const activeVariants = variants.filter((v: any) => v.is_active);
  const totalStock = variants.length > 0
    ? activeVariants.reduce((sum: number, v: any) => sum + (v.stock_quantity || 0), 0)
    : Number(pRow.stock_quantity || 0);

  const inStock = totalStock > 0;

  let categorySlug: string | undefined = undefined;
  let categoryName: string | undefined = undefined;
  let subcategorySlug: string | undefined = undefined;
  let subSubcategorySlug: string | undefined = undefined;
  let categoryPath: string[] = [];
  let categoryObj: { id: number; name: string; slug: string } | null = null;

  if (pRow.category_id !== null && pRow.category_id !== undefined) {
    const catId = Number(pRow.category_id);
    const catRows = queryRows(db, "SELECT id, parent_id, name, slug FROM categories WHERE id = ?", [catId]);
    if (catRows.length > 0) {
      const cat = catRows[0];
      categoryObj = { id: Number(cat.id), name: String(cat.name), slug: String(cat.slug) };
      categoryName = String(cat.name);

      const chain: Array<{ id: number; name: string; slug: string; parent_id: number | null }> = [cat];
      let currentParentId = cat.parent_id !== null && cat.parent_id !== undefined ? Number(cat.parent_id) : null;
      while (currentParentId !== null && currentParentId !== undefined && currentParentId > 0) {
        const parentRows = queryRows(db, "SELECT id, parent_id, name, slug FROM categories WHERE id = ?", [currentParentId]);
        if (parentRows.length > 0) {
          const parentCat = parentRows[0];
          chain.unshift(parentCat);
          currentParentId = parentCat.parent_id !== null && parentCat.parent_id !== undefined ? Number(parentCat.parent_id) : null;
        } else {
          break;
        }
      }

      categoryPath = chain.map((c) => String(c.slug));
      if (chain.length === 1) {
        categorySlug = chain[0].slug;
      } else if (chain.length === 2) {
        categorySlug = chain[0].slug;
        subcategorySlug = chain[1].slug;
      } else if (chain.length >= 3) {
        categorySlug = chain[0].slug;
        subcategorySlug = chain[1].slug;
        subSubcategorySlug = chain[2].slug;
      }
    }
  }

  return {
    id: pId,
    category_id: pRow.category_id !== null && pRow.category_id !== undefined ? Number(pRow.category_id) : null,
    category: categoryObj,
    category_name: categoryName,
    category_slug: categorySlug,
    subcategory_slug: subcategorySlug,
    sub_subcategory_slug: subSubcategorySlug,
    category_path: categoryPath.length > 0 ? categoryPath : undefined,
    name: String(pRow.name),
    slug: String(pRow.slug),
    sku: String(pRow.sku),
    description: String(pRow.description || ""),
    short_description: pRow.short_description || undefined,
    base_price: basePrice,
    compare_price: pRow.compare_price !== null && pRow.compare_price !== undefined ? Number(pRow.compare_price) : undefined,
    original_price: pRow.original_price !== null && pRow.original_price !== undefined ? Number(pRow.original_price) : basePrice,
    discount_percent: pRow.discount_percent !== null && pRow.discount_percent !== undefined ? Number(pRow.discount_percent) : undefined,
    discount_percentage: pRow.discount_percent !== null && pRow.discount_percent !== undefined ? Number(pRow.discount_percent) : undefined,
    discount_price: pRow.discount_price !== null && pRow.discount_price !== undefined ? Number(pRow.discount_price) : undefined,
    effective_price: pRow.effective_price !== null && pRow.effective_price !== undefined ? Number(pRow.effective_price) : (pRow.discount_price !== null && pRow.discount_price !== undefined ? Number(pRow.discount_price) : basePrice),
    currency: String(pRow.currency || "IRR"),
    stock_quantity: totalStock,
    initial_stock: totalStock,
    in_stock: inStock,
    is_active: Boolean(pRow.is_active),
    is_featured: Boolean(pRow.is_featured),
    images,
    gallery_urls: images,
    colors,
    variant_options: variantOptions,
    attributes,
    variants,
    created_at: pRow.created_at,
    updated_at: pRow.updated_at,
  };
}

export function queryProductsFromDatabase(db: Database, idOrSlug?: string | number): any[] {
  let productRows: any[] = [];
  if (idOrSlug !== undefined && idOrSlug !== null) {
    if (typeof idOrSlug === "number" || (!isNaN(Number(idOrSlug)) && !isNaN(parseFloat(String(idOrSlug))))) {
      productRows = queryRows(db, "SELECT * FROM products WHERE id = ? LIMIT 1", [Number(idOrSlug)]);
    } else {
      productRows = queryRows(db, "SELECT * FROM products WHERE slug = ? LIMIT 1", [String(idOrSlug)]);
    }
  } else {
    productRows = queryRows(db, "SELECT * FROM products ORDER BY id DESC");
  }

  return productRows.map((pRow) => formatProductFromDb(db, pRow));
}

export function queryRows(db: Database, sql: string, params: any[] = []): any[] {
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

export function recordAuditLog(
  db: Database,
  log: {
    userId?: number | null;
    action: string;
    entityType: string;
    entityId?: number | null;
    ipAddress?: string;
    userAgent?: string;
    metadata?: any;
  }
) {
  try {
    const meta = log.metadata ? JSON.stringify(log.metadata) : null;
    const now = new Date().toISOString();
    db.run(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address, user_agent, redacted_metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        log.userId || null,
        log.action,
        log.entityType,
        log.entityId || null,
        log.ipAddress || null,
        log.userAgent || null,
        meta,
        now,
      ]
    );
  } catch (err) {
    console.error("Failed to record audit log:", err);
  }
}


