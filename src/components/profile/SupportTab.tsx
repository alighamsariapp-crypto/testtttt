import React, { useEffect, useState } from 'react';
import { 
  Headphones, 
  Plus, 
  MessageSquare, 
  Clock, 
  CheckCircle2, 
  Send, 
  X, 
  ChevronLeft, 
  Search, 
  Paperclip, 
  AlertCircle,
  User,
  Shield,
  FileText,
  BookOpen,
  Filter,
  ArrowRight,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SupportTicket, TicketStatus } from '../../types';
import { TicketChatView } from './TicketChatView';
import { KnowledgeBaseTab } from './KnowledgeBaseTab';
import { NewTicketModal } from './NewTicketModal';
import { SESSION_STATE_KEYS, readSessionState, writeSessionState } from '../../utils/sessionState';

type SupportResumeState = {
  supportMode: 'list' | 'chat' | 'kb';
  selectedTicketIdForChat?: string;
  selectedStatusFilter: 'all' | TicketStatus;
  searchQuery: string;
  isNewTicketModalOpen: boolean;
  mobileTab: 'active' | 'closed';
};

export const SupportTab: React.FC = () => {
  const { 
    supportTickets, 
    closeSupportTicket, 
    user, 
    showToast 
  } = useApp();

  const initialResume = readSessionState<SupportResumeState>(SESSION_STATE_KEYS.supportResume, {
    supportMode: 'list',
    selectedStatusFilter: 'all',
    searchQuery: '',
    isNewTicketModalOpen: false,
    mobileTab: 'active',
  });

  // Sub-mode in Support: 'list' (Table / List) | 'chat' (Live Chat) | 'kb' (Knowledge Base)
  const [supportMode, setSupportMode] = useState<'list' | 'chat' | 'kb'>(initialResume.supportMode);
  const [selectedTicketIdForChat, setSelectedTicketIdForChat] = useState<string | undefined>(initialResume.selectedTicketIdForChat);
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'all' | TicketStatus>(initialResume.selectedStatusFilter);
  const [searchQuery, setSearchQuery] = useState(initialResume.searchQuery);
  const [isNewTicketModalOpen, setIsNewTicketModalOpen] = useState(initialResume.isNewTicketModalOpen);
  const [mobileTab, setMobileTab] = useState<'active' | 'closed'>(initialResume.mobileTab);

  useEffect(() => {
    writeSessionState<SupportResumeState>(SESSION_STATE_KEYS.supportResume, {
      supportMode,
      selectedTicketIdForChat,
      selectedStatusFilter,
      searchQuery,
      isNewTicketModalOpen,
      mobileTab,
    });
  }, [isNewTicketModalOpen, mobileTab, searchQuery, selectedStatusFilter, selectedTicketIdForChat, supportMode]);

  const handleOpenChatForTicket = (ticketId?: string) => {
    const resolvedTicketId = ticketId || supportTickets[0]?.id;
    if (!resolvedTicketId) {
      showToast('برای شروع گفتگو، ابتدا یک تیکت جدید ثبت کنید.', 'info');
      setIsNewTicketModalOpen(true);
      return;
    }
    setSelectedTicketIdForChat(resolvedTicketId);
    setSupportMode('chat');
  };

  // Filter tickets
  const filteredTickets = supportTickets.filter(ticket => {
    // Status filter
    if (selectedStatusFilter !== 'all' && ticket.status !== selectedStatusFilter) {
      return false;
    }
    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = ticket.title.toLowerCase().includes(q);
      const matchId = ticket.ticket_number.toLowerCase().includes(q);
      const matchDept = ticket.department.toLowerCase().includes(q);
      if (!matchTitle && !matchId && !matchDept) return false;
    }
    return true;
  });

  // Mobile filtered tickets (Active vs Closed)
  const mobileFilteredTickets = supportTickets.filter(ticket => {
    if (mobileTab === 'active') {
      return ticket.status === 'open' || ticket.status === 'investigating' || ticket.status === 'answered';
    }
    return ticket.status === 'closed';
  });

  const getStatusBadge = (status: TicketStatus, label: string) => {
    switch (status) {
      case 'open':
        return (
          <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>{label || 'باز'}</span>
          </span>
        );
      case 'investigating':
        return (
          <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-bold inline-flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-amber-600" />
            <span>{label || 'در حال بررسی'}</span>
          </span>
        );
      case 'answered':
        return (
          <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-bold inline-flex items-center gap-1.5">
            <CheckCircle2 className="w-3 h-3 text-blue-600" />
            <span>{label || 'پاسخ داده شده'}</span>
          </span>
        );
      case 'closed':
      default:
        return (
          <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-[11px] font-bold inline-flex items-center gap-1.5">
            <span>{label || 'بسته شده'}</span>
          </span>
        );
    }
  };

  // If in Chat Mode (Matches Image 01 & Image 02)
  if (supportMode === 'chat') {
    return (
      <TicketChatView 
        initialTicketId={selectedTicketIdForChat}
        onBack={() => setSupportMode('list')}
      />
    );
  }

  // If in Knowledge Base Mode (Matches Image 05 & Image 06)
  if (supportMode === 'kb') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setSupportMode('list')}
            className="px-4 py-2 rounded-2xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
          >
            <ArrowRight className="w-4 h-4" />
            <span>بازگشت به لیست تیکت‌ها</span>
          </button>

          <button
            onClick={() => handleOpenChatForTicket()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-bold transition shadow-sm flex items-center gap-1.5"
          >
            <MessageSquare className="w-4 h-4" />
            <span>ورود به چت پشتیبانی</span>
          </button>
        </div>

        <KnowledgeBaseTab
          onOpenChat={(id) => handleOpenChatForTicket(id)}
          onOpenNewTicket={() => setIsNewTicketModalOpen(true)}
          onViewAllTickets={() => setSupportMode('list')}
        />
      </div>
    );
  }

  // Default 'list' Mode: Matches Image 07 (Desktop Table) and Image 08 (Mobile Cards)
  return (
    <>
      <div className="space-y-6">
        
        {/* Top Header Card */}
        <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-base font-black text-slate-900">تیکت‌های من</h1>
              <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-bold font-sans">
                {supportTickets.length} تیکت
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">لیست تمام درخواست‌ها و سوابق پشتیبانی فنی، مالی و خدمات</p>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => setSupportMode('kb')}
              className="min-h-11 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition border border-slate-200 flex items-center justify-center gap-1.5"
            >
              <BookOpen className="w-4 h-4 text-blue-600" />
              <span>پایگاه دانش و راهنما</span>
            </button>

            <button
              onClick={() => handleOpenChatForTicket()}
              className="min-h-11 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition border border-blue-200 flex items-center justify-center gap-1.5"
            >
              <MessageSquare className="w-4 h-4" />
              <span>آخرین گفتگو</span>
            </button>

            <button
              onClick={() => setIsNewTicketModalOpen(true)}
              className="col-span-2 sm:col-span-1 min-h-11 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm shadow-blue-500/20 flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>ثبت تیکت جدید</span>
            </button>
          </div>
        </div>

        {/* Filter & Search Bar (Desktop: Table Controls, Mobile: Active/Closed Tabs) */}
        <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-100 shadow-sm space-y-4">
          
          {/* Desktop Filter Pills + Search */}
          <div className="hidden sm:flex items-center justify-between gap-4">
            
            {/* Status Pills (Matches Image 07) */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              <button
                onClick={() => setSelectedStatusFilter('all')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                  selectedStatusFilter === 'all'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                همه ({supportTickets.length})
              </button>
              <button
                onClick={() => setSelectedStatusFilter('investigating')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                  selectedStatusFilter === 'investigating'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                در حال بررسی ({supportTickets.filter(t => t.status === 'investigating' || t.status === 'open').length})
              </button>
              <button
                onClick={() => setSelectedStatusFilter('answered')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                  selectedStatusFilter === 'answered'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                پاسخ داده شده ({supportTickets.filter(t => t.status === 'answered').length})
              </button>
              <button
                onClick={() => setSelectedStatusFilter('closed')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                  selectedStatusFilter === 'closed'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                بسته شده ({supportTickets.filter(t => t.status === 'closed').length})
              </button>
            </div>

            {/* Search Box */}
            <div className="relative w-64">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="جستجو در تیکت‌ها..."
                className="w-full pl-8 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white transition"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {/* Mobile Filter Tabs (Matches Image 08: فعال / بسته شده) */}
          <div className="sm:hidden flex items-center bg-slate-100 p-1 rounded-2xl text-xs font-bold">
            <button
              onClick={() => setMobileTab('active')}
              className={`flex-1 py-2 rounded-xl transition text-center ${
                mobileTab === 'active' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600'
              }`}
            >
              فعال ({supportTickets.filter(t => t.status !== 'closed').length})
            </button>
            <button
              onClick={() => setMobileTab('closed')}
              className={`flex-1 py-2 rounded-xl transition text-center ${
                mobileTab === 'closed' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600'
              }`}
            >
              بسته شده ({supportTickets.filter(t => t.status === 'closed').length})
            </button>
          </div>

        </div>

        {/* Desktop Tickets Table (Matches Image 07) */}
        <div className="hidden sm:block bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          {filteredTickets.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                <MessageSquare className="w-7 h-7" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">تیکتی با این مشخصات یافت نشد</h3>
              <p className="text-xs text-slate-400">می‌توانید فیلترها را تغییر داده یا تیکت جدید ثبت کنید.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50/70 border-b border-slate-100 text-slate-500 font-bold">
                  <tr>
                    <th className="py-4 px-6">شناسه تیکت</th>
                    <th className="py-4 px-6">موضوع تیکت</th>
                    <th className="py-4 px-6">دپارتمان</th>
                    <th className="py-4 px-6">آخرین بروزرسانی</th>
                    <th className="py-4 px-6">وضعیت</th>
                    <th className="py-4 px-6 text-center">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTickets.map(ticket => {
                    const lastMsg = ticket.messages[ticket.messages.length - 1];
                    return (
                      <tr 
                        key={ticket.id}
                        onClick={() => handleOpenChatForTicket(ticket.id)}
                        className="hover:bg-blue-50/40 cursor-pointer transition group"
                      >
                        {/* Ticket ID */}
                        <td className="py-4 px-6 font-mono font-bold text-blue-600">
                          {ticket.ticket_number}
                        </td>

                        {/* Title & Preview */}
                        <td className="py-4 px-6">
                          <div className="space-y-0.5 max-w-xs sm:max-w-md">
                            <h4 className="font-bold text-slate-900 group-hover:text-blue-600 transition truncate">
                              {ticket.title}
                            </h4>
                            <p className="text-[11px] text-slate-400 truncate">
                              {lastMsg?.message || 'بدون پیام'}
                            </p>
                          </div>
                        </td>

                        {/* Department */}
                        <td className="py-4 px-6 font-medium text-slate-600">
                          {ticket.department}
                        </td>

                        {/* Last Update */}
                        <td className="py-4 px-6 text-slate-500 font-mono text-[11px]">
                          {ticket.last_update}
                        </td>

                        {/* Status Badge */}
                        <td className="py-4 px-6">
                          {getStatusBadge(ticket.status, ticket.status_label)}
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-6 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenChatForTicket(ticket.id);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white font-bold text-xs transition inline-flex items-center gap-1 shadow-2xs"
                          >
                            <span>مشاهده گفتگو</span>
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Table Footer / Pagination Note (Matches Image 07) */}
              <div className="p-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>نمایش ۱ تا {filteredTickets.length} از {supportTickets.length} تیکت</span>
                <div className="flex items-center gap-1 font-bold">
                  <button className="px-2.5 py-1 rounded-lg bg-blue-600 text-white">۱</button>
                  <button className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100">۲</button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Mobile Tickets Cards (Matches Image 08) */}
        <div className="sm:hidden space-y-3">
          {mobileFilteredTickets.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center border border-slate-100 space-y-2">
              <MessageSquare className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs text-slate-500">تیکتی در این بخش وجود ندارد.</p>
            </div>
          ) : (
            mobileFilteredTickets.map(ticket => (
              <button
                type="button"
                key={ticket.id}
                onClick={() => handleOpenChatForTicket(ticket.id)}
                className="w-full text-right bg-white rounded-2xl p-3.5 border border-slate-100 shadow-sm space-y-2.5 hover:border-blue-200 transition"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg">
                    {ticket.ticket_number}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">{ticket.last_update}</span>
                </div>

                <h4 className="text-xs font-bold text-slate-900 line-clamp-1">
                  {ticket.title}
                </h4>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                  <span className="text-[11px] text-slate-500">{ticket.department}</span>
                  {getStatusBadge(ticket.status, ticket.status_label)}
                </div>
              </button>
            ))
          )}
        </div>

      </div>

      {/* New Ticket Modal (Matches Image 03 & Image 04) */}
      <NewTicketModal
        isOpen={isNewTicketModalOpen}
        onClose={() => setIsNewTicketModalOpen(false)}
      />
    </>
  );
};
