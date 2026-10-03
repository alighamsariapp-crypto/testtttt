import React from 'react';
import { ArrowLeft, Layers, CheckCircle2, ShieldAlert } from 'lucide-react';
import type { ProductFormState } from './types';
import { calculateFinalPrice, formatMoney, parseNumber } from './utils';

interface Props {
  form: ProductFormState;
  updateForm: <K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) => void;
  onGoToVariants: () => void;
}

export const ProductPricingSection: React.FC<Props> = ({
  form,
  updateForm,
  onGoToVariants,
}) => {
  const isSimple = form.productType === 'simple';
  const basePrice = form.basePrice || 0;
  const discountPct = form.discountPercent || 0;
  const finalPrice = calculateFinalPrice(basePrice, discountPct);
  const discountAmount = discountPct > 0 ? basePrice - finalPrice : 0;

  const handleBasePriceChange = (valStr: string) => {
    const num = parseNumber(valStr);
    updateForm('basePrice', num);
    const newFinal = calculateFinalPrice(num, form.discountPercent || 0);
    updateForm('price', newFinal);
  };

  const handleDiscountChange = (valStr: string) => {
    if (valStr.trim() === '') {
      updateForm('discountPercent', 0);
      const newFinal = calculateFinalPrice(form.basePrice || 0, 0);
      updateForm('price', newFinal);
      return;
    }
    let pct = parseNumber(valStr);
    if (pct < 0) pct = 0;
    if (pct > 99) pct = 99;
    updateForm('discountPercent', pct);
    const newFinal = calculateFinalPrice(form.basePrice || 0, pct);
    updateForm('price', newFinal);
  };

  // Variable product stats
  const activeVariants = form.variants.filter((v) => v.is_active !== false);
  const variantPrices = activeVariants.map((v) => v.price || 0).filter((p) => p > 0);
  const minPrice = variantPrices.length ? Math.min(...variantPrices) : 0;
  const maxPrice = variantPrices.length ? Math.max(...variantPrices) : 0;
  const totalStock = activeVariants.reduce((sum, v) => sum + (v.stock || 0), 0);

  if (!isSimple) {
    return (
      <div className="product-panel-body">
        <div
          style={{
            padding: '24px',
            border: '1px solid #bfdbfe',
            borderRadius: '8px',
            background: '#eff6ff',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: '#dbeafe',
                color: '#2563eb',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <Layers size={18} />
            </span>
            <div>
              <b style={{ fontSize: '13px', color: '#1e3a8a' }}>
                قیمت‌گذاری در سطح تنوع محصول انجام می‌شود
              </b>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#3b82f6' }}>
                این کالا دارای تنوع (رنگ، سایز، مدل و...) است. قیمت اصلی و درصد تخفیف هر تنوع به صورت مستقل در بخش «تنوع» تنظیم می‌شود.
              </p>
            </div>
          </div>

          {/* خلاصه وضعیت قیمت و موجودی تنوع‌ها */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '10px',
              marginTop: '4px',
              background: '#ffffff',
              padding: '12px 16px',
              borderRadius: '6px',
              border: '1px solid #dbeafe',
            }}
          >
            <div>
              <small style={{ color: '#64748b', fontSize: '10px', display: 'block' }}>تعداد تنوع‌های فعال</small>
              <b style={{ color: '#1e293b', fontSize: '13px' }}>{activeVariants.length.toLocaleString('fa-IR')} مدل</b>
            </div>
            <div>
              <small style={{ color: '#64748b', fontSize: '10px', display: 'block' }}>محدوده قیمت فروش</small>
              <b style={{ color: '#2563eb', fontSize: '13px' }}>
                {minPrice > 0 ? (minPrice === maxPrice ? formatMoney(minPrice) : `${formatMoney(minPrice)} تا ${formatMoney(maxPrice)}`) : 'تنظیم‌نشده'}
              </b>
            </div>
            <div>
              <small style={{ color: '#64748b', fontSize: '10px', display: 'block' }}>مجموع موجودی انبار</small>
              <b style={{ color: totalStock > 0 ? '#15803d' : '#e11d48', fontSize: '13px' }}>
                {totalStock.toLocaleString('fa-IR')} عدد
              </b>
            </div>
          </div>

          <div>
            <button
              type="button"
              onClick={onGoToVariants}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 16px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              رفتن به بخش مدیریت تنوع و قیمت‌ها
              <ArrowLeft size={13} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="product-panel-body">
      <div className="product-form-grid">
        {/* ۱. قیمت اصلی */}
        <div className="admin-field">
          <label className="admin-field-label">
            <span>قیمت اصلی (تومان) <b>*</b></span>
            {basePrice > 0 && <small style={{ color: '#2563eb', fontWeight: 600 }}>{formatMoney(basePrice)}</small>}
          </label>
          <input
            type="number"
            className="admin-input font-bold"
            placeholder="مثال: ۵۰۰۰۰۰۰۰"
            value={form.basePrice || ''}
            onChange={(e) => handleBasePriceChange(e.target.value)}
          />
        </div>

        {/* ۲. درصد تخفیف */}
        <div className="admin-field">
          <label className="admin-field-label">
            <span>درصد تخفیف (%) <small>(اختیاری)</small></span>
          </label>
          <input
            type="number"
            min="0"
            max="99"
            className="admin-input"
            placeholder="0 (بدون تخفیف)"
            value={form.discountPercent || ''}
            onChange={(e) => handleDiscountChange(e.target.value)}
          />
        </div>

        {/* ۳. قیمت نهایی (محاسبه خودکار - غیرقابل ویرایش) */}
        <div className="admin-field full-span">
          <label className="admin-field-label">
            <span>قیمت نهایی برای مشتری (محاسبه خودکار)</span>
          </label>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              border: discountPct > 0 ? '1px solid #86efac' : '1px solid #dfe6ee',
              borderRadius: '7px',
              background: discountPct > 0 ? '#f0fdf4' : '#f8fafc',
            }}
          >
            <div>
              <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>مبلغ پرداختی خریدار:</span>
              <b style={{ fontSize: '16px', color: discountPct > 0 ? '#15803d' : '#1e293b', fontWeight: 800 }}>
                {basePrice > 0 ? formatMoney(finalPrice) : '۰ تومان (لطفاً قیمت اصلی را وارد کنید)'}
              </b>
            </div>

            {discountPct > 0 && basePrice > 0 && (
              <div style={{ textAlign: 'left' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: '#dcfce7',
                    color: '#166534',
                    border: '1px solid #bbf7d0',
                    padding: '3px 8px',
                    borderRadius: '99px',
                    fontSize: '11px',
                    fontWeight: 700,
                  }}
                >
                  <CheckCircle2 size={12} />
                  {discountPct.toLocaleString('fa-IR')}٪ تخفیف
                </span>
                <small style={{ display: 'block', marginTop: '3px', color: '#15803d', fontSize: '10px' }}>
                  سود خریدار: {formatMoney(discountAmount)}
                </small>
              </div>
            )}
          </div>
        </div>

        {/* ۴. موجودی انبار */}
        <div className="admin-field">
          <label className="admin-field-label">
            <span>موجودی در انبار (تعداد) <b>*</b></span>
          </label>
          <input
            type="number"
            min="0"
            className="admin-input"
            placeholder="مثال: ۱۰"
            value={form.stock ?? ''}
            onChange={(e) => updateForm('stock', Math.max(0, parseNumber(e.target.value)))}
          />
        </div>

        {/* ۵. حداقل موجودی جهت هشدار */}
        <div className="admin-field">
          <label className="admin-field-label">
            <span>آستانه هشدار کسری موجودی <small>(اختیاری)</small></span>
          </label>
          <input
            type="number"
            min="0"
            className="admin-input"
            placeholder="مثال: ۳"
            value={form.lowStockThreshold ?? 3}
            onChange={(e) => updateForm('lowStockThreshold', Math.max(0, parseNumber(e.target.value)))}
          />
        </div>
      </div>
    </div>
  );
};
