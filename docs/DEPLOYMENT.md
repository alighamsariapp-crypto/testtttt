# DirectAdmin Shared Hosting Deployment & Maintenance Guide

## 1. Hosting Environment Specifications & Architectural Authority
- **Production API Backend**: Laravel 12 (PHP 8.3 / Apache / PHP-FPM). **Laravel is the ONLY authoritative backend for `/api/v1/*` in production.**
- **Express / Node.js**: Strictly development-only (Vite middleware and local dev SQLite mock adapter). Express MUST NOT be run as an API server in production.
- **Target OS**: CloudLinux / AlmaLinux / CentOS
- **Control Panel**: DirectAdmin
- **CPU / Memory / Storage**: 5 CPU Cores / 5 GB RAM / 5 GB NVMe SSD
- **PHP Version**: PHP 8.3 with OPcache and PHP-FPM
- **Required PHP Extensions**:
  - `ext-gd` (**Strict Requirement**: must be compiled/enabled with JPEG, PNG, and WebP support for `SafeImageUploadService` re-encoding and payload neutralization).
  - `ext-fileinfo` (MIME detection based on binary magic bytes).
  - `ext-pdo_mysql`, `ext-mbstring`, `ext-openssl`, `ext-curl`, `ext-bcmath`.
- **Database**: MySQL 8.0+ / MariaDB 10.6+ with InnoDB

### Node.js, pnpm & Package Manager Standard
- **Authoritative Package Manager**: `pnpm` (declared via `"packageManager": "pnpm@9.15.4+..."` in `package.json`).
- **Required Node.js Version**: Node.js `>= 20.18.0` (Recommended: Node 22 LTS).
- **Corepack**: Enable via `corepack enable` so the system automatically uses the pinned pnpm version.
- **Single Lockfile Authority**: `pnpm-lock.yaml` is the ONLY authoritative lockfile in this repository. Conflicting lockfiles (`bun.lock`, `package-lock.json`, `yarn.lock`) are strictly prohibited and removed.
- **Approved Build Scripts (`onlyBuiltDependencies`)**: In compliance with pnpm security guidelines, native compilation dependencies (`esbuild`, `sharp`) are declared in `pnpm-workspace.yaml`. This ensures reproducible installs (`pnpm install --frozen-lockfile`) run without interactive prompts or ignored build script failures.

### DirectAdmin Production Frontend Build Architecture (No Node Server in Production)
- **Zero Node Server at Runtime**: DirectAdmin shared hosting does NOT run a Node.js daemon or Express API server in production. `server.ts` and `devApiAdapter.ts` are strictly dev/preview fixtures and are forbidden from running in production (`NODE_ENV=production`).
- **Build-Time Compilation**:
  1. Frontend assets are compiled during CI/CD or prior to deployment via:
     ```bash
     pnpm install --frozen-lockfile
     pnpm lint
     pnpm build
     ```
  2. Vite bundles React application assets into static hashed files in `public/assets/` and writes the SPA entrypoint to `public/index.html`; this is the only frontend artifact used by the Laravel/Apache deployment.
- **Direct Web-Server Delivery**:
  - DirectAdmin's Apache / LiteSpeed web server serves all static files (`.js`, `.css`, `.png`, `.webp`, `.html`) directly from `public_html/` with high-performance caching and non-executable MIME security headers.
  - All dynamic API calls (`/api/v1/*`) are routed via `.htaccess` to Laravel's front controller (`public/index.php`), processed by PHP 8.3 / PHP-FPM.

### Image Processing & Safe Upload Architecture (`SafeImageUploadService`)
- All administrative media uploads (products, blog, site-media) are processed strictly via `SafeImageUploadService`:
  - **No Raw File Publishing**: The original uploaded file is NEVER published to public storage when decoding or re-encoding fails. Fallback copying is strictly prohibited.
  - **Staging Outside Public Storage**: Uploads are staged outside the web document root until processing, stripping, and re-verification complete.
  - **Re-Encoding & Neutralization**: Re-encoded from raw pixel buffers via GD/sharp to strip EXIF, IPTC, ICC profiles, and polyglot scripts.
  - **Generated Output Verification**: Prior to publishing, the generated file is re-opened to verify true MIME, dimensions, and image decodability.
  - **Atomic Publishing**: Verified output is atomically moved to public storage with `0644` non-executable permissions.
  - **Runtime & Health Diagnostics**: The `/api/v1/diagnostics` endpoint verifies GD availability with JPEG, PNG, and WebP support at runtime. If unavailable, uploads fail with controlled 503 HTTP responses.

---

## 2. Directory Structure on DirectAdmin
```text
/home/username/
├── domains/
│   └── domain.com/
│       ├── public_html/          --> Symlink to /home/username/apexstore/public
│       │   └── .htaccess
├── apexstore/                    --> Root Laravel Application
│   ├── app/
│   ├── bootstrap/
│   ├── config/
│   ├── database/
│   ├── storage/                  --> Writable by php-fpm (chmod 775)
│   ├── .env
│   ├── artisan
│   └── composer.json
```

---

## 3. Web Server Configuration (`public/.htaccess`)
```apache
<IfModule mod_rewrite.c>
    <IfModule mod_negotiation.c>
        Options -MultiViews -Indexes
    </IfModule>

    RewriteEngine On

    # Handle Authorization Header for Sanctum
    RewriteCond %{HTTP:Authorization} .
    RewriteRule .* - [E=HTTP_AUTHORIZATION:%{HTTP:Authorization}]

    # Redirect Trailing Slashes
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteCond %{REQUEST_URI} (.+)/$
    RewriteRule ^ %1 [L,R=301]

    # Route All Requests to Front Controller
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteRule ^ index.php [L]
</IfModule>
```

