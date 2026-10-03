import React, { useState } from 'react';
import { 
  Heart, 
  Trash2, 
  ShoppingBag, 
  Plus, 
  Bell, 
  Check, 
  SlidersHorizontal, 
  ArrowUpDown,
  ExternalLink,
  Tag
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Product } from '../../types';

export const WishlistTab: React.FC = () => {
  const { favorites, toggleFavorite, products, addToCart, navigateToProduct, setActiveView, showToast } = useApp();
  const [sortBy, setSortBy] = useState<'newest' | 'price-asc' | 'price-desc'>('newest');
  const [notifiedItems, setNotifiedItems] = useState<number[]>([]);

  // Get favorite products
  const favoriteProducts = products.filter(p => favorites.includes(p.id));

  // Sort
  const sortedProducts = [...favoriteProducts].sort((a, b) => {
    const priceA = a.effective_price || a.base_price;
    const priceB = b.effective_price || b.base_price;
    if (sortBy === 'price-asc') return priceA - priceB;
    if (sortBy === 'price-desc') return priceB - priceA;
    return b.id - a.id;
  });

  const handleNotifyMe = (productId: number, productName: string) => {
    if (notifiedItems.includes(productId)) {
      setNotifiedItems(prev => prev.filter(id => id !== productId));
      showToast(`اطلاع‌رسانی موجودی برای «${productName}» لغو شد.`, 'info');
    } else {
      setNotifiedItems(prev => [...prev, productId]);
      showToast(`به محض موجود شدن «${productName}» از طریق پیامک به شما اطلاع می‌دهیم.`, 'success');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-black text-slate-900">علاقه‌مندی‌های من</h1>
            <span className="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-600 text-xs font-bold font-sans">
              {favorites.length} کالا
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">محصولاتی که ذخیره کرده‌اید تا بعداً بررسی یا خریداری کنید</p>
        </div>

        {/* Sort Controls */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span>مرتب‌سازی:</span>
          </span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-600 cursor-pointer"
          >
            <option value="newest">جدیدترین</option>
            <option value="price-asc">ارزان‌ترین</option>
            <option value="price-desc">گران‌ترین</option>
          </select>
        </div>
      </div>

      {/* Grid */}
      {sortedProducts.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 space-y-4">
          <div className="w-20 h-20 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mx-auto">
            <Heart className="w-10 h-10 stroke-[1.5]" />
          </div>
          <h3 className="text-base font-bold text-slate-800">لیست علاقه‌مندی‌های شما خالی است</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
            کالاهای مورد علاقه خود را با کلیک بر روی آیکون قلب به این بخش اضافه کنید تا در هر زمان به آن‌ها دسترسی داشته باشید.
          </p>
          <button
            onClick={() => setActiveView('store')}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-bold transition shadow-sm shadow-blue-500/20 inline-flex items-center gap-2"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>مشاهده فروشگاه نوین‌نت</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {sortedProducts.map((product) => {
            const isNotified = notifiedItems.includes(product.id);
            const inStock = product.in_stock !== false;
            const price = product.effective_price || product.base_price;
            const hasDiscount = product.discount_percentage && product.discount_percentage > 0;

            return (
              <div 
                key={product.id}
                className="bg-white rounded-3xl p-4 border border-slate-100 shadow-sm hover:shadow-md transition duration-200 flex flex-col justify-between group relative overflow-hidden"
              >
                {/* Top Image & Trash Button */}
                <div className="relative aspect-square rounded-2xl bg-slate-50 overflow-hidden mb-3.5 flex items-center justify-center p-4">
                  {product.image_url ? (
                    <img 
                      src={product.image_url} 
                      alt={product.name} 
                      className="w-full h-full object-contain group-hover:scale-105 transition duration-300"
                      onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = '/images/product-placeholder.svg'; }}
                    />
                  ) : (
                    <ShoppingBag className="w-12 h-12 text-slate-300" />
                  )}

                  {/* Remove Wishlist Button */}
                  <button
                    onClick={() => toggleFavorite(product.id)}
                    className="absolute top-2.5 left-2.5 p-2 rounded-xl bg-white/90 backdrop-blur-sm text-slate-400 hover:text-rose-600 hover:bg-white shadow-sm transition"
                    title="حذف از علاقه‌مندی‌ها"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  {/* Discount Badge */}
                  {hasDiscount && (
                    <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-lg bg-rose-600 text-white text-[10px] font-black font-sans">
                      {product.discount_percentage}٪ تخفیف
                    </span>
                  )}

                  {/* Stock Status Badge */}
                  {!inStock && (
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px] flex items-center justify-center">
                      <span className="px-3 py-1 rounded-xl bg-slate-900/90 text-white text-xs font-bold">
                        ناموجود
                      </span>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="space-y-2 flex-1 flex flex-col justify-between">
                  <div className="space-y-1">
                    {product.brand && (
                      <span className="text-[10px] font-bold text-blue-600">{product.brand}</span>
                    )}
                    <h3 
                      onClick={() => navigateToProduct(product.slug)}
                      className="text-xs font-bold text-slate-900 line-clamp-2 hover:text-blue-600 cursor-pointer transition leading-snug"
                    >
                      {product.name}
                    </h3>
                  </div>

                  {/* Price */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      {hasDiscount && (
                        <span className="text-[11px] text-slate-400 line-through block font-sans">
                          {(product.base_price ?? 0).toLocaleString('fa-IR')}
                        </span>
                      )}
                      <div className="font-black text-sm text-slate-900 font-sans">
                        {(price ?? 0).toLocaleString('fa-IR')} <span className="text-[10px] font-normal text-slate-500">تومان</span>
                      </div>
                    </div>

                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      inStock ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {inStock ? 'موجود' : 'ناموجود'}
                    </span>
                  </div>

                  {/* Action Button */}
                  <div className="pt-2">
                    {inStock ? (
                      <button
                        onClick={() => addToCart(product)}
                        className="w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm shadow-blue-500/10"
                      >
                        <Plus className="w-4 h-4" />
                        <span>افزودن به سبد خرید</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleNotifyMe(product.id, product.name)}
                        className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                          isNotified 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        {isNotified ? (
                          <>
                            <Check className="w-4 h-4 text-emerald-600" />
                            <span>به شما اطلاع می‌دهیم</span>
                          </>
                        ) : (
                          <>
                            <Bell className="w-4 h-4 text-slate-500" />
                            <span>خبرم کن موجود شد</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
