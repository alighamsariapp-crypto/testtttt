import React, { useState } from 'react';
import { 
  Search, 
  MessageSquare, 
  Phone, 
  Send, 
  HelpCircle, 
  ShoppingBag, 
  CreditCard, 
  Settings, 
  UserCog, 
  ChevronLeft, 
  Wifi, 
  Gauge, 
  Receipt, 
  Router, 
  Clock, 
  CheckCircle2, 
  ArrowRight,
  Sparkles,
  ExternalLink,
  ChevronDown,
  BookOpen
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SupportTicket } from '../../types';

interface KnowledgeBaseTabProps {
  onOpenChat: (ticketId?: string) => void;
  onOpenNewTicket: () => void;
  onViewAllTickets: () => void;
}

export const KnowledgeBaseTab: React.FC<KnowledgeBaseTabProps> = ({
  onOpenChat,
  onOpenNewTicket,
  onViewAllTickets
}) => {
  const { supportTickets, showToast } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFaqIndex, setActiveFaqIndex] = useState<number | null>(null);

  const categories = [
    {
      id: 'orders',
      title: 'سفارشات',
      description: 'پیگیری، لغو و تغییرات سفارشات.',
      icon: ShoppingBag,
      iconColor: 'text-blue-600',
      iconBg: 'bg-blue-50',
      articlesCount: 14
    },
    {
      id: 'payments',
      title: 'پرداخت‌ها',
      description: 'مشکلات درگاه، کیف پول و فاکتورها.',
      icon: CreditCard,
      iconColor: 'text-emerald-600',
      iconBg: 'bg-emerald-50',
      articlesCount: 9
    },
    {
      id: 'technical',
      title: 'فنی',
      description: 'مشکلات نرم‌افزاری، قطعی و باگ‌ها.',
      icon: Settings,
      iconColor: 'text-indigo-600',
      iconBg: 'bg-indigo-50',
      articlesCount: 22
    },
    {
      id: 'account',
      title: 'حساب کاربری',
      description: 'رمز عبور، تنظیمات پروفایل و احراز هویت.',
      icon: UserCog,
      iconColor: 'text-purple-600',
      iconBg: 'bg-purple-50',
      articlesCount: 11
    }
  ];

  const popularTopics = [
    {
      title: 'راهنمای تغییر رمز وای‌فای (Wi-Fi SSID & Password)',
      icon: Wifi,
      category: 'فنی',
      content: 'برای تغییر رمز وای‌فای وارد آدرس ۱۹۲.۱۶۸.۱.۱ در مرورگر شده و با نام کاربری admin وارد پنل شوید.'
    },
    {
      title: 'افت سرعت اینترنت و راهکارهای بهینه‌سازی',
      icon: Gauge,
      category: 'فنی',
      content: 'تغییر کانال وای‌فای، استفاده از باند ۵ گیگاهرتز و بررسی فاصله با روتر بهترین روش‌های ارتقای سرعت هستند.'
    },
    {
      title: 'نحوه پرداخت و تسویه صورتحساب‌های ادواری',
      icon: Receipt,
      category: 'مالی',
      content: 'از طریق منوی کیف پول یا بخش فاکتورها می‌توانید به سادگی اقدام به پرداخت آنلاین فرمایید.'
    },
    {
      title: 'تنظیمات اولیه مودم و روترهای جدید نوین‌نت',
      icon: Router,
      category: 'نصب و راه‌اندازی',
      content: 'سیم‌کارت را در شیار مربوطه قرار داده و کابل شبکه را متصل نمایید. سیستم به‌طور خودکار شناسایی می‌شود.'
    }
  ];

  const filteredTopics = popularTopics.filter(t => 
    t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    t.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8">
      
      {/* Top Hero Section (Matches Image 05 & Image 06) */}
      <div className="text-center space-y-4 max-w-2xl mx-auto pt-2">
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          چگونه می‌توانیم کمک کنیم؟
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          جستجو در میان صدها مقاله آموزشی، راهنمای ویدیویی و پاسخ به پرسش‌های متداول نوین‌نت
        </p>

        {/* Big Search Input */}
        <div className="relative max-w-xl mx-auto">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="جستجو برای راهنمایی، مقالات یا کلمات کلیدی..."
            className="w-full pl-11 pr-5 py-3.5 bg-white border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 shadow-sm transition"
          />
          <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
        </div>
      </div>

      {/* Top 3 Quick Channels (Desktop: 3 cols, Mobile: 4 items grid) */}
      <div className="hidden sm:grid sm:grid-cols-3 gap-4">
        {/* Chat Online */}
        <div
          onClick={() => onOpenChat()}
          className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm hover:border-blue-200 hover:shadow-md transition cursor-pointer flex items-center justify-between group"
        >
          <div className="space-y-1">
            <h3 className="text-sm font-black text-slate-900 group-hover:text-blue-600 transition">چت آنلاین</h3>
            <p className="text-xs text-slate-500">پاسخگویی سریع</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition shadow-xs">
            <MessageSquare className="w-6 h-6" />
          </div>
        </div>

        {/* Phone Call */}
        <div
          onClick={() => showToast('شماره تماس پشتیبانی: ۰۲۱-۱۲۳۴۵۶۷۸', 'info')}
          className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm hover:border-blue-200 hover:shadow-md transition cursor-pointer flex items-center justify-between group"
        >
          <div className="space-y-1">
            <h3 className="text-sm font-black text-slate-900 group-hover:text-blue-600 transition">تماس تلفنی</h3>
            <p className="text-xs text-slate-500 font-mono" dir="ltr">021-12345678</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition shadow-xs">
            <Phone className="w-6 h-6" />
          </div>
        </div>

        {/* Send Ticket */}
        <div
          onClick={onOpenNewTicket}
          className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm hover:border-blue-200 hover:shadow-md transition cursor-pointer flex items-center justify-between group"
        >
          <div className="space-y-1">
            <h3 className="text-sm font-black text-slate-900 group-hover:text-blue-600 transition">ارسال تیکت</h3>
            <p className="text-xs text-slate-500">بررسی تخصصی</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition shadow-xs">
            <Send className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Mobile 4-Button Grid (Matches Image 06) */}
      <div className="sm:hidden grid grid-cols-2 gap-3">
        <button
          onClick={() => onOpenChat()}
          className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center gap-2 hover:bg-slate-50 transition"
        >
          <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <MessageSquare className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold text-slate-800">چت آنلاین</span>
        </button>

        <button
          onClick={() => showToast('شماره تماس پشتیبانی: ۰۲۱-۱۲۳۴۵۶۷۸', 'info')}
          className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center gap-2 hover:bg-slate-50 transition"
        >
          <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Phone className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold text-slate-800">تماس با پشتیبانی</span>
        </button>

        <button
          onClick={onOpenNewTicket}
          className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center gap-2 hover:bg-slate-50 transition"
        >
          <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Send className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold text-slate-800">ثبت تیکت جدید</span>
        </button>

        <button
          onClick={() => showToast('بخش سوالات متداول به روز است.', 'info')}
          className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center gap-2 hover:bg-slate-50 transition"
        >
          <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <HelpCircle className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold text-slate-800">سوالات متداول</span>
        </button>
      </div>

      {/* Main 2-Column Content (Matches Image 05) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Right Categories Column (7 cols on lg) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-blue-600" />
              <span>دسته‌بندی‌های راهنما</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {categories.map((cat) => {
              const Icon = cat.icon;
              return (
                <div
                  key={cat.id}
                  onClick={() => showToast(`مقالات مربوط به ${cat.title} در دسترس است`, 'info')}
                  className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm hover:border-blue-200 transition duration-200 flex flex-col justify-between space-y-4 cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <div className={`w-11 h-11 rounded-2xl ${cat.iconBg} ${cat.iconColor} flex items-center justify-center group-hover:scale-105 transition`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[11px] text-slate-400 font-sans">{cat.articlesCount} مقاله</span>
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition">
                      {cat.title}
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      {cat.description}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-50 flex items-center justify-between text-xs text-blue-600 font-bold group-hover:translate-x-[-2px] transition">
                    <span>مشاهده مقالات</span>
                    <ChevronLeft className="w-4 h-4" />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Popular Topics Section (Matches Image 06) */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4 mt-6">
            <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>موضوعات پرطرفدار</span>
            </h2>

            <div className="space-y-2.5">
              {filteredTopics.map((topic, idx) => {
                const Icon = topic.icon;
                const isOpen = activeFaqIndex === idx;
                return (
                  <div 
                    key={`faq-topic-${topic.title}`}
                    className="border border-slate-100 rounded-2xl overflow-hidden transition"
                  >
                    <button
                      onClick={() => setActiveFaqIndex(isOpen ? null : idx)}
                      className="w-full p-4 text-right flex items-center justify-between hover:bg-slate-50/80 transition"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-bold text-slate-800">{topic.title}</span>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180 text-blue-600' : ''}`} />
                    </button>

                    {isOpen && (
                      <div className="p-4 pt-0 text-xs text-slate-600 leading-relaxed bg-slate-50/50 border-t border-slate-100">
                        {topic.content}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Left Column: Recent Tickets Card (5 cols on lg - Matches Image 05 & Image 06) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-black text-slate-900">تیکت‌های اخیر من</h2>
              <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold">
                {supportTickets.length} مورد
              </span>
            </div>

            <div className="space-y-3">
              {supportTickets.slice(0, 3).map((ticket) => (
                <div
                  key={ticket.id}
                  onClick={() => onOpenChat(ticket.id)}
                  className="p-3.5 rounded-2xl bg-slate-50 hover:bg-blue-50/50 border border-slate-100 cursor-pointer transition space-y-2 group"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-slate-500 group-hover:text-blue-600">
                      {ticket.id}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      ticket.status === 'investigating' ? 'bg-amber-100 text-amber-800' :
                      ticket.status === 'answered' ? 'bg-blue-100 text-blue-800' :
                      'bg-slate-200 text-slate-700'
                    }`}>
                      {ticket.status_label}
                    </span>
                  </div>

                  <h4 className="text-xs font-bold text-slate-900 line-clamp-1 group-hover:text-blue-600 transition">
                    {ticket.title}
                  </h4>
                </div>
              ))}
            </div>

            <button
              onClick={onViewAllTickets}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-1"
            >
              <span>مشاهده همه تیکت‌ها</span>
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>

    </div>
  );
};
