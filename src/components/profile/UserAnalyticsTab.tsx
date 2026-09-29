import React from 'react';
import { BarChart3, Heart, MapPin, Package, TicketCheck, Wallet } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const UserAnalyticsTab: React.FC = () => {
  const { user, userOrders, supportTickets, favorites, addresses } = useApp();
  const activeOrders = userOrders.filter((order) => ['pending', 'processing', 'preparing', 'shipping'].includes(order.status)).length;
  const openTickets = supportTickets.filter((ticket) => ticket.status !== 'closed').length;
  const latestOrder = userOrders[0];

  const stats = [
    { label: 'کل سفارش‌ها', value: userOrders.length.toLocaleString('fa-IR'), icon: Package, tone: 'bg-blue-50 text-blue-700' },
    { label: 'سفارش فعال', value: activeOrders.toLocaleString('fa-IR'), icon: BarChart3, tone: 'bg-amber-50 text-amber-700' },
    { label: 'تیکت باز', value: openTickets.toLocaleString('fa-IR'), icon: TicketCheck, tone: 'bg-indigo-50 text-indigo-700' },
    { label: 'علاقه‌مندی', value: favorites.length.toLocaleString('fa-IR'), icon: Heart, tone: 'bg-rose-50 text-rose-700' },
  ];

  return (
    <section className="space-y-4">
      <header className="rounded-3xl bg-gradient-to-l from-blue-700 to-indigo-700 p-4 sm:p-6 text-white shadow-lg shadow-blue-500/15">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center"><BarChart3 className="w-5 h-5" /></div>
          <div>
            <h1 className="text-base font-black">داشبورد و آمار کاربری</h1>
            <p className="text-[11px] text-blue-100 mt-1">خلاصهٔ واقعی فعالیت حساب شما در نوین‌نت</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <article key={stat.label} className="bg-white rounded-2xl p-3 border border-slate-100 shadow-sm space-y-2">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${stat.tone}`}><Icon className="w-4 h-4" /></div>
              <div>
                <p className="text-lg font-black text-slate-900 font-sans">{stat.value}</p>
                <p className="text-[11px] text-slate-500">{stat.label}</p>
              </div>
            </article>
          );
        })}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <article className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-2 text-slate-800"><Wallet className="w-4 h-4 text-emerald-600" /><h2 className="text-sm font-bold">کیف پول</h2></div>
          <p className="mt-3 text-xl font-black text-slate-900 font-sans">{(user?.wallet_balance || 0).toLocaleString('fa-IR')} <span className="text-xs font-medium text-slate-500">تومان</span></p>
        </article>
        <article className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-2 text-slate-800"><MapPin className="w-4 h-4 text-blue-600" /><h2 className="text-sm font-bold">آدرس‌های تحویل</h2></div>
          <p className="mt-3 text-xl font-black text-slate-900 font-sans">{addresses.length.toLocaleString('fa-IR')} <span className="text-xs font-medium text-slate-500">آدرس ثبت‌شده</span></p>
        </article>
      </div>

      <article className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-slate-800"><Package className="w-4 h-4 text-blue-600" /><h2 className="text-sm font-bold">آخرین سفارش</h2></div>
          {latestOrder && <span className="text-[10px] px-2 py-1 rounded-full bg-slate-100 text-slate-600">{latestOrder.status_label}</span>}
        </div>
        {latestOrder ? (
          <div className="mt-3 flex items-end justify-between gap-3">
            <div className="min-w-0"><p className="text-xs font-bold text-slate-900 truncate">{latestOrder.order_number}</p><p className="text-[11px] text-slate-500 mt-1">{latestOrder.item_count.toLocaleString('fa-IR')} کالا · {latestOrder.date}</p></div>
            <p className="text-xs font-black text-blue-700 font-sans shrink-0">{latestOrder.total_amount.toLocaleString('fa-IR')} {latestOrder.currency}</p>
          </div>
        ) : <p className="mt-3 text-xs text-slate-500">هنوز سفارشی در حساب شما ثبت نشده است.</p>}
      </article>
    </section>
  );
};
