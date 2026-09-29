#!/usr/bin/env bash
set -euo pipefail

# Produces a File Manager-friendly Laravel package without including any real
# environment file or database credential. Run from repository root after:
#   composer install --no-dev --optimize-autoloader
#   pnpm install --frozen-lockfile && pnpm build

ROOT_DIR="${1:-$PWD}"
OUTPUT_DIR="${2:-$ROOT_DIR/.deployment-artifact}"
PACKAGE_DIR="$OUTPUT_DIR/novinet-shared-hosting"
CORE_DIR="$PACKAGE_DIR/novinet_core"
PUBLIC_DIR="$PACKAGE_DIR/public_html"
DATABASE_DIR="$PACKAGE_DIR/database"
SOURCE_COMMIT="${NOVINET_BUILD_COMMIT:-${GITHUB_SHA:-$(git -C "$ROOT_DIR" rev-parse HEAD 2>/dev/null || printf 'unknown')}}"
SOURCE_REF="${NOVINET_BUILD_REF:-${GITHUB_REF_NAME:-unknown}}"
BUILD_TIMESTAMP="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"

require_path() {
  if [ ! -e "$1" ]; then
    echo "Required path is missing: $1" >&2
    exit 1
  fi
}

require_path "$ROOT_DIR/vendor/autoload.php"
require_path "$ROOT_DIR/public/index.php"
require_path "$ROOT_DIR/public/index.html"
require_path "$ROOT_DIR/public/assets"
require_path "$ROOT_DIR/database/install/noovinnet_schema.sql"
require_path "$ROOT_DIR/database/install/google_oauth_accounts_migration.sql"

rm -rf "$OUTPUT_DIR"
mkdir -p "$CORE_DIR" "$PUBLIC_DIR" "$DATABASE_DIR"

# Keep only what Laravel needs at runtime. Source-only React files, test files,
# Git metadata, local Node dependencies and local environment values stay out.
for item in app bootstrap config database resources routes storage vendor artisan composer.json composer.lock; do
  if [ -e "$ROOT_DIR/$item" ]; then
    cp -a "$ROOT_DIR/$item" "$CORE_DIR/"
  fi
done

cp -a "$ROOT_DIR/public/." "$PUBLIC_DIR/"
rm -f "$CORE_DIR/.env" "$CORE_DIR/.env.example"

# Runtime uploads must never be packaged; only directory structure and .htaccess are retained
find "$PUBLIC_DIR/uploads" -type f ! -name ".htaccess" ! -name ".gitkeep" -delete 2>/dev/null || true

