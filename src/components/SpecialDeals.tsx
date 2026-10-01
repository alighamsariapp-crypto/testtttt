import React, { useState, useEffect, useMemo } from 'react';
import { Timer, ArrowLeft, Zap, ShoppingCart, Plus, Minus } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getStorefrontProducts } from '../utils/catalogQuality';
import { getDefaultSellableVariant, isProductPurchasable } from '../utils/productAvailability';

export const SpecialDeals: React.FC = () => {
  const { products, cart, addToCart, updateCartQuantity, removeFromCart, navigateToProduct, setSelectedCategorySlug, setActiveView } = useApp();

  // Countdown timer simulation
  const [timeLeft, setTimeLeft] = useState({ hours: 14, minutes: 35, seconds: 12 });
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev.seconds > 0) {
          return { ...prev, seconds: prev.seconds - 1 };
        } else if (prev.minutes > 0) {
          return { ...prev, minutes: 59, seconds: 59 };
        } else if (prev.hours > 0) {
          return { hours: prev.hours - 1, minutes: 59, seconds: 59 };
        }
        return { hours: 24, minutes: 0, seconds: 0 };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const dealProducts = useMemo(
    () => getStorefrontProducts(products)
      .filter((product) => product.discount_percentage || product.base_price > (product.effective_price ?? product.base_price))
      .slice(0, 2),
    [products],
  );
  if (dealProducts.length === 0) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 relative">
      
      {/* Container with soft blue tint */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-950 to-slate-900 rounded-3xl p-5 sm:p-8 text-white shadow-xl relative overflow-hidden">
        
        {/* Decorative background glow */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-white/10">
          
          {/* Header & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-red-500/20 text-red-400 border border-red-500/30 flex items-center justify-center">
              <Zap className="w-5 h-5 fill-red-400" />
            </div>
            <div>
              <h2 className="ui-text-section-title tracking-tight">پیشنهادهای شگفت‌انگیز نوین‌نت</h2>
              <p className="ui-text-meta text-blue-200 mt-0.5">تخفیف‌های استثنایی با مهلت محدود</p>
            </div>
          </div>

          {/* Countdown Clock & View All Button (Point 17) */}
          <div className="flex items-center justify-between sm:justify-end gap-4">
            
            {/* Clock */}
            <div className="flex items-center gap-2">
              <Timer className="w-4 h-4 text-amber-400" />
              <div className="ui-text-button ui-numeric flex items-center gap-1 font-semibold">
                <span className="w-7 h-7 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center text-amber-300">
                  {String(timeLeft.hours).padStart(2, '0')}
                </span>
                <span>:</span>
                <span className="w-7 h-7 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center text-amber-300">
                  {String(timeLeft.minutes).padStart(2, '0')}
                </span>
                <span>:</span>
                <span className="w-7 h-7 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center text-amber-300">
                  {String(timeLeft.seconds).padStart(2, '0')}
                </span>
              </div>
            </div>

            {/* View All Deals Button (Point 17) */}
            <button
              id="view-all-deals-btn"
              onClick={() => {
                setSelectedCategorySlug(null);
                setActiveView('store');
              }}
              className="ui-text-button px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white transition flex items-center gap-1.5 shrink-0"
            >
              <span>مشاهده همه تخفیف‌ها</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>

          </div>

        </div>

        {/* Deals Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
          {dealProducts.map(product => {
            const quickVariant = getDefaultSellableVariant(product);
            const canPurchase = isProductPurchasable(product);
            const requiresConfigurationSelection = Boolean(product.variant_options?.length);
            const cartItem = cart?.find((item) => item.product_variant_id === quickVariant?.id);

            return (
              <div
                key={product.id}
                className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-4 flex gap-4 items-center hover:bg-white/15 transition group"
              >
                <img
                  src={product.image_url}
                  alt={product.name}
                  onClick={() => {
                    navigateToProduct(product.slug);
                  }}
                  className="w-22 h-22 sm:w-26 sm:h-26 rounded-2xl object-contain bg-white/95 p-2 shrink-0 cursor-pointer group-hover:scale-105 transition"
                  onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = '/images/product-placeholder.svg'; }}
                />
                
                <div className="flex-1 flex flex-col justify-between h-full space-y-2 min-w-0">
                  <div>
                    <span className="ui-text-badge px-2.5 py-0.5 rounded-md bg-red-600 text-white">
                      {product.discount_percentage || 20}٪ تخفیف
                    </span>
                    <h3
                      onClick={() => {
                        navigateToProduct(product.slug);
                      }}
                      className="ui-text-card-title text-white truncate mt-1.5 cursor-pointer hover:text-blue-300 transition"
                    >
                      {product.name}
                    </h3>
                    <p className="ui-text-meta text-blue-200 line-clamp-1 mt-0.5">{product.description}</p>
                  </div>

                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2 pt-1 border-t border-white/10">
                    <div className="min-w-0">
                      <div className="ui-price whitespace-nowrap text-amber-300">
                        {product.effective_price?.toLocaleString('fa-IR')} <span className="ui-text-meta font-normal text-slate-300">{product.currency}</span>
                      </div>
                      {product.base_price > (product.effective_price || 0) && (
                        <div className="ui-text-meta text-slate-400 line-through ui-numeric">
                          {(product.base_price || 0).toLocaleString('fa-IR')}
                        </div>
                      )}
                    </div>

                    {/* Quantity Switcher in Card (Point 10) */}
                    {canPurchase && !requiresConfigurationSelection && cartItem ? (
                      <div className="flex shrink-0 items-center bg-white/20 backdrop-blur-md rounded-xl p-0.5 border border-white/20">
                        <button
                          onClick={() => {
                            updateCartQuantity(cartItem.id, cartItem.quantity + 1);
                          }}
                          className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center hover:bg-blue-500 transition active:scale-90"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        <span className="ui-text-button ui-numeric w-6 text-center text-white">
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
                          className="w-7 h-7 rounded-lg bg-white/20 text-white flex items-center justify-center hover:bg-white/30 transition active:scale-90"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : canPurchase && !requiresConfigurationSelection ? (
                      <button
                        onClick={() => {
                          addToCart(product, 1);
                        }}
                        className="p-2 rounded-xl bg-white text-blue-900 hover:bg-blue-50 transition shadow-md active:scale-95 shrink-0"
                        aria-label="افزودن به سبد"
                      >
                        <ShoppingCart className="w-4 h-4" />
                      </button>
                    ) : canPurchase && requiresConfigurationSelection ? (
                      <button
                        onClick={() => navigateToProduct(product.slug)}
                        className="rounded-xl bg-white px-3 py-1.5 ui-text-badge text-blue-900 shadow-md"
                      >
                        انتخاب
                      </button>
                    ) : (
                      <span className="rounded-xl bg-white/10 px-2 py-1.5 ui-text-badge text-slate-300">ناموجود</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

      </div>

    </div>
  );
};
