# رخداد تصویر محصول در هاست اشتراکی

در بررسی مستقیم پنل واقعی نوین‌نت در تاریخ ۲۰۲۶-۰۸-۲۵، یکی از URLهای ثبت‌شدهٔ upload چنین بود:

```text
https://noovinnet.ir/uploads/products/d3cdc4b8-ca12-46b4-924a-60908ea5b488.jpg
```

این URL پاسخ `404 text/html` بازمی‌گرداند، در حالی که تصویرهای خارجی نمونه پاسخ `200 image/jpeg` داشتند. علت، نوشتن فایل در `novinet_core/public/uploads/products` بود؛ اما وب‌سرور هاست فقط `public_html` را سرو می‌کند. اصلاح انجام‌شده در `ProductImageUploadController` در صورت وجود ساختار standard shared hosting، فایل را مستقیماً در `public_html/uploads/products` ذخیره می‌کند و در محیط محلی همچنان از Laravel `public_path()` استفاده می‌کند.

پس از deploy commit اصلاح، باید یک تصویر تازه upload شود؛ URLهای قدیمی که پیش از اصلاح ثبت شده‌اند همچنان به فایل‌های مسیر قبلی اشاره می‌کنند و باید در فرم محصول دوباره upload یا حذف شوند.
