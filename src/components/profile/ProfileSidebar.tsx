import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  Heart, 
  MapPin, 
  Headphones, 
  Wallet, 
  ShieldCheck, 
  UserCog, 
  LogOut,
  ChevronLeft,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ProfileSubView } from '../../types';
import { LogoutModal } from './LogoutModal';
import { UserIdentityBadge } from '../common/UserIdentityBadge';

interface ProfileSidebarProps {
  activeTab: ProfileSubView;
  onSelectTab: (tab: ProfileSubView) => void;
}

export const ProfileSidebar: React.FC<ProfileSidebarProps> = ({ activeTab, onSelectTab }) => {
  const { user, logout, setActiveView, userOrders, supportTickets, favorites } = useApp();
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  if (!user) return null;

  const openTicketsCount = supportTickets.filter(t => t.status === 'open' || t.status === 'investigating').length;
  const activeOrdersCount = userOrders.filter(o => o.status === 'processing' || o.status === 'preparing' || o.status === 'shipping').length;
  const canAccessAdmin = user.role === 'admin' || user.role === 'staff';

  const navItems: Array<{
    id: ProfileSubView;
    label: string;
    icon: React.ElementType;
    badge?: number | string;
    badgeColor?: string;
  }> = [
    { 
      id: 'dashboard', 
      label: 'داشبورد کاربری', 
      icon: LayoutDashboard 
    },
    { 
      id: 'orders', 
      label: 'سفارش‌های من', 
      icon: Package,
      badge: activeOrdersCount > 0 ? activeOrdersCount : undefined,
      badgeColor: 'bg-amber-500 text-white'
    },
    { 
      id: 'favorites', 
      label: 'علاقه‌مندی‌ها', 
      icon: Heart,
      badge: favorites.length > 0 ? favorites.length : undefined,
      badgeColor: 'bg-rose-500 text-white'
    },
    { 
      id: 'addresses', 
      label: 'آدرس‌های من', 
      icon: MapPin 
    },
    { 
      id: 'support', 
      label: 'پشتیبانی و تیکت‌ها', 
      icon: Headphones,
      badge: openTicketsCount > 0 ? openTicketsCount : undefined,
      badgeColor: 'bg-blue-600 text-white'
    },
    { 
      id: 'wallet', 
      label: 'کیف پول و تراکنش‌ها', 
      icon: Wallet 
    },
    { 
      id: 'security', 
      label: 'امنیت و حریم خصوصی', 
      icon: ShieldCheck 
    },
    { 
      id: 'settings', 
      label: 'اطلاعات و تنظیمات حساب', 
      icon: UserCog 
    },
  ];

  const handleLogoutConfirm = () => {
    setIsLogoutModalOpen(false);
    logout();
    setActiveView('home');
  };

  return (
    <>
      <aside className="w-full lg:w-72 shrink-0 space-y-4">
        {/* User Info Card */}
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-16 bg-gradient-to-l from-blue-600 to-indigo-600 opacity-10" />
          
          <div className="relative flex items-center gap-3.5 pt-2">
            <div className="relative">
              <UserIdentityBadge
                name={user.name}
                className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 ring-2 ring-blue-100 shadow-sm"
                iconClassName="w-5 h-5"
              />
              <span className="absolute -bottom-1 -left-1 w-4 h-4 rounded-full bg-emerald-500 ring-2 ring-white" />
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-black text-slate-900 truncate">{user.name}</h3>
              <p className="text-xs text-slate-500 font-mono mt-0.5 truncate" dir="ltr">{user.phone || user.email}</p>
              <div className="mt-1.5 flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold">
                  <Sparkles className="w-2.5 h-2.5 text-blue-600" />
                  <span>سطح برنزی (باشگاه نوین‌نت)</span>
                </span>
              </div>
            </div>
          </div>

          {/* Quick Balance Preview */}
          <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs">
            <div className="text-slate-500">موجودی کیف پول:</div>
            <div className="font-bold text-slate-900 font-sans">
              {(user.wallet_balance || 0).toLocaleString('fa-IR')} <span className="text-[11px] font-normal text-slate-500">تومان</span>
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <div className="bg-white rounded-3xl p-3 border border-slate-100 shadow-sm">
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-bold transition-all duration-200 ${
                    isActive 
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 translate-x-[-2px]' 
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {item.badge !== undefined && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                        isActive ? 'bg-white/20 text-white' : item.badgeColor || 'bg-slate-100 text-slate-700'
                      }`}>
                        {item.badge}
                      </span>
                    )}
                    <ChevronLeft className={`w-3.5 h-3.5 opacity-60 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  </div>
                </button>
              );
            })}

            <div className="pt-2 mt-2 border-t border-slate-100 space-y-1">
              {canAccessAdmin && (
                <button
                  id="profile-sidebar-admin-link"
                  type="button"
                  onClick={() => setActiveView('admin')}
                  className="w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-bold text-blue-700 bg-blue-50/70 hover:bg-blue-100/80 border border-blue-200/60 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    <span>ورود به پنل مدیریت</span>
                  </div>
                  <ChevronLeft className="w-3.5 h-3.5 text-blue-500" />
                </button>
              )}

              <button
                onClick={() => setIsLogoutModalOpen(true)}
                className="w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <LogOut className="w-4 h-4 text-rose-500 rotate-180" />
                  <span>خروج از حساب کاربری</span>
                </div>
                <ChevronLeft className="w-3.5 h-3.5 opacity-60 text-rose-400" />
              </button>
            </div>
          </nav>
        </div>

        {/* Support Mini Card */}
        <div className="bg-gradient-to-br from-slate-900 to-blue-950 rounded-3xl p-5 text-white shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-blue-300">پشتیبانی ۲۴ ساعته</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            سوالی درباره سرویس‌ها یا سفارش خود دارید؟ تیم پشتیبانی آماده پاسخگویی است.
          </p>
          <button
            onClick={() => onSelectTab('support')}
            className="w-full py-2.5 px-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
          >
            <span>ارسال تیکت پشتیبانی</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </aside>

      {/* Logout Modal */}
      <LogoutModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        onConfirm={handleLogoutConfirm}
      />
    </>
  );
};
