import React, { useEffect, useMemo, useRef, useState } from 'react';
import { 
  CreditCard, 
  Wallet, 
  Tag, 
  Check, 
  X, 
  ArrowLeft, 
  ShieldCheck, 
  MapPin, 
  CheckCircle2, 
  ExternalLink,
  Sparkles,
  Lock,
  Truck,
  Landmark
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { CartStepper } from './CartStepper';

export const CartStep3Payment: React.FC = () => {
  const {
    cart,
    cartSummary,
    addresses,
    selectedAddressId,
    appliedCoupon,
    applyCoupon,
    removeCoupon,
    paymentMethod,
    setPaymentMethod,
    setCheckoutStep,
    clearCart,
    setActiveView,
    triggerPaymentStatus,
    user,
    showToast,
    checkoutConfiguration,
  } = useApp();

  const [couponInput, setCouponInput] = useState('');
  const [couponFeedback, setCouponFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const checkoutAttemptKeyRef = useRef<string>(crypto.randomUUID());
  const enabledShippingMethods = useMemo(() => checkoutConfiguration.shipping.methods.filter((method) => method.enabled), [checkoutConfiguration.shipping.methods]);
  const enabledPaymentMethods = useMemo(() => [
    ...(checkoutConfiguration.payment.online_enabled ? ['online' as const] : []),
    ...(checkoutConfiguration.payment.wallet_enabled ? ['wallet' as const] : []),
    ...(checkoutConfiguration.payment.bank_transfer_enabled ? ['bank_transfer' as const] : []),
  ], [checkoutConfiguration.payment]);
  const [shippingMethodId, setShippingMethodId] = useState(checkoutConfiguration.shipping.default_method_id);
  const selectedShippingMethod = enabledShippingMethods.find((method) => method.id === shippingMethodId) ?? enabledShippingMethods[0];
  const shippingCost = selectedShippingMethod && (selectedShippingMethod.free_shipping_threshold > 0 && cartSummary.subtotal >= selectedShippingMethod.free_shipping_threshold)
    ? 0
    : (selectedShippingMethod?.base_cost ?? 0);
  const estimatedGrandTotal = cartSummary.grand_total + shippingCost;
  const checkoutIntentSignature = JSON.stringify({
    items: cartSummary.items.map((item) => [item.variant_id, item.quantity]),
    address: selectedAddressId,
    shipping: shippingMethodId,
    payment: paymentMethod,
    coupon: appliedCoupon?.code ?? null,
  });
  const previousIntentSignatureRef = useRef(checkoutIntentSignature);

  useEffect(() => {
    if (previousIntentSignatureRef.current !== checkoutIntentSignature) {
      checkoutAttemptKeyRef.current = crypto.randomUUID();
      previousIntentSignatureRef.current = checkoutIntentSignature;
    }
    if (enabledShippingMethods.length > 0 && !enabledShippingMethods.some((method) => method.id === shippingMethodId)) {
      setShippingMethodId(enabledShippingMethods.find((method) => method.id === checkoutConfiguration.shipping.default_method_id)?.id ?? enabledShippingMethods[0].id);
    }
    if (enabledPaymentMethods.length > 0 && !enabledPaymentMethods.includes(paymentMethod)) {
      setPaymentMethod(enabledPaymentMethods.includes(checkoutConfiguration.payment.default_method) ? checkoutConfiguration.payment.default_method : enabledPaymentMethods[0]);
    }
  }, [checkoutConfiguration.payment.default_method, checkoutConfiguration.shipping.default_method_id, checkoutIntentSignature, enabledPaymentMethods, enabledShippingMethods, paymentMethod, setPaymentMethod, shippingMethodId]);

  const selectedAddress = addresses?.find((address) => address.id === selectedAddressId);

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponInput.trim()) return;

    const res = await Promise.resolve(applyCoupon(couponInput));
    if (res.success) {
      setCouponFeedback({ type: 'success', message: res.message });
      setCouponInput('');
    } else {
      setCouponFeedback({ type: 'error', message: res.message });
    }
  };

  const handlePayment = async () => {
    if (!selectedAddress) {
      const message = 'برای ثبت سفارش، ابتدا یک آدرس تحویل انتخاب یا ثبت کنید.';
      setCouponFeedback({ type: 'error', message });
      showToast(message, 'error');
      return;
    }
    if (enabledPaymentMethods.length === 0 || !enabledPaymentMethods.includes(paymentMethod)) {
      const message = 'در حال حاضر هیچ روش پرداخت فعالی برای سفارش وجود ندارد.';
      setCouponFeedback({ type: 'error', message });
      showToast(message, 'error');
      return;
    }
    if (!selectedShippingMethod) {
      const message = 'در حال حاضر هیچ روش ارسال فعالی برای سفارش وجود ندارد.';
      setCouponFeedback({ type: 'error', message });
      showToast(message, 'error');
      return;
    }
    if (cartSummary.item_count <= 0) {
      const message = 'سبد خرید شما خالی است. ابتدا حداقل یک کالا اضافه کنید.';
      setCouponFeedback({ type: 'error', message });
      showToast(message, 'error');
      return;
    }

    setIsProcessing(true);
    try {
      const result = await api.checkout({
        shipping_address: {
          recipient_name: selectedAddress.recipient_name,
          phone: selectedAddress.phone,
          province: selectedAddress.province,
          city: selectedAddress.city,
          postal_code: selectedAddress.postal_code,
          address_line: selectedAddress.address_line,
        },
        // Wallet is completed atomically; online payments redirect to Zibal for server-verified completion.
        payment_gateway: paymentMethod === 'wallet' ? 'wallet' : paymentMethod === 'bank_transfer' ? 'bank_transfer' : 'zibal',
        shipping_method: selectedShippingMethod.id,
        idempotency_key: checkoutAttemptKeyRef.current,
        coupon_code: appliedCoupon ? appliedCoupon.code : undefined,
      });

      const paymentUrl = typeof result.payment_intent?.payment_url === 'string' ? result.payment_intent.payment_url : '';
      if (paymentMethod === 'online' && paymentUrl) {
        clearCart();
        window.location.assign(paymentUrl);
        return;
      }

      const paid = result.payment_intent?.payment_status === 'paid';
      triggerPaymentStatus({
        status: paid ? 'success' : 'pending',
        orderNumber: result.order_number,
        amount: result.grand_total,
        currency: result.currency,
        paymentMethod: paymentMethod === 'wallet' ? 'کیف پول نوین‌نت' : paymentMethod === 'bank_transfer' ? 'واریز به حساب در انتظار تأیید' : 'پرداخت اینترنتی زیبال',
        instructions: typeof result.payment_intent?.instructions === 'string' ? result.payment_intent.instructions : undefined,
        date: new Date().toLocaleDateString('fa-IR') + ' ساعت ' + new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
      });
      clearCart();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ثبت سفارش با خطا مواجه شد.';
      setCouponFeedback({ type: 'error', message });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-28 sm:pb-6 space-y-6">
      
      {/* Breadcrumbs */}
      <div className="ui-text-meta hidden sm:flex items-center gap-2 text-slate-400">
        <button onClick={() => setActiveView('home')} className="hover:text-blue-600">خانه</button>
        <span>/</span>
        <button onClick={() => setCheckoutStep(1)} className="hover:text-blue-600">سبد خرید</button>
        <span>/</span>
        <button onClick={() => setCheckoutStep(2)} className="hover:text-blue-600">اطلاعات ارسال</button>
        <span>/</span>
        <span className="text-slate-700 font-medium">انتخاب روش پرداخت و بازبینی فاکتور</span>
      </div>

      {/* Stepper Bar at Top */}
      <div className="border-b border-slate-100 pb-4">
        <CartStepper currentStep={3} onStepClick={(step) => {
          if (step === 3 && !selectedAddressId) {
            showToast('برای ورود به مرحلهٔ پرداخت، ابتدا آدرس تحویل را انتخاب کنید.', 'error');
            setCheckoutStep(2);
            return;
          }
          setCheckoutStep(step);
        }} />
      </div>
      <h1 id="checkout-step-heading" tabIndex={-1} className="sr-only outline-none">بازبینی و پرداخت سفارش</h1>

      {/* Main Grid: Payment Options (8 cols) & 6-Point Summary Factor (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        
        {/* Left/Right Main Column: Selected Address, Payment Methods, Coupon Code (8 cols) */}
        <div className="lg:col-span-8 space-y-5">
          
          {/* 1. Selected Address Quick-Bar */}
          {selectedAddress ? (
            <div className="bg-white rounded-3xl border border-slate-100 p-4 sm:p-5 shadow-xs flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <MapPin className="w-5 h-5" />
                </div>
                <div className="space-y-0.5">
                  <div className="ui-text-button text-slate-900 flex items-center gap-2">
                    <span>ارسال به: {selectedAddress.recipient_name}</span>
                    <span className="ui-text-meta text-slate-400 font-sans">({selectedAddress.phone})</span>
                  </div>
                  <div className="ui-text-meta text-slate-500 line-clamp-1">
                    {selectedAddress.province}، {selectedAddress.city}، {selectedAddress.address_line}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setCheckoutStep(2)}
                className="ui-text-button text-blue-600 hover:text-blue-700 px-3 py-1.5 rounded-xl hover:bg-blue-50 transition shrink-0"
              >
                تغییر آدرس
              </button>
            </div>
          ) : (
            <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex items-center justify-between gap-3">
              <div>
                <p className="ui-text-card-title text-amber-900">آدرس تحویل انتخاب نشده است</p>
                <p className="ui-text-meta text-amber-800 mt-1">برای فعال شدن پرداخت، ابتدا آدرس تحویل را ثبت یا انتخاب کنید.</p>
              </div>
              <button type="button" onClick={() => setCheckoutStep(2)} className="min-h-11 px-3 rounded-xl bg-white text-amber-800 border border-amber-200 text-xs font-bold shrink-0">انتخاب آدرس</button>
            </div>
          )}

          <div className="bg-white rounded-3xl border border-slate-100 p-4 sm:p-6 shadow-xs space-y-4">
            <h2 className="ui-text-section-title text-slate-900 flex items-center gap-2"><Truck className="w-4 h-4 text-blue-600" /><span>انتخاب روش ارسال</span></h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {enabledShippingMethods.map((method) => {
                const cost = method.free_shipping_threshold > 0 && cartSummary.subtotal >= method.free_shipping_threshold ? 0 : method.base_cost;
                const selected = selectedShippingMethod?.id === method.id;
                return <button key={method.id} type="button" onClick={() => setShippingMethodId(method.id)} className={`p-4 rounded-2xl border-2 transition text-right ${selected ? 'border-blue-600 bg-blue-50/40 ring-2 ring-blue-600/20' : 'border-slate-200 hover:border-slate-300 bg-white'}`}>
                  <div className="flex items-center justify-between gap-3"><div><div className="ui-text-card-title text-slate-900">{method.title}</div><div className="ui-text-meta text-slate-400 mt-1">{method.description}</div></div>{selected && <div className="w-5 h-5 shrink-0 rounded-full bg-blue-600 text-white flex items-center justify-center"><Check className="w-3 h-3" /></div>}</div>
                  <div className="mt-3 ui-text-meta text-slate-600">{cost === 0 ? 'ارسال رایگان' : `${Math.floor(cost / 10).toLocaleString('fa-IR')} تومان`}{method.free_shipping_threshold > 0 && <span className="mr-1 text-slate-400">· رایگان از {Math.floor(method.free_shipping_threshold / 10).toLocaleString('fa-IR')} تومان</span>}</div>
                </button>;
              })}
            </div>
            {enabledShippingMethods.length === 0 && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700">در حال حاضر هیچ روش ارسالی از پنل مدیریت فعال نشده است.</p>}
          </div>

          {/* 2. Choose Payment Method (Point 6.5) */}
          <div className="bg-white rounded-3xl border border-slate-100 p-4 sm:p-6 shadow-xs space-y-4">
            <h2 className="ui-text-section-title text-slate-900 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-blue-600" />
              <span>انتخاب روش پرداخت</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {checkoutConfiguration.payment.online_enabled && (
                <button
                  type="button"
                  onClick={() => setPaymentMethod('online')}
                  className={`p-4 rounded-2xl border-2 transition cursor-pointer flex text-right flex-col justify-between space-y-3 ${
                    paymentMethod === 'online' ? 'border-blue-600 bg-blue-50/40 ring-2 ring-blue-600/20' : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                        <CreditCard className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="ui-text-card-title text-slate-900">
                          {checkoutConfiguration.gateways?.find((g) => g.id === 'zibal')?.title || 'درگاه پرداخت اینترنتی زیبال'}
                        </div>
                        <div className="ui-text-meta text-slate-400">
                          پرداخت امن آنلاین از طریق کلیه کارت‌های عضو شتاب
                        </div>
                      </div>
                    </div>
                    {paymentMethod === 'online' && (
                      <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center">
                        <Check className="w-3 h-3" />
                      </div>
                    )}
                  </div>
                  <div className="ui-text-meta text-blue-700 bg-white/80 p-2 rounded-xl border border-blue-100">
                    {checkoutConfiguration.gateways?.find((g) => g.id === 'zibal')?.display_label || 'درگاه پرداخت اینترنتی زیبال (کارت‌های بانکی عضو شتاب)'}
                  </div>
                </button>
              )}
              {checkoutConfiguration.payment.wallet_enabled && <button type="button" onClick={() => setPaymentMethod('wallet')} className={`p-4 rounded-2xl border-2 transition cursor-pointer flex text-right flex-col justify-between space-y-3 ${paymentMethod === 'wallet' ? 'border-blue-600 bg-blue-50/40 ring-2 ring-blue-600/20' : 'border-slate-200 hover:border-slate-300 bg-white'}`}>
                <div className="flex items-center justify-between"><div className="flex items-center gap-2.5"><div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center"><Wallet className="w-4 h-4" /></div><div><div className="ui-text-card-title text-slate-900">کیف پول کاربری</div><div className="ui-text-meta text-slate-400">موجودی: {(user?.wallet_balance || 0).toLocaleString('fa-IR')} تومان</div></div></div>{paymentMethod === 'wallet' && <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center"><Check className="w-3 h-3" /></div>}</div>
                <div className="ui-text-meta text-emerald-700 bg-white/80 p-2 rounded-xl border border-emerald-100">کسر آنی از اعتبار قابل استفاده</div>
              </button>}
              {checkoutConfiguration.payment.bank_transfer_enabled && <button type="button" onClick={() => setPaymentMethod('bank_transfer')} className={`p-4 rounded-2xl border-2 transition cursor-pointer flex text-right flex-col justify-between space-y-3 ${paymentMethod === 'bank_transfer' ? 'border-blue-600 bg-blue-50/40 ring-2 ring-blue-600/20' : 'border-slate-200 hover:border-slate-300 bg-white'}`}>
                <div className="flex items-center justify-between"><div className="flex items-center gap-2.5"><div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center"><Landmark className="w-4 h-4" /></div><div><div className="ui-text-card-title text-slate-900">واریز به حساب</div><div className="ui-text-meta text-slate-400">ثبت و پیگیری دستی پرداخت</div></div></div>{paymentMethod === 'bank_transfer' && <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center"><Check className="w-3 h-3" /></div>}</div>
                <div className="ui-text-meta text-amber-800 bg-amber-50 p-2 rounded-xl border border-amber-100">{checkoutConfiguration.payment.bank_account_name || 'دستورالعمل واریز پس از ثبت سفارش نمایش داده می‌شود'}</div>
              </button>}
            </div>
            {enabledPaymentMethods.length === 0 && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700">در حال حاضر هیچ روش پرداختی از پنل مدیریت فعال نشده است.</p>}
          </div>

          {/* 3. Coupon Code Entry (Point 6.2) */}
          <div className="bg-white rounded-3xl border border-slate-100 p-4 sm:p-6 shadow-xs space-y-4">
            <h2 className="ui-text-section-title text-slate-900 flex items-center gap-2">
              <Tag className="w-4 h-4 text-amber-500" />
              <span>کد تخفیف</span>
            </h2>

            {appliedCoupon ? (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <div>
                    <div className="ui-text-card-title text-emerald-900">
                      کد تخفیف <span className="font-semibold ui-numeric">{appliedCoupon.code}</span> اعمال شد
                    </div>
                    <div className="ui-text-meta text-emerald-700 mt-0.5">
                      مبلغ {(appliedCoupon?.discount_amount || 0).toLocaleString('fa-IR')} تومان از فاکتور کسر گردید.
                    </div>
                  </div>
                </div>
                <button
                  onClick={removeCoupon}
                  className="p-1.5 rounded-xl text-red-500 hover:bg-red-100/50 transition ui-text-label font-semibold flex items-center gap-1"
                >
                  <X className="w-4 h-4" />
                  <span>حذف</span>
                </button>
              </div>
            ) : (
              <form onSubmit={handleApplyCoupon} className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value)}
                    placeholder="کد تخفیف را وارد کنید (مثال: NOOVIN10)"
                    className="flex-1 px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 ui-text-body focus:bg-white focus:border-blue-500 focus:outline-hidden transition"
                  />
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl ui-text-label font-semibold transition active:scale-95 shrink-0 shadow-xs"
                  >
                    اعمال کد
                  </button>
                </div>
                {couponFeedback && (
                  <div className={`ui-text-meta p-2 rounded-xl font-medium ${
                    couponFeedback.type === 'success' ? 'text-emerald-700 bg-emerald-50' : 'text-red-600 bg-red-50'
                  }`}>
                    {couponFeedback.message}
                  </div>
                )}
              </form>
            )}
          </div>

        </div>

        {/* Right/Left 6-Point Clear Order Factor Card (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-3xl border border-slate-100 p-6 shadow-xs space-y-5 sticky top-24">
          <h2 className="ui-text-section-title text-slate-900 pb-3 border-b border-slate-100 flex items-center justify-between">
            <span>صورت‌حساب نهایی</span>
            <span className="ui-text-badge font-semibold text-blue-600">{cartSummary.item_count} قلم کالا</span>
          </h2>

          <div className="space-y-3.5 ui-text-meta">
            
            {/* 1. مبلغ سفارش */}
            <div className="flex items-center justify-between text-slate-600">
              <span>۱. مبلغ سفارش (کالاها):</span>
              <span className="ui-price text-slate-800 font-medium">
                {cartSummary.subtotal.toLocaleString('fa-IR')} {cartSummary.currency}
              </span>
            </div>

            {/* 2. تخفیف محصولات */}
            {cartSummary.discount_total > 0 && (
              <div className="flex items-center justify-between text-emerald-600">
                <span>۲. تخفیف محصولات:</span>
                <span className="ui-price text-emerald-600 font-medium">
                  -{cartSummary.discount_total.toLocaleString('fa-IR')} {cartSummary.currency}
                </span>
              </div>
            )}

            {/* 3. تخفیف کوپن */}
            {cartSummary.coupon_discount > 0 && (
              <div className="flex items-center justify-between text-emerald-600 font-medium">
                <span>۳. تخفیف کد تبلیغاتی:</span>
                <span className="ui-price text-emerald-600 font-medium">
                  -{cartSummary.coupon_discount.toLocaleString('fa-IR')} {cartSummary.currency}
                </span>
              </div>
            )}

            {/* هزینه ارسال */}
            <div className="flex items-center justify-between text-slate-600">
              <span>هزینه حمل و نقل:</span>
              <span className="ui-price text-slate-800 font-medium">
                {shippingCost === 0 ? 'رایگان' : `${shippingCost.toLocaleString('fa-IR')} ${cartSummary.currency}`}
              </span>
            </div>

            {/* 4. مبلغ نهایی */}
            <div className="pt-3 border-t-2 border-slate-100 flex items-center justify-between">
              <span className="ui-text-body font-bold text-slate-900">۴. مبلغ نهایی قابل پرداخت:</span>
              <div className="ui-price-hero text-blue-700 text-lg sm:text-xl">
                {estimatedGrandTotal.toLocaleString('fa-IR')}{' '}
                <span className="ui-text-meta font-normal text-slate-600">{cartSummary.currency}</span>
              </div>
            </div>

          </div>

          {/* 6. CTA مرحله بعد (پرداخت و ثبت نهایی) */}
          <button
            id="checkout-pay-btn"
            onClick={handlePayment}
            disabled={isProcessing}
            className={`w-full min-h-12 py-3 active:scale-98 text-white rounded-2xl ui-text-body font-semibold shadow-lg transition flex items-center justify-center gap-2 ${selectedAddress ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30' : 'bg-slate-700 hover:bg-slate-800 shadow-slate-900/15'}`}
          >
            {isProcessing ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>در حال انتقال به درگاه بانکی...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4" />
                <span>پرداخت و ثبت سفارش</span>
              </div>
            )}
          </button>

          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center gap-2 ui-text-meta text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>پرداخت از طریق درگاه امن شاپرک با پروتکل رمزنگاری SSL</span>
          </div>

        </div>

      </div>

      {/* MOBILE FLOATING PAYMENT BAR */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 px-4 py-3 sm:hidden shadow-2xl flex items-center justify-between gap-3 safe-area-bottom">
        <div className="flex flex-col">
          <span className="ui-text-meta text-slate-500 font-medium">مبلغ نهایی فاکتور</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="ui-price-hero text-emerald-700 text-lg">
              {estimatedGrandTotal.toLocaleString('fa-IR')}
            </span>
            <span className="ui-text-meta font-medium text-slate-600">{cartSummary.currency}</span>
          </div>
        </div>

        <button
          id="mobile-checkout-pay-btn"
          onClick={handlePayment}
          disabled={isProcessing}
          className={`min-h-11 px-4 py-2.5 active:scale-95 text-white rounded-2xl ui-text-body font-semibold flex items-center gap-2 shadow-lg transition shrink-0 ${selectedAddress ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30' : 'bg-slate-700 hover:bg-slate-800 shadow-slate-900/15'}`}
        >
          {isProcessing ? (
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>در حال اتصال...</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4" />
              <span>پرداخت آنلاین</span>
            </div>
          )}
        </button>
      </div>

    </div>
  );
};
