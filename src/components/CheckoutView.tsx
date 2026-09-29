import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ShieldCheck, CheckCircle2, ArrowRight, CreditCard, Truck, AlertTriangle, ExternalLink } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { SESSION_STATE_KEYS, clearSessionState, readSessionState, writeSessionState } from '../utils/sessionState';
import { formatMoney } from '../utils/money';

export const CheckoutView: React.FC = () => {
  const { cartSummary, clearCart, setActiveView, user, checkoutConfiguration, appliedCoupon } = useApp();

  const availableGateways = useMemo(() => {
    const list = checkoutConfiguration.gateways || checkoutConfiguration.payment?.gateways || [];
    return list.filter((gateway) => gateway.enabled);
  }, [checkoutConfiguration.gateways, checkoutConfiguration.payment?.gateways]);

  const fallbackDraft = {
    addressForm: {
      recipient_name: user?.name || '',
      phone: user?.phone || '',
      province: '',
      city: '',
      postal_code: '',
      address_line: '',
    },
    paymentGateway: availableGateways[0]?.id || '',
    notes: '',
  };
  const initialDraft = readSessionState(SESSION_STATE_KEYS.legacyCheckoutDraft, fallbackDraft);

  const [addressForm, setAddressForm] = useState(initialDraft.addressForm);
  const [paymentGateway, setPaymentGateway] = useState<string>(() => {
    if (initialDraft.paymentGateway && availableGateways.some((g) => g.id === initialDraft.paymentGateway)) {
      return initialDraft.paymentGateway;
    }
    return availableGateways[0]?.id || '';
  });
  const [notes, setNotes] = useState(initialDraft.notes);
  const [isProcessing, setIsProcessing] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<any>(null);
  const idempotencyKeyRef = useRef<string>(crypto.randomUUID());

  // Synchronize selection if gateway list updates
  useEffect(() => {
    if (availableGateways.length > 0 && !availableGateways.some((g) => g.id === paymentGateway)) {
      setPaymentGateway(availableGateways[0].id);
    }
  }, [availableGateways, paymentGateway]);

  useEffect(() => {
    if (completedOrder) return;

    writeSessionState(SESSION_STATE_KEYS.legacyCheckoutDraft, {
      addressForm,
      paymentGateway,
      notes,
    });
  }, [addressForm, completedOrder, notes, paymentGateway]);

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentGateway || availableGateways.length === 0) {
      alert('در حال حاضر درگاه پرداخت فعالی برای تکمیل سفارش در دسترس نیست.');
      return;
    }

    setIsProcessing(true);

    try {
      const res = await api.checkout({
        shipping_address: addressForm,
        payment_gateway: paymentGateway,
        shipping_method: checkoutConfiguration.shipping.methods.find((method) => method.enabled)?.id ?? checkoutConfiguration.shipping.default_method_id,
        idempotency_key: idempotencyKeyRef.current,
        notes,
        coupon_code: appliedCoupon?.code,
      });

      // If backend issued an online redirect URL, redirect the client
      const paymentUrl = res.payment_intent?.payment_url;
      if (res.payment_intent?.action === 'redirect' && paymentUrl) {
        clearSessionState(SESSION_STATE_KEYS.legacyCheckoutDraft);
        clearCart();
        window.location.assign(paymentUrl);
        return;
      }

      setCompletedOrder(res);
      clearSessionState(SESSION_STATE_KEYS.legacyCheckoutDraft);
      clearCart();
    } catch (err: any) {
      alert('خطا در ثبت سفارش: ' + (err.message || 'مشکلی پیش آمد'));
    } finally {
      setIsProcessing(false);
    }
  };

  const selectedGatewayObj = availableGateways.find((g) => g.id === paymentGateway);

  if (completedOrder) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-6 animate-in fade-in">
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-md">
          <CheckCircle2 className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl sm:text-2xl font-black text-slate-900">سفارش شما ثبت شد و در انتظار پرداخت است</h1>
          <p className="text-xs sm:text-sm text-slate-500">
            پس از تأیید پرداخت توسط درگاه، وضعیت سفارش به‌روزرسانی و جزئیات ارسال اطلاع‌رسانی می‌شود.
          </p>
        </div>

        <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 text-right space-y-3 text-xs">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
            <span className="text-slate-500">شماره سفارش:</span>
            <span className="font-mono font-bold text-slate-900 text-sm">{completedOrder.order_number}</span>
          </div>
          <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
            <span className="text-slate-500">مبلغ سفارش:</span>
            <span className="font-bold text-blue-700 text-sm font-sans">{formatMoney(completedOrder.grand_total, completedOrder.currency)}</span>
          </div>
          <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
            <span className="text-slate-500">روش پرداخت:</span>
            <span className="font-semibold text-slate-800">
              {completedOrder.payment_intent?.gateway
                ? (availableGateways.find((g) => g.id === completedOrder.payment_intent.gateway)?.display_label || completedOrder.payment_intent.gateway)
                : 'درگاه انتخاب‌شده'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">تحویل گیرنده:</span>
            <span className="font-semibold text-slate-800">{addressForm.recipient_name}</span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-3 pt-4">
          <button
            onClick={() => setActiveView('home')}
            className="px-6 py-3 bg-blue-600 text-white rounded-2xl text-xs sm:text-sm font-bold shadow-md hover:bg-blue-700 transition"
          >
            بازگشت به صفحه اصلی
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl sm:text-2xl font-black text-slate-900">نهایی‌سازی و پرداخت سفارش</h1>
        <button
          onClick={() => setActiveView('cart')}
          className="text-xs font-semibold text-slate-600 hover:text-blue-600 flex items-center gap-1"
        >
          <ArrowRight className="w-4 h-4" />
          <span>بازگشت به سبد</span>
        </button>
      </div>

      <form onSubmit={handlePlaceOrder} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Shipping & Payment Form (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Shipping Address Box */}
          <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
              <Truck className="w-4 h-4 text-blue-600" />
              <span>مشخصات و نشانی گیرنده</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">نام و نام خانوادگی تحویل‌گیرنده</label>
                <input
                  type="text"
                  required
                  value={addressForm.recipient_name}
                  onChange={(e) => setAddressForm({ ...addressForm, recipient_name: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">شماره همراه</label>
                <input
                  type="tel"
                  required
                  value={addressForm.phone}
                  onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-sans"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">استان</label>
                <input
                  type="text"
                  required
                  value={addressForm.province}
                  onChange={(e) => setAddressForm({ ...addressForm, province: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">شهر</label>
                <input
                  type="text"
                  required
                  value={addressForm.city}
                  onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="sm:col-span-2 space-y-1">
                <label className="text-xs font-medium text-slate-700">کد پستی ده‌رقمی</label>
                <input
                  type="text"
                  required
                  value={addressForm.postal_code}
                  onChange={(e) => setAddressForm({ ...addressForm, postal_code: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div className="sm:col-span-2 space-y-1">
                <label className="text-xs font-medium text-slate-700">آدرس پستی دقیق</label>
                <textarea
                  rows={2}
                  required
                  value={addressForm.address_line}
                  onChange={(e) => setAddressForm({ ...addressForm, address_line: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Payment Gateway Selection */}
          <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <CreditCard className="w-4 h-4 text-blue-600" />
                <span>انتخاب روش و درگاه پرداخت</span>
              </div>
              <span className="text-[11px] text-slate-400">درگاه‌های تاییدشده و امن</span>
            </div>

            {availableGateways.length === 0 ? (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs">
                  <p className="font-bold">هیچ درگاه پرداختی در حال حاضر فعال نمی‌باشد.</p>
                  <p className="text-amber-700 leading-relaxed">
                    لطفاً با پشتیبانی سیستم تماس حاصل نمایید یا از طریق بخش مدیریت درگاه‌های پرداخت را پیکربندی نمایید.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {availableGateways.map((gateway) => {
                  const isSelected = paymentGateway === gateway.id;
                  return (
                    <label
                      key={gateway.id}
                      onClick={() => setPaymentGateway(gateway.id)}
                      className={`relative p-4 rounded-2xl border cursor-pointer transition flex flex-col justify-between gap-3 text-right ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-100 shadow-sm'
                          : 'border-slate-200 bg-slate-50 hover:bg-slate-100/70'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                            <span>{gateway.title || gateway.name}</span>
                            {gateway.is_test && (
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 font-bold">
                                شبیه‌ساز تستی (Staging)
                              </span>
                            )}
                            {!gateway.is_test && gateway.environment === 'sandbox' && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 border border-sky-200">
                                آزمایشی (سندباکس)
                              </span>
                            )}
                            {!gateway.is_test && gateway.environment === 'production' && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                                شاپرک مستقیم
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                            {gateway.description || gateway.display_label}
                          </p>
                        </div>
                        <div
                          className={`w-4 h-4 rounded-full border shrink-0 flex items-center justify-center mt-0.5 ${
                            isSelected ? 'border-blue-600 bg-blue-600' : 'border-slate-300 bg-white'
                          }`}
                        >
                          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                      </div>

                      {gateway.capabilities && gateway.capabilities.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap pt-1 border-t border-slate-200/60">
                          {gateway.capabilities.map((cap) => (
                            <span key={cap} className="text-[9px] px-1.5 py-0.5 rounded bg-white text-slate-600 border border-slate-200">
                              {cap === 'cards_shetab'
                                ? 'کارت‌های عضو شتاب'
                                : cap === 'instant_settlement'
                                ? 'تسویه آنی'
                                : cap === 'zero_gateway_fee'
                                ? 'بدون کارمزد'
                                : cap === 'offline_verification'
                                ? 'واریز آفلاین'
                                : cap === 'simulator_only'
                                ? 'محیط توسعه'
                                : cap}
                            </span>
                          ))}
                        </div>
                      )}
                    </label>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* Order Review & Pay CTA (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900">مجموع پرداختی</h3>

            <div className="space-y-2 text-xs text-slate-600 border-b border-slate-100 pb-4">
              <div className="flex justify-between">
                <span>تعداد اقلام:</span>
                <span className="font-bold">{cartSummary?.item_count || 0} عدد</span>
              </div>
              <div className="flex justify-between">
                <span>هزینه کالاها:</span>
                <span className="font-bold font-sans">{formatMoney(cartSummary?.subtotal, cartSummary?.currency)}</span>
              </div>
              <div className="flex justify-between">
                <span>هزینه حمل و نقل:</span>
                <span className="font-bold font-sans">{cartSummary?.shipping_total === 0 ? 'رایگان' : formatMoney(cartSummary?.shipping_total, cartSummary?.currency)}</span>
              </div>
              <div className="flex justify-between">
                <span>مالیات:</span>
                <span className="font-bold font-sans">{formatMoney(cartSummary?.tax, cartSummary?.currency)}</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">مبلغ قابل پرداخت:</span>
              <span className="text-lg font-black text-blue-700 font-sans">{formatMoney(cartSummary?.grand_total, cartSummary?.currency)}</span>
            </div>

            <button
              type="submit"
              disabled={isProcessing || availableGateways.length === 0 || !paymentGateway}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-bold rounded-2xl shadow-lg shadow-emerald-600/30 transition flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>
                {isProcessing
                  ? 'در حال اتصال به درگاه...'
                  : availableGateways.length === 0
                  ? 'درگاه پرداختی در دسترس نیست'
                  : 'پرداخت و ثبت نهایی سفارش'}
              </span>
            </button>
          </div>
        </div>

      </form>

    </div>
  );
};
