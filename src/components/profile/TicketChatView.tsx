import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  CheckCheck,
  Headphones,
  MessageSquare,
  Loader2,
  Search,
  Send,
  Smile,
  LockKeyhole,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useSupportTicketAutoRefresh } from '../../hooks/useSupportTicketAutoRefresh';
import { SupportTicket, TicketStatus } from '../../types';

interface TicketChatViewProps {
  initialTicketId?: string;
  onBack?: () => void;
}

const statusTone: Record<TicketStatus, string> = {
  open: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  investigating: 'bg-amber-50 text-amber-700 border-amber-200',
  answered: 'bg-blue-50 text-blue-700 border-blue-200',
  closed: 'bg-slate-800 text-white border-slate-800',
};

const statusLabel = (ticket?: SupportTicket) => {
  if (!ticket) return 'بدون گفتگو';
  return ticket.status_label || {
    open: 'باز',
    investigating: 'در حال بررسی',
    answered: 'پاسخ داده شده',
    closed: 'بسته شده',
  }[ticket.status];
};

export const TicketChatView: React.FC<TicketChatViewProps> = ({ initialTicketId, onBack }) => {
  const { supportTickets, addTicketReply, user, showToast } = useApp();
  const [selectedTicketId, setSelectedTicketId] = useState(initialTicketId || supportTickets[0]?.id || '');
  const [conversationsSearch, setConversationsSearch] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeTicket = supportTickets.find((ticket) => ticket.id === selectedTicketId) || supportTickets[0];
  const isClosed = activeTicket?.status === 'closed';
  useSupportTicketAutoRefresh(Boolean(activeTicket));

  useEffect(() => {
    if (!activeTicket) return;
    setSelectedTicketId(activeTicket.id);
  }, [activeTicket?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [activeTicket?.messages.length]);

  const filteredTickets = supportTickets
    .filter((ticket) => {
      if (!conversationsSearch.trim()) return true;
      const query = conversationsSearch.toLowerCase();
      return [ticket.title, ticket.ticket_number, ticket.department].some((value) => value.toLowerCase().includes(query));
    })
    .sort((first, second) => Number(first.status === 'closed') - Number(second.status === 'closed'));

  const selectTicket = (ticketId: string) => {
    setSelectedTicketId(ticketId);
    setShowEmojiPicker(false);
    setMessageInput('');
  };

  useEffect(() => {
    if (!isClosed) return;
    setMessageInput('');
    setShowEmojiPicker(false);
  }, [isClosed, activeTicket?.id]);

  const handleSendMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSending) return;
    if (!activeTicket) {
      showToast('برای ارسال پیام، ابتدا یک تیکت را انتخاب کنید.', 'error');
      return;
    }
    if (isClosed) {
      showToast('این تیکت بسته شده است. برای پیگیری جدید، تیکت تازه ثبت کنید.', 'info');
      return;
    }
    const message = messageInput.trim();
    if (!message) return;

    setIsSending(true);
    try {
      await addTicketReply(activeTicket.id, message);
      setMessageInput('');
      setShowEmojiPicker(false);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'ارسال پیام ناموفق بود. متن پیام حفظ شد؛ دوباره تلاش کنید.', 'error');
    } finally {
      setIsSending(false);
    }
  };

  const addEmoji = (emoji: string) => {
    setMessageInput((current) => `${current}${emoji}`);
    setShowEmojiPicker(false);
  };

  if (!activeTicket) {
    return (
      <section className="rounded-3xl border border-slate-100 bg-white p-8 text-center space-y-3">
        <MessageSquare className="w-9 h-9 text-blue-600 mx-auto" />
        <h2 className="text-base font-black text-slate-900">گفت‌وگویی برای نمایش وجود ندارد</h2>
        <p className="text-sm text-slate-500">پس از ثبت تیکت، پیام‌ها و پاسخ‌های پشتیبانی در همین بخش نشان داده می‌شوند.</p>
        {onBack && (
          <button type="button" onClick={onBack} className="min-h-11 px-4 rounded-xl bg-blue-600 text-white text-sm font-bold">
            بازگشت به تیکت‌ها
          </button>
        )}
      </section>
    );
  }

  return (
    <section className="fixed inset-0 z-[100] flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-white overscroll-none md:relative md:z-auto md:h-[76vh] md:min-h-[34rem] md:rounded-3xl md:border md:border-slate-100 md:shadow-sm">
      <div className="flex flex-1 min-h-0">
        <aside className="hidden md:flex w-[20rem] lg:w-[22rem] border-l border-slate-100 flex-col shrink-0 bg-slate-50/70">
          <div className="p-4 bg-white border-b border-slate-100 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-slate-900 min-w-0">
                <Headphones className="w-4 h-4 text-blue-600 shrink-0" />
                <h2 className="text-sm font-black truncate">گفت‌وگوهای پشتیبانی</h2>
              </div>
              {onBack && (
                <button type="button" onClick={onBack} className="text-xs font-bold text-blue-700 hover:text-blue-800 shrink-0">
                  بازگشت
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 text-[10px] font-bold">
              <span className="rounded-lg bg-blue-50 px-2 py-1 text-blue-700">فعال {supportTickets.filter((ticket) => ticket.status !== 'closed').length}</span>
              <span className="rounded-lg bg-slate-100 px-2 py-1 text-slate-600">بسته {supportTickets.filter((ticket) => ticket.status === 'closed').length}</span>
            </div>
            <label className="relative block">
              <span className="sr-only">جستجو در گفتگوها</span>
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                value={conversationsSearch}
                onChange={(event) => setConversationsSearch(event.target.value)}
                placeholder="جستجو با موضوع یا شمارهٔ تیکت"
                className="w-full min-h-10 pr-9 pl-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:outline-none"
              />
            </label>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-none p-2 space-y-1.5">
            {filteredTickets.map((ticket) => {
              const selected = ticket.id === activeTicket.id;
              const ticketIsClosed = ticket.status === 'closed';
              return (
                <button
                  type="button"
                  key={ticket.id}
                  onClick={() => selectTicket(ticket.id)}
                  className={`w-full text-right rounded-2xl p-3 transition border ${selected ? 'bg-blue-50 border-blue-200 shadow-xs' : ticketIsClosed ? 'bg-slate-50 border-slate-200/80 hover:border-slate-300' : 'bg-white border-transparent hover:border-slate-200 hover:bg-slate-50'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <span className={`block text-xs font-black line-clamp-1 ${ticketIsClosed ? 'text-slate-600' : 'text-slate-900'}`}>{ticket.title}</span>
                      <div className="flex items-center gap-1.5 text-[10px]">
                        <span className="font-mono font-bold text-blue-700 truncate">{ticket.ticket_number}</span>
                        <span className="text-slate-300">•</span>
                        <span className="text-slate-400 shrink-0">{ticket.last_update.split(' ')[0]}</span>
                      </div>
                    </div>
                    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold ${statusTone[ticket.status]}`}>
                      {ticketIsClosed && <LockKeyhole className="w-3 h-3" />}
                      {statusLabel(ticket)}
                    </span>
                  </div>
                  <p className="mt-2 border-t border-slate-200/70 pt-2 text-[10px] font-medium text-slate-500">{ticket.department}</p>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="flex-1 min-w-0 flex flex-col bg-slate-50">
          <header className="bg-white border-b border-slate-100 px-3 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] sm:px-4 md:py-3 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="md:hidden min-w-11 min-h-11 -mr-1 rounded-xl text-slate-600 hover:bg-slate-100 flex items-center justify-center"
                  aria-label="بازگشت به فهرست تیکت‌ها"
                >
                  <ArrowRight className="w-5 h-5" />
                </button>
              )}
              <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black shrink-0">ن</div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <h2 className="text-sm font-black text-slate-900 truncate">{activeTicket.department || 'پشتیبانی نوین‌نت'}</h2>
                  <span className={`hidden sm:inline-flex shrink-0 px-2 py-0.5 rounded-full border text-[10px] font-bold ${statusTone[activeTicket.status]}`}>{statusLabel(activeTicket)}</span>
                </div>
                <p className="text-[11px] text-slate-500 truncate">{activeTicket.ticket_number} · {activeTicket.title}</p>
              </div>
            </div>

          </header>

          <div className="px-4 py-2 bg-white border-b border-slate-100 md:hidden shrink-0 flex items-center justify-between gap-3">
            <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${statusTone[activeTicket.status]}`}>{statusLabel(activeTicket)}</span>
            <span className="text-[10px] text-slate-500 truncate">آخرین بروزرسانی: {activeTicket.last_update}</span>
          </div>

          <main className="flex-1 min-h-0 overflow-y-auto scrollbar-none p-3 sm:p-5 space-y-4">
            <div className="flex justify-center">
              <span className="px-3 py-1 rounded-full bg-slate-200/80 text-[10px] font-bold text-slate-600">تاریخچهٔ گفتگو</span>
            </div>

            {activeTicket.messages.map((message) => {
              const sentBySupport = message.sender === 'support';
              return (
                <article key={message.id} className={`flex flex-col ${sentBySupport ? 'items-start' : 'items-end'} gap-1`}>
                  <div className={`max-w-[88%] sm:max-w-[72%] rounded-2xl px-3.5 py-3 text-sm leading-6 ${sentBySupport ? 'bg-white border border-slate-200 text-slate-800 rounded-br-sm' : 'bg-blue-600 text-white rounded-bl-sm shadow-sm shadow-blue-500/20'}`}>
                    <p className="whitespace-pre-wrap break-words">{message.message}</p>
                  </div>
                  <div className={`flex items-center gap-1 text-[10px] text-slate-400 ${sentBySupport ? 'mr-1' : 'ml-1'}`}>
                    <span>{message.time || '—'}</span>
                    {!sentBySupport && <CheckCheck className="w-3.5 h-3.5 text-blue-600" />}
                  </div>
                </article>
              );
            })}
            <div ref={messagesEndRef} />
          </main>

          <div className="bg-white border-t border-slate-100 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 sm:px-4 md:p-4 shrink-0 relative">
            {isClosed ? (
              <div className="min-h-14 rounded-2xl border border-slate-200 bg-slate-100 px-3 py-2.5 flex items-center justify-between gap-3 text-xs text-slate-700" role="status" aria-live="polite">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-white"><LockKeyhole className="w-4 h-4" /></span>
                  <span className="leading-5">این گفتگو توسط پشتیبانی بسته شده است و ارسال پیام غیرفعال است.</span>
                </div>
                {onBack && <button type="button" onClick={onBack} className="font-bold text-blue-700 shrink-0">تیکت‌ها</button>}
              </div>
            ) : (
              <>
                {showEmojiPicker && (
                  <div className="absolute bottom-full left-3 mb-2 max-w-[calc(100%-1.5rem)] bg-white rounded-2xl p-2 shadow-xl border border-slate-200 flex flex-wrap gap-1 z-20">
                    {['👍', '🙏', '❤️', '😊', '👌', '🤝'].map((emoji) => (
                      <button key={emoji} type="button" onClick={() => addEmoji(emoji)} className="min-w-9 min-h-9 rounded-xl hover:bg-slate-100 text-lg">{emoji}</button>
                    ))}
                  </div>
                )}
                <form onSubmit={handleSendMessage} className="flex items-end gap-2">
                  <label className="sr-only" htmlFor="ticket-chat-message">پیام شما</label>
                  <textarea
                    id="ticket-chat-message"
                    value={messageInput}
                    onChange={(event) => setMessageInput(event.target.value)}
                    disabled={isSending}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        event.currentTarget.form?.requestSubmit();
                      }
                    }}
                    rows={1}
                    placeholder="پیام خود را بنویسید…"
                    className="flex-1 min-h-11 max-h-28 resize-none px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm leading-5 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker((open) => !open)}
                    disabled={isSending}
                    className="hidden sm:flex min-w-11 min-h-11 rounded-xl text-slate-500 hover:bg-slate-100 disabled:opacity-50 items-center justify-center shrink-0"
                    aria-label="افزودن ایموجی"
                  >
                    <Smile className="w-4 h-4" />
                  </button>
                  <button
                    type="submit"
                    disabled={isSending || !messageInput.trim()}
                    className="min-w-11 min-h-11 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white flex items-center justify-center shadow-sm shadow-blue-500/20 shrink-0"
                    aria-label={isSending ? 'در حال ارسال پیام' : 'ارسال پیام'}
                  >
                    {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
