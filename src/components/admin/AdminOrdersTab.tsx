import React, { useState } from 'react';
import { 
  ShoppingBag, 
  Search, 
  Filter, 
  Eye, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  Truck, 
  XCircle, 
  Printer, 
  AlertTriangle,
  ChevronLeft,
  Calendar,
  Sparkles
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { UserOrder } from '../../types';
import { AdminOrderDetailModal } from './AdminOrderDetailModal';

export const AdminOrdersTab: React.FC = () => {
  const { allOrders, updateOrderStatus, deleteOrder } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<UserOrder | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Filter orders
  const filteredOrders = allOrders.filter(order => {
    const s = searchTerm.toLowerCase();
    const addressName = typeof order.shipping_address === 'object' ? order.shipping_address?.full_name : '';
    const addressString = typeof order.shipping_address === 'string' ? order.shipping_address : '';
    const addressPhone = typeof order.shipping_address === 'object' ? order.shipping_address?.phone : '';

    const matchesSearch = !searchTerm.trim() ||
      order.order_number.toLowerCase().includes(s) ||
      (addressName && addressName.toLowerCase().includes(s)) ||
      (addressString && addressString.toLowerCase().includes(s)) ||
      order.recipient_name?.toLowerCase().includes(s) ||
      order.customer_name?.toLowerCase().includes(s) ||
      order.customer_phone?.includes(s) ||
      order.recipient_phone?.includes(s) ||
      (addressPhone && addressPhone.includes(s)) ||
      order.tracking_code?.toLowerCase().includes(s);

    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleOpenDetail = (order: UserOrder) => {
    setSelectedOrder(order);
    setIsModalOpen(true);
  };

  const statusTabs: { id: string; label: string; count: number }[] = [
    { id: 'all', label: 'همه سفارش‌ها', count: allOrders.length },
    { id: 'pending', label: 'در انتظار پرداخت', count: allOrders.filter(o => o.status === 'pending').length },
    { id: 'processing', label: 'در انتظار تایید', count: allOrders.filter(o => o.status === 'processing').length },
    { id: 'preparing', label: 'در حال آماده‌سازی', count: allOrders.filter(o => o.status === 'preparing').length },
    { id: 'shipping', label: 'ارسال شده', count: allOrders.filter(o => o.status === 'shipping').length },
    { id: 'delivered', label: 'تحویل داده شده', count: allOrders.filter(o => o.status === 'delivered').length },
    { id: 'cancelled', label: 'لغو شده', count: allOrders.filter(o => o.status === 'cancelled').length },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300" dir="rtl">
      
      {/* Top Header Card */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-slate-700/80 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
              مدیریت سفارشات، فاکتورها و ارسال پستی
            </h1>
            <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              {allOrders.length} سفارش
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            پیگیری فرآیند پردازش، چاپ فاکتور رسمی، تغییر وضعیت و درج کد مرسوله پستی.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-4 border border-slate-200 dark:border-slate-700/80 shadow-sm space-y-4">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
          <input
            id="admin-orders-search"
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="جستجو بر اساس شماره سفارش (ORD-...)، نام خریدار، تلفن، یا کد رهگیری پستی..."
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pr-10 pl-4 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-700/60 text-xs">
          {statusTabs.map(tab => {
            const isActive = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition ${
                  isActive 
                    ? 'bg-blue-600 text-white shadow-sm' 
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Orders Table (Desktop) */}
      <div className="hidden md:block bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 dark:bg-slate-850/60 border-b border-slate-200 dark:border-slate-700 text-slate-500 font-bold">
              <tr>
                <th className="py-3.5 px-4">شماره سفارش</th>
                <th className="py-3.5 px-3">نام مشتری و مقصد</th>
                <th className="py-3.5 px-3">تعداد اقلام</th>
                <th className="py-3.5 px-3">مبلغ پرداختی</th>
                <th className="py-3.5 px-3 text-center">وضعیت سفارش</th>
                <th className="py-3.5 px-3">کد رهگیری</th>
                <th className="py-3.5 px-3">تاریخ ثبت</th>
                <th className="py-3.5 px-4 text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {filteredOrders.map(order => {
                const statusColors: Record<string, string> = {
                  pending: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-300 dark:border-amber-800',
                  processing: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-300 dark:border-blue-800',
                  preparing: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800',
                  shipping: 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-300 dark:border-purple-800',
                  delivered: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
                  cancelled: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-300 dark:border-rose-800',
                };

                return (
                  <tr key={order.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-750/50 transition group">
                    
                    {/* Order Number */}
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                      {order.order_number}
                    </td>

                    {/* Customer */}
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900 dark:text-white">
                        {order.shipping_address?.full_name || order.recipient_name || order.customer_name || 'کاربر نوین‌نت'}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {order.shipping_address?.city ? `${order.shipping_address.city} • ` : ''}{order.shipping_address?.phone || order.recipient_phone || order.customer_phone || ''}
                      </div>
                    </td>

                    {/* Items Count */}
                    <td className="py-3 px-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                      {order.items ? order.items.reduce((s, i) => s + (i.quantity || 1), 0) : (order.item_count || 1)} قلم
                    </td>

                    {/* Payable Price */}
                    <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-white">
                      {(order.final_payable ?? order.total_amount ?? 0).toLocaleString('fa-IR')} تومان
                    </td>

                    {/* Status Select */}
                    <td className="py-3 px-3 text-center">
                      <select
                        value={order.status}
                        onChange={e => updateOrderStatus(order.id, e.target.value as UserOrder['status'])}
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-full border focus:outline-none cursor-pointer ${
                          statusColors[order.status] || 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        <option value="pending">در انتظار پرداخت</option>
                        <option value="processing">در انتظار تایید</option>
                        <option value="preparing">آماده‌سازی انبار</option>
                        <option value="shipping">ارسال شده (پست)</option>
                        <option value="delivered">تحویل شده</option>
                        <option value="cancelled">لغو شده</option>
                      </select>
                    </td>

                    {/* Tracking Code */}
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-500">
                      {order.tracking_code || '---'}
                    </td>

                    {/* Date */}
                    <td className="py-3 px-3 text-slate-400 font-mono text-[11px]">
                      {order.created_at || order.date}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenDetail(order)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 hover:bg-blue-100 font-bold transition"
                          title="مشاهده جزئیات فاکتور"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>فاکتور</span>
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(order.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                          title="حذف سفارش"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Orders Cards (Mobile) */}
      <div className="md:hidden space-y-3">
        {filteredOrders.map(order => (
          <div key={order.id} className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700">
              <div className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                {order.order_number}
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                {order.created_at}
              </span>
            </div>

            <div className="text-xs space-y-1 text-slate-600 dark:text-slate-300">
              <div>مشتری: <strong className="text-slate-900 dark:text-white">{order.recipient_name || (typeof order.shipping_address === 'string' ? order.shipping_address : order.shipping_address?.full_name) || 'کاربر نوین‌نت'}</strong></div>
              <div>مبلغ کل: <strong className="text-blue-600 dark:text-blue-400 font-mono">{((order.final_payable ?? order.total_amount) || 0).toLocaleString('fa-IR')} تومان</strong></div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-700 text-xs">
              <select
                value={order.status}
                onChange={e => updateOrderStatus(order.id, e.target.value as UserOrder['status'])}
                className="text-[11px] font-bold px-2.5 py-1 rounded-full border bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white"
              >
                <option value="pending">در انتظار پرداخت</option>
                <option value="processing">در انتظار تایید</option>
                <option value="preparing">آماده‌سازی</option>
                <option value="shipping">ارسال شده</option>
                <option value="delivered">تحویل شده</option>
                <option value="cancelled">لغو شده</option>
              </select>

              <button
                onClick={() => handleOpenDetail(order)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-600 text-white font-bold"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>مشاهده فاکتور</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {filteredOrders.length === 0 && (
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-12 text-center border border-slate-200 dark:border-slate-700">
          <ShoppingBag className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">
            سفارشی با این مشخصات یافت نشد
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            شماره سفارش یا نام مشتری دیگری را جستجو فرمایید.
          </p>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirmId !== null && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-4 border border-slate-200 dark:border-slate-700 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                حذف سفارش
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                آیا از حذف این سفارش مطمئن هستید؟
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-2.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-bold transition"
              >
                انصراف
              </button>
              <button
                id="confirm-delete-order-btn"
                onClick={() => {
                  deleteOrder(deleteConfirmId);
                  setDeleteConfirmId(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-lg shadow-rose-600/20"
              >
                حذف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order Detail Modal */}
      <AdminOrderDetailModal
        order={selectedOrder}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedOrder(null);
        }}
      />

    </div>
  );
};
