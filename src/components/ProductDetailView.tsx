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
  ThumbsUp, 
  ThumbsDown, 
  MessageSquarePlus, 
  CheckCircle2, 
  User, 
  X, 
  PackageX, 
  Store, 
  Compass, 
  ChevronDown, 
  ChevronUp,
  ChevronLeft,
  SlidersHorizontal,
  Info,
  Zap,
  Activity,
  Radio,
  Cpu,
  Shield,
  Wifi,
  Lock,
  Edit3
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

  // Split specs into categories if possible or group them nicely
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
      { title: 'اقلام همراه و امکانات', icon: ShieldCheck, specs: specEntries.slice(quarter * 3) },
    ].filter(g => g.specs.length > 0);
  }, [specEntries]);

  // 1. Loading Skeleton state
  if (isResolving) {
    return <ProductDetailSkeleton />;
  }

  // 2. Dedicated Product 404 Not Found State
  if (isNotFound || !product) {
    const suggestedProducts = storefrontProducts.slice(0, 4);

    return (
      <div className="min-h-[70vh] max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-8 sm:p-12 text-center max-w-3xl mx-auto mb-16">
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
              className="px-6 py-3 bg-[#1333c1] hover:bg-[#1333c1]/90 text-white rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-lg shadow-[#1333c1]/20 transition"
            >
              <Store className="w-4 h-4" />
              <span>مشاهده همه محصولات فروشگاه</span>
            </button>
          </div>
        </div>

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
                    <span className="ui-text-badge text-[#1333c1] block mb-1">
                      {p.category_name || p.brand}
                    </span>
                    <h3 className="ui-text-card-title text-slate-800 line-clamp-2 mb-3 group-hover:text-[#1333c1] transition">
                      {p.name}
                    </h3>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                    <span className="ui-price text-slate-900">
                      {((p.effective_price || p.base_price) ?? 0).toLocaleString('fa-IR')} {p.currency}
                    </span>
                    <span className="ui-text-meta text-[#1333c1] group-hover:underline">
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
    <div className="bg-[#F8F9FC] text-[#1A1B23] min-h-screen">
      
      {/* ========================================================================= */}
      {/* 📱 MOBILE VIEW — EXACT USER MOBILE TEMPLATE IMPLEMENTATION                 */}
      {/* ========================================================================= */}
      <div className="md:hidden pb-32">
        
        {/* Sticky Mobile Header */}
        <header className="sticky top-0 z-40 bg-white border-b border-[#E6E8F0] h-14 flex items-center justify-between px-4">
          <button 
            onClick={() => {
              if (window.history.length > 1) {
                window.history.back();
              } else {
                navigateToCategory(null);
              }
            }}
            aria-label="Back" 
            className="h-11 w-11 flex items-center justify-center rounded-xl hover:bg-[#f4f2fe] transition-colors"
          >
            <ArrowRight className="w-5 h-5 text-[#1A1B23]" />
          </button>
          
          <div className="flex-1 px-2">
            <h1 className="ui-text-card-title text-center truncate text-[#1A1B23]">
              جزئیات محصول
            </h1>
          </div>

          <div className="w-11" />
        </header>

        <main className="px-4 mt-3 space-y-4">
          
          {/* Mobile Gallery Card */}
          <div className="relative group p-2 bg-white rounded-3xl border border-[#E6E8F0]/50 shadow-xl shadow-[#364fd9]/5">
            <div className="relative aspect-[16/10] rounded-2xl overflow-hidden bg-[#F8F9FC] flex items-center justify-center">
              <img 
                alt={product.name} 
                className="w-full h-full object-contain p-2 transition-transform duration-700 group-hover:scale-105" 
                src={activeImage || selectedVariant?.image_url || product.image_url} 
                onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = '/images/product-placeholder.svg'; }}
              />
              {product.discount_percentage ? (
                <div className="absolute top-3 right-3 bg-red-600 text-white ui-text-badge px-2.5 py-0.5 rounded-lg shadow-sm">
                  {product.discount_percentage}٪ تخفیف
                </div>
              ) : null}
            </div>

            {/* Gallery Thumbnails */}
            {galleryImages.length > 1 && (
              <div className="flex gap-3 mt-4 px-2 overflow-x-auto pb-2 snap-x hide-scrollbar">
                {galleryImages.map((img, idx) => (
                  <button 
                    key={`thumb-mob-${idx}`}
                    type="button"
                    onClick={() => setActiveImage(img)}
                    className={`w-20 h-20 flex-shrink-0 rounded-xl overflow-hidden snap-start relative transition-all p-1 bg-white ${
                      activeImage === img 
                        ? 'border-2 border-[#364fd9] shadow-md opacity-100' 
                        : 'border border-[#E6E8F0]/50 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img 
                      alt={`Thumbnail ${idx + 1}`} 
                      className="w-full h-full object-contain mix-blend-multiply" 
                      src={img} 
                      onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = '/images/product-placeholder.svg'; }}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>



          {/* Product Info */}
          <div className="flex flex-col gap-1 mt-3">
            <div className="flex justify-between items-start mb-2">
              <span className="ui-text-badge text-[#364fd9] bg-[#364fd9]/10 px-3 py-1 rounded-full uppercase tracking-wider">
                {product.brand || product.category_name || 'ORIGINAL'}
              </span>
            </div>
            <h2 className="leading-tight font-bold text-[#1A1B23] mb-1 ui-text-page-title">
              {product.name}
            </h2>
            <p className="ui-text-body text-[#444654]">
              {product.short_description || product.technology || 'مودم روتر بی‌سیم نسل جدید با پایداری سیگنال و سرعت فوق‌العاده'}
            </p>
          </div>

          {/* Model Selection */}
          {configurationChoices.length > 0 && (
            <div className="flex flex-col gap-2 mt-2">
              <label className="block ui-text-label font-bold text-[#444654] mb-1">انتخاب مدل</label>
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
                      className={`px-4 py-2 rounded-lg ui-text-button transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                        selected 
                          ? 'border-2 border-[#364fd9] bg-[#364fd9]/5 text-[#364fd9]' 
                          : 'border border-[#E6E8F0] text-[#444654] font-medium bg-white'
                      }`}
                    >
                      {name}
                      {unavailable && <small className="mr-1 ui-text-badge text-red-500 font-normal">(ناموجود)</small>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Color Selection */}
          {displayColorChoices.length > 0 && (
            <div className="mt-2">
              <div className="flex justify-between items-center mb-2">
                <label className="ui-text-label font-bold text-[#444654]">انتخاب رنگ</label>
                <span className="ui-text-meta font-medium text-[#444654]">{selectedColor || 'انتخاب کنید'}</span>
              </div>
              <div className="flex gap-3">
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
                      className={`w-8 h-8 rounded-full p-0.5 transition-all ${
                        selected 
                          ? 'border-2 border-[#364fd9] bg-white ring-2 ring-[#364fd9]/10' 
                          : 'border-2 border-transparent hover:border-[#c5c5d7]'
                      } ${unavailable ? 'opacity-35 grayscale cursor-not-allowed' : ''}`}
                    >
                      <div className="w-full h-full rounded-full border border-[#E6E8F0] flex items-center justify-center" style={{ backgroundColor: hex }}>
                        {selected && <Check className="w-3.5 h-3.5 text-white drop-shadow" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Price Card Mobile Focus */}
          <div className="mt-4 p-4 bg-white rounded-xl border border-[#E6E8F0] shadow-sm flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <span className="ui-text-label font-bold text-[#444654]">قیمت نهایی</span>
              <span className={`ui-text-badge px-2 py-1 rounded-md border flex items-center gap-1 ${
                isOutOfStock ? 'bg-red-50 text-red-700 border-red-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'
              }`}>
                <PackageX className="w-3.5 h-3.5" />
                {isOutOfStock ? 'ناموجود در انبار' : 'موجود در انبار'}
              </span>
            </div>
            <div className="flex items-baseline justify-end gap-1.5 mt-1 w-full">
              {product.discount_percentage ? (
                <span className="ui-text-meta text-slate-400 line-through ui-numeric ml-2">
                  {(product.base_price || 0).toLocaleString('fa-IR')}
                </span>
              ) : null}
              <span className="ui-price-hero text-[#364fd9]">
                {currentPrice.toLocaleString('fa-IR')}
              </span>
              <span className="ui-text-meta font-medium text-[#444654]">تومان</span>
            </div>
          </div>

          {/* Key Features List */}
          <div className="mt-4 mb-4">
            <h3 className="ui-text-section-title text-[#1A1B23] mb-3">ویژگی‌های کلیدی:</h3>
            <ul className="grid grid-cols-1 gap-2">
              <li className="flex items-center gap-3 ui-text-body text-[#444654] bg-white p-2.5 rounded-lg border border-[#E6E8F0]">
                <span className="w-6 h-6 rounded-full bg-[#364fd9]/10 flex items-center justify-center text-[#364fd9] shrink-0">
                  <Check className="w-3.5 h-3.5" />
                </span>
                پشتیبانی از شبکه 5G فوق سریع
              </li>
              <li className="flex items-center gap-3 ui-text-body text-[#444654] bg-white p-2.5 rounded-lg border border-[#E6E8F0]">
                <span className="w-6 h-6 rounded-full bg-[#364fd9]/10 flex items-center justify-center text-[#364fd9] shrink-0">
                  <Check className="w-3.5 h-3.5" />
                </span>
                {product.technology || 'فناوری Wi-Fi 6 دو بانده'}
              </li>
              <li className="flex items-center gap-3 ui-text-body text-[#444654] bg-white p-2.5 rounded-lg border border-[#E6E8F0]">
                <span className="w-6 h-6 rounded-full bg-[#364fd9]/10 flex items-center justify-center text-[#364fd9] shrink-0">
                  <Check className="w-3.5 h-3.5" />
                </span>
                کد اصالت کالا: {product.sku}
              </li>
            </ul>
          </div>

          {/* Description Card */}
          {product.description && (
            <div className="border border-[#E6E8F0] rounded-xl bg-white p-4 shadow-sm">
              <h3 className="ui-text-section-title text-[#1A1B23] mb-2">معرفی کالا</h3>
              <p className="ui-text-body text-[#444654]">
                {product.description}
              </p>
            </div>
          )}

          {/* Specs Accordion Structured */}
          <div className="border border-[#E6E8F0] rounded-xl bg-white overflow-hidden shadow-sm">
            <details className="group" open>
              <summary className="flex justify-between items-center p-3 ui-text-section-title text-[#1A1B23] cursor-pointer list-none select-none">
                <span>مشخصات فنی</span>
                <ChevronDown className="w-4 h-4 text-[#444654] transition-transform group-open:rotate-180" />
              </summary>
              <div className="p-3 border-t border-[#E6E8F0] bg-[#F8F9FC] flex flex-col gap-3">
                {specGroups.length > 0 ? (
                  specGroups.map((group, gIdx) => {
                    const GroupIcon = group.icon;
                    return (
                      <div key={`mob-spec-group-${gIdx}`} className="bg-white rounded-lg p-3 border border-[#E6E8F0]">
                        <div className="flex items-center gap-2 mb-3 border-b border-[#E6E8F0] pb-2">
                          <div className="w-6 h-6 rounded bg-[#364fd9]/10 flex items-center justify-center text-[#364fd9]">
                            <GroupIcon className="w-3.5 h-3.5" />
                          </div>
                          <h3 className="ui-text-card-title text-[#1A1B23]">{group.title}</h3>
                        </div>
                        {group.specs.map(([key, val], sIdx) => (
                          <div 
                            key={`spec-${key}`} 
                            className={`flex justify-between items-center py-1.5 ${sIdx < group.specs.length - 1 ? 'border-b border-[#E6E8F0]/50' : ''}`}
                          >
                            <span className="ui-text-meta text-[#444654]">{key}</span>
                            <span className="ui-text-meta font-medium text-[#1A1B23] text-left">{formatSpecValue(val)}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })
                ) : (
                  <p className="ui-text-meta text-slate-400 py-1">مشخصات فنی ثبت نشده است.</p>
                )}
              </div>
            </details>
          </div>

          {/* Mobile Reviews Card */}
          <div className="border border-[#E6E8F0] rounded-xl bg-white p-4 shadow-sm">
            <div className="flex justify-between items-center mb-3">
              <h3 className="ui-text-section-title text-[#1A1B23]">
                نظرات کاربران ({commentsList.length})
              </h3>
              <button 
                onClick={() => setShowReviewModal(true)}
                className="ui-text-button text-[#364fd9] flex items-center gap-1"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>ثبت نظر</span>
              </button>
            </div>

            {commentsList.length > 0 ? (
              <div className="space-y-3">
                {commentsList.slice(0, 3).map(comment => (
                  <div key={comment.id} className="p-3 bg-[#F8F9FC] rounded-lg text-xs space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-[#1A1B23]">{comment.author}</span>
                      <div className="flex text-[#F59E0B]">
                        {[1, 2, 3, 4, 5].map(st => (
                          <Star key={st} className={`w-3 h-3 ${st <= comment.rating ? 'fill-[#F59E0B] text-[#F59E0B]' : 'text-slate-200'}`} />
                        ))}
                      </div>
                    </div>
                    <p className="text-[#444654] leading-relaxed ui-text-body">{comment.content}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="ui-text-meta text-slate-400">هنوز نظری ثبت نشده است.</p>
            )}
          </div>

        </main>

        {/* Sticky Bottom Purchase Bar (Mobile) */}
        <aside className="sm:hidden fixed inset-x-0 bottom-0 z-50 w-full bg-white/95 backdrop-blur-md border-t border-[#E6E8F0] shadow-[0_-4px_20px_rgba(0,0,0,0.08)] px-4 py-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))]" aria-label="خرید محصول">
          <div className="flex items-center justify-between gap-2 max-w-lg mx-auto w-full">
            <div className="flex items-center gap-2">
              <button 
                type="button" 
                onClick={() => toggleFavorite(product.id)}
                aria-label="افزودن به علاقه‌مندی‌ها" 
                className="h-10 w-10 flex items-center justify-center rounded-xl border border-[#E6E8F0] bg-white active:scale-95 transition-transform shrink-0"
              >
                <Heart className={`w-4 h-4 ${favorite ? 'fill-red-500 text-red-500' : 'text-[#444654]'}`} />
              </button>
              <div className="flex flex-col justify-center">
                <div className="flex items-center gap-1">
                  <span className="ui-price text-[#364fd9]">
                    {isOutOfStock ? 'ناموجود' : currentPrice.toLocaleString('fa-IR')}
                  </span>
                  {!isOutOfStock && <span className="ui-text-meta font-normal text-[#444654]">تومان</span>}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div dir="ltr" className="flex shrink-0 items-center rounded-xl border border-[#E6E8F0] bg-[#F8F9FC] p-0.5" aria-label="تعداد سفارش">
                <button 
                  type="button" 
                  aria-label="افزایش تعداد" 
                  onClick={() => setQuantity((current) => Math.min(selectedStock, current + 1))} 
                  disabled={isAtQuantityLimit || isAddingToCart} 
                  className="h-7 w-7 rounded-lg bg-white text-xs font-bold text-[#364fd9] shadow-xs disabled:opacity-40"
                >
                  +
                </button>
                <span className="w-6 text-center ui-text-button ui-numeric font-semibold">{quantity}</span>
                <button 
                  type="button" 
                  aria-label="کاهش تعداد" 
                  onClick={() => setQuantity((current) => Math.max(1, current - 1))} 
                  disabled={isOutOfStock || isAddingToCart || quantity <= 1} 
                  className="h-7 w-7 rounded-lg bg-white text-xs font-bold text-slate-700 shadow-xs disabled:opacity-40"
                >
                  −
                </button>
              </div>

              <button 
                type="button" 
                onClick={() => { void handleAddToCart(); }} 
                disabled={isOutOfStock || isAddingToCart}
                aria-label={isOutOfStock ? 'ناموجود' : isAddingToCart ? 'در حال افزودن…' : 'افزودن به سبد خرید'}
                className="h-10 w-[85px] bg-[#364fd9] text-white rounded-xl active:scale-95 transition-transform flex items-center justify-center shadow-md shadow-[#364fd9]/25 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none shrink-0"
              >
                <ShoppingCart className="w-5 h-5" />
              </button>
            </div>
          </div>
        </aside>

      </div>

      {/* ========================================================================= */}
      {/* 💻 DESKTOP VIEW — EXACT USER DESIGN                                        */}
      {/* ========================================================================= */}
      <div className="hidden md:block">
        <main className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
          
          {/* Breadcrumb Navigation */}
          <nav aria-label="Breadcrumb" className="flex items-center h-[24px] gap-2 ui-text-meta text-[#444654] mb-6">
            <button onClick={() => setActiveView('home')} className="hover:text-[#1333c1] transition-colors">خانه</button>
            <ChevronLeft className="w-4 h-4 text-[#444654]/60" />
            <button onClick={() => navigateToCategory(null, [])} className="hover:text-[#1333c1] transition-colors">فروشگاه</button>
            <ChevronLeft className="w-4 h-4 text-[#444654]/60" />
            <button 
              onClick={() => navigateToCategory(product.category_slug, product.category_path || [product.category_slug])}
              className="hover:text-[#1333c1] transition-colors"
            >
              {product.category_name}
            </button>
            <ChevronLeft className="w-4 h-4 text-[#444654]/60" />
            <span aria-current="page" className="text-[#1A1B23] font-medium truncate max-w-[300px]">{product.name}</span>
          </nav>

          {/* Main Product Section (2 Columns: Right Gallery 7 cols, Left Purchase Panel 5 cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
            
            {/* Right: Product Gallery (cols 1-7 in RTL) */}
            <div className="lg:col-span-7 flex flex-col gap-3">
              <div className="relative group p-2 bg-white rounded-3xl border border-[#E3E1ED]/70 shadow-xl shadow-[#1333c1]/5">
                <div className="relative aspect-[16/10] rounded-2xl overflow-hidden bg-[#FBF8FF] flex items-center justify-center">
                  <img 
                    alt={product.name} 
                    className="w-full h-full object-contain p-4 transition-transform duration-700 group-hover:scale-105" 
                    src={activeImage || selectedVariant?.image_url || product.image_url} 
                    onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = '/images/product-placeholder.svg'; }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                  
                  {/* Floating Discount Badge */}
                  {product.discount_percentage ? (
                    <div className="absolute top-4 right-4 bg-red-600 text-white ui-text-badge px-3 py-1 rounded-lg shadow-sm">
                      {product.discount_percentage}٪ تخفیف
                    </div>
                  ) : null}
                </div>

                {/* Thumbnails Strip */}
                {galleryImages.length > 1 && (
                  <div className="flex gap-3 mt-4 px-2 overflow-x-auto pb-2 snap-x no-scrollbar">
                    {galleryImages.map((image, index) => (
                      <button 
                        key={image}
                        type="button"
                        onClick={() => setActiveImage(image)}
                        className={`w-20 h-20 flex-shrink-0 rounded-xl overflow-hidden snap-start transition-all p-1 bg-white ${
                          activeImage === image 
                            ? 'border-2 border-[#1333c1] shadow-md relative opacity-100' 
                            : 'border border-[#E3E1ED]/50 hover:border-[#1333c1]/50 opacity-60 hover:opacity-100 backdrop-blur-md'
                        }`}
                      >
                        <img 
                          alt={`Thumbnail ${index + 1}`} 
                          className="w-full h-full object-contain mix-blend-multiply" 
                          src={image} 
                          onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = '/images/product-placeholder.svg'; }}
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 3 Quality / Tech Highlight Cards */}
              <div className="grid grid-cols-3 gap-4 mt-6">
                <div className="group flex flex-col items-center justify-center text-center p-4 bg-white rounded-2xl border border-[#E3E1ED]/50 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300">
                  <div className="w-12 h-12 rounded-xl bg-[#1333c1]/5 flex items-center justify-center mb-3 text-[#1333c1] group-hover:bg-[#1333c1] group-hover:text-white transition-colors">
                    <Zap className="w-6 h-6" />
                  </div>
                  <span className="ui-text-label font-semibold text-[#1A1B23]">تکنولوژی نسل پنجم</span>
                </div>

                <div className="group flex flex-col items-center justify-center text-center p-4 bg-white rounded-2xl border border-[#E3E1ED]/50 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300">
                  <div className="w-12 h-12 rounded-xl bg-[#1333c1]/5 flex items-center justify-center mb-3 text-[#1333c1] group-hover:bg-[#1333c1] group-hover:text-white transition-colors">
                    <Activity className="w-6 h-6" />
                  </div>
                  <span className="ui-text-label font-semibold text-[#1A1B23]">پایداری فوق‌العاده</span>
                </div>

                <div className="group flex flex-col items-center justify-center text-center p-4 bg-white rounded-2xl border border-[#E3E1ED]/50 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300">
                  <div className="w-12 h-12 rounded-xl bg-[#1333c1]/5 flex items-center justify-center mb-3 text-[#1333c1] group-hover:bg-[#1333c1] group-hover:text-white transition-colors">
                    <Truck className="w-6 h-6" />
                  </div>
                  <span className="ui-text-label font-semibold text-[#1A1B23]">ارسال و نصب سریع</span>
                </div>
              </div>

            </div>

            {/* Left: Purchase Panel (cols 8-12 in RTL) */}
            <div className="lg:col-span-5">
              <div className="bg-[#fbf8ff] border border-[#E3E1ED] rounded-xl p-5 flex flex-col h-full sticky top-[80px]">
                
                {/* Title & Brand & Rating Header */}
                <div className="mb-6">
                  {product.brand && (
                    <button 
                      onClick={() => navigateToCategory(null, [])}
                      className="ui-text-badge font-semibold tracking-wider uppercase text-[#1333c1]/80 hover:text-[#1333c1] transition-colors mb-1.5 inline-block text-right cursor-pointer"
                    >
                      {product.brand}
                    </button>
                  )}
                  <h1 className="ui-text-page-title text-[#1A1B23] leading-tight mb-3">
                    {product.name}
                  </h1>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 bg-[#f4f2fe] px-2 py-1 rounded-md">
                      <Star className="w-4 h-4 text-[#F59E0B] fill-[#F59E0B]" />
                      <span className="ui-text-meta font-bold text-[#1A1B23] ui-numeric">{product.rating}</span>
                    </div>
                    <span 
                      onClick={() => {
                        const el = document.getElementById('user-reviews-section');
                        el?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="ui-text-meta text-[#444654] hover:text-[#1333c1] transition-colors cursor-pointer underline underline-offset-4 decoration-[#c5c5d7]/30"
                    >
                      ({commentsList.length > 0 ? commentsList.length : product.review_count} نظر کاربر)
                    </span>
                  </div>
                </div>

                <div className="space-y-6 mb-8">
                  
                  {/* Model Selection */}
                  {configurationChoices.length > 0 && (
                    <div>
                      <label className="block ui-text-label font-semibold text-[#444654] mb-3">انتخاب مدل</label>
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
                              className={`px-4 py-2 rounded-lg ui-text-label font-semibold transition-all disabled:opacity-45 disabled:cursor-not-allowed ${
                                selected 
                                  ? 'border-2 border-[#1333c1] bg-[#1333c1]/5 text-[#1333c1]' 
                                  : 'border border-[#c5c5d7]/50 hover:border-[#1333c1]/50 text-[#444654] font-medium hover:bg-white'
                              }`}
                            >
                              <span>{name}</span>
                              {unavailable && <small className="mr-1.5 ui-text-badge text-red-500 font-normal">ناموجود</small>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Color Selection */}
                  {displayColorChoices.length > 0 && (
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <label className="ui-text-label font-semibold text-[#444654]">انتخاب رنگ</label>
                        <span className="ui-text-meta text-[#444654]/70">{selectedColor || 'انتخاب کنید'}</span>
                      </div>
                      <div className="flex gap-3">
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
                                  ? 'border-2 border-[#1333c1] bg-white ring-2 ring-[#1333c1]/10' 
                                  : 'border-2 border-transparent hover:border-[#c5c5d7]'
                              } ${unavailable ? 'opacity-35 grayscale cursor-not-allowed' : ''}`}
                            >
                              <div className="w-full h-full rounded-full border border-[#c5c5d7]/30 flex items-center justify-center" style={{ backgroundColor: hex }}>
                                {selected && <Check className="w-3.5 h-3.5 text-white drop-shadow" />}
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
                      <label className="ui-text-label font-semibold text-[#444654]">گارانتی یا پکیج:</label>
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
                              className={`p-3 rounded-xl text-right border transition disabled:opacity-45 disabled:cursor-not-allowed ${
                                isSelected ? 'border-[#1333c1] bg-[#1333c1]/5 shadow-xs' : 'border-[#E3E1ED] bg-white hover:border-[#1333c1]/40'
                              }`}
                            >
                              <div className="flex items-center justify-between ui-text-label font-semibold text-[#1A1B23] mb-1">
                                <span>{variant.name}</span>
                                {isSelected && <Check className="w-3.5 h-3.5 text-[#1333c1]" />}
                              </div>
                              <div className="ui-text-meta text-[#444654]">{unavailable ? 'ناموجود' : formatMoney(variant.effective_price || product.effective_price || product.base_price, product.currency)}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                </div>

                {/* Pricing Card */}
                <div className="mb-8 p-5 bg-white rounded-xl border border-[#c5c5d7]/30 shadow-sm">
                  <div className="flex justify-between items-center mb-4">
                    <span className="ui-text-label text-[#444654]">قیمت نهایی</span>
                    <span className={`ui-text-badge px-2 py-1 rounded-md border flex items-center gap-1 ${
                      isOutOfStock ? 'bg-red-50 text-red-700 border-red-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                    }`}>
                      <PackageX className="w-3.5 h-3.5" />
                      {isOutOfStock ? 'ناموجود در انبار' : 'موجود در انبار'}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    {product.discount_percentage ? (
                      <span className="ui-text-meta text-slate-400 line-through ui-numeric ml-2">
                        {(product.base_price || 0).toLocaleString('fa-IR')}
                      </span>
                    ) : null}
                    <span className="ui-price-hero text-[#1A1B23]">
                      {currentPrice.toLocaleString('fa-IR')}
                    </span>
                    <span className="ui-text-meta text-[#444654]">تومان</span>
                  </div>
                </div>

                {/* Key Features List */}
                <div className="mb-8">
                  <h3 className="ui-text-card-title text-[#1A1B23] mb-4">ویژگی‌های کلیدی:</h3>
                  <ul className="grid grid-cols-1 gap-3">
                    <li className="flex items-center gap-3 ui-text-body text-[#444654]">
                      <span className="w-5 h-5 rounded-full bg-[#1333c1]/10 flex items-center justify-center text-[#1333c1] shrink-0">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                      پشتیبانی از شبکه 5G و اینترنت پرسرعت
                    </li>
                    <li className="flex items-center gap-3 ui-text-body text-[#444654]">
                      <span className="w-5 h-5 rounded-full bg-[#1333c1]/10 flex items-center justify-center text-[#1333c1] shrink-0">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                      {product.technology || 'فناوری Wi-Fi دو بانده و پردازش قدرتمند'}
                    </li>
                    <li className="flex items-center gap-3 ui-text-body text-[#444654]">
                      <span className="w-5 h-5 rounded-full bg-[#1333c1]/10 flex items-center justify-center text-[#1333c1] shrink-0">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                      {`کد اصالت و شناسه کالا: ${product.sku}`}
                    </li>
                  </ul>
                </div>

                {/* Quantity + Action Buttons */}
                <div className="mt-auto space-y-3">
                  
                  {/* Quantity Stepper */}
                  <div className="flex items-center justify-between p-2 bg-white border border-[#E3E1ED] rounded-xl mb-2">
                    <span className="ui-text-label text-[#444654]">تعداد:</span>
                    <div dir="ltr" className="flex shrink-0 items-center gap-2" aria-label="تعداد سفارش">
                      <button 
                        type="button" 
                        aria-label="افزایش تعداد" 
                        onClick={() => setQuantity((current) => Math.min(selectedStock, current + 1))} 
                        disabled={isAtQuantityLimit || isAddingToCart} 
                        className="w-8 h-8 rounded-lg bg-[#1333c1]/10 text-[#1333c1] font-bold hover:bg-[#1333c1]/20 disabled:bg-slate-100 disabled:text-slate-400 transition"
                      >
                        +
                      </button>
                      <span className="w-8 text-center ui-numeric font-semibold text-slate-900">{quantity}</span>
                      <button 
                        type="button" 
                        aria-label="کاهش تعداد" 
                        onClick={() => setQuantity((current) => Math.max(1, current - 1))} 
                        disabled={isOutOfStock || isAddingToCart || quantity <= 1} 
                        className="w-8 h-8 rounded-lg text-slate-700 font-bold hover:bg-slate-100 disabled:opacity-40 transition"
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
                      className="w-full h-[48px] bg-[#1333c1] text-white rounded-xl ui-text-button flex items-center justify-center gap-2 hover:bg-[#1333c1]/90 transition-all active:scale-[0.98] shadow-lg shadow-[#1333c1]/20 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none cursor-pointer"
                    >
                      <ShoppingCart className="w-5 h-5" />
                      <span>{isOutOfStock ? 'ناموجود در انبار' : isAddingToCart ? 'در حال افزودن…' : 'افزودن به سبد خرید'}</span>
                    </button>
                  </div>

                  {/* Secondary Buttons: Quick Buy & Favorite */}
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      type="button"
                      onClick={() => { void handleQuickBuy(); }}
                      disabled={isOutOfStock || isAddingToCart}
                      className="h-[44px] bg-white border border-[#c5c5d7]/50 text-[#1A1B23] rounded-xl ui-text-button hover:bg-[#FBF8FF] hover:border-[#1333c1]/30 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
                    >
                      خرید سریع
                    </button>
                    <button 
                      type="button"
                      onClick={() => toggleFavorite(product.id)}
                      className="h-[44px] bg-white border border-[#c5c5d7]/50 text-[#444654] rounded-xl ui-text-button flex items-center justify-center gap-2 hover:text-rose-500 hover:border-rose-200 hover:bg-rose-50 transition-all active:scale-[0.98] cursor-pointer"
                    >
                      <Heart className={`w-4 h-4 ${favorite ? 'fill-red-500 text-red-500' : ''}`} />
                      <span>{favorite ? 'در علاقه‌مندی‌ها' : 'علاقه‌مندی'}</span>
                    </button>
                  </div>

                </div>

                {/* Added Toast */}
                {addedToast && (
                  <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl ui-text-meta flex items-center justify-between animate-in fade-in">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>محصول به سبد خرید اضافه شد!</span>
                    </div>
                    <button onClick={() => setActiveView('cart')} className="text-emerald-800 font-semibold underline ui-text-badge">
                      مشاهده سبد
                    </button>
                  </div>
                )}

              </div>
            </div>

          </div>

          {/* Service Info & Technical Specs & Reviews Container */}
          <div className="flex flex-col gap-8">
            
            {/* 1. معرفی محصول (Product Overview) */}
            <div className="flex flex-col gap-6 bg-[#fbf8ff] rounded-xl border border-[#E3E1ED] p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                <div>
                  <h2 className="ui-text-section-title text-[#1A1B23] mb-4">معرفی محصول</h2>
                  <div className="space-y-3 ui-text-body text-[#444654] leading-relaxed">
                    <p>
                      {product.description || 'مودم و تجهیزات شبکه با استانداردهای نوین اتصال به اینترنت پرسرعت، پایداری بالا در انتقال دیتا و پوشش‌دهی گسترده را برای کاربران خانگی و حرفه‌ای به ارمغان می‌آورد.'}
                    </p>
                    {product.short_description && (
                      <p>
                        {product.short_description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-white p-4 rounded-lg border border-[#E3E1ED]">
                    <div className="w-8 h-8 rounded-full bg-[#1333c1]/10 flex items-center justify-center text-[#1333c1] mb-3">
                      <Cpu className="w-4 h-4" />
                    </div>
                    <h4 className="ui-text-card-title text-[#1A1B23] mb-1">اتصال هوشمند</h4>
                    <p className="ui-text-meta text-[#444654]">مدیریت خودکار ترافیک شبکه برای اولویت‌بندی برنامه‌های حساس و پایدار.</p>
                  </div>
                  <div className="bg-white p-4 rounded-lg border border-[#E3E1ED]">
                    <div className="w-8 h-8 rounded-full bg-[#1333c1]/10 flex items-center justify-center text-[#1333c1] mb-3">
                      <Shield className="w-4 h-4" />
                    </div>
                    <h4 className="ui-text-card-title text-[#1A1B23] mb-1">امنیت پیشرفته</h4>
                    <p className="ui-text-meta text-[#444654]">بهره‌مندی از پروتکل‌های رمزنگاری پیشرفته برای حفاظت حداکثری از داده‌ها.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. مشخصات فنی (Technical Specifications) */}
            <div className="flex flex-col gap-6 bg-[#fbf8ff] rounded-xl border border-[#E3E1ED] p-6">
              <h2 className="ui-text-section-title text-[#1A1B23] mb-2">مشخصات فنی</h2>
              
              {specGroups.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {specGroups.map((group, gIdx) => {
                    const GroupIcon = group.icon;
                    return (
                      <div key={`spec-group-${gIdx}`} className="bg-white rounded-lg p-3 border border-[#E3E1ED]">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-8 h-8 rounded bg-[#1333c1]/10 flex items-center justify-center text-[#1333c1]">
                            <GroupIcon className="w-4 h-4" />
                          </div>
                          <h3 className="ui-text-card-title text-[#1A1B23]">{group.title}</h3>
                        </div>
                        <dl className="space-y-2 ui-text-body">
                          {group.specs.map(([key, val]) => (
                            <div key={key} className="flex justify-between items-center py-1 border-b border-[#E3E1ED]/50 last:border-0">
                              <dt className="text-[#444654]">{key}</dt>
                              <dd className="text-[#1A1B23] font-medium text-left">{formatSpecValue(val)}</dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-white rounded-lg p-4 border border-[#E3E1ED] ui-text-meta text-slate-500">
                  مشخصات فنی برای این کالا ثبت نشده است.
                </div>
              )}

              <hr className="border-[#E3E1ED] my-4" />

              {/* Trust Signals */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex items-center gap-3 p-3 bg-[#f4f2fe] border border-[#E3E1ED] rounded-lg hover:border-[#1333c1]/30 transition-all group">
                  <div className="w-10 h-10 flex items-center justify-center bg-white text-[#1333c1] rounded-full group-hover:bg-[#1333c1] group-hover:text-white transition-colors border border-[#E3E1ED]">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="ui-text-card-title text-[#1A1B23] mb-0.5">گارانتی معتبر</h4>
                    <p className="ui-text-meta text-[#444654]">۱۸ ماه گارانتی شرکتی</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-[#f4f2fe] border border-[#E3E1ED] rounded-lg hover:border-[#1333c1]/30 transition-all group">
                  <div className="w-10 h-10 flex items-center justify-center bg-white text-[#1333c1] rounded-full group-hover:bg-[#1333c1] group-hover:text-white transition-colors border border-[#E3E1ED]">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="ui-text-card-title text-[#1A1B23] mb-0.5">ارسال سریع</h4>
                    <p className="ui-text-meta text-[#444654]">تحویل به سراسر کشور</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-[#f4f2fe] border border-[#E3E1ED] rounded-lg hover:border-[#1333c1]/30 transition-all group">
                  <div className="w-10 h-10 flex items-center justify-center bg-white text-[#1333c1] rounded-full group-hover:bg-[#1333c1] group-hover:text-white transition-colors border border-[#E3E1ED]">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="ui-text-card-title text-[#1A1B23] mb-0.5">پرداخت امن</h4>
                    <p className="ui-text-meta text-[#444654]">تضمین امنیت تراکنش</p>
                  </div>
                </div>
              </div>

            </div>

            {/* 3. نظرات کاربران (User Reviews Section) */}
            <div id="user-reviews-section" className="flex flex-col gap-6 bg-[#fbf8ff] rounded-xl border border-[#E3E1ED] p-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-3">
                <h2 className="ui-text-section-title text-[#1A1B23]">نظرات کاربران</h2>
                <button 
                  onClick={() => setShowReviewModal(true)}
                  className="h-[40px] bg-[#1333c1] text-white rounded-lg ui-text-button px-5 hover:bg-[#1333c1]/90 transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Edit3 className="w-4 h-4" />
                  <span>ثبت نظر</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                
                {/* Summary & Distribution */}
                <div className="md:col-span-4 flex flex-col gap-4 bg-white p-4 rounded-lg border border-[#E3E1ED]">
                  <div className="flex items-center gap-4">
                    <span className="ui-price-hero text-[#1A1B23]">{product.rating}</span>
                    <div className="flex flex-col gap-1">
                      <div className="flex text-[#F59E0B]">
                        {[1, 2, 3, 4, 5].map(st => (
                          <Star key={st} className="w-5 h-5 fill-[#F59E0B] text-[#F59E0B]" />
                        ))}
                      </div>
                      <span className="ui-text-meta text-[#444654]">
                        از مجموع {commentsList.length > 0 ? commentsList.length : product.review_count} نظر
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 mt-2">
                    {/* 5 Stars */}
                    <div className="flex items-center gap-2 ui-text-meta">
                      <span className="w-8 flex gap-1 items-center font-bold text-[#1A1B23]">۵ <Star className="w-3.5 h-3.5 text-[#F59E0B] fill-[#F59E0B]" /></span>
                      <div className="flex-1 h-1.5 bg-[#eeedf8] rounded-full overflow-hidden">
                        <div className="h-full bg-[#1333c1] rounded-full w-[80%]"></div>
                      </div>
                      <span className="w-8 text-left text-[#444654]">۸۰٪</span>
                    </div>
                    {/* 4 Stars */}
                    <div className="flex items-center gap-2 ui-text-meta">
                      <span className="w-8 flex gap-1 items-center font-bold text-[#1A1B23]">۴ <Star className="w-3.5 h-3.5 text-[#F59E0B] fill-[#F59E0B]" /></span>
                      <div className="flex-1 h-1.5 bg-[#eeedf8] rounded-full overflow-hidden">
                        <div className="h-full bg-[#1333c1] rounded-full w-[15%]"></div>
                      </div>
                      <span className="w-8 text-left text-[#444654]">۱۵٪</span>
                    </div>
                    {/* 3 Stars */}
                    <div className="flex items-center gap-2 ui-text-meta">
                      <span className="w-8 flex gap-1 items-center font-bold text-[#1A1B23]">۳ <Star className="w-3.5 h-3.5 text-[#F59E0B] fill-[#F59E0B]" /></span>
                      <div className="flex-1 h-1.5 bg-[#eeedf8] rounded-full overflow-hidden">
                        <div className="h-full bg-[#1333c1] rounded-full w-[5%]"></div>
                      </div>
                      <span className="w-8 text-left text-[#444654]">۵٪</span>
                    </div>
                    {/* 2 Stars */}
                    <div className="flex items-center gap-2 ui-text-meta">
                      <span className="w-8 flex gap-1 items-center font-bold text-[#1A1B23]">۲ <Star className="w-3.5 h-3.5 text-slate-300" /></span>
                      <div className="flex-1 h-1.5 bg-[#eeedf8] rounded-full overflow-hidden">
                        <div className="h-full bg-[#eeedf8] rounded-full w-[0%]"></div>
                      </div>
                      <span className="w-8 text-left text-[#444654]">۰٪</span>
                    </div>
                    {/* 1 Star */}
                    <div className="flex items-center gap-2 ui-text-meta">
                      <span className="w-8 flex gap-1 items-center font-bold text-[#1A1B23]">۱ <Star className="w-3.5 h-3.5 text-slate-300" /></span>
                      <div className="flex-1 h-1.5 bg-[#eeedf8] rounded-full overflow-hidden">
                        <div className="h-full bg-[#eeedf8] rounded-full w-[0%]"></div>
                      </div>
                      <span className="w-8 text-left text-[#444654]">۰٪</span>
                    </div>
                  </div>
                </div>

                {/* Individual Reviews */}
                <div className="md:col-span-8 flex flex-col gap-4">
                  {commentsList.length > 0 ? (
                    commentsList.map(comment => {
                      const userReaction = userReactions[comment.id];
                      const initial = comment.author.charAt(0);

                      return (
                        <div key={comment.id} className="flex flex-col gap-2 pb-4 border-b border-[#E3E1ED] last:border-0">
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-[#1333c1]/10 flex items-center justify-center text-[#1333c1] ui-text-card-title">
                                {initial}
                              </div>
                              <div className="flex flex-col">
                                <span className="ui-text-card-title text-[#1A1B23]">{comment.author}</span>
                                <span className="ui-text-meta text-[#444654]">{comment.date}</span>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <div className="flex text-[#F59E0B]">
                                {[1, 2, 3, 4, 5].map(st => (
                                  <Star key={st} className={`w-3.5 h-3.5 ${st <= comment.rating ? 'fill-[#F59E0B] text-[#F59E0B]' : 'text-slate-200'}`} />
                                ))}
                              </div>
                              {comment.is_buyer && (
                                <span className="flex items-center gap-1 px-1.5 py-0.5 bg-[#1333c1]/10 text-[#1333c1] rounded ui-text-badge font-medium">
                                  <Check className="w-3 h-3" />
                                  خرید تأیید شده
                                </span>
                              )}
                            </div>
                          </div>
                          
                          {comment.title && (
                            <h4 className="ui-text-label font-semibold text-[#1A1B23] mt-1">{comment.title}</h4>
                          )}
                          <p className="text-[#444654] leading-relaxed mt-1 ui-text-body">
                            {comment.content}
                          </p>

                          {/* Pros & Cons */}
                          {((comment.pros && comment.pros.length > 0) || (comment.cons && comment.cons.length > 0)) && (
                            <div className="pt-2 flex flex-wrap gap-2 ui-text-meta">
                              {comment.pros?.map((p, i) => (
                                <span key={`pro-${p}-${i}`} className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 ui-text-badge font-medium">
                                  + {p}
                                </span>
                              ))}
                              {comment.cons?.map((c, i) => (
                                <span key={`con-${c}-${i}`} className="px-2 py-0.5 rounded-md bg-red-50 text-red-700 ui-text-badge font-medium">
                                  - {c}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Reaction voting */}
                          <div className="flex items-center justify-end gap-3 ui-text-meta text-slate-500 pt-1">
                            <span className="ui-text-meta">مفید بود؟</span>
                            <button
                              onClick={() => handleReaction(comment.id, 'like')}
                              className={`flex items-center gap-1 px-2 py-0.5 rounded border text-xs transition ${
                                userReaction === 'like' ? 'border-[#1333c1] bg-[#1333c1]/10 text-[#1333c1]' : 'border-[#E3E1ED] hover:bg-slate-50'
                              }`}
                            >
                              <ThumbsUp className="w-3 h-3" />
                              <span>{comment.likes || 0}</span>
                            </button>
                            <button
                              onClick={() => handleReaction(comment.id, 'dislike')}
                              className={`flex items-center gap-1 px-2 py-0.5 rounded border text-xs transition ${
                                userReaction === 'dislike' ? 'border-red-600 bg-red-50 text-red-700' : 'border-[#E3E1ED] hover:bg-slate-50'
                              }`}
                            >
                              <ThumbsDown className="w-3 h-3" />
                              <span>{comment.dislikes || 0}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-8 text-slate-400 text-xs">
                      هنوز دیدگاهی ثبت نشده است. اولین نفری باشید که تجربه خود را ثبت می‌کند!
                    </div>
                  )}
                </div>

              </div>
            </div>

          </div>

        </main>
      </div>

      {/* Shared Copied Share Link Toast */}
      {copiedToast && (
        <div className="fixed bottom-24 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1A1B23] text-white text-xs px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>لینک محصول با موفقیت کپی شد!</span>
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
              <h3 className="text-sm font-bold text-[#1A1B23]">ثبت نظر برای {product.name}</h3>
              <button onClick={() => setShowReviewModal(false)}>
                <X className="w-4 h-4 text-slate-400 hover:text-slate-600" />
              </button>
            </div>

            {reviewSuccess ? (
              <div className="p-6 text-center space-y-2">
                <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
                <h4 className="font-bold text-sm text-[#1A1B23]">دیدگاه شما با موفقیت ثبت شد!</h4>
                <p className="text-xs text-slate-500">از اینکه تجربه خود را به اشتراک گذاشتید سپاسگزاریم.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmitReview} className="space-y-3.5 text-xs">
                
                <div>
                  <label className="font-bold text-[#1A1B23] block mb-1">امتیاز شما به این محصول:</label>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button
                        type="button"
                        key={star}
                        onClick={() => setNewRating(star)}
                        className="p-1 hover:scale-110 transition"
                      >
                        <Star 
                          className={`w-6 h-6 ${star <= newRating ? 'fill-[#F59E0B] text-[#F59E0B]' : 'text-slate-200'}`} 
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="font-bold text-[#1A1B23] block mb-1">نام و نام خانوادگی:</label>
                  <input
                    type="text"
                    required
                    value={newAuthor}
                    onChange={(e) => setNewAuthor(e.target.value)}
                    placeholder="مثال: علی محمدی"
                    className="w-full p-2.5 bg-[#F8F9FC] border border-[#E6E8F0] rounded-xl focus:outline-none focus:border-[#364fd9]"
                  />
                </div>

                <div>
                  <label className="font-bold text-[#1A1B23] block mb-1">عنوان نظر (اختیاری):</label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="خلاصه نظر شما..."
                    className="w-full p-2.5 bg-[#F8F9FC] border border-[#E6E8F0] rounded-xl focus:outline-none focus:border-[#364fd9]"
                  />
                </div>

                <div>
                  <label className="font-bold text-[#1A1B23] block mb-1">متن دیدگاه شما:</label>
                  <textarea
                    required
                    rows={3}
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    placeholder="سرعت، کیفیت ساخت، پایداری و تجربه استفاده..."
                    className="w-full p-2.5 bg-[#F8F9FC] border border-[#E6E8F0] rounded-xl focus:outline-none focus:border-[#364fd9]"
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
                      className="w-full p-2 bg-[#F8F9FC] border border-[#E6E8F0] rounded-xl focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-red-700 block mb-1">نقاط ضعف (با کاما جدا کنید):</label>
                    <input
                      type="text"
                      value={newCons}
                      onChange={(e) => setNewCons(e.target.value)}
                      placeholder="قیمت, وزن دستگاه"
                      className="w-full p-2 bg-[#F8F9FC] border border-[#E6E8F0] rounded-xl focus:outline-none"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowReviewModal(false)}
                    className="px-4 py-2.5 rounded-xl border border-[#E6E8F0] text-slate-600 font-bold"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-[#364fd9] hover:bg-[#364fd9]/90 text-white font-bold shadow-md shadow-[#364fd9]/20 cursor-pointer"
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
