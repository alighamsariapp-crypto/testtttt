import React, { useMemo } from 'react';
import { Heart, ShoppingCart, Star, Plus, Minus, ArrowLeft } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Product } from '../types';
import { getDefaultSellableVariant, isProductPurchasable } from '../utils/productAvailability';
import { getStorefrontProducts } from '../utils/catalogQuality';

export const PopularProducts: React.FC = () => {
  const { 
    products, 
    cart,
    addToCart, 
    updateCartQuantity,
    removeFromCart,
    toggleFavorite, 
    isFavorite, 
    navigateToProduct, 
    setActiveView 
  } = useApp();

  const featuredProducts = useMemo(
    () => getStorefrontProducts(products).filter((product) => product.is_featured || product.is_bestseller).concat(
      getStorefrontProducts(products).filter((product) => !product.is_featured && !product.is_bestseller),
    ).slice(0, 4),
    [products],
  );

  const handleProductClick = (slug: string) => {
    navigateToProduct(slug);
  };

  if (featuredProducts.length === 0) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 relative">
      
      {/* Section Header */}
      <div className="flex items-center justify-between mb-4 sm:mb-5">
        <div>
          <h2 className="ui-text-section-title text-slate-900 tracking-tight">
            محبوب‌ترین محصولات نوین‌نت
          </h2>
          <p className="ui-text-meta text-slate-400 mt-0.5 hidden sm:block">
            انتخاب‌های برتر کاربران با بالاترین امتیاز و رضایت خریداران
          </p>
        </div>

        <button
          id="view-all-popular-btn"
          onClick={() => setActiveView('store')}
          className="ui-text-button text-blue-600 hover:text-blue-700 flex items-center gap-1 hover:gap-1.5 transition-all"
        >
          <span>مشاهده همه محصولات</span>
          <ArrowLeft className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Product Cards Grid: 4-col desktop, 2-col mobile */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
        {featuredProducts.map((product) => {
          const favorite = isFavorite(product.id);
          const quickVariant = getDefaultSellableVariant(product);
          const canPurchase = isProductPurchasable(product);
          const requiresConfigurationSelection = Boolean(product.variant_options?.length);
          const cartItem = cart?.find((item) => item.product_variant_id === quickVariant?.id);
          
          return (
            <div
              key={product.id}
              className="bg-white rounded-3xl border border-slate-100 shadow-xs hover:shadow-md hover:border-slate-200 transition-all flex flex-col justify-between overflow-hidden group"
            >
              {/* Card Image and Top Badges */}
              <div className="relative p-3 bg-slate-50/50 aspect-square flex items-center justify-center overflow-hidden">
                
                {/* Badge Tag */}
                <div className="absolute top-3 right-3 z-10">
                  {product.is_smart ? (
                    <span className="ui-text-badge px-2.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                      هوشمند
                    </span>
                  ) : product.is_bestseller ? (
                    <span className="ui-text-badge px-2.5 py-0.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
                      پرفروش
                    </span>
                  ) : product.discount_percentage ? (
                    <span className="ui-text-badge px-2.5 py-0.5 rounded-lg bg-red-50 text-red-700 border border-red-200">
                      {product.discount_percentage}٪ تخفیف
                    </span>
                  ) : (
                    <span className={`ui-text-badge px-2.5 py-0.5 rounded-lg border ${canPurchase ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                      {canPurchase ? 'موجود' : 'ناموجود'}
                    </span>
                  )}
                </div>

                {/* Wishlist Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavorite(product.id);
                  }}
                  className={`absolute top-3 left-3 z-10 w-8 h-8 rounded-full flex items-center justify-center transition ${
                    favorite ? 'bg-red-50 text-red-500' : 'bg-white/90 text-slate-400 hover:text-red-500 shadow-xs'
                  }`}
                  aria-label="علاقه‌مندی"
                >
                  <Heart className={`w-4 h-4 ${favorite ? 'fill-red-500 text-red-500' : ''}`} />
                </button>

                {/* Product Image */}
                <img
                  src={product.image_url}
                  alt={product.name}
                  onClick={() => handleProductClick(product.slug)}
                  className="w-full h-full object-contain mix-blend-multiply group-hover:scale-105 transition-transform duration-300 cursor-pointer p-2"
                  onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = '/images/product-placeholder.svg'; }}
                />
              </div>

              {/* Card Body */}
              <div className="p-3 sm:p-4 flex-1 flex flex-col justify-between space-y-3">
                <div>
                  {/* Category & Rating */}
                  <div className="ui-text-meta flex items-center justify-between text-slate-400 mb-1">
                    <span className="font-medium truncate">{product.category_name}</span>
                    <div className="flex items-center gap-1 text-amber-500 font-bold shrink-0">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      <span>{product.rating || '4.8'}</span>
                    </div>
                  </div>

                  {/* Title */}
                  <h3
                    onClick={() => handleProductClick(product.slug)}
                    className="ui-text-card-title text-slate-800 line-clamp-2 hover:text-blue-600 transition cursor-pointer"
                  >
                    {product.name}
                  </h3>
                </div>

                {/* Bottom Row: Price & Quantity Switcher (Point 10) */}
                <div className="pt-2.5 border-t border-slate-100 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
                  <div className="min-w-0">
                    <div className="ui-price text-slate-900 whitespace-nowrap">
                      {product.effective_price?.toLocaleString('fa-IR')}
                    </div>
                    <div className="ui-text-meta text-slate-400 whitespace-nowrap">{product.currency}</div>
                  </div>

                  {/* If in cart -> Interactive Switcher, else -> Add to Cart Button */}
                  {canPurchase && !requiresConfigurationSelection && cartItem ? (
                    <div className="flex shrink-0 items-center bg-blue-50 border border-blue-200 rounded-xl p-0.5 shadow-2xs">
                      <button
                        onClick={() => {
                          updateCartQuantity(cartItem.id, cartItem.quantity + 1);
                        }}
                        className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 transition active:scale-90"
                        aria-label="افزایش"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>

                      <span className="ui-text-button ui-numeric w-6 text-center text-blue-900">
                        {cartItem.quantity}
                      </span>

                      <button
                        onClick={() => {
                          if (cartItem.quantity === 1) {
                            removeFromCart(cartItem.id);
                          } else {
                            updateCartQuantity(cartItem.id, cartItem.quantity - 1);
                          }
                        }}
                        className="w-7 h-7 rounded-lg bg-white text-slate-700 flex items-center justify-center hover:bg-slate-100 transition active:scale-90 border border-slate-200"
                        aria-label="کاهش"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : canPurchase && !requiresConfigurationSelection ? (
                    <button
                      id={`add-to-cart-${product.id}`}
                      onClick={() => {
                        addToCart(product, 1);
                      }}
                      className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-md shadow-blue-500/20 hover:scale-105 active:scale-95 transition shrink-0"
                      aria-label="افزودن به سبد خرید"
                    >
                      <ShoppingCart className="w-4 h-4" />
                    </button>
                  ) : canPurchase && requiresConfigurationSelection ? (
                    <button
                      onClick={() => handleProductClick(product.slug)}
                      className="rounded-xl bg-blue-600 px-3 py-1.5 ui-text-badge text-white shadow-md shadow-blue-500/20"
                    >
                      انتخاب
                    </button>
                  ) : (
                    <span className="rounded-xl bg-slate-100 px-2 py-1.5 ui-text-badge text-slate-400">ناموجود</span>
                  )}
                </div>

              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
};