---

## 4. DirectAdmin Cron Jobs Setup

Navigate to **DirectAdmin > Advanced Features > Cron Jobs** and configure the following tasks:

### 1. Primary Laravel Scheduler (Every Minute)
```bash
* * * * * cd /home/username/apexstore && /usr/local/php83/bin/php artisan schedule:run >> /dev/null 2>&1
```

### 2. Database Queue Worker (Every 2–5 Minutes with Time & Memory Constraints)
Because Supervisor is not available, run queue workers in constrained batches:
```bash
*/2 * * * * cd /home/username/apexstore && /usr/local/php83/bin/php artisan queue:work database --stop-when-empty --max-time=110 --memory=128 >> /dev/null 2>&1
```

### 3. Cleanup & Cache Invalidation Maintenance (Daily at 03:00 AM)
```bash
0 3 * * * cd /home/username/apexstore && /usr/local/php83/bin/php artisan model:prune >> /dev/null 2>&1
```

---

## 5. Recommended Server-Level OPcache Configuration (`php.ini`)
```ini
opcache.enable=1
opcache.enable_cli=0
opcache.memory_consumption=128
opcache.interned_strings_buffer=16
opcache.max_accelerated_files=10000
opcache.revalidate_freq=60
opcache.validate_timestamps=1
opcache.save_comments=1
opcache.fast_shutdown=1
```

---

## 6. CORS Configuration & Security Hardening
ApexStore enforces strict RFC 6454 origin normalization and validation:
- **Production Isolation**: In production (`APP_ENV=production`), wildcard origins (`*`) are prohibited and will throw a startup `LogicException`.
- **Environment Separation**:
  - `CORS_ALLOWED_ORIGINS_PRODUCTION`: Explicit production domains (e.g., `https://apexstore.ir,https://admin.apexstore.ir`).
  - `CORS_ALLOWED_ORIGINS_STAGING`: Explicit staging domains (e.g., `https://staging.apexstore.ir`).
- **No Credentials with Wildcards**: `supports_credentials` is defaulted to `false` for the stateless Bearer-token authentication architecture. It cannot be paired with a wildcard.
- **Strict Headers & Methods**:
  - Allowed methods: `GET, POST, PUT, DELETE, OPTIONS`.
  - Allowed headers: `Content-Type, Authorization, Accept, X-Session-ID, X-Idempotency-Key, X-Requested-With`.
  - Exposed headers: `X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset`.

---

## 7. Zero-Downtime Deployment Checklist
1. `git pull origin main`
2. `composer install --no-dev --optimize-autoloader`
3. Pre-migration database backup: `mysqldump -u username -p database_name > pre_migration_backup_$(date +%F_%T).sql`
4. `php artisan migrate --force`
5. `php artisan config:cache`
6. `php artisan route:cache`
7. `php artisan view:cache`
8. `php artisan queue:restart`

### Pre-Deployment Security Note: Legacy Token Invalidation Migration (`2026_09_23_000007_invalidate_legacy_plaintext_tokens.php`)
- **Irreversible Token Revocation**:
  The migration irrevocably purges any legacy unhashed/plaintext tokens (`LENGTH(token) != 64`) from the `personal_access_tokens` table. Once purged, these cannot be restored.
- **Session Invalidation & Re-Authentication**:
  Users or API clients possessing legacy plaintext tokens will have their sessions invalidated and will receive HTTP 401 until they log in again to generate standard 64-character SHA-256 hashed Sanctum tokens with explicit expiration timestamps.
- **Pre-Deployment Backup Requirement**:
  Always create a complete database snapshot before executing `php artisan migrate --force` to ensure operational rollback capability.
- **Driver Portability & Chunked Execution**:
  The migration uses Laravel Query Builder chunking with Carbon date arithmetic, ensuring 100% compatibility across MySQL 8+, MariaDB 10.6+, PostgreSQL, and SQLite without dialect-specific date SQL functions (`datetime()` vs `DATE_ADD()`) and with low memory usage on large token tables.

---

## 8. Post-Deployment Health & Diagnostics Verification

### A. Public Liveness Verification (Minimal Stable Schema)
Run the following curl command to verify the public liveness check:
```bash
curl -s -i https://domain.com/api/v1/health
```
Expected Response (HTTP 200):
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "version": "1.0.0",
    "timestamp": "2026-09-24T08:15:00+00:00"
  },
  "message": "ApexStore Backend is operational."
}
```
*Security Invariant*: The public endpoint never exposes `environment`, driver configurations (`cache_driver`, `queue_driver`, `session_driver`), database names, or internal server paths.

### B. Operator Readiness & Dependency Diagnostics
Authorized operators can verify operational readiness across dependencies (database, cache, and writable storage):
```bash
curl -s -i -H "Authorization: Bearer <ADMIN_TOKEN>" https://domain.com/api/v1/diagnostics
```
Expected Response (HTTP 200):
```json
{
  "success": true,
  "data": {
    "status": "ready",
    "version": "1.0.0",
    "timestamp": "2026-09-24T08:15:00+00:00",
    "dependencies": {
      "database": "connected",
      "cache": "operational",
      "storage": "writable"
    }
  },
  "message": "All core system dependencies are operational."
}
```
*Access Control*: Unauthenticated requests to `/api/v1/diagnostics` receive HTTP 401/403.
