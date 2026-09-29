# راهنمای مستندات NoovinNet Store

این پوشه محل رسمی مستندات پروژه است. مستندات اجرایی و تاریخی نباید در ریشهٔ repository پراکنده شوند.

## شروع سریع

| نیاز | فایل پیشنهادی |
|---|---|
| شناخت معماری | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| استقرار روی هاست اشتراکی | [DEPLOYMENT.md](./DEPLOYMENT.md) و [DIRECTADMIN_STEP_BY_STEP_FA.md](./DIRECTADMIN_STEP_BY_STEP_FA.md) |
| دریافت ZIP آماده پس از هر merge | [راهنمای artifact خودکار](./deployment/AUTOMATED_SHARED_HOSTING_ARTIFACT_FA.md) |
| تنظیم دیتابیس و migration | [DATABASE.md](./DATABASE.md) |
| بررسی API | [API.md](./API.md) |
| بررسی امنیت | [SECURITY.md](./SECURITY.md) |
| پیگیری وضعیت فرانت | [frontend/FRONTEND_STATE.md](./frontend/FRONTEND_STATE.md) |

## پوشه‌ها

| مسیر | محتوا |
|---|---|
| `deployment/` | راهنماهای استقرار، Google OAuth و patchهای فنی انتشار |
| `frontend/` | وضعیت پیگیری و نکات فرانت‌اند |
| `history/` | changelog و سوابق نسخه‌ها |
| ریشهٔ `docs/` | راهنماهای اصلی معماری، API، دیتابیس، امنیت و آماده‌سازی انتشار |

## قاعدهٔ نگهداری مستندات

هر مستند جدید باید در یکی از دسته‌های بالا ثبت شود و از README اصلی لینک داشته باشد، اگر برای راه‌اندازی یا نگهداری روزمرهٔ پروژه ضروری است. اطلاعات حساس مانند رمز دیتابیس، API key پیامک، کلید درگاه پرداخت و client secret هرگز نباید در مستندات یا Git ثبت شوند.
