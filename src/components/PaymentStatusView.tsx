import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  CheckCircle2, 
  AlertCircle, 
  XCircle, 
  AlertTriangle, 
  ShieldAlert, 
  MoreHorizontal, 
  Hourglass, 
  CreditCard, 
  Receipt, 
  RotateCw, 
  ArrowRight, 
  ShieldCheck, 
  Lock, 
  Shield, 
  Building2, 
  Info, 
  Truck, 
  PhoneCall, 
  ChevronDown, 
  ChevronUp,
  ExternalLink,
  Layers,
  Loader2
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PaymentStatusType } from '../types';
import { formatMoney } from '../utils/money';
import { api } from '../services/api';

const MAX_POLL_ATTEMPTS = 4;
const POLL_DELAYS = [2000, 3000, 5000, 8000];

export const PaymentStatusView: React.FC = () => {
  const { 
    paymentStatusData,
    setPaymentStatusData,
    setCheckoutStep,
    setActiveView,
  } = useApp();

  const [isTechDetailsOpen, setIsTechDetailsOpen] = useState(false);
  const [redirectProgress, setRedirectProgress] = useState(0);
  const [pollAttempt, setPollAttempt] = useState(0);
  const [isPolling, setIsPolling] = useState(false);
  const [pollingStopped, setPollingStopped] = useState(false);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  const currentStatus: PaymentStatusType = paymentStatusData.status || 'pending';

  // Handle redirecting simulation progress
  useEffect(() => {
    if (currentStatus === 'redirecting') {
      const interval = setInterval(() => {
        setRedirectProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            return 100;
          }
          return prev + 20;
        });
      }, 500);
      return () => clearInterval(interval);
    }
  }, [currentStatus]);

  // Clean up any pending polling timer on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
      }
    };
  }, []);

  // Server-side authoritative verification handler
  const verifyStatusWithBackend = useCallback(async (currentAttempt: number = 0) => {
    const orderNumber = paymentStatusData.orderNumber;
    let token = paymentStatusData.statusToken;

    if (!orderNumber) {
      setPaymentStatusData({
        ...paymentStatusData,
        isLoading: false,
      });
      return;
    }

    try {
      if (currentAttempt === 0) {
        setPaymentStatusData({
          ...paymentStatusData,
          isLoading: true,
        });
      }

      // If we have an exchange code but no token yet, exchange the code for a short-lived token
      if (!token && paymentStatusData.exchangeCode) {
        try {
          const exchangeRes = await api.exchangePaymentStatusToken(orderNumber, paymentStatusData.exchangeCode);
          if (exchangeRes && exchangeRes.success && exchangeRes.data?.token) {
            token = exchangeRes.data.token;
            setPaymentStatusData(prev => ({
              ...prev,
              statusToken: token,
              exchangeCode: undefined,
            }));
          }
        } catch (exchangeErr: any) {
          console.warn('Payment status exchange code exchange failed:', exchangeErr?.message);
        }
      }

      const res = await api.getPaymentStatus(orderNumber, token);
      if (res && res.success && res.data) {
        const rawStatus = res.data.status;
        const paymentStatus = res.data.payment_status;

        // Map backend verified status
        let mappedStatus: PaymentStatusType = 'pending';
        if (rawStatus === 'success' || paymentStatus === 'paid') {
          mappedStatus = 'success';
        } else if (rawStatus === 'failed' || paymentStatus === 'failed') {
          mappedStatus = 'failed';
        } else if (rawStatus === 'cancelled' || paymentStatus === 'cancelled') {
          mappedStatus = 'cancelled';
        } else if (rawStatus === 'unknown' || paymentStatus === 'unknown') {
          mappedStatus = 'unknown';
        } else {
          mappedStatus = 'pending';
        }

        const isFinal = mappedStatus === 'success' || mappedStatus === 'failed' || mappedStatus === 'cancelled';

        setPaymentStatusData({
          status: mappedStatus,
          orderNumber: res.data.order_number || orderNumber,
          amount: Number(res.data.amount) || 0,
          currency: res.data.currency || 'IRT',
          trackingCode: res.data.reference_id || res.data.track_id || paymentStatusData.trackingCode,
          paymentMethod: res.data.payment_method || (res.data.gateway === 'zibal' ? 'پرداخت اینترنتی زیبال' : res.data.gateway),
          orderStatus: res.data.order_status,
          errorCode: res.data.error_code,
          isVerified: true,
          isLoading: false,
          statusToken: token,
        });

        // Bounded polling for pending or unknown transactions
        if (!isFinal && (mappedStatus === 'pending' || mappedStatus === 'unknown')) {
          if (currentAttempt < MAX_POLL_ATTEMPTS) {
            setIsPolling(true);
            const nextDelay = POLL_DELAYS[currentAttempt] || 5000;
            setPollAttempt(currentAttempt + 1);
            pollTimerRef.current = setTimeout(() => {
              verifyStatusWithBackend(currentAttempt + 1);
            }, nextDelay);
          } else {
            setIsPolling(false);
            setPollingStopped(true);
          }
        } else {
          setIsPolling(false);
          setPollingStopped(true);
        }
      } else {
        // Response was not successful (e.g. 401 unauthorized / invalid token)
        setPaymentStatusData({
          ...paymentStatusData,
          status: 'unavailable',
          isVerified: false,
          isLoading: false,
          errorMessage: res?.message || 'دسترسی به اطلاعات این سفارش امکان‌پذیر نیست یا توکن نامعتبر است.',
          errorCode: 'UNAUTHORIZED_ACCESS',
        });
        setIsPolling(false);
        setPollingStopped(true);
      }
    } catch (err: any) {
      setPaymentStatusData({
        ...paymentStatusData,
        status: 'unavailable',
        isVerified: false,
        isLoading: false,
        errorMessage: err?.message || 'خطا در برقراری ارتباط با سرور برای بررسی وضعیت پرداخت.',
        errorCode: 'NETWORK_ERROR',
      });
      setIsPolling(false);
      setPollingStopped(true);
    }
  }, [paymentStatusData, setPaymentStatusData]);

  // Trigger authoritative verification when component mounts or order changes
  useEffect(() => {
    if (!paymentStatusData.isVerified && paymentStatusData.orderNumber) {
      verifyStatusWithBackend(0);
    }
  }, [paymentStatusData.isVerified, paymentStatusData.orderNumber, verifyStatusWithBackend]);

  const orderNumber = paymentStatusData?.orderNumber || '---';
  const trackingCode = paymentStatusData?.trackingCode || '---';

  return (
    <div className="min-h-[85vh] flex flex-col justify-between bg-slate-50/50 py-4 sm:py-8 px-4">
      
      {/* Main Container */}
      <div className="w-full max-w-xl mx-auto my-auto animate-in fade-in zoom-in-95 duration-200">
        
        {/* Loading / Verification in Progress State */}
        {paymentStatusData.isLoading && (
          <div className="bg-white rounded-3xl border border-slate-100 p-8 sm:p-12 text-center shadow-xs space-y-6">
            <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-blue-100 border-t-blue-600 animate-spin" />
              <div className="w-14 h-14 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                <Loader2 className="w-7 h-7 animate-spin" />
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900">
                در حال استعلام وضعیت پرداخت از سرور
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
                لطفاً شکیبا باشید. وضعیت تراکنش به صورت امن و مستقیم با درگاه بانکی در حال بررسی است...
              </p>
            </div>

            <div className="pt-2 text-xs text-slate-400 font-sans">
              شماره سفارش: <span className="font-bold text-slate-700">{orderNumber}</span>
            </div>
          </div>
        )}
        
        {/* ========================================================================= */}
        {/* 1. PAYMENT CANCELLED (پرداخت لغو شد - عکس-01 و عکس-02) */}
        {/* ========================================================================= */}
        {!paymentStatusData.isLoading && currentStatus === 'cancelled' && (
          <div className="bg-white rounded-3xl border border-slate-100 p-8 sm:p-12 text-center shadow-xs space-y-6">
            
            {/* Warning Triangle Icon */}
            <div className="w-20 h-20 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center mx-auto border border-amber-100">
              <AlertTriangle className="w-9 h-9 stroke-[1.75]" />
            </div>

            {/* Title & Description */}
            <div className="space-y-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900">
                پرداخت لغو شد
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
                فرآیند پرداخت توسط شما لغو شد یا به پایان نرسید.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row-reverse items-center justify-center gap-3 pt-2">
              <button
                onClick={() => {
                  setCheckoutStep(3);
                  setActiveView('cart');
                }}
                className="w-full sm:flex-1 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs sm:text-sm font-bold shadow-lg shadow-blue-600/30 transition hover:scale-101 flex items-center justify-center gap-2"
              >
                <CreditCard className="w-4 h-4" />
                <span>بازگشت به پرداخت</span>
              </button>

              <button
                onClick={() => {
                  setCheckoutStep(1);
                  setActiveView('cart');
                }}
                className="w-full sm:flex-1 py-3.5 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-2xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2"
              >
                <Receipt className="w-4 h-4 text-slate-400" />
                <span>بازگشت به سفارش</span>
              </button>
            </div>

            {/* Order Number footer */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-sans">
              <span>شماره سفارش:</span>
              <span className="font-bold text-slate-900">{orderNumber}</span>
            </div>

          </div>
        )}

        {/* ========================================================================= */}
        {/* 2. PAYMENT FAILED (پرداخت ناموفق بود - عکس-03 و عکس-04) */}
        {/* ========================================================================= */}
        {!paymentStatusData.isLoading && currentStatus === 'failed' && (
          <div className="bg-white rounded-3xl border border-slate-100 p-8 sm:p-12 text-center shadow-xs space-y-6">
            
            {/* Red Exclamation Alert Icon */}
            <div className="w-20 h-20 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mx-auto border border-rose-100">
              <AlertCircle className="w-10 h-10 stroke-[1.75]" />
            </div>

            {/* Title & Description */}
            <div className="space-y-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900">
                پرداخت ناموفق بود
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
                متأسفانه فرآیند پرداخت با خطا مواجه شد. مبلغی از حساب شما کسر نشده است.
              </p>
            </div>

            {/* Transaction Error Box */}
            <div className="bg-slate-50 rounded-2xl p-4 sm:p-5 text-right text-xs space-y-3 border border-slate-100">
              <div className="text-xs font-bold text-slate-700 pb-1 border-b border-slate-200 flex items-center justify-between">
                <span>جزئیات تراکنش</span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>شماره سفارش:</span>
                <span className="px-2 py-0.5 bg-slate-200/70 rounded-md font-bold text-slate-900 font-sans">
                  {orderNumber}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>دلیل خطا:</span>
                <span className="font-bold text-rose-600">
                  {paymentStatusData.errorMessage || 'خطای درگاه بانکی یا انصراف کاربر'}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2.5 pt-2">
              <button
                onClick={() => {
                  setCheckoutStep(3);
                  setActiveView('cart');
                }}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs sm:text-sm font-bold shadow-lg shadow-blue-600/30 transition hover:scale-101 flex items-center justify-center gap-2"
              >
                <RotateCw className="w-4 h-4" />
                <span>تلاش دوباره</span>
              </button>

              <button
                onClick={() => {
                  setCheckoutStep(1);
                  setActiveView('cart');
                }}
                className="w-full py-3 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-2xl text-xs sm:text-sm font-bold transition"
              >
                بازگشت به سبد خرید
              </button>
            </div>

          </div>
        )}

        {/* ========================================================================= */}
        {/* 3. REDIRECTING TO GATEWAY (در حال انتقال به درگاه بانکی - عکس-05 و عکس-06) */}
        {/* ========================================================================= */}
        {!paymentStatusData.isLoading && currentStatus === 'redirecting' && (
          <div className="bg-white rounded-3xl border border-slate-100 p-8 sm:p-12 text-center shadow-xs space-y-6">
            
            {/* Animated Gateway Loading Ring */}
            <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-blue-100 border-t-blue-600 animate-spin" />
              <div className="w-16 h-16 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                <Building2 className="w-8 h-8" />
              </div>
            </div>

            {/* Title & Description */}
            <div className="space-y-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900">
                در حال انتقال به درگاه بانکی
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
                لطفاً صبر کنید. در حال برقراری ارتباط ایمن با بانک هستیم...
              </p>
            </div>

            {/* Security Badges */}
            <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
              <div className="p-3 bg-blue-50/50 rounded-2xl border border-blue-100 flex items-center justify-center gap-2 text-xs font-bold text-blue-700">
                <Lock className="w-4 h-4 text-blue-600" />
                <span className="font-sans">SSL 256-bit</span>
              </div>
              <div className="p-3 bg-blue-50/50 rounded-2xl border border-blue-100 flex items-center justify-center gap-2 text-xs font-bold text-blue-700">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                <span>پرداخت امن</span>
              </div>
            </div>

            {/* Warning Info Box */}
            <div className="p-4 bg-rose-50/40 border border-rose-100 rounded-2xl text-xs text-rose-800 flex items-start gap-2.5 text-right">
              <Info className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>این فرآیند ممکن است چند لحظه طول بکشد. لطفاً صفحه را نبندید یا دکمه بازگشت را نزنید.</span>
            </div>

            {/* Footer Trust Note */}
            <div className="pt-3 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
              <Shield className="w-3.5 h-3.5 text-slate-400" />
              <span>تراکنش شما در محیطی امن پردازش می‌شود</span>
            </div>

          </div>
        )}

        {/* ========================================================================= */}
        {/* 4. PENDING / UNKNOWN STATUS (در حال بررسی وضعیت تراکنش - عکس-07 و عکس-08) */}
        {/* ========================================================================= */}
        {!paymentStatusData.isLoading && (currentStatus === 'pending' || currentStatus === 'unknown') && (
          <div className="bg-white rounded-3xl border border-slate-100 p-8 sm:p-12 text-center shadow-xs space-y-6">
            
            {/* Blue 3-Dots / Pending Icon */}
            <div className="w-20 h-20 rounded-full bg-blue-600 text-white flex items-center justify-center mx-auto shadow-lg shadow-blue-600/30">
              <MoreHorizontal className="w-10 h-10 stroke-[2.5]" />
            </div>

            {/* Title & Description */}
            <div className="space-y-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900">
                {currentStatus === 'unknown' ? 'وضعیت تراکنش نامشخص است (در انتظار تأیید)' : paymentStatusData.instructions ? 'سفارش شما منتظر واریز است' : 'در حال بررسی وضعیت تراکنش'}
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
                {currentStatus === 'unknown'
                  ? 'نتیجه نهایی تراکنش از سوی درگاه بانکی هنوز قطعی نشده است. در صورت کسر وجه از حساب، مبلغ حداکثر تا ۷۲ ساعت توسط بانک بازگردانده می‌شود یا پس از تأیید درگاه، سفارش فعال خواهد شد.'
                  : paymentStatusData.instructions
                    ? 'پس از واریز، سفارش شما توسط پشتیبانی بررسی و تأیید می‌شود.'
                    : 'نتیجه نهایی تراکنش هنوز مشخص نشده است. لطفا تا چند دقیقه دیگر وضعیت سفارش خود را از پنل کاربری چک کنید.'}
              </p>
              {isPolling && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 text-xs rounded-full font-medium mt-2">
                  <RotateCw className="w-3.5 h-3.5 animate-spin" />
                  <span>در حال استعلام خودکار وضعیت... (تلاش {pollAttempt} از {MAX_POLL_ATTEMPTS})</span>
                </div>
              )}
            </div>

            {/* Notice Box */}
            <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs text-slate-600 flex items-start gap-2.5 text-right">
              <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <span>{paymentStatusData.instructions || 'در صورت کسر وجه، مبلغ تا ۷۲ ساعت آینده توسط شبکه شاپرک به حساب شما بازگردانده خواهد شد.'}</span>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row-reverse items-center justify-center gap-3 pt-2">
              <button
                onClick={() => verifyStatusWithBackend(0)}
                disabled={isPolling}
                className="w-full sm:flex-1 py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-2xl text-xs sm:text-sm font-bold shadow-lg shadow-blue-600/30 transition hover:scale-101 flex items-center justify-center gap-2"
              >
                <RotateCw className={`w-4 h-4 ${isPolling ? 'animate-spin' : ''}`} />
                <span>استعلام مجدد وضعیت</span>
              </button>

              <button
                onClick={() => setActiveView('profile')}
                className="w-full sm:flex-1 py-3.5 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-2xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2"
              >
                <span>بازگشت به پنل کاربری</span>
              </button>
            </div>

            {/* Tracking Code Footer */}
            <div className="pt-3 text-xs text-slate-400 font-sans">
              کد پیگیری سیستمی: <span className="font-bold text-slate-600">{trackingCode}</span>
            </div>

          </div>
        )}

        {/* ========================================================================= */}
        {/* 5. PAYMENT SUCCESSFUL (پرداخت با موفقیت انجام شد - عکس-09 و عکس-10) */}
        {/* ========================================================================= */}
        {!paymentStatusData.isLoading && currentStatus === 'success' && (
          <div className="bg-white rounded-3xl border border-slate-100 p-8 sm:p-12 text-center shadow-xs space-y-6">
            
            {/* Green Checkmark Badge */}
            <div className="w-20 h-20 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100">
              <CheckCircle2 className="w-10 h-10 stroke-[2]" />
            </div>

            {/* Title & Subtitle */}
            <div className="space-y-1.5">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900">
                پرداخت با موفقیت انجام شد
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-sans">
                سفارش <span className="font-bold text-slate-800">#{orderNumber}</span> تایید شد
              </p>
            </div>

            {/* Order Receipt Details (Exact matching عکس-09) */}
            <div className="bg-slate-50 rounded-2xl p-5 text-right text-xs space-y-3.5 border border-slate-100">
              <div className="text-xs font-bold text-slate-900 border-b border-slate-200 pb-2">
                جزئیات سفارش
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500">مبلغ کل</span>
                <span className="font-black text-slate-900 text-sm font-sans">
                  {formatMoney(paymentStatusData?.amount, paymentStatusData?.currency)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500">روش پرداخت</span>
                <span className="font-semibold text-slate-800">
                  {paymentStatusData.paymentMethod || 'درگاه پرداخت اینترنتی'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500">تاریخ</span>
                <span className="font-semibold text-slate-800 font-sans">
                  {paymentStatusData.date || '۲۵ مرداد ۱۴۰۵ ساعت ۰۲:۳۷'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500">کد پیگیری</span>
                <span className="font-bold text-slate-900 font-sans">
                  {trackingCode}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2.5 pt-2">
              <button
                onClick={() => setActiveView('profile')}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs sm:text-sm font-bold shadow-lg shadow-blue-600/30 transition hover:scale-101 flex items-center justify-center gap-2"
              >
                <Truck className="w-4 h-4" />
                <span>پیگیری سفارش</span>
              </button>

              <button
                onClick={() => {
                  setCheckoutStep(1);
                  setActiveView('store');
                }}
                className="w-full py-3 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-2xl text-xs sm:text-sm font-bold transition"
              >
                بازگشت به فروشگاه
              </button>
            </div>

          </div>
        )}

        {/* ========================================================================= */}
        {/* 6. GATEWAY UNAVAILABLE / ERROR (پرداخت در دسترس نیست - عکس-11 و عکس-12) */}
        {/* ========================================================================= */}
        {!paymentStatusData.isLoading && currentStatus === 'unavailable' && (
          <div className="bg-white rounded-3xl border border-slate-100 p-8 sm:p-12 text-center shadow-xs space-y-6">
            
            {/* Red Slashed Card Icon */}
            <div className="w-20 h-20 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
              <ShieldAlert className="w-10 h-10 stroke-[1.75]" />
            </div>

            {/* Title & Description */}
            <div className="space-y-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900">
                پرداخت در دسترس نیست
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
                {paymentStatusData.errorMessage || 'در حال حاضر ارتباط با درگاه پرداخت برقرار نشد یا اعتبارسنجی ناموفق بود. لطفاً چند لحظه دیگر دوباره تلاش کنید.'}
              </p>
            </div>

            {/* Technical Details Collapsible Accordion (Matching عکس-11) */}
            <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden text-right">
              <button
                type="button"
                onClick={() => setIsTechDetailsOpen(!isTechDetailsOpen)}
                className="w-full px-4 py-3 text-xs font-bold text-slate-600 flex items-center justify-between hover:bg-slate-100/60 transition"
              >
                <span>جزئیات فنی (اختیاری)</span>
                {isTechDetailsOpen ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </button>

              {isTechDetailsOpen && (
                <div className="p-4 pt-2 border-t border-slate-200 text-left font-mono text-[11px] text-slate-600 bg-slate-100/60 leading-relaxed space-y-1">
                  <div>CODE: {paymentStatusData.errorCode || 'ERR_GATEWAY_TIMEOUT'}</div>
                  <div>Order Ref: #{orderNumber}</div>
                  <div>Time: {paymentStatusData.gatewayTime || new Date().toISOString()}</div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row-reverse items-center justify-center gap-3 pt-2">
              <button
                onClick={() => {
                  setCheckoutStep(3);
                  setActiveView('cart');
                }}
                className="w-full sm:flex-1 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs sm:text-sm font-bold shadow-lg shadow-blue-600/30 transition hover:scale-101 flex items-center justify-center gap-2"
              >
                <RotateCw className="w-4 h-4" />
                <span>تلاش مجدد</span>
              </button>

              <button
                onClick={() => {
                  setCheckoutStep(1);
                  setActiveView('cart');
                }}
                className="w-full sm:flex-1 py-3.5 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-2xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2"
              >
                <ArrowRight className="w-4 h-4" />
                <span>بازگشت به سفارش</span>
              </button>
            </div>

            {/* Alternative payment methods footer */}
            <div className="pt-2 flex items-center justify-center gap-4 text-xs text-slate-400">
              <button onClick={() => setActiveView('contact')} className="hover:text-blue-600 transition">
                پشتیبانی
              </button>
              <span>|</span>
              <button onClick={() => { setCheckoutStep(3); setActiveView('cart'); }} className="hover:text-blue-600 transition">
                روش‌های پرداخت جایگزین
              </button>
            </div>

          </div>
        )}

      </div>

      {/* Shared Footer matching design */}
      <footer className="mt-12 pt-6 border-t border-slate-200/60 text-center text-xs text-slate-400 space-y-3">
        <div className="flex flex-wrap items-center justify-center gap-6 text-slate-500">
          <button onClick={() => setActiveView('contact')} className="hover:text-blue-600">تماس با ما</button>
          <button onClick={() => setActiveView('about')} className="hover:text-blue-600">شرایط استفاده</button>
          <button onClick={() => setActiveView('about')} className="hover:text-blue-600">حریم خصوصی</button>
          <button onClick={() => setActiveView('contact')} className="hover:text-blue-600">اطلاعات ارسال</button>
        </div>
        <p className="font-sans text-[11px]">
          .noovinnet Premium Tech. All rights reserved 2024 ©
        </p>
      </footer>

    </div>
  );
};
