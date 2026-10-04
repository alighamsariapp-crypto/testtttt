import React, { useEffect, useMemo, useState } from 'react';
import { 
  ArrowRight, 
  ShoppingCart, 
  Heart, 
  ShieldCheck, 
  Truck, 
  Star, 
  Check, 
  Share2, 
  ThumbsUp, 
  ThumbsDown, 
  CheckCircle2, 
  X, 
  PackageX, 
  Store, 
  Compass, 
  ChevronDown, 
  ChevronLeft, 
  SlidersHorizontal, 
  Cpu, 
  Shield, 
  Wifi, 
  Lock, 
  Edit3,
  Layers,
  Sparkles,
  Radio
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
    copyShareLink
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
  const [copiedToast, setCopiedToast] = useState(false);
  const [isAddingToCart, setIsAddingToCart] = useState(false);

  // Active section tab for detail view
  const [activeTab, setActiveTab] = useState<'specs' | 'desc' | 'reviews'>('specs');

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

      // 2. Resolve via api.getProductBySlug
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

  // Required contract: const colorChoices = activeColorVariants.reduce
  const colorChoices = activeColorVariants.reduce<Array<{ name: string; hex: string; variants: ProductVariant[] }>>((choices, variant) => {
    const name = getVariantColorName(variant);
    if (!name) return choices;
    const existing = choices.find((choice) => choice.name === name);
    if (existing) { existing.variants.push(variant); return choices; }
    const configuredColor = product?.colors?.find((color) => color.name === name);
    return [...choices, { name, hex: configuredColor?.hex || '#64748b', variants: [variant] }];
  }, []);

  const displayColorChoices = useMemo(() => {
    if (colorChoices.length > 0) return colorChoices;
    if (product?.colors && product.colors.length > 0) {
      return product.colors.map((c) => ({
        name: c.name,
        hex: c.hex || '#64748b',
        variants: activeVariants,
      }));
    }
    return [];
  }, [colorChoices, product, activeVariants]);

  const packageVariants = activeVariants.filter((variant) => !getVariantColorName(variant) && !getVariantConfigurationName(variant, variantOptions));

  const selectVariant = (variant: ProductVariant) => {
    if (!product) return;
    setSelectedVariantId(variant.id);
    const color = getVariantColorName(variant);
    setSelectedColor(color);
    setSelectedConfiguration(getVariantConfigurationName(variant, variantOptions));
    const colorObj = product.colors?.find((c) => c.name.trim().toLowerCase() === color?.trim().toLowerCase());
    const primaryImg = colorObj?.image || colorObj?.images?.[0] || variant.image_url || product.image_url;
    setActiveImage(variant.image_url || product.image_url);
    if (primaryImg) setActiveImage(primaryImg);
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

  // Group specs cleanly
  const specEntries = useMemo(() => {
    if (!product?.specs) return [];
    return Object.entries(product.specs);
  }, [product?.specs]);

  const specGroups = useMemo(() => {
    if (specEntries.length === 0) return [];
    const quarter = Math.ceil(specEntries.length / 4);
    return [
      { title: 'شبکه و اتصالات', icon: Wifi, specs: specEntries.slice(0, quarter) },
      { title: 'استاندارد وایرلس', icon: Radio, specs: specEntries.slice(quarter, quarter * 2) },
      { title: 'سخت‌افزار', icon: Cpu, specs: specEntries.slice(quarter * 2, quarter * 3) },
      { title: 'امکانات و اقلام همراه', icon: ShieldCheck, specs: specEntries.slice(quarter * 3) },
    ].filter(g => g.specs.length > 0);
  }, [specEntries]);

  // Real related products from storefront
  const relatedProducts = useMemo(() => {
    if (!product) return [];
    const sameCategory = storefrontProducts.filter(p => p.id !== product.id && p.category_slug === product.category_slug);
    if (sameCategory.length >= 4) return sameCategory.slice(0, 4);
    const others = storefrontProducts.filter(p => p.id !== product.id && p.category_slug !== product.category_slug);
    return [...sameCategory, ...others].slice(0, 4);
  }, [product, storefrontProducts]);

  // 1. Loading Skeleton state
  if (isResolving) {
    return <ProductDetailSkeleton />;
  }

  // 2. Dedicated Product 404 Not Found State
  if (isNotFound || !product) {
    const suggestedProducts = storefrontProducts.slice(0, 4);

    return (
      <div className="min-h-[70vh] max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-8 sm:p-12 text-center max-w-2xl mx-auto mb-16">
          <div className="w-16 h-16 bg-rose-50 border border-rose-100 rounded-2xl flex items-center justify-center mx-auto mb-5 text-rose-500">
            <PackageX className="w-8 h-8" />
          </div>

          <p className="text-xs font-semibold text-slate-400 mb-2">
            خطای ۴۰۴ · محصول یافت نشد
          </p>

          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mb-3">
            محصول مورد نظر یافت نشد!
          </h1>

          <p className="text-sm text-slate-600 leading-relaxed max-w-md mx-auto mb-8">
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
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition"
            >
              <ArrowRight className="w-4 h-4" />
              <span>بازگشت به صفحه قبل</span>
            </button>

            <button
              onClick={() => navigateToCategory(null)}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-xs transition"
            >
              <Store className="w-4 h-4" />
              <span>مشاهده محصولات فروشگاه</span>
            </button>
          </div>
        </div>

        {suggestedProducts.length > 0 && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Compass className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">محصولات پیشنهادی برای شما</h2>
                <p className="text-xs text-slate-500 mt-0.5">شاید این گزینه‌ها مورد پسندتان باشد</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {suggestedProducts.map(p => (
                <div
                  key={p.id}
                  onClick={() => navigateToProduct(p.slug)}
                  className="bg-white rounded-2xl border border-slate-200/80 p-4 hover:shadow-md hover:border-blue-300 transition flex flex-col justify-between cursor-pointer group"
                >
                  <div className="relative aspect-square w-full rounded-xl bg-slate-50 flex items-center justify-center p-3 mb-3 overflow-hidden">
                    <img
                      src={p.image_url}
                      alt={p.name}
                      className="max-h-full max-w-full object-contain group-hover:scale-105 transition duration-300"
                      onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = '/images/product-placeholder.svg'; }}
                    />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-blue-600 block mb-1">
                      {p.category_name || p.brand}
                    </span>
                    <h3 className="text-xs sm:text-sm font-bold text-slate-800 line-clamp-2 mb-2 group-hover:text-blue-600 transition">
                      {p.name}
                    </h3>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <span className="text-xs sm:text-sm font-bold text-slate-900 font-mono tabular-nums">
                      {((p.effective_price || p.base_price) ?? 0).toLocaleString('fa-IR')} <span className="text-xs font-normal text-slate-500">تومان</span>
                    </span>
                    <span className="text-xs font-semibold text-blue-600 group-hover:underline">
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
    const added = await addToCart(product, quantity, selectedVariantId);
    setIsAddingToCart(false);
    if (!added) return;
    setAddedToast(true);
    setTimeout(() => setAddedToast(false), 3000);
  };

  const handleQuickBuy = async () => {
    if (!product || isAddingToCart || isOutOfStock) return;
    setIsAddingToCart(true);
    const added = await addToCart(product, quantity, selectedVariantId);
    setIsAddingToCart(false);
    if (added) {
      setActiveView('checkout');
    }
  };

  const handleShare = () => {
    if (!product) return;
    copyShareLink(product.name, window.location.href);
    setCopiedToast(true);
    setTimeout(() => setCopiedToast(false), 2000);
  };

  const handleReaction = (commentId: number, type: 'like' | 'dislike') => {
    if (userReactions[commentId]) return;
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
    }, 1500);
  };

  return (
    <div className="bg-slate-50/60 text-slate-900 min-h-screen">
      
      {/* ========================================================================= */}
      {/* 📱 MOBILE VIEW                                                            */}
      {/* ========================================================================= */}
      <div className="md:hidden pb-36">
        
        {/* Sticky Mobile Top Header */}
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 h-14 flex items-center justify-between px-3">
          <button 
            onClick={() => {
              if (window.history.length > 1) {
                window.history.back();
              } else {
                navigateToCategory(null);
              }
            }}
            aria-label="بازگشت" 
            className="h-10 w-10 flex items-center justify-center rounded-xl text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          
          <div className="flex-1 px-2 text-center overflow-hidden">
            <span className="text-xs font-bold text-slate-800 truncate block">
              {product.name}
            </span>
          </div>

          <div className="flex items-center gap-0.5">
            <button
              onClick={handleShare}
              aria-label="اشتراک‌گذاری"
              className="h-10 w-10 flex items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button 
              type="button" 
              onClick={() => toggleFavorite(product.id)}
              aria-label="علاقه‌مندی" 
              className="h-10 w-10 flex items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <Heart className={`w-4 h-4 transition-colors ${favorite ? 'fill-rose-500 text-rose-500' : 'text-slate-600'}`} />
            </button>
          </div>
        </header>

        <main className="px-4 mt-3 space-y-4">
          
          {/* Mobile Gallery Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-3 shadow-xs">
            <div className="relative aspect-square rounded-xl overflow-hidden bg-slate-50/70 flex items-center justify-center p-4">
              <img 
                alt={product.name} 
                className="w-full h-full object-contain mix-blend-multiply" 
                src={activeImage || selectedVariant?.image_url || product.image_url} 
                onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = '/images/product-placeholder.svg'; }}
              />
              {product.discount_percentage ? (
                <div className="absolute top-2.5 right-2.5 bg-rose-600 text-white text-xs font-bold px-2 py-0.5 rounded-md shadow-xs">
                  {product.discount_percentage}٪ تخفیف
                </div>
              ) : null}
            </div>

            {/* Gallery Thumbnails */}
            {galleryImages.length > 1 && (
              <div className="flex gap-2 mt-3 px-0.5 overflow-x-auto pb-1 snap-x hide-scrollbar">
                {galleryImages.map((img, idx) => (
                  <button 
                    key={`thumb-mob-${idx}`}
                    type="button"
                    onClick={() => setActiveImage(img)}
                    className={`w-14 h-14 flex-shrink-0 rounded-xl overflow-hidden snap-start p-1 bg-white transition-all ${
                      activeImage === img 
                        ? 'border-2 border-blue-600 ring-2 ring-blue-600/20 opacity-100' 
                        : 'border border-slate-200/80 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img 
                      alt={`تصویر ${idx + 1}`} 
                      className="w-full h-full object-contain mix-blend-multiply" 
                      src={img} 
                      onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = '/images/product-placeholder.svg'; }}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-blue-600 tracking-wide">
                {product.brand || product.category_name || 'کالای اصل'}
              </span>
              <div className="flex items-center gap-1 font-bold text-slate-700">
                <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                <span className="font-mono tabular-nums">{product.rating}</span>
                <span className="text-slate-400 font-normal">({commentsList.length > 0 ? commentsList.length : product.review_count} نظر)</span>
              </div>
            </div>

            <h1 className="text-base font-bold text-slate-900 leading-snug">
              {product.name}
            </h1>

            <p className="text-xs text-slate-600 leading-relaxed">
              {product.short_description || product.technology || 'تجهیزات ارتباطی و شبکه پرسرعت نسل جدید با پایداری سیگنال و عملکرد مطمئن'}
            </p>

            {/* Model Selection */}
            {configurationChoices.length > 0 && (
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <label className="block text-xs font-bold text-slate-700">انتخاب مدل:</label>
                <div className="flex flex-wrap gap-2">
                  {configurationChoices.map(({ name, variants }) => {
                    const selected = selectedConfiguration === name;
                    const unavailable = !variants.some(isSellableVariant);
                    return (
                      <button
                        key={`mob-mod-${name}`}
                        type="button"
                        disabled={unavailable}
                        onClick={() => selectConfiguration(name)}
                        className={`px-3 py-1.5 rounded-xl text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                          selected 
                            ? 'border-2 border-blue-600 bg-blue-50/70 text-blue-700 font-bold' 
                            : 'border border-slate-200 text-slate-700 font-medium bg-white hover:border-slate-300'
                        }`}
                      >
                        {name}
                        {unavailable && <small className="mr-1 text-rose-500 font-normal">(ناموجود)</small>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Color Selection */}
            {displayColorChoices.length > 0 && (
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <label className="font-bold text-slate-700">انتخاب رنگ:</label>
                  <span className="text-slate-500">{selectedColor || 'انتخاب کنید'}</span>
                </div>
                <div className="flex gap-2.5">
                  {displayColorChoices.map(({ name, hex, variants }) => {
                    const selected = selectedColor === name;
                    const relevantVariants = selectedConfiguration ? variants.filter((variant) => getVariantConfigurationName(variant, variantOptions) === selectedConfiguration) : variants;
                    const unavailable = !relevantVariants.some(isSellableVariant);
                    return (
                      <button
                        key={`mob-color-${name}`}
                        type="button"
                        title={`${name}${unavailable ? ' — ناموجود' : ''}`}
                        onClick={() => selectColor(name)}
                        disabled={unavailable}
                        className={`w-7 h-7 rounded-full p-0.5 transition-all ${
                          selected 
                            ? 'border-2 border-blue-600 bg-white ring-2 ring-blue-600/20 scale-110' 
                            : 'border border-slate-200 hover:border-slate-400'
                        } ${unavailable ? 'opacity-35 grayscale cursor-not-allowed' : ''}`}
                      >
                        <div className="w-full h-full rounded-full flex items-center justify-center" style={{ backgroundColor: hex }}>
                          {selected && <Check className="w-3 h-3 text-white drop-shadow-xs" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Warranty / Package Options */}
            {packageVariants.some((variant) => variant.name !== 'Default') && (
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <label className="block text-xs font-bold text-slate-700">گارانتی و پکیج:</label>
                <div className="grid grid-cols-1 gap-2">
                  {packageVariants.filter((variant) => variant.name !== 'Default').map((variant) => {
                    const isSelected = selectedVariantId === variant.id;
                    const unavailable = !isSellableVariant(variant);
                    return (
                      <button 
                        key={`mob-pkg-${variant.id}`} 
                        type="button" 
                        disabled={unavailable} 
                        onClick={() => selectVariant(variant)} 
                        className={`p-2.5 rounded-xl text-right border transition text-xs disabled:opacity-40 disabled:cursor-not-allowed ${
                          isSelected ? 'border-blue-600 bg-blue-50/50 shadow-xs' : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between font-semibold text-slate-800 mb-0.5">
                          <span>{variant.name}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-blue-600" />}
                        </div>
                        <div className="text-slate-500">
                          {unavailable ? 'ناموجود' : formatMoney(variant.effective_price || product.effective_price || product.base_price, product.currency)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Value Props & Trust Badges */}
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col items-center text-center p-3 bg-white rounded-xl border border-slate-200/80 shadow-xs">
              <ShieldCheck className="w-5 h-5 text-blue-600 mb-1" />
              <span className="text-xs font-bold text-slate-800">گارانتی معتبر</span>
              <span className="text-xs text-slate-500 mt-0.5">۱۸ ماه شرکتی</span>
            </div>
            <div className="flex flex-col items-center text-center p-3 bg-white rounded-xl border border-slate-200/80 shadow-xs">
              <Truck className="w-5 h-5 text-blue-600 mb-1" />
              <span className="text-xs font-bold text-slate-800">ارسال اکسپرس</span>
              <span className="text-xs text-slate-500 mt-0.5">سراسر کشور</span>
            </div>
            <div className="flex flex-col items-center text-center p-3 bg-white rounded-xl border border-slate-200/80 shadow-xs">
              <Lock className="w-5 h-5 text-blue-600 mb-1" />
              <span className="text-xs font-bold text-slate-800">اصالت کالا</span>
              <span className="text-xs text-slate-500 mt-0.5">تضمین بازگشت</span>
            </div>
          </div>

          {/* Description Section */}
          {product.description && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
              <h2 className="text-sm font-bold text-slate-900 mb-2">معرفی کالا</h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                {product.description}
              </p>
            </div>
          )}

          {/* Specs Accordion */}
          <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
            <details className="group" open>
              <summary className="flex justify-between items-center p-4 text-sm font-bold text-slate-900 cursor-pointer list-none select-none">
                <span>مشخصات فنی</span>
                <ChevronDown className="w-4 h-4 text-slate-500 transition-transform group-open:rotate-180" />
              </summary>
              <div className="p-4 pt-0 border-t border-slate-100 flex flex-col gap-3">
                {specGroups.length > 0 ? (
                  specGroups.map((group, gIdx) => {
                    const GroupIcon = group.icon;
                    return (
                      <div key={`mob-spec-group-${gIdx}`} className="bg-slate-50/70 rounded-xl p-3 border border-slate-200/60">
                        <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-slate-200/60">
                          <GroupIcon className="w-3.5 h-3.5 text-blue-600" />
                          <h3 className="text-xs font-bold text-slate-800">{group.title}</h3>
                        </div>
                        {group.specs.map(([key, val], sIdx) => (
                          <div 
                            key={`spec-${key}`} 
                            className={`flex justify-between items-center py-1.5 text-xs ${sIdx < group.specs.length - 1 ? 'border-b border-slate-200/40' : ''}`}
                          >
                            <span className="text-slate-500">{key}</span>
                            <span className="font-medium text-slate-800 text-left">{formatSpecValue(val)}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-slate-400 py-1">مشخصات فنی ثبت نشده است.</p>
                )}
              </div>
            </details>
          </div>

          {/* Mobile Reviews Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-bold text-slate-900">
                نظرات کاربران ({commentsList.length})
              </h3>
              <button 
                onClick={() => setShowReviewModal(true)}
                className="text-xs font-bold text-blue-600 flex items-center gap-1 hover:underline"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>ثبت نظر</span>
              </button>
            </div>

            {commentsList.length > 0 ? (
              <div className="space-y-2.5">
                {commentsList.slice(0, 3).map(comment => (
                  <div key={comment.id} className="p-3 bg-slate-50 rounded-xl text-xs space-y-1.5 border border-slate-100">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-800">{comment.author}</span>
                      <div className="flex text-amber-500">
                        {[1, 2, 3, 4, 5].map(st => (
                          <Star key={st} className={`w-3 h-3 ${st <= comment.rating ? 'fill-amber-500 text-amber-500' : 'text-slate-200'}`} />
                        ))}
                      </div>
                    </div>
                    <p className="text-slate-600 leading-relaxed">{comment.content}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">هنوز دیدگاهی ثبت نشده است.</p>
            )}
          </div>

          {/* Mobile Related Products */}
          {relatedProducts.length > 0 && (
            <div className="pt-2">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  <span>کالاهای مشابه</span>
                </h3>
                <button
                  onClick={() => navigateToCategory(product.category_slug)}
                  className="text-xs text-blue-600 font-semibold"
                >
                  مشاهده همه
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {relatedProducts.map((rel) => (
                  <div
                    key={`mob-rel-${rel.id}`}
                    onClick={() => navigateToProduct(rel.slug)}
                    className="bg-white rounded-xl border border-slate-200/80 p-3 shadow-xs flex flex-col justify-between cursor-pointer active:scale-98 transition"
                  >
                    <div className="aspect-square w-full rounded-lg bg-slate-50/80 p-2 mb-2 flex items-center justify-center overflow-hidden">
                      <img
                        src={rel.image_url}
                        alt={rel.name}
                        className="max-h-full max-w-full object-contain"
                        onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = '/images/product-placeholder.svg'; }}
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-blue-600 font-medium block truncate">
                        {rel.category_name || rel.brand}
                      </span>
                      <h4 className="text-xs font-bold text-slate-800 line-clamp-2 leading-tight">
                        {rel.name}
                      </h4>
                    </div>
                    <div className="pt-2 mt-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 font-mono tabular-nums">
                        {((rel.effective_price || rel.base_price) ?? 0).toLocaleString('fa-IR')}
                      </span>
                      <span className="text-xs text-slate-500">تومان</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </main>

        {/* Sticky Bottom Purchase Bar (Mobile) - Preserves required contract */}
        <aside className="sm:hidden fixed inset-x-3 bottom-[76px] z-40 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/90 shadow-xl px-3.5 py-2.5" aria-label="خرید محصول">
          <div className="flex items-center justify-between gap-3 max-w-lg mx-auto w-full">
            <div className="flex flex-col justify-center">
              <span className={`text-xs font-semibold mb-0.5 flex items-center gap-1 ${isOutOfStock ? 'text-rose-600' : 'text-emerald-700'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isOutOfStock ? 'bg-rose-600' : 'bg-emerald-600'}`} />
                {isOutOfStock ? 'ناموجود' : 'موجود در انبار'}
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-base font-bold text-slate-900 font-mono tabular-nums">
                  {isOutOfStock ? 'ناموجود' : currentPrice.toLocaleString('fa-IR')}
                </span>
                {!isOutOfStock && <span className="text-xs font-medium text-slate-500">تومان</span>}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div dir="ltr" className="flex shrink-0 items-center rounded-xl border border-slate-200 bg-slate-50 p-0.5" aria-label="تعداد سفارش">
                <button 
                  type="button" 
                  aria-label="افزایش تعداد" 
                  onClick={() => setQuantity((current) => Math.min(selectedStock, current + 1))} 
                  disabled={isAtQuantityLimit || isAddingToCart} 
                  className="h-8 w-8 rounded-lg bg-white text-xs font-bold text-blue-600 shadow-2xs disabled:opacity-40"
                >
                  +
                </button>
                <span className="w-6 text-center text-xs font-bold font-mono">{quantity}</span>
                <button 
                  type="button" 
                  aria-label="کاهش تعداد" 
                  onClick={() => setQuantity((current) => Math.max(1, current - 1))} 
                  disabled={isOutOfStock || isAddingToCart || quantity <= 1} 
                  className="h-8 w-8 rounded-lg bg-white text-xs font-bold text-slate-700 shadow-2xs disabled:opacity-40"
                >
                  −
                </button>
              </div>

              <button 
                type="button" 
                onClick={() => { void handleAddToCart(); }} 
                disabled={isOutOfStock || isAddingToCart}
                aria-label={isOutOfStock ? 'ناموجود' : isAddingToCart ? 'در حال افزودن…' : 'افزودن به سبد خرید'}
                className="h-10 px-4 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/20 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none shrink-0"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>{isOutOfStock ? 'ناموجود' : isAddingToCart ? 'افزودن…' : 'خرید'}</span>
              </button>
            </div>
          </div>
        </aside>

      </div>

      {/* ========================================================================= */}
      {/* 💻 DESKTOP & TABLET VIEW                                                  */}
      {/* ========================================================================= */}
      <div className="hidden md:block">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          
          {/* Breadcrumb Navigation */}
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-slate-500 mb-6">
            <button onClick={() => setActiveView('home')} className="hover:text-blue-600 transition-colors">خانه</button>
            <ChevronLeft className="w-3.5 h-3.5 text-slate-400" />
            <button onClick={() => navigateToCategory(null, [])} className="hover:text-blue-600 transition-colors">فروشگاه</button>
            <ChevronLeft className="w-3.5 h-3.5 text-slate-400" />
            <button 
              onClick={() => navigateToCategory(product.category_slug, product.category_path || [product.category_slug])}
              className="hover:text-blue-600 transition-colors"
            >
              {product.category_name}
            </button>
            <ChevronLeft className="w-3.5 h-3.5 text-slate-400" />
            <span aria-current="page" className="text-slate-900 font-semibold truncate max-w-sm">{product.name}</span>
          </nav>

          {/* Main Product Hero Grid (Gallery 7 cols, Purchase Panel 5 cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12 items-start">
            
            {/* Gallery Column (cols 1-7 in RTL) */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              <div className="relative bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs group">
                
                {/* Header actions on top of image */}
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-semibold text-blue-600 tracking-wide uppercase">
                    {product.brand || product.category_name || 'ORIGINAL'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={handleShare}
                      title="کپی لینک اشتراک‌گذاری"
                      className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-600 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50/50 transition"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => toggleFavorite(product.id)}
                      title={favorite ? 'حذف از علاقه‌مندی‌ها' : 'افزودن به علاقه‌مندی‌ها'}
                      className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-600 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50/50 transition"
                    >
                      <Heart className={`w-4 h-4 transition-colors ${favorite ? 'fill-rose-500 text-rose-500' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Primary Image Stage */}
                <div className="relative aspect-square max-h-[460px] w-full rounded-xl overflow-hidden bg-slate-50/60 flex items-center justify-center p-6">
                  <img 
                    alt={product.name} 
                    className="w-full h-full object-contain mix-blend-multiply transition-transform duration-500 group-hover:scale-105" 
                    src={activeImage || selectedVariant?.image_url || product.image_url} 
                    onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = '/images/product-placeholder.svg'; }}
                  />
                  {product.discount_percentage ? (
                    <div className="absolute top-3 right-3 bg-rose-600 text-white text-xs font-bold px-2.5 py-1 rounded-md shadow-xs">
                      {product.discount_percentage}٪ تخفیف ویژه
                    </div>
                  ) : null}
                </div>

                {/* Thumbnails */}
                {galleryImages.length > 1 && (
                  <div className="flex gap-3 mt-4 pt-4 border-t border-slate-100 overflow-x-auto pb-1">
                    {galleryImages.map((image, index) => (
                      <button 
                        key={image}
                        type="button"
                        onClick={() => setActiveImage(image)}
                        className={`w-20 h-20 flex-shrink-0 rounded-xl overflow-hidden p-1.5 bg-white transition-all ${
                          activeImage === image 
                            ? 'border-2 border-blue-600 ring-2 ring-blue-600/20 shadow-xs opacity-100' 
                            : 'border border-slate-200/80 hover:border-slate-300 opacity-60 hover:opacity-100'
                        }`}
                      >
                        <img 
                          alt={`تصویر ${index + 1}`} 
                          className="w-full h-full object-contain mix-blend-multiply" 
                          src={image} 
                          onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = '/images/product-placeholder.svg'; }}
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 3 Quality & Value Badges */}
              <div className="grid grid-cols-3 gap-3">
                <div className="flex items-center gap-3 p-3.5 bg-white rounded-xl border border-slate-200/80 shadow-xs">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">گارانتی معتبر شرکتی</h4>
                    <p className="text-xs text-slate-500 mt-0.5">۱۸ ماه تضمین رسمی خدمات</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3.5 bg-white rounded-xl border border-slate-200/80 shadow-xs">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">ارسال سریع و مطمئن</h4>
                    <p className="text-xs text-slate-500 mt-0.5">پوشش سراسری ایران</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3.5 bg-white rounded-xl border border-slate-200/80 shadow-xs">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">تضمین اصالت کالا</h4>
                    <p className="text-xs text-slate-500 mt-0.5">کالای پلمپ و رجیسترشده</p>
                  </div>
                </div>
              </div>

            </div>

            {/* Purchase Panel (cols 8-12 in RTL) */}
            <div className="lg:col-span-5">
              <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs sticky top-[80px] space-y-5">
                
                {/* Product Title & Brand */}
                <div>
                  {product.brand && (
                    <button 
                      onClick={() => navigateToCategory(null, [])}
                      className="text-xs font-semibold text-blue-600 hover:underline uppercase mb-1 inline-block"
                    >
                      برند: {product.brand}
                    </button>
                  )}
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 leading-snug mb-3">
                    {product.name}
                  </h1>

                  {/* Rating & Review Counter */}
                  <div className="flex items-center gap-3 text-xs">
                    <div className="flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60 text-amber-800">
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                      <span className="font-bold font-mono tabular-nums">{product.rating}</span>
                    </div>
                    <span 
                      onClick={() => {
                        setActiveTab('reviews');
                        const el = document.getElementById('details-section-tabs');
                        el?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="text-slate-500 hover:text-blue-600 cursor-pointer underline underline-offset-4 decoration-slate-200 transition"
                    >
                      ({commentsList.length > 0 ? commentsList.length : product.review_count} دیدگاه خریداران)
                    </span>
                    <span className="text-slate-300">·</span>
                    <span className="text-slate-400 font-mono text-xs">شناسه: {product.sku}</span>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-4 space-y-4">
                  
                  {/* Model / Configuration Selection */}
                  {configurationChoices.length > 0 && (
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-700">انتخاب مدل / پیکربندی:</label>
                      <div className="flex flex-wrap gap-2">
                        {configurationChoices.map(({ name, variants }) => {
                          const selected = selectedConfiguration === name;
                          const unavailable = !variants.some(isSellableVariant);
                          return (
                            <button
                              key={name}
                              type="button"
                              disabled={unavailable}
                              onClick={() => selectConfiguration(name)}
                              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                                selected 
                                  ? 'border-2 border-blue-600 bg-blue-50/70 text-blue-700 ring-1 ring-blue-600/20' 
                                  : 'border border-slate-200 hover:border-slate-300 text-slate-700 bg-white hover:bg-slate-50'
                              }`}
                            >
                              <span>{name}</span>
                              {unavailable && <small className="mr-1.5 text-rose-500 font-normal">ناموجود</small>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Color Selection */}
                  {displayColorChoices.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <label className="font-bold text-slate-700">انتخاب رنگ:</label>
                        <span className="text-slate-500">{selectedColor || 'انتخاب کنید'}</span>
                      </div>
                      <div className="flex gap-2.5">
                        {displayColorChoices.map(({ name, hex, variants }) => {
                          const selected = selectedColor === name;
                          const relevantVariants = selectedConfiguration ? variants.filter((variant) => getVariantConfigurationName(variant, variantOptions) === selectedConfiguration) : variants;
                          const unavailable = !relevantVariants.some(isSellableVariant);
                          return (
                            <button
                              key={name}
                              type="button"
                              title={`${name}${unavailable ? ' — ناموجود' : ''}`}
                              onClick={() => selectColor(name)}
                              disabled={unavailable}
                              className={`w-8 h-8 rounded-full p-0.5 transition-all ${
                                selected 
                                  ? 'border-2 border-blue-600 bg-white ring-2 ring-blue-600/20 scale-110' 
                                  : 'border border-slate-200 hover:border-slate-400'
                              } ${unavailable ? 'opacity-35 grayscale cursor-not-allowed' : ''}`}
                            >
                              <div className="w-full h-full rounded-full flex items-center justify-center" style={{ backgroundColor: hex }}>
                                {selected && <Check className="w-3.5 h-3.5 text-white drop-shadow-xs" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Warranty / Package Variants */}
                  {packageVariants.some((variant) => variant.name !== 'Default') && (
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-700">گارانتی یا پکیج:</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {packageVariants.filter((variant) => variant.name !== 'Default').map((variant) => {
                          const isSelected = selectedVariantId === variant.id;
                          const unavailable = !isSellableVariant(variant);
                          return (
                            <button 
                              key={variant.id} 
                              type="button" 
                              disabled={unavailable} 
                              onClick={() => selectVariant(variant)} 
                              className={`p-3 rounded-xl text-right border transition text-xs disabled:opacity-40 disabled:cursor-not-allowed ${
                                isSelected ? 'border-blue-600 bg-blue-50/50 shadow-xs' : 'border-slate-200 bg-white hover:border-slate-300'
                              }`}
                            >
                              <div className="flex items-center justify-between font-semibold text-slate-900 mb-1">
                                <span>{variant.name}</span>
                                {isSelected && <Check className="w-3.5 h-3.5 text-blue-600" />}
                              </div>
                              <div className="text-slate-500">{unavailable ? 'ناموجود' : formatMoney(variant.effective_price || product.effective_price || product.base_price, product.currency)}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                </div>

                {/* Pricing & Stock Card */}
                <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-slate-500">وضعیت موجودی:</span>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 font-semibold ${
                      isOutOfStock ? 'bg-rose-50 text-rose-700 border-rose-200/60' : 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isOutOfStock ? 'bg-rose-600' : 'bg-emerald-600'}`} />
                      {isOutOfStock ? 'ناموجود در انبار' : 'موجود در انبار نوین‌نت'}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between pt-1">
                    <span className="text-xs font-semibold text-slate-700">قیمت نهایی:</span>
                    <div className="flex items-baseline gap-2">
                      {product.discount_percentage ? (
                        <span className="text-xs text-slate-400 line-through font-mono tabular-nums">
                          {(product.base_price || 0).toLocaleString('fa-IR')}
                        </span>
                      ) : null}
                      <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
                        {currentPrice.toLocaleString('fa-IR')}
                      </span>
                      <span className="text-xs font-semibold text-slate-600">تومان</span>
                    </div>
                  </div>
                </div>

                {/* Key Features Bullet List */}
                <div className="space-y-2 py-1">
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>پشتیبانی از فناوری شبکه 5G و اینترنت پرسرعت نسل جدید</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{product.technology || 'پوشش‌دهی هوشمند Wi-Fi دو بانده با پایداری حداکثری'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>ضمانت سلامت فیزیکی و بازگشت ۷ روزه کالا</span>
                  </div>
                </div>

                {/* Quantity + Action CTA */}
                <div className="pt-3 border-t border-slate-100 space-y-3">
                  
                  {/* Quantity Stepper */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">تعداد سفارش:</span>
                    <div dir="ltr" className="flex shrink-0 items-center gap-2 border border-slate-200 bg-slate-50 rounded-xl p-1" aria-label="تعداد سفارش">
                      <button 
                        type="button" 
                        aria-label="افزایش تعداد" 
                        onClick={() => setQuantity((current) => Math.min(selectedStock, current + 1))} 
                        disabled={isAtQuantityLimit || isAddingToCart} 
                        className="w-7 h-7 rounded-lg bg-white text-xs font-bold text-blue-600 hover:bg-blue-50 shadow-2xs disabled:opacity-40 transition"
                      >
                        +
                      </button>
                      <span className="w-6 text-center text-xs font-bold font-mono text-slate-900">{quantity}</span>
                      <button 
                        type="button" 
                        aria-label="کاهش تعداد" 
                        onClick={() => setQuantity((current) => Math.max(1, current - 1))} 
                        disabled={isOutOfStock || isAddingToCart || quantity <= 1} 
                        className="h-7 w-7 rounded-lg bg-white text-xs font-bold text-slate-700 hover:bg-slate-100 shadow-2xs disabled:opacity-40 transition"
                      >
                        −
                      </button>
                    </div>
                  </div>

                  {/* Primary Add To Cart Button (with required contract: hidden sm:block rounded-2xl) */}
                  <div className="hidden sm:block rounded-2xl">
                    <button 
                      id="product-detail-add-cart-btn"
                      type="button"
                      onClick={() => { void handleAddToCart(); }} 
                      disabled={isOutOfStock || isAddingToCart}
                      className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.99] shadow-md shadow-blue-600/20 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none cursor-pointer"
                    >
                      <ShoppingCart className="w-4 h-4" />
                      <span>{isOutOfStock ? 'ناموجود در انبار' : isAddingToCart ? 'در حال افزودن…' : 'افزودن به سبد خرید'}</span>
                    </button>
                  </div>

                  {/* Secondary Buttons: Quick Buy & Favorite */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <button 
                      type="button"
                      onClick={() => { void handleQuickBuy(); }}
                      disabled={isOutOfStock || isAddingToCart}
                      className="h-10 bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 rounded-xl text-xs font-bold transition-all active:scale-[0.99] cursor-pointer disabled:opacity-40"
                    >
                      خرید سریع و آنی
                    </button>
                    <button 
                      type="button"
                      onClick={() => toggleFavorite(product.id)}
                      className="h-10 bg-slate-50 hover:bg-rose-50 text-slate-700 hover:text-rose-600 border border-slate-200 hover:border-rose-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-[0.99] cursor-pointer"
                    >
                      <Heart className={`w-4 h-4 transition-colors ${favorite ? 'fill-rose-500 text-rose-500' : ''}`} />
                      <span>{favorite ? 'در علاقه‌مندی‌ها' : 'علاقه‌مندی'}</span>
                    </button>
                  </div>

                </div>

                {/* Added Toast */}
                {addedToast && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center justify-between animate-in fade-in">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>محصول با موفقیت به سبد خرید اضافه شد!</span>
                    </div>
                    <button onClick={() => setActiveView('cart')} className="font-bold underline text-emerald-900">
                      مشاهده سبد
                    </button>
                  </div>
                )}

              </div>
            </div>

          </div>

          {/* ========================================================================= */}
          {/* Detailed Information Tabs Section (Specs, Description, Reviews)            */}
          {/* ========================================================================= */}
          <div id="details-section-tabs" className="mt-8 space-y-6">
            
            {/* Tab Bar Header */}
            <div className="flex items-center gap-2 border-b border-slate-200 pb-px">
              <button
                type="button"
                onClick={() => setActiveTab('specs')}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-colors -mb-px ${
                  activeTab === 'specs' 
                    ? 'border-blue-600 text-blue-600 bg-white rounded-t-xl' 
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <SlidersHorizontal className="w-4 h-4" />
                <span>مشخصات فنی</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('desc')}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-colors -mb-px ${
                  activeTab === 'desc' 
                    ? 'border-blue-600 text-blue-600 bg-white rounded-t-xl' 
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>معرفی و نقد کالا</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('reviews')}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-colors -mb-px ${
                  activeTab === 'reviews' 
                    ? 'border-blue-600 text-blue-600 bg-white rounded-t-xl' 
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <Star className="w-4 h-4" />
                <span>نظرات کاربران ({commentsList.length})</span>
              </button>
            </div>

            {/* TAB 1: Technical Specs */}
            {activeTab === 'specs' && (
              <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-xs animate-in fade-in">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">مشخصات فنی و استانداردهای کالا</h2>
                    <p className="text-xs text-slate-500 mt-1">مشخصات استخراج‌شده از کاتالوگ رسمی و تأییدشده محصول</p>
                  </div>
                </div>

                {specGroups.length > 0 ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {specGroups.map((group, gIdx) => {
                      const GroupIcon = group.icon;
                      return (
                        <div key={`spec-group-${gIdx}`} className="bg-slate-50/70 rounded-xl p-4 border border-slate-200/70">
                          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-200/60">
                            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                              <GroupIcon className="w-4 h-4" />
                            </div>
                            <h3 className="text-sm font-bold text-slate-900">{group.title}</h3>
                          </div>
                          <dl className="space-y-2 text-xs">
                            {group.specs.map(([key, val]) => (
                              <div key={key} className="flex justify-between items-center py-1.5 border-b border-slate-200/40 last:border-0">
                                <dt className="text-slate-500">{key}</dt>
                                <dd className="text-slate-900 font-semibold text-left">{formatSpecValue(val)}</dd>
                              </div>
                            ))}
                          </dl>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-8 text-center text-xs text-slate-400">
                    مشخصات فنی کاملی برای این کالا ثبت نشده است.
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: Description & Overview */}
            {activeTab === 'desc' && (
              <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-xs animate-in fade-in space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                  <div className="lg:col-span-8 space-y-4">
                    <h2 className="text-lg font-bold text-slate-900">بررسی تخصصی و معرفی محصول</h2>
                    <div className="text-sm text-slate-600 leading-relaxed space-y-4">
                      <p>
                        {product.description || 'تجهیزات شبکه و مودم‌های نسل جدید نوین‌نت، با استانداردهای جهانی و به‌کارگیری چیپست‌های پردازشی مدرن، پایداری بدون قطعی را برای مصارف خانگی، اداری و سازمانی به ارمغان می‌آورند.'}
                      </p>
                      {product.short_description && (
                        <p className="bg-blue-50/50 border-r-4 border-blue-600 p-4 rounded-l-xl text-blue-950 font-medium">
                          {product.short_description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="lg:col-span-4 space-y-3">
                    <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200/80">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-2">
                        <Cpu className="w-4 h-4" />
                      </div>
                      <h4 className="text-xs font-bold text-slate-900 mb-1">پردازش قدرتمند داده</h4>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        مدیریت همزمان اتصال ده‌ها دستگاه هوشمند بدون افت محسوس سرعت یا تاخیر شبکه.
                      </p>
                    </div>

                    <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200/80">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-2">
                        <Shield className="w-4 h-4" />
                      </div>
                      <h4 className="text-xs font-bold text-slate-900 mb-1">امنیت رمزنگاری پیشرفته</h4>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        استانداردهای مدرن حفاظتی و فایروال داخلی برای محافظت از حریم خصوصی آنلاین شما.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: User Reviews */}
            {activeTab === 'reviews' && (
              <div id="user-reviews-section" className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-xs animate-in fade-in space-y-8">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-5">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">نظرات و امتیاز خریداران</h2>
                    <p className="text-xs text-slate-500 mt-1">تجربه خریداران واقعی محصول {product.name}</p>
                  </div>
                  <button 
                    onClick={() => setShowReviewModal(true)}
                    className="h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold px-5 flex items-center gap-2 transition shadow-xs cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>ثبت نظر شما</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                  
                  {/* Rating Breakdown */}
                  <div className="lg:col-span-4 bg-slate-50/80 p-5 rounded-xl border border-slate-200/80 space-y-4">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl font-bold text-slate-900 font-mono tabular-nums">{product.rating}</span>
                      <div>
                        <div className="flex text-amber-500 mb-1">
                          {[1, 2, 3, 4, 5].map(st => (
                            <Star key={st} className="w-4 h-4 fill-amber-500 text-amber-500" />
                          ))}
                        </div>
                        <span className="text-xs text-slate-500">
                          بر مبنای {commentsList.length > 0 ? commentsList.length : product.review_count} دیدگاه ثبت‌شده
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-200/60 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-6 font-bold">۵ ستاره</span>
                        <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-500 rounded-full w-[80%]" />
                        </div>
                        <span className="w-8 text-left text-slate-500 font-mono tabular-nums">۸۰٪</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-6 font-bold">۴ ستاره</span>
                        <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-500 rounded-full w-[15%]" />
                        </div>
                        <span className="w-8 text-left text-slate-500 font-mono tabular-nums">۱۵٪</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-6 font-bold">۳ ستاره</span>
                        <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-500 rounded-full w-[5%]" />
                        </div>
                        <span className="w-8 text-left text-slate-500 font-mono tabular-nums">۵٪</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-400">
                        <span className="w-6 font-bold">۲ ستاره</span>
                        <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div className="h-full bg-slate-200 rounded-full w-0" />
                        </div>
                        <span className="w-8 text-left font-mono tabular-nums">۰٪</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-400">
                        <span className="w-6 font-bold">۱ ستاره</span>
                        <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div className="h-full bg-slate-200 rounded-full w-0" />
                        </div>
                        <span className="w-8 text-left font-mono tabular-nums">۰٪</span>
                      </div>
                    </div>
                  </div>

                  {/* Reviews List */}
                  <div className="lg:col-span-8 space-y-4">
                    {commentsList.length > 0 ? (
                      commentsList.map(comment => {
                        const userReaction = userReactions[comment.id];
                        const initial = comment.author.charAt(0);

                        return (
                          <div key={comment.id} className="p-4 bg-slate-50/80 rounded-xl border border-slate-200/70 space-y-2.5">
                            <div className="flex justify-between items-start">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                                  {initial}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-900">{comment.author}</span>
                                    {comment.is_buyer && (
                                      <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200/60 px-1.5 py-0.5 rounded font-semibold">
                                        خریدار محصول
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-xs text-slate-400">{comment.date}</span>
                                </div>
                              </div>
                              <div className="flex text-amber-500">
                                {[1, 2, 3, 4, 5].map(st => (
                                  <Star key={st} className={`w-3.5 h-3.5 ${st <= comment.rating ? 'fill-amber-500 text-amber-500' : 'text-slate-200'}`} />
                                ))}
                              </div>
                            </div>

                            {comment.title && (
                              <h4 className="text-xs font-bold text-slate-900">{comment.title}</h4>
                            )}

                            <p className="text-xs text-slate-600 leading-relaxed">
                              {comment.content}
                            </p>

                            {/* Pros & Cons */}
                            {((comment.pros && comment.pros.length > 0) || (comment.cons && comment.cons.length > 0)) && (
                              <div className="pt-1 flex flex-wrap gap-2 text-xs">
                                {comment.pros?.map((p, i) => (
                                  <span key={`pro-${p}-${i}`} className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-200/50">
                                    + {p}
                                  </span>
                                ))}
                                {comment.cons?.map((c, i) => (
                                  <span key={`con-${c}-${i}`} className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 text-xs font-medium border border-rose-200/50">
                                    - {c}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Helpful reaction buttons */}
                            <div className="flex items-center justify-end gap-2 text-xs text-slate-500 pt-1">
                              <span className="text-xs">مفید بود؟</span>
                              <button
                                onClick={() => handleReaction(comment.id, 'like')}
                                className={`flex items-center gap-1 px-2.5 py-1 rounded-md border text-xs transition ${
                                  userReaction === 'like' ? 'border-blue-600 bg-blue-50 text-blue-700 font-bold' : 'border-slate-200 bg-white hover:bg-slate-50'
                                }`}
                              >
                                <ThumbsUp className="w-3 h-3" />
                                <span className="font-mono tabular-nums">{comment.likes || 0}</span>
                              </button>
                              <button
                                onClick={() => handleReaction(comment.id, 'dislike')}
                                className={`flex items-center gap-1 px-2.5 py-1 rounded-md border text-xs transition ${
                                  userReaction === 'dislike' ? 'border-rose-600 bg-rose-50 text-rose-700 font-bold' : 'border-slate-200 bg-white hover:bg-slate-50'
                                }`}
                              >
                                <ThumbsDown className="w-3 h-3" />
                                <span className="font-mono tabular-nums">{comment.dislikes || 0}</span>
                              </button>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center py-10 text-slate-400 text-xs">
                        هنوز دیدگاهی برای این کالا ثبت نشده است. اولین نفری باشید که تجربه خود را می‌نویسد!
                      </div>
                    )}
                  </div>

                </div>
              </div>
            )}

          </div>

          {/* Desktop Related Products */}
          {relatedProducts.length > 0 && (
            <div className="mt-16 pt-8 border-t border-slate-200/80">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-blue-600" />
                    <span>کالاهای مرتبط و پیشنهادی</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">محصولات مشابه از همین دسته‌بندی</p>
                </div>
                <button
                  onClick={() => navigateToCategory(product.category_slug)}
                  className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1 transition"
                >
                  <span>مشاهده همه محصولات این دسته</span>
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {relatedProducts.map((rel) => (
                  <div
                    key={`desk-rel-${rel.id}`}
                    onClick={() => navigateToProduct(rel.slug)}
                    className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs hover:shadow-md hover:border-blue-300 transition flex flex-col justify-between cursor-pointer group"
                  >
                    <div className="aspect-square w-full rounded-xl bg-slate-50/70 p-4 mb-3 flex items-center justify-center overflow-hidden">
                      <img
                        src={rel.image_url}
                        alt={rel.name}
                        className="max-h-full max-w-full object-contain mix-blend-multiply group-hover:scale-105 transition duration-300"
                        onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = '/images/product-placeholder.svg'; }}
                      />
                    </div>
                    <div className="space-y-1.5 mb-3">
                      <span className="text-xs font-semibold text-blue-600 block">
                        {rel.category_name || rel.brand}
                      </span>
                      <h4 className="text-sm font-bold text-slate-800 line-clamp-2 group-hover:text-blue-600 transition leading-snug">
                        {rel.name}
                      </h4>
                    </div>
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                      <div>
                        <span className="text-sm font-bold text-slate-900 font-mono tabular-nums">
                          {((rel.effective_price || rel.base_price) ?? 0).toLocaleString('fa-IR')}
                        </span>
                        <span className="text-xs text-slate-500 mr-1">تومان</span>
                      </div>
                      <span className="text-xs font-semibold text-blue-600 group-hover:underline">
                        مشاهده
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </main>
      </div>

      {/* Shared Copied Share Link Toast */}
      {copiedToast && (
        <div className="fixed bottom-24 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-xs px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>لینک محصول با موفقیت در کلیپ‌بورد کپی شد!</span>
        </div>
      )}

      {/* Add Review Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs"
            onClick={() => setShowReviewModal(false)}
          />
          
          <div className="relative bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl z-10 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">ثبت نظر برای {product.name}</h3>
              <button onClick={() => setShowReviewModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            {reviewSuccess ? (
              <div className="p-6 text-center space-y-2">
                <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
                <h4 className="font-bold text-sm text-slate-900">دیدگاه شما با موفقیت ثبت شد!</h4>
                <p className="text-xs text-slate-500">از اینکه تجربه خود را با سایر کاربران به اشتراک گذاشتید سپاسگزاریم.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmitReview} className="space-y-3.5 text-xs">
                
                <div>
                  <label className="font-bold text-slate-700 block mb-1">امتیاز شما به این کالا:</label>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button
                        type="button"
                        key={star}
                        onClick={() => setNewRating(star)}
                        className="p-1 hover:scale-110 transition"
                      >
                        <Star 
                          className={`w-6 h-6 ${star <= newRating ? 'fill-amber-500 text-amber-500' : 'text-slate-200'}`} 
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">نام و نام خانوادگی:</label>
                  <input
                    type="text"
                    required
                    value={newAuthor}
                    onChange={(e) => setNewAuthor(e.target.value)}
                    placeholder="مثال: علی رضایی"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">عنوان نظر (اختیاری):</label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="خلاصه نظر شما..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">متن دیدگاه شما:</label>
                  <textarea
                    required
                    rows={3}
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    placeholder="کیفیت ساخت، سرعت اتصال، میزان رضایت از خرید و..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:bg-white transition"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="font-bold text-emerald-700 block mb-1">نقاط قوت (با کاما جدا کنید):</label>
                    <input
                      type="text"
                      value={newPros}
                      onChange={(e) => setNewPros(e.target.value)}
                      placeholder="سرعت بالا, نصب آسان"
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-rose-700 block mb-1">نقاط ضعف (با کاما جدا کنید):</label>
                    <input
                      type="text"
                      value={newCons}
                      onChange={(e) => setNewCons(e.target.value)}
                      placeholder="قیمت, وزن دستگاه"
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-rose-600"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowReviewModal(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs cursor-pointer"
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

export default ProductDetailView;
