# ممیزی انتقال کامل پنل staging به پروژهٔ واقعی نوین‌نت

## وضعیت استقرار و branch

جایگزینی UI اکنون در `main` ادغام شده است. نقطهٔ ورود همچنان `src/components/admin/AdminLayout.tsx` است؛ بنابراین route ادمین، `AdminAuthGuard` واقعی، Laravel، APIها، database و storefront عمومی دست‌نخورده باقی مانده‌اند.

> branch بازگشت پیش از جایگزینی کامل با نام `backup/admin-before-full-staging-replacement` روی commit `c95daec` نگه‌داری می‌شود. اتصال دادهٔ واقعی این بخش در commit مستقل و پس از QA اضافه خواهد شد.

## دامنهٔ جایگزینی کامل UI

| بخش | وضعیت در branch فعلی | مرز عملیاتی |
|---|---|---|
| احراز هویت ادمین | حفظ شده | `AdminAuthGuard` پیش از replica اجرا می‌شود. |
| shell، sidebar، header و mobile nav | جایگزین شده | همان زبان RTL، app-like و responsive staging را نمایش می‌دهد. |
| پیشخوان، کالا، سفارش، دسته، تخفیف، کمپین، خدمات، سایت، تیکت و مشتری | جایگزین شده | رفتارهای نمایشی با state محلی staging کار می‌کنند. |
| تنظیمات | جایگزین شده | ۱۹ مقصد تنظیمات با route داخلی، فرم و اعتبارسنجی محلی دارد. |
| storefront عمومی | حفظ شده | هیچ component یا route عمومی جایگزین نشده است. |
| Laravel و APIهای ادمین | حفظ شده | در این مرحله contract یا endpoint تغییر نکرده است. |

## دارایی و isolation سبک‌ها

لوگوی پنل از `src/components/admin/staging/assets/novinet-admin-logo.png` وارد bundle می‌شود؛ در نتیجه هیچ وابستگی به مسیرهای staging یا `manus-storage` در source پنل وجود ندارد. stylesheet منتقل‌شده نیز زیر wrapper `.staging-admin-replica` scope شده است تا پس از خروج از `/admin` بر storefront اثر نگذارد.

QA رفت‌وبرگشت `storefront → admin → storefront`، ظاهر پایهٔ public را بدون تغییر و console را بدون خطا ثبت کرده است. همچنین `pnpm lint`، `pnpm build` و QA CDP shell/settings/mobile با موفقیت انجام شده‌اند.

## اتصال دادهٔ واقعی — وضعیت فعلی

adapter `adminLiveData.ts` مدل‌های واقعی `AppContext` را به presentation مدل replica تبدیل می‌کند. پس از تأیید کاربر، mutationهای محدود کالا، دسته و رسیدگی سفارش نیز تنها از actionهای موجود `AppContext` استفاده می‌کنند؛ endpoint یا contract جدیدی ساخته نشده است.

| اولویت | workspace | منبع موجود | روش امن اتصال |
|---|---|---|---|
| ۱ | پیشخوان | `/api/v1/admin/dashboard` | متصلِ خواندنی؛ فروش، تعداد سفارش، میانگین سفارش، کاربران و پرداخت‌های در انتظار از aggregate واقعی خوانده می‌شوند. نمودار دوره‌ای عمداً تا آماده‌شدن API آن فعال نشده است. |
| ۲ | کالا | actionهای CRUD فعلی `/admin/products` | ایجاد، ویرایش پایه، حذف، فعال/غیرفعال و ویژه‌کردن فعال است. تصویر فایل و ویرایش ترکیب‌های موجود عمداً تا آماده‌شدن storage/contract backend غیرفعال‌اند. |
| ۳ | دسته | actionهای CRUD فعلی `/admin/categories` | ایجاد، ویرایش نام/slug/وضعیت، حذف و فعال/غیرفعال فعال است؛ پنل فعلی دستهٔ سطح‌اول را مدیریت می‌کند. |
| ۴ | سفارش | `PATCH /admin/orders/{id}/status` | فقط تغییر وضعیت و کد رهگیری فعال است. ایجاد یا حذف سفارش از پنل مجاز نیست. |
| ۵ | مشتری، تیکت و تخفیف | endpointهای موجود admin | اتصال module-by-module همراه با کنترل نقش admin/staff. |
| ۶ | تنظیمات | `store_settings`، `payment_gateways` و `sms_config` | اتصال فقط groupهای پشتیبانی‌شده؛ ۱۶ مقصد دیگر تا قرارداد Laravel در حالت dependency/local می‌مانند. |

## معیارهای مرحلهٔ بعد و rollback

پیش از فعال‌کردن mutation بعدی، کاربر باید operationهای فعال‌شده را در پنل deployed تأیید کند. سپس هر workspace به‌طور مستقل به actionهای آمادهٔ API وصل و QA می‌شود. در صورت مشاهدهٔ اختلاف UI یا داده، rollback ایمن با commit پیش از این اتصال یا branch پشتیبان انجام می‌شود؛ componentهای legacy نیز فعلاً برای این منظور از دیسک حذف نشده‌اند.
