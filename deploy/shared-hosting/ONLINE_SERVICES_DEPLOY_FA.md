# استقرار خدمات آنلاین با صفحهٔ اختصاصی

این راهنما برای commit `f3d4c1d` و نسخه‌های بعدی آن است. قابلیت جدید از جدول موجود `service_catalogs` استفاده می‌کند و فقط شش ستون محتوایی به آن اضافه می‌شود؛ داده‌های فعلی خدمات یا درخواست‌های مشتری حذف نمی‌شوند.

## مرحلهٔ ۱: backup و ارتقای schema

از طریق phpMyAdmin ابتدا از database یک Export بگیرید. سپس فایل `online_services_schema_upgrade.sql` را فقط **یک‌بار** از بخش **Import** همان database اجرا کنید. در صورت نمایش خطای «Duplicate column»، به این معنا است که schema پیش‌تر اعمال شده و نباید SQL را دوباره اجرا کنید.

## مرحلهٔ ۲: deploy کد

در workflow **Build Shared Hosting Incremental Update**، base را commit فعلی deploy‌شده و target را `main` قرار دهید. پس از پایان workflow، محتوای ZIP `1_UPDATE_NOVINET_CORE_CHANGED_FILES.zip` را داخل `novinet_core` و محتوای ZIP `2_UPDATE_PUBLIC_HTML_CHANGED_FILES.zip` را داخل `public_html` Extract کنید. فایل `.env` نباید جایگزین شود.

## مرحلهٔ ۳: آزمون عملی

با حساب مدیر وارد `/admin` شوید، به «خدمات آنلاین» بروید و یک خدمت تازه بسازید. عنوان، دسته، slug انگلیسی یکتا، توضیح کوتاه، راهنمای کامل و لینک ارتباط را ثبت کنید و «انتشار» را بزنید. سپس URL زیر باید صفحهٔ مستقلی برای همان خدمت نشان دهد:

```text
https://noovinnet.ir/services/<slug>
```

خدمت پیش‌نویس در storefront نمایش داده نمی‌شود و تا زمان انتشار قابل‌دیدن عمومی نیست.
