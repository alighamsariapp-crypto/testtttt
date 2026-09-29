# نصب NoovinNet روی DirectAdmin بدون Terminal و بدون تماس با پشتیبانی

این روش دقیقاً مشابه روشی است که قبلاً استفاده کرده‌اید: اطلاعات دیتابیس را در فایل `.env` وارد می‌کنید و یک فایل **SQL** را با phpMyAdmin در دیتابیس import می‌کنید. سپس یک صفحهٔ یک‌بارمصرف، ادمین اولیه را می‌سازد.

> برای این روش **هیچ فرمانی در Terminal اجرا نمی‌کنید** و نیازی به Node.js، npm، pnpm، Composer یا درخواست از پشتیبانی ندارید.

## فایل‌هایی که استفاده می‌کنید

| فایل | محل در ZIP | کاربرد |
| --- | --- | --- |
| `.env` | ریشهٔ ZIP | اطلاعات دامنه، دیتابیس و ادمین اولیه را در آن وارد می‌کنید. |
| `noovinnet_schema.sql` | `database/install/noovinnet_schema.sql` | ساخت تمام جدول‌های سایت از طریق phpMyAdmin. |
| `initial-admin-setup.php` | `public/initial-admin-setup.php` | یک‌بار از مرورگر باز می‌شود تا ادمین اولیه ساخته شود؛ سپس خودکار حذف می‌شود. |

---

## مرحلهٔ ۱: ساخت دیتابیس خالی

در DirectAdmin وارد **MySQL Management** شوید و یک دیتابیس و کاربر جدید بسازید. این دیتابیس باید خالی باشد. نام کامل دیتابیس و نام کامل کاربر را، با prefix هاست، یادداشت کنید.

مثال:

```text
Database: hostinguser_noovinnet
User:     hostinguser_noovindb
Password: رمز انتخابی شما
Host:     127.0.0.1
Port:     3306
```

---

## مرحلهٔ ۲: آپلود ZIP و Extract کردن

در DirectAdmin وارد **File Manager** شوید و به `public_html` دامنه بروید. فایل `noovinnet-directadmin-ready.zip` را همان‌جا آپلود و Extract کنید.

پس از Extract باید پوشه‌های زیر مستقیم داخل `public_html` باشند:

```text
app/
public/
vendor/
database/
artisan
.env
.htaccess
```

اگر همهٔ این موارد داخل یک پوشهٔ اضافه قرار گرفتند، محتویات آن پوشه را به `public_html` منتقل کنید.

---

## مرحلهٔ ۳: فایل `.env` را ویرایش کنید

نمایش فایل‌های مخفی را در File Manager فعال کنید و فایل `.env` را باز کنید. فقط مقادیر زیر را تغییر دهید:

```dotenv
APP_URL=https://YOUR-DOMAIN.COM

DB_DATABASE=نام_کامل_دیتابیس
DB_USERNAME=نام_کامل_کاربر_دیتابیس
DB_PASSWORD="رمز_دیتابیس"

SESSION_DOMAIN=YOUR-DOMAIN.COM
SANCTUM_STATEFUL_DOMAINS=YOUR-DOMAIN.COM,www.YOUR-DOMAIN.COM
CORS_ALLOWED_ORIGINS=https://YOUR-DOMAIN.COM,https://www.YOUR-DOMAIN.COM

INITIAL_ADMIN_NAME="نام شما"
INITIAL_ADMIN_EMAIL="ایمیل واقعی مدیر"
INITIAL_ADMIN_PHONE="شماره موبایل مدیر"
INITIAL_ADMIN_PASSWORD="یک رمز بسیار قوی و اختصاصی"

INSTALLER_TOKEN="یک کد طولانی و محرمانه که خودتان انتخاب می‌کنید"
```

نمونه برای `INSTALLER_TOKEN`:

```text
INSTALLER_TOKEN=azP9xK2mQ7vR4nT8yL6cD1wH5sF3jB0e
```

این کد را در جایی امن یادداشت کنید؛ فقط یک‌بار، در مرحلهٔ ۵، داخل صفحهٔ نصب وارد می‌شود. آن را به هیچ‌کس ندهید.

**این موارد را تغییر ندهید:**

```dotenv
APP_KEY=...
APP_ENV=production
APP_DEBUG=false
SEED_DEMO_DATA=false
VITE_ENABLE_DEMO_MODE=false
```

---

## مرحلهٔ ۴: Import کردن دیتابیس در phpMyAdmin

