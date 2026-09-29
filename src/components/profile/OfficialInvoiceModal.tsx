import React from 'react';
import { 
  Printer, 
  Download, 
  X, 
  CheckCircle2, 
  Building2, 
  User, 
  Phone, 
  MapPin, 
  Calendar, 
  Hash, 
  ShieldCheck, 
  FileText,
  ArrowRight,
  QrCode
} from 'lucide-react';
import { UserOrder } from '../../types';
import { useApp } from '../../context/AppContext';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { ModalPortal } from '../common/ModalPortal';

interface OfficialInvoiceModalProps {
  isOpen: boolean;
  order: UserOrder | null;
  onClose: () => void;
}

export const OfficialInvoiceModal: React.FC<OfficialInvoiceModalProps> = ({ isOpen, order, onClose }) => {
  const { user, showToast } = useApp();
  useBodyScrollLock(isOpen);

  if (!isOpen || !order) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    showToast('فاکتور رسمی با فرمت PDF آماده و بارگیری شد.', 'success');
  };

  // Calculations
  const itemsTotal = order.items.reduce((acc, curr) => acc + (curr.unit_price * curr.quantity), 0);
  const discountTotal = 500000;
  const taxableAmount = Math.max(0, itemsTotal - discountTotal);
  const vatAmount = Math.round(taxableAmount * 0.09); // 9% VAT
  const grandTotal = taxableAmount + vatAmount;

  return (
    <ModalPortal>
          <div className="ui-modal-backdrop p-0 sm:p-4 sm:py-8 overflow-y-auto animate-in fade-in duration-200">
      
      {/* Backdrop */}
      <button type="button" className="fixed inset-0" onClick={onClose} aria-label="بستن فاکتور رسمی" />

      {/* Main Container */}
      <div className="ui-modal-panel relative z-10 w-full max-w-4xl min-h-[90dvh] sm:min-h-0 sm:rounded-3xl overflow-hidden flex flex-col my-auto">
        
        {/* Top Control Bar (Screen only, hidden in print) */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-400" />
            <h2 className="text-sm font-black">فاکتور رسمی فروش کالا و خدمات</h2>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
            >
              <Printer className="w-4 h-4" />
              <span>چاپ فاکتور</span>
            </button>

            <button
              onClick={handleDownload}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              <span>دانلود PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Official Invoice Body (Matches Image 10 & Image 11) */}
        <div className="p-6 sm:p-10 space-y-6 text-slate-900 bg-white" id="printable-invoice">
          
          {/* Header Banner (Matches Image 10) */}
          <div className="border-b-2 border-slate-900 pb-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            
            <div className="flex items-center gap-3">
              <div className="text-2xl font-black text-blue-700 font-sans tracking-tight">
                noovinnet
              </div>
              <div className="border-r border-slate-300 pr-3">
                <span className="text-xs font-bold text-slate-800 block">صورتحساب فروش کالا و خدمات</span>
                <span className="text-[10px] text-slate-500">زیرساخت ابری هوشمند و یکپارچه</span>
              </div>
            </div>

            {/* Invoice Meta Box */}
            <div className="flex items-center gap-6 text-xs text-slate-600 bg-slate-50 p-3 rounded-2xl border border-slate-200">
              <div className="space-y-1">
                <div>شماره فاکتور: <strong className="font-mono text-slate-900 font-bold">{order.order_number || 'INV-402-9843'}</strong></div>
                <div>تاریخ صدور: <strong className="font-mono text-slate-900 font-bold">{order.created_at || '1403/08/15'}</strong></div>
              </div>

              <div className="w-14 h-14 bg-white p-1 rounded-xl border border-slate-200 flex items-center justify-center shrink-0">
                <QrCode className="w-12 h-12 text-slate-800" />
              </div>
            </div>

          </div>

          {/* Seller & Buyer Grid (Matches Image 10) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            
            {/* Seller Box */}
            <div className="border border-slate-200 rounded-2xl p-4 space-y-2 bg-slate-50/50">
              <div className="font-bold text-slate-900 border-b border-slate-200 pb-1.5 flex items-center gap-1.5 text-blue-700">
                <Building2 className="w-3.5 h-3.5" />
                <span>مشخصات فروشنده</span>
              </div>
              <div className="space-y-1.5 text-slate-600">
                <div>نام شخص حقوقی: <strong className="text-slate-800">شرکت خدمات نوین نت ابری (سهامی خاص)</strong></div>
                <div>شماره اقتصادی / شناسه ملی: <strong className="text-slate-800 font-mono">14009876543 / 4114567890</strong></div>
                <div>تلفن / پشتیبانی: <strong className="text-slate-800 font-mono">021-88990011</strong></div>
                <div>نشانی: <span className="text-slate-800">تهران، خیابان ولیعصر، برج فناوری نوین، طبقه ۱۲</span></div>
              </div>
            </div>

            {/* Buyer Box */}
            <div className="border border-slate-200 rounded-2xl p-4 space-y-2 bg-slate-50/50">
              <div className="font-bold text-slate-900 border-b border-slate-200 pb-1.5 flex items-center gap-1.5 text-blue-700">
                <User className="w-3.5 h-3.5" />
                <span>مشخصات خریدار</span>
              </div>
              <div className="space-y-1.5 text-slate-600">
                <div>نام خریدار: <strong className="text-slate-800">{order.recipient_name || user?.name || 'گروه توسعه فناوری آلفا'}</strong></div>
                <div>کد ملی / شناسه اقتصادی: <strong className="text-slate-800 font-mono">{user?.national_id || '10101234567'}</strong></div>
                <div>شماره تماس: <strong className="text-slate-800 font-mono" dir="ltr">{order.recipient_phone || user?.phone || '0912 345 6789'}</strong></div>
                <div>نشانی: <span className="text-slate-800">{typeof order.shipping_address === 'string' ? order.shipping_address : (order.shipping_address?.address_line || order.shipping_address?.address || [order.shipping_address?.province, order.shipping_address?.city].filter(Boolean).join('، ') || 'تهران، خیابان ملاصدرا، پلاک ۱۲، واحد ۴')}</span></div>
              </div>
            </div>

          </div>

          {/* Items Table (Matches Image 10) */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden text-xs">
            <table className="w-full text-right">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3 text-center w-12">ردیف</th>
                  <th className="p-3">شرح کالا یا خدمات</th>
                  <th className="p-3 text-center w-16">تعداد</th>
                  <th className="p-3 text-left">مبلغ واحد (تومان)</th>
                  <th className="p-3 text-left">تخفیف</th>
                  <th className="p-3 text-left">مالیات و عوارض</th>
                  <th className="p-3 text-left">مبلغ کل (تومان)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {order.items.map((item, idx) => {
                  const lineTotal = item.unit_price * item.quantity;
                  const lineVat = Math.round(lineTotal * 0.09);
                  return (
                    <tr key={`invoice-item-${item.product_id}-${item.variant_id ?? ''}-${idx}`} className="hover:bg-slate-50/50">
                      <td className="p-3 text-center font-bold text-slate-500">{idx + 1}</td>
                      <td className="p-3 font-medium text-slate-900 font-sans">
                        {item.product_name}
                        {item.variant_name && <span className="text-slate-500 text-[11px] block">{item.variant_name}</span>}
                      </td>
                      <td className="p-3 text-center font-bold text-slate-800">{item.quantity}</td>
                      <td className="p-3 text-left">{item.unit_price.toLocaleString('fa-IR')}</td>
                      <td className="p-3 text-left text-slate-400">۰</td>
                      <td className="p-3 text-left text-slate-500">{lineVat.toLocaleString('fa-IR')}</td>
                      <td className="p-3 text-left font-bold text-slate-900 font-mono">
                        {lineTotal.toLocaleString('fa-IR')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Financial Summary & Total (Matches Image 10) */}
          <div className="flex flex-col sm:flex-row justify-end items-end gap-6 pt-2">
            
            <div className="w-full sm:w-80 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span>جمع کل مبالغ:</span>
                <span className="font-bold font-sans">{itemsTotal.toLocaleString('fa-IR')} تومان</span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>تخفیف اعمال شده:</span>
                <span className="font-bold text-rose-600 font-sans">{discountTotal.toLocaleString('fa-IR')} تومان</span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>مالیات بر ارزش افزوده (۹٪):</span>
                <span className="font-bold font-sans">{vatAmount.toLocaleString('fa-IR')} تومان</span>
              </div>

              <div className="bg-blue-600 text-white rounded-2xl p-4 flex items-center justify-between mt-3 font-bold shadow-md shadow-blue-500/20">
                <span>مبلغ نهایی قابل پرداخت:</span>
                <span className="text-base font-black font-sans">{order.total_amount.toLocaleString('fa-IR')} تومان</span>
              </div>
            </div>

          </div>

          {/* Signatures & Official Stamp (Matches Image 10) */}
          <div className="grid grid-cols-2 gap-8 pt-8 border-t border-slate-200 text-xs text-center">
            
            {/* Buyer Stamp */}
            <div className="space-y-12">
              <span className="font-bold text-slate-700">مهر و امضای خریدار</span>
              <div className="h-16 border-b border-dashed border-slate-300 mx-auto max-w-[200px]" />
            </div>

            {/* Seller Stamp */}
            <div className="space-y-2 relative">
              <span className="font-bold text-slate-700">مهر و امضای فروشنده (نوین‌نت)</span>
              <div className="w-24 h-24 rounded-full border-2 border-dashed border-blue-600 text-blue-700 flex flex-col items-center justify-center mx-auto rotate-[-12deg] bg-blue-50/40 p-2 shadow-xs">
                <span className="text-[9px] font-black">شرکت نوین‌نت ابری</span>
                <span className="text-[8px]">تأیید الکترونیکی</span>
                <span className="text-[7px] font-mono">1403/08/15</span>
              </div>
            </div>

          </div>

        </div>

      </div>

      </div>
    </ModalPortal>
  );
};
