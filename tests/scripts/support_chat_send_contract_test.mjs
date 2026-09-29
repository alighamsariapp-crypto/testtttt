import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const read = (relativePath) => readFile(resolve(root, relativePath), 'utf8');

const [types, mapper, api, context, chatView] = await Promise.all([
  read('src/types/index.ts'),
  read('src/services/apiMappers.ts'),
  read('src/services/api.ts'),
  read('src/context/AppContext.tsx'),
  read('src/components/profile/TicketChatView.tsx'),
]);

const requiredContracts = [
  ['مدل تیکت، شمارهٔ نمایشی مستقل دارد', types, 'ticket_number: string;'],
  ['مپر، شناسهٔ داخلی API را نگه می‌دارد', mapper, 'id: String(ticket.id),'],
  ['مپر، شمارهٔ نمایشی را نگه می‌دارد', mapper, 'ticket_number: ticket.ticket_number || String(ticket.id),'],
  ['ارسال API از شناسهٔ داخلی استفاده می‌کند', api, 'replySupportTicket(ticketId: string, message: string)'],
  ['ارسال پاسخ قابل‌await است', context, 'addTicketReply: (ticketId: string, message: string) => Promise<void>;'],
  ['context پاسخ API را await می‌کند', context, 'const ticket = await api.replySupportTicket(ticketId, messageText);'],
  ['رابط وضعیت ارسال دارد', chatView, "const [isSending, setIsSending] = useState(false);"],
  ['رابط ارسال پاسخ را await می‌کند', chatView, 'await addTicketReply(activeTicket.id, message);'],
  ['رابط متن را فقط پس از پاسخ موفق پاک می‌کند', chatView, "await addTicketReply(activeTicket.id, message);\n      setMessageInput('');"],
  ['رابط متن را در خطا برای retry نگه می‌دارد', chatView, "متن پیام حفظ شد؛ دوباره تلاش کنید."],
  ['دکمهٔ ارسال در زمان درخواست غیرفعال است', chatView, 'disabled={isSending || !messageInput.trim()}'],
  ['تیکت بسته در رابط تشخیص داده می‌شود', chatView, "const isClosed = activeTicket?.status === 'closed';"],
  ['ارسال پیام به تیکت بسته در رابط مسدود می‌شود', chatView, 'if (isClosed) {'],
  ['ارسالگر در تیکت بسته با پنل قفل‌شده جایگزین می‌شود', chatView, 'این گفتگو توسط پشتیبانی بسته شده است و ارسال پیام غیرفعال است.'],
  ['بازشدن تیکت در موبایل تمام‌صفحه است', chatView, 'fixed inset-0 z-[100] flex h-[100dvh]'],
  ['کارت گفتگوی بسته در دسکتاپ برچسب واضح دارد', chatView, "const ticketIsClosed = ticket.status === 'closed';"],
];

const missing = requiredContracts
  .filter(([, content, snippet]) => !content.includes(snippet))
  .map(([label]) => label);

if (missing.length) {
  throw new Error(`قراردادهای ارسال چت پیدا نشدند: ${missing.join('، ')}`);
}

console.log('Support chat send contract: PASS');
