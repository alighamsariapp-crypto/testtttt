import React, { useState } from 'react';
import {
  Layers,
  Plus,
  Trash2,
  Check,
  X,
  Sparkles,
  Tag,
  Palette,
  Package,
  CheckCircle2,
  Minus,
  ChevronDown,
  ChevronUp,
  Upload,
  Link as LinkIcon,
  Image as ImageIcon,
  Loader2,
} from 'lucide-react';
import { api } from '../../../../services/api';
import type {
  ProductColorOption,
  ProductCustomOption,
  ProductFormState,
  ProductVariant,
} from './types';
import {
  calculateFinalPrice,
  cleanText,
  formatMoney,
  parseNumber,
  variantLabel,
} from './utils';

const PRESET_COLORS: { name: string; hex: string }[] = [
  { name: 'مشکی', hex: '#0f172a' },
  { name: 'سفید', hex: '#ffffff' },
  { name: 'خاکستری', hex: '#475569' },
  { name: 'نقره‌ای', hex: '#cbd5e1' },
  { name: 'آبی', hex: '#2563eb' },
  { name: 'طلایی', hex: '#d97706' },
  { name: 'سبز', hex: '#059669' },
  { name: 'قرمز', hex: '#e11d48' },
];

const PRESET_AXES = [
  { name: 'حافظه داخلی', values: ['128GB', '256GB', '512GB', '1TB'] },
  { name: 'حافظه رم (RAM)', values: ['8GB', '16GB', '32GB'] },
  { name: 'سایز', values: ['S', 'M', 'L', 'XL'] },
];

interface Props {
  form: ProductFormState;
  suggestedSku: string;
  updateForm: <K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) => void;
  syncVariants: (
    colors: ProductColorOption[],
    options: ProductCustomOption[],
    basePrice: number,
    baseSku: string
  ) => void;
  onConvertToVariable: () => void;
  setErrorMessage: (msg: string) => void;
  liveMode?: boolean;
}