FRONTEND_ENTRY="$(sed -n 's/.*src="\/assets\/\([^"]*\)".*/\1/p' "$PUBLIC_DIR/index.html" | head -n 1)"
FRONTEND_STYLE="$(sed -n 's/.*href="\/assets\/\([^"]*\.css\)".*/\1/p' "$PUBLIC_DIR/index.html" | head -n 1)"

if [ -z "$FRONTEND_ENTRY" ] || [ -z "$FRONTEND_STYLE" ]; then
  echo 'Could not identify the generated frontend entry assets.' >&2
  exit 1
fi

require_path "$PUBLIC_DIR/assets/$FRONTEND_ENTRY"
require_path "$PUBLIC_DIR/assets/$FRONTEND_STYLE"

FRONTEND_ENTRY_SHA256="$(sha256sum "$PUBLIC_DIR/assets/$FRONTEND_ENTRY" | awk '{print $1}')"
FRONTEND_STYLE_SHA256="$(sha256sum "$PUBLIC_DIR/assets/$FRONTEND_STYLE" | awk '{print $1}')"
INDEX_HTML_SHA256="$(sha256sum "$PUBLIC_DIR/index.html" | awk '{print $1}')"

cat > "$PACKAGE_DIR/BUILD_INFO.txt" <<INFO
NoovinNet Shared Hosting Artifact - Build Verification

Source branch: ${SOURCE_REF}
Source commit: ${SOURCE_COMMIT}
Built at (UTC): ${BUILD_TIMESTAMP}

Frontend entry JavaScript: assets/${FRONTEND_ENTRY}
Frontend entry JavaScript SHA-256: ${FRONTEND_ENTRY_SHA256}
Frontend stylesheet: assets/${FRONTEND_STYLE}
Frontend stylesheet SHA-256: ${FRONTEND_STYLE_SHA256}
Public index.html SHA-256: ${INDEX_HTML_SHA256}

Verification rule:
Download and use this artifact only when the Source branch is main and the Source commit matches the commit shown for the intended release on GitHub.
INFO

cp "$PACKAGE_DIR/BUILD_INFO.txt" "$CORE_DIR/BUILD_INFO.txt"
rm -rf "$CORE_DIR/database/factories" "$CORE_DIR/database/seeders" "$CORE_DIR/database/install"

APP_KEY="base64:$(openssl rand -base64 32 | tr -d '\n')"
DEPLOY_TOKEN="$(openssl rand -hex 32)"

cat > "$CORE_DIR/CREATE_DOT_ENV_FROM_THIS_FILE.txt" <<ENV
# Rename this file to .env in novinet_core, then replace every placeholder.
APP_NAME="NoovinNet Store"
APP_ENV=production
APP_KEY=${APP_KEY}
APP_DEBUG=false
APP_URL=https://YOUR-DOMAIN.TLD

LOG_CHANNEL=stack
LOG_LEVEL=error

DB_CONNECTION=mysql
DB_HOST=localhost
DB_PORT=3306
DB_DATABASE=REPLACE_WITH_DATABASE_NAME
DB_USERNAME=REPLACE_WITH_DATABASE_USER
DB_PASSWORD=REPLACE_WITH_DATABASE_PASSWORD

BROADCAST_CONNECTION=log
CACHE_STORE=file
FILESYSTEM_DISK=local
QUEUE_CONNECTION=sync
SESSION_DRIVER=file
SESSION_LIFETIME=120

MAIL_MAILER=log
MAIL_HOST=127.0.0.1
MAIL_PORT=2525
MAIL_USERNAME=null
MAIL_PASSWORD=null
MAIL_ENCRYPTION=null
MAIL_FROM_ADDRESS="noreply@YOUR-DOMAIN.TLD"
MAIL_FROM_NAME="NoovinNet Store"

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://YOUR-DOMAIN.TLD/api/v1/auth/google/callback

SMS_ENABLED=false
ENV

printf '%s\n' "$DEPLOY_TOKEN" > "$CORE_DIR/.deployment_migration_token"

cat > "$PUBLIC_DIR/index.php" <<'PHP'
<?php

use Illuminate\Http\Request;

define('LARAVEL_START', microtime(true));

/*
 * File Manager layout:
 *   /home/USERNAME/novinet_core     Laravel core, vendor and .env
 *   /home/USERNAME/public_html      This directory only
 */
$laravelRoot = dirname(__DIR__) . '/novinet_core';

if (!is_file($laravelRoot . '/vendor/autoload.php')) {
    http_response_code(500);
    exit('Laravel core folder or vendor dependencies were not found. Check the deployment guide.');
}

if (file_exists($maintenance = $laravelRoot . '/storage/framework/maintenance.php')) {
    require $maintenance;
}

require $laravelRoot . '/vendor/autoload.php';

(require_once $laravelRoot . '/bootstrap/app.php')
    ->handleRequest(Request::capture());
PHP

cat > "$PUBLIC_DIR/__novinet_migrate_once.php" <<'PHP'
<?php

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\Artisan;

$laravelRoot = dirname(__DIR__) . '/novinet_core';
$tokenPath = $laravelRoot . '/.deployment_migration_token';
$providedToken = (string) ($_GET['token'] ?? '');
$expectedToken = is_file($tokenPath) ? trim((string) file_get_contents($tokenPath)) : '';

if ($expectedToken === '' || !hash_equals($expectedToken, $providedToken)) {
    http_response_code(404);
    exit;
}

if (!is_file($laravelRoot . '/vendor/autoload.php')) {
    http_response_code(500);
    exit('Laravel core folder or vendor dependencies were not found.');
}

require $laravelRoot . '/vendor/autoload.php';
$app = require $laravelRoot . '/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

try {
    Artisan::call('migrate', ['--force' => true]);
    Artisan::call('optimize:clear');
    $output = Artisan::output();
    @unlink($tokenPath);
    @unlink(__FILE__);
    header('Content-Type: text/plain; charset=utf-8');
    echo "Migration completed. This one-time file and its token were removed.\n\n";
    echo $output;
} catch (Throwable $exception) {
    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');
    echo "Migration failed. Do not retry blindly. Save this output and request help.\n\n";
    echo $exception->getMessage();
}
PHP

cat "$ROOT_DIR/database/install/noovinnet_schema.sql" > "$DATABASE_DIR/FRESH_DATABASE_IMPORT.sql"
printf '\n\n-- Google OAuth accounts added by current release\n' >> "$DATABASE_DIR/FRESH_DATABASE_IMPORT.sql"
cat "$ROOT_DIR/database/install/google_oauth_accounts_migration.sql" >> "$DATABASE_DIR/FRESH_DATABASE_IMPORT.sql"
cat >> "$DATABASE_DIR/FRESH_DATABASE_IMPORT.sql" <<'SQL'

-- Phone authentication support added by the current release.
-- This file is for a NEW, EMPTY database only.
ALTER TABLE `users`
  MODIFY `name` varchar(255) NULL,
  MODIFY `email` varchar(255) NULL,
  MODIFY `password` varchar(255) NULL,
  ADD COLUMN `phone_verified_at` timestamp NULL AFTER `phone`,
  ADD UNIQUE KEY `users_phone_unique` (`phone`);

CREATE TABLE `phone_verification_codes` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `phone` varchar(32) NOT NULL,
  `code_hash` varchar(255) NOT NULL,
  `expires_at` timestamp NOT NULL,
  `consumed_at` timestamp NULL DEFAULT NULL,
  `attempts` tinyint unsigned NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `phone_verification_codes_phone_unique` (`phone`),
  KEY `phone_verification_codes_expires_at_index` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Mark the bundled authentication migrations as applied for a fresh import.
INSERT INTO `migrations` (`migration`, `batch`)
SELECT '2026_08_22_000001_create_oauth_accounts_table', 99
WHERE NOT EXISTS (SELECT 1 FROM `migrations` WHERE `migration` = '2026_08_22_000001_create_oauth_accounts_table');

INSERT INTO `migrations` (`migration`, `batch`)
SELECT '2026_08_23_000001_add_phone_authentication_support', 99
WHERE NOT EXISTS (SELECT 1 FROM `migrations` WHERE `migration` = '2026_08_23_000001_add_phone_authentication_support');
SQL

cat > "$PACKAGE_DIR/MIGRATION_RUN_URL.txt" <<URL
One-time migration URL for this artifact:
https://YOUR-DOMAIN.TLD/__novinet_migrate_once.php?token=${DEPLOY_TOKEN}

Use this only after uploading the new core and public_html package, and after editing .env.
For a fresh database imported from FRESH_DATABASE_IMPORT.sql, this is optional because the SQL already includes the current schema.
After a successful run, the token and migration file delete themselves.
URL

cat > "$PACKAGE_DIR/README_FILE_MANAGER_DEPLOYMENT_FA.md" <<'MD'
# راهنمای همیشگی استقرار بدون Terminal

این artifact فقط زمانی ساخته می‌شود که از بخش **Actions** مخزن، workflow با عنوان **Build Shared Hosting Artifact** را دستی اجرا کنید. برای هر انتشار جدید، workflow را روی شاخهٔ `main` اجرا و سپس artifact همان run موفق را دانلود کنید.

## فایل‌های artifact

| فایل | محل استفاده |
|---|---|
| `1_UPLOAD_TO_HOME_NOVINET_CORE.zip` | در File Manager و در همان سطح `public_html` Extract شود؛ خروجی باید پوشهٔ `novinet_core` باشد. |
| `2_UPLOAD_TO_PUBLIC_HTML.zip` | داخل `public_html` Extract شود. |
| `database/FRESH_DATABASE_IMPORT.sql` | فقط برای دیتابیس جدید و خالی. |
| `MIGRATION_RUN_URL.txt` | فقط برای update دیتابیس فعلی پس از هر انتشار. |
| `BUILD_INFO.txt` | قبل از upload باز کنید؛ branch و commit باید با release موردنظر در GitHub یکی باشد. |
| `SHA256SUMS.txt` | checksum دو ZIP برای کنترل یکپارچگی فایل دانلودی. |

> Laravel با آپلود فقط داخل `public_html` اجرا نمی‌شود. پوشهٔ `novinet_core` باید کنار `public_html` و خارج از web root بماند.

## اولین استقرار

1. از WordPress و دیتابیس فعلی backup بگیرید.
2. ZIP شمارهٔ ۱ را در home هاست، کنار `public_html` Extract کنید.
3. در `novinet_core` فایل `CREATE_DOT_ENV_FROM_THIS_FILE.txt` را به `.env` تغییر نام دهید و مشخصات دیتابیس و دامنه را وارد کنید.
4. ZIP شمارهٔ ۲ را داخل `public_html` Extract کنید. فایل‌های WordPress قبلی را فقط پس از backup کامل جایگزین کنید.
5. در phpMyAdmin یک دیتابیس جدید بسازید و `FRESH_DATABASE_IMPORT.sql` را import کنید.
6. مجوز نوشتن `novinet_core/storage` و `novinet_core/bootstrap/cache` را در File Manager روی 775 قرار دهید.
7. صفحهٔ اصلی، فروشگاه، سبد و ورود را تست کنید.

## هر update بعدی

1. آخرین artifact را از Actions دانلود کنید و ابتدا `BUILD_INFO.txt` را باز کنید؛ فقط اگر `Source branch: main` و `Source commit` با commit release موردنظر یکسان بود ادامه دهید.
2. ZIP شمارهٔ ۱ را در home هاست Extract کنید و هنگام Extract، فایل `.env` فعلی را حفظ کنید.
3. ZIP شمارهٔ ۲ را داخل `public_html` Extract کنید.
4. پوشهٔ `public_html/uploads` را حذف، خالی یا با پوشهٔ تازه جایگزین نکنید. این پوشه رسانه‌های واقعی محصولات را نگه می‌دارد؛ Extract باید فقط فایل‌های ZIP را روی فایل‌های موجود اضافه یا جایگزین کند.
5. اگر دیتابیس فعلی دارید، URL داخل `MIGRATION_RUN_URL.txt` را فقط یک‌بار در مرورگر باز کنید. در صورت موفقیت، فایل خودش حذف می‌شود.
6. cache مرورگر را پاک و صفحهٔ اصلی، فروشگاه، ورود و checkout را بررسی کنید.

## نکات امنیتی

- `.env` هرگز داخل `public_html`، GitHub یا پیام ارسال نشود.
- `FRESH_DATABASE_IMPORT.sql` را روی دیتابیس فعالِ دارای کاربر یا سفارش import نکنید.
- در هر update، `public_html/uploads/products` را حفظ کنید؛ artifact کد است و جایگزین backup رسانه‌های runtime نیست.
- URL migration فقط یک‌بار و فقط روی دامنهٔ خودتان باز شود؛ پس از موفقیت token و فایل آن حذف می‌شوند.
- اگر migration خطا داد، retry کورکورانه نکنید؛ متن خطا را نگه دارید و راهنمایی بخواهید.
MD

cd "$PACKAGE_DIR"
zip -qr "1_UPLOAD_TO_HOME_NOVINET_CORE.zip" novinet_core
(
  cd public_html
  zip -qr ../2_UPLOAD_TO_PUBLIC_HTML.zip .
)
rm -rf novinet_core public_html

(
  cd "$PACKAGE_DIR"
  sha256sum 1_UPLOAD_TO_HOME_NOVINET_CORE.zip 2_UPLOAD_TO_PUBLIC_HTML.zip > SHA256SUMS.txt
)

printf 'Shared-hosting artifact created at: %s\n' "$PACKAGE_DIR"
