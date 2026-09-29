import React from 'react';
import { 
  LayoutDashboard, 
  Package, 
  Layers, 
  ShoppingBag, 
  Users, 
  HelpCircle, 
  FileText, 
  Palette, 
  CreditCard, 
  MessageSquare, 
  Settings, 
  Store, 
  ShieldCheck,
  X,
  ChevronLeft,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { AdminSubTab } from '../../types';

interface AdminSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({ isOpen, onClose }) => {
  const { 
    adminSubTab, 
    openAdminTab, 
    products, 
    categories, 
    allOrders, 
    allUsers, 
    supportTickets, 
    navigateTo 
  } = useApp();

  const pendingOrdersCount = allOrders.filter(o => o.status === 'pending' || o.status === 'processing').length;
  const openTicketsCount = supportTickets.filter(t => t.status === 'open').length;

  const navSections: {
    title: string;
    items: {
      id: AdminSubTab;
      label: string;
      icon: React.ElementType;
      badge?: number | string;
      badgeColor?: string;
    }[];
  }[] = [
    {
      title: 'اصلی',
      items: [
        { id: 'dashboard', label: 'داشبورد و آمار زنده', icon: LayoutDashboard },
      ]
    },
    {
      title: 'مدیریت فروشگاه',
      items: [
        { id: 'products', label: 'کالاها و انبار', icon: Package, badge: products.length },
        { id: 'categories', label: 'دسته‌بندی‌ها', icon: Layers, badge: categories.length },
        { 
          id: 'orders', 
          label: 'سفارش‌ها و فاکتورها', 
          icon: ShoppingBag, 
          badge: pendingOrdersCount > 0 ? pendingOrdersCount : undefined,
          badgeColor: 'bg-amber-500 text-white'
        },
      ]
    },
    {
      title: 'کاربران و ارتباطات',
      items: [
        { id: 'users', label: 'مدیریت کاربران', icon: Users, badge: allUsers.length },
        { 
          id: 'tickets', 
          label: 'تیکت‌های پشتیبانی', 
          icon: HelpCircle, 
          badge: openTicketsCount > 0 ? openTicketsCount : undefined,
          badgeColor: 'bg-rose-500 text-white'
        },
      ]
    },
    {
      title: 'محتوا و شخصی‌سازی',
      items: [
        { id: 'content', label: 'وبلاگ و محتوای صفحات', icon: FileText },
        { id: 'appearance', label: 'طراحی بنر و اسلایدر', icon: Palette },
      ]
    },
    {
      title: 'تنظیمات و درگاه‌ها',
      items: [
        { id: 'gateways', label: 'درگاه‌های پرداخت', icon: CreditCard },
        { id: 'sms', label: 'سامانه پیامک و الگوها', icon: MessageSquare },
        { id: 'settings', label: 'تنظیمات کلی سیستم', icon: Settings },
      ]
    }
  ];

  return (
    <>
      {/* Backdrop for mobile */}
      {isOpen && (
        <div 
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar Container */}
      <aside 
        className={`fixed top-0 right-0 bottom-0 z-50 w-72 bg-white text-slate-800 border-l border-slate-200 shadow-xl lg:shadow-none flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        dir="rtl"
      >
        {/* Brand Header */}
        <div className="h-16 px-5 flex items-center justify-between border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-600/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                <span>نوین‌نت</span>
                <span className="text-[10px] bg-blue-100 text-blue-700 border border-blue-200 px-1.5 py-0.2 rounded font-mono">
                  PRO
                </span>
              </div>
              <div className="text-[11px] text-slate-500 font-medium">پنل مدیریت یکپارچه</div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Navigation Menu */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6 custom-scrollbar">
          {navSections.map((section) => (
            <div key={section.title} className="space-y-1">
              <div className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                {section.title}
              </div>
              {section.items.map(item => {
                const isActive = adminSubTab === item.id;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    id={`admin-nav-${item.id}`}
                    onClick={() => {
                      openAdminTab(item.id);
                      if (window.innerWidth < 1024) onClose();
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition group ${
                      isActive 
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' 
                        : 'text-slate-600 hover:bg-slate-100 hover:text-blue-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 transition ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-blue-600'}`} />
                      <span>{item.label}</span>
                    </div>

                    {item.badge !== undefined && (
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                        item.badgeColor || (isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600 group-hover:bg-blue-50 group-hover:text-blue-700')
                      }`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Bottom Storefront Shortcut */}
        <div className="p-3 border-t border-slate-200 bg-slate-50/50 shrink-0">
          <button
            onClick={() => navigateTo('home')}
            className="w-full min-h-11 flex items-center justify-between px-3.5 py-2 rounded-xl bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 text-xs font-semibold border border-slate-200 shadow-sm transition"
          >
            <div className="flex items-center gap-2">
              <Store className="w-4 h-4 text-blue-600" />
              <span>مشاهده فروشگاه عمومی</span>
            </div>
            <ChevronLeft className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </aside>
    </>
  );
};