export const ProductVariantsSection: React.FC<Props> = ({
  form,
  suggestedSku,
  updateForm,
  syncVariants,
  onConvertToVariable,
  setErrorMessage,
  liveMode,
}) => {
  const isSimple = form.productType === 'simple';

  // Local state for adding options
  const [customAxisName, setCustomAxisName] = useState('');
  const [newOptionValueMap, setNewOptionValueMap] = useState<Record<string, string>>({});
  const [newColorName, setNewColorName] = useState('');
  const [newColorHex, setNewColorHex] = useState('#2563eb');

  // Color image management state
  const [activeColorUrlInput, setActiveColorUrlInput] = useState<string | null>(null);
  const [colorUrlDraft, setColorUrlDraft] = useState('');
  const [uploadingColorName, setUploadingColorName] = useState<string | null>(null);
  const [activeGallerySelectorColor, setActiveGallerySelectorColor] = useState<string | null>(null);

  // Bulk actions state
  const [bulkOriginalPrice, setBulkOriginalPrice] = useState('');
  const [bulkDiscountPct, setBulkDiscountPct] = useState('');
  const [bulkStock, setBulkStock] = useState('');

  if (isSimple) {
    return (
      <div className="product-panel-body">
        <div className="simple-product-notice-box">
          <span className="notice-icon">
            <Package size={22} />
          </span>
          <h3>این کالا بدون تنوع (تک‌قیمتی) است</h3>
          <p>
            قیمت و موجودی این محصول در تب «قیمت» تعریف شده است. در صورتی که این محصول دارای رنگ‌بندی، ظرفیت، سایز یا مشخصات متغیر است، می‌توانید آن را به محصول چندمدلی تبدیل کنید.
          </p>
          <button
            type="button"
            className="preset-chip-btn"
            style={{
              marginTop: '12px',
              padding: '8px 16px',
              background: '#2563eb',
              color: '#ffffff',
              borderColor: '#2563eb',
              fontWeight: 700,
            }}
            onClick={onConvertToVariable}
          >
            <Layers size={14} />
            تبدیل به محصول دارای تنوع
          </button>
        </div>
      </div>
    );
  }

  // Color actions
  const handleAddColor = (name: string, hex: string) => {
    const clean = cleanText(name);
    if (!clean) return;
    if (form.colors.some((c) => c.name.toLowerCase() === clean.toLowerCase())) return;
    const updated = [...form.colors, { name: clean, hex: hex || '#2563eb' }];
    updateForm('colors', updated);
    syncVariants(updated, form.options, form.basePrice || form.price, form.sku || suggestedSku);
    setNewColorName('');
  };

  const handleRemoveColor = (name: string) => {
    const updated = form.colors.filter((c) => c.name !== name);
    updateForm('colors', updated);
    syncVariants(updated, form.options, form.basePrice || form.price, form.sku || suggestedSku);
  };

  const handleAddImageToColor = (colorName: string, url: string) => {
    const trimmed = url.trim();
    if (!trimmed) return;
    const updatedColors = form.colors.map((c) => {
      if (c.name.toLowerCase() !== colorName.toLowerCase()) return c;
      const existingImages = c.images && c.images.length > 0 ? [...c.images] : (c.image ? [c.image] : []);
      if (!existingImages.includes(trimmed)) {
        existingImages.push(trimmed);
      }
      return {
        ...c,
        image: existingImages[0],
        images: existingImages,
      };
    });
    updateForm('colors', updatedColors);
    syncVariants(updatedColors, form.options, form.basePrice || form.price, form.sku || suggestedSku);
    setActiveColorUrlInput(null);
    setColorUrlDraft('');
  };

  const handleUploadColorImage = async (colorName: string, file: File) => {
    setUploadingColorName(colorName);
    try {
      let finalUrl = '';
      if (liveMode) {
        finalUrl = await api.uploadAdminProductImage(file);
      } else {
        finalUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === 'string') resolve(reader.result);
            else reject(new Error('خطا در خواندن فایل'));
          };
          reader.onerror = () => reject(new Error('خطا در خواندن فایل'));
          reader.readAsDataURL(file);
        });
      }
      if (finalUrl) {
        handleAddImageToColor(colorName, finalUrl);
      }
    } catch {
      setErrorMessage('خطا در بارگذاری تصویر رنگ');
    } finally {
      setUploadingColorName(null);
    }
  };

  const handleRemoveImageFromColor = (colorName: string, imageIndex: number) => {
    const updatedColors = form.colors.map((c) => {
      if (c.name.toLowerCase() !== colorName.toLowerCase()) return c;
      const existingImages = c.images && c.images.length > 0 ? [...c.images] : (c.image ? [c.image] : []);
      const filtered = existingImages.filter((_, idx) => idx !== imageIndex);
      return {
        ...c,
        image: filtered[0] || undefined,
        images: filtered,
      };
    });
    updateForm('colors', updatedColors);
    syncVariants(updatedColors, form.options, form.basePrice || form.price, form.sku || suggestedSku);
  };

  const handleSetPrimaryColorImage = (colorName: string, imageIndex: number) => {
    const updatedColors = form.colors.map((c) => {
      if (c.name.toLowerCase() !== colorName.toLowerCase()) return c;
      const existingImages = c.images && c.images.length > 0 ? [...c.images] : (c.image ? [c.image] : []);
      if (imageIndex < 0 || imageIndex >= existingImages.length) return c;
      const selected = existingImages[imageIndex];
      const reordered = [selected, ...existingImages.filter((_, idx) => idx !== imageIndex)];
      return {
        ...c,
        image: selected,
        images: reordered,
      };
    });
    updateForm('colors', updatedColors);
    syncVariants(updatedColors, form.options, form.basePrice || form.price, form.sku || suggestedSku);
  };

  // Option axes actions
  const handleAddOptionAxis = (axisName: string, defaultValues: string[] = []) => {
    const clean = cleanText(axisName);
    if (!clean) return;
    if (form.options.some((o) => o.name.toLowerCase() === clean.toLowerCase())) return;
    if (form.options.length >= 3) {
      setErrorMessage('حداکثر ۳ محور تنوع برای سادگی کالا مجاز است.');
      return;
    }
    const id = `opt_${Date.now()}`;
    const updated = [...form.options, { id, name: clean, values: defaultValues }];
    updateForm('options', updated);
    syncVariants(form.colors, updated, form.basePrice || form.price, form.sku || suggestedSku);
    setCustomAxisName('');
  };

  const handleRemoveOptionAxis = (id: string) => {
    const updated = form.options.filter((o) => o.id !== id);
    updateForm('options', updated);
    syncVariants(form.colors, updated, form.basePrice || form.price, form.sku || suggestedSku);
  };

  const handleAddOptionValue = (axisId: string, val: string) => {
    const clean = cleanText(val);
    if (!clean) return;
    const opt = form.options.find((o) => o.id === axisId);
    if (!opt || opt.values.includes(clean)) return;
    const updated = form.options.map((o) => (o.id === axisId ? { ...o, values: [...o.values, clean] } : o));
    updateForm('options', updated);
    syncVariants(form.colors, updated, form.basePrice || form.price, form.sku || suggestedSku);
    setNewOptionValueMap((prev) => ({ ...prev, [axisId]: '' }));
  };

  const handleRemoveOptionValue = (axisId: string, val: string) => {
    const updated = form.options.map((o) => (o.id === axisId ? { ...o, values: o.values.filter((v) => v !== val) } : o));
    updateForm('options', updated);
    syncVariants(form.colors, updated, form.basePrice || form.price, form.sku || suggestedSku);
  };

  // Update a single variant safely by ID or array index
  const handleUpdateVariant = (targetKey: string | number, updates: Partial<ProductVariant>) => {
    updateForm(
      'variants',
      form.variants.map((v, idx) => {
        const isTarget = typeof targetKey === 'number'
          ? idx === targetKey
          : ((v.id && targetKey && v.id !== 'undefined' && v.id !== 'null') ? v.id === targetKey : idx === Number(targetKey));
        if (!isTarget) return v;
        const merged = { ...v, ...updates };
        // Recalculate final price if original_price or discount_percent changed
        const orig = merged.original_price ?? merged.price ?? 0;
        const disc = merged.discount_percent ?? 0;
        merged.price = calculateFinalPrice(orig, disc);
        return merged;
      })
    );
  };

  // Remove a variant manually by ID or array index
  const handleRemoveVariant = (targetKey: string | number) => {
    updateForm(
      'variants',
      form.variants.filter((v, idx) => {
        if (typeof targetKey === 'number') return idx !== targetKey;
        if (v.id && targetKey && v.id !== 'undefined' && v.id !== 'null') return v.id !== targetKey;
        return idx !== Number(targetKey);
      })
    );
  };

  // Bulk operations
  const handleApplyBulkPrice = () => {
    const orig = parseNumber(bulkOriginalPrice);
    if (orig <= 0) return;
    updateForm(
      'variants',
      form.variants.map((v) => {
        const disc = v.discount_percent ?? 0;
        return {
          ...v,
          original_price: orig,
          price: calculateFinalPrice(orig, disc),
        };
      })
    );
    setBulkOriginalPrice('');
  };

  const handleApplyBulkDiscount = () => {
    let disc = parseNumber(bulkDiscountPct);
    if (disc < 0) disc = 0;
    if (disc > 99) disc = 99;
    updateForm(
      'variants',
      form.variants.map((v) => {
        const orig = v.original_price ?? v.price ?? 0;
        return {
          ...v,
          discount_percent: disc,
          price: calculateFinalPrice(orig, disc),
        };
      })
    );
    setBulkDiscountPct('');
  };

  const handleApplyBulkStock = () => {
    const s = Math.max(0, parseNumber(bulkStock));
    updateForm(
      'variants',
      form.variants.map((v) => ({ ...v, stock: s }))
    );
    setBulkStock('');
  };

  const handleToggleAllVariants = (active: boolean) => {
    updateForm(
      'variants',
      form.variants.map((v) => ({ ...v, is_active: active }))
    );
  };

  return (
    <div className="product-panel-body">
      {/* ── مرحله ۱: تعریف ویژگی‌های تنوع (Options) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
        {/* ۱.۱ انتخاب یا افزودن رنگ */}
        <div style={{ padding: '14px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#f8fafc' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <Palette size={15} color="#2563eb" />
            <b style={{ fontSize: '11px', color: '#1e293b' }}>رنگ‌های کالا</b>
          </div>

          {/* پیش‌فرض‌های سریع رنگ */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '10px' }}>
            {PRESET_COLORS.map((pc) => {
              const isSelected = form.colors.some((c) => c.name === pc.name);
              return (
                <button
                  key={pc.name}
                  type="button"
                  onClick={() => (isSelected ? handleRemoveColor(pc.name) : handleAddColor(pc.name, pc.hex))}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 7px',
                    borderRadius: '4px',
                    border: isSelected ? '1px solid #2563eb' : '1px solid #dfe6ee',
                    background: isSelected ? '#eff6ff' : '#ffffff',
                    color: isSelected ? '#1e40af' : '#475569',
                    fontSize: '10px',
                    fontWeight: isSelected ? 700 : 500,
                    cursor: 'pointer',
                  }}
                >
                  <span
                    style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: pc.hex,
                      border: pc.hex === '#ffffff' ? '1px solid #cbd5e1' : 'none',
                    }}
                  />
                  {pc.name}
                  {isSelected && <Check size={10} />}
                </button>
              );
            })}
          </div>

          {/* افزودن رنگ سفارشی */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <input
              type="color"
              value={newColorHex}
              onChange={(e) => setNewColorHex(e.target.value)}
              style={{ width: '28px', height: '28px', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: 0 }}
            />
            <input
              type="text"
              className="admin-input"
              style={{ minHeight: '28px', fontSize: '10px', flex: 1 }}
              placeholder="نام رنگ دلخواه..."
              value={newColorName}
              onChange={(e) => setNewColorName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddColor(newColorName, newColorHex);
                }
              }}
            />
            <button
              type="button"
              onClick={() => handleAddColor(newColorName, newColorHex)}
              style={{
                minHeight: '28px',
                padding: '0 8px',
                background: '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                fontSize: '10px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              افزودن
            </button>
          </div>
        </div>

        {/* ۱.۲ ویژگی‌های متغیر (مانند حافظه، سایز و...) */}
        <div style={{ padding: '14px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#f8fafc' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <Tag size={15} color="#2563eb" />
            <b style={{ fontSize: '11px', color: '#1e293b' }}>ویژگی‌های تنوع (مانند حافظه، سایز)</b>
          </div>

          {/* پیش‌فرض‌های سریع */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '10px' }}>
            {PRESET_AXES.map((axis) => {
              const exists = form.options.some((o) => o.name === axis.name);
              return (
                <button
                  key={axis.name}
                  type="button"
                  disabled={exists}
                  onClick={() => handleAddOptionAxis(axis.name, axis.values)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    border: exists ? '1px solid #cbd5e1' : '1px solid #bfdbfe',
                    background: exists ? '#f1f5f9' : '#eff6ff',
                    color: exists ? '#94a3b8' : '#1d4ed8',
                    fontSize: '10px',
                    fontWeight: 600,
                    cursor: exists ? 'default' : 'pointer',
                  }}
                >
                  <Plus size={10} />
                  افزودن {axis.name}
                </button>
              );
            })}
          </div>

          {/* ورودی ویژگی دلخواه */}
          <div style={{ display: 'flex', gap: '6px' }}>
            <input
              type="text"
              className="admin-input"
              style={{ minHeight: '28px', fontSize: '10px', flex: 1 }}
              placeholder="مثال: گارانتی، ظرفیت باتری..."
              value={customAxisName}
              onChange={(e) => setCustomAxisName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddOptionAxis(customAxisName, []);
                }
              }}
            />
            <button
              type="button"
              onClick={() => handleAddOptionAxis(customAxisName, [])}
              style={{
                minHeight: '28px',
                padding: '0 8px',
                background: '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                fontSize: '10px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              افزودن ویژگی
            </button>
          </div>

          {/* مقادیر ویژگی‌های تعریف‌شده */}
          {form.options.length > 0 && (
            <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {form.options.map((opt, optIdx) => (
                <div
                  key={opt.id ? `opt-${opt.id}` : `opt-${opt.name}-${optIdx}`}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    padding: '6px 8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <b style={{ fontSize: '10px', color: '#1e293b' }}>{opt.name}:</b>
                    <button
                      type="button"
                      onClick={() => handleRemoveOptionAxis(opt.id)}
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0 }}
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                    {opt.values.map((val) => (
                      <span
                        key={val}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          background: '#eff6ff',
                          color: '#2563eb',
                          border: '1px solid #dbeafe',
                          borderRadius: '3px',
                          padding: '2px 5px',
                          fontSize: '9px',
                          fontWeight: 700,
                        }}
                      >
                        {val}
                        <button
                          type="button"
                          onClick={() => handleRemoveOptionValue(opt.id, val)}
                          style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 0 }}
                        >
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                    {/* ورودی مقدار جدید */}
                    <input
                      type="text"
                      placeholder="+ مقدار جدید"
                      style={{
                        width: '75px',
                        minHeight: '20px',
                        border: '1px dashed #cbd5e1',
                        borderRadius: '3px',
                        padding: '1px 4px',
                        fontSize: '9px',
                        outline: 'none',
                      }}
                      value={newOptionValueMap[opt.id] || ''}
                      onChange={(e) => setNewOptionValueMap((prev) => ({ ...prev, [opt.id]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddOptionValue(opt.id, newOptionValueMap[opt.id] || '');
                        }
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── تخصیص تصاویر اختصاصی هر رنگ (Variant Color Image Assignment) ── */}
      {form.colors.length > 0 && (
        <div
          style={{
            margin: '0 0 16px 0',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '12px 14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Palette size={15} style={{ color: '#2563eb' }} />
              <b style={{ fontSize: '12px', color: '#0f172a' }}>تصاویر اختصاصی رنگ‌ها</b>
              <span style={{ fontSize: '10px', color: '#64748b' }}>
                (برای هر رنگ می‌توانید یک یا چند تصویر مشخص کنید؛ تصویر اول شاخص آن رنگ است و در گالری فروشگاه هنگام انتخاب رنگ نمایش داده می‌شود)
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {form.colors.map((color) => {
              const colorImages = color.images && color.images.length > 0 ? color.images : (color.image ? [color.image] : []);
              const isAddingUrl = activeColorUrlInput === color.name;
              const isPickingFromGallery = activeGallerySelectorColor === color.name;
              const isUploading = uploadingColorName === color.name;

              return (
                <div
                  key={color.name}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          width: '16px',
                          height: '16px',
                          borderRadius: '50%',
                          backgroundColor: color.hex,
                          border: '1px solid #cbd5e1',
                          display: 'inline-block',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                        }}
                      />
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b' }}>
                        رنگ {color.name}
                      </span>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>
                        ({colorImages.length} تصویر)
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      {/* Upload file button */}
                      <label
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 8px',
                          background: '#f1f5f9',
                          border: '1px solid #cbd5e1',
                          borderRadius: '4px',
                          fontSize: '10px',
                          fontWeight: 600,
                          color: '#334155',
                          cursor: isUploading ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {isUploading ? <Loader2 size={11} className="animate-spin text-blue-600" /> : <Upload size={11} />}
                        <span>{isUploading ? 'در حال آپلود...' : 'آپلود فایل'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          disabled={isUploading}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              handleUploadColorImage(color.name, file);
                              e.target.value = '';
                            }
                          }}
                        />
                      </label>

                      {/* Add by URL button */}
                      <button
                        type="button"
                        onClick={() => {
                          setActiveColorUrlInput(isAddingUrl ? null : color.name);
                          setColorUrlDraft('');
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 8px',
                          background: isAddingUrl ? '#eff6ff' : '#f1f5f9',
                          border: isAddingUrl ? '1px solid #3b82f6' : '1px solid #cbd5e1',
                          borderRadius: '4px',
                          fontSize: '10px',
                          fontWeight: 600,
                          color: isAddingUrl ? '#1d4ed8' : '#334155',
                          cursor: 'pointer',
                        }}
                      >
                        <LinkIcon size={11} />
                        <span>لینک اینترنتی</span>
                      </button>

                      {/* Select from existing product gallery */}
                      {((form.image_url ? 1 : 0) + (form.gallery_urls?.length || 0)) > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveGallerySelectorColor(isPickingFromGallery ? null : color.name);
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            background: isPickingFromGallery ? '#eff6ff' : '#f1f5f9',
                            border: isPickingFromGallery ? '1px solid #3b82f6' : '1px solid #cbd5e1',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: 600,
                            color: isPickingFromGallery ? '#1d4ed8' : '#334155',
                            cursor: 'pointer',
                          }}
                        >
                          <ImageIcon size={11} />
                          <span>انتخاب از گالری محصول</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Add URL input drawer */}
                  {isAddingUrl && (
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', padding: '4px 0' }}>
                      <input
                        type="text"
                        placeholder="آدرس اینترنتی تصویر (https://... یا /images/...)"
                        value={colorUrlDraft}
                        onChange={(e) => setColorUrlDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddImageToColor(color.name, colorUrlDraft);
                          }
                        }}
                        style={{
                          flex: 1,
                          fontSize: '11px',
                          padding: '4px 8px',
                          border: '1px solid #93c5fd',
                          borderRadius: '4px',
                          outline: 'none',
                        }}
                        dir="ltr"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddImageToColor(color.name, colorUrlDraft)}
                        style={{
                          padding: '4px 10px',
                          background: '#2563eb',
                          color: '#fff',
                          borderRadius: '4px',
                          fontSize: '10px',
                          fontWeight: 700,
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        ثبت
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveColorUrlInput(null)}
                        style={{
                          padding: '4px 8px',
                          background: '#f1f5f9',
                          color: '#64748b',
                          borderRadius: '4px',
                          fontSize: '10px',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        انصراف
                      </button>
                    </div>
                  )}

                  {/* Pick from existing product images */}
                  {isPickingFromGallery && (
                    <div
                      style={{
                        padding: '6px 8px',
                        background: '#f8fafc',
                        border: '1px dashed #93c5fd',
                        borderRadius: '4px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                      }}
                    >
                      <span style={{ fontSize: '10px', color: '#475569', fontWeight: 600 }}>
                        تصویر مورد نظر را برای رنگ {color.name} انتخاب کنید:
                      </span>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {[form.image_url, ...(form.gallery_urls || [])]
                          .filter(Boolean)
                          .map((imgUrl, i) => {
                            const isAssigned = colorImages.includes(imgUrl);
                            return (
                              <button
                                key={i}
                                type="button"
                                onClick={() => {
                                  if (!isAssigned) {
                                    handleAddImageToColor(color.name, imgUrl);
                                  }
                                }}
                                style={{
                                  position: 'relative',
                                  width: '44px',
                                  height: '44px',
                                  borderRadius: '4px',
                                  border: isAssigned ? '2px solid #2563eb' : '1px solid #cbd5e1',
                                  padding: '2px',
                                  background: '#fff',
                                  cursor: isAssigned ? 'default' : 'pointer',
                                  opacity: isAssigned ? 0.6 : 1,
                                }}
                                title={isAssigned ? 'قبلاً اضافه شده' : 'افزودن به این رنگ'}
                              >
                                <img
                                  src={imgUrl}
                                  alt=""
                                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                />
                                {isAssigned && (
                                  <span
                                    style={{
                                      position: 'absolute',
                                      bottom: '1px',
                                      right: '1px',
                                      background: '#2563eb',
                                      color: '#fff',
                                      borderRadius: '50%',
                                      width: '12px',
                                      height: '12px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: '8px',
                                    }}
                                  >
                                    ✓
                                  </span>
                                )}
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  )}

                  {/* Thumbnail List for this color */}
                  {colorImages.length > 0 ? (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', paddingTop: '2px' }}>
                      {colorImages.map((img, imgIdx) => (
                        <div
                          key={imgIdx}
                          style={{
                            position: 'relative',
                            width: '56px',
                            height: '56px',
                            borderRadius: '6px',
                            border: imgIdx === 0 ? '2px solid #2563eb' : '1px solid #cbd5e1',
                            padding: '2px',
                            background: '#f8fafc',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <img
                            src={img}
                            alt={`${color.name} ${imgIdx + 1}`}
                            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src = '/images/product-placeholder.svg';
                            }}
                          />
                          {/* Primary star badge */}
                          {imgIdx === 0 && (
                            <span
                              title="تصویر شاخص این رنگ"
                              style={{
                                position: 'absolute',
                                top: '-4px',
                                right: '-4px',
                                background: '#2563eb',
                                color: '#fff',
                                borderRadius: '50%',
                                width: '14px',
                                height: '14px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '8px',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                              }}
                            >
                              ★
                            </span>
                          )}

                          {/* Action Overlay buttons */}
                          <div
                            style={{
                              position: 'absolute',
                              bottom: '-6px',
                              left: '0',
                              right: '0',
                              display: 'flex',
                              justifyContent: 'center',
                              gap: '2px',
                            }}
                          >
                            {imgIdx !== 0 && (
                              <button
                                type="button"
                                onClick={() => handleSetPrimaryColorImage(color.name, imgIdx)}
                                title="انتخاب به عنوان تصویر شاخص"
                                style={{
                                  background: '#1e293b',
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: '3px',
                                  width: '14px',
                                  height: '14px',
                                  fontSize: '8px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                }}
                              >
                                ★
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleRemoveImageFromColor(color.name, imgIdx)}
                              title="حذف تصویر"
                              style={{
                                background: '#ef4444',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '3px',
                                width: '14px',
                                height: '14px',
                                fontSize: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: '10px', color: '#94a3b8', fontStyle: 'italic', padding: '2px 0' }}>
                      هنوز تصویری برای رنگ {color.name} تعیین نشده است (از تصویر اصلی کالا استفاده می‌شود).
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── مرحله ۲: نوار ابزار عملیات گروهی (Bulk Actions) ── */}
      {form.variants.length > 0 && (
        <div className="bulk-bar">
          <span>عملیات گروهی:</span>

          {/* قیمت اصلی همگانی */}
          <div className="bulk-input-group">
            <input
              type="number"
              placeholder="قیمت اصلی..."
              value={bulkOriginalPrice}
              onChange={(e) => setBulkOriginalPrice(e.target.value)}
            />
            <button type="button" onClick={handleApplyBulkPrice}>
              اعمال قیمت اصلی
            </button>
          </div>

          {/* درصد تخفیف همگانی */}
          <div className="bulk-input-group">
            <input
              type="number"
              min="0"
              max="99"
              placeholder="درصد تخفیف %"
              value={bulkDiscountPct}
              onChange={(e) => setBulkDiscountPct(e.target.value)}
            />
            <button type="button" onClick={handleApplyBulkDiscount}>
              اعمال تخفیف
            </button>
          </div>

          {/* موجودی همگانی */}
          <div className="bulk-input-group">
            <input
              type="number"
              min="0"
              placeholder="موجودی انبار..."
              value={bulkStock}
              onChange={(e) => setBulkStock(e.target.value)}
            />
            <button type="button" onClick={handleApplyBulkStock}>
              اعمال موجودی
            </button>
          </div>

          {/* فعال/غیرفعال‌سازی سریع */}
          <div style={{ marginRight: 'auto', display: 'flex', gap: '4px' }}>
            <button
              type="button"
              onClick={() => handleToggleAllVariants(true)}
              style={{
                background: '#f0fdf4',
                color: '#15803d',
                border: '1px solid #bbf7d0',
                borderRadius: '4px',
                padding: '2px 8px',
                fontSize: '9px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              فعال‌سازی همه
            </button>
            <button
              type="button"
              onClick={() => handleToggleAllVariants(false)}
              style={{
                background: '#fef2f2',
                color: '#b91c1c',
                border: '1px solid #fecaca',
                borderRadius: '4px',
                padding: '2px 8px',
                fontSize: '9px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              غیرفعال‌سازی همه
            </button>
          </div>
        </div>
      )}

      {/* ── مرحله ۳: جدول / کارت‌های فشرده تنوع‌ها (Compact Variants View) ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: '#1e293b' }}>
            تنوع‌های ایجادشده ({form.variants.length.toLocaleString('fa-IR')} تنوع)
          </span>
          <small style={{ color: '#64748b', fontSize: '10px' }}>
            قیمت نهایی به صورت خودکار از فرمول «قیمت اصلی − درصد تخفیف» محاسبه می‌شود.
          </small>
        </div>

        {form.variants.length === 0 ? (
          <div
            style={{
              padding: '28px',
              textAlign: 'center',
              border: '1px dashed #cbd5e1',
              borderRadius: '8px',
              background: '#f8fafc',
              color: '#64748b',
              fontSize: '11px',
            }}
          >
            هنوز تنوعی ایجاد نشده است. لطفاً حداقل یک رنگ یا ویژگی در کادرهای بالا انتخاب کنید.
          </div>
        ) : (
          <>
            {/* Desktop Table: Compact & Scannable */}
            <div className="variant-table-wrap hidden md:block">
              <table className="variant-matrix-table">
                <thead>
                  <tr>
                    <th style={{ width: '180px' }}>تنوع کالا</th>
                    <th style={{ width: '150px' }}>قیمت اصلی (تومان)</th>
                    <th style={{ width: '90px' }}>تخفیف (%)</th>
                    <th style={{ width: '160px' }}>قیمت نهایی</th>
                    <th style={{ width: '90px' }}>موجودی</th>
                    <th style={{ width: '120px' }}>شناسه SKU</th>
                    <th style={{ width: '70px', textAlign: 'center' }}>وضعیت</th>
                    <th style={{ width: '40px', textAlign: 'center' }}>حذف</th>
                  </tr>
                </thead>
                <tbody>
                  {form.variants.map((v, vIdx) => {
                    const targetKey = v.id || vIdx;
                    const label = variantLabel(v, form.options);
                    const origPrice = v.original_price ?? v.price ?? 0;
                    const discountPct = v.discount_percent ?? 0;
                    const finalPrice = calculateFinalPrice(origPrice, discountPct);
                    const isActive = v.is_active !== false;

                    return (
                      <tr key={v.id ? `variant-row-${v.id}` : `variant-row-${vIdx}-${v.color || ''}-${v.sku || ''}`} className={isActive ? '' : 'inactive-row'}>
                        {/* تنوع */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {v.color && (
                              <span
                                style={{
                                  width: '12px',
                                  height: '12px',
                                  borderRadius: '50%',
                                  background: form.colors.find((c) => c.name === v.color)?.hex || '#2563eb',
                                  border: '1px solid #cbd5e1',
                                  flexShrink: 0,
                                }}
                              />
                            )}
                            {(v.image || form.colors.find((c) => c.name === v.color)?.image) && (
                              <img
                                src={v.image || form.colors.find((c) => c.name === v.color)?.image}
                                alt=""
                                style={{
                                  width: '22px',
                                  height: '22px',
                                  borderRadius: '4px',
                                  objectFit: 'contain',
                                  border: '1px solid #cbd5e1',
                                  background: '#f8fafc',
                                  flexShrink: 0,
                                }}
                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                              />
                            )}
                            <b style={{ fontSize: '11px', color: '#1e293b' }}>{label}</b>
                          </div>
                        </td>

                        {/* قیمت اصلی */}
                        <td>
                          <input
                            type="number"
                            className="admin-input"
                            style={{ minHeight: '30px', fontSize: '11px', padding: '0 6px', fontWeight: 600 }}
                            value={origPrice || ''}
                            placeholder="قیمت اصلی..."
                            onChange={(e) =>
                              handleUpdateVariant(targetKey, { original_price: parseNumber(e.target.value) })
                            }
                          />
                        </td>

                        {/* درصد تخفیف */}
                        <td>
                          <input
                            type="number"
                            min="0"
                            max="99"
                            className="admin-input"
                            style={{ minHeight: '30px', fontSize: '11px', padding: '0 6px', textAlign: 'center' }}
                            value={discountPct || ''}
                            placeholder="۰"
                            onChange={(e) => {
                              let pct = parseNumber(e.target.value);
                              if (pct < 0) pct = 0;
                              if (pct > 99) pct = 99;
                              handleUpdateVariant(targetKey, { discount_percent: pct });
                            }}
                          />
                        </td>

                        {/* قیمت نهایی (فقط خواندنی) */}
                        <td>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '4px 8px',
                              borderRadius: '5px',
                              background: discountPct > 0 ? '#f0fdf4' : '#f8fafc',
                              border: discountPct > 0 ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                            }}
                          >
                            <b
                              style={{
                                fontSize: '11px',
                                color: discountPct > 0 ? '#15803d' : '#1e293b',
                              }}
                            >
                              {origPrice > 0 ? formatMoney(finalPrice) : '۰'}
                            </b>
                            {discountPct > 0 && (
                              <span
                                style={{
                                  fontSize: '9px',
                                  fontWeight: 700,
                                  color: '#166534',
                                  background: '#dcfce7',
                                  padding: '1px 4px',
                                  borderRadius: '3px',
                                }}
                              >
                                {discountPct}٪
                              </span>
                            )}
                          </div>
                        </td>

                        {/* موجودی */}
                        <td>
                          <input
                            type="number"
                            min="0"
                            className="admin-input"
                            style={{ minHeight: '30px', fontSize: '11px', padding: '0 6px', textAlign: 'center' }}
                            value={v.stock}
                            onChange={(e) =>
                              handleUpdateVariant(targetKey, { stock: Math.max(0, parseNumber(e.target.value)) })
                            }
                          />
                        </td>

                        {/* کد SKU */}
                        <td>
                          <input
                            type="text"
                            className="admin-input"
                            style={{ minHeight: '30px', fontSize: '10px', padding: '0 6px', direction: 'ltr' }}
                            value={v.sku || ''}
                            placeholder="کد انبار..."
                            onChange={(e) => handleUpdateVariant(targetKey, { sku: e.target.value.toUpperCase() })}
                          />
                        </td>

                        {/* وضعیت فعال */}
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={isActive}
                            onChange={(e) => handleUpdateVariant(targetKey, { is_active: e.target.checked })}
                            style={{ width: '15px', height: '15px', accentColor: '#2563eb', cursor: 'pointer' }}
                          />
                        </td>

                        {/* حذف */}
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleRemoveVariant(targetKey)}
                            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
                            title="حذف این تنوع"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards: Dedicated Touch-First Ergonomic Layout */}
            <div className="block md:hidden space-y-4">
              {form.variants.map((v, vIdx) => {
                const targetKey = v.id || vIdx;
                const label = variantLabel(v, form.options);
                const origPrice = v.original_price ?? v.price ?? 0;
                const discountPct = v.discount_percent ?? 0;
                const finalPrice = calculateFinalPrice(origPrice, discountPct);
                const isActive = v.is_active !== false;
                const isOutOfStock = v.stock <= 0;

                return (
                  <div
                    key={v.id ? `variant-card-${v.id}` : `variant-card-${vIdx}-${v.color || ''}-${v.sku || ''}`}
                    className={`rounded-2xl border p-4 transition-all ${
                      isActive ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-50 border-slate-200/80 opacity-75'
                    }`}
                  >
                    {/* Header: Title + Color Dot + Delete */}
                    <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {v.color && (
                          <span
                            className="w-4 h-4 rounded-full border border-slate-300 shrink-0 shadow-xs"
                            style={{
                              background: form.colors.find((c) => c.name === v.color)?.hex || '#2563eb',
                            }}
                          />
                        )}
                        {(v.image || form.colors.find((c) => c.name === v.color)?.image) && (
                          <img
                            src={v.image || form.colors.find((c) => c.name === v.color)?.image}
                            alt=""
                            className="w-7 h-7 rounded-md object-contain bg-slate-50 border border-slate-200 shrink-0"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                        )}
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-slate-900 truncate">
                            {label}
                          </h4>
                          {v.sku && (
                            <span className="inline-block text-xs font-mono text-slate-500 dir-ltr">
                              {v.sku}
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveVariant(targetKey)}
                        className="w-11 h-11 flex items-center justify-center rounded-xl text-rose-500 hover:bg-rose-50 active:bg-rose-100 transition-colors shrink-0"
                        title="حذف این تنوع"
                        aria-label="حذف این تنوع"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>

                    {/* Stock / Inventory Section with Touch Stepper */}
                    <div className="pt-3 pb-2">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          <Package size={14} className="text-slate-400" />
                          موجودی این تنوع در انبار
                        </label>
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            isOutOfStock
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {isOutOfStock ? 'ناموجود' : `موجود (${v.stock} عدد)`}
                        </span>
                      </div>

                      {/* Large Stepper for Mobile Thumb Control */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleUpdateVariant(targetKey, { stock: Math.max(0, v.stock - 1) })}
                          disabled={v.stock <= 0}
                          className="w-12 h-12 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-slate-700 transition-colors shrink-0"
                          aria-label="کاهش یک عدد موجودی"
                        >
                          <Minus size={18} />
                        </button>

                        <input
                          type="number"
                          min="0"
                          inputMode="numeric"
                          className="flex-1 h-12 rounded-xl border border-slate-300 bg-white text-center text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          value={v.stock}
                          onChange={(e) =>
                            handleUpdateVariant(targetKey, { stock: Math.max(0, parseNumber(e.target.value)) })
                          }
                        />

                        <button
                          type="button"
                          onClick={() => handleUpdateVariant(targetKey, { stock: v.stock + 1 })}
                          className="w-12 h-12 rounded-xl border border-blue-600 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 flex items-center justify-center text-white transition-colors shrink-0"
                          aria-label="افزایش یک عدد موجودی"
                        >
                          <Plus size={18} />
                        </button>
                      </div>

                      {/* Quick Stock Shortcuts for Mobile */}
                      <div className="flex items-center gap-1.5 mt-2 overflow-x-auto no-scrollbar py-0.5">
                        <button
                          type="button"
                          onClick={() => handleUpdateVariant(targetKey, { stock: 0 })}
                          className="px-2.5 h-8 rounded-lg text-xs font-medium border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 shrink-0"
                        >
                          صفر
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateVariant(targetKey, { stock: v.stock + 5 })}
                          className="px-2.5 h-8 rounded-lg text-xs font-medium border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shrink-0"
                        >
                          +۵ عدد
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateVariant(targetKey, { stock: v.stock + 10 })}
                          className="px-2.5 h-8 rounded-lg text-xs font-medium border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shrink-0"
                        >
                          +۱۰ عدد
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateVariant(targetKey, { stock: 20 })}
                          className="px-2.5 h-8 rounded-lg text-xs font-medium border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shrink-0"
                        >
                          ۲۰ عدد
                        </button>
                      </div>
                    </div>

                    {/* Price and Discount Section */}
                    <div className="space-y-3 pt-2">
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">
                          قیمت اصلی (تومان)
                        </label>
                        <input
                          type="number"
                          inputMode="numeric"
                          className="w-full h-11 px-3 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          value={origPrice || ''}
                          placeholder="مثال: ۲,۵۰۰,۰۰۰"
                          onChange={(e) =>
                            handleUpdateVariant(targetKey, { original_price: parseNumber(e.target.value) })
                          }
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">
                          درصد تخفیف (%)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="99"
                          inputMode="numeric"
                          className="w-full h-11 px-3 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-center text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          value={discountPct || ''}
                          placeholder="۰"
                          onChange={(e) => {
                            let pct = parseNumber(e.target.value);
                            if (pct < 0) pct = 0;
                            if (pct > 99) pct = 99;
                            handleUpdateVariant(targetKey, { discount_percent: pct });
                          }}
                        />
                      </div>

                      {/* Prominent Calculated Final Price Badge */}
                      <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200 flex items-center justify-between">
                        <div>
                          <span className="text-xs font-medium text-emerald-800 block">
                            قیمت نهایی فروش
                          </span>
                          <span className="text-base font-extrabold text-emerald-900">
                            {origPrice > 0 ? formatMoney(finalPrice) : '۰'} <span className="text-xs font-normal">تومان</span>
                          </span>
                        </div>
                        {discountPct > 0 && (
                          <span className="text-xs font-bold text-emerald-800 bg-emerald-200/80 px-2.5 py-1 rounded-lg">
                            {discountPct}٪ تخفیف
                          </span>
                        )}
                      </div>

                      {/* SKU Input */}
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">
                          شناسه کالا (SKU انبارداری)
                        </label>
                        <input
                          type="text"
                          className="w-full h-11 px-3 rounded-xl border border-slate-300 bg-white text-xs font-mono text-slate-900 dir-ltr placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          value={v.sku || ''}
                          placeholder="کد انبارداری..."
                          onChange={(e) => handleUpdateVariant(targetKey, { sku: e.target.value.toUpperCase() })}
                        />
                      </div>

                      {/* Active Status Toggle (Min 44px Touch Target) */}
                      <label className="min-h-11 flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer select-none">
                        <span className="text-xs font-semibold text-slate-800">
                          وضعیت عرضه در سایت
                        </span>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold ${isActive ? 'text-emerald-700' : 'text-slate-500'}`}>
                            {isActive ? 'فعال' : 'غیرفعال'}
                          </span>
                          <input
                            type="checkbox"
                            checked={isActive}
                            onChange={(e) => handleUpdateVariant(targetKey, { is_active: e.target.checked })}
                            className="w-5 h-5 rounded-md accent-blue-600 cursor-pointer"
                          />
                        </div>
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
