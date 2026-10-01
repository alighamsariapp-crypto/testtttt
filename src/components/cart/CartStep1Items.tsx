import React from 'react';
import { ShoppingCart, ShoppingBag, Trash2, Plus, Minus, ArrowLeft, ArrowRight, ShieldCheck, Tag } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { CartStepper } from './CartStepper';
import { formatMoney } from '../../utils/money';

export const CartStep1Items: React.FC = () => {
  const { 
    cart, 
    cartSummary, 
    updateCartQuantity, 
    removeFromCart, 
    setCheckoutStep, 
    setActiveView,
    user,
    setAuthModalOpen,
    showToast,
  } = useApp();

  const requestCheckoutLogin = () => {
    if (user) {
      setCheckoutStep(2);
      return;
    }

    showToast('برای ثبت آدرس و ادامهٔ خرید، ابتدا وارد حساب کاربری شوید.', 'info');
    setAuthModalOpen(true);
  };

  const handleStepClick = (step: 1 | 2 | 3) => {
    if (!user && step > 1) {
      requestCheckoutLogin();
      return;
    }
    setCheckoutStep(step);
  };

  // If cart is empty
  if (cart.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Breadcrumbs */}
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <button onClick={() => setActiveView('home')} className="hover:text-blue-600">خانه</button>
          <span>/</span>
          <span className="text-slate-700 font-medium">سبد خرید</span>
        </div>

        {/* Empty State Card */}
        <div className="bg-white rounded-3xl border border-slate-100 p-10 sm:p-16 text-center shadow-xs max-w-2xl mx-auto my-6 space-y-6">
          <div className="w-20 h-20 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center mx-auto border border-slate-100">
            <ShoppingCart className="w-8 h-8 stroke-[1.5]" />
          </div>

          <div className="space-y-2">
            <h2 className="ui-text-section-title text-slate-900">سبد خرید شما در حال حاضر خالی است</h2>
            <p className="ui-text-body text-slate-500">
              می‌توانید برای مشاهده محصولات و افزودن آن‌ها به فروشگاه مراجعه کنید.
            </p>
          </div>

          <div>
            <button
              onClick={() => setActiveView('store')}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl ui-text-body font-semibold shadow-lg shadow-blue-600/30 transition hover:scale-102 active:scale-98"
            >
              مشاهده محصولات فروشگاه
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-28 sm:pb-6 space-y-6">
      
      {/* Breadcrumbs */}
      <div className="hidden sm:flex items-center gap-2 ui-text-meta text-slate-400">
        <button onClick={() => setActiveView('home')} className="hover:text-blue-600">خانه</button>
        <span>/</span>
        <span className="text-slate-700 font-medium">سبد خرید</span>
      </div>

      {/* Stepper Bar at Top */}
      <div className="border-b border-slate-100 pb-4">
        <CartStepper currentStep={1} onStepClick={handleStepClick} />
      </div>

      {/* Header with item count badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 id="checkout-step-heading" tabIndex={-1} className="ui-text-page-title text-slate-900 outline-none">سبد خرید شما</h1>
          <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 ui-text-badge font-semibold">
            {cartSummary.item_count} کالا
          </span>
        </div>

        <button
          onClick={() => setActiveView('store')}
          className="ui-text-meta font-semibold text-blue-600 hover:text-blue-700 hidden sm:flex items-center gap-1"
        >
          <span>ادامه خرید در فروشگاه</span>
          <ArrowLeft className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Main Grid: Cart Items (8 cols) & Order Summary (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        
        {/* Cart Items List */}
        <div className="lg:col-span-8 space-y-3">
          {cart.map((item) => {
            const isAtStockLimit = item.available_stock !== undefined && item.quantity >= item.available_stock;

            return (
            <div
              key={item.id}
              className="bg-white rounded-3xl border border-slate-100 p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-slate-200 transition"
            >
              {/* Right: Item details & image */}
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-2xl bg-slate-50 border border-slate-100 p-2 shrink-0 flex items-center justify-center overflow-hidden">
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.product_name}
                      className="w-full h-full object-contain mix-blend-multiply"
                      onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = '/images/product-placeholder.svg'; }}
                    />
                  ) : (
                    <ShoppingBag className="w-7 h-7 text-blue-500" aria-label="تصویر محصول موجود نیست" />
                  )}
                </div>
                
                <div className="space-y-1 min-w-0 flex-1">
                  <h3 className="ui-text-card-title text-slate-900 line-clamp-1">
                    {item.product_name}
                  </h3>
                  {item.variant_name && item.variant_name !== 'استاندارد' && (
                    <div className="ui-text-meta text-slate-500">
                      مدل: {item.variant_name}
                    </div>
                  )}
                  <div className="ui-price text-slate-900">
                    {formatMoney(item.unit_price, item.currency)}
                  </div>
                </div>
              </div>

              {/* Left: Modern Safe Quantity & Delete Controller (Point 4) */}
              <div className="flex items-center justify-between sm:justify-end gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                
                {/* Total price for this item on mobile */}
                <div className="sm:hidden ui-price text-blue-700">
                  جمع: {formatMoney(item.unit_price * item.quantity, item.currency)}
                </div>

                <div className="flex items-center gap-3">
                  
                  {/* Segmented Quantity Controller: + | Count | − */}
                  <div className="flex items-center border border-slate-200/90 rounded-2xl bg-slate-50/70 p-1 shadow-2xs">
                    {/* Plus Button */}
                    <button
                      onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                      disabled={isAtStockLimit}
                      className="w-8 h-8 rounded-xl bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-600 flex items-center justify-center transition border border-slate-200/50 active:scale-95 shadow-2xs disabled:bg-slate-100 disabled:text-slate-300 disabled:hover:bg-slate-100 disabled:hover:text-slate-300 disabled:cursor-not-allowed disabled:active:scale-100"
                      title={isAtStockLimit ? 'موجودی محصول تمام شده است' : 'افزایش تعداد'}
                      aria-label={isAtStockLimit ? 'موجودی محصول تمام شده است' : 'افزایش تعداد'}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>

                    {/* Quantity Display */}
                    <span className="w-9 text-center ui-numeric font-semibold text-slate-900 text-sm">
                      {item.quantity}
                    </span>

                    {/* At quantity 1, the decrement position becomes delete; otherwise it decrements. */}
                    <button
                      onClick={() => item.quantity === 1 ? removeFromCart(item.id) : updateCartQuantity(item.id, item.quantity - 1)}
                      className={`w-8 h-8 rounded-xl flex items-center justify-center transition border border-slate-200/50 active:scale-95 shadow-2xs ${
                        item.quantity === 1
                          ? 'bg-red-50 text-red-600 hover:bg-red-100 hover:border-red-200'
                          : 'bg-white hover:bg-slate-100 text-slate-700'
                      }`}
                      title={item.quantity === 1 ? 'حذف از سبد خرید' : 'کاهش تعداد'}
                      aria-label={item.quantity === 1 ? 'حذف محصول از سبد خرید' : 'کاهش تعداد'}
                    >
                      {item.quantity === 1 ? <Trash2 className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  {isAtStockLimit && (
                    <p className="ui-text-meta font-medium text-amber-700" role="status">
                      موجودی محصول تمام شده است
                    </p>
                  )}

                </div>

              </div>

            </div>
            );
          })}
        </div>

        {/* Order Summary Card (4 cols) */}
        <div className="relative lg:col-span-4 bg-white rounded-3xl border border-slate-100 p-6 pb-24 sm:pb-6 shadow-xs space-y-5 lg:sticky lg:top-24">
          <h2 className="ui-text-section-title text-slate-900 pb-3 border-b border-slate-100">
            خلاصه فاکتور خرید
          </h2>

          <div className="space-y-3 ui-text-meta">
            <div className="flex items-center justify-between text-slate-600">
              <span>قیمت کالاها ({cartSummary?.item_count || 0}):</span>
              <span className="ui-price text-slate-800 font-medium">
                {formatMoney(cartSummary?.subtotal, cartSummary?.currency)}
              </span>
            </div>

            {Boolean(cartSummary?.discount_total && cartSummary.discount_total > 0) && (
              <div className="flex items-center justify-between text-emerald-600">
                <span>تخفیف کل کالاها:</span>
                <span className="ui-price text-emerald-600 font-medium">
                  -{formatMoney(cartSummary?.discount_total, cartSummary?.currency)}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between text-slate-600">
              <span>هزینه بسته‌بندی و ارسال:</span>
              <span className="ui-price text-slate-800 font-medium">
                {cartSummary?.shipping_total === 0 ? 'رایگان' : formatMoney(cartSummary?.shipping_total, cartSummary?.currency)}
              </span>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="ui-text-body font-bold text-slate-900">مبلغ نهایی قابل پرداخت:</span>
              <span className="ui-price-hero text-blue-700 text-lg sm:text-xl">
                {formatMoney(cartSummary?.grand_total, cartSummary?.currency)}
              </span>
            </div>
          </div>

          <button
            id="cart-continue-checkout-btn"
            onClick={requestCheckoutLogin}
            className="absolute inset-x-6 bottom-5 min-h-12 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white rounded-2xl ui-text-body font-semibold shadow-lg shadow-blue-600/30 transition flex items-center justify-center gap-2 sm:static sm:w-full sm:min-h-0 sm:py-3.5"
          >
            <span>ثبت و ادامه خرید</span>
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="p-3 rounded-2xl bg-blue-50/60 border border-blue-100 flex items-center gap-2 ui-text-meta text-blue-800">
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
            <span>ضمانت اصالت کالا و ۷ روز مهلت تست و بازگشت</span>
          </div>

        </div>

      </div>


    </div>
  );
};
