import React, { useState } from 'react';
import { ShoppingBag, ArrowLeft, ChevronUp, ChevronDown, Trash2 } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const MobileFloatingCart: React.FC = () => {
  const { cart, cartSummary, activeView, setActiveView, updateCartQuantity, removeFromCart } = useApp();
  const [isExpanded, setIsExpanded] = useState(false);

  // Do not show on cart, checkout or payment-status pages or if cart is empty
  if (
    cartSummary.item_count === 0 || 
    activeView === 'cart' || 
    activeView === 'checkout' || 
    activeView === 'payment-status' ||
    activeView === 'auth' ||
    activeView === 'product-detail'
  ) {
    return null;
  }

  return (
    <aside 
      aria-label="سبد خرید سریع"
      className="fixed bottom-[68px] left-3 right-3 z-30 lg:hidden pointer-events-auto"
    >
      <div className="bg-slate-900 text-white rounded-2xl shadow-xl shadow-slate-900/30 border border-slate-800/80 overflow-hidden transition-all duration-300">
        
        {/* Expanded Items Mini Drawer */}
        {isExpanded && (
          <div className="p-3 border-b border-slate-800 max-h-48 overflow-y-auto space-y-2 bg-slate-950/80">
            <div className="flex items-center justify-between text-xs text-slate-400 pb-1 border-b border-slate-800/60">
              <span className="font-bold">اقلام سبد خرید ({cartSummary.item_count} کالا)</span>
              <button 
                onClick={() => setIsExpanded(false)}
                className="text-[11px] text-blue-400 hover:underline"
              >
                بستن
              </button>
            </div>

            {cart.map((item) => (
              <div key={item.id} className="flex items-center justify-between text-xs py-1 gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {item.image_url && (
                    <img 
                      src={item.image_url} 
                      alt={item.product_name} 
                      className="w-7 h-7 rounded-lg object-contain bg-white/10 p-0.5 shrink-0"
                      onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = '/images/product-placeholder.svg'; }}
                    />
                  )}
                  <span className="truncate text-slate-200">{item.product_name}</span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-bold text-amber-400 font-sans">
                    {((item.unit_price || 0) * (item.quantity || 1)).toLocaleString('fa-IR')}
                  </span>
                  
                  {/* Quick Quantity Control */}
                  <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700">
                    <button
                      onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                      className="w-5 h-5 flex items-center justify-center text-slate-300 hover:text-white"
                    >
                      +
                    </button>
                    <span className="w-5 text-center text-[10px] font-bold">{item.quantity}</span>
                    <button
                      onClick={() => {
                        if (item.quantity === 1) {
                          removeFromCart(item.id);
                        } else {
                          updateCartQuantity(item.id, item.quantity - 1);
                        }
                      }}
                      className="w-5 h-5 flex items-center justify-center text-slate-300 hover:text-red-400"
                    >
                      −
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Main Bar */}
        <div className="p-2.5 sm:p-3 flex items-center justify-between gap-3">
          
          {/* Right: Cart icon, count, and total */}
          <div 
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0"
          >
            <div className="relative w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shrink-0">
              <ShoppingBag className="w-4 h-4" />
              <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-white text-[10px] font-extrabold flex items-center justify-center">
                {cartSummary.item_count}
              </span>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-slate-400 font-normal">مبلغ قابل پرداخت:</span>
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                ) : (
                  <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                )}
              </div>
              <div className="text-xs sm:text-sm font-black text-amber-300 font-sans truncate">
                {(cartSummary?.grand_total || 0).toLocaleString('fa-IR')} <span className="text-[10px] font-normal text-slate-400">{cartSummary?.currency || 'تومان'}</span>
              </div>
            </div>
          </div>

          {/* Left: Proceed CTA Button */}
          <button
            onClick={() => setActiveView('cart')}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-bold transition flex items-center gap-1.5 shrink-0 shadow-md shadow-blue-600/30"
          >
            <span>تکمیل خرید</span>
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>

        </div>

      </div>
    </aside>
  );
};
