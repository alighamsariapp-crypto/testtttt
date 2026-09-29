import React, { useState, useEffect } from 'react';
import { 
  X, 
  Upload, 
  Plus, 
  Trash2, 
  Check, 
  Sparkles, 
  AlertCircle,
  Package,
  Layers,
  DollarSign,
  Tag,
  Eye,
  Sliders
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Product } from '../../types';

interface AdminProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  productToEdit?: Product | null;
}

export const AdminProductModal: React.FC<AdminProductModalProps> = ({ 
  isOpen, 
  onClose, 
  productToEdit 
}) => {
  const { categories, addProduct, updateProduct } = useApp();

  const [formData, setFormData] = useState<Partial<Product>>({
    name: '',
    title_en: '',
    slug: '',
    sku: '',
    category_slug: categories[0]?.slug || 'networking',
    brand: 'MikroTik',
    base_price: 1000000,
    discount_percentage: 0,
    discount_price: undefined,
    in_stock: true,
    stock_quantity: 10,
    is_featured: false,
    is_active: true,
    rating: 4.8,
    reviews_count: 12,
    image: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=800&auto=format&fit=crop&q=80',
    description: '',
    guarantee: 'گارانتی ۲۴ ماهه رسمی نوین‌نت',
    specs: {
      'پورت شبکه': '10/100/1000 Gigabit',
      'حافظه رم': '256 MB',
      'سیستم عامل': 'RouterOS Level 4'
    }
  });

  const [specKey, setSpecKey] = useState('');
  const [specValue, setSpecValue] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (productToEdit) {
      setFormData({
        ...productToEdit,
        specs: productToEdit.specs || {}
      });
    } else {
      setFormData({
        name: '',
        title_en: '',
        slug: '',
        sku: 'NOV-' + Math.floor(Math.random() * 89999 + 10000),
        category_slug: categories[0]?.slug || 'networking',
        brand: 'MikroTik',
        base_price: 2500000,
        discount_percentage: 0,
        discount_price: undefined,
        in_stock: true,
        stock_quantity: 15,
        is_featured: false,
        is_active: true,
        rating: 5.0,
        reviews_count: 0,
        image: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=800&auto=format&fit=crop&q=80',
        description: 'تجهیزات پیشرفته شبکه و ارتباطات با بالاترین کیفیت و پایداری عملکرد.',
        guarantee: 'گارانتی ۲۴ ماهه تعویض نوین‌نت',
        specs: {
          'سرعت انتقال': '1 Gbps',
          'ولتاژ ورودی': 'PoE In 12-57V',
          'نوع کاربری': 'سازمانی و دیتاسنتر'
        }
      });
    }
    setErrorMsg('');
  }, [productToEdit, isOpen, categories]);

  if (!isOpen) return null;

  const handleSlugify = (name: string) => {
    const s = name
      .toLowerCase()
      .replace(/[\s_]+/g, '-')
      .replace(/[^\w\u0600-\u06FF-]/g, '')
      .replace(/--+/g, '-');
    return s || `item-${Date.now()}`;
  };

  const handleBasePriceChange = (price: number) => {
    const discountPct = formData.discount_percentage || 0;
    const discountPrice = discountPct > 0 ? Math.round(price * (1 - discountPct / 100)) : undefined;
    setFormData(prev => ({
      ...prev,
      base_price: price,
      discount_price: discountPrice
    }));
  };

  const handleDiscountPctChange = (pct: number) => {
    const base = formData.base_price || 0;
    const discountPrice = pct > 0 ? Math.round(base * (1 - pct / 100)) : undefined;
    setFormData(prev => ({
      ...prev,
      discount_percentage: pct,
      discount_price: discountPrice
    }));
  };

  const handleAddSpec = () => {
    if (!specKey.trim() || !specValue.trim()) return;
    setFormData(prev => ({
      ...prev,
      specs: {
        ...(prev.specs || {}),
        [specKey.trim()]: specValue.trim()
      }
    }));
    setSpecKey('');
    setSpecValue('');
  };

  const handleRemoveSpec = (keyToRemove: string) => {
    setFormData(prev => {
      const nextSpecs = { ...(prev.specs || {}) };
      delete nextSpecs[keyToRemove];
      return { ...prev, specs: nextSpecs };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) {
      setErrorMsg('لطفاً عنوان کالا را وارد نمایید.');
      return;
    }
    if (!formData.base_price || formData.base_price <= 0) {
      setErrorMsg('قیمت پایه کالا باید عددی مثبت و معتبر باشد.');
      return;
    }

    const finalSlug = formData.slug?.trim() || handleSlugify(formData.name);
    const categorySlug = formData.category_slug || categories[0]?.slug || 'networking';
    const matchingCategory = categories.find(c => c.slug === categorySlug) || categories[0];
    const categoryId = matchingCategory?.id || formData.category_id || 1;
    const categoryName = matchingCategory?.name || formData.category_name || 'تجهیزات شبکه';
    const stockQty = Number(formData.stock_quantity || 1);
    const effectivePrice = formData.discount_price ?? Number(formData.base_price);

    if (productToEdit) {
      updateProduct(productToEdit.id, {
        ...formData,
        category_id: categoryId,
        category_slug: categorySlug,
        category_name: categoryName,
        slug: finalSlug,
        stock_quantity: stockQty,
        initial_stock: stockQty,
        effective_price: effectivePrice,
      });
    } else {
      addProduct({
        name: formData.name,
        title_en: formData.title_en,
        slug: finalSlug,
        sku: formData.sku || 'NOV-' + Math.floor(Math.random() * 89999 + 10000),
        category_id: categoryId,
        category_slug: categorySlug,
        category_name: categoryName,
        brand: formData.brand || 'NoovinNet',
        base_price: Number(formData.base_price),
        discount_percentage: Number(formData.discount_percentage || 0),
        discount_price: formData.discount_price,
        effective_price: effectivePrice,
        currency: 'تومان',
        in_stock: formData.in_stock ?? true,
        stock_quantity: stockQty,
        initial_stock: stockQty,
        is_featured: !!formData.is_featured,
        is_active: formData.is_active ?? true,
        rating: formData.rating || 5.0,
        reviews_count: formData.reviews_count || 0,
        image: formData.image || 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=800&auto=format&fit=crop&q=80',
        description: formData.description || '',
        guarantee: formData.guarantee || 'گارانتی ۲۴ ماهه نوین‌نت',
        specs: formData.specs || {},
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6" dir="rtl">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-3xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-850/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/10 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300 flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {productToEdit ? `ویرایش کالا: ${productToEdit.name}` : 'افزودن کالای جدید به انبار و فروشگاه'}
              </h2>
              <p className="text-xs text-slate-400">
                مشخصات، قیمت، دسته‌بندی و ویژگی‌های فنی محصول
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 text-rose-600 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Basic Info Section */}
          <div className="space-y-4">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              اطلاعات پایه کالا
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  نام فارسی کالا *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name || ''}
                  onChange={e => {
                    const name = e.target.value;
                    setFormData(prev => ({
                      ...prev,
                      name,
                      slug: !productToEdit ? handleSlugify(name) : prev.slug
                    }));
                  }}
                  placeholder="مثال: روتر میکروتیک RB750Gr3"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  نام لاتین / مدل انگلیسی
                </label>
                <input
                  type="text"
                  value={formData.title_en || ''}
                  onChange={e => setFormData(prev => ({ ...prev, title_en: e.target.value }))}
                  placeholder="MikroTik hEX RB750Gr3 Router"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 font-mono"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  شناسه URL (اسلاگ یکتا)
                </label>
                <input
                  type="text"
                  value={formData.slug || ''}
                  onChange={e => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                  placeholder="mikrotik-rb750gr3"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 font-mono"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  کد انبارداری (SKU)
                </label>
                <input
                  type="text"
                  value={formData.sku || ''}
                  onChange={e => setFormData(prev => ({ ...prev, sku: e.target.value }))}
                  placeholder="NOV-75034"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 font-mono"
                  dir="ltr"
                />
              </div>
            </div>

            {/* Category & Brand */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  دسته‌بندی کالا
                </label>
                <select
                  value={formData.category_slug}
                  onChange={e => setFormData(prev => ({ ...prev, category_slug: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                >
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.slug}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  برند / سازنده
                </label>
                <input
                  type="text"
                  value={formData.brand || ''}
                  onChange={e => setFormData(prev => ({ ...prev, brand: e.target.value }))}
                  placeholder="مثال: MikroTik, Cisco, Ubiquiti"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Pricing & Inventory */}
          <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              قیمت‌گذاری و انبارداری
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  قیمت اصلی (تومان) *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="10000"
                  value={formData.base_price || ''}
                  onChange={e => handleBasePriceChange(Number(e.target.value))}
                  placeholder="2500000"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  درصد تخفیف (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="99"
                  value={formData.discount_percentage ?? 0}
                  onChange={e => handleDiscountPctChange(Number(e.target.value))}
                  placeholder="10"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  قیمت با تخفیف (تومان)
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.discount_price ?? ''}
                  onChange={e => setFormData(prev => ({ ...prev, discount_price: e.target.value ? Number(e.target.value) : undefined }))}
                  placeholder="محاسبه خودکار"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  موجودی عددی در انبار
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.stock_quantity ?? 0}
                  onChange={e => {
                    const qty = Number(e.target.value);
                    setFormData(prev => ({
                      ...prev,
                      stock_quantity: qty,
                      in_stock: qty > 0
                    }));
                  }}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              {/* Toggles */}
              <div className="flex items-center gap-3 pt-6">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.in_stock ?? true}
                    onChange={e => setFormData(prev => ({ ...prev, in_stock: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-600"></div>
                  <span className="ms-2.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                    موجود در انبار
                  </span>
                </label>
              </div>

              <div className="flex items-center gap-3 pt-6">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_featured ?? false}
                    onChange={e => setFormData(prev => ({ ...prev, is_featured: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
                  <span className="ms-2.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                    پیشنهاد ویژه
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Media & Details */}
          <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              تصویر و گارانتی
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  آدرس تصویر کالا (Image URL)
                </label>
                <input
                  type="url"
                  value={formData.image || ''}
                  onChange={e => setFormData(prev => ({ ...prev, image: e.target.value }))}
                  placeholder="https://..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 font-mono"
                  dir="ltr"
                />
              </div>

              <div className="flex items-center justify-center p-2 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <img
                  src={formData.image || 'https://via.placeholder.com/150'}
                  alt="Preview"
                  className="h-20 w-20 object-contain rounded-lg"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=300&auto=format&fit=crop&q=80';
                  }}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                شرایط گارانتی و ضمانت
              </label>
              <input
                type="text"
                value={formData.guarantee || ''}
                onChange={e => setFormData(prev => ({ ...prev, guarantee: e.target.value }))}
                placeholder="گارانتی ۲۴ ماهه تعویض نوین‌نت"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                توضیحات و نقد و بررسی کالا
              </label>
              <textarea
                rows={3}
                value={formData.description || ''}
                onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="توضیحات تکمیلی پیرامون ساختار سخت‌افزاری و کاربرد..."
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Technical Specifications Key-Value Editor */}
          <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>مشخصات فنی و جدول ویژگی‌ها</span>
              <span className="text-[11px] font-normal text-slate-500">({Object.keys(formData.specs || {}).length} ویژگی ثبت‌شده)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
              <input
                type="text"
                value={specKey}
                onChange={e => setSpecKey(e.target.value)}
                placeholder="عنوان (مثلاً پردازنده)"
                className="sm:col-span-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
              />
              <input
                type="text"
                value={specValue}
                onChange={e => setSpecValue(e.target.value)}
                placeholder="مقدار (مثلاً Dual Core 880MHz)"
                className="sm:col-span-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
              />
              <button
                type="button"
                onClick={handleAddSpec}
                className="flex items-center justify-center gap-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>افزودن</span>
              </button>
            </div>

            {/* Specs Badges / List */}
            {formData.specs && Object.keys(formData.specs).length > 0 && (
              <div className="space-y-1.5 pt-2">
                {Object.entries(formData.specs).map(([key, val]) => (
                  <div 
                    key={key}
                    className="flex items-center justify-between px-3 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs border border-slate-200/60 dark:border-slate-700"
                  >
                    <span className="font-bold text-slate-700 dark:text-slate-300">{key}:</span>
                    <span className="text-slate-600 dark:text-slate-400 font-mono">{val}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSpec(key)}
                      className="p-1 text-slate-400 hover:text-rose-500 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </form>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-850/50 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 text-xs font-bold transition"
          >
            انصراف
          </button>

          <button
            id="admin-save-product-btn"
            type="button"
            onClick={handleSubmit}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-blue-600/30 transition active:scale-95"
          >
            <Check className="w-4 h-4" />
            <span>{productToEdit ? 'ذخیره تغییرات کالا' : 'ثبت و انتشار کالا در فروشگاه'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
