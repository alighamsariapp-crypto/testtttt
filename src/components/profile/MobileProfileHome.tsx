import React, { useEffect, useMemo, useState } from 'react';
import { 
  Package, 
  Heart, 
  MapPin, 
  Headphones, 
  Wallet, 
  ShieldCheck, 
  UserCog, 
  LogOut, 
  ChevronLeft, 
  Bell, 
  Plus, 
  Sparkles,
  LayoutDashboard,
  Receipt,
  HelpCircle
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ProfileSubView } from '../../types';
import { LogoutModal } from './LogoutModal';
import { NotificationsModal } from './NotificationsModal';
import { UserIdentityBadge } from '../common/UserIdentityBadge';
import { buildCustomerNotifications, readNotificationReadIds, writeNotificationReadIds } from '../../utils/notificationCenter';

interface MobileProfileHomeProps {
  onSelectTab: (tab: ProfileSubView) => void;
}

export const MobileProfileHome: React.FC<MobileProfileHomeProps> = ({ onSelectTab }) => {
  const { user, logout, setActiveView, userOrders, supportTickets, favorites } = useApp();
  
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);

  const supportNotifications = useMemo(() => buildCustomerNotifications({
    orders: [],
    tickets: supportTickets,
    walletTransactions: [],
    sessions: [],
  }).filter((notification) => notification.type === 'support'), [supportTickets]);
  const unreadSupportNotifications = supportNotifications.filter((notification) => !readNotificationIds.includes(notification.id));
  const activeOrdersCount = userOrders.filter(o => o.status === 'processing' || o.status === 'preparing' || o.status === 'shipping').length;

  useEffect(() => {
    const syncReadIds = () => setReadNotificationIds(user ? readNotificationReadIds(user.id) : []);
    syncReadIds();
    window.addEventListener('noovinnet:notification-read-change', syncReadIds);
    return () => window.removeEventListener('noovinnet:notification-read-change', syncReadIds);
  }, [user?.id]);

  const markSupportNotificationsRead = () => {
    if (!user || unreadSupportNotifications.length === 0) return;
    const nextReadIds = Array.from(new Set([
      ...readNotificationIds,
      ...unreadSupportNotifications.map((notification) => notification.id),
    ]));
    setReadNotificationIds(nextReadIds);
    writeNotificationReadIds(user.id, nextReadIds);
    window.dispatchEvent(new Event('noovinnet:notification-read-change'));
  };

  if (!user) return null;

  const handleLogoutConfirm = () => {
    setIsLogoutModalOpen(false);
    logout();
    setActiveView('home');
  };

  return (
    <>
      <div className="space-y-4 pb-6 lg:hidden">
        {/* Mobile Top Header Bar (Matches Image 09 & 11) */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-3">
            <UserIdentityBadge
              name={user.name}
              className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 ring-2 ring-blue-100 shadow-sm"
              iconClassName="w-5 h-5"
            />
            <div>
              <h2 className="text-sm font-black text-slate-900">{user.name}</h2>
              <p className="text-xs text-slate-500 font-mono mt-0.5" dir="ltr">{user.phone || user.email}</p>
            </div>
          </div>

          <button 
            onClick={() => setIsNotificationsOpen(true)}
            className="p-2.5 rounded-2xl bg-white border border-slate-200 text-slate-600 hover:text-blue-600 shadow-sm relative transition"
            title="مشاهده اعلان‌ها"
          >
            <Bell className="w-5 h-5" />
            {unreadSupportNotifications.length > 0 && (
              <span className="absolute -left-1.5 -top-1.5 min-w-5 h-5 px-1 rounded-full border-2 border-white bg-blue-600 text-[10px] font-black text-white flex items-center justify-center" aria-label={`${unreadSupportNotifications.length} پاسخ پشتیبانی خوانده‌نشده`}>
                {unreadSupportNotifications.length}
              </span>
            )}
          </button>
        </div>

        {/* Blue Gradient Wallet Card (Matching Image 11) */}
        <div className="bg-gradient-to-l from-blue-700 via-blue-600 to-indigo-700 rounded-3xl p-4 text-white shadow-lg shadow-blue-500/15 flex items-center justify-between gap-4 relative overflow-hidden">
          <div className="absolute -left-6 -bottom-6 w-28 h-28 rounded-full bg-white/10 blur-xl" />
          
          <div className="relative z-10 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-blue-100 font-bold">
              <Wallet className="w-4 h-4 text-blue-200" />
              <span>موجودی کیف پول</span>
            </div>
            <div className="text-xl font-black font-sans text-white">
              {(user.wallet_balance || 0).toLocaleString('fa-IR')} <span className="text-xs font-normal text-blue-100">تومان</span>
            </div>
          </div>

          <button
            onClick={() => onSelectTab('wallet')}
            className="relative z-10 px-4 py-2 bg-white text-blue-700 hover:bg-blue-50 rounded-2xl text-xs font-bold transition shadow-sm flex items-center gap-1 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>افزایش اعتبار</span>
          </button>
        </div>

        {/* 4 Quick Action Cards (Matching Image 11) */}
        <div className="grid grid-cols-4 gap-2">
          {/* Orders */}
          <button
            onClick={() => onSelectTab('orders')}
            className="min-h-28 p-2.5 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center gap-1.5 hover:border-blue-200 transition relative"
          >
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
            <span className="text-[10px] leading-4 font-bold text-slate-800 text-center">سفارش‌ها</span>
            {activeOrdersCount > 0 && (
              <span className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
                {activeOrdersCount}
              </span>
            )}
          </button>

          {/* Addresses */}
          <button
            onClick={() => onSelectTab('addresses')}
            className="min-h-28 p-2.5 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center gap-1.5 hover:border-blue-200 transition"
          >
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <MapPin className="w-5 h-5" />
            </div>
            <span className="text-[10px] leading-4 font-bold text-slate-800 text-center">آدرس‌ها</span>
          </button>

          {/* Favorites */}
          <button
            onClick={() => onSelectTab('favorites')}
            className="min-h-28 p-2.5 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center gap-1.5 hover:border-blue-200 transition relative"
          >
            <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <Heart className="w-5 h-5" />
            </div>
            <span className="text-[10px] leading-4 font-bold text-slate-800 text-center">علاقه‌مندی</span>
            {favorites.length > 0 && (
              <span className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                {favorites.length}
              </span>
            )}
          </button>

          {/* Support */}
          <button
            onClick={() => {
              markSupportNotificationsRead();
              onSelectTab('support');
            }}
            className="min-h-28 p-2.5 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center gap-1.5 hover:border-blue-200 transition relative"
          >
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Headphones className="w-5 h-5" />
            </div>
            <span className="text-[10px] leading-4 font-bold text-slate-800 text-center">پشتیبانی</span>
            {unreadSupportNotifications.length > 0 && (
              <span className="absolute top-1.5 left-1.5 min-w-5 h-5 px-1 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center" aria-label={`${unreadSupportNotifications.length} پاسخ پشتیبانی خوانده‌نشده`}>
                {unreadSupportNotifications.length}
              </span>
            )}
          </button>
        </div>

        {/* Main Settings & Features List */}
        <div className="bg-white rounded-3xl p-3 border border-slate-100 shadow-sm divide-y divide-slate-100 text-xs">
          
          <button
            onClick={() => onSelectTab('analytics')}
            className="w-full min-h-11 flex items-center justify-between p-3 hover:bg-slate-50 rounded-2xl transition"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <LayoutDashboard className="w-4 h-4" />
              </div>
              <span className="font-bold text-slate-800">داشبورد و آمار کاربری</span>
            </div>
            <ChevronLeft className="w-4 h-4 text-slate-400" />
          </button>

          <button
            onClick={() => onSelectTab('wallet')}
            className="w-full min-h-11 flex items-center justify-between p-3 hover:bg-slate-50 rounded-2xl transition"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Receipt className="w-4 h-4" />
              </div>
              <span className="font-bold text-slate-800">تراکنش‌ها و کیف پول</span>
            </div>
            <ChevronLeft className="w-4 h-4 text-slate-400" />
          </button>

          <button
            onClick={() => onSelectTab('security')}
            className="w-full min-h-11 flex items-center justify-between p-3 hover:bg-slate-50 rounded-2xl transition"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <span className="font-bold text-slate-800">امنیت و نشست‌های فعال</span>
            </div>
            <ChevronLeft className="w-4 h-4 text-slate-400" />
          </button>

          <button
            onClick={() => onSelectTab('settings')}
            className="w-full min-h-11 flex items-center justify-between p-3 hover:bg-slate-50 rounded-2xl transition"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                <UserCog className="w-4 h-4" />
              </div>
              <span className="font-bold text-slate-800">مشخصات هویتی و حساب</span>
            </div>
            <ChevronLeft className="w-4 h-4 text-slate-400" />
          </button>

          <button
            onClick={() => setIsLogoutModalOpen(true)}
            className="w-full flex items-center justify-between p-3.5 hover:bg-rose-50 text-rose-600 rounded-2xl transition"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <LogOut className="w-4 h-4 rotate-180" />
              </div>
              <span className="font-bold">خروج از حساب کاربری</span>
            </div>
            <ChevronLeft className="w-4 h-4 text-rose-400" />
          </button>

        </div>
      </div>

      {/* Logout Modal (Matches Image 08 Mobile Bottom Sheet) */}
      <LogoutModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        onConfirm={handleLogoutConfirm}
      />

      {/* Notifications Modal (Matches Image 09) */}
      <NotificationsModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
      />
    </>
  );
};
