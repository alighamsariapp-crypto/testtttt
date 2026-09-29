# Database Architecture & Migration Roadmap

## Storage Engine: MariaDB / MySQL InnoDB
- Foreign keys enabled.
- UTF-8 MB4 charset (`utf8mb4_unicode_ci`).
- Explicit indexes on lookup keys and foreign keys.

---

## Migration Schedule by Phase

### Phase 2: Technical Foundation (Implemented)
- `2026_01_01_000001_create_sessions_table.php` (`sessions`)
- `2026_01_01_000002_create_jobs_and_failed_jobs_table.php` (`jobs`, `job_batches`, `failed_jobs`)
- `2026_01_01_000003_create_personal_access_tokens_table.php` (`personal_access_tokens`)
- `2026_01_01_000004_create_settings_table.php` (`settings`)

### Phase 3: Auth & Users (Deferred)
- `users` (id, role ENUM['customer','staff','admin'], name, email UNIQUE, password, timestamps)
- `user_addresses` (id, user_id FK, type, recipient_name, phone, province, city, postal_code, address_line, is_default)

### Phase 4: Catalog (Deferred)
- `categories` (id, parent_id FK, name, slug UNIQUE, is_active, sort_order)
- `products` (id, category_id FK, name, slug UNIQUE, sku UNIQUE, base_price, compare_price, is_active, is_featured)
- `product_variants` (id, product_id FK, sku UNIQUE, name, price_override, attributes JSON, is_active)

### Phase 5: Cart & Inventory (Deferred)
- `inventory` (id, product_variant_id FK UNIQUE, quantity, reserved_quantity, safety_threshold)
- `carts` (id, user_id FK NULLABLE, session_id NULLABLE)
- `cart_items` (id, cart_id FK, product_variant_id FK, quantity)

### Phase 6: Orders (Deferred)
- `orders` (id, order_number UNIQUE, user_id FK, status, subtotal, discount_total, tax_total, shipping_total, grand_total, shipping_address_snapshot JSON, billing_address_snapshot JSON)
- `order_items` (id, order_id FK, product_variant_id, product_name_snapshot, variant_sku_snapshot, variant_attributes_snapshot JSON, unit_price, quantity, discount_amount, tax_amount, total_price)

### Phase 7: Payments (Deferred)
- `payments` (id, order_id FK, gateway, amount, currency, status, reference_id)
- `payment_transactions` (id, payment_id FK, idempotency_key UNIQUE, event_type, payload JSON, is_reconciled)

### Phase 8: Services (Deferred)
- `service_catalogs`
- `service_requests`
- `service_quotes`
- `service_timelines`

### Phase 9: Admin & Security (Deferred)
- `audit_logs` (id, user_id, action, entity_type, entity_id, ip_address, user_agent, redacted_metadata JSON, created_at)
