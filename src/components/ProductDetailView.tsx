import React, { useEffect, useMemo, useState } from 'react';
import { 
  ArrowRight, 
  ShoppingCart, 
  Heart, 
  ShieldCheck, 
  Truck, 
  RotateCcw, 
  Star, 
  Check, 
  Share2,
  Headphones,
  ThumbsUp,
  ThumbsDown,
  MessageSquarePlus,
  Layers,
  Sparkles,
  Zap,
  Info,
  CheckCircle2,
  User,
  X,
  PackageX,
  Store,
  Compass,
  Palette
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Product, ProductComment, ProductVariant } from '../types';
import { ProductDetailSkeleton } from './common/Skeletons';
import { api } from '../services/api';
import { updateDocumentSEO } from '../utils/seo';
import { getStorefrontProducts, isStorefrontReadyProduct } from '../utils/catalogQuality';
import { getDefaultSellableVariant, getFirstActiveVariant, isProductPurchasable, isSellableVariant } from '../utils/productAvailability';
import { formatMoney } from '../utils/money';

// Storefront product detail: render API-backed specifications defensively so metadata objects never disrupt the purchase journey.
const getVariantColorName = (variant: ProductVariant): string | undefined => {
  const value = variant.attributes?.color || variant.attributes?.رنگ;
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
};

const getVariantConfigurationName = (variant: ProductVariant | undefined, options: NonNullable<Product['variant_options']>): string | undefined => {
  if (!variant) return undefined;
  const values = options.map((option) => variant.attributes?.[option.key]).filter((value): value is string => Boolean(value?.trim()));
  if (values.length > 0) return values.join(' · ');
  const fallback = variant.attributes?.configuration || variant.attributes?.پیکربندی;
  return typeof fallback === 'string' && fallback.trim() ? fallback.trim() : undefined;
};

const getPreferredVariant = (product: Product): ProductVariant | undefined => {
  const colorVariants = (product.variants || []).filter((variant) => variant.is_active && Boolean(getVariantColorName(variant)));
  return colorVariants.find(isSellableVariant) ?? getDefaultSellableVariant(product) ?? getFirstActiveVariant(product);
};

const formatSpecValue = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);

  if (Array.isArray(value)) {
    return value.map(formatSpecValue).filter((item) => item !== '—').join('، ') || '—';
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const label = record.name ?? record.title ?? record.label ?? record.value;
    const hex = record.hex;

    if (label !== undefined && hex !== undefined) return `${String(label)} (${String(hex)})`;
    if (label !== undefined) return String(label);

    return Object.values(record).map(formatSpecValue).filter((item) => item !== '—').join('، ') || '—';
  }

  return String(value);
};

