#!/usr/bin/env bash
set -euo pipefail

# Builds a File Manager-friendly incremental update from an already deployed
# commit to a target commit. It never includes .env, storage or any database
# credentials. Run from the target revision after pnpm build and composer install.

ROOT_DIR="${1:-$PWD}"
OUTPUT_DIR="${2:-$ROOT_DIR/.deployment-update-artifact}"
BASE_COMMIT="${3:?Base deployed commit is required}"
TARGET_COMMIT="${4:?Target commit is required}"
TARGET_REF="${NOVINET_BUILD_REF:-${GITHUB_REF_NAME:-main}}"
BUILD_TIMESTAMP="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
PACKAGE_DIR="$OUTPUT_DIR/novinet-shared-hosting-update"
CORE_STAGE="$PACKAGE_DIR/novinet_core_update"
PUBLIC_STAGE="$PACKAGE_DIR/public_html_update"
CORE_LIST="$PACKAGE_DIR/CORE_CHANGED_FILES.txt"
PUBLIC_LIST="$PACKAGE_DIR/PUBLIC_CHANGED_FILES.txt"
REMOVAL_LIST="$PACKAGE_DIR/REMOVALS_NOT_APPLIED.txt"

fail() {
  echo "$1" >&2
  exit 1
}

copy_relative_file() {
  local source_path="$1"
  local relative_path="$2"
  local destination_root="$3"

  [ -f "$source_path" ] || fail "Expected changed file is missing from target revision: $relative_path"
  mkdir -p "$destination_root/$(dirname "$relative_path")"
  cp -a "$source_path" "$destination_root/$relative_path"
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "Required command is unavailable: $1"
}

require_command git
require_command zip
require_command sha256sum

cd "$ROOT_DIR"
git cat-file -e "${BASE_COMMIT}^{commit}" 2>/dev/null || fail "The recorded deployed commit was not found: $BASE_COMMIT"
git cat-file -e "${TARGET_COMMIT}^{commit}" 2>/dev/null || fail "The target commit was not found: $TARGET_COMMIT"
git merge-base --is-ancestor "$BASE_COMMIT" "$TARGET_COMMIT" || fail "The recorded deployed commit is not an ancestor of the target. Use a full deployment package instead."

BASE_COMMIT="$(git rev-parse "$BASE_COMMIT")"
TARGET_COMMIT="$(git rev-parse "$TARGET_COMMIT")"
[ "$BASE_COMMIT" != "$TARGET_COMMIT" ] || fail "No update is needed: deployed and target commits are identical."

[ -f "$ROOT_DIR/public/index.html" ] || fail 'public/index.html is required after the target frontend build.'
[ -d "$ROOT_DIR/public/assets" ] || fail 'public/assets is required after the target frontend build.'

rm -rf "$OUTPUT_DIR"
mkdir -p "$CORE_STAGE" "$PUBLIC_STAGE"
: > "$CORE_LIST"
: > "$PUBLIC_LIST"
: > "$REMOVAL_LIST"

core_files_changed=0
public_files_changed=0
composer_dependencies_changed=0
migration_files_changed=0
migration_files=()
core_removals_found=0
frontend_sources_changed=0

