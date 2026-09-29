import React, { useState } from 'react';
import { 
  Tag, 
  Plus, 
  Trash2, 
  Check, 
  X, 
  Percent, 
  Calendar, 
  DollarSign, 
  Copy, 
  CheckCircle2, 
  AlertTriangle 
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { DiscountCoupon } from '../../types';

export const AdminDiscountsTab: React.FC = () => {
  const { discountCoupons, addDiscountCoupon, deleteDiscountCoupon, toggleDiscountCoupon, showToast } = useApp();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const [formData, setFormData] = useState<Partial<DiscountCoupon>>({
    code: '',
    title: '',
    discount_type: 'percentage',
    discount_value: 10,
    min_order_amount: 500000,
    max_discount_amount: 1000000,
    usage_limit: 100,
    used_count: 0,
    expiry_date: '۱۴۰۴/۱۲/۲۹',
    is_active: true
  });

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    showToast('کد تخفیف کپی شد', 'info');
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleCreateCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code?.trim() || !formData.title?.trim()) return;

    addDiscountCoupon({
      code: formData.code.trim().toUpperCase(),
      title: formData.title.trim(),
      discount_type: formData.discount_type || 'percentage',
      discount_value: Number(formData.discount_value || 10),
      min_order_amount: Number(formData.min_order_amount || 0),
      max_discount_amount: formData.max_discount_amount ? Number(formData.max_discount_amount) : undefined,
      usage_limit: Number(formData.usage_limit || 50),
      used_count: 0,
      expiry_date: formData.expiry_date || '۱۴۰۴/۱۲/۲۹',
      is_active: formData.is_active ?? true
    });

    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300" dir="rtl">
      
      {/* Header */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-slate-700/80 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
              مدیریت کدهای تخفیف و جشنواره‌های فروش
            </h1>
            <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              {discountCoupons.length} کوپن
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            تعریف کوپن‌های تخفیف درصدی و مقداری، سقف تخفیف، محدودیت دفعات مصرف و تاریخ انقضا.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-blue-600/30 transition active:scale-95 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>ایجاد کد تخفیف جدید</span>
        </button>
      </div>

      {/* Coupons Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {discountCoupons.map(coupon => (
          <div 
            key={coupon.id}
            className={`bg-white dark:bg-slate-800/90 rounded-2xl p-5 border shadow-sm transition space-y-4 ${
              coupon.is_active 
                ? 'border-slate-200 dark:border-slate-700' 
                : 'border-slate-200/50 dark:border-slate-800 opacity-60'
            }`}
          >
            {/* Header badge & status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-300 border border-purple-200 dark:border-purple-800 flex items-center justify-center font-bold">
                  <Percent className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                    {coupon.title}
                  </h3>
                  <span className="text-[11px] text-slate-400 font-mono">
                    تا {coupon.expiry_date}
                  </span>
                </div>
              </div>

              <button
                onClick={() => toggleDiscountCoupon(coupon.id)}
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition ${
                  coupon.is_active 
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-300' 
                    : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-300'
                }`}
              >
                {coupon.is_active ? 'فعال' : 'غیرفعال'}
              </button>
            </div>

            {/* Code Box with Copy */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700">
              <span className="font-mono font-black text-sm tracking-wider text-blue-600 dark:text-blue-400">
                {coupon.code}
              </span>
              <button
                onClick={() => handleCopy(coupon.code)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
                title="کپی کد"
              >
                {copiedCode === coupon.code ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>

            {/* Details */}
            <div className="text-xs space-y-1.5 text-slate-600 dark:text-slate-400">
              <div className="flex justify-between">
                <span>میزان تخفیف:</span>
                <strong className="font-mono text-slate-900 dark:text-white">
                  {(coupon.discount_type || coupon.type) === 'percentage' 
                    ? `${coupon.discount_value ?? coupon.value ?? 0}٪` 
                    : `${(coupon.discount_value ?? coupon.value ?? 0).toLocaleString('fa-IR')} تومان`}
                </strong>
              </div>
              <div className="flex justify-between">
                <span>حداقل خرید:</span>
                <span className="font-mono">{(coupon.min_order_amount ?? 0).toLocaleString('fa-IR')} تومان</span>
              </div>
              <div className="flex justify-between">
                <span>تعداد دفعات مصرف:</span>
                <span className="font-mono">{coupon.used_count ?? coupon.usage_count ?? 0} از {coupon.usage_limit ?? 0} بار</span>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-700 flex items-center justify-end">
              <button
                onClick={() => deleteDiscountCoupon(coupon.id)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition text-xs flex items-center gap-1 font-bold"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>حذف کد</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Create Coupon Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 border border-slate-200 dark:border-slate-700 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                تعریف کوپن تخفیف جدید
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCoupon} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  کد تخفیف (انگلیسی و بزرگ) *
                </label>
                <input
                  type="text"
                  required
                  value={formData.code || ''}
                  onChange={e => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                  placeholder="مثال: NOOVIN15"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  عنوان جشنواره / مناسبت *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title || ''}
                  onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="مثال: تخفیف ویژه تجهیزات روتر میکروتیک"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    نوع تخفیف
                  </label>
                  <select
                    value={formData.discount_type}
                    onChange={e => setFormData(prev => ({ ...prev, discount_type: e.target.value as 'percentage' | 'fixed_amount' }))}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                  >
                    <option value="percentage">درصدی (%)</option>
                    <option value="fixed_amount">مبلغ ثابت (تومان)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    مقدار تخفیف
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.discount_value || ''}
                    onChange={e => setFormData(prev => ({ ...prev, discount_value: Number(e.target.value) }))}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-mono text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    حداقل مبلغ خرید (تومان)
                  </label>
                  <input
                    type="number"
                    step="50000"
                    value={formData.min_order_amount || 0}
                    onChange={e => setFormData(prev => ({ ...prev, min_order_amount: Number(e.target.value) }))}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-mono text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    سقف استفاده (تعداد)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.usage_limit || 100}
                    onChange={e => setFormData(prev => ({ ...prev, usage_limit: Number(e.target.value) }))}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-mono text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 font-bold transition"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition shadow-lg shadow-blue-600/20"
                >
                  ایجاد کوپن
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
