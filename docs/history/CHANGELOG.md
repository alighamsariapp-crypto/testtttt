# Changelog — NoovinNet / ApexStore Backend

All notable changes to this project are documented in this file.

## [1.0.0] - 2026-08-19

### Added
- **Core Foundation**:
  - Modular Monolith architecture under `app/Modules/`.
  - PHP 8.3 & Laravel 12 foundation with Sanctum authentication.
  - Shared Kernel (`Money` VO, `ApiResponseHelper`, `RedactionHelper`, standard exceptions, security headers).
  - Complete 14-table InnoDB database migration suite.
- **Auth & Users**:
  - Registration, token login, logout, password recovery, email verification.
  - Role-based access control (`customer`, `staff`, `admin`) via `AuthenticateRole` middleware.
  - Profile and multi-address management with customer isolation.
- **Categories & Products**:
  - Hierarchical category tree with automated NVMe file caching and cache invalidation.
  - Product catalog with variants (SKU), attributes, multi-filtering, and search.
- **Cart & Inventory**:
  - Shopping cart with live server-side calculations and VAT calculation.
  - Inventory management with atomic pessimistic row-locking (`lockForUpdate`).
- **Orders & Checkout**:
  - Atomic zero-trust checkout transaction with automatic inventory decrement.
  - Order snapshot preservation for products, variants, and shipping/billing addresses.
- **Payments**:
  - Payment gateway contract (`PaymentGatewayInterface`).
  - Implementations for Test Gateway, Stripe, PayPal, and Bank Transfer.
  - Webhook processor with signature verification and Idempotency key tracking.
- **Services (Professional & Engineering)**:
  - Service catalog, custom request submission, quotation generation, and customer approval/rejection.
  - Project milestone timelines.
- **Admin Back-Office & Security**:
  - Real-time dashboard KPI metrics and recent activity feeds.
  - User and order status lifecycle management.
  - Service quotation and staff assignment tools.
  - `AuditLogService` with metadata redaction for security compliance.
- **Tests & Documentation**:
  - Feature test suites for Auth, Products, Cart, Services, and Admin access.
  - Full OpenAPI-aligned API documentation (`docs/API.md`).
  - DirectAdmin shared hosting deployment and cron guide (`docs/DEPLOYMENT.md`).
