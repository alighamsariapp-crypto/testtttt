import React, { useEffect, useState } from 'react';
import { Plus, MapPin, Phone, User, Check, Edit2, Trash2, ArrowLeft, ArrowRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { CartStepper } from './CartStepper';
import { AddressModal } from './AddressModal';
import { UserAddress } from '../../types';
import { SESSION_STATE_KEYS, readSessionState, writeSessionState } from '../../utils/sessionState';
import { formatMoney } from '../../utils/money';

export const CartStep2Address: React.FC = () => {
  const {
    addresses,
    selectedAddressId,
    setSelectedAddressId,
    addAddress,
    updateAddress,
    deleteAddress,
    setCheckoutStep,
    cartSummary,
    setActiveView,
    showToast,
    user,
    setAuthModalOpen,
  } = useApp();

  const [isModalOpen, setIsModalOpen] = useState(() =>
    readSessionState(SESSION_STATE_KEYS.addressModalResume, false),
  );
  const [editingAddress, setEditingAddress] = useState<UserAddress | null>(null);

  useEffect(() => {
    writeSessionState(SESSION_STATE_KEYS.addressModalResume, isModalOpen);
  }, [isModalOpen]);

  const requireLoginForAddress = () => {
    setIsModalOpen(false);
    showToast('برای ثبت یا انتخاب آدرس تحویل، ابتدا وارد حساب کاربری شوید.', 'info');
    setAuthModalOpen(true);
  };

  const handleOpenAdd = () => {
    if (!user) {
      requireLoginForAddress();
      return;
    }
    setEditingAddress(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (addr: UserAddress) => {
    if (!user) {
      requireLoginForAddress();
      return;
    }
    setEditingAddress(addr);
    setIsModalOpen(true);
  };

  const handleSaveAddress = async (addrData: Omit<UserAddress, 'id'>) => {
    if (!user) {
      requireLoginForAddress();
      return;
    }
    if (editingAddress) {
      await updateAddress(editingAddress.id, addrData);
      showToast('آدرس با موفقیت ویرایش شد.', 'success');
    } else {
      await addAddress(addrData);
      showToast('آدرس با موفقیت ذخیره و برای ارسال انتخاب شد.', 'success');
    }
  };

  const proceedToPayment = () => {
    if (!user) {
      requireLoginForAddress();
      return;
    }
    if (!selectedAddressId) {
      showToast('برای ادامهٔ خرید، ابتدا یک آدرس تحویل انتخاب یا ثبت کنید.', 'error');
      return;
    }
    setCheckoutStep(3);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-28 sm:pb-6 space-y-6">
      
      {/* Breadcrumbs */}
      <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
        <button onClick={() => setActiveView('home')} className="hover:text-blue-600">خانه</button>
        <span>/</span>
        <button onClick={() => setCheckoutStep(1)} className="hover:text-blue-600">سبد خرید</button>
        <span>/</span>
        <span className="text-slate-700 font-medium">اطلاعات ارسال</span>
      </div>

      {/* Stepper Bar at Top */}
      <div className="border-b border-slate-100 pb-4">
        <CartStepper
          currentStep={2}
          onStepClick={(step) => {
            if (!user && step > 1) {
              requireLoginForAddress();
              return;
            }
            setCheckoutStep(step);
          }}
        />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Right Section: Address Selection (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          
          {/* Section Title & Add Address Button */}
          <div className="flex items-center justify-between">
            <h1 id="checkout-step-heading" tabIndex={-1} className="text-lg sm:text-xl font-black text-slate-900 outline-none">
              انتخاب آدرس تحویل سفارش
            </h1>
            
            <button
              onClick={handleOpenAdd}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>{user ? 'افزودن آدرس جدید' : 'ورود برای ثبت آدرس'}</span>
            </button>
          </div>

          {!user ? (
            <div className="bg-white rounded-3xl border border-slate-100 p-8 text-center space-y-4 shadow-xs">
              <div className="w-16 h-16 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                <MapPin className="w-7 h-7 stroke-[1.5]" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">برای ثبت آدرس وارد حساب شوید</h3>
                <p className="text-xs text-slate-400 mt-1">آدرس تحویل فقط برای حساب کاربری واردشده ذخیره و استفاده می‌شود.</p>
              </div>
              <button
                type="button"
                onClick={requireLoginForAddress}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/30 transition hover:scale-102"
              >
                ورود به حساب
              </button>
            </div>
          ) : addresses.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-100 p-8 text-center space-y-4 shadow-xs">
              <div className="w-16 h-16 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center mx-auto">
                <MapPin className="w-7 h-7 stroke-[1.5]" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">هیچ آدرسی ثبت نشده است</h3>
                <p className="text-xs text-slate-400 mt-1">
                  برای ادامه سفارش لطفاً آدرس محل دریافت کالا را اضافه کنید.
                </p>
              </div>
              <button
                onClick={handleOpenAdd}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/30 transition hover:scale-102"
              >
                افزودن اولین آدرس
              </button>
            </div>
          ) : (
            /* Address Cards Grid (Matching عکس-02, عکس-03, عکس-14) */
            <div className="space-y-3">
              {addresses.map((addr) => {
                const isSelected = selectedAddressId === addr.id;

                return (
                  <div
                    key={addr.id}
                    onClick={() => setSelectedAddressId(addr.id)}
                    className={`bg-white rounded-3xl border-2 p-5 transition cursor-pointer relative shadow-xs ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/20 shadow-blue-600/5'
                        : 'border-slate-100 hover:border-slate-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      
                      {/* Left: Radio & Info */}
                      <div className="flex items-start gap-3.5 flex-1">
                        
                        {/* Radio Icon Circle */}
                        <div
                          className={`w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center shrink-0 transition ${
                            isSelected
                              ? 'border-blue-600 bg-blue-600 text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>

                        {/* Details */}
                        <div className="space-y-2 flex-1">
                          
                          {/* Title & Badge */}
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-bold">
                              {addr.title}
                            </span>
                            {addr.is_default && (
                              <span className="text-[10px] text-blue-600 font-semibold">
                                (آدرس پیش‌فرض)
                              </span>
                            )}
                          </div>

                          {/* Address text */}
                          <div className="flex items-start gap-1.5 text-xs font-semibold text-slate-800 leading-relaxed">
                            <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                            <span>{addr.address_line}</span>
                          </div>

                          {/* Recipient details */}
                          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                            <div className="flex items-center gap-1">
                              <User className="w-3.5 h-3.5 text-slate-400" />
                              <span>{addr.recipient_name}</span>
                            </div>
                            <div className="flex items-center gap-1 font-sans">
                              <Phone className="w-3.5 h-3.5 text-slate-400" />
                              <span>{addr.phone}</span>
                            </div>
                            {addr.postal_code && (
                              <div className="text-[11px] text-slate-400 font-sans">
                                کد پستی: {addr.postal_code}
                              </div>
                            )}
                          </div>

                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleOpenEdit(addr)}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition"
                          title="ویرایش"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteAddress(addr.id)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition"
                          title="حذف"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>

        {/* Left Section: Order Summary (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-xs space-y-4 sticky top-24">
            
            <h3 className="text-sm font-extrabold text-slate-900">خلاصه سفارش</h3>

            <div className="space-y-3 text-xs text-slate-600 border-b border-slate-100 pb-4">
              <div className="flex items-center justify-between">
                <span>جمع کالاها ({cartSummary.item_count})</span>
                <span className="font-bold text-slate-900 font-sans">
                  {formatMoney(cartSummary.subtotal, cartSummary.currency)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span>هزینه ارسال</span>
                <span className="font-bold text-slate-900 font-sans">
                  {cartSummary.shipping_total === 0 ? 'رایگان' : formatMoney(cartSummary.shipping_total, cartSummary.currency)}
                </span>
              </div>
            </div>

            {/* Final Total */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs font-bold text-slate-900">مبلغ قابل پرداخت</span>
              <span className="text-base sm:text-lg font-black text-blue-700 font-sans">
                {formatMoney(cartSummary.grand_total, cartSummary.currency)}
              </span>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2.5 pt-2">
              <button
                id="cart-step2-proceed-btn"
                onClick={proceedToPayment}
                className={`w-full min-h-12 py-3 rounded-2xl text-xs sm:text-sm font-bold shadow-lg transition flex items-center justify-center gap-2 ${
                  selectedAddressId
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/30 hover:scale-101'
                    : 'bg-slate-700 hover:bg-slate-800 text-white shadow-slate-900/15'
                }`}
              >
                <span>ادامهٔ خرید</span>
                <ArrowLeft className="w-4 h-4" />
              </button>

              <button
                onClick={() => setCheckoutStep(1)}
                className="w-full py-3 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-2xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-1.5"
              >
                <ArrowRight className="w-4 h-4" />
                <span>بازگشت به سبد خرید</span>
              </button>
            </div>

          </div>
        </div>

      </div>

      {/* Address Edit / Add Modal */}
      <AddressModal
        isOpen={Boolean(user) && isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveAddress}
        initialAddress={editingAddress}
      />

      {/* MOBILE FLOATING ADDRESS CONFIRMATION BAR */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 px-4 py-3 sm:hidden shadow-2xl flex items-center justify-between gap-3 safe-area-bottom">
          <div className="flex flex-col min-w-0">
          <span className="text-[10px] text-slate-500 font-medium">مبلغ کل قابل پرداخت</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-base font-black text-blue-700 font-sans">
              {formatMoney(cartSummary.grand_total, cartSummary.currency)}
            </span>
          </div>
        </div>

        <button
          id="mobile-address-continue-checkout-btn"
          onClick={proceedToPayment}
          className="min-h-11 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-2xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-blue-600/30 transition shrink-0"
        >
          <span>ادامهٔ خرید</span>
          <ArrowLeft className="w-4 h-4" />
        </button>
      </div>

    </div>
  );
};
