import { readFile } from 'node:fs/promises';

const read = (path) => readFile(path, 'utf8');

const [cartStep1, cartStep2, popularProducts, catalog, specialDeals, mobileProfileHome, notificationsModal, mobileBottomNav, accountSettings, appContext, phoneUtility] = await Promise.all([
  read('src/components/cart/CartStep1Items.tsx'),
  read('src/components/cart/CartStep2Address.tsx'),
  read('src/components/PopularProducts.tsx'),
  read('src/components/CatalogView.tsx'),
  read('src/components/SpecialDeals.tsx'),
  read('src/components/profile/MobileProfileHome.tsx'),
  read('src/components/profile/NotificationsModal.tsx'),
  read('src/components/MobileBottomNav.tsx'),
  read('src/components/profile/AccountSettingsTab.tsx'),
  read('src/context/AppContext.tsx'),
  read('src/utils/phone.ts'),
]);

const requiredContracts = [
  ['قفل ورود مرحله اول checkout', cartStep1, "showToast('برای ثبت آدرس و ادامهٔ خرید، ابتدا وارد حساب کاربری شوید.'"],
  ['بازکردن modal ورود در مرحله اول', cartStep1, 'setAuthModalOpen(true);'],
  ['guard مهمان در مرحله آدرس', cartStep2, 'const requireLoginForAddress'],
  ['نمایش پیام ورود به‌جای آدرس مهمان', cartStep2, 'برای ثبت آدرس وارد حساب شوید'],
  ['عدم نمایش AddressModal برای مهمان', cartStep2, 'isOpen={Boolean(user) && isModalOpen}'],
  ['قیمت و کنترل تعداد کارت محبوب در grid مستقل', popularProducts, 'grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2'],
  ['قیمت کارت محبوب بدون truncate', popularProducts, 'whitespace-nowrap tabular-nums'],
  ['قیمت و کنترل تعداد کارت کاتالوگ در grid مستقل', catalog, 'grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2 mt-2'],
  ['قیمت و کنترل تعداد پیشنهاد ویژه در grid مستقل', specialDeals, 'grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2 pt-1'],
  ['badge پشتیبانی فقط از اعلان خوانده‌نشده', mobileProfileHome, 'unreadSupportNotifications.length > 0'],
  ['خوانده‌کردن اعلان پشتیبانی هنگام ورود به تب', mobileProfileHome, 'markSupportNotificationsRead();'],
  ['نمایش وضعیت خوانده‌شدن اعلان', notificationsModal, "{isRead ? 'خوانده شد' : 'جدید'}"],
  ['پیام تأیید خوانده‌شدن اعلان', notificationsModal, "showToast('پیام خوانده شد.', 'success');"],
  ['badge عددی در نوار پایین', mobileBottomNav, '{unreadNotificationsCount} اعلان خوانده‌نشده'],
  ['utility نرمال‌سازی تلفن', phoneUtility, 'normalizeIranianMobile'],
  ['اعتبارسنجی تلفن در فرم حساب', accountSettings, 'isIranianMobile(phone)'],
  ['انتظار پاسخ واقعی API در فرم حساب', accountSettings, 'await updateUserProfile({'],
  ['قرارداد Promise برای به‌روزرسانی پروفایل', appContext, 'updateUserProfile: (updates: Partial<UserProfile>) => Promise<void>;'],
];

const missing = requiredContracts
  .filter(([, source, needle]) => !source.includes(needle))
  .map(([label]) => label);

if (missing.length > 0) {
  throw new Error(`قراردادهای تجربهٔ مشتری پیدا نشدند: ${missing.join('، ')}`);
}

if (/ui-price[^\n]*truncate/.test(popularProducts)) {
  throw new Error('قیمت کارت محبوب نباید در موبایل truncate شود.');
}

console.log('Customer account and checkout regression contract: PASS');
