import React, { useState, useEffect } from 'react';
import { 
  ArrowRight, 
  ChevronRight, 
  Home, 
  LogIn, 
  Sparkles,
  LayoutDashboard,
  Package,
  Heart,
  MapPin,
  Headphones,
  Wallet,
  ShieldCheck,
  UserCog
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ProfileSubView, UserOrder } from '../types';
import { ProfileSidebar } from './profile/ProfileSidebar';
import { DashboardTab } from './profile/DashboardTab';
import { UserAnalyticsTab } from './profile/UserAnalyticsTab';
import { OrdersTab } from './profile/OrdersTab';
import { WishlistTab } from './profile/WishlistTab';
import { AddressesTab } from './profile/AddressesTab';
import { SupportTab } from './profile/SupportTab';
import { WalletTab } from './profile/WalletTab';
import { SecurityTab } from './profile/SecurityTab';
import { AccountSettingsTab } from './profile/AccountSettingsTab';
import { MobileProfileHome } from './profile/MobileProfileHome';

const profileTabs: ProfileSubView[] = ['dashboard', 'analytics', 'orders', 'favorites', 'addresses', 'support', 'wallet', 'security', 'settings'];

export const ProfileView: React.FC = () => {
  const { 
    user, 
    profileSubTab, 
    setProfileSubTab, 
    setActiveView, 
    setAuthModalOpen 
  } = useApp();

  const [selectedOrderDetail, setSelectedOrderDetail] = useState<UserOrder | null>(null);

  useEffect(() => {
    const applyTabFromUrl = () => {
      const requestedTab = new URLSearchParams(window.location.search).get('tab');
      if (requestedTab && profileTabs.includes(requestedTab as ProfileSubView)) {
        setProfileSubTab(requestedTab as ProfileSubView);
      }
    };

    applyTabFromUrl();
    window.addEventListener('popstate', applyTabFromUrl);
    return () => window.removeEventListener('popstate', applyTabFromUrl);
  }, [setProfileSubTab]);

  useEffect(() => {
    if (window.location.pathname !== '/profile') return;
    const currentUrl = new URL(window.location.href);
    if (profileSubTab === 'dashboard') {
      currentUrl.searchParams.delete('tab');
    } else {
      currentUrl.searchParams.set('tab', profileSubTab);
    }
    const nextPath = `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`;
    if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== nextPath) {
      window.history.replaceState(window.history.state, '', nextPath);
    }
  }, [profileSubTab]);

  // If user is not logged in
  if (!user) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4 py-16">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center border border-slate-100 shadow-sm space-y-5">
          <div className="w-16 h-16 rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto shadow-inner">
            <UserCog className="w-8 h-8" />
          </div>

          <div className="space-y-1.5">
            <h2 className="text-lg font-black text-slate-900">ورود به پنل کاربری</h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              برای دسترسی به داشبورد، پیگیری سفارش‌ها، کیف پول و تیکت‌های پشتیبانی لطفاً وارد حساب خود شوید.
            </p>
          </div>

          <div className="pt-2 flex flex-col gap-2.5">
            <button
              onClick={() => setAuthModalOpen(true)}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-bold transition shadow-md shadow-blue-500/20 flex items-center justify-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              <span>ورود یا ثبت‌نام با شماره موبایل</span>
            </button>

            <button
              onClick={() => setActiveView('home')}
              className="w-full py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-2xl text-xs font-bold transition"
            >
              بازگشت به صفحه اصلی
            </button>
          </div>
        </div>
      </div>
    );
  }

  const getSubTabTitle = (tab: ProfileSubView) => {
    switch (tab) {
      case 'dashboard': return 'داشبورد کاربری';
      case 'analytics': return 'داشبورد و آمار کاربری';
      case 'orders': return 'سفارش‌های من';
      case 'favorites': return 'علاقه‌مندی‌ها';
      case 'addresses': return 'آدرس‌های تحویل';
      case 'support': return 'پشتیبانی و تیکت‌ها';
      case 'wallet': return 'کیف پول و تراکنش‌ها';
      case 'security': return 'امنیت و نشست‌ها';
      case 'settings': return 'اطلاعات و مشخصات حساب';
      default: return 'ناحیه کاربری';
    }
  };

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-5 lg:space-y-6">
      
      {/* Desktop breadcrumb; sub-pages on mobile use one clear app-like back control below. */}
      <nav className="hidden lg:flex items-center justify-between rounded-2xl border border-slate-100 bg-white px-5 py-3.5 text-xs text-slate-500 shadow-xs">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setActiveView('home')}
            className="hover:text-blue-600 flex items-center gap-1 transition"
          >
            <Home className="w-3.5 h-3.5" />
            <span>نوین‌نت</span>
          </button>

          <ChevronRight className="w-3.5 h-3.5 text-slate-300 rotate-180" />

          <button 
            onClick={() => setProfileSubTab('dashboard')}
            className="hover:text-blue-600 transition"
          >
            پنل کاربری
          </button>

          {profileSubTab !== 'dashboard' && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-slate-300 rotate-180" />
              <span className="font-bold text-slate-800">{getSubTabTitle(profileSubTab)}</span>
            </>
          )}
        </div>

      </nav>

      <h1 id="profile-content-heading" tabIndex={-1} className="sr-only outline-none">{getSubTabTitle(profileSubTab)}</h1>

      {profileSubTab !== 'dashboard' && (
        <div className="lg:hidden flex items-center justify-between min-h-11 px-1">
          <button
            type="button"
            onClick={() => setProfileSubTab('dashboard')}
            className="min-h-11 inline-flex items-center gap-2 text-sm font-bold text-blue-700 hover:text-blue-800"
          >
            <ArrowRight className="w-4 h-4" />
            <span>بازگشت به پنل کاربری</span>
          </button>
          <span className="text-xs font-bold text-slate-500 truncate max-w-[42%]">{getSubTabTitle(profileSubTab)}</span>
        </div>
      )}

      {/* Main Layout: Desktop Sidebar + Content / Mobile Views */}
      <div className="grid grid-cols-1 lg:grid-cols-[17.5rem_minmax(0,1fr)] items-start gap-6 lg:gap-8">
        
        {/* Desktop Sidebar (hidden on small screens) */}
        <div className="hidden lg:block sticky top-24 self-start">
          <ProfileSidebar 
            activeTab={profileSubTab} 
            onSelectTab={(tab) => setProfileSubTab(tab)} 
          />
        </div>

        {/* Main Content Area */}
        <div className="w-full min-w-0">
          
          {/* Mobile Home Menu when on dashboard on mobile */}
          <div className="lg:hidden">
            {profileSubTab === 'dashboard' ? (
              <MobileProfileHome onSelectTab={(tab) => setProfileSubTab(tab)} />
            ) : null}
          </div>

          {/* Sub Views Content */}
          <div className={profileSubTab === 'dashboard' ? 'hidden lg:block' : 'block'}>
            {profileSubTab === 'dashboard' && (
              <DashboardTab 
                onNavigateTab={(tab) => setProfileSubTab(tab)}
                onViewOrderDetail={(order) => {
                  setSelectedOrderDetail(order);
                  setProfileSubTab('orders');
                }}
              />
            )}

            {profileSubTab === 'analytics' && <UserAnalyticsTab />}

            {profileSubTab === 'orders' && (
              <OrdersTab onViewOrderDetail={(order) => setSelectedOrderDetail(order)} />
            )}

            {profileSubTab === 'favorites' && (
              <WishlistTab />
            )}

            {profileSubTab === 'addresses' && (
              <AddressesTab />
            )}

            {profileSubTab === 'support' && (
              <SupportTab />
            )}

            {profileSubTab === 'wallet' && (
              <WalletTab />
            )}

            {profileSubTab === 'security' && (
              <SecurityTab />
            )}

            {profileSubTab === 'settings' && (
              <AccountSettingsTab />
            )}
          </div>

        </div>

      </div>

    </div>
  );
};
