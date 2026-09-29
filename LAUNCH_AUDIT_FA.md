# گزارش ممیزی آماده‌سازی لانچ — NoovinNet / ApexStore

تاریخ ممیزی: 2026-09-29  
ریپو: `alighamsariapp-crypto/fixxx`  
محیط بررسی: Manus Sandbox

## نتیجهٔ اجرایی

**قبل از اصلاحات، سایت برای deploy مستقیم آماده نبود.** علت اصلی، ناسازگاری مسیر خروجی Vite با معماری Laravel/Apache بود: Vite به `dist/` خروجی می‌داد، در حالی که Laravel و اسکریپت‌های هاست اشتراکی به `public/index.html` و `public/assets/` نیاز دارند.

این مشکل اصلاح شد و build نهایی اکنون خروجی درست را در `public/` تولید می‌کند. با این حال، انتشار عمومی هنوز مشروط به تکمیل تنظیمات واقعی هاست و اجرای تست‌های PHP/MySQL است.

## اصلاحات انجام‌شده

- `vite.config.ts`
  - `outDir` از `dist` به `public` تغییر کرد.
  - `emptyOutDir` روی `false` قرار گرفت تا `public/index.php`، `.htaccess`، فونت‌ها و پوشه‌های runtime حذف نشوند.
  - `publicDir: false` اضافه شد تا Vite پوشهٔ `public` را روی خودش کپی نکند.
- `server.ts`
  - preview استاتیک Node از همان artifact داخل `public/` استفاده می‌کند؛ این تغییر فقط برای preview است و Node نباید روی هاست اشتراکی production اجرا شود.
- `docs/DEPLOYMENT.md`
  - مسیر واقعی artifact فرانت‌اند اصلاح شد.
  - مستندات pnpm به `pnpm-workspace.yaml` اصلاح شد.
- `package.json`
  - تنظیمات منسوخ/تکراری `pnpm` حذف شد؛ تنظیمات native build در `pnpm-workspace.yaml` باقی می‌ماند.

## یافته‌های مهم و اولویت‌ها

### P0 — برطرف‌شده: خروجی فرانت در مسیر اشتباه

**اثر:** صفحهٔ اصلی و assetها پس از deploy Laravel پیدا نمی‌شدند یا سایت سفید می‌شد.  
**وضعیت:** اصلاح شد؛ build اکنون `public/index.html` و assetهای هش‌شدهٔ `public/assets/` را تولید می‌کند.

### P1 — تنظیمات production هنوز باید روی هاست واقعی تکمیل شود

مقادیر واقعی نباید در Git قرار بگیرند و باید در `.env` هاست تنظیم شوند:

