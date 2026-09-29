# ApexStore / NoovinNet — راهنمای اصلی پروژه

## ۱. معرفی

ApexStore / NoovinNet یک فروشگاه اینترنتی و سامانهٔ خدمات مهندسی است که با **Laravel 12 / PHP 8.3+** در بک‌اند و **React / TypeScript / Tailwind CSS** در فرانت‌اند ساخته شده است. معماری پروژه برای استقرار روی **DirectAdmin و هاست اشتراکی Apache/PHP** در نظر گرفته شده و به Docker، Redis، Supervisor یا سرویس دائمی Node.js وابسته نیست.

> در محیط production، Laravel و Apache اجراکنندهٔ سایت هستند. Node.js فقط برای توسعه و build فرانت‌اند استفاده می‌شود.

## ۲. معماری ماژولار Laravel

```text
app/Modules/
├── Shared/         # Value Objects، DTO، helper، exception و قراردادهای مشترک
├── Auth/           # Sanctum، نقش‌ها، بازیابی رمز و تأیید هویت
├── Users/          # کاربران، آدرس‌ها، policy و جداسازی دادهٔ مشتری
├── Categories/     # درخت دسته‌بندی
├── Products/       # محصولات، واریانت‌ها، ویژگی‌ها و قیمت‌گذاری
├── Inventory/      # کنترل موجودی با lock تراکنشی
├── Cart/           # سبد خرید با محاسبهٔ سمت سرور
├── Orders/         # checkout، snapshot سفارش و پیگیری
├── Payments/       # درگاه‌ها، callback و idempotency
├── Services/       # خدمات مهندسی، درخواست و quotation
├── Admin/          # داشبورد و مدیریت فروشگاه
├── Settings/       # تنظیمات فروشگاه و ظاهر
├── Support/        # تیکت و پشتیبانی
└── Wallet/         # کیف پول و تراکنش‌ها
```

## ۳. اصول فنی

| اصل | توضیح |
|---|---|
| **قیمت‌گذاری سمت سرور** | قیمت و جمع سفارشِ ارسالی از مرورگر قابل‌اعتماد نیست و بک‌اند باید آن را دوباره محاسبه کند. |
| **کنترل موجودی تراکنشی** | عملیات حساس موجودی داخل transaction و با lock اجرا می‌شود تا فروش بیش‌ازموجودی رخ ندهد. |
| **سازگاری با هاست اشتراکی** | public directory، Apache rewrite و فرمان‌های PHP/Laravel مبنای deployment هستند. |
| **build قابل‌ردیابی** | خروجی React در `public/` تولید می‌شود تا همراه Laravel روی هاست قرار گیرد. |

## ۴. فرمان‌های توسعه و build

| فرمان | کاربرد |
|---|---|
| `pnpm dev` | اجرای محیط توسعهٔ محلی Node/Vite. |
| `pnpm build` | حذف دارایی‌های قدیمی `public/assets` و تولید build جدید React در `public/`. |
| `pnpm preview` | مشاهدهٔ موقت build Vite به‌صورت محلی؛ برای production استفاده نمی‌شود. |
| `pnpm lint` | بررسی TypeScript بدون تولید فایل. |
| `php artisan test` | اجرای تست‌های Laravel. |

برای production روی هاست اشتراکی، از `pnpm start` یا `server.ts` استفاده نکنید. پس از build محلی یا CI، فایل‌های پروژه را روی هاست قرار دهید، Document Root را به `public/` تنظیم کنید و فرمان‌های لازم Laravel مانند migration و cache را طبق راهنمای deployment اجرا کنید.

## ۵. نقشهٔ مستندات

| دسته | فایل‌های اصلی |
|---|---|
| معماری و API | [معماری](./docs/ARCHITECTURE.md)، [API](./docs/API.md)، [دیتابیس](./docs/DATABASE.md)، [امنیت](./docs/SECURITY.md) |
| استقرار | [راهنمای artifact خودکار برای File Manager](./docs/deployment/AUTOMATED_SHARED_HOSTING_ARTIFACT_FA.md)، [راهنمای واحد build و release](./docs/deployment/BUILD_AND_RELEASE_FA.md)، [راهنمای deployment](./docs/DEPLOYMENT.md)، [راهنمای DirectAdmin](./docs/DIRECTADMIN_STEP_BY_STEP_FA.md)، [رفع ایرادهای هاست اشتراکی](./docs/DIRECTADMIN_SHARED_HOSTING_FIX_FA.md) |
| فرانت‌اند | [وضعیت و پیگیری فرانت](./docs/frontend/FRONTEND_STATE.md) |
| Google OAuth | [استقرار DirectAdmin](./docs/deployment/google-oauth/DIRECTADMIN_DEPLOYMENT_FA.md)، [متغیرهای محیطی](./docs/deployment/google-oauth/ENV_SNIPPET.txt) |
| تاریخچه | [Changelog](./docs/history/CHANGELOG.md)، [patchهای استقرار](./docs/deployment/patches/) |
| سایر | [گزارش آمادگی انتشار](./docs/RELEASE_READINESS_FA.md)، [گزارش نهایی](./docs/FINAL_RELEASE_REPORT_FA.md) |

برای فهرست کامل و ترتیب پیشنهادی مطالعه، [راهنمای مستندات](./docs/README.md) را ببینید.