export const ProductDetailView: React.FC = () => {
  const { 
    selectedProductSlug, 
    products, 
    addToCart, 
    toggleFavorite, 
    isFavorite, 
    setActiveView,
    navigateToProduct,
    navigateToCategory,
    copyShareLink,
    isLoadingData: isCatalogLoading
  } = useApp();

  const [product, setProduct] = useState<Product | null>(null);
  const [isResolving, setIsResolving] = useState<boolean>(true);
  const [isNotFound, setIsNotFound] = useState<boolean>(false);

  const [selectedVariantId, setSelectedVariantId] = useState<number | undefined>(undefined);
  const [selectedColor, setSelectedColor] = useState<string | undefined>(undefined);
  const [selectedConfiguration, setSelectedConfiguration] = useState<string | undefined>(undefined);
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState<string | undefined>(undefined);
  const [addedToast, setAddedToast] = useState(false);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [activeTab, setActiveTab] = useState<'specs' | 'comments'>('specs');

  // Reviews state (local so user can submit new review interactively)
  const [commentsList, setCommentsList] = useState<ProductComment[]>([]);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [newRating, setNewRating] = useState(5);
  const [newAuthor, setNewAuthor] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newPros, setNewPros] = useState('');
  const [newCons, setNewCons] = useState('');
  const [reviewSuccess, setReviewSuccess] = useState(false);

  // Likes tracking
  const [userReactions, setUserReactions] = useState<Record<number, 'like' | 'dislike'>>({});
  const storefrontProducts = useMemo(() => getStorefrontProducts(products || []), [products]);

  // Resolve Product based on selectedProductSlug independently with dedicated cache
  useEffect(() => {
    let isCancelled = false;

    const resolveProduct = async () => {
      if (!selectedProductSlug) {
        setIsNotFound(true);
        setIsResolving(false);
        setProduct(null);
        return;
      }

      setIsResolving(true);
      setIsNotFound(false);

      // 1. Fast Cache / In-memory check
      const inMemoryFound = storefrontProducts.find(p => p.slug === selectedProductSlug);
      if (inMemoryFound) {
        if (!isCancelled) {
          setProduct(inMemoryFound);
          const firstVariant = getPreferredVariant(inMemoryFound);
          setSelectedVariantId(firstVariant?.id);
          const initColor = firstVariant ? getVariantColorName(firstVariant) : inMemoryFound.colors?.[0]?.name;
          const colorObj = inMemoryFound.colors?.find(c => c.name.trim().toLowerCase() === initColor?.trim().toLowerCase());
          setSelectedColor(initColor);
          setSelectedConfiguration(getVariantConfigurationName(firstVariant, inMemoryFound.variant_options ?? []));
          const initialImage = colorObj?.image || colorObj?.images?.[0] || firstVariant?.image_url || inMemoryFound.image_url;
          setActiveImage(initialImage);
          setCommentsList(inMemoryFound.comments || []);
          setQuantity(1);
          setIsResolving(false);
          setIsNotFound(false);
        }
        return;
      }

      // 2. Resolve via api.getProductBySlug (uses dedicated cache: `product:${slug}`)
      try {
        const fetchedProduct = await api.getProductBySlug(selectedProductSlug);
        if (isCancelled) return;

        if (fetchedProduct && isStorefrontReadyProduct(fetchedProduct)) {
          setProduct(fetchedProduct);
          const firstVariant = getPreferredVariant(fetchedProduct);
          setSelectedVariantId(firstVariant?.id);
          const initColor = firstVariant ? getVariantColorName(firstVariant) : fetchedProduct.colors?.[0]?.name;
          const colorObj = fetchedProduct.colors?.find(c => c.name.trim().toLowerCase() === initColor?.trim().toLowerCase());
          setSelectedColor(initColor);
          setSelectedConfiguration(getVariantConfigurationName(firstVariant, fetchedProduct.variant_options ?? []));
          const initialImage = colorObj?.image || colorObj?.images?.[0] || firstVariant?.image_url || fetchedProduct.image_url;
          setActiveImage(initialImage);
          setCommentsList(fetchedProduct.comments || []);
          setQuantity(1);
          setIsNotFound(false);
        } else {
          setProduct(null);
          setIsNotFound(true);
        }
      } catch {
        if (!isCancelled) {
          setProduct(null);
          setIsNotFound(true);
        }
      } finally {
        if (!isCancelled) {
          setIsResolving(false);
        }
      }
    };

    resolveProduct();

    return () => {
      isCancelled = true;
    };
  }, [selectedProductSlug, storefrontProducts]);

  // Dynamic SEO & Metadata Effect
  useEffect(() => {
    if (product) {
      updateDocumentSEO({
        title: `${product.name} | نوین‌نت`,
        description: product.short_description || product.description || `مشخصات، قیمت و خرید آنلاین ${product.name} در نوین‌نت`,
        canonical: `/product/${product.slug}`,
        image: product.image_url,
        ogType: 'product'
      });
    } else if (isNotFound) {
      updateDocumentSEO({
        title: 'محصول یافت نشد | نوین‌نت',
        description: 'متأسفانه محصول مورد نظر پیدا نشد یا ممکن است ناموجود شده باشد.',
        canonical: window.location.pathname,
        ogType: 'website'
      });
    }
  }, [product, isNotFound]);

  const selectedVariant = product?.variants?.find((variant) => variant.id === selectedVariantId)
    ?? (product ? (getDefaultSellableVariant(product) ?? getFirstActiveVariant(product)) : undefined);
  const activeVariants = (product?.variants || []).filter((variant) => variant.is_active !== false);
  const variantOptions = product?.variant_options ?? [];
  const activeColorVariants = activeVariants.filter((variant) => Boolean(getVariantColorName(variant)));
  const configurationChoices = activeVariants.reduce<Array<{ name: string; variants: ProductVariant[] }>>((choices, variant) => {
    const name = getVariantConfigurationName(variant, variantOptions);
    if (!name) return choices;
    const existing = choices.find((choice) => choice.name === name);
    if (existing) { existing.variants.push(variant); return choices; }
    return [...choices, { name, variants: [variant] }];
  }, []);
  const colorChoices = useMemo(() => {
    if (!product) return [];
    if (activeColorVariants.length > 0) {
      return activeColorVariants.reduce<Array<{ name: string; hex: string; variants: ProductVariant[] }>>((choices, variant) => {
        const name = getVariantColorName(variant);
        if (!name) return choices;
        const existing = choices.find((choice) => choice.name === name);
        if (existing) { existing.variants.push(variant); return choices; }
        const configuredColor = product.colors?.find((color) => color.name === name);
        return [...choices, { name, hex: configuredColor?.hex || '#64748b', variants: [variant] }];
      }, []);
    }
    if (product.colors && product.colors.length > 0) {
      return product.colors.map((c) => ({
        name: c.name,
        hex: c.hex || '#64748b',
        variants: activeVariants,
      }));
    }
    return [];
  }, [activeColorVariants, product, activeVariants]);

  const packageVariants = activeVariants.filter((variant) => !getVariantColorName(variant) && !getVariantConfigurationName(variant, variantOptions));

  const selectVariant = (variant: ProductVariant) => {
    if (!product) return;
    setSelectedVariantId(variant.id);
    const color = getVariantColorName(variant);
    setSelectedColor(color);
    setSelectedConfiguration(getVariantConfigurationName(variant, variantOptions));
    const colorObj = product.colors?.find((c) => c.name.trim().toLowerCase() === color?.trim().toLowerCase());
    const primaryImg = colorObj?.image || colorObj?.images?.[0] || variant.image_url || product.image_url;
    setActiveImage(primaryImg);
    setQuantity(1);
  };

  const selectColor = (colorName: string) => {
    if (!product) return;
    const matchingVariant = activeColorVariants.find((variant) => getVariantColorName(variant) === colorName && getVariantConfigurationName(variant, variantOptions) === selectedConfiguration)
      ?? activeColorVariants.find((variant) => getVariantColorName(variant) === colorName && isSellableVariant(variant))
      ?? activeColorVariants.find((variant) => getVariantColorName(variant) === colorName);
    
    setSelectedColor(colorName);
    const colorObj = product.colors?.find((c) => c.name.trim().toLowerCase() === colorName.trim().toLowerCase());
    const primaryImg = colorObj?.image || colorObj?.images?.[0] || matchingVariant?.image_url || product.image_url;
    setActiveImage(primaryImg);

    if (matchingVariant) {
      setSelectedVariantId(matchingVariant.id);
      setSelectedConfiguration(getVariantConfigurationName(matchingVariant, variantOptions));
      setQuantity(1);
    }
  };

  const selectConfiguration = (configuration: string) => {
    const matchingVariant = activeVariants.find((variant) => getVariantConfigurationName(variant, variantOptions) === configuration && getVariantColorName(variant) === selectedColor && isSellableVariant(variant))
      ?? activeVariants.find((variant) => getVariantConfigurationName(variant, variantOptions) === configuration && isSellableVariant(variant))
      ?? activeVariants.find((variant) => getVariantConfigurationName(variant, variantOptions) === configuration);
    if (matchingVariant) selectVariant(matchingVariant);
  };

  const currentPrice = selectedVariant?.price_override ?? selectedVariant?.effective_price ?? product?.effective_price ?? product?.base_price ?? 0;
  const favorite = product ? isFavorite(product.id) : false;
  const selectedStock = selectedVariant?.stock_quantity ?? product?.stock_quantity ?? (product?.in_stock ? 10 : 0);

  const selectedColorConfig = product?.colors?.find(
    (c) => c.name.trim().toLowerCase() === selectedColor?.trim().toLowerCase()
  );

  const colorSpecificImages = useMemo(() => {
    if (!product) return [];
    const images: string[] = [];
    if (selectedColorConfig?.images && selectedColorConfig.images.length > 0) {
      images.push(...selectedColorConfig.images);
    } else if (selectedColorConfig?.image) {
      images.push(selectedColorConfig.image);
    }
    const variantsForColor = activeVariants.filter((v) => getVariantColorName(v) === selectedColor);
    for (const v of variantsForColor) {
      if (v.images && v.images.length > 0) {
        for (const img of v.images) {
          if (!images.includes(img)) images.push(img);
        }
      } else if (v.image_url && !images.includes(v.image_url)) {
        images.push(v.image_url);
      }
    }
    return images.filter((img): img is string => Boolean(img && img.trim()));
  }, [selectedColorConfig, activeVariants, selectedColor, product]);

  const defaultGalleryImages = useMemo(() => {
    if (!product) return [];
    return Array.from(
      new Set([product.image_url, ...(product.gallery_urls || [])].filter((image): image is string => Boolean(image?.trim())))
    );
  }, [product]);

  const galleryImages = useMemo(() => {
    if (colorSpecificImages.length > 0) {
      return colorSpecificImages;
    }
    return defaultGalleryImages;
  }, [colorSpecificImages, defaultGalleryImages]);

  // Keep activeImage valid when color/gallery changes
  useEffect(() => {
    if (galleryImages.length > 0 && (!activeImage || !galleryImages.includes(activeImage))) {
      setActiveImage(galleryImages[0]);
    }
  }, [galleryImages, activeImage]);

  const isOutOfStock = !product || !isProductPurchasable(product) || (selectedVariant ? !isSellableVariant(selectedVariant) : selectedStock <= 0);
  const isAtQuantityLimit = isOutOfStock || quantity >= selectedStock;

  // Related products from same category
  const relatedProducts = (products || [])
    .filter(p => product && p.id !== product.id && (p.category_slug === product.category_slug || p.brand === product.brand))
    .slice(0, 4);

  // 1. Loading Skeleton state
  if (isResolving) {
    return <ProductDetailSkeleton />;
  }

  // 2. Dedicated Product 404 Not Found State
  if (isNotFound || !product) {
    const suggestedProducts = storefrontProducts.slice(0, 4);

    return (
      <div className="min-h-[70vh] max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* 404 Hero Banner */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-8 sm:p-12 text-center max-w-3xl mx-auto mb-16">
          <div className="w-20 h-20 bg-rose-50 border border-rose-100 rounded-3xl flex items-center justify-center mx-auto mb-6 text-rose-500 shadow-inner">
            <PackageX className="w-10 h-10" />
          </div>

          <span className="inline-block px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-bold font-sans mb-3">
            کد وضعیت: ۴۰۴ | Product Not Found
          </span>

          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mb-3">
            محصول مورد نظر یافت نشد!
          </h1>

          <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-md mx-auto mb-8">
            صفحه محصولی که به دنبال آن هستید ممکن است حذف شده باشد، نام آن تغییر کرده باشد یا آدرس وارد شده نادرست باشد.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => {
                if (window.history.length > 1) {
                  window.history.back();
                } else {
                  navigateToCategory(null);
                }
              }}
              className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2 transition"
            >
              <ArrowRight className="w-4 h-4" />
              <span>بازگشت به صفحه قبل</span>
            </button>

            <button
              onClick={() => navigateToCategory(null)}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-lg shadow-blue-600/20 transition"
            >
              <Store className="w-4 h-4" />
              <span>مشاهده همه محصولات فروشگاه</span>
            </button>
          </div>
        </div>

        {/* Suggested Alternative Products */}
        {suggestedProducts.length > 0 && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-9 h-9 rounded-2xl bg-amber-50 border border-amber-200/60 text-amber-600 flex items-center justify-center">
                <Compass className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900">محصولات پیشنهادی برای شما</h2>
                <p className="text-xs text-slate-500 mt-0.5">شاید این گزینه‌ها مورد پسندتان باشد</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
              {suggestedProducts.map(p => (
                <div
                  key={p.id}
                  onClick={() => navigateToProduct(p.slug)}
                  className="bg-white rounded-2xl border border-slate-100 p-4 hover:shadow-xl hover:border-blue-200 transition duration-300 flex flex-col justify-between cursor-pointer group"
                >
                  <div className="relative aspect-square w-full rounded-xl bg-slate-50 flex items-center justify-center p-3 mb-3 overflow-hidden">
                    <img
                      src={p.image_url}
                      alt={p.name}
                      className="max-h-full max-w-full object-contain group-hover:scale-105 transition duration-300"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-blue-600 block mb-1">
                      {p.category_name || p.brand}
                    </span>
                    <h3 className="ui-text-card-title text-slate-800 line-clamp-2 mb-3 group-hover:text-blue-600 transition">
                      {p.name}
                    </h3>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                    <span className="ui-price text-slate-900 font-sans">
                      {(p.effective_price || p.base_price).toLocaleString('fa-IR')} {p.currency}
                    </span>
                    <span className="ui-text-meta text-blue-600 group-hover:underline">
                      مشاهده جزئیات
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  const handleAddToCart = async () => {
    if (!product || isAddingToCart || isOutOfStock || (selectedStock > 0 && quantity > selectedStock)) return;
    setIsAddingToCart(true);
    const targetVariantId = selectedVariantId ?? selectedVariant?.id;
    const added = await addToCart(product, quantity, targetVariantId);
    setIsAddingToCart(false);
    if (!added) return;
    setAddedToast(true);
    setTimeout(() => setAddedToast(false), 3000);
  };

  const handleReaction = (commentId: number, type: 'like' | 'dislike') => {
    if (userReactions[commentId]) return; // already reacted
    setUserReactions(prev => ({ ...prev, [commentId]: type }));
    setCommentsList(prev => prev.map(c => {
      if (c.id === commentId) {
        return {
          ...c,
          likes: type === 'like' ? (c.likes || 0) + 1 : c.likes,
          dislikes: type === 'dislike' ? (c.dislikes || 0) + 1 : c.dislikes,
        };
      }
      return c;
    }));
  };

  const handleSubmitReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAuthor.trim() || !newContent.trim()) return;

    const newCommentObj: ProductComment = {
      id: Date.now(),
      author: newAuthor.trim(),
      rating: newRating,
      date: 'همین الان',
      title: newTitle.trim() || undefined,
      content: newContent.trim(),
      is_buyer: true,
      likes: 0,
      dislikes: 0,
      pros: newPros.trim() ? newPros.split(',').map(s => s.trim()) : undefined,
      cons: newCons.trim() ? newCons.split(',').map(s => s.trim()) : undefined,
    };

    setCommentsList([newCommentObj, ...commentsList]);
    setReviewSuccess(true);
    setTimeout(() => {
      setReviewSuccess(false);
      setShowReviewModal(false);
      setNewAuthor('');
      setNewTitle('');
      setNewContent('');
      setNewPros('');
      setNewCons('');
      setActiveTab('comments');
    }, 1500);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 pb-28 sm:pb-8">
      
      {/* Top Breadcrumb Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <button onClick={() => setActiveView('home')} className="hover:text-blue-600">خانه</button>
          <span>/</span>
          <button onClick={() => navigateToCategory(null, [])} className="hover:text-blue-600">فروشگاه</button>
          <span>/</span>
          <button 
            onClick={() => navigateToCategory(product.category_slug, product.category_path || [product.category_slug])}
            className="text-slate-600 hover:text-blue-600 font-medium transition cursor-pointer"
          >
            {product.category_name}
          </button>
          <span>/</span>
          <span className="text-slate-800 font-bold truncate max-w-[220px]">{product.name}</span>
        </div>

        <button
          onClick={() => navigateToCategory(null, [])}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-blue-600 transition bg-white px-3 py-1.5 rounded-xl border border-slate-200/80 shadow-2xs cursor-pointer"
        >
          <ArrowRight className="w-4 h-4" />
          <span>بازگشت به کاتالوگ</span>
        </button>
      </div>

      {/* Main Product Card */}
      <div className="bg-white rounded-3xl border border-slate-100 p-5 sm:p-8 shadow-xs mb-8">
        <header className="mb-6 border-b border-slate-100 pb-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold">{product.category_name}</span>
              {product.brand && <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">برند: {product.brand}</span>}
              <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${isOutOfStock ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                {isOutOfStock ? 'ناموجود' : `${selectedStock.toLocaleString('fa-IR')} عدد موجود`}
              </span>
            </div>
            <button onClick={() => setActiveTab('comments')} className="flex items-center gap-1 text-amber-500 text-xs font-bold hover:underline">
              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
              <span>{product.rating}</span>
              <span className="text-slate-400 font-normal">({commentsList.length > 0 ? commentsList.length : product.review_count} نظر)</span>
            </button>
          </div>
          <h1 className="ui-text-page-title text-slate-900">{product.name}</h1>
          <div className="ui-text-meta mt-2 flex flex-wrap items-center gap-3 text-slate-400">
            <span>کد محصول: <strong className="font-mono text-slate-600">{product.sku}</strong></span>
            {product.technology && <span>فناوری: <strong className="text-blue-600">{product.technology}</strong></span>}
          </div>
        </header>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          
          {/* Gallery Column (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            
            {/* Color Gallery Active Indicator */}
            {selectedColor && colorSpecificImages.length > 0 && (
              <div className="flex items-center justify-between text-xs bg-blue-50/80 border border-blue-200/60 rounded-xl px-3 py-2 text-blue-900 shadow-2xs">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full border border-slate-300 shadow-2xs"
                    style={{ backgroundColor: selectedColorConfig?.hex || '#2563eb' }}
                  />
                  <span className="font-bold">
                    تصاویر رنگ {selectedColor}
                  </span>
                </div>
                <span className="text-[11px] font-bold text-blue-700 font-sans">
                  {colorSpecificImages.length.toLocaleString('fa-IR')} تصویر اختصاصی
                </span>
              </div>
            )}

            {/* Main Preview Box */}
            <div className="relative aspect-square rounded-2xl bg-slate-50/70 border border-slate-100 p-6 flex items-center justify-center overflow-hidden group">
              <img
                src={activeImage || selectedVariant?.image_url || product.image_url}
                alt={product.name}
                className="w-full h-full object-contain mix-blend-multiply transition-transform duration-300 group-hover:scale-105"
                onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = '/images/product-placeholder.svg'; }}
              />
              
              {/* Wishlist Button */}
              <button
                onClick={() => toggleFavorite(product.id)}
                className={`absolute top-4 left-4 p-2.5 rounded-full transition shadow-xs ${
                  favorite ? 'bg-red-50 text-red-500' : 'bg-white/90 text-slate-400 hover:text-red-500'
                }`}
              >
                <Heart className={`w-4 h-4 ${favorite ? 'fill-red-500' : ''}`} />
              </button>

              {/* Discount Tag */}
              {product.discount_percentage ? (
                <div className="absolute top-4 right-4 bg-red-600 text-white font-extrabold text-xs px-2.5 py-1 rounded-lg shadow-sm">
                  {product.discount_percentage}٪ تخفیف
                </div>
              ) : null}
            </div>

            {/* Gallery Thumbnails */}
            {galleryImages.length > 1 && (
              <div className="flex gap-2.5 overflow-x-auto pb-1" aria-label="گالری محصول">
                {galleryImages.map((image) => (
                  <button
                    key={image}
                    type="button"
                    onClick={() => setActiveImage(image)}
                    className={`w-16 h-16 rounded-xl border p-1 bg-slate-50 transition shrink-0 ${
                      activeImage === image ? 'border-blue-600 ring-2 ring-blue-100 shadow-2xs' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <img src={image} alt="" className="w-full h-full object-contain mix-blend-multiply" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = '/images/product-placeholder.svg'; }} />
                  </button>
                ))}
              </div>
            )}

            {/* Quality Badges */}
            <div className="grid grid-cols-3 gap-2 pt-2">
              <div className="flex flex-col items-center text-center p-2.5 bg-slate-50/80 rounded-2xl border border-slate-100 text-[11px] text-slate-700">
                <ShieldCheck className="w-5 h-5 text-emerald-600 mb-1" />
                <span className="font-bold">ضمانت اصالت</span>
                <span className="text-[10px] text-slate-400">۱۰۰٪ اورجینال</span>
              </div>
              <div className="flex flex-col items-center text-center p-2.5 bg-slate-50/80 rounded-2xl border border-slate-100 text-[11px] text-slate-700">
                <Truck className="w-5 h-5 text-blue-600 mb-1" />
                <span className="font-bold">ارسال سریع</span>
                <span className="text-[10px] text-slate-400">سراسر کشور</span>
              </div>
              <div className="flex flex-col items-center text-center p-2.5 bg-slate-50/80 rounded-2xl border border-slate-100 text-[11px] text-slate-700">
                <RotateCcw className="w-5 h-5 text-indigo-600 mb-1" />
                <span className="font-bold">۷ روز ضمانت</span>
                <span className="text-[10px] text-slate-400">بازگشت وجه</span>
              </div>
            </div>

          </div>

          {/* Details & Purchase Column (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            <div className="space-y-6">
              {configurationChoices.length > 0 && (
                <section className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div>
                      <p className="text-xs font-bold text-slate-800">پیکربندی را انتخاب کنید</p>
                      <p className="text-[11px] text-slate-500 mt-1">{selectedConfiguration ? `گزینهٔ انتخاب‌شده: ${selectedConfiguration}` : 'یک پیکربندی انتخاب کنید'}</p>
                    </div>
                    {selectedVariant && <span className={`text-[11px] font-bold ${isSellableVariant(selectedVariant) ? 'text-emerald-700' : 'text-red-700'}`}>{isSellableVariant(selectedVariant) ? `${selectedStock.toLocaleString('fa-IR')} عدد موجود` : 'ناموجود'}</span>}
                  </div>
                  <div className="flex flex-wrap gap-2" aria-label="انتخاب پیکربندی محصول">
                    {configurationChoices.map(({ name, variants }) => {
                      const selected = selectedConfiguration === name;
                      const unavailable = !variants.some(isSellableVariant);
                      return <button key={name} type="button" disabled={unavailable} onClick={() => selectConfiguration(name)} className={`rounded-xl border px-3 py-2 text-right text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-45 ${selected ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`}>
                        <span>{name}</span>{unavailable && <small className="mr-2 text-[10px] font-medium text-red-600">ناموجود</small>}
                      </button>;
                    })}
                  </div>
                </section>
              )}
              {colorChoices.length > 0 && (
                <section className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div>
                      <p className="text-xs font-bold text-slate-800">رنگ را انتخاب کنید</p>
                      <p className="text-[11px] text-slate-500 mt-1">{selectedColor ? `رنگ انتخاب‌شده: ${selectedColor}` : 'یک رنگ انتخاب کنید'}</p>
                    </div>
                    {selectedVariant && <span className={`text-[11px] font-bold ${isSellableVariant(selectedVariant) ? 'text-emerald-700' : 'text-red-700'}`}>{isSellableVariant(selectedVariant) ? `${selectedStock.toLocaleString('fa-IR')} عدد موجود` : 'ناموجود'}</span>}
                  </div>
                  <div className="flex flex-wrap gap-3" aria-label="انتخاب رنگ محصول">
                    {colorChoices.map(({ name, hex, variants }) => {
                      const selected = selectedColor === name;
                      const relevantVariants = selectedConfiguration ? variants.filter((variant) => getVariantConfigurationName(variant, variantOptions) === selectedConfiguration) : variants;
                      const unavailable = !relevantVariants.some(isSellableVariant);
                      return <button key={name} type="button" title={`${name}${unavailable ? ' — ناموجود' : ''}`} onClick={() => selectColor(name)} className={`relative h-10 w-10 rounded-full border-2 transition focus:outline-none focus:ring-4 focus:ring-blue-100 ${selected ? 'border-blue-600 scale-110' : 'border-white shadow-sm hover:scale-105'} ${unavailable ? 'opacity-35 grayscale cursor-not-allowed' : ''}`} disabled={unavailable}>
                        <span className="block h-full w-full rounded-full border border-slate-300" style={{ backgroundColor: hex }} />
                        {selected && <Check className="absolute inset-0 m-auto w-4 h-4 text-white drop-shadow" />}
                      </button>;
                    })}
                  </div>
                </section>
              )}

              {packageVariants.some((variant) => variant.name !== 'Default') && (
                <section className="space-y-2">
                  <label className="text-xs font-bold text-slate-700">گارانتی یا پکیج:</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {packageVariants.filter((variant) => variant.name !== 'Default').map((variant) => {
                      const isSelected = selectedVariantId === variant.id;
                      const unavailable = !isSellableVariant(variant);
                      return <button key={variant.id} type="button" disabled={unavailable} onClick={() => selectVariant(variant)} className={`p-3 rounded-2xl text-right border transition disabled:opacity-45 disabled:cursor-not-allowed ${isSelected ? 'border-blue-600 bg-blue-50/60 shadow-xs' : 'border-slate-200 hover:border-slate-300'}`}>
                        <div className="flex items-center justify-between text-xs font-bold text-slate-800 mb-1"><span>{variant.name}</span>{isSelected && <Check className="w-3.5 h-3.5 text-blue-600" />}</div>
                        <div className="ui-text-meta text-slate-500">{unavailable ? 'ناموجود' : formatMoney(variant.effective_price || product.effective_price || product.base_price, product.currency)}</div>
                      </button>;
                    })}
                  </div>
                </section>
              )}

              <p className="ui-text-body text-slate-600 border-y border-slate-100 py-4 leading-8">{product.description || 'توضیحی برای این محصول ثبت نشده است.'}</p>
            </div>

            {/* Price & Purchase Action Section */}
            <section className="hidden sm:block rounded-2xl border border-slate-100 bg-slate-50/70 p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                <div>
                  <div className="ui-text-meta text-slate-400">قیمت مصرف‌کننده</div>
                  <div className="flex items-baseline gap-2 mt-1">
                    {product.discount_percentage ? <span className="ui-text-meta text-slate-400 line-through font-sans">{(product.base_price || 0).toLocaleString('fa-IR')}</span> : null}
                    <span className="ui-price text-slate-900 font-sans">{formatMoney(currentPrice, product.currency)}</span>
                  </div>
                  <p className={`mt-2 text-[11px] font-semibold ${isOutOfStock ? 'text-red-600' : 'text-emerald-700'}`}>{isOutOfStock ? 'این محصول یا گزینهٔ انتخاب‌شده ناموجود است.' : `حداکثر ${selectedStock.toLocaleString('fa-IR')} عدد قابل سفارش است.`}</p>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div dir="ltr" className="flex items-center justify-between border border-slate-200 rounded-2xl bg-white p-1" aria-label="تعداد سفارش">
                    <button type="button" aria-label="افزایش تعداد" onClick={() => setQuantity((current) => Math.min(selectedStock, current + 1))} disabled={isAtQuantityLimit || isAddingToCart} className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 font-bold hover:bg-blue-100 disabled:bg-slate-100 disabled:text-slate-400">+</button>
                    <span className="w-12 text-center text-sm font-bold font-sans">{quantity}</span>
                    <button type="button" aria-label="کاهش تعداد" onClick={() => setQuantity((current) => Math.max(1, current - 1))} disabled={isOutOfStock || isAddingToCart || quantity <= 1} className="w-9 h-9 rounded-xl text-slate-700 font-bold hover:bg-slate-100 disabled:opacity-40">−</button>
                  </div>

                  <button id="product-detail-add-cart-btn" type="button" onClick={() => { void handleAddToCart(); }} disabled={isOutOfStock || isAddingToCart} className="min-h-12 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none text-white rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition">
                    <ShoppingCart className="w-4 h-4" />
                    <span>{isOutOfStock ? 'ناموجود در انبار' : isAddingToCart ? 'در حال افزودن…' : 'افزودن به سبد خرید'}</span>
                  </button>
                </div>
              </div>
            </section>

            {/* Added Toast Notification */}
            {addedToast && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-semibold flex items-center justify-between animate-in fade-in">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>محصول به سبد خرید اضافه شد!</span>
                </div>
                <button
                  onClick={() => setActiveView('cart')}
                  className="text-emerald-800 font-bold underline text-[11px]"
                >
                  مشاهده سبد خرید
                </button>
              </div>
            )}

          </div>

        </div>
      </div>

      <aside className="sm:hidden fixed inset-x-3 bottom-[76px] z-50 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-2xl backdrop-blur" aria-label="خرید محصول">
        <div className="flex items-center gap-2.5">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] text-slate-500">{isOutOfStock ? 'وضعیت موجودی' : `حداکثر ${selectedStock.toLocaleString('fa-IR')} عدد`}</p>
            <p className={`mt-0.5 text-xs font-bold ${isOutOfStock ? 'text-red-600' : 'text-slate-900'}`}>{isOutOfStock ? 'ناموجود در انبار' : formatMoney(currentPrice, product.currency)}</p>
          </div>
          <div dir="ltr" className="flex shrink-0 items-center rounded-xl border border-slate-200 bg-white p-0.5" aria-label="تعداد سفارش">
            <button type="button" aria-label="افزایش تعداد" onClick={() => setQuantity((current) => Math.min(selectedStock, current + 1))} disabled={isAtQuantityLimit || isAddingToCart} className="h-8 w-8 rounded-lg bg-blue-50 text-sm font-bold text-blue-700 disabled:bg-slate-100 disabled:text-slate-400">+</button>
            <span className="w-8 text-center text-xs font-bold">{quantity}</span>
            <button type="button" aria-label="کاهش تعداد" onClick={() => setQuantity((current) => Math.max(1, current - 1))} disabled={isOutOfStock || isAddingToCart || quantity <= 1} className="h-8 w-8 rounded-lg text-sm font-bold text-slate-700 disabled:opacity-40">−</button>
          </div>
          <button type="button" onClick={() => { void handleAddToCart(); }} disabled={isOutOfStock || isAddingToCart} className="min-h-10 shrink-0 rounded-xl bg-blue-600 px-3 text-[11px] font-bold text-white shadow-lg shadow-blue-600/25 disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none">
            {isOutOfStock ? 'ناموجود' : isAddingToCart ? 'در حال افزودن…' : 'افزودن'}
          </button>
        </div>
      </aside>

      {/* Tabs Navigation (Specs vs Comments) */}
      <div className="bg-white rounded-3xl border border-slate-100 p-5 sm:p-8 shadow-xs mb-8">
        
        <div className="flex items-center gap-4 border-b border-slate-100 pb-4 mb-6">
          <button
            onClick={() => setActiveTab('specs')}
            className={`pb-2 text-sm font-bold transition relative ${
              activeTab === 'specs' 
                ? 'text-blue-600 font-extrabold' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            مشخصات فنی دستگاه
            {activeTab === 'specs' && (
              <span className="absolute bottom-0 right-0 left-0 h-0.5 bg-blue-600 rounded-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('comments')}
            className={`pb-2 text-sm font-bold transition relative flex items-center gap-1.5 ${
              activeTab === 'comments' 
                ? 'text-blue-600 font-extrabold' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            دیدگاه‌ها و نظرات کاربران
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs">
              {commentsList.length}
            </span>
            {activeTab === 'comments' && (
              <span className="absolute bottom-0 right-0 left-0 h-0.5 bg-blue-600 rounded-full" />
            )}
          </button>
        </div>

        {/* Tab 1: Technical Specs Table */}
        {activeTab === 'specs' && (
          <div className="space-y-6">
            <h3 className="text-sm font-bold text-slate-800">مشخصات فنی و استانداردها</h3>
            {product.specs ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.entries(product.specs).map(([key, val]) => (
                  <div key={key} className="flex items-center justify-between p-3.5 bg-slate-50/80 rounded-2xl text-xs border border-slate-100">
                    <span className="text-slate-500 font-medium">{key}</span>
                    <span className="text-slate-900 font-bold text-left">{formatSpecValue(val)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">مشخصات فنی برای این کالا ثبت نشده است.</p>
            )}
          </div>
        )}

        {/* Tab 2: Comments & Reviews */}
        {activeTab === 'comments' && (
          <div className="space-y-8">
            
            {/* Header with Score Breakdown & Add Review Button */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 bg-blue-50/50 rounded-2xl border border-blue-100">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex flex-col items-center justify-center font-bold shadow-md shadow-blue-500/20">
                  <span className="text-base leading-none">{product.rating}</span>
                  <span className="text-[10px] text-blue-100">از ۵</span>
                </div>
                <div>
                  <div className="flex items-center gap-1 text-amber-500 font-bold text-sm">
                    {[1, 2, 3, 4, 5].map(star => (
                      <Star key={star} className="w-4 h-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    ثبت شده توسط <strong>{commentsList.length}</strong> خریدار واقعی
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowReviewModal(true)}
                className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 shadow-xs"
              >
                <MessageSquarePlus className="w-4 h-4" />
                <span>ثبت نظر و تجربه خرید</span>
              </button>
            </div>

            {/* List of Customer Reviews */}
            {commentsList.length > 0 ? (
              <div className="space-y-4">
                {commentsList.map(comment => {
                  const userReaction = userReactions[comment.id];

                  return (
                    <div 
                      key={comment.id} 
                      className="p-5 rounded-2xl border border-slate-100 bg-white shadow-2xs space-y-3"
                    >
                      {/* Review Header */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs">
                            <User className="w-4 h-4 text-slate-500" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-800">{comment.author}</span>
                              {comment.is_buyer && (
                                <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                                  خریدار کالا
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400">{comment.date}</span>
                          </div>
                        </div>

                        {/* Stars */}
                        <div className="flex items-center gap-0.5 text-amber-400">
                          {[1, 2, 3, 4, 5].map(st => (
                            <Star 
                              key={st} 
                              className={`w-3.5 h-3.5 ${st <= comment.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} 
                            />
                          ))}
                        </div>
                      </div>

                      {/* Review Title & Content */}
                      {comment.title && (
                        <h4 className="text-xs font-bold text-slate-900">{comment.title}</h4>
                      )}
                      <p className="text-xs text-slate-600 leading-relaxed">{comment.content}</p>

                      {/* Pros & Cons */}
                      {((comment.pros && comment.pros.length > 0) || (comment.cons && comment.cons.length > 0)) && (
                        <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          {comment.pros && comment.pros.length > 0 && (
                            <div className="space-y-1">
                              <span className="text-[11px] font-bold text-emerald-700">نقاط قوت:</span>
                              <div className="flex flex-wrap gap-1">
                                {comment.pros.map((p, i) => (
                                  <span key={`pro-${p}-${i}`} className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-medium">
                                    + {p}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {comment.cons && comment.cons.length > 0 && (
                            <div className="space-y-1">
                              <span className="text-[11px] font-bold text-red-700">نقاط ضعف:</span>
                              <div className="flex flex-wrap gap-1">
                                {comment.cons.map((c, i) => (
                                  <span key={`con-${c}-${i}`} className="px-2 py-0.5 rounded-md bg-red-50 text-red-700 text-[10px] font-medium">
                                    - {c}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Like / Dislike Footer */}
                      <div className="pt-2 flex items-center justify-end gap-3 text-xs text-slate-500">
                        <span className="text-[11px]">آیا این نظر مفید بود؟</span>
                        <button
                          onClick={() => handleReaction(comment.id, 'like')}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-bold transition ${
                            userReaction === 'like' 
                              ? 'border-blue-600 bg-blue-50 text-blue-700' 
                              : 'border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                          <span>{comment.likes || 0}</span>
                        </button>
                        <button
                          onClick={() => handleReaction(comment.id, 'dislike')}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-bold transition ${
                            userReaction === 'dislike' 
                              ? 'border-red-600 bg-red-50 text-red-700' 
                              : 'border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <ThumbsDown className="w-3.5 h-3.5" />
                          <span>{comment.dislikes || 0}</span>
                        </button>
                      </div>

                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500 text-xs">
                هنوز دیدگاهی برای این محصول ثبت نشده است. شما اولین نفر باشید!
              </div>
            )}

          </div>
        )}

      </div>

      {/* Related Products Grid */}
      {relatedProducts.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-extrabold text-slate-900">محصولات مشابه و پیشنهادی</h3>
            <button
              onClick={() => setActiveView('store')}
              className="text-xs font-bold text-blue-600 hover:underline"
            >
              مشاهده همه
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {relatedProducts.map(relProduct => (
              <div
                key={relProduct.id}
                onClick={() => {
                  navigateToProduct(relProduct.slug);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="bg-white rounded-2xl border border-slate-100 p-3 shadow-xs hover:shadow-md transition cursor-pointer flex flex-col justify-between"
              >
                <div className="aspect-square bg-slate-50/70 rounded-xl p-3 flex items-center justify-center mb-2">
                  <img
                    src={relProduct.image_url}
                    alt={relProduct.name}
                    className="w-full h-full object-contain mix-blend-multiply hover:scale-105 transition"
                  />
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-slate-800 line-clamp-2 leading-relaxed">
                    {relProduct.name}
                  </h4>
                  <div className="text-xs font-black text-slate-900 pt-1">
                    {formatMoney(relProduct.effective_price || relProduct.base_price, relProduct.currency)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Review Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
            onClick={() => setShowReviewModal(false)}
          />
          
          <div className="relative bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl z-10 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">ثبت نظر برای {product.name}</h3>
              <button onClick={() => setShowReviewModal(false)}>
                <X className="w-4 h-4 text-slate-400 hover:text-slate-600" />
              </button>
            </div>

            {reviewSuccess ? (
              <div className="p-6 text-center space-y-2">
                <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
                <h4 className="font-bold text-sm text-slate-800">دیدگاه شما با موفقیت ثبت شد!</h4>
                <p className="text-xs text-slate-500">از اینکه تجربه خود را به اشتراک گذاشتید سپاسگزاریم.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmitReview} className="space-y-3.5 text-xs">
                
                {/* Rating Select */}
                <div>
                  <label className="font-bold text-slate-700 block mb-1">امتیاز شما به این محصول:</label>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button
                        type="button"
                        key={star}
                        onClick={() => setNewRating(star)}
                        className="p-1 hover:scale-110 transition"
                      >
                        <Star 
                          className={`w-6 h-6 ${star <= newRating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} 
                        />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Name */}
                <div>
                  <label className="font-bold text-slate-700 block mb-1">نام و نام خانوادگی:</label>
                  <input
                    type="text"
                    required
                    value={newAuthor}
                    onChange={(e) => setNewAuthor(e.target.value)}
                    placeholder="مثال: علی رضایی"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Title */}
                <div>
                  <label className="font-bold text-slate-700 block mb-1">عنوان نظر (اختیاری):</label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="خلاصه نظر شما..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Review Message */}
                <div>
                  <label className="font-bold text-slate-700 block mb-1">متن دیدگاه شما:</label>
                  <textarea
                    required
                    rows={3}
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    placeholder="نقاط قوت، کیفیت ساخت، تجربه کاربری و عملکرد دستگاه..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Pros & Cons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="font-bold text-emerald-700 block mb-1">نقاط قوت (با کاما جدا کنید):</label>
                    <input
                      type="text"
                      value={newPros}
                      onChange={(e) => setNewPros(e.target.value)}
                      placeholder="کیفیت بالا, پایداری سیگنال"
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-red-700 block mb-1">نقاط ضعف (با کاما جدا کنید):</label>
                    <input
                      type="text"
                      value={newCons}
                      onChange={(e) => setNewCons(e.target.value)}
                      placeholder="کابل کوتاه, قیمت بالا"
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                    />
                  </div>
                </div>

                {/* Submit */}
                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowReviewModal(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md shadow-blue-500/20"
                  >
                    ثبت دیدگاه
                  </button>
                </div>

              </form>
            )}

          </div>
        </div>
      )}

    </div>
  );
};
