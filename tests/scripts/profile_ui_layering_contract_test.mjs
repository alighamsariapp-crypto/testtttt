import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const read = (relativePath) => readFile(resolve(root, relativePath), 'utf8');

const modalFiles = [
  'src/components/profile/LogoutModal.tsx',
  'src/components/profile/NotificationsModal.tsx',
  'src/components/profile/NewTicketModal.tsx',
  'src/components/profile/OfficialInvoiceModal.tsx',
  'src/components/profile/AddressesTab.tsx',
  'src/components/profile/AccountSettingsTab.tsx',
  'src/components/profile/SecurityTab.tsx',
  'src/components/profile/WalletTab.tsx',
];

const [portal, styles, sidebar, dashboard, addressModal, bottomSheet, authModal, forgotPasswordModal, catalog, ...modals] = await Promise.all([
  read('src/components/common/ModalPortal.tsx'),
  read('src/index.css'),
  read('src/components/profile/ProfileSidebar.tsx'),
  read('src/components/profile/DashboardTab.tsx'),
  read('src/components/cart/AddressModal.tsx'),
  read('src/components/common/BottomSheet.tsx'),
  read('src/components/AuthModal.tsx'),
  read('src/components/auth/ForgotPasswordModal.tsx'),
  read('src/components/CatalogView.tsx'),
  ...modalFiles.map(read),
]);

const requiredContracts = [
  ['portal به document.body', portal, 'return createPortal(children, document.body);'],
  ['لایهٔ ثابت dialog', styles, '--ui-layer-dialog: 100;'],
  ['backdrop از لایهٔ dialog استفاده می‌کند', styles, 'z-index: var(--ui-layer-dialog);'],
  ['جداسازی stacking context modal', styles, 'isolation: isolate;'],
  ['تشخیص نقش مجاز مدیریت', sidebar, "const canAccessAdmin = user.role === 'admin' || user.role === 'staff';"],
  ['محدودسازی لینک مدیریت به نقش مجاز', sidebar, '{canAccessAdmin && ('],
  ['کارت رهگیری فشرده', dashboard, 'xl:col-span-5 bg-white rounded-3xl p-4 sm:p-5'],
  ['کارت اقدامات متعادل', dashboard, 'xl:col-span-7 bg-white rounded-3xl p-5 sm:p-6'],
  ['portal modal آدرس checkout', addressModal, "import { ModalPortal } from '../common/ModalPortal';"],
  ['رندر modal آدرس در portal', addressModal, '<ModalPortal>'],
  ['portal BottomSheet مشترک', bottomSheet, "import { ModalPortal } from './ModalPortal';"],
  ['رندر BottomSheet در portal', bottomSheet, '<ModalPortal>'],
  ['portal modal ورود', authModal, "import { ModalPortal } from './common/ModalPortal';"],
  ['رندر modal ورود در portal', authModal, '<ModalPortal>'],
  ['portal بازیابی رمز', forgotPasswordModal, "import { ModalPortal } from '../common/ModalPortal';"],
  ['رندر بازیابی رمز در portal', forgotPasswordModal, '<ModalPortal>'],
  ['portal مرور دسته‌بندی', catalog, "import { ModalPortal } from './common/ModalPortal';"],
  ['رندر مرور دسته‌بندی در portal', catalog, '{categoryBrowserOpen && (\n        <ModalPortal>'],
  ['رندر فیلتر موبایل در portal', catalog, '{mobileFilterOpen && (\n        <ModalPortal>'],
  ['رندر مرتب‌سازی موبایل در portal', catalog, '{mobileSortOpen && (\n        <ModalPortal>'],
];

for (const modal of modals) {
  requiredContracts.push(['portal مشترک modal پروفایل', modal, "import { ModalPortal } from '../common/ModalPortal';"]);
  requiredContracts.push(['رندر modal در portal', modal, '<ModalPortal>']);
}

const missing = requiredContracts
  .filter(([, content, snippet]) => !content.includes(snippet))
  .map(([label]) => label);

if (missing.length) {
  throw new Error(`قراردادهای UI پنل کاربری پیدا نشدند: ${missing.join('، ')}`);
}

const zIndexLeaks = [...modals, addressModal, bottomSheet, authModal, forgotPasswordModal, catalog]
  .filter((modal) => /ui-modal-backdrop\s+z-/.test(modal))
  .length;

if (zIndexLeaks) {
  throw new Error('مدال‌های پروفایل نباید z-index موضعی و پراکنده داشته باشند.');
}

console.log('Profile UI layering contract: PASS');
