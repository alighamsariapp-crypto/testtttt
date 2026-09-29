# ساخت دستی بستهٔ آمادهٔ هاست اشتراکی

هر زمان که به ZIP آمادهٔ استقرار نیاز دارید، از صفحهٔ Actions اجرای دستی workflow را شروع کنید. سپس GitHub فرانت React را build می‌کند، وابستگی‌های production Laravel را آماده می‌کند و artifact قابل‌دانلودِ File Manager می‌سازد.

## از کجا دانلود کنم؟

1. وارد مخزن GitHub شوید و تب **Actions** را باز کنید.
2. از ستون سمت چپ، workflow با عنوان **Build Shared Hosting Artifact** را انتخاب کنید.
3. دکمهٔ **Run workflow** را بزنید، شاخهٔ `main` را انتخاب کنید و دوباره **Run workflow** را تأیید کنید.
4. پس از موفقیت اجرا، همان run را باز کنید و commit نشان‌داده‌شده در بالای run را با commit موردنظر در شاخهٔ `main` مقایسه کنید.
5. در پایین صفحه و بخش **Artifacts**، فقط فایل `novinet-shared-hosting-<commit-sha>` متعلق به همان run را دانلود کنید. بخش `<commit-sha>` باید با commit اجراشده هم‌خوان باشد.

داخل artifact این موارد قرار دارند:

| فایل                                   | کاربرد                                                                               |
| -------------------------------------- | ------------------------------------------------------------------------------------ |
| `1_UPLOAD_TO_HOME_NOVINET_CORE.zip`    | هستهٔ Laravel و `vendor`؛ در کنار `public_html` extract می‌شود.                      |
| `2_UPLOAD_TO_PUBLIC_HTML.zip`          | فایل‌های قابل‌دسترسی سایت و build جدید React؛ داخل `public_html` extract می‌شود.     |
| `database/FRESH_DATABASE_IMPORT.sql`   | فقط برای اولین نصب روی دیتابیس جدید و خالی.                                          |
| `MIGRATION_RUN_URL.txt`                | URL یک‌بارمصرف برای اجرای migration در updateهای بعدی، بدون Terminal.                |
| `README_FILE_MANAGER_DEPLOYMENT_FA.md` | راهنمای کامل File Manager.                                                           |
| `BUILD_INFO.txt`                       | branch، commit کامل، زمان build و hash فایل‌های اصلی فرانت؛ پیش از upload بررسی شود. |
| `SHA256SUMS.txt`                       | checksum دو ZIP برای کنترل یکپارچگی فایل دانلودی.                                    |

## کنترل نسخه پیش از upload

قبل از extract کردن هر ZIP، فایل `BUILD_INFO.txt` را باز کنید. مقدار `Source branch` باید `main` باشد و مقدار `Source commit` باید با commit release موردنظر در GitHub یکی باشد. سپس بررسی کنید نام artifact نیز همان commit را در انتهای خود دارد. اگر هرکدام متفاوت بود، آن artifact را روی سرور استفاده نکنید.

> وجود `SHA256SUMS.txt` یعنی دو ZIP داخل artifact هنگام ساخت کنترل شده‌اند. در صورت دانلود ناقص یا مشکوک، artifact را دوباره از همان run دانلود کنید.

## تفاوت اولین نصب و update بعدی

در اولین نصب، دیتابیس جدید را با `FRESH_DATABASE_IMPORT.sql` import می‌کنید. در updateهای بعدی، این SQL را روی دیتابیس فعال import نکنید. ZIPهای جدید را upload کنید و سپس URL داخل `MIGRATION_RUN_URL.txt` را فقط یک‌بار باز کنید تا migrationهای جدید اجرا شوند.

> فایل `.env` واقعی و رمز دیتابیس عمداً در artifact وجود ندارند. فایل `.env` فعلی سرور باید در `novinet_core` حفظ شود و هرگز به GitHub یا `public_html` منتقل نشود.

## اگر workflow خطا داد

در صفحهٔ اجرای Actions، مرحله‌ای که با خطا روبه‌رو شده را باز کنید. اگر خطا مربوط به TypeScript، build یا Composer باشد، artifact ساخته نمی‌شود؛ یعنی بستهٔ ناقص برای دانلود در دسترس قرار نمی‌گیرد. متن خطا یا لینک execution را بفرستید تا همان نسخه را بررسی کنیم.

## update سبک: فقط ZIP فایل‌های تغییرکرده

پس از آن‌که یک نسخه روی هاست با موفقیت تست شد، workflow **Record Shared Hosting Deployment** را فقط یک‌بار اجرا کنید و `Target commit` همان نسخه را از `BUILD_INFO.txt` یا `DEPLOY_INFO.txt` وارد کنید. این کار هیچ فایلی روی سرور upload نمی‌کند؛ فقط به GitHub می‌گوید نسخهٔ فعلیِ نصب‌شده چیست.

برای updateهای بعدی، به‌جای workflow کامل، workflow **Build Shared Hosting Incremental Update** را روی شاخهٔ `main` اجرا کنید. artifact آن فقط تفاوت بین نسخهٔ ثبت‌شدهٔ روی سرور و commit جدید را دارد.

| فایل در artifact تغییرات                              | محل استفاده                                                                                 |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `1_UPDATE_NOVINET_CORE_CHANGED_FILES.zip`             | فقط اگر وجود داشت، داخل پوشهٔ موجود `novinet_core` extract شود.                             |
| `2_UPDATE_PUBLIC_HTML_CHANGED_FILES.zip`              | فقط اگر وجود داشت، داخل پوشهٔ موجود `public_html` extract شود.                              |
| `DEPLOY_INFO.txt`                                     | پیش از هر کاری باز شود؛ commit مبنا، commit هدف، migration و تغییر `vendor` را نشان می‌دهد. |
| `CORE_CHANGED_FILES.txt` و `PUBLIC_CHANGED_FILES.txt` | فهرست دقیق فایل‌هایی که داخل ZIPها هستند.                                                   |
| `REMOVALS_NOT_APPLIED.txt`                            | فایل‌هایی که عمداً خودکار حذف نمی‌شوند؛ برای جلوگیری از آسیب به سایت.                       |
| `MIGRATION_RUN_URL.txt`                               | فقط اگر وجود داشت و فقط یک‌بار، پس از extract اجرا شود.                                     |

> در تغییرات React، فایل‌های `assets` نام hash‌شده دارند و به یکدیگر وابسته‌اند. بنابراین ZIP شمارهٔ ۲ ممکن است همهٔ خروجی build فعلی React را داشته باشد، نه فقط یک فایل JS یا CSS. این حالت لازم و امن است؛ ZIP را کامل داخل `public_html` Extract کنید تا `index.html` و assetها با هم هماهنگ بمانند.

> اگر `DEPLOY_INFO.txt` گفت `Migration action required: yes`، بعد از Extract هر دو ZIP موجود و پس از backup دیتابیس، URL داخل `MIGRATION_RUN_URL.txt` را یک‌بار باز کنید. اگر workflow به‌علت حذف فایل runtime متوقف شد، update سبک انجام ندهید؛ آن مورد به package کامل و بررسی نیاز دارد.

بعد از تست موفق سایت، دوباره workflow **Record Shared Hosting Deployment** را با `Target commit` همین artifact اجرا کنید. از آن به بعد ZIP تغییرات بعدی نسبت به همین نسخه ساخته می‌شود.