در DirectAdmin وارد **phpMyAdmin** شوید، در ستون سمت چپ روی دیتابیس خالی‌ای که ساخته‌اید کلیک کنید، سپس از منوی بالا گزینهٔ **Import** را انتخاب کنید.

در صفحهٔ Import، روی **Choose File** کلیک کنید و فایل زیر را از ZIP انتخاب کنید:

```text
database/install/noovinnet_schema.sql
```

Format را روی `SQL` بگذارید و در پایین صفحه دکمهٔ **Import** یا **Go** را بزنید. پس از موفقیت، phpMyAdmin باید پیام موفقیت نمایش دهد و جدول‌هایی مثل `users`، `products`، `orders`، `carts` و `migrations` را نشان دهد.

> این فایل SQL فقط schema و سابقهٔ migrationها را می‌سازد؛ دادهٔ مشتری، سفارش، محصول نمونه یا رمز پیش‌فرض ادمین وارد نمی‌کند. فایل SQL هیچ دستور `DROP TABLE` یا `DROP DATABASE` ندارد. با این حال، آن را فقط در دیتابیس خالی جدید import کنید.

---

## مرحلهٔ ۵: ساخت ادمین اولیه از مرورگر

پس از import موفق SQL، در مرورگر ناشناس این آدرس را باز کنید:

```text
https://YOUR-DOMAIN.COM/initial-admin-setup.php
```

صفحه‌ای با عنوان «راه‌اندازی ادمین اولیه NoovinNet» باز می‌شود. در فیلد «کد نصب»، دقیقاً همان مقدار `INSTALLER_TOKEN` که در `.env` وارد کرده‌اید را بنویسید و دکمهٔ ساخت ادمین را بزنید.

اگر همه‌چیز درست باشد، پیام موفقیت نمایش داده می‌شود. این صفحه به‌صورت خودکار فایل زیر را حذف می‌کند:

```text
public/initial-admin-setup.php
```

اگر پیام گفت فایل حذف نشده است، خودتان از File Manager آن فایل را دستی حذف کنید. این کار مهم است؛ این صفحهٔ نصب نباید بعد از ساخت ادمین باقی بماند.

---

## مرحلهٔ ۶: ورود و بررسی نهایی

حالا این آدرس را باز کنید:

```text
https://YOUR-DOMAIN.COM/auth
```

با مقادیر `INITIAL_ADMIN_EMAIL` و `INITIAL_ADMIN_PASSWORD` که در `.env` وارد کرده‌اید لاگین کنید. سپس پنل ادمین را باز کنید:

```text
https://YOUR-DOMAIN.COM/admin/orders
```

برای اطمینان از اتصال درست backend نیز این آدرس را باز کنید:

```text
https://YOUR-DOMAIN.COM/api/health
```

باید یک پاسخ JSON با `success: true` دریافت کنید.

---

## رفع خطاهای رایج

| خطا | علت محتمل | راه‌حل |
| --- | --- | --- |
| Import در phpMyAdmin خطا می‌دهد | دیتابیس خالی نیست یا کاربر دسترسی ندارد | یک دیتابیس خالی جدید بسازید و Import را دوباره انجام دهید. |
| صفحهٔ `initial-admin-setup.php` خطا می‌دهد | اطلاعات `DB_*` در `.env` اشتباه است یا SQL import نشده است | نام کامل دیتابیس/کاربر را از DirectAdmin کپی کنید و بررسی کنید جدول `users` در phpMyAdmin وجود دارد. |
| «کد نصب نادرست است» | مقدار واردشده با `INSTALLER_TOKEN` یکسان نیست | token را با دقت از `.env` کپی کنید؛ فاصلهٔ اضافی نگذارید. |
| سایت 500 می‌دهد | مجوزهای Laravel درست نیست | پوشه‌های `storage` و `bootstrap/cache` را از File Manager روی `775` قرار دهید. |
| صفحه سفید یا CSS لود نمی‌شود | ZIP در مسیر اشتباه Extract شده است | بررسی کنید پوشهٔ `public/assets` و فایل `public/index.html` داخل پروژه وجود دارند. |
| SSL یا login مشکل دارد | دامنه‌ها در `.env` اشتباه‌اند | `APP_URL`، `SESSION_DOMAIN`، `SANCTUM_STATEFUL_DOMAINS` و `CORS_ALLOWED_ORIGINS` را با دامنهٔ واقعی جایگزین کنید. |

## نکتهٔ پرداخت

پرداخت کیف پول داخلی قابل استفاده است. درگاه پرداخت آنلاین و پیامک تا زمانی که credential و callback واقعی آن‌ها تنظیم نشده‌اند، نباید live اعلام شوند.
