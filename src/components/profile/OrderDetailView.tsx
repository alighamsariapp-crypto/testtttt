import React, { useState } from 'react';
import { 
  ArrowRight, 
  ChevronLeft, 
  Check, 
  Truck, 
  Home, 
  Clock, 
  RotateCcw, 
  Printer, 
  Copy, 
  MapPin, 
  Phone, 
  User, 
  Package, 
  Download,
  CheckCircle2,
  FileText,
  CreditCard,
  Building,
  ShieldCheck
} from 'lucide-react';
import { UserOrder } from '../../types';
import { useApp } from '../../context/AppContext';
import { OfficialInvoiceModal } from './OfficialInvoiceModal';

interface OrderDetailViewProps {
  order: UserOrder;
  onBack: () => void;
}

export const OrderDetailView: React.FC<OrderDetailViewProps> = ({ order, onBack }) => {
  const { reorderItems, showToast } = useApp();
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);

  const handleCopyTrackingCode = () => {
    const code = order.tracking_code || 'IR-9876543210';
    navigator.clipboard.writeText(code);
    showToast('کد رهگیری مرسوله با موفقیت کپی شد', 'success');
  };

  // Determine current active step (1: registered, 2: processing, 3: shipped, 4: delivered)
  const currentStep = order.current_step || (
    order.status === 'delivered' ? 4 :
    order.status === 'shipping' ? 3 :
    order.status === 'cancelled' ? 1 : 2
  );

  const itemsTotal = order.items.reduce((acc, curr) => acc + (curr.unit_price * curr.quantity), 0);

  return (
    <>
      <div className="space-y-6">
        
        {/* Top Header & Breadcrumb */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 sm:px-3 sm:py-2 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 shrink-0"
            >
              <ArrowRight className="w-4 h-4" />
              <span>بازگشت به سفارش‌ها</span>
            </button>

            <div className="border-r border-slate-200 pr-3">
              <h1 className="text-base sm:text-lg font-black text-slate-900">جزئیات سفارش</h1>
              <p className="text-xs text-slate-500 font-mono mt-0.5">شناسه سفارش: {order.order_number}</p>
            </div>
          </div>

          {/* Top Action Buttons (Desktop) */}
          <div className="hidden sm:flex items-center gap-2.5">
            <button
              onClick={() => setIsInvoiceOpen(true)}
              className="px-4 py-2.5 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-2"
            >
              <FileText className="w-4 h-4 text-blue-600" />
              <span>مشاهده فاکتور رسمی</span>
            </button>

            <button
              onClick={() => reorderItems(order)}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-bold transition shadow-sm shadow-blue-500/20 flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              <span>خرید مجدد</span>
            </button>
          </div>
        </div>

        {/* Main Grid: Content (Order Status + Items) + Sidebar (Shipping + Financials) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Right / Main Content Column (7 cols on lg) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Order Progress Stepper Card (Matches Image 03 & 04) */}
            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black text-slate-900">وضعیت سفارش</h2>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  order.status === 'delivered' ? 'bg-emerald-100 text-emerald-800' :
                  order.status === 'cancelled' ? 'bg-rose-100 text-rose-800' :
                  'bg-blue-100 text-blue-800'
                }`}>
                  {order.status_label || (order.status === 'delivered' ? 'تحویل شده' : 'در حال پردازش')}
                </span>
              </div>

              {/* Stepper Timeline */}
              <div className="relative pt-2 pb-2">
                {/* Background Line */}
                <div className="absolute top-1/2 right-6 left-6 -translate-y-1/2 h-1 bg-slate-100 z-0" />
                
                {/* Active Progress Line */}
                <div 
                  className="absolute top-1/2 right-6 -translate-y-1/2 h-1 bg-blue-600 z-0 transition-all duration-500"
                  style={{ 
                    width: currentStep === 1 ? '15%' : currentStep === 2 ? '45%' : currentStep === 3 ? '75%' : '90%' 
                  }}
                />

                {/* Step Points */}
                <div className="relative z-10 flex items-center justify-between text-center">
                  {/* Step 1: Registered */}
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
                      <Check className="w-5 h-5" />
                    </div>
                    <span className="text-[11px] font-bold text-slate-800">ثبت سفارش</span>
                  </div>

                  {/* Step 2: Processing */}
                  <div className="flex flex-col items-center gap-2">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                      currentStep >= 2 
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' 
                        : 'bg-white border-2 border-slate-200 text-slate-400'
                    }`}>
                      {currentStep >= 2 ? <Check className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                    </div>
                    <span className={`text-[11px] font-bold ${currentStep >= 2 ? 'text-blue-600' : 'text-slate-400'}`}>
                      در حال پردازش
                    </span>
                  </div>

                  {/* Step 3: Shipped */}
                  <div className="flex flex-col items-center gap-2">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                      currentStep >= 3 
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' 
                        : 'bg-white border-2 border-slate-200 text-slate-400'
                    }`}>
                      <Truck className="w-5 h-5" />
                    </div>
                    <span className={`text-[11px] font-bold ${currentStep >= 3 ? 'text-blue-600' : 'text-slate-400'}`}>
                      ارسال شده
                    </span>
                  </div>

                  {/* Step 4: Delivered */}
                  <div className="flex flex-col items-center gap-2">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                      currentStep >= 4 
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20' 
                        : 'bg-white border-2 border-slate-200 text-slate-400'
                    }`}>
                      <Home className="w-5 h-5" />
                    </div>
                    <span className={`text-[11px] font-bold ${currentStep >= 4 ? 'text-emerald-700' : 'text-slate-400'}`}>
                      تحویل شده
                    </span>
                  </div>
                </div>
              </div>

              {/* Estimated Delivery Note */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-slate-600">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <span>زمان تخمینی تحویل مرسوله:</span>
                </div>
                <span className="font-bold text-slate-900 font-sans">{order.estimated_delivery || '۲ تا ۳ روز کاری'}</span>
              </div>
            </div>

            {/* Ordered Items List (Matches Image 03 & 04) */}
            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <span>اقلام سفارش</span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-bold">
                    {order.items.length} کالا
                  </span>
                </h2>
              </div>

              <div className="divide-y divide-slate-100">
                {order.items.map((item, idx) => (
                  <div key={`order-item-${item.product_id}-${item.variant_id ?? ''}-${idx}`} className="py-4 first:pt-0 last:pb-0 flex items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      {item.image_url ? (
                        <img 
                          src={item.image_url} 
                          alt={item.product_name} 
                          className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover bg-slate-50 p-1.5 border border-slate-200 shrink-0"
                        />
                      ) : (
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                          <Package className="w-8 h-8" />
                        </div>
                      )}

                      <div className="space-y-1">
                        <h3 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">{item.product_name}</h3>
                        {item.variant_name && (
                          <p className="text-xs text-slate-500">مدل / رنگ: {item.variant_name}</p>
                        )}
                        <div className="flex items-center gap-3 text-xs text-slate-400">
                          <span>تعداد: <strong className="text-slate-700 font-sans">{item.quantity}</strong></span>
                          <span>•</span>
                          <span>قیمت واحد: <strong className="text-slate-700 font-sans">{item.unit_price.toLocaleString('fa-IR')} ت</strong></span>
                        </div>
                      </div>
                    </div>

                    <div className="text-left shrink-0">
                      <span className="text-xs sm:text-sm font-black font-sans text-slate-900 block">
                        {(item.unit_price * item.quantity).toLocaleString('fa-IR')} تومان
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Left / Sidebar Column (5 cols on lg) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Shipping & Recipient Card (Matches Image 03 & 04) */}
            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
              <h2 className="text-sm font-black text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
                <Truck className="w-4 h-4 text-blue-600" />
                <span>اطلاعات ارسال</span>
              </h2>

              <div className="space-y-3.5 text-xs">
                <div className="flex items-center justify-between text-slate-500">
                  <span>گیرنده:</span>
                  <strong className="text-slate-900">{order.recipient_name || 'علی محمدی'}</strong>
                </div>

                <div className="flex items-center justify-between text-slate-500">
                  <span>شماره تماس:</span>
                  <strong className="text-slate-900 font-mono" dir="ltr">{order.recipient_phone || '0912 345 6789'}</strong>
                </div>

                <div className="space-y-1 text-slate-500">
                  <span>آدرس تحویل:</span>
                  <p className="text-slate-800 font-medium leading-relaxed bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    {typeof order.shipping_address === 'string'
                      ? order.shipping_address
                      : (order.shipping_address?.address_line || order.shipping_address?.address || [order.shipping_address?.province, order.shipping_address?.city].filter(Boolean).join('، ') || 'تهران، ونک، خیابان ملاصدرا، پلاک ۱۲، واحد ۴، شرکت نوین نت')}
                  </p>
                </div>

                {/* Postal Tracking Code Box with Copy */}
                <div className="bg-blue-50/70 border border-blue-100 rounded-2xl p-4 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[11px] text-blue-700 font-bold">کد رهگیری پستی</span>
                    <div className="font-mono font-black text-sm text-blue-950">
                      {order.tracking_code || 'IR-9876543210'}
                    </div>
                  </div>

                  <button
                    onClick={handleCopyTrackingCode}
                    className="p-2 hover:bg-blue-100 text-blue-700 rounded-xl transition flex items-center gap-1 text-xs font-bold"
                    title="کپی کد رهگیری"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Financial Summary Card (Matches Image 03 & 04) */}
            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
              <h2 className="text-sm font-black text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
                <FileText className="w-4 h-4 text-blue-600" />
                <span>خلاصه مالی</span>
              </h2>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between text-slate-500">
                  <span>جمع اقلام ({order.items.length} کالا)</span>
                  <span className="font-bold text-slate-800 font-sans">{itemsTotal.toLocaleString('fa-IR')} تومان</span>
                </div>

                <div className="flex items-center justify-between text-slate-500">
                  <span>هزینه ارسال</span>
                  <span className="font-bold text-emerald-600">رایگان</span>
                </div>

                <div className="flex items-center justify-between text-slate-500">
                  <span>تخفیف (کد سازمانی)</span>
                  <span className="font-bold text-rose-600 font-sans">۵۰۰,۰۰۰- تومان</span>
                </div>

                <div className="flex items-center justify-between text-slate-500">
                  <span>روش پرداخت</span>
                  <span className="font-bold text-slate-800">{order.payment_method || 'درگاه پرداخت آنلاین'}</span>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-sm font-black text-slate-900">مبلغ کل</span>
                  <div className="text-base sm:text-lg font-black text-blue-600 font-sans">
                    {order.total_amount.toLocaleString('fa-IR')} <span className="text-xs font-bold text-slate-600">تومان</span>
                  </div>
                </div>
              </div>
            </div>

          </div>

        </div>

        {/* Sticky Mobile Actions Bar (Matches Image 04) */}
        <div className="sm:hidden fixed bottom-16 left-0 right-0 p-4 bg-white/95 backdrop-blur-md border-t border-slate-200 z-30 flex items-center gap-3">
          <button
            onClick={() => setIsInvoiceOpen(true)}
            className="flex-1 py-3 bg-blue-600 text-white rounded-2xl font-bold text-xs shadow-md shadow-blue-500/20 flex items-center justify-center gap-2"
          >
            <FileText className="w-4 h-4" />
            <span>مشاهده فاکتور</span>
          </button>

          <button
            onClick={() => reorderItems(order)}
            className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-2xl font-bold text-xs transition flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            <span>خرید مجدد</span>
          </button>
        </div>

      </div>

      {/* Official Invoice Modal */}
      <OfficialInvoiceModal
        isOpen={isInvoiceOpen}
        order={order}
        onClose={() => setIsInvoiceOpen(false)}
      />
    </>
  );
};
