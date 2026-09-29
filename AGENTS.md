# AI STUDIO DEVELOPMENT — CONTEXT & TOKEN EFFICIENCY RULES

## 1. Minimal Context
برای هر Task فقط فایلها و کدهایی را بررسی کن که مستقیماً به همان Task مربوط هستند.
کل پروژه را بدون نیاز دوباره Scan نکن.

## 2. No Re-Audit
اگر یک Feature قبلاً با وضعیت PASS تأیید شده است، آن Feature را دوباره Audit نکن؛ مگر اینکه Task جدید مستقیماً به آن وابسته باشد.

## 3. One Task At A Time
هر Prompt فقط یک Feature یا یک مشکل مشخص را انجام دهد.

## 4. Inspect Before Edit
ابتدا فقط فایلهای مرتبط را پیدا و بررسی کن. از خواندن غیرضروری فایلهای نامرتبط خودداری کن.

## 5. Surgical Changes
فقط قسمت لازم را تغییر بده. از Rewrite کردن فایلهای بزرگ یا Refactor غیرضروری خودداری کن.

## 6. No Unnecessary Architecture Changes
اگر Architecture فعلی برای حل Task کافی است، معماری، دیتابیس، APIها و کامپوننت‌های نامرتبط را تغییر نده.

## 7. No Duplicate Implementation
قبل از ساخت Component / API / Utility جدید، بررسی کن آیا نمونه موجود قابل استفاده است یا خیر.

## 8. Testing Scope
فقط تستهای مربوط به Feature فعلی را اجرا کن. تست کامل کل پروژه فقط زمانی انجام شود که صراحتاً درخواست شده باشد.

## 9. Compact Reports
گزارش نهایی کوتاه باشد و فقط شامل این ساختار باشد:
- STATUS
- ROOT CAUSE
- WHAT CHANGED
- TEST RESULT
- FILES CHANGED
- NEXT BLOCKER

## 10. STOP RULE
پس از اتمام Task متوقف شو. به Task بعدی، Phase بعدی یا Feature بعدی خودکار وارد نشو.

## 11. Preserve Existing Work
هیچ تغییر غیرضروری در Featureهای قبلاً تأییدشده ایجاد نکن.

## 12. IMPORTANT
هدف این قوانین کاهش مصرف Context و جلوگیری از پردازش غیرضروری است. کیفیت کد و تست نباید کاهش پیدا کند؛ فقط Scope هر Task باید کوچک و دقیق باشد.
