import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  ArrowLeft,
  Save,
  AlertCircle,
  Eye,
  CheckCircle2,
} from 'lucide-react';
import type {
  AdminProductAttributeDefinition,
  DemoCategory,
  DemoProduct,
  ProductColorOption,
  ProductCustomOption,
  ProductFormState,
  ProductType,
  ProductVariant,
  SectionKey,
} from './product-editor/types';
import {
  buildVariantSku,
  calculateFinalPrice,
  cleanText,
  slugify,
} from './product-editor/utils';
import { ProductInfoSection } from './product-editor/ProductInfoSection';
import { ProductPricingSection } from './product-editor/ProductPricingSection';
import { ProductImagesSection } from './product-editor/ProductImagesSection';
import { ProductVariantsSection } from './product-editor/ProductVariantsSection';
import { ProductDescriptionSection } from './product-editor/ProductDescriptionSection';
import { ProductPreviewModal } from './product-editor/ProductPreviewModal';
import './product-workspace.css';

const SECTIONS: { id: SectionKey; label: string }[] = [
  { id: 'info', label: 'اطلاعات محصول' },
  { id: 'pricing', label: 'قیمت' },
  { id: 'images', label: 'تصاویر' },
  { id: 'variants', label: 'تنوع' },
  { id: 'description', label: 'توضیحات' },
];

const fallbackImage = 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=600&auto=format&fit=crop&q=80';

