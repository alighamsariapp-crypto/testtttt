import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const read = (relativePath) => readFile(resolve(root, relativePath), 'utf8');

const [api, context, hook, customerChat, adminWorkspace] = await Promise.all([
  read('src/services/api.ts'),
  read('src/context/AppContext.tsx'),
  read('src/hooks/useSupportTicketAutoRefresh.ts'),
  read('src/components/profile/TicketChatView.tsx'),
  read('src/components/admin/staging/StagingAdminReplica.tsx'),
]);

const contracts = [
  ['context یک refresh مستقل برای تیکت ارائه می‌دهد', context, 'refreshSupportTickets: () => Promise<void>;'],
  ['cache داخلی برای درخواست no-store دور زده می‌شود', api, "const shouldCache = isGet && options.cache !== 'no-store';"],
  ['دریافت تیکت مشتری از cache پنج‌دقیقه‌ای استفاده نمی‌کند', api, "this.request<Record<string, any>>('/users/support-tickets', { cache: 'no-store' })"],
  ['refresh مشتری از API تیکت مشتری استفاده می‌کند', context, 'setSupportTickets(await api.getSupportTickets());'],
  ['refresh ادمین با no-store دادهٔ تازه می‌گیرد', context, "api.adminRequest<Record<string, any>>('/tickets?include_archived=1&per_page=100', { cache: 'no-store' })"],
  ['hook دورهٔ polling محدود دارد', hook, 'const SUPPORT_TICKET_REFRESH_INTERVAL_MS = 12_000;'],
  ['hook هنگام مخفی‌بودن صفحه request نمی‌زند', hook, "document.visibilityState !== 'visible'"],
  ['hook درخواست هم‌زمان را جلوگیری می‌کند', hook, 'isRefreshing.current'],
  ['hook هنگام بازگشت به تب refresh می‌کند', hook, "document.addEventListener('visibilitychange', handleVisibilityChange);"],
  ['گفتگوی مشتری hook را فعال می‌کند', customerChat, 'useSupportTicketAutoRefresh(Boolean(activeTicket));'],
  ['تب تیکت ادمین hook را فقط در live mode فعال می‌کند', adminWorkspace, 'useSupportTicketAutoRefresh(liveMode);'],
  ['تغییر status گفتگوی انتخاب‌شده را به اولین تیکت دیگر نمی‌برد', adminWorkspace, 'const selected = rows.find((row) => row.id === selectedId) ?? filtered[0];'],
];

const missing = contracts
  .filter(([, content, expected]) => !content.includes(expected))
  .map(([label]) => label);

if (missing.length) {
  throw new Error(`قراردادهای دریافت خودکار تیکت ناقص‌اند: ${missing.join('، ')}`);
}

console.log('Support ticket live refresh contract: PASS');
