# خلاصهٔ استقرار NoovinNet / ApexStore در DirectAdmin

این بسته برای هاست اشتراکی **بدون Terminal** آماده شده است. راهنمای اصلی را از فایل زیر بخوانید:

```text
docs/PHP_MYADMIN_NO_TERMINAL_SETUP_FA.md
```

## مسیر نصب در یک نگاه

| مرحله | کار لازم |
| --- | --- |
| ۱ | ZIP را در `public_html` Extract کنید. |
| ۲ | فایل `.env` آماده را با دامنه، اطلاعات MySQL، مشخصات ادمین و `INSTALLER_TOKEN` اختصاصی خودتان ویرایش کنید. |
| ۳ | فایل `database/install/noovinnet_schema.sql` را در یک دیتابیس خالی از طریق phpMyAdmin Import کنید. |
| ۴ | آدرس `/initial-admin-setup.php` را باز کنید، token را وارد کنید و ادمین اولیه را بسازید. |
| ۵ | اطمینان یابید فایل نصب خودکار حذف شده یا آن را دستی از `public/initial-admin-setup.php` حذف کنید. |

## نکات مهم

| موضوع | وضعیت این بسته |
| --- | --- |
| Terminal / npm / Composer | برای این روش لازم نیست. |
| frontend | `public/index.html` و bundleهای واقعی `public/assets/` در ZIP هستند. |
| PHP dependency | پوشهٔ `vendor/` در ZIP قرار دارد. |
| فایل محیط | `.env` آماده با placeholderهای امن در ZIP قرار دارد؛ اطلاعات واقعی خودتان را وارد کنید. |
| دیتابیس | فایل SQL شامل ۳۰ جدول و ۱۶ رکورد migration است و فقط در دیتابیس خالی import می‌شود. |
| دادهٔ نمونه | SQL هیچ مشتری، محصول، سفارش یا ادمین پیش‌فرض وارد نمی‌کند. |
| نصب ادمین | فقط با token اختصاصی داخل `.env` و از طریق installer یک‌بارمصرف انجام می‌شود. |

پوشه‌های `storage/` و `bootstrap/cache/` را در File Manager روی permission `775` تنظیم کنید. `APP_DEBUG=false`، `SEED_DEMO_DATA=false` و `VITE_ENABLE_DEMO_MODE=false` را تغییر ندهید.

> پرداخت آنلاین و SMS تا زمان ورود credential و callback واقعی production نباید live اعلام شوند. پرداخت کیف پول داخلی آزموده شده است.
