# ApexStore / NoovinNet — Comprehensive API Specification (v1)

Base URL: `/api/v1`

All responses adhere to the standard envelope:
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful",
  "error_code": null,
  "errors": null
}
```

---

## 1. System, Health & Diagnostics
- `GET /api/v1/health` (and `/health`): Hardened public liveness endpoint.
  - Returns minimal stable schema: `{ "status": "healthy", "version": "1.0.0", "timestamp": "..." }`.
  - Strictly prevents information disclosure: does NOT expose `APP_ENV`, driver configurations (cache/queue/session), database credentials, server hostnames, or filesystem paths.
- `GET /api/v1/diagnostics` (and `/api/v1/admin/diagnostics`): Protected readiness and diagnostics endpoint.
  - Requires `auth:sanctum` with `admin` or `staff` role.
  - Verifies readiness of core dependencies (database connectivity, cache responsiveness, and storage writability) without disclosing infrastructure implementation details.

---

## 2. Authentication (`/api/v1/auth`)
- `POST /register`: Registers a new customer account and generates Sanctum token.
- `POST /login`: Authenticates credentials and returns access token and user profile.
- `POST /logout`: Revokes active token (Requires `auth:sanctum`).
- `GET /me`: Returns current authenticated user (Requires `auth:sanctum`).
- `POST /change-password`: Updates password (Requires `auth:sanctum`).
- `POST /forgot-password`: Issues secure password reset token.
- `POST /reset-password`: Validates token and updates password.

---

## 3. Users & Profiles (`/api/v1/users`)
- `GET /me`: Full profile details.
- `PATCH /me`: Update personal profile information.
- `GET /addresses`: List saved customer addresses.
- `POST /addresses`: Save new address.
- `PUT /addresses/{id}`: Update existing address.
- `DELETE /addresses/{id}`: Delete address.

---

## 4. Categories (`/api/v1/categories`)
- `GET /`: Retrieve hierarchical category tree (cached on NVMe).
- `GET /{slug}`: Category details and nested subcategories.
- `POST /`: Create category (Admin/Staff only).
- `PUT /{id}`: Update category (Admin/Staff only).
- `DELETE /{id}`: Delete category (Admin only).

---

## 5. Products Catalog (`/api/v1/products`)
- `GET /`: Paginated list of products with filters (`category_id`, `category_slug`, `search`, `min_price`, `max_price`, `sort`, `featured`).
- `GET /{slug}`: Full product specifications, variant list, and stock status.
- `POST /`: Create product and variants (Admin/Staff only).
- `PUT /{id}`: Update product (Admin/Staff only).
- `DELETE /{id}`: Delete product (Admin only).

---

## 6. Shopping Cart (`/api/v1/cart`)
- `GET /`: Retrieve live shopping cart summary with server-calculated subtotals and VAT.
- `POST /items`: Add variant item to cart (`product_variant_id`, `quantity`).
- `PATCH /items/{item}`: Update item quantity.
- `DELETE /items/{item}`: Remove item from cart.
- `DELETE /`: Empty the entire cart.

---

## 7. Checkout & Orders (`/api/v1/checkout`, `/api/v1/orders`)
- `POST /checkout`: Zero-trust atomic transaction validating inventory with row-locks, calculating server totals, creating order snapshot and initializing payment intent.
- `GET /orders`: Paginated list of authenticated customer's past orders.
- `GET /orders/{order}`: Full details of an order, line items, and payment transactions.
- `POST /orders/{id}/cancel`: Customer cancellation for pending orders.

---

## 8. Payments & Webhooks (`/api/v1/payments`)
- `POST /webhooks/{gateway}`: Webhook receiver with signature verification and Idempotency key tracking (`test`, `stripe`, `paypal`, `bank_transfer`).
- `GET /test/simulate?reference={ref}`: Simulates successful gateway callback for development.

---

## 9. Engineering & Professional Services (`/api/v1/services`, `/api/v1/service-requests`)
- `GET /services`: Active services catalog.
- `GET /services/{slug}`: Specific service details and dynamic requirements schema.
- `GET /service-requests`: Customer's service requests list.
- `POST /service-requests`: Submit new service request with custom requirements and attachments.
- `GET /service-requests/{requestNumber}`: Full request history, active quote, and milestones.
- `POST /service-requests/quotes/{quoteId}/respond`: Customer accept/reject quote response.

---

## 10. Admin Back-Office (`/api/v1/admin`) — *(Admin & Staff only)*
- `GET /dashboard`: Consolidated high-level KPIs, revenue, pending orders, and pending service tickets.
- `GET /users`: Paginated user list with role and status filtering.
- `PATCH /users/{id}/status`: Activate, suspend, or change role of a user.
- `GET /orders`: Admin view of all customer orders.
- `PATCH /orders/{id}/status`: Transition order lifecycle (`processing`, `shipped`, `completed`, `cancelled`).
- `GET /services/requests`: All submitted customer service requests.
- `POST /services/requests/{id}/quotes`: Staff creates formal quote for service request.
- `PATCH /services/requests/{id}/status`: Update ticket lifecycle and assign staff.
- `GET /audit-logs`: Audit trail browser with redacted metadata and actor tracking.
