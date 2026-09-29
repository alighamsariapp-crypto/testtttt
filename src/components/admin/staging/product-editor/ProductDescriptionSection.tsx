import React, { useState } from 'react';
import { Plus, Trash2, FileText, ListOrdered } from 'lucide-react';
import type { ProductFormState } from './types';
import { cleanText } from './utils';

interface Props {
  form: ProductFormState;
  updateForm: <K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) => void;
}

export const ProductDescriptionSection: React.FC<Props> = ({ form, updateForm }) => {
  const [newKey, setNewKey] = useState('');
  const [newVal, setNewVal] = useState('');

  const handleAddAttribute = () => {
    const k = cleanText(newKey);
    const v = cleanText(newVal);
    if (!k || !v) return;
    const current = form.attributes || [];
    updateForm('attributes', [...current, { key: k, val: v }]);
    setNewKey('');
    setNewVal('');
  };

  const handleRemoveAttribute = (idx: number) => {
    const current = form.attributes || [];
    updateForm(
      'attributes',
      current.filter((_, i) => i !== idx)
    );
  };

  return (
    <div className="product-panel-body">
      {/* 1. توضیحات کامل کالا */}
      <div className="admin-field">
        <label className="admin-field-label">
          <span>توضیحات جامع و نقد و بررسی محصول</span>
          <small>معرفی کامل مشخصات، کاربردها و ویژگی‌های کالا</small>
        </label>
        <textarea
          className="admin-textarea"
          rows={7}
          placeholder="توضیحات کامل و نکات مهم محصول را اینجا بنویسید..."
          value={form.description || ''}
          onChange={(e) => updateForm('description', e.target.value)}
        />
      </div>

      {/* 2. جدول مشخصات فنی (کلید و مقدار) */}
      <div style={{ borderTop: '1px solid #edf2f7', paddingTop: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
          <ListOrdered size={15} color="#2563eb" />
          <b style={{ fontSize: '11px', color: '#1e293b' }}>جدول مشخصات فنی</b>
          <small style={{ color: '#64748b', fontSize: '10px' }}>(اختیاری)</small>
        </div>

        {/* ورودی افزودن مشخصه جدید */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '8px', marginBottom: '12px' }}>
          <input
            type="text"
            className="admin-input"
            style={{ minHeight: '34px', fontSize: '11px' }}
            placeholder="عنوان ویژگی (مثال: ظرفیت باتری، ابعاد)"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
          />
          <input
            type="text"
            className="admin-input"
            style={{ minHeight: '34px', fontSize: '11px' }}
            placeholder="مقدار ویژگی (مثال: ۵۰۰۰ میلی‌آمپر، ۱۶۰ گرم)"
            value={newVal}
            onChange={(e) => setNewVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddAttribute();
              }
            }}
          />
          <button
            type="button"
            onClick={handleAddAttribute}
            style={{
              minHeight: '34px',
              padding: '0 12px',
              background: '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Plus size={13} />
            افزودن
          </button>
        </div>

        {/* لیست مشخصات ثبت‌شده */}
        {form.attributes && form.attributes.length > 0 ? (
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '7px', overflow: 'hidden' }}>
            {form.attributes.map((attr, idx) => (
              <div
                key={`${attr.key}-${idx}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: idx % 2 === 0 ? '#ffffff' : '#f8fafc',
                  borderBottom: idx === form.attributes.length - 1 ? 'none' : '1px solid #edf2f7',
                }}
              >
                <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flex: 1 }}>
                  <b style={{ fontSize: '11px', color: '#475569', minWidth: '120px' }}>{attr.key}</b>
                  <span style={{ fontSize: '11px', color: '#1e293b' }}>{attr.val}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveAttribute(idx)}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '3px' }}
                  title="حذف این ویژگی"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: '10px', color: '#94a3b8', padding: '6px 0' }}>
            هنوز مشخصه فنی ثبت نشده است. در صورت تمایل می‌توانید ویژگی‌های خاص کالا را در این جدول وارد کنید.
          </div>
        )}
      </div>
    </div>
  );
};
