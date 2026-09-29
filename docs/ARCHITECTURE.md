# Master Architecture Specification

## Project: NOOVINNET / APEXSTORE
**Architecture Style:** Modular Monolith  
**Runtime:** Laravel 12 / PHP 8.3  
**Target Infrastructure:** DirectAdmin Shared Hosting (5 CPU, 5 GB RAM, 5 GB NVMe SSD, MariaDB/MySQL InnoDB, OPcache, File Cache, Database Queue, 1-Min Cron)

---

## 1. Domain Modules
1. **`Auth`** (Phase 3): Registration, Sanctum token lifecycle, session handling.
2. **`Users`** (Phase 3): Profiles, addresses, role bindings.
3. **`Categories`** (Phase 4): Taxonomy tree, SEO metadata, parent/child relationships.
4. **`Products`** (Phase 4): Multi-attribute variants, SKUs, pricing metadata.
5. **`Inventory`** (Phase 5): Authoritative stock ledger, pessimistic locking (`lockForUpdate`).
6. **`Cart`** (Phase 5): Server-side cart management, session-to-user merge.
7. **`Orders`** (Phase 6): Zero-trust calculation engine, immutable historical price snapshots.
8. **`Payments`** (Phase 7): Gateway abstraction (`PaymentGatewayInterface`), Stripe, PayPal, Bank Transfer, Idempotent webhooks.
9. **`Services`** (Phase 8): Engineering/technical service catalog, custom requests, quotes, timelines.
10. **`Admin`** (Phase 9): Health diagnostics, audit log browser, administrative operations.
11. **`Shared`** (Phase 2): Cross-cutting Kernel (Money, DTOs, Redaction, Exceptions, Responses).

---

## 2. Hard Infrastructure & Architecture Constraints
- **Single Authoritative API Backend**: Laravel 12 (PHP 8.3) is the ONLY production backend and the ONLY authoritative implementation of `/api/v1/*`. Express/Node.js is strictly for local dev/preview and frontend compilation.
- **NO Redis:** All caching uses NVMe File Cache (`CACHE_STORE=file`).
- **NO Supervisor / systemd:** Background tasks run via `QUEUE_CONNECTION=database` and short-lived DirectAdmin cron processes.
- **NO Docker in Production:** Direct deployment to shared hosting public_html structure.
