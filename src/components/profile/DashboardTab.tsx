import React from 'react';
import { 
  Package, 
  Clock, 
  CheckCircle2, 
  Truck, 
  Heart, 
  Wallet, 
  Headphones, 
  ArrowLeft, 
  ChevronLeft, 
  Sparkles, 
  ShieldCheck, 
  Plus, 
  FileText,
  AlertCircle,
  ExternalLink,
  ShoppingBag
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ProfileSubView, UserOrder } from '../../types';

interface DashboardTabProps {
  onNavigateTab: (tab: ProfileSubView) => void;
  onViewOrderDetail: (order: UserOrder) => void;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({ onNavigateTab, onViewOrderDetail }) => {
  const { user, userOrders, favorites, products, supportTickets, addToCart } = useApp();

  if (!user) return null;

  // Active processing order
  const processingOrder = userOrders.find(
    o => o.status === 'processing' || o.status === 'preparing' || o.status === 'shipping'
  ) || userOrders[0];

  // Favorite items preview
  const favoriteProducts = products.filter(p => favorites.includes(p.id)).slice(0, 3);

  // Recent 3 orders
  const recentOrders = userOrders.slice(0, 4);

  return (
    <div className="space-y-6">
      {/* Top Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 rounded-3xl p-6 sm:p-8 text-white shadow-lg shadow-blue-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute -left-10 -bottom-10 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute right-10 -top-10 w-32 h-32 rounded-full bg-indigo-400/20 blur-xl" />

        <div className="relative space-y-1.5 z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-[11px] font-bold">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>خوش آمدید، {user.name}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight">داشبورد حساب کاربری نوین‌نت</h1>
          <p className="text-xs sm:text-sm text-blue-100 max-w-xl leading-relaxed">
            خلاصه فعالیت‌ها، وضعیت سفارش‌های جاری، کیف پول و تیکت‌های پشتیبانی شما در این بخش قابل مشاهده است.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => onNavigateTab('wallet')}
            className="px-4 py-2.5 bg-white text-blue-700 hover:bg-blue-50 rounded-2xl text-xs font-bold transition shadow-sm flex items-center gap-1.5"
          >
            <Wallet className="w-4 h-4" />
            <span>افزایش اعتبار کیف پول</span>
          </button>
          <button
            onClick={() => onNavigateTab('orders')}
            className="px-4 py-2.5 bg-white/15 hover:bg-white/20 text-white rounded-2xl text-xs font-bold transition border border-white/20 flex items-center gap-1.5 backdrop-blur-md"
          >
            <FileText className="w-4 h-4" />
            <span>همه فاکتورها</span>
          </button>
        </div>
      </div>

      {/* Top Grid: compact active-order summary + useful customer actions */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        
        {/* Full tracking remains available in the order-detail view. */}
        <div className="xl:col-span-5 bg-white rounded-3xl p-4 sm:p-5 border border-slate-100 shadow-sm space-y-4 self-start">
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-black text-slate-900">رهگیری سفارش فعال</h3>
                <p className="text-[11px] text-slate-500 font-mono">
                  کد رهگیری: {processingOrder?.tracking_code || processingOrder?.order_number || '#ORD-7829-X'}
                </p>
              </div>
            </div>

            <span className="shrink-0 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>{processingOrder?.status_label || 'در حال آماده‌سازی'}</span>
            </span>
          </div>

          {/* 4-Step Progress Bar */}
          <div className="py-1">
            <div className="relative flex items-center justify-between">
              {/* Connector line */}
              <div className="absolute top-1/2 left-4 right-4 -translate-y-1/2 h-1 bg-slate-100 -z-0">
                <div 
                  className="h-full bg-blue-600 transition-all duration-500" 
                  style={{ width: `${((processingOrder?.current_step || 2) - 1) * 33.33}%` }}
                />
              </div>

              {/* Step 1: ثبت سفارش */}
              <div className="relative z-10 flex flex-col items-center gap-1.5">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ring-4 ring-white ${
                  (processingOrder?.current_step || 2) >= 1 
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30' 
                    : 'bg-slate-200 text-slate-500'
                }`}>
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-bold text-slate-800 whitespace-nowrap">ثبت سفارش</span>
              </div>

              {/* Step 2: آماده‌سازی */}
              <div className="relative z-10 flex flex-col items-center gap-1.5">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ring-4 ring-white ${
                  (processingOrder?.current_step || 2) >= 2 
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30 animate-pulse' 
                    : 'bg-slate-200 text-slate-500'
                }`}>
                  <Package className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-bold text-blue-600 whitespace-nowrap">آماده‌سازی</span>
              </div>

              {/* Step 3: ارسال */}
              <div className="relative z-10 flex flex-col items-center gap-1.5">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ring-4 ring-white ${
                  (processingOrder?.current_step || 2) >= 3 
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30' 
                    : 'bg-slate-100 text-slate-400'
                }`}>
                  <Truck className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap">ارسال</span>
              </div>

              {/* Step 4: تحویل */}
              <div className="relative z-10 flex flex-col items-center gap-1.5">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ring-4 ring-white ${
                  (processingOrder?.current_step || 2) >= 4 
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/30' 
                    : 'bg-slate-100 text-slate-400'
                }`}>
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap">تحویل</span>
              </div>
            </div>
          </div>

          {/* Active Product Snippet */}
          {processingOrder && (
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                {processingOrder.items[0]?.image_url ? (
                  <img 
                    src={processingOrder.items[0].image_url} 
                    alt={processingOrder.items[0].product_name}
                    className="w-10 h-10 rounded-xl object-cover bg-white p-1 border border-slate-200 shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                    <Package className="w-5 h-5" />
                  </div>
                )}
                <div>
                  <h4 className="text-xs font-bold text-slate-900 line-clamp-1">
                    {processingOrder.items[0]?.product_name || 'سفارش تجهیزات شبکه'}
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    زمان تقریبی تحویل: <span className="font-bold text-slate-700">{processingOrder.estimated_delivery || 'فردا بعد از ظهر'}</span>
                  </p>
                </div>
              </div>

              <button
                onClick={() => onViewOrderDetail(processingOrder)}
                className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-800 rounded-xl text-[11px] font-bold transition border border-slate-200 shadow-sm shrink-0 flex items-center gap-1"
              >
                <span>مشاهده جزئیات</span>
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Quick actions replace the duplicate user-profile card already available in the sidebar. */}
        <section className="xl:col-span-7 bg-white rounded-3xl p-5 sm:p-6 border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">دسترسی‌های پرکاربرد</h3>
              <p className="mt-1 text-[11px] text-slate-500">کارهای روزمرهٔ حساب را سریع انجام دهید.</p>
            </div>
            <button
              onClick={() => onNavigateTab('settings')}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <span>تنظیمات</span>
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => onNavigateTab('orders')} className="rounded-2xl border border-slate-100 bg-slate-50 p-3.5 text-right hover:border-blue-200 hover:bg-blue-50 transition">
              <Package className="w-4 h-4 text-blue-600" />
              <span className="mt-2 block text-xs font-bold text-slate-800">سفارش‌های من</span>
              <span className="mt-1 block text-[11px] text-slate-500">پیگیری و فاکتورها</span>
            </button>
            <button onClick={() => onNavigateTab('wallet')} className="rounded-2xl border border-slate-100 bg-slate-50 p-3.5 text-right hover:border-emerald-200 hover:bg-emerald-50 transition">
              <Wallet className="w-4 h-4 text-emerald-600" />
              <span className="mt-2 block text-xs font-bold text-slate-800">کیف پول</span>
              <span className="mt-1 block text-[11px] text-slate-500">افزایش اعتبار</span>
            </button>
            <button onClick={() => onNavigateTab('addresses')} className="rounded-2xl border border-slate-100 bg-slate-50 p-3.5 text-right hover:border-violet-200 hover:bg-violet-50 transition">
              <Truck className="w-4 h-4 text-violet-600" />
              <span className="mt-2 block text-xs font-bold text-slate-800">آدرس‌های تحویل</span>
              <span className="mt-1 block text-[11px] text-slate-500">مدیریت نشانی‌ها</span>
            </button>
            <button onClick={() => onNavigateTab('support')} className="rounded-2xl border border-slate-100 bg-slate-50 p-3.5 text-right hover:border-amber-200 hover:bg-amber-50 transition">
              <Headphones className="w-4 h-4 text-amber-600" />
              <span className="mt-2 block text-xs font-bold text-slate-800">پشتیبانی</span>
              <span className="mt-1 block text-[11px] text-slate-500">ثبت یا پیگیری تیکت</span>
            </button>
          </div>

          <button onClick={() => onNavigateTab('wallet')} className="w-full rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 text-right flex items-center justify-between gap-3 hover:bg-emerald-50 transition">
            <span className="text-xs font-bold text-emerald-800">ماندهٔ کیف پول</span>
            <span className="font-sans text-sm font-black text-emerald-900">{(user.wallet_balance || 0).toLocaleString('fa-IR')} <span className="text-[11px] font-medium">تومان</span></span>
          </button>
        </section>

      </div>

      {/* Bottom Row: Recent Orders Table + Wishlist Preview & Support Quick Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Recent Orders (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-900">سفارش‌های اخیر</h3>
            </div>
            <button
              onClick={() => onNavigateTab('orders')}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <span>مشاهده همه سفارش‌ها</span>
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {recentOrders.map(order => (
              <div key={order.id} className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold font-mono text-slate-900">{order.order_number}</span>
                    <span className="text-slate-400">•</span>
                    <span className="text-slate-500">{order.date}</span>
                  </div>
                  <div className="text-slate-600 line-clamp-1">
                    {order.items.map(i => i.product_name).join('، ')}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                    order.status === 'delivered'
                      ? 'bg-emerald-100 text-emerald-800'
                      : order.status === 'cancelled'
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {order.status_label}
                  </span>

                  <span className="font-bold font-sans text-slate-900 hidden sm:inline">
                    {order.total_amount.toLocaleString('fa-IR')} تومان
                  </span>

                  <button
                    onClick={() => onViewOrderDetail(order)}
                    className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-600 transition"
                    title="مشاهده فاکتور"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Wishlist Quick Preview & Support Help (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Wishlist Box */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-rose-500" />
                <h3 className="text-sm font-bold text-slate-900">علاقه‌مندی‌های من</h3>
              </div>
              <button
                onClick={() => onNavigateTab('favorites')}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <span>مشاهده همه ({favorites.length})</span>
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            </div>

            {favoriteProducts.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">
                هنوز محصولی به لیست علاقه‌مندی‌ها اضافه نشده است.
              </p>
            ) : (
              <div className="space-y-3">
                {favoriteProducts.map(prod => (
                  <div key={prod.id} className="p-3 bg-slate-50 rounded-2xl flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5">
                      <img 
                        src={prod.image_url} 
                        alt={prod.name} 
                        className="w-10 h-10 rounded-xl object-cover bg-white p-0.5 border border-slate-200"
                      />
                      <div className="space-y-0.5">
                        <h4 className="font-bold text-slate-900 line-clamp-1">{prod.name}</h4>
                        <div className="font-bold font-sans text-blue-700 text-[11px]">
                          {(prod.effective_price || prod.base_price).toLocaleString('fa-IR')} تومان
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => addToCart(prod)}
                      className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[11px] font-bold transition flex items-center gap-1 shrink-0"
                    >
                      <Plus className="w-3 h-3" />
                      <span>افزودن</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Support Assistance Card */}
          <div className="bg-slate-900 rounded-3xl p-5 text-white shadow-sm flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-blue-600/30 border border-blue-500/40 text-blue-400 flex items-center justify-center shrink-0">
                <Headphones className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <h4 className="text-xs font-bold text-white">نیاز به راهنمایی دارید؟</h4>
                <p className="text-[11px] text-slate-400">کارشناسان فنی در دسترس هستند.</p>
              </div>
            </div>

            <button
              onClick={() => onNavigateTab('support')}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition shadow-sm shrink-0 flex items-center gap-1"
            >
              <span>ارتباط فوری</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
