import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const read = (relativePath) => readFile(resolve(root, relativePath), 'utf8');

const [adminLayout, context, liveData, stagingWorkspace] = await Promise.all([
  read('src/components/admin/AdminLayout.tsx'),
  read('src/context/AppContext.tsx'),
  read('src/components/admin/staging/adminLiveData.ts'),
  read('src/components/admin/staging/StagingAdminReplica.tsx'),
]);

const requiredContracts = [
  ['context دادهٔ صفحه‌بندی‌شدهٔ تیکت را استخراج می‌کند', context, 'Array.isArray(ticketPage.data?.data)'],
  ['context تیکت‌های ادمین را در state نگه می‌دارد', context, 'setSupportTickets(ticketRecords.map(mapTicket));'],
  ['layout تیکت‌های واقعی را به adapter می‌دهد', adminLayout, 'tickets: supportTickets,'],
  ['layout callback پاسخ واقعی دارد', adminLayout, 'replyTicket: (ticketId: string, message: string) => adminReplyTicket(ticketId, message),'],
  ['adapter دادهٔ زندهٔ تیکت دارد', liveData, 'tickets: AdminReplicaTicket[];'],
  ['workspace با تیکت‌های live شروع می‌شود', stagingWorkspace, 'useState<DemoTicket[]>(() => liveData?.tickets ?? initialTickets)'],
  ['workspace تغییر تیکت‌های live را همگام می‌کند', stagingWorkspace, 'setTickets(liveData.tickets);'],
  ['تب تیکت حالت live را تشخیص می‌دهد', stagingWorkspace, 'liveMode={Boolean(liveData)}'],
  ['پاسخ تیکت در حالت live await می‌شود', stagingWorkspace, 'if (liveMode && onReply) await onReply(selected.id, message);'],
  ['حذف تیکت در حالت live پنهان است', stagingWorkspace, '{!liveMode && <button type="button" className="ticket-delete-one"'],
  ['URL ناوبری اصلی demo را اجباری نمی‌کند', stagingWorkspace, '`?tab=${next}${focus ? `&focus=${focus}` : ""}`'],
];

const missing = requiredContracts
  .filter(([, content, snippet]) => !content.includes(snippet))
  .map(([label]) => label);

if (missing.length) {
  throw new Error(`قراردادهای تیکت زندهٔ ادمین پیدا نشدند: ${missing.join('، ')}`);
}

console.log('Admin live support tickets contract: PASS');