while IFS=$'\t' read -r status first_path second_path; do
  [ -n "$status" ] || continue

  if [[ "$status" == D* ]]; then
    target_path="$first_path"
    is_deletion=true
  elif [[ "$status" == R* || "$status" == C* ]]; then
    target_path="$second_path"
    is_deletion=false
    printf 'RENAMED_OR_COPIED: %s -> %s\n' "$first_path" "$second_path" >> "$REMOVAL_LIST"
  else
    target_path="$first_path"
    is_deletion=false
  fi

  case "$target_path" in
    bootstrap/cache/*)
      # Generated Laravel cache is recreated by optimize:clear and must not block an update.
      ;;
    public/assets/*)
      # Vite hashes every output file. A source-level diff cannot safely identify
      # the exact output chunk, so current build assets are staged as a complete set
      # below whenever frontend source files changed.
      if [ "$is_deletion" = true ]; then
        relative_path="${target_path#public/}"
        printf 'PUBLIC (old Vite asset may remain safely unused): %s\n' "$relative_path" >> "$REMOVAL_LIST"
      fi
      ;;
    public/uploads/*)
      # User uploads are persistent runtime data and must NEVER be packaged into update artifacts
      if [ "$target_path" = "public/uploads/.htaccess" ]; then
        copy_relative_file "$ROOT_DIR/$target_path" "uploads/.htaccess" "$PUBLIC_STAGE"
      fi
      ;;
    public/*)
      relative_path="${target_path#public/}"
      if [ "$is_deletion" = true ]; then
        printf 'PUBLIC (old asset/file may remain safely unused): %s\n' "$relative_path" >> "$REMOVAL_LIST"
      else
        copy_relative_file "$ROOT_DIR/$target_path" "$relative_path" "$PUBLIC_STAGE"
        printf '%s\n' "$relative_path" >> "$PUBLIC_LIST"
        public_files_changed=$((public_files_changed + 1))
      fi
      ;;
    src/*|index.html|vite.config.*|tailwind.config.*|postcss.config.*|package.json|pnpm-lock.yaml)
      frontend_sources_changed=1
      ;;
    app/*|bootstrap/*|config/*|database/migrations/*|resources/*|routes/*|artisan|composer.json|composer.lock)
      if [ "$is_deletion" = true ]; then
        printf 'CORE (full deployment required before removing): %s\n' "$target_path" >> "$REMOVAL_LIST"
        core_removals_found=$((core_removals_found + 1))
      else
        copy_relative_file "$ROOT_DIR/$target_path" "$target_path" "$CORE_STAGE"
        printf '%s\n' "$target_path" >> "$CORE_LIST"
        core_files_changed=$((core_files_changed + 1))
        if [[ "$target_path" == composer.json || "$target_path" == composer.lock ]]; then
          composer_dependencies_changed=1
        fi
        if [[ "$target_path" == database/migrations/*.php ]]; then
          migration_files_changed=1
          migration_files+=("$target_path")
        fi
      fi
      ;;
    .env|.env.*|public/.env|public/.env.*)
      fail "Unsafe deployment change detected: $target_path must never be packaged."
      ;;
    *)
      # Source-only, test, documentation, CI and local development files are intentionally not deployed.
      ;;
  esac
done < <(git diff --name-status --find-renames "$BASE_COMMIT" "$TARGET_COMMIT")

if [ "$core_removals_found" -gt 0 ]; then
  fail "A runtime core file was deleted. Incremental deployment is intentionally stopped; use a full deployment package after review."
fi

if [ "$frontend_sources_changed" -eq 1 ]; then
  # The workflow runs pnpm build before this script. Copy the resulting public
  # directory files required by the frontend atomically, rather than trying to
  # reconstruct Vite's hashed dependency graph from Git paths.
  copy_relative_file "$ROOT_DIR/public/index.html" "index.html" "$PUBLIC_STAGE"
  cp -a "$ROOT_DIR/public/assets" "$PUBLIC_STAGE/assets"
  find "$PUBLIC_STAGE" -type f -printf '%P\n' | sort >> "$PUBLIC_LIST"
  public_files_changed=$((public_files_changed + $(find "$PUBLIC_STAGE" -type f | wc -l)))
fi

if [ "$composer_dependencies_changed" -eq 1 ]; then
  [ -f "$ROOT_DIR/vendor/autoload.php" ] || fail 'vendor/autoload.php is required when composer dependencies change.'
  cp -a "$ROOT_DIR/vendor" "$CORE_STAGE/vendor"
  printf 'vendor/ (full production vendor refresh because composer files changed)\n' >> "$CORE_LIST"
  core_files_changed=$((core_files_changed + 1))
fi

migration_url_file=''
frontend_cleanup_guide_file=''
if [ "$frontend_sources_changed" -eq 1 ]; then
  frontend_cleanup_guide_file="$PACKAGE_DIR/TEST_ONLY_VITE_ASSET_CLEANUP_FA.md"
  cat > "$frontend_cleanup_guide_file" <<'MD'
# پاک‌سازی build قدیمی Vite — فقط محیط تست

این راهنما فقط برای محیط تست نوین‌نت است که کاربر فعال ندارد. ZIP public این artifact شامل **کل** asset graph فعلی Vite است؛ بنابراین می‌توانید پوشهٔ asset قدیمی را قبل از Extract کنار بگذارید و پس از تست حذف کنید.

> هرگز `public_html`، `novinet_core`، `fonts`، `storage`، `.env` یا `index.php` را حذف یا rename نکنید. فقط پوشهٔ دقیق `public_html/assets` در این راهنما قابل پاک‌سازی است.

## ترتیب دقیق

1. در File Manager وارد `public_html` شوید.
2. پوشهٔ `assets` فعلی را به نامی مانند `assets_before_vite_cleanup` تغییر نام دهید؛ هنوز آن را حذف نکنید.
3. فایل `2_UPDATE_PUBLIC_HTML_CHANGED_FILES.zip` همین artifact را در خود `public_html` Extract کنید. این کار پوشهٔ `assets` جدید و `index.html` جدید را می‌سازد.
4. سایت را در Incognito باز کنید و صفحهٔ اصلی، فروشگاه، profile، ورود و سبد خرید را تست کنید.
5. فقط اگر تمام تست‌ها درست بودند، پوشهٔ backup با نام `assets_before_vite_cleanup` را حذف کنید.
6. اگر اشکالی دیدید، `assets` جدید را به نام دیگری تغییر دهید و پوشهٔ `assets_before_vite_cleanup` را دوباره به `assets` برگردانید؛ سپس راهنمایی بگیرید.

این پاک‌سازی برای یک deployment آزمایشی است. پس از عمومی‌شدن سایت، assetهای hash‌شدهٔ قدیمی به‌صورت پیش‌فرض نگه داشته می‌شوند تا تب‌های باز کاربران خراب نشوند.
MD
fi

if [ "$migration_files_changed" -eq 1 ]; then
  deploy_token="$(openssl rand -hex 32)"
  printf '%s\n' "$deploy_token" > "$CORE_STAGE/.deployment_migration_token"
  helper_path="$PUBLIC_STAGE/__novinet_migrate_once.php"

  cat > "$helper_path" <<'PHP'
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

$migrationPaths = [
PHP
  for migration_path in "${migration_files[@]}"; do
    printf "    \$laravelRoot . '/%s',\n" "$migration_path" >> "$helper_path"
  done
  cat >> "$helper_path" <<'PHP'
];

try {
    $output = '';
    foreach ($migrationPaths as $migrationPath) {
        if (!is_file($migrationPath)) {
            throw new RuntimeException('Expected deployment migration is missing: ' . $migrationPath);
        }

        try {
            Artisan::call('migrate', [
                '--force' => true,
                '--path' => $migrationPath,
                '--realpath' => true,
            ]);
            $output .= Artisan::output() . "\n";
        } catch (\Illuminate\Database\QueryException $exception) {
            $sqlState = (string) $exception->getCode();
            if (in_array($sqlState, ['42S01', '42S21'], true)) {
                $output .= "Skipped an already-existing schema object for: " . basename($migrationPath) . "\n";
                continue;
            }

            throw $exception;
        }
    }

    Artisan::call('optimize:clear');
    $output .= Artisan::output();
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
  printf '__novinet_migrate_once.php\n' >> "$PUBLIC_LIST"
  public_files_changed=$((public_files_changed + 1))
  migration_url_file="$PACKAGE_DIR/MIGRATION_RUN_URL.txt"
  cat > "$migration_url_file" <<URL
One-time migration URL for this incremental update:
https://YOUR-DOMAIN.TLD/__novinet_migrate_once.php?token=${deploy_token}

Open this only after extracting both update ZIPs. It runs only the migration files packaged in this update, not the entire Laravel migration history.
After a successful run, the token and migration file delete themselves.
URL
fi

if [ "$core_files_changed" -gt 0 ]; then
  (
    cd "$CORE_STAGE"
    zip -qr "$PACKAGE_DIR/1_UPDATE_NOVINET_CORE_CHANGED_FILES.zip" .
  )
fi

if [ "$public_files_changed" -gt 0 ]; then
  (
    cd "$PUBLIC_STAGE"
    zip -qr "$PACKAGE_DIR/2_UPDATE_PUBLIC_HTML_CHANGED_FILES.zip" .
  )
fi

rm -rf "$CORE_STAGE" "$PUBLIC_STAGE"

base_short="${BASE_COMMIT:0:8}"
target_short="${TARGET_COMMIT:0:8}"

cat > "$PACKAGE_DIR/DEPLOY_INFO.txt" <<INFO
NoovinNet Incremental Shared Hosting Update

Deployed base commit: ${BASE_COMMIT}
Target commit: ${TARGET_COMMIT}
Target branch: ${TARGET_REF}
Built at (UTC): ${BUILD_TIMESTAMP}

This artifact contains only runtime files changed from the deployed base commit to the target commit.
For frontend source changes, the complete current Vite build output is included because its hashed assets are interdependent.
Core update files: ${core_files_changed}
Public update files: ${public_files_changed}
Composer vendor refresh included: $([ "$composer_dependencies_changed" -eq 1 ] && echo yes || echo no)
Migration action required: $([ "$migration_files_changed" -eq 1 ] && echo yes || echo no)
Test-only stale Vite asset cleanup guide: $([ "$frontend_sources_changed" -eq 1 ] && echo yes || echo no)

Safety rules:
- Extract the core update ZIP inside the existing novinet_core folder only.
- Extract the public update ZIP inside public_html only.
- Never overwrite, move or include .env.
- Files listed in REMOVALS_NOT_APPLIED.txt are not deleted automatically.
- If this artifact has no ZIP for a location, do not make any change in that location.
- This method requires the standard File Manager layout: novinet_core beside public_html.
INFO

cat > "$PACKAGE_DIR/README_INCREMENTAL_DEPLOYMENT_FA.md" <<'MD'
# راهنمای ZIP تغییرات برای File Manager

این artifact فقط تفاوت بین نسخهٔ نصب‌شدهٔ ثبت‌شده و commit هدف را دارد. بنابراین لازم نیست کل سایت را دوباره upload کنید.

## پیش از Extract

1. فایل `DEPLOY_INFO.txt` را باز کنید. فقط اگر `Deployed base commit` همان نسخه‌ای است که قبلاً روی هاست نصب و ثبت کرده‌اید ادامه دهید.
2. `Target branch` باید `main` باشد.
3. اگر `REMOVALS_NOT_APPLIED.txt` فقط assetهای public را نشان می‌دهد، حذف آن‌ها در محیط عمومی ضروری نیست؛ فایل‌های قدیمیِ بدون ارجاع آسیبی نمی‌زنند. در محیط تست، فقط اگر فایل `TEST_ONLY_VITE_ASSET_CLEANUP_FA.md` داخل artifact وجود دارد، می‌توانید طبق همان راهنما assetهای قدیمی را پس از تست پاک‌سازی کنید.
4. اگر در فایل `DEPLOY_INFO.txt` عبارت `Migration action required: yes` دیدید، پس از Extract باید URL داخل `MIGRATION_RUN_URL.txt` را یک‌بار باز کنید.

## نصب تغییرات

| فایل ZIP | محل Extract |
|---|---|
| `1_UPDATE_NOVINET_CORE_CHANGED_FILES.zip` | داخل پوشهٔ موجود `novinet_core` |
| `2_UPDATE_PUBLIC_HTML_CHANGED_FILES.zip` | داخل پوشهٔ موجود `public_html` |

اگر یکی از این ZIPها داخل artifact وجود نداشت، در همان محل هیچ کاری انجام ندهید. Extract را با گزینهٔ Replace/Overwrite انجام دهید، اما فایل `.env` را هرگز جایگزین نکنید.

## پس از تست موفق

پس از اینکه صفحهٔ اصلی، ورود و بخش تغییرشده را روی هاست بررسی کردید، در GitHub workflow با نام **Record Shared Hosting Deployment** را اجرا کنید و `Target commit` داخل `DEPLOY_INFO.txt` را وارد کنید. این کار فقط مرجع نسخهٔ نصب‌شده را برای ساخت ZIP تغییرات بعدی به‌روزرسانی می‌کند؛ هیچ فایلی روی سرور upload نمی‌کند.

## زمان استفاده از package کامل

اگر workflow ساخت ZIP تغییرات به‌دلیل حذف فایل runtime متوقف شد، یا اگر ساختار هاست شما هنوز `novinet_core` کنار `public_html` نیست، از package کامل استفاده کنید و قبل از ادامه backup بگیرید.
MD

(
  cd "$PACKAGE_DIR"
  sha256sum ./*.zip > SHA256SUMS.txt 2>/dev/null || true
)

printf 'Incremental shared-hosting artifact created at: %s\n' "$PACKAGE_DIR"
printf 'Base: %s\nTarget: %s\n' "$BASE_COMMIT" "$TARGET_COMMIT"
