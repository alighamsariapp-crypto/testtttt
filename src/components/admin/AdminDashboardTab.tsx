import React, { useState } from 'react';
import { 
  DollarSign, 
  ShoppingBag, 
  Users, 
  Package, 
  TrendingUp, 
  TrendingDown, 
  ArrowUpRight, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Layers, 
  Plus, 
  MessageSquare, 
  CreditCard, 
  ChevronLeft,
  Calendar,
  Sparkles
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const AdminDashboardTab: React.FC<{ onOpenNewProductModal: () => void }> = ({ onOpenNewProductModal }) => {
  const { 
    allOrders, 
    products, 
    categories, 
    allUsers, 
    supportTickets, 
    openAdminTab 
  } = useApp();

  // Real calculations
  const totalSalesRevenue = allOrders
    .filter(o => o.status !== 'cancelled')
    .reduce((sum, ord) => sum + ord.final_payable, 0);

  const completedOrdersCount = allOrders.filter(o => o.status === 'delivered').length;
  const pendingOrdersCount = allOrders.filter(o => o.status === 'pending' || o.status === 'processing').length;
  const lowStockProductsCount = products.filter(p => !p.in_stock || (p.stock_quantity !== undefined && p.stock_quantity < 5)).length;
  const openTicketsCount = supportTickets.filter(t => t.status === 'open').length;

  const kpis = [
    {
      id: 'revenue',
      title: 'مجموع فروش ناخالص',
      value: `${totalSalesRevenue.toLocaleString('fa-IR')} تومان`,
      subText: 'بر مبنای سفارش‌های ثبت‌شده',
      icon: DollarSign,
      color: 'from-emerald-500/10 to-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
    },
    {
      id: 'orders',
      title: 'سفارش‌های ثبت‌شده',
      value: `${allOrders.length.toLocaleString('fa-IR')} سفارش`,
      subText: `${pendingOrdersCount} سفارش در انتظار پردازش`,
      icon: ShoppingBag,
      color: 'from-blue-500/10 to-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30'
    },
    {
      id: 'users',
      title: 'کاربران و خریداران',
      value: `${allUsers.length.toLocaleString('fa-IR')} کاربر`,
      subText: `${allUsers.filter(u => u.role === 'customer').length} مشتری ثبت‌شده`,
      icon: Users,
      color: 'from-purple-500/10 to-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/30'
    },
    {
      id: 'products',
      title: 'تنوع کالاها در انبار',
      value: `${products.length.toLocaleString('fa-IR')} قلم کالا`,
      subText: lowStockProductsCount > 0 ? `${lowStockProductsCount} کالا نیازمند شارژ انبار` : 'موجودی ثبت‌شده کامل است',
      icon: Package,
      color: 'from-amber-500/10 to-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30'
    }
  ];

  const orderStatusSummary = [
    { label: 'در انتظار پردازش', count: pendingOrdersCount, color: 'bg-amber-500' },
    { label: 'تحویل‌شده', count: completedOrdersCount, color: 'bg-emerald-500' },
    { label: 'تیکت باز', count: openTicketsCount, color: 'bg-rose-500' },
    { label: 'هشدار موجودی', count: lowStockProductsCount, color: 'bg-blue-500' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300" dir="rtl">
      
      {/* Top Welcome Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-l from-blue-900 via-slate-900 to-slate-900 text-white border border-blue-800/40 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold font-mono border border-blue-500/30 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              مرکز عملیات و کنترل
            </span>
            <span className="text-xs text-slate-400">سامانه نوین‌نت اپکس‌استور</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white">
            پیشخوان مدیریت و مانیتورینگ عملکرد فروشگاه
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            مشاهده شاخص‌های کلیدی، وضعیت سفارشات در جریان، تیکت‌های پشتیبانی و انبارداری تجهیزات شبکه.
          </p>
        </div>

        {/* Quick Actions Shortcuts */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            id="dash-add-product-shortcut"
            onClick={onOpenNewProductModal}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-lg shadow-blue-600/30"
          >
            <Plus className="w-4 h-4" />
            <span>ثبت کالای جدید</span>
          </button>
          <button
            id="dash-view-orders-shortcut"
            onClick={() => openAdminTab('orders')}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-750 transition"
          >
            <ShoppingBag className="w-4 h-4 text-slate-400" />
            <span>بررسی سفارشات</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(kpi => {
          const Icon = kpi.icon;
          return (
            <div 
              key={kpi.id}
              className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200 dark:border-slate-700/80 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${kpi.color} border flex items-center justify-center`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>

              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                {kpi.title}
              </div>
              <div className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                {kpi.value}
              </div>
              {kpi.subText && (
                <div className="text-[11px] text-slate-400 dark:text-slate-400 mt-2 flex items-center gap-1">
                  <span>•</span>
                  <span>{kpi.subText}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Main Charts & Breakdowns Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Sales Trend Bar Chart (Span 2) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800/90 rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-slate-700/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-100 dark:border-slate-700/60">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                روند فروش و گردش هفتگی
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                توزیع مبالغ سفارشات موفق طی روزهای هفته
              </p>
            </div>

            <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-750 text-[11px] font-bold text-slate-500 dark:text-slate-300">
              خلاصهٔ عملیاتی فعلی
            </span>
          </div>

          {/* Visual Custom Responsive Bar Graph */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-5">
            {orderStatusSummary.map((item) => (
              <div key={item.label} className="rounded-2xl border border-slate-100 dark:border-slate-700 p-3 bg-slate-50/70 dark:bg-slate-750/30">
                <span className={`block w-2 h-2 rounded-full ${item.color} mb-2`} />
                <div className="text-lg font-black text-slate-900 dark:text-white font-mono">{item.count.toLocaleString('fa-IR')}</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{item.label}</div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/60 text-xs text-slate-500">
            نمودار روند و مقایسهٔ بازه‌های زمانی پس از اتصال API گزارش‌گیری واقعی فعال می‌شود.
          </div>
        </div>

        {/* Category Breakdown & Distribution */}
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-slate-700/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-slate-700/60">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                توزیع دسته‌بندی‌ها
              </h2>
              <button
                onClick={() => openAdminTab('categories')}
                className="text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline"
              >
                مدیریت
              </button>
            </div>

            {/* List with progress bars */}
            <div className="space-y-3.5">
              {categories.slice(0, 5).map((cat, idx) => {
                const count = products.filter(p => p.category_slug === cat.slug).length;
                const percentage = Math.round((count / Math.max(1, products.length)) * 100);
                const colors = ['bg-blue-500', 'bg-indigo-500', 'bg-purple-500', 'bg-emerald-500', 'bg-amber-500'];

                return (
                  <div key={cat.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-700 dark:text-slate-200">{cat.name}</span>
                      <span className="font-mono text-slate-400">{count} کالا ({percentage}٪)</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${colors[idx % colors.length]} rounded-full transition-all duration-500`}
                        style={{ width: `${Math.max(8, percentage)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-900/40 text-xs text-slate-600 dark:text-slate-300 flex items-center justify-between">
            <span>تعداد کل دسته‌بندی‌های فعال:</span>
            <span className="font-bold text-blue-600 dark:text-blue-400 font-mono">{categories.length} دسته</span>
          </div>
        </div>

      </div>

      {/* Bottom Row: Recent Orders Feed + Recent Support Tickets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Recent Orders List (Span 2) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800/90 rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-slate-700/80 shadow-sm">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-slate-700/60">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                آخرین سفارشات مشتریان
              </h2>
            </div>
            <button
              onClick={() => openAdminTab('orders')}
              className="text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline flex items-center gap-1"
            >
              <span>مشاهده همه</span>
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Orders Table/Cards */}
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700/60 text-slate-400 font-bold">
                  <th className="py-2.5 px-3">شماره سفارش</th>
                  <th className="py-2.5 px-3">مشتری</th>
                  <th className="py-2.5 px-3">مبلغ پرداختی</th>
                  <th className="py-2.5 px-3">وضعیت</th>
                  <th className="py-2.5 px-3">تاریخ ثبت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40">
                {allOrders.slice(0, 5).map(order => {
                  const statusColors: Record<string, string> = {
                    pending: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 border-amber-300 dark:border-amber-800',
                    processing: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 border-blue-300 dark:border-blue-800',
                    preparing: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 border-indigo-300 dark:border-indigo-800',
                    shipping: 'bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400 border-purple-300 dark:border-purple-800',
                    delivered: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800',
                    cancelled: 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border-rose-300 dark:border-rose-800',
                  };

                  return (
                    <tr key={order.id} className="hover:bg-slate-50 dark:hover:bg-slate-750/50 transition">
                      <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-white">
                        {order.order_number}
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-700 dark:text-slate-300">
                        {order.recipient_name || (typeof order.shipping_address === 'string' ? order.shipping_address : order.shipping_address?.full_name) || 'کاربر نوین‌نت'}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-white">
                        {(order.final_payable ?? order.total_amount ?? 0).toLocaleString('fa-IR')} تومان
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${statusColors[order.status] || 'bg-slate-100 text-slate-600'}`}>
                          {order.status_label}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-400 font-mono text-[11px]">
                        {order.created_at}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Support Tickets Overview */}
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-slate-700/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-slate-700/60">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  تیکت‌های فعال
                </h2>
              </div>
              <button
                onClick={() => openAdminTab('tickets')}
                className="text-xs text-purple-600 dark:text-purple-400 font-bold hover:underline"
              >
                پاسخگویی
              </button>
            </div>

            <div className="space-y-3">
              {supportTickets.slice(0, 4).map(ticket => (
                <div 
                  key={ticket.id}
                  onClick={() => openAdminTab('tickets')}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-750/50 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-100 dark:border-slate-700 transition cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[180px]">
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
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>{ticket.department}</span>
                    <span className="font-mono">{ticket.last_update}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/60 text-center">
            <button
              onClick={() => openAdminTab('tickets')}
              className="text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition"
            >
              مشاهده مرکز تیکت‌ها و پیام‌ها ←
            </button>
          </div>
        </div>

      </div>

    </div>
  );
};
