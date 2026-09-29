# راهنمای واحد build و انتشار NoovinNet Store

## اصل مهم

در production، سایت با **Apache و Laravel/PHP** اجرا می‌شود. Node.js و Vite فقط برای build فرانت‌اند در رایانهٔ توسعه‌دهنده یا CI هستند. روی هاست اشتراکی از `pnpm start`، `node server.ts` یا یک daemon Node استفاده نکنید.

## build فرانت‌اند

در محیط توسعه، از ریشهٔ پروژه اجرا کنید:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm build
```

فرمان build ابتدا فقط `public/assets` را پاک می‌کند و سپس Vite خروجی جدید را در `public/` می‌سازد. فایل‌های `public/index.php` و `public/.htaccess` که Laravel به آن‌ها نیاز دارد حذف نمی‌شوند.

## آماده‌سازی برای هاست اشتراکی

1. فایل `.env` واقعی را در Git یا فایل ZIP عمومی قرار ندهید. از `.env.example` یا تنظیمات هاست برای ساخت آن استفاده کنید.
2. Document Root دامنه یا subdomain را روی پوشهٔ `public/` پروژه تنظیم کنید. اگر کنترل‌پنل اجازهٔ تغییر Document Root نمی‌دهد، فقط محتوای `public/` را در `public_html` قرار دهید و باقی Laravel را در مسیر امن خارج از web root نگه دارید؛ سپس مسیرهای bootstrap را مطابق راهنمای DirectAdmin تنظیم کنید.
3. پوشه‌های `storage/` و `bootstrap/cache/` باید توسط کاربر وب‌سرور قابل‌نوشتن باشند.
4. متغیرهای دیتابیس، mail، Google OAuth، درگاه پرداخت و پنل پیامک فقط در `.env` سرور قرار می‌گیرند.

## فرمان‌های Laravel پس از انتشار

اگر Terminal یا SSH در اختیار دارید، پس از آپلود اجرا کنید:

```bash
php artisan migrate --force
php artisan optimize:clear
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

در صورت نداشتن Terminal، از راهنمای [تنظیم از طریق phpMyAdmin](../PHP_MYADMIN_NO_TERMINAL_SETUP_FA.md) و [راهنمای DirectAdmin](../DIRECTADMIN_STEP_BY_STEP_FA.md) استفاده کنید.

## بررسی قبل از انتشار

| بررسی | نتیجهٔ موردانتظار |
|---|---|
| `pnpm lint` | TypeScript بدون خطا |
| `pnpm build` | `public/index.html` به فایل‌های هش‌شده داخل `public/assets/` اشاره کند |
| `php artisan migrate --force` | migrationهای جدید با موفقیت اعمال شوند |
| صفحهٔ اصلی و محصول | دارایی‌های CSS/JS بدون خطای 404 بارگذاری شوند |
| `/api/v1/health` | پاسخ JSON سالم برگرداند |
| ورود و checkout | پس از deployment دستی تست شوند |

## بازگشت امن

قبل از انتشار، از فایل‌های فعلی `public/assets/`، دیتابیس و `.env` سرور backup بگیرید. اگر مشکل رخ داد، build قبلی و backup دیتابیس را بازگردانید؛ هرگز با حذف تصادفی کل پوشهٔ `public/` سایت را به حالت قبل برنگردانید.