export function ProductEditorWorkspace({
  product,
  categories,
  existingSkus,
  liveMode,
  onClose,
  onSave,
}: {
  product: DemoProduct | null;
  categories: DemoCategory[];
  definitions: AdminProductAttributeDefinition[];
  existingSkus: string[];
  onManageCategoryAttributes: (category: DemoCategory) => void;
  liveMode: boolean;
  onClose: () => void;
  onSave: (product: DemoProduct) => Promise<void>;
}) {
  const initialForm = useMemo<ProductFormState>(() => {
    if (product) {
      const hasVariants = Boolean(
        (product.colors && product.colors.length > 0) ||
        (product.options && product.options.length > 0) ||
        (product.variants && product.variants.length > 0)
      );

      const rawOriginalPrice = product.original_price ?? product.originalPrice ?? product.regularPrice ?? product.basePrice ?? product.price ?? 0;
      let basePrice = Number(rawOriginalPrice);
      let discountPercent = 0;
      const rawDiscount = product.discount_percent ?? product.discountPercent ?? product.discount_percentage;
      if (rawDiscount !== undefined && rawDiscount !== null && Number(rawDiscount) >= 0) {
        discountPercent = Math.max(0, Math.min(100, Number(rawDiscount)));
        basePrice = Number(rawOriginalPrice);
      } else if (product.regularPrice && product.regularPrice > product.price) {
        basePrice = Number(product.regularPrice);
        discountPercent = Math.round(((product.regularPrice - product.price) / product.regularPrice) * 100);
      }
      const calculatedInitialPrice = discountPercent > 0 ? calculateFinalPrice(basePrice, discountPercent) : (product.price || basePrice);

      const variants = (product.variants ?? []).map((v, idx) => {
        const vFinal = v.price || 0;
        const vOrig = v.original_price ?? (vFinal || basePrice);
        const vDisc = v.discount_percent !== undefined && v.discount_percent !== null
          ? Math.max(0, Math.min(100, Number(v.discount_percent)))
          : (vOrig > vFinal ? Math.round(((vOrig - vFinal) / vOrig) * 100) : 0);
        const rawId = v.id !== undefined && v.id !== null ? String(v.id).trim() : '';
        const validId = rawId && rawId !== 'undefined' && rawId !== 'null' && rawId !== 'NaN'
          ? rawId
          : `v_${product.id || 'p'}_${idx}_${(v.color || 'var').replace(/\s+/g, '_')}`;
        return {
          ...v,
          id: validId,
          original_price: vOrig,
          discount_percent: vDisc,
          price: vDisc > 0 ? calculateFinalPrice(vOrig, vDisc) : vFinal,
          stock: Math.max(0, v.stock ?? 5),
          is_active: v.is_active !== false,
        };
      });

      return {
        ...product,
        basePrice,
        discountPercent,
        price: calculatedInitialPrice,
        productType: hasVariants ? 'variable' : 'simple',
        colors: (product.colors ?? []).map((c) => ({ ...c })),
        options: (product.options ?? []).map((o) => ({ ...o, values: [...o.values] })),
        attributes: (product.attributes ?? []).map((a) => ({ ...a })),
        facetValues: { ...(product.facetValues ?? {}) },
        variants,
        gallery: product.gallery?.length ? [...product.gallery] : product.image ? [product.image] : [],
        slug: slugify(product.name),
        warranty: product.warranty || 'ضمانت ۷ روزه اصالت و سلامت نوین‌نت',
        lowStockThreshold: 3,
      };
    }

    const defaultCategory = categories[0]?.name ?? '';
    const defaultCatId = categories[0]?.id;
    return {
      id: 0,
      name: '',
      sku: '',
      basePrice: 0,
      discountPercent: 0,
      price: 0,
      regularPrice: 0,
      stock: 10,
      lowStockThreshold: 3,
      category: defaultCategory,
      categoryId: defaultCatId,
      brand: '',
      active: true,
      featured: false,
      image: liveMode ? '' : fallbackImage,
      gallery: liveMode ? [] : [fallbackImage],
      description: '',
      shortDescription: '',
      warranty: 'ضمانت ۷ روزه اصالت و سلامت نوین‌نت',
      sold: 0,
      updated: 'همین حالا',
      productType: 'simple',
      colors: [],
      options: [],
      attributes: [],
      facetValues: {},
      variants: [],
      slug: '',
    };
  }, [product, categories, liveMode]);

  const [form, setForm] = useState<ProductFormState>(initialForm);
  const [activeSection, setActiveSection] = useState<SectionKey>('info');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  const suggestedSku = useMemo(() => {
    const catCode = form.category ? form.category.slice(0, 3).toUpperCase() : 'PRD';
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `${catCode}-${rand}`;
  }, [form.category]);

  const updateForm = <K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // Section completion status
  const getSectionStatus = (sectionId: SectionKey): boolean => {
    if (sectionId === 'info') {
      return Boolean(cleanText(form.name) && cleanText(form.category));
    }
    if (sectionId === 'pricing') {
      if (form.productType === 'simple') {
        return form.basePrice > 0 && form.stock >= 0;
      }
      const activeVariants = form.variants.filter((v) => v.is_active !== false);
      return activeVariants.length > 0 && activeVariants.every((v) => v.price > 0);
    }
    if (sectionId === 'images') {
      return Boolean(form.image || form.gallery.length > 0);
    }
    if (sectionId === 'variants') {
      if (form.productType === 'simple') return true; // Simple product complete automatically
      return form.variants.filter((v) => v.is_active !== false).length > 0;
    }
    if (sectionId === 'description') {
      return Boolean(cleanText(form.description) || cleanText(form.shortDescription));
    }
    return false;
  };

  // Navigation handlers
  const currentSectionIndex = SECTIONS.findIndex((s) => s.id === activeSection);

  const handleNextSection = () => {
    if (currentSectionIndex < SECTIONS.length - 1) {
      setActiveSection(SECTIONS[currentSectionIndex + 1].id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrevSection = () => {
    if (currentSectionIndex > 0) {
      setActiveSection(SECTIONS[currentSectionIndex - 1].id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Variant Synchronization logic
  const syncVariants = (
    colors: ProductColorOption[],
    options: ProductCustomOption[],
    basePrice: number,
    baseSku: string
  ) => {
    const activeColors = colors.length > 0 ? colors : [{ name: '', hex: '' }];
    const optionAxes = options.filter((o) => o.values.length > 0);

    const cartesianOptionValues = (axes: ProductCustomOption[]): Record<string, string>[] => {
      if (axes.length === 0) return [{}];
      const [first, ...rest] = axes;
      const restCombos = cartesianOptionValues(rest);
      const results: Record<string, string>[] = [];
      first.values.forEach((val) => {
        restCombos.forEach((c) => {
          results.push({
            [first.id]: val,
            [first.name]: val,
            ...c,
          });
        });
      });
      return results;
    };

    const optCombos = cartesianOptionValues(optionAxes);
    const newVariants: ProductVariant[] = [];

    activeColors.forEach((c, cIdx) => {
      optCombos.forEach((optValues, oIdx) => {
        const existing = form.variants.find((v) => {
          const matchCol = (v.color || '').trim() === (c.name || '').trim();
          const matchOpts = optionAxes.every((axis) => {
            const desiredVal = optValues[axis.id] || optValues[axis.name];
            const vVal = v.optionValues?.[axis.id] || v.optionValues?.[axis.name];
            return !desiredVal || desiredVal === vVal;
          });
          return matchCol && matchOpts;
        });

        const cImg = c.image || c.images?.[0];

        if (existing) {
          const orig = existing.original_price ?? existing.price ?? basePrice;
          const disc = existing.discount_percent ?? 0;
          const rawId = existing.id !== undefined && existing.id !== null ? String(existing.id).trim() : '';
          const validId = rawId && rawId !== 'undefined' && rawId !== 'null' && rawId !== 'NaN'
            ? rawId
            : `v_${form.id || 'p'}_${cIdx}_${oIdx}_${(c.name || 'var').replace(/\s+/g, '_')}`;

          newVariants.push({
            ...existing,
            id: validId,
            color: c.name,
            image: existing.image || cImg,
            optionValues: optValues,
            original_price: orig,
            discount_percent: disc,
            price: calculateFinalPrice(orig, disc),
            stock: Math.max(0, existing.stock ?? 5),
            is_active: existing.is_active !== false,
          });
        } else {
          const orig = basePrice || 0;
          const disc = form.discountPercent || 0;
          const genId = `v_${form.id || 'p'}_${cIdx}_${oIdx}_${(c.name || 'var').replace(/\s+/g, '_')}_${Math.random().toString(36).slice(2, 6)}`;
          const newVar: ProductVariant = {
            id: genId,
            color: c.name,
            image: cImg,
            optionValues: optValues,
            original_price: orig,
            discount_percent: disc,
            price: calculateFinalPrice(orig, disc),
            stock: 5,
            is_active: true,
          };
          newVar.sku = buildVariantSku(baseSku, newVar);
          newVariants.push(newVar);
        }
      });
    });

    updateForm('variants', newVariants.slice(0, 100));
  };

  const handleProductTypeChange = (type: ProductType) => {
    updateForm('productType', type);
    if (type === 'variable' && form.variants.length === 0) {
      syncVariants(form.colors, form.options, form.basePrice || form.price, form.sku || suggestedSku);
    }
  };

  // Form Validation
  const validateForm = (): boolean => {
    if (!cleanText(form.name)) {
      setActiveSection('info');
      setErrorMessage('نام محصول الزامی است.');
      return false;
    }
    if (!cleanText(form.category)) {
      setActiveSection('info');
      setErrorMessage('انتخاب دسته‌بندی محصول الزامی است.');
      return false;
    }

    if (form.productType === 'simple') {
      if (form.basePrice <= 0) {
        setActiveSection('pricing');
        setErrorMessage('لطفاً قیمت اصلی محصول را وارد کنید.');
        return false;
      }
    } else {
      const activeVars = form.variants.filter((v) => v.is_active !== false);
      if (activeVars.length === 0) {
        setActiveSection('variants');
        setErrorMessage('محصول دارای تنوع باید حداقل یک تنوع فعال داشته باشد.');
        return false;
      }
      const hasInvalidPrice = activeVars.some((v) => (v.price || 0) <= 0);
      if (hasInvalidPrice) {
        setActiveSection('variants');
        setErrorMessage('قیمت تنوع‌های فعال باید بیشتر از صفر باشد.');
        return false;
      }
    }

    const currentSku = form.sku || suggestedSku;
    if (existingSkus.includes(currentSku.toUpperCase()) && !product) {
      setActiveSection('info');
      setErrorMessage('این شناسه SKU قبلاً برای محصول دیگری ثبت شده است.');
      return false;
    }

    setErrorMessage('');
    return true;
  };

  // Save submission
  const handleSave = async (publishActive = true) => {
    if (!validateForm()) return;
    setIsSaving(true);
    setErrorMessage('');

    try {
      const finalSku = (form.sku || suggestedSku).toUpperCase();
      const isVariable = form.productType === 'variable';

      const finalColors = isVariable ? form.colors : [];
      const finalOptions = isVariable ? form.options.filter((o) => o.values.length > 0) : [];
      const finalVariants = isVariable ? form.variants.filter((v) => v.is_active !== false) : [];

      let finalPrice = form.price;
      let finalStock = form.stock;
      let regularPrice: number | undefined = undefined;

      if (isVariable) {
        if (finalVariants.length > 0) {
          const prices = finalVariants.map((v) => v.price).filter((p) => p > 0);
          finalPrice = prices.length ? Math.min(...prices) : form.price;
          finalStock = finalVariants.reduce((sum, v) => sum + (v.stock || 0), 0);
        }
      } else {
        finalPrice = calculateFinalPrice(form.basePrice || 0, form.discountPercent || 0);
        if (form.discountPercent > 0 && form.basePrice > 0) {
          regularPrice = form.basePrice;
        }
      }

      const finalGallery = form.gallery.length ? form.gallery : form.image ? [form.image] : [];
      const finalCover = form.image || finalGallery[0] || '';

      const payload: DemoProduct = {
        id: product ? product.id : Date.now(),
        name: cleanText(form.name),
        sku: finalSku,
        price: finalPrice,
        basePrice: form.basePrice,
        regularPrice: regularPrice ?? form.basePrice,
        originalPrice: form.basePrice,
        original_price: form.basePrice,
        discountPercent: form.discountPercent,
        discount_percent: form.discountPercent,
        stock: finalStock,
        category: form.category,
        categoryId: form.categoryId,
        brand: form.brand ? cleanText(form.brand) : undefined,
        active: publishActive,
        featured: form.featured,
        image: finalCover,
        gallery: finalGallery,
        description: cleanText(form.description),
        shortDescription: cleanText(form.shortDescription),
        warranty: cleanText(form.warranty),
        sold: product ? product.sold : 0,
        updated: 'همین حالا',
        colors: finalColors,
        options: finalOptions,
        attributes: form.attributes,
        facetValues: form.facetValues,
        variants: finalVariants,
      };

      await onSave(payload);
      onClose();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'ذخیره کالا با خطا مواجه شد.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="product-workspace-root" dir="rtl">
      {/* ── ۱. نوار بالای صفحه (Header & Actions) ── */}
      <div className="page-topbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div className="page-title-wrap">
          <button
            type="button"
            className="edit-link"
            onClick={onClose}
            disabled={isSaving}
          >
            <ArrowRight size={13} />
            بازگشت به فهرست
          </button>
          <h1 style={{ fontSize: '15px', fontWeight: 800, margin: 0 }}>
            {product ? `ویرایش کالا: ${product.name || 'بدون عنوان'}` : 'ثبت کالای جدید'}
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className="action-btn secondary"
            onClick={() => setShowPreviewModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <Eye size={13} />
            پیش‌نمایش در فروشگاه
          </button>

          <button
            type="button"
            className="action-btn primary"
            onClick={() => handleSave(form.active)}
            disabled={isSaving}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#16a34a',
              borderColor: '#15803d',
              color: '#ffffff',
              padding: '8px 16px',
              fontSize: '12px',
              fontWeight: 800,
            }}
          >
            <Save size={14} />
            {isSaving ? 'در حال ذخیره...' : 'ذخیره محصول'}
          </button>
        </div>
      </div>

      {/* ── پیام خطا در صورت وجود ── */}
      {errorMessage && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 14px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '7px',
            color: '#b91c1c',
            fontSize: '11px',
            fontWeight: 700,
          }}
        >
          <AlertCircle size={15} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* ── ۲. تب‌های ناوبری بخش‌ها (با وضعیت تکمیل ✓ یا ○) ── */}
      <div className="product-section-nav-wrap">
        <div className="product-section-tabs">
          {SECTIONS.map((sec) => {
            const isComplete = getSectionStatus(sec.id);
            return (
              <button
                key={sec.id}
                type="button"
                className={`section-nav-item ${activeSection === sec.id ? 'active' : ''}`}
                onClick={() => setActiveSection(sec.id)}
              >
                <span className={`section-status-marker ${isComplete ? 'complete' : 'incomplete'}`}>
                  {isComplete ? '✓' : '○'}
                </span>
                <span>{sec.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── ۳. پنل بخش فعال ── */}
      <div className="product-active-panel">
        <div className="product-panel-header">
          <div className="product-panel-header-title">
            <h2>{SECTIONS.find((s) => s.id === activeSection)?.label}</h2>
            <small>
              {activeSection === 'info' && 'تعریف مشخصات کلیدی، دسته‌بندی و وضعیت انتشار کالا'}
              {activeSection === 'pricing' && 'تنظیم قیمت اصلی، درصد تخفیف و موجودی انبار'}
              {activeSection === 'images' && 'بارگذاری تصویر شاخص و گالری تصاویر'}
              {activeSection === 'variants' && 'مدیریت ویژگی‌های تنوع (رنگ، سایز، ظرفیت) و قیمت‌های متغیر'}
              {activeSection === 'description' && 'توضیحات جامع کالا و جدول مشخصات فنی'}
            </small>
          </div>
        </div>

        {activeSection === 'info' && (
          <ProductInfoSection
            form={form}
            categories={categories}
            suggestedSku={suggestedSku}
            onChangeType={handleProductTypeChange}
            updateForm={updateForm}
          />
        )}

        {activeSection === 'pricing' && (
          <ProductPricingSection
            form={form}
            updateForm={updateForm}
            onGoToVariants={() => setActiveSection('variants')}
          />
        )}

        {activeSection === 'images' && (
          <ProductImagesSection
            form={form}
            liveMode={liveMode}
            updateForm={updateForm}
            setErrorMessage={setErrorMessage}
          />
        )}

        {activeSection === 'variants' && (
          <ProductVariantsSection
            form={form}
            suggestedSku={suggestedSku}
            updateForm={updateForm}
            syncVariants={syncVariants}
            onConvertToVariable={() => handleProductTypeChange('variable')}
            setErrorMessage={setErrorMessage}
            liveMode={liveMode}
          />
        )}

        {activeSection === 'description' && (
          <ProductDescriptionSection form={form} updateForm={updateForm} />
        )}

        {/* ── ۴. ناوبری پاورقی بخش ── */}
        <div className="section-footer-nav">
          <div>
            {currentSectionIndex > 0 ? (
              <button
                type="button"
                className="action-btn secondary"
                onClick={handlePrevSection}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
              >
                <ArrowRight size={13} />
                مرحله قبل
              </button>
            ) : (
              <div />
            )}
          </div>

          <div className="section-footer-nav-right">
            {currentSectionIndex < SECTIONS.length - 1 ? (
              <button
                type="button"
                className="action-btn primary"
                onClick={handleNextSection}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
              >
                مرحله بعد: {SECTIONS[currentSectionIndex + 1].label}
                <ArrowLeft size={13} />
              </button>
            ) : (
              <button
                type="button"
                className="action-btn primary"
                onClick={() => handleSave(form.active)}
                disabled={isSaving}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  background: '#16a34a',
                  borderColor: '#15803d',
                }}
              >
                <Save size={14} />
                {isSaving ? 'در حال ذخیره...' : 'ذخیره نهایی محصول'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── ۵. نوار چسبان اختصاصی موبایل (Sticky Bottom Bar) ── */}
      <div className="product-mobile-sticky-bar">
        {currentSectionIndex < SECTIONS.length - 1 ? (
          <button
            type="button"
            className="action-btn secondary"
            onClick={handleNextSection}
            style={{ background: '#f8fafc' }}
          >
            مرحله بعد ({SECTIONS[currentSectionIndex + 1].label})
          </button>
        ) : null}

        <button
          type="button"
          className="action-btn primary"
          onClick={() => handleSave(form.active)}
          disabled={isSaving}
          style={{ background: '#16a34a', color: '#ffffff', borderColor: '#15803d' }}
        >
          <Save size={14} />
          {isSaving ? 'ذخیره...' : 'ذخیره محصول'}
        </button>
      </div>

      {/* ── ۶. پیش‌نمایش کارت کالا ── */}
      {showPreviewModal && (
        <ProductPreviewModal form={form} onClose={() => setShowPreviewModal(false)} />
      )}
    </div>
  );
}
