import React, { useState } from 'react';
import { 
  MessageSquare, 
  Search, 
  Send, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  User, 
  ShieldCheck, 
  Paperclip, 
  Sparkles,
  ChevronLeft
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SupportTicket } from '../../types';

export const AdminTicketsTab: React.FC = () => {
  const { supportTickets, adminReplyTicket, updateTicketStatus } = useApp();

  const [selectedTicketId, setSelectedTicketId] = useState<string>(supportTickets[0]?.id || '');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [replyContent, setReplyContent] = useState('');

  const selectedTicket = supportTickets.find(t => t.id === selectedTicketId) || supportTickets[0];

  const filteredTickets = supportTickets.filter(t => {
    const s = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm.trim() ||
      t.title.toLowerCase().includes(s) ||
      t.department.toLowerCase().includes(s) ||
      t.id.toLowerCase().includes(s);

    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyContent.trim() || !selectedTicket) return;

    try {
      await adminReplyTicket(selectedTicket.id, replyContent.trim());
      setReplyContent('');
    } catch {
      // Toast already shown in context
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300" dir="rtl">
      
      {/* Top Header Card */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-slate-700/80 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
              مرکز پشتیبانی فنی و تیکت‌های مشتریان
            </h1>
            <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              {supportTickets.filter(t => t.status === 'open').length} تیکت باز
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            مشاهده پیام‌های پشتیبانی، مشاوره فنی پیش از خرید و ارسال پاسخ فوری به کاربران.
          </p>
        </div>
      </div>

      {/* Main 2-Column Chat Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Tickets List Column (Span 4) */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-sm overflow-hidden flex flex-col h-[650px]">
          
          {/* Search & Filter Header */}
          <div className="p-4 border-b border-slate-100 dark:border-slate-700/80 space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="جستجو در تیکت‌ها..."
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pr-9 pl-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1 overflow-x-auto pb-1 text-xs">
              {(['all', 'open', 'investigating', 'answered', 'closed'] as const).map(tab => {
                const labels = { all: 'همه', open: 'باز', investigating: 'در دست بررسی', answered: 'پاسخ داده', closed: 'بسته شده' };
                const isActive = statusFilter === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => setStatusFilter(tab)}
                    className={`px-2.5 py-1 rounded-lg font-bold whitespace-nowrap transition ${
                      isActive 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {labels[tab]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Ticket items scroll list */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/60 p-2 space-y-1">
            {filteredTickets.map(ticket => {
              const isSelected = selectedTicket?.id === ticket.id;
              const lastMsg = ticket.messages[ticket.messages.length - 1];

              return (
                <div
                  key={ticket.id}
                  onClick={() => setSelectedTicketId(ticket.id)}
                  className={`p-3 rounded-xl transition cursor-pointer ${
                    isSelected 
                      ? 'bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800' 
                      : 'hover:bg-slate-50 dark:hover:bg-slate-750/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-900 dark:text-white text-xs truncate max-w-[160px]">
                      {ticket.title}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      ticket.status === 'open' 
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400' 
                        : ticket.status === 'investigating'
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                    }`}>
                      {ticket.status_label}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mb-1">
                    {lastMsg?.message || 'بدون پیام'}
                  </p>

                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span className="font-semibold">{ticket.department}</span>
                    <span className="font-mono">{ticket.last_update}</span>
                  </div>
                </div>
              );
            })}
          </div>

        </div>

        {/* Conversation Column (Span 8) */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-sm overflow-hidden flex flex-col h-[650px]">
          
          {selectedTicket ? (
            <>
              {/* Conversation Header */}
              <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-850/50">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                      {selectedTicket.title}
                    </h2>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                      {selectedTicket.ticket_number}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    بخش: {selectedTicket.department} • اولویت: {selectedTicket.priority}
                  </div>
                </div>

                {/* Status Switcher Buttons */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => updateTicketStatus(selectedTicket.id, 'answered')}
                    className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 text-xs font-bold transition hover:bg-emerald-100"
                  >
                    پاسخ داده شده
                  </button>
                  <button
                    onClick={() => updateTicketStatus(selectedTicket.id, 'investigating')}
                    className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-300 dark:border-amber-800 text-xs font-bold transition hover:bg-amber-100"
                  >
                    در حال بررسی
                  </button>
                  <button
                    onClick={() => updateTicketStatus(selectedTicket.id, selectedTicket.status === 'closed' ? 'open' : 'closed')}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 text-xs font-bold transition hover:bg-slate-200 dark:hover:bg-slate-600"
                  >
                    {selectedTicket.status === 'closed' ? 'بازگشایی مجدد' : 'بستن تیکت'}
                  </button>
                </div>
              </div>

              {/* Chat Thread Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {selectedTicket.messages.map(msg => {
                  const isAdmin = msg.sender === 'support';

                  return (
                    <div 
                      key={msg.id}
                      className={`flex flex-col ${isAdmin ? 'items-start' : 'items-end'}`}
                    >
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1 px-1">
                        <span className="font-bold text-slate-700 dark:text-slate-300">{msg.author}</span>
                        {isAdmin && (
                          <span className="px-1.5 py-0.2 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-[9px] font-bold">
                            پشتیبانی فنی
                          </span>
                        )}
                        <span>•</span>
                        <span className="font-mono">{`${msg.date} ${msg.time}`}</span>
                      </div>

                      <div className={`p-4 rounded-2xl max-w-[85%] text-xs leading-relaxed ${
                        isAdmin 
                          ? 'bg-blue-600 text-white rounded-tr-none' 
                          : 'bg-slate-100 dark:bg-slate-750 text-slate-800 dark:text-slate-200 rounded-tl-none border border-slate-200 dark:border-slate-700'
                      }`}>
                        {msg.message}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Reply Box */}
              <form onSubmit={handleSendReply} className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-850/50 flex items-center gap-2">
                <input
                  type="text"
                  value={replyContent}
                  onChange={e => setReplyContent(e.target.value)}
                  placeholder="نوشتن پاسخ پشتیبانی به کاربر..."
                  className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                />

                <button
                  type="submit"
                  disabled={!replyContent.trim()}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold transition shadow-md shrink-0"
                >
                  <Send className="w-4 h-4" />
                  <span className="hidden sm:inline">ارسال پاسخ</span>
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-6 text-center text-slate-400">
              <MessageSquare className="w-12 h-12 mb-2 text-slate-300 dark:text-slate-600 mx-auto" />
              <p className="text-xs">تیکتی را برای مشاهده پیام‌ها انتخاب نمایید.</p>
            </div>
          )}

        </div>

      </div>

    </div>
  );
};
