import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const read = (relativePath) => readFile(resolve(root, relativePath), 'utf8');

const [workspace, liveData, css, context, api, routes] = await Promise.all([
  read('src/components/admin/staging/StagingAdminReplica.tsx'),
  read('src/components/admin/staging/adminLiveData.ts'),
  read('src/components/admin/staging/staging-admin.css'),
  read('src/context/AppContext.tsx'),
  read('src/services/apiMappers.ts'),
  read('routes/api.php'),
]);

const contracts = [
  ['پیام‌ها در گفتگو بر اساس زمان ثبت مرتب می‌شوند', workspace, 'const sortedMessages = selected ? [...selected.messages].sort'],
  ['زمان هر پیام در گفتگو نمایش داده می‌شود', workspace, '{message.time}'],
  ['پیام خوانده‌نشده در صف تیکت نشان دارد', workspace, 'ticket-unread-badge'],
  ['بازشدن تیکت پیام‌های مشتری را read می‌کند', workspace, 'onMarkRead(id)'],
  ['فیلتر بایگانی در پنل وجود دارد', workspace, '"بایگانی"'],
  ['حذف دائمی با تأیید دومرحله‌ای انجام می‌شود', workspace, 'onRequestConfirm("حذف دائمی تیکت"'],
  ['بایگانی پس از موفقیت فوراً فیلتر بایگانی را باز می‌کند', workspace, 'setStatusFilter("بایگانی")'],
  ['تیکت بایگانی‌شده یا در حال ثبت، وضعیتش تغییر نمی‌کند', workspace, 'disabled={selected.archived || ticketActionPending !== null}'],
  ['بایگانی از ارسال تکراری درخواست محافظت می‌شود', workspace, 'const [ticketActionPending, setTicketActionPending]'],
  ['دادهٔ live زمان و read state پیام را نگه می‌دارد', liveData, 'createdAt: message.created_at'],
  ['دادهٔ live شمارش unread مدیر را محاسبه می‌کند', liveData, 'unreadCount: ticket.messages.filter'],
  ['thread گفتگو اسکرول داخلی دارد', css, '.ticket-thread { min-height: 0; flex: 1 1 auto; overflow-y: auto;'],
  ['صف تیکت اسکرول داخلی دارد', css, '.ticket-queue { min-height: 0; flex: 1 1 auto; overflow-y: auto;'],
  ['context عملیات بایگانی ادمین را دارد', context, 'const archiveAdminTicket'],
  ['context عملیات حذف ادمین را دارد', context, 'const deleteAdminTicket'],
  ['مپر API زمان خواندن پیام را عبور می‌دهد', api, 'read_at: typeof message.read_at'],
  ['route علامت‌گذاری خوانده‌شدن دارد', routes, "Route::post('/tickets/{ticket}/read'"],
  ['route بایگانی تیکت دارد', routes, "Route::post('/tickets/{ticket}/archive'"],
  ['route حذف دائمی تیکت دارد', routes, "Route::delete('/tickets/{ticket}'"],
];

const missing = contracts
  .filter(([, content, expected]) => !content.includes(expected))
  .map(([label]) => label);

if (missing.length) {
  throw new Error(`قراردادهای workspace تیکت ادمین ناقص‌اند: ${missing.join('، ')}`);
}

if (workspace.includes('ticket-read-state') || workspace.includes('ticket-unread-state')) {
  throw new Error('نشان خوانده‌شدن کنار پیام‌های thread ادمین نباید رندر شود.');
}

console.log('Admin ticket workspace contract: PASS');
