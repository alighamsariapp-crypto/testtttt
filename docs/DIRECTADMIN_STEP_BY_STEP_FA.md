# انتخاب راهنمای نصب DirectAdmin

برای این بسته دو روش نصب وجود دارد. با توجه به اینکه هاست شما **Terminal ندارد**، فقط روش اول را انجام دهید.

| وضعیت هاست | راهنمای درست |
| --- | --- |
| هاست اشتراکی بدون Terminal | [`PHP_MYADMIN_NO_TERMINAL_SETUP_FA.md`](PHP_MYADMIN_NO_TERMINAL_SETUP_FA.md) |
| هاست دارای Terminal و نیاز به اجرای migration | راهنمای قدیمی فقط برای مدیر فنی/پشتیبانی هاست است. |

## برای هاست شما

راهنمای `PHP_MYADMIN_NO_TERMINAL_SETUP_FA.md` را قدم‌به‌قدم انجام دهید. روند کار این است:

1. فایل `.env` آمادهٔ داخل ZIP را با اطلاعات دامنه و MySQL خودتان ویرایش کنید.
2. فایل `database/install/noovinnet_schema.sql` را در دیتابیس **خالی** با phpMyAdmin Import کنید.
3. آدرس `/initial-admin-setup.php` را باز کنید، `INSTALLER_TOKEN` خودتان را وارد کنید و ادمین اولیه را بسازید.
4. بررسی کنید فایل `public/initial-admin-setup.php` پس از موفقیت حذف شده است؛ در غیر این صورت آن را دستی حذف کنید.

> برای این روش، هیچ دستور Terminal، Node.js، npm، Composer یا درخواست به پشتیبانی لازم نیست.