- `APP_ENV=production`
- `APP_DEBUG=false`
- `APP_KEY` تصادفی و معتبر
- `APP_URL` با دامنهٔ نهایی و HTTPS
- اتصال MySQL/MariaDB و اجرای migrationها
- `CORS_ALLOWED_ORIGINS_PRODUCTION` با دامنه‌های واقعی و بدون wildcard
- `ZIBAL_MERCHANT` و `ZIBAL_SANDBOX=false`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` در صورت فعال‌بودن Google Login
- `KAVENEGAR_API_KEY` و تنظیمات SMS در صورت فعال‌بودن OTP/SMS
- mailer واقعی برای ایمیل‌های تأیید و بازیابی رمز
- `VITE_ENABLE_DEMO_MODE=false`

در ادامهٔ ممیزی، PHP 8.3، Composer و SQLite در Sandbox نصب شد و تست‌های Laravel با دیتابیس تست اجرا شدند. اجرای staging واقعی با MySQL و credentials واقعی همچنان لازم است.

### P1 — درگاه و جریان خرید

قبل از جذب مشتری، با یک محصول واقعی و مبلغ تستی در محیط مجاز موارد زیر را دستی تأیید کنید:

1. افزودن محصول و تغییر تعداد در سبد
2. محاسبهٔ قیمت و تخفیف از سمت سرور
3. checkout با آدرس معتبر
4. انتقال به درگاه واقعی
5. callback و verify پرداخت
6. جلوگیری از دوباره‌پرداخت/تکرار webhook
7. نمایش وضعیت سفارش و ثبت تراکنش در پنل مدیریت
8. لغو سفارش و رفتار موجودی

### P1 — عملیات هاست

- Document Root دامنه روی `public/` باشد؛ اگر هاست DirectAdmin اجازه نمی‌دهد، layout مستندات shared-hosting را دقیق اجرا کنید.
- `storage/` و `bootstrap/cache/` برای کاربر وب‌سرور قابل نوشتن باشند.
- `.env` خارج از web root قرار بگیرد.
- پوشه‌های `vendor/` و `node_modules/` در web root قابل دسترسی نباشند.
- HTTPS و redirect از HTTP به HTTPS فعال باشد.
- از دیتابیس، فایل‌های فعلی `public/assets/` و `.env` backup گرفته شود.
- فایل migration یک‌بارمصرف پس از اجرای موفق حذف شود؛ ابزارهای deploy موقت را روی دامنهٔ عمومی باقی نگذارید.

### P2 — دادهٔ دمو و سرور Express

در `src/server/db.ts` داده‌های حساب دمو و tokenهای تست وجود دارد. طبق معماری پروژه این مسیر فقط برای development است و Laravel تنها backend production است؛ با این حال:

- روی هاست production هرگز `pnpm start` یا `node server.ts` اجرا نشود.
- `NODE_ENV`/`APP_ENV` production روی سرویس‌های اشتراکی به‌درستی تنظیم شود.
- فایل SQLite توسعه (`database/apex_app.sqlite`) و داده‌های seed به production منتقل نشود.
- ورود admin واقعی فقط با حسابی انجام شود که رمز آن در production تغییر کرده باشد.

### P2 — عملکرد و تجربهٔ کاربر

در build فعلی:

- bundle اصلی JavaScript حدود 498 KB خام / 142 KB gzip است.
- لوگوی admin حدود 3.9 MB است و باید به WebP/AVIF یا PNG کم‌حجم تبدیل شود.
- صفحات سنگین admin/profile lazy-load شده‌اند، اما تصاویر محصول باید اندازهٔ مناسب، `loading="lazy"` و ابعاد مشخص داشته باشند.
- در موبایل واقعی، checkout، فرم OTP، منوی RTL و دکمه‌های تماس با مشتری تست شوند.

### P2 — CSP و سرویس‌های خارجی

`public/.htaccess` برای assetهای static، `connect-src 'self'` دارد. اگر API یا پنل از origin جداگانه استفاده می‌کند، origin واقعی باید به CSP و CORS اضافه شود؛ در غیر این صورت login، checkout یا Google OAuth ممکن است در مرورگر مسدود شود.

## نتایج تست‌های انجام‌شده

| بررسی | نتیجه |
|---|---|
| `pnpm install --frozen-lockfile` | موفق |
| `pnpm lint` | موفق، بدون خطای TypeScript |
| `pnpm build` | موفق؛ خروجی در `public/` |
| smoke test صفحهٔ `/` | HTTP 200 |
| smoke test مسیر SPA `/store` | HTTP 200 |
| smoke test asset JavaScript | HTTP 200 |
| preview production روی Express | API عمداً 404 و به Laravel ارجاع می‌دهد |
| production architecture tests | موفق |
| demo-mode hardening tests | 14 تست موفق |
| `bash -n` اسکریپت‌های artifact | موفق |
| `git diff --check` | موفق |
| تست‌های Feature مربوط به Auth، Products، Orders، Payments و SMS | موفق؛ ۷۹ تست با warningهای زیرساختی موجود در TestCase |
| تست‌های TypeScript چرخهٔ token، checkout، payment status و production architecture | موفق؛ همهٔ سناریوهای acceptance اجرا شدند |
| production route discovery با `APP_ENV=production` | موفق؛ route شبیه‌سازی پرداخت ثبت نمی‌شود |
| `php artisan test` کامل | یک تست قدیمی wallet sync به idempotency key نیاز داشت؛ assertion/fixture آن همگام شد و تست هدف موفق شد |
| release checklist | در محیط بدون `.env` واقعی شکست مورد انتظار: APP_KEY، CORS و SMS credentials تنظیم نشده‌اند |

## همگام‌سازی تست‌های قدیمی با ساختار جدید

- فیلد checkout `idempotency_key` به fixtureهای سفارش اضافه شد.
- مسیر webhook از `/payments/webhook/{gateway}` به `/payments/webhooks/{gateway}` اصلاح شد.
- payload تغییر رمز از `new_password` به `password` همگام شد.
- fixture آپلود تصویر از فایل جعلی بدون محتوای واقعی به `fake()->image()` تغییر کرد.
- snapshot آدرس سفارش و قرارداد `exchange_code`/وضعیت پرداخت با API فعلی همسان شد.
- logout و تغییر رمز اکنون bearer token واقعی را برای revoke دقیق تشخیص می‌دهند.
- base controller مفقود Laravel اضافه شد تا boot و route discovery در production شکست نخورد.

## دستور پیشنهادی انتشار

روی سیستم build یا CI:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm build
bash -n scripts/build_shared_hosting_artifact.sh
bash scripts/build_shared_hosting_artifact.sh
```

روی staging با PHP 8.3 و MySQL:

```bash
composer install --no-dev --optimize-autoloader
php artisan migrate --force
php artisan optimize:clear
php artisan config:cache
php artisan route:cache
php artisan view:cache
pnpm release:checklist
pnpm release:smoke
```

سپس با مرورگر واقعی این مسیرها را بررسی کنید:

- `/`
- `/store`
- `/product/<slug>`
- `/auth`
- `/cart`
- `/checkout`
- `/api/v1/health`
- `/admin`

## تصمیم نهایی

**وضعیت فعلی: آمادهٔ build و آمادهٔ رفتن به staging، اما هنوز آمادهٔ انتشار عمومی و جذب مشتری نیست** تا زمانی که `.env` واقعی، دیتابیس MySQL، درگاه پرداخت، SMS/email و تست end-to-end روی staging تأیید شوند.
