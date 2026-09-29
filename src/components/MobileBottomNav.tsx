import React, { useEffect, useMemo, useState } from 'react';
import { Home, Store, Grid, ShoppingBag, User } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { buildCustomerNotifications, readNotificationReadIds } from '../utils/notificationCenter';

export const MobileBottomNav: React.FC = () => {
  const {
    activeView,
    setActiveView,
    cartSummary,
    user,
    setAuthModalOpen,
    setProfileSubTab,
    userOrders,
    supportTickets,
    walletTransactions,
    activeSessions,
  } = useApp();
  const [readIds, setReadIds] = useState<string[]>([]);

  const unreadNotificationsCount = useMemo(() => {
    if (!user) return 0;
    return buildCustomerNotifications({
      orders: userOrders,
      tickets: supportTickets,
      walletTransactions,
      sessions: activeSessions,
    }).filter((notification) => !readIds.includes(notification.id)).length;
  }, [activeSessions, readIds, supportTickets, user, userOrders, walletTransactions]);

  useEffect(() => {
    const syncReadIds = () => setReadIds(user ? readNotificationReadIds(user.id) : []);
    syncReadIds();
    window.addEventListener('noovinnet:notification-read-change', syncReadIds);
    return () => window.removeEventListener('noovinnet:notification-read-change', syncReadIds);
  }, [user]);

  // Hide on views that have their own dedicated sticky/floating action bar
  if (activeView === 'product-detail' || activeView === 'checkout' || activeView === 'payment-status' || activeView === 'auth') {
    return null;
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/80 px-2 py-1.5 flex items-center justify-around lg:hidden shadow-lg shadow-slate-900/10">
      
      {/* خانه (Home) */}
      <button
        id="bottom-nav-home"
        onClick={() => setActiveView('home')}
        className={`min-w-12 min-h-12 flex flex-col items-center justify-center gap-1 p-1.5 rounded-xl transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 ${
          activeView === 'home' ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-800'
        }`}
      >
        <div className={`p-1 rounded-xl transition ${activeView === 'home' ? 'bg-blue-50 text-blue-600' : ''}`}>
          <Home className="w-5 h-5" />
        </div>
        <span className="text-[10px] leading-none">خانه</span>
      </button>

      {/* فروشگاه (Store) */}
      <button
        id="bottom-nav-store"
        onClick={() => setActiveView('store')}
        className={`min-w-12 min-h-12 flex flex-col items-center justify-center gap-1 p-1.5 rounded-xl transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 ${
          activeView === 'store' || activeView === 'product-detail' ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-800'
        }`}
      >
        <div className={`p-1 rounded-xl transition ${activeView === 'store' ? 'bg-blue-50 text-blue-600' : ''}`}>
          <Store className="w-5 h-5" />
        </div>
        <span className="text-[10px] leading-none">فروشگاه</span>
      </button>

      {/* خدمات (Services) */}
      <button
        id="bottom-nav-services"
        onClick={() => setActiveView('services')}
        className={`min-w-12 min-h-12 flex flex-col items-center justify-center gap-1 p-1.5 rounded-xl transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 ${
          activeView === 'services' || activeView === 'service-detail' ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-800'
        }`}
      >
        <div className={`p-1 rounded-xl transition ${activeView === 'services' ? 'bg-blue-50 text-blue-600' : ''}`}>
          <Grid className="w-5 h-5" />
        </div>
        <span className="text-[10px] leading-none">خدمات</span>
      </button>

      {/* سبد خرید (Cart) */}
      <button
        id="bottom-nav-cart"
        onClick={() => setActiveView('cart')}
        className={`min-w-12 min-h-12 flex flex-col items-center justify-center gap-1 p-1.5 rounded-xl transition-colors relative focus-visible:ring-2 focus-visible:ring-blue-500 ${
          activeView === 'cart' || activeView === 'checkout' ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-800'
        }`}
      >
        <div className={`p-1 rounded-xl transition relative ${activeView === 'cart' ? 'bg-blue-50 text-blue-600' : ''}`}>
          <ShoppingBag className="w-5 h-5" />
          {cartSummary.item_count > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white">
              {cartSummary.item_count}
            </span>
          )}
        </div>
        <span className="text-[10px] leading-none">سبد</span>
      </button>

      {/* حساب کاربری (Profile / Login) */}
      <button
        id="bottom-nav-profile"
        onClick={() => {
          if (user) {
            setProfileSubTab('dashboard');
            setActiveView('profile');
          } else {
            setAuthModalOpen(true);
          }
        }}
        className={`min-w-12 min-h-12 flex flex-col items-center justify-center gap-1 p-1.5 rounded-xl transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 ${
          activeView === 'profile' ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-800'
        }`}
      >
        <div className={`relative p-1 rounded-xl transition ${activeView === 'profile' ? 'bg-blue-50 text-blue-600' : ''}`}>
          <User className="w-5 h-5" />
          {unreadNotificationsCount > 0 && (
            <span className="absolute -left-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-blue-600 px-1 text-[10px] font-black text-white" aria-label={`${unreadNotificationsCount} اعلان خوانده‌نشده`}>
              {unreadNotificationsCount}
            </span>
          )}
        </div>
        <span className="text-[10px] leading-none">{user ? 'حساب' : 'ورود'}</span>
      </button>

    </nav>
  );
};
