import React from 'react';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingBag, 
  Users, 
  Menu 
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { AdminSubTab } from '../../types';

interface AdminMobileBottomNavProps {
  onOpenSidebar: () => void;
}

export const AdminMobileBottomNav: React.FC<AdminMobileBottomNavProps> = ({ onOpenSidebar }) => {
  const { adminSubTab, openAdminTab, allOrders } = useApp();

  const pendingOrders = allOrders.filter(o => o.status === 'pending' || o.status === 'processing').length;

  const items: {
    id: AdminSubTab | 'more';
    label: string;
    icon: React.ElementType;
    badge?: number;
  }[] = [
    { id: 'dashboard', label: 'داشبورد', icon: LayoutDashboard },
    { id: 'products', label: 'کالاها', icon: Package },
    { id: 'orders', label: 'سفارش‌ها', icon: ShoppingBag, badge: pendingOrders > 0 ? pendingOrders : undefined },
    { id: 'users', label: 'کاربران', icon: Users },
    { id: 'more', label: 'منو کامل', icon: Menu },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 lg:hidden px-2 py-1.5 shadow-lg" dir="rtl">
      <div className="grid grid-cols-5 gap-1">
        {items.map(item => {
          const isActive = adminSubTab === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              id={`admin-mob-nav-${item.id}`}
              onClick={() => {
                if (item.id === 'more') {
                  onOpenSidebar();
                } else {
                  openAdminTab(item.id);
                }
              }}
              className={`relative flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition ${
                isActive 
                  ? 'text-blue-600 dark:text-blue-400 font-bold' 
                  : 'text-slate-500 dark:text-slate-400 font-medium hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 mb-0.5 ${isActive ? 'scale-110' : ''} transition-transform`} />
                {item.badge !== undefined && (
                  <span className="absolute -top-1 -right-2 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center font-mono">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] tracking-tight">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
