import React, { useState } from 'react';
import { 
  X, 
  ShoppingBag, 
  User, 
  MapPin, 
  CreditCard, 
  Truck, 
  CheckCircle2, 
  Clock, 
  Printer, 
  FileText, 
  Sparkles,
  Save
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { UserOrder } from '../../types';

interface AdminOrderDetailModalProps {
  order: UserOrder | null;
  isOpen: boolean;
  onClose: () => void;
}

export const AdminOrderDetailModal: React.FC<AdminOrderDetailModalProps> = ({ order, isOpen, onClose }) => {
  const { updateOrderStatus, showToast } = useApp();

  const [selectedStatus, setSelectedStatus] = useState<UserOrder['status']>(order?.status || 'pending');
  const [trackingCode, setTrackingCode] = useState<string>(order?.tracking_code || '');

  if (!isOpen || !order) return null;

  const handleUpdate = () => {
    updateOrderStatus(order.id, selectedStatus, trackingCode);
    onClose();
  };

  const handlePrint = () => {
    window.print();
  };

  const statusOptions: { value: UserOrder['status']; label: string }[] = [
    { value: 'pending', label: 'در انتظار پرداخت' },
    { value: 'processing', label: 'در انتظار تایید' },
    { value: 'preparing', label: 'در حال آماده‌سازی در انبار' },
    { value: 'shipping', label: 'تحویل به پست / ارسال شده' },
    { value: 'delivered', label: 'تحویل داده شده به مشتری' },
    { value: 'cancelled', label: 'لغو شده' }
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 print:p-0 print:bg-white" dir="rtl">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-3xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[92vh] print:max-h-none print:border-none print:shadow-none">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-850/50 shrink-0 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/10 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300 flex items-center justify-center font-bold">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  جزئیات سفارش {order.order_number}
                </h2>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300 font-bold">
                  {order.created_at || order.date}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                بررسی فاکتور، تغییر وضعیت سفارش و ثبت کد رهگیری پستی
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="چاپ فاکتور رسمی"
            >
              <Printer className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Status & Tracking Code Controller Bar (Admin Only) */}
          <div className="p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/50 space-y-3 print:hidden">
            <div className="text-xs font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>مدیریت وضعیت و ارسال سفارش</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  تغییر وضعیت سفارش:
                </label>
                <select
                  value={selectedStatus}
                  onChange={e => setSelectedStatus(e.target.value as UserOrder['status'])}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                >
                  {statusOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  کد رهگیری پستی / بارنامه:
                </label>
                <input
                  type="text"
                  value={trackingCode}
                  onChange={e => setTrackingCode(e.target.value)}
                  placeholder="مثال: 12345678901234567890"
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  dir="ltr"
                />
              </div>
            </div>
          </div>

          {/* Customer & Shipping Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Customer Box */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 pb-2 border-b border-slate-200 dark:border-slate-700">
                <User className="w-4 h-4 text-blue-500" />
                <span>اطلاعات خریدار</span>
              </div>
              <div className="text-xs space-y-1 text-slate-600 dark:text-slate-300">
                <div>نام: <strong className="text-slate-900 dark:text-white">{order.shipping_address?.full_name || order.recipient_name || order.customer_name || 'کاربر نوین‌نت'}</strong></div>
                <div>تلفن همراه: <strong className="text-slate-900 dark:text-white font-mono">{order.shipping_address?.phone || order.recipient_phone || order.customer_phone || '---'}</strong></div>
                <div>استان و شهر: <span className="text-slate-900 dark:text-white font-semibold">{order.shipping_address?.province || ''} {order.shipping_address?.city ? `- ${order.shipping_address?.city}` : ''}</span></div>
              </div>
            </div>

            {/* Shipping & Payment Box */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 pb-2 border-b border-slate-200 dark:border-slate-700">
                <MapPin className="w-4 h-4 text-blue-500" />
                <span>آدرس و شیوه ارسال</span>
              </div>
              <div className="text-xs space-y-1 text-slate-600 dark:text-slate-300">
                <div>آدرس کامل: <span className="text-slate-900 dark:text-white leading-relaxed">{order.shipping_address?.address}</span></div>
                <div>کد پستی: <strong className="text-slate-900 dark:text-white font-mono">{order.shipping_address?.postal_code || '---'}</strong></div>
                <div>روش پرداخت: <span className="font-bold text-emerald-600 dark:text-emerald-400">{order.payment_method === 'wallet' ? 'کیف پول کاربری' : 'درگاه پرداخت شاپرک'}</span></div>
              </div>
            </div>

          </div>

          {/* Ordered Items Table */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              اقلام سفارش ({order.items.length} قلم کالا)
            </div>

            <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-500 font-bold">
                  <tr>
                    <th className="py-2.5 px-3">کالا</th>
                    <th className="py-2.5 px-3 text-center">تعداد</th>
                    <th className="py-2.5 px-3">قیمت واحد</th>
                    <th className="py-2.5 px-3">جمع کل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {order.items.map((item, idx) => (
                    <tr key={`${item.product_id}-${item.variant_id ?? ''}-${idx}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-750/30">
                      <td className="py-3 px-3 font-semibold text-slate-900 dark:text-white">
                        {item.name || item.product_name}
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                        {item.quantity || 1} عدد
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-300">
                        {(item.unit_price || 0).toLocaleString('fa-IR')} تومان
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-white">
                        {(item.total_price || (item.unit_price || 0) * (item.quantity || 1)).toLocaleString('fa-IR')} تومان
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pricing Summary */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>جمع مبلغ کالاها:</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">{(order.total_amount || 0).toLocaleString('fa-IR')} تومان</span>
            </div>
            {Boolean(order.discount_amount && order.discount_amount > 0) && (
              <div className="flex justify-between text-rose-600">
                <span>تخفیف اعمال شده:</span>
                <span className="font-mono font-bold">-{(order.discount_amount || 0).toLocaleString('fa-IR')} تومان</span>
              </div>
            )}
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>هزینه بسته‌بندی و ارسال:</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">{(order.shipping_cost || 0).toLocaleString('fa-IR')} تومان</span>
            </div>
            <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between text-sm font-black text-slate-900 dark:text-white">
              <span>مبلغ نهایی پرداخت شده:</span>
              <span className="font-mono text-blue-600 dark:text-blue-400">{(order.final_payable ?? order.total_amount ?? 0).toLocaleString('fa-IR')} تومان</span>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-850/50 shrink-0 print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 text-xs font-bold transition"
          >
            بستن پنجره
          </button>

          <button
            id="save-order-status-btn"
            type="button"
            onClick={handleUpdate}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-blue-600/30 transition active:scale-95"
          >
            <Save className="w-4 h-4" />
            <span>ذخیره تغییرات وضعیت سفارش</span>
          </button>
        </div>

      </div>
    </div>
  );
};
