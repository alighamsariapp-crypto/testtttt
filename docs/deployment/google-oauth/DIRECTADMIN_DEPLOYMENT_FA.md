# راهنمای استقرار ورود با Google برای NoovinNet

> **هدف:** این patch دکمهٔ فعلی «ادامه با Google» را به OAuth واقعی متصل می‌کند؛ بدون بازطراحی UI و بدون قراردادن Client Secret در frontend. token دائمی Sanctum نیز هرگز در URL بازگشت قرار نمی‌گیرد.

## پیش‌نیازهای امنیتی

این پیاده‌سازی از **OAuth 2.0 / OpenID Connect با Authorization Code Flow سمت سرور** استفاده می‌کند. Google برای Web Application به Client ID، Client Secret و Redirect URI دقیق نیاز دارد؛ Redirect URI باید دقیقاً با مقدار ثبت‌شده در Google Cloud یکسان باشد. همچنین Google توصیه می‌کند state برای مقابله با جعل درخواست بررسی شود.[1][2]

| مورد | مقدار production |
|---|---|
| نوع credential | **OAuth client ID → Web application** |
| Redirect URI مجاز | `https://noovinnet.ir/api/v1/auth/google/callback` |
| URL بازگشت frontend | `https://noovinnet.ir/auth` |
| Scopeهای درخواست‌شده | `openid email profile` |
| Client Secret | فقط در `.env` روی سرور؛ هرگز در کد frontend، ZIP عمومی یا گفتگو قرار ندهید. |

## بخش اول — ساخت تنظیمات در Google Cloud

> **نوتیفیکیشن — اقدام لازم شما:** این بخش نیاز دارد با حساب مالک پروژهٔ Google Cloud وارد شوید. Client Secret را به هیچ‌کس در پیام ارسال نکنید.

1. به [Google Cloud Console – Google Auth Platform](https://console.cloud.google.com/auth/overview) وارد شوید و یک پروژهٔ موجود را انتخاب کنید یا پروژهٔ جدید بسازید.
2. در **Branding**، نام برنامه، ایمیل پشتیبانی و اطلاعات تماس مالک را تکمیل کنید.
3. در **Audience**، برای سایتی که مشتریان عمومی وارد آن می‌شوند گزینهٔ **External** را انتخاب کنید. اگر برنامه هنوز در حالت Testing می‌ماند، فقط حساب‌های مجاز را در **Test users** اضافه کنید؛ برای استفادهٔ عمومی، وضعیت انتشار را مطابق سیاست Google کامل کنید.[3]
4. در **Data Access** فقط scopeهای پایهٔ `openid`، `email` و `profile` را انتخاب کنید. این سایت برای ورود، نیازی به دسترسی Drive، Gmail، Calendar یا scopeهای حساس ندارد.[3]
5. به **Clients** بروید، گزینهٔ **Create client** را بزنید و نوع **Web application** را انتخاب کنید.
6. در **Authorized redirect URIs** دقیقاً این مقدار را ثبت کنید:

   ```text
   https://noovinnet.ir/api/v1/auth/google/callback
   ```

   آدرس باید دقیقاً یکسان باشد؛ تفاوت `http/https`، `www`، slash پایانی یا مسیر باعث خطای `redirect_uri_mismatch` می‌شود.[1][2]
7. Client ID و Client Secret را فقط برای ورود به `.env` نگه دارید. آن‌ها را در chat، فایل ZIP یا source code قرار ندهید.

## بخش دوم — استقرار patch در DirectAdmin

> **نوتیفیکیشن — اقدام لازم شما:** پیش از extract، از `public_html` و دیتابیس فعلی backup بگیرید. این patch هیچ دادهٔ `QA-TEST` یا رکورد موجود را حذف نمی‌کند.

1. فایل `noovinnet-google-oauth-directadmin-patch.zip` را در **DirectAdmin → File Manager → public_html** آپلود کنید.
2. روی ZIP راست‌کلیک کرده و **Extract** را در همان `public_html` انجام دهید. گزینهٔ overwrite برای فایل‌های patch لازم است.
3. در **phpMyAdmin**، دیتابیس فعلی سایت را انتخاب کنید، سپس از Import فایل داخل patch با مسیر زیر را اجرا کنید:

   ```text
   database/install/google_oauth_accounts_migration.sql
   ```

   این اسکریپت فقط جدول جدید `oauth_accounts` را با `CREATE TABLE IF NOT EXISTS` اضافه می‌کند. به جدول‌های کاربران، سفارش‌ها و داده‌های QA دست نمی‌زند.
4. فایل واقعی `.env` را در `public_html` باز کنید و این چهار مقدار را اضافه یا اصلاح کنید. به‌جای placeholderها مقادیر credential خود Google را وارد کنید:

   ```dotenv
   GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID
   GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET
   GOOGLE_REDIRECT_URI=https://noovinnet.ir/api/v1/auth/google/callback
   GOOGLE_FRONTEND_REDIRECT=https://noovinnet.ir
   ```

   مقدارهای Client ID و Client Secret را ذخیره کنید، اما آن‌ها را در هیچ تصویر، گزارش یا پیام به اشتراک نگذارید.
5. اگر فایلی با نام `bootstrap/cache/config.php` در هاست وجود دارد، آن را حذف کنید تا Laravel تنظیمات جدید `.env` را بخواند. فقط همین فایل cache را حذف کنید؛ به پوشه‌های دیگر دست نزنید.

## بخش سوم — آزمون production پس از تنظیم

پس از اتمام مراحل بالا، به `https://noovinnet.ir/auth` بروید و روی دکمهٔ «ادامه با Google» بزنید.

| انتظار | نشانهٔ موفقیت |
|---|---|
| شروع ورود | انتقال HTTPS به `accounts.google.com` بدون خطای `redirect_uri_mismatch` |
| بازگشت | بازگشت به `https://noovinnet.ir/auth` پس از تأیید Google |
| حساب جدید | ساخت یک customer فعال با ایمیل تأییدشدهٔ Google و نقش `customer` |
| ورود مجدد | ورود به همان حساب Google، بدون ساخت حساب تکراری |
| امنیت URL | در نوار آدرس token دائمی Sanctum دیده نمی‌شود؛ فقط handoff کوتاه‌عمر وجود دارد و فوراً پاک می‌شود. |

اگر ایمیل Google قبلاً با روش دیگری در سایت ثبت شده باشد، سیستم عمداً آن را خودکار به حساب موجود وصل نمی‌کند. این رفتار برای جلوگیری از تصاحب حساب است. کاربر باید با روش اصلی وارد شود؛ قابلیت «اتصال Google به حساب موجود» در صورت نیاز باید به‌عنوان یک فرآیند جداگانه و درون حساب authenticated پیاده‌سازی شود.

## نتیجهٔ آزمون محلی patch

| بررسی | نتیجه |
|---|---|
| PHP syntax | PASS |
| Laravel test suite | PASS — 38 tests / 212 assertions |
| آزمون‌های اختصاصی OAuth | PASS — 5 tests / 20 assertions |
| TypeScript lint | PASS |
| Vite production build | PASS |
| تست consent واقعی Google | وابسته به انجام تنظیمات محرمانهٔ Google Cloud؛ هنوز انجام نشده است. |

## منابع

[1]: https://developers.google.com/identity/protocols/oauth2/web-server "Google: Using OAuth 2.0 for Web Server Applications"
[2]: https://developers.google.com/identity/openid-connect/openid-connect "Google: OpenID Connect"
[3]: https://developers.google.com/workspace/guides/configure-oauth-consent "Google: Configure the OAuth consent screen and choose scopes"
