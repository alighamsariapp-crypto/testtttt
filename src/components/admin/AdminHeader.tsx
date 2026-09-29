import React, { useState, useEffect } from 'react';
import { 
  Menu, 
  Search, 
  Bell, 
  ExternalLink, 
  Plus, 
  ChevronDown, 
  LogOut, 
  User, 
  Shield, 
  Package, 
  ShoppingBag, 
  HelpCircle,
  Clock,
  Sparkles
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { UserIdentityBadge } from '../common/UserIdentityBadge';

interface AdminHeaderProps {
  onToggleSidebar: () => void;
  onOpenNewProductModal: () => void;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({ 
  onToggleSidebar, 
  onOpenNewProductModal 
}) => {
  const { 
    user, 
    logout, 
    navigateTo, 
    allOrders, 
    supportTickets, 
    products, 
    openAdminTab 
  } = useApp();
  
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isNotifMenuOpen, setIsNotifMenuOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState('');

  // Persian real-time clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        calendar: 'persian',
      };
      setCurrentTime(new Intl.DateTimeFormat('fa-IR', options).format(now));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const pendingOrdersCount = allOrders.filter(o => o.status === 'pending' || o.status === 'processing').length;
  const openTicketsCount = supportTickets.filter(t => t.status === 'open').length;
  const lowStockCount = products.filter(p => !p.in_stock || (p.stock_quantity !== undefined && p.stock_quantity < 5)).length;
  const totalAlertsCount = pendingOrdersCount + openTicketsCount + lowStockCount;

  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors" dir="rtl">
      <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8 gap-4">
        
        {/* Left Side (in RTL): Menu Toggle + Title */}
        <div className="flex items-center gap-3">
          <button
            id="admin-sidebar-toggle-btn"
            onClick={onToggleSidebar}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition lg:hidden"
            aria-label="Toggle Sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="hidden sm:flex items-center gap-2">
            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>{currentTime || '۱۲:۰۰:۰۰'}</span>
            </span>
            <span className="text-xs text-slate-400 font-medium hidden md:inline">
              مرکز فرماندهی نوین‌نت
            </span>
          </div>
        </div>

        {/* Center / Action Buttons */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quick Create Product Button */}
          <button
            id="admin-quick-add-product-btn"
            onClick={onOpenNewProductModal}
            className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-blue-600/20 transition active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">افزودن محصول جدید</span>
            <span className="sm:hidden">محصول جدید</span>
          </button>

          {/* View Public Store */}
          <button
            id="admin-view-storefront-btn"
            onClick={() => navigateTo('home')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-semibold transition"
            title="مشاهده نمای عمومی فروشگاه"
          >
            <ExternalLink className="w-4 h-4 text-slate-500" />
            <span className="hidden md:inline">نمای فروشگاه</span>
          </button>

          {/* Notification Menu */}
          <div className="relative">
            <button
              id="admin-notifications-btn"
              onClick={() => {
                setIsNotifMenuOpen(!isNotifMenuOpen);
                setIsProfileMenuOpen(false);
              }}
              className="relative p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5" />
              {totalAlertsCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                  {totalAlertsCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown */}
            {isNotifMenuOpen && (
              <div 
                className="absolute left-0 sm:right-auto sm:left-0 mt-2 w-80 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-3 z-50 animate-in fade-in slide-in-from-top-2 duration-200"
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">اعلان‌ها و هشدارها</span>
                  <span className="text-[11px] text-slate-500">{totalAlertsCount} مورد جدید</span>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {pendingOrdersCount > 0 && (
                    <button
                      onClick={() => {
                        openAdminTab('orders');
                        setIsNotifMenuOpen(false);
                      }}
                      className="w-full text-right p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 hover:bg-amber-100/80 transition flex items-start gap-2.5"
                    >
                      <ShoppingBag className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                      <div>
                        <div className="text-xs font-bold text-amber-900 dark:text-amber-200">
                          {pendingOrdersCount} سفارش جدید در انتظار بررسی
                        </div>
                        <div className="text-[11px] text-amber-700 dark:text-amber-400">
                          نیاز به تایید و ارسال به واحد انبار
                        </div>
                      </div>
                    </button>
                  )}

                  {openTicketsCount > 0 && (
                    <button
                      onClick={() => {
                        openAdminTab('tickets');
                        setIsNotifMenuOpen(false);
                      }}
                      className="w-full text-right p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/40 hover:bg-blue-100/80 transition flex items-start gap-2.5"
                    >
                      <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                      <div>
                        <div className="text-xs font-bold text-blue-900 dark:text-blue-200">
                          {openTicketsCount} تیکت پشتیبانی پاسخ‌داده‌نشده
                        </div>
                        <div className="text-[11px] text-blue-700 dark:text-blue-400">
                          کاربران منتظر پاسخ کارشناسان هستند
                        </div>
                      </div>
                    </button>
                  )}

                  {lowStockCount > 0 && (
                    <button
                      onClick={() => {
                        openAdminTab('products');
                        setIsNotifMenuOpen(false);
                      }}
                      className="w-full text-right p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-800/40 hover:bg-rose-100/80 transition flex items-start gap-2.5"
                    >
                      <Package className="w-4 h-4 text-rose-600 dark:text-rose-400 mt-0.5 shrink-0" />
                      <div>
                        <div className="text-xs font-bold text-rose-900 dark:text-rose-200">
                          {lowStockCount} کالا با موجودی اتمام یا ناموجود
                        </div>
                        <div className="text-[11px] text-rose-700 dark:text-rose-400">
                          اقدام جهت شارژ موجودی انبار
                        </div>
                      </div>
                    </button>
                  )}

                  {totalAlertsCount === 0 && (
                    <div className="text-center py-6 text-slate-400 text-xs font-medium">
                      تمام عملیات‌ها به‌روز هستند و هشدار فعالی وجود ندارد.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Admin User Profile Dropdown */}
          <div className="relative">
            <button
              id="admin-profile-menu-btn"
              onClick={() => {
                setIsProfileMenuOpen(!isProfileMenuOpen);
                setIsNotifMenuOpen(false);
              }}
              className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <UserIdentityBadge
                name={user?.name || 'مدیر'}
                className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 ring-2 ring-blue-500/30"
                iconClassName="w-4 h-4"
              />
              <div className="hidden lg:block text-right">
                <div className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                  {user?.name || 'مدیر کل سیستم'}
                </div>
                <div className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold">
                  {user?.role === 'admin' ? 'مدیر ارشد' : 'کارشناس فنی'}
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
            </button>

            {/* Profile Menu Dropdown */}
            {isProfileMenuOpen && (
              <div 
                className="absolute left-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-2 space-y-1 z-50 animate-in fade-in slide-in-from-top-2 duration-200"
              >
                <div className="p-2.5 border-b border-slate-100 dark:border-slate-700/60">
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    {user?.name || 'مدیر سیستم'}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {user?.email || 'admin@noovinnet.ir'}
                  </div>
                </div>

                <button
                  onClick={() => {
                    navigateTo('profile');
                    setIsProfileMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                >
                  <User className="w-4 h-4 text-slate-500" />
                  <span>پروفایل کاربری من</span>
                </button>

                <button
                  onClick={() => {
                    openAdminTab('settings');
                    setIsProfileMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                >
                  <Shield className="w-4 h-4 text-slate-500" />
                  <span>تنظیمات و امنیت فروشگاه</span>
                </button>

                <div className="pt-1 border-t border-slate-100 dark:border-slate-700/60">
                  <button
                    id="admin-logout-btn"
                    onClick={() => {
                      logout();
                      setIsProfileMenuOpen(false);
                      navigateTo('home');
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
                  >
                    <LogOut className="w-4 h-4 text-rose-500" />
                    <span>خروج از حساب مدیریت</span>
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>

      </div>
    </header>
  );
};
