import React, { useState } from 'react';
import { Package, Layers, ChevronDown, ChevronUp, Lock, Unlock, Sparkles } from 'lucide-react';
import type { DemoCategory, ProductFormState, ProductType } from './types';
import { slugify } from './utils';

interface Props {
  form: ProductFormState;
  categories: DemoCategory[];
  suggestedSku: string;
  onChangeType: (type: ProductType) => void;
  updateForm: <K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) => void;
}

export const ProductInfoSection: React.FC<Props> = ({
  form,
  categories,
  suggestedSku,
  onChangeType,
  updateForm,
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [skuCustomized, setSkuCustomized] = useState(Boolean(form.sku && form.sku !== suggestedSku));

  return (
    <div className="product-panel-body">
      {/* 1. نوع محصول (ساده یا دارای تنوع) */}
      <div className="product-type-segmented">
        <button
          type="button"
          className={`product-type-btn ${form.productType === 'simple' ? 'active' : ''}`}
          onClick={() => onChangeType('simple')}
        >
          <span className="product-type-icon">
            <Package size={17} />
          </span>
          <div>
            <b>محصول ساده (تک‌قیمتی)</b>
            <small>کالاهایی با یک قیمت و موجودی مشخص (بدون سایز یا رنگ‌بندی)</small>
          </div>
        </button>

        <button
          type="button"
          className={`product-type-btn ${form.productType === 'variable' ? 'active' : ''}`}
          onClick={() => onChangeType('variable')}
        >
          <span className="product-type-icon">
            <Layers size={17} />
          </span>
          <div>
            <b>محصول دارای تنوع (چندمدلی)</b>
            <small>کالاهایی با ویژگی‌های گوناگون مانند رنگ، حافظه، سایز و گارانتی</small>
          </div>
        </button>
      </div>

      {/* 2. فرم اطلاعات ضروری */}
      <div className="product-form-grid">
        {/* نام محصول */}
        <div className="admin-field full-span">
          <label className="admin-field-label">
            <span>نام محصول <b>*</b></span>
          </label>
          <input
            type="text"
            className="admin-input font-medium"
            placeholder="مثال: گوشی موبایل سامسونگ مدل Galaxy S24 Ultra"
            value={form.name ?? ''}
            onChange={(e) => {
              const val = e.target.value;
              updateForm('name', val);
              if (!form.slug || form.slug === slugify(form.name)) {
                updateForm('slug', slugify(val));
              }
            }}
          />
        </div>

        {/* دسته‌بندی */}
        <div className="admin-field">
          <label className="admin-field-label">
            <span>دسته‌بندی <b>*</b></span>
          </label>
          <select
            className="admin-select"
            value={form.category ?? ''}
            onChange={(e) => {
              const selectedCat = categories.find((c) => c.name === e.target.value);
              updateForm('category', e.target.value);
              updateForm('categoryId', selectedCat?.id);
            }}
          >
            <option value="" disabled>انتخاب دسته اصلی</option>
            {categories.map((cat) => (
              <option key={`cat-${cat.id}-${cat.slug || cat.name}`} value={cat.name}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* برند */}
        <div className="admin-field">
          <label className="admin-field-label">
            <span>برند محصول <small>(اختیاری)</small></span>
          </label>
          <input
            type="text"
            className="admin-input"
            placeholder="مثال: سامسونگ، اپل، شیائومی، ایسوس..."
            value={form.brand || ''}
            onChange={(e) => updateForm('brand', e.target.value)}
          />
        </div>

        {/* توضیح کوتاه */}
        <div className="admin-field full-span">
          <label className="admin-field-label">
            <span>توضیح کوتاه یا معرفی سریع <small>(اختیاری)</small></span>
          </label>
          <textarea
            className="admin-textarea"
            rows={3}
            placeholder="نکات کلیدی یا خلاصه ویژگی‌های کالا که در بالای صفحه محصول نمایش داده می‌شود..."
            value={form.shortDescription || ''}
            onChange={(e) => updateForm('shortDescription', e.target.value)}
          />
        </div>

        {/* وضعیت فعال/غیرفعال کالا */}
        <div className="admin-field full-span">
          <label className="checkbox-label" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => updateForm('active', e.target.checked)}
              style={{ width: '16px', height: '16px', accentColor: '#2563eb' }}
            />
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
              کالا فعال و در فروشگاه قابل مشاهده و خرید باشد
            </span>
          </label>
        </div>
      </div>

      {/* 3. تنظیمات پیشرفته (اختیاری و جمع‌شده) */}
      <div style={{ borderTop: '1px solid #edf2f7', paddingTop: '12px' }}>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: 'none',
            border: 'none',
            color: '#64748b',
            fontSize: '11px',
            fontWeight: 700,
            cursor: 'pointer',
            padding: '4px 0',
          }}
        >
          {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          <span>تنظیمات پیشرفته (کد انبارداری SKU، آدرس Slug، گارانتی)</span>
        </button>

        {showAdvanced && (
          <div className="product-form-grid" style={{ marginTop: '12px', padding: '14px', background: '#f8fafc', borderRadius: '7px', border: '1px solid #e2e8f0' }}>
            {/* کد انبارداری (SKU) */}
            <div className="admin-field">
              <label className="admin-field-label">
                <span>کد انبارداری کالا (SKU)</span>
                <button
                  type="button"
                  onClick={() => setSkuCustomized(!skuCustomized)}
                  style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '9px', display: 'flex', alignItems: 'center', gap: '2px', cursor: 'pointer' }}
                >
                  {skuCustomized ? <Unlock size={11} /> : <Lock size={11} />}
                  {skuCustomized ? 'شخصی‌سازی شده' : 'تولید خودکار'}
                </button>
              </label>
              <input
                type="text"
                className="admin-input"
                style={{ direction: 'ltr' }}
                placeholder={suggestedSku}
                value={form.sku || (skuCustomized ? '' : suggestedSku)}
                disabled={!skuCustomized}
                onChange={(e) => updateForm('sku', e.target.value.toUpperCase())}
              />
            </div>

            {/* نامک آدرس وب (Slug) */}
            <div className="admin-field">
              <label className="admin-field-label">
                <span>نامک آدرس وب (Slug سئو)</span>
              </label>
              <input
                type="text"
                className="admin-input"
                style={{ direction: 'ltr' }}
                placeholder="url-slug"
                value={form.slug || slugify(form.name)}
                onChange={(e) => updateForm('slug', slugify(e.target.value))}
              />
            </div>

            {/* گارانتی کالا */}
            <div className="admin-field">
              <label className="admin-field-label">
                <span>گارانتی کالا</span>
              </label>
              <input
                type="text"
                className="admin-input"
                placeholder="مثال: ۱۸ ماه گارانتی شرکتی"
                value={form.warranty || ''}
                onChange={(e) => updateForm('warranty', e.target.value)}
              />
            </div>

            {/* محصول برگزیده / ویژه */}
            <div className="admin-field" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', marginTop: '18px' }}>
              <label className="checkbox-label" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.featured}
                  onChange={(e) => updateForm('featured', e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: '#d97706' }}
                />
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#334155', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Sparkles size={13} color="#d97706" />
                  نمایش در ویترین کالاهای ویژه (Featured)
                </span>
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
