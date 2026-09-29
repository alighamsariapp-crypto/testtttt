import React from 'react';
import { X, CheckCircle2 } from 'lucide-react';
import type { ProductFormState } from './types';
import { formatMoney } from './utils';

interface Props {
  form: ProductFormState;
  onClose: () => void;
}

export const ProductPreviewModal: React.FC<Props> = ({ form, onClose }) => {
  const isVariable = form.productType === 'variable';
  const activeVariants = form.variants.filter((v) => v.is_active !== false);
  const variantPrices = activeVariants.map((v) => v.price || 0).filter((p) => p > 0);
  const minPrice = variantPrices.length ? Math.min(...variantPrices) : form.price;
  const maxPrice = variantPrices.length ? Math.max(...variantPrices) : form.price;

  const displayPrice = isVariable && variantPrices.length > 0
    ? (minPrice === maxPrice ? formatMoney(minPrice) : `${formatMoney(minPrice)} تا ${formatMoney(maxPrice)}`)
    : formatMoney(form.price);

  const hasDiscount = !isVariable && form.discountPercent > 0;

  return (
    <div className="preview-modal-backdrop" onClick={onClose}>
      <div className="preview-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="preview-modal-header">
          <b>پیش‌نمایش کارت کالا در فروشگاه</b>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
        </div>

        <div className="preview-modal-body">
          <div className="preview-card-item">
            {form.image || form.gallery[0] ? (
              <img
                src={form.image || form.gallery[0]}
                alt={form.name}
                className="preview-card-img"
              />
            ) : (
              <div
                style={{
                  width: '100%',
                  aspectRatio: '1',
                  background: '#f1f5f9',
                  display: 'grid',
                  placeItems: 'center',
                  color: '#94a3b8',
                  fontSize: '11px',
                }}
              >
                بدون تصویر
              </div>
            )}

            <div className="preview-card-details">
              <small>{form.category || 'دسته‌بندی نشده'}</small>
              <h4>{form.name || 'نام محصول'}</h4>

              {hasDiscount && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ textDecoration: 'line-through', color: '#94a3b8', fontSize: '10px' }}>
                    {formatMoney(form.basePrice)}
                  </span>
                  <span
                    style={{
                      background: '#fee2e2',
                      color: '#ef4444',
                      padding: '1px 5px',
                      borderRadius: '3px',
                      fontSize: '9px',
                      fontWeight: 700,
                    }}
                  >
                    {form.discountPercent}٪ تخفیف
                  </span>
                </div>
              )}

              <div className="preview-card-price">
                <b>{displayPrice}</b>
                {form.active ? (
                  <em style={{ color: '#16a34a' }}>موجود در انبار</em>
                ) : (
                  <em style={{ color: '#94a3b8' }}>ناموجود / غیرفعال</em>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
