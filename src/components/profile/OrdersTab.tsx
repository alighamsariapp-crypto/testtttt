import React, { useState } from 'react';
import { 
  Package, 
  Search, 
  Filter, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  ChevronLeft, 
  Truck, 
  RotateCcw, 
  MapPin, 
  CreditCard, 
  X, 
  Printer, 
  ShoppingBag,
  AlertCircle
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { UserOrder, OrderStatus } from '../../types';
import { OrderDetailView } from './OrderDetailView';

interface OrdersTabProps {
  onViewOrderDetail?: (order: UserOrder) => void;
}

export const OrdersTab: React.FC<OrdersTabProps> = ({ onViewOrderDetail }) => {
  const { userOrders, cancelOrder, reorderItems } = useApp();
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'processing' | 'delivered' | 'cancelled'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrderForDetail, setSelectedOrderForDetail] = useState<UserOrder | null>(null);

  // If user selected an order for full detail view (Matches Image 03 & Image 04)
  if (selectedOrderForDetail) {
    return (
      <OrderDetailView 
        order={selectedOrderForDetail} 
        onBack={() => setSelectedOrderForDetail(null)} 
      />
    );
  }

  // Filter orders
  const filteredOrders = userOrders.filter(order => {
    // Status filter
    if (selectedFilter === 'processing' && order.status !== 'processing' && order.status !== 'preparing' && order.status !== 'shipping') {
      return false;
    }
    if (selectedFilter === 'delivered' && order.status !== 'delivered') {
      return false;
    }
    if (selectedFilter === 'cancelled' && order.status !== 'cancelled') {
      return false;
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNumber = order.order_number.toLowerCase().includes(q);
      const matchTrack = order.tracking_code?.toLowerCase().includes(q);
      const matchProduct = order.items.some(i => i.product_name.toLowerCase().includes(q));
      return matchNumber || matchTrack || matchProduct;
    }

    return true;
  });

  const getStatusBadge = (status: OrderStatus, label: string) => {
    switch (status) {
      case 'delivered':
        return (
          <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>{label}</span>
          </span>
        );
      case 'cancelled':
        return (
          <span className="px-3 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold flex items-center gap-1.5">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            <span>{label}</span>
          </span>
        );
      case 'preparing':
      case 'processing':
      case 'shipping':
      default:
        return (
          <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>{label}</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Title & Search */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-100 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-base sm:text-lg font-black text-slate-900">سفارش‌های من</h1>
            <p className="text-xs text-slate-500 mt-1">مشاهده و رهگیری تمامی سفارش‌های جاری، تحویل شده و لغو شده</p>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجو با شماره سفارش یا کالا..."
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white transition"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setSelectedFilter('all')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition ${
              selectedFilter === 'all'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            همه سفارش‌ها ({userOrders.length})
          </button>

          <button
            onClick={() => setSelectedFilter('processing')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition ${
              selectedFilter === 'processing'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            جاری و در حال پردازش ({userOrders.filter(o => o.status === 'processing' || o.status === 'preparing' || o.status === 'shipping').length})
          </button>

          <button
            onClick={() => setSelectedFilter('delivered')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition ${
              selectedFilter === 'delivered'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            تحویل شده ({userOrders.filter(o => o.status === 'delivered').length})
          </button>

          <button
            onClick={() => setSelectedFilter('cancelled')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition ${
              selectedFilter === 'cancelled'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            لغو شده ({userOrders.filter(o => o.status === 'cancelled').length})
          </button>
        </div>
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 space-y-3">
          <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Package className="w-8 h-8" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">سفارشی با این مشخصات یافت نشد</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            می‌توانید فیلتر انتخابی را تغییر داده یا از فروشگاه نوین‌نت دیدن فرمایید.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map(order => (
            <div 
              key={order.id}
              onClick={() => setSelectedOrderForDetail(order)}
              className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-100 shadow-sm space-y-5 hover:border-blue-200 cursor-pointer transition duration-200 group"
            >
              {/* Order Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-mono font-black text-sm text-slate-900 group-hover:text-blue-600 transition">{order.order_number}</span>
                  <span className="text-slate-300">•</span>
                  <span className="text-xs text-slate-500">{order.date}</span>
                  {order.tracking_code && (
                    <>
                      <span className="text-slate-300 hidden sm:inline">•</span>
                      <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg hidden sm:inline">
                        کد رهگیری: {order.tracking_code}
                      </span>
                    </>
                  )}
                </div>

                <div>
                  {getStatusBadge(order.status, order.status_label)}
                </div>
              </div>

              {/* Order Items Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {order.items.map((item, idx) => (
                  <div key={`order-item-${item.product_id}-${item.variant_id ?? ''}-${idx}`} className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    {item.image_url ? (
                      <img 
                        src={item.image_url} 
                        alt={item.product_name} 
                        className="w-14 h-14 rounded-xl object-cover bg-white p-1 border border-slate-200 shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                        <Package className="w-6 h-6" />
                      </div>
                    )}
                    <div className="min-w-0 space-y-1">
                      <h4 className="text-xs font-bold text-slate-900 line-clamp-1">{item.product_name}</h4>
                      {item.variant_name && (
                        <p className="text-[11px] text-slate-500 line-clamp-1">{item.variant_name}</p>
                      )}
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">تعداد: {item.quantity} عدد</span>
                        <span className="font-bold text-slate-800 font-sans">
                          {(item.unit_price ?? 0).toLocaleString('fa-IR')} ت
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Order Footer with Summary and Actions */}
              <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                <div className="space-y-1">
                  <div className="text-slate-500">
                    مبلغ کل فاکتور: <span className="font-black text-sm text-slate-900 font-sans">{(order.total_amount ?? 0).toLocaleString('fa-IR')} تومان</span>
                  </div>
                  {order.shipping_address && (
                    <p className="text-[11px] text-slate-400 line-clamp-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>ارسال به: {typeof order.shipping_address === 'string' ? order.shipping_address : (order.shipping_address?.address_line || order.shipping_address?.address || `${order.shipping_address?.province || ''} ${order.shipping_address?.city || ''}`)}</span>
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                  {/* Cancel Button (if processing) */}
                  {(order.status === 'processing' || order.status === 'preparing') && (
                    <button
                      onClick={() => cancelOrder(order.id)}
                      className="px-3.5 py-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 font-bold transition"
                    >
                      لغو سفارش
                    </button>
                  )}

                  {/* Reorder Button */}
                  <button
                    onClick={() => reorderItems(order)}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold transition flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>خرید مجدد</span>
                  </button>

                  {/* Details Trigger (Matches Image 03 & 04) */}
                  <button
                    onClick={() => setSelectedOrderForDetail(order)}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition shadow-xs flex items-center gap-1"
                  >
                    <span>جزئیات و فاکتور</span>
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
};
