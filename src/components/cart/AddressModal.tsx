import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, MapPin, Search, X } from 'lucide-react';
import { UserAddress } from '../../types';
import { iranProvinceLocations } from '../../data/iranProvinceLocations';
import { SESSION_STATE_KEYS, clearSessionState, readSessionState, writeSessionState } from '../../utils/sessionState';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { ModalPortal } from '../common/ModalPortal';

type AddressDraft = Omit<UserAddress, 'id'>;
type PickerMode = 'province' | 'city' | null;

interface AddressModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (address: Omit<UserAddress, 'id'>) => Promise<void>;
  initialAddress?: UserAddress | null;
}

const normalizeDigits = (value: string) => value
  .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
  .replace(/\D/g, '');

export const AddressModal: React.FC<AddressModalProps> = ({ isOpen, onClose, onSave, initialAddress }) => {
  const draftKey = initialAddress
    ? `${SESSION_STATE_KEYS.addressDraftPrefix}:edit:${initialAddress.id}`
    : `${SESSION_STATE_KEYS.addressDraftPrefix}:new`;

  useBodyScrollLock(isOpen);

  const [isDraftReady, setIsDraftReady] = useState(false);
  const [title, setTitle] = useState(initialAddress?.title || 'خانه');
  const [recipientName, setRecipientName] = useState(initialAddress?.recipient_name || '');
  const [phone, setPhone] = useState(initialAddress?.phone || '');
  const [selectedProvince, setSelectedProvince] = useState(initialAddress?.province || '');
  const [selectedCity, setSelectedCity] = useState(initialAddress?.city || '');
  const [postalCode, setPostalCode] = useState(initialAddress?.postal_code || '');
  const [addressLine, setAddressLine] = useState(initialAddress?.address_line || '');
  const [pickerMode, setPickerMode] = useState<PickerMode>(null);
  const [pickerSearch, setPickerSearch] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setIsDraftReady(false);
      setPickerMode(null);
      return;
    }

    const initialDraft: AddressDraft = initialAddress
      ? {
          title: initialAddress.title,
          recipient_name: initialAddress.recipient_name,
          phone: initialAddress.phone,
          province: initialAddress.province,
          city: initialAddress.city,
          postal_code: initialAddress.postal_code,
          address_line: initialAddress.address_line,
          is_default: initialAddress.is_default,
        }
      : {
          title: 'خانه',
          recipient_name: '',
          phone: '',
          province: '',
          city: '',
          postal_code: '',
          address_line: '',
          is_default: true,
        };
    const draft = readSessionState<AddressDraft | null>(draftKey, null) || initialDraft;

    setTitle(draft.title);
    setRecipientName(draft.recipient_name);
    setPhone(draft.phone);
    setSelectedProvince(draft.province);
    setSelectedCity(draft.city);
    setPostalCode(normalizeDigits(draft.postal_code).slice(0, 10));
    setAddressLine(draft.address_line);
    setErrors({});
    setPickerSearch('');
    setIsDraftReady(true);
  }, [draftKey, initialAddress, isOpen]);

  useEffect(() => {
    if (!isOpen || !isDraftReady) return;
    writeSessionState<AddressDraft>(draftKey, {
      title,
      recipient_name: recipientName,
      phone,
      province: selectedProvince,
      city: selectedCity,
      postal_code: postalCode,
      address_line: addressLine,
      is_default: true,
    });
  }, [addressLine, draftKey, isDraftReady, isOpen, phone, postalCode, recipientName, selectedCity, selectedProvince, title]);

  const selectedProvinceRecord = useMemo(
    () => iranProvinceLocations.find((province) => province.name === selectedProvince),
    [selectedProvince],
  );
  const availableCities = selectedProvinceRecord?.cities || [];
  const pickerItems = useMemo(() => {
    const query = pickerSearch.trim();
    const items = pickerMode === 'province'
      ? iranProvinceLocations.map((province) => province.name)
      : availableCities;
    return query ? items.filter((item) => item.includes(query)) : items;
  }, [availableCities, pickerMode, pickerSearch]);

  const clearError = (name: string) => {
    setErrors((current) => {
      if (!current[name]) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!recipientName.trim()) nextErrors.recipientName = 'نام گیرنده را وارد کنید.';
    if (!/^09\d{9}$/.test(normalizeDigits(phone))) nextErrors.phone = 'شماره تماس باید ۱۱ رقم و با ۰۹ شروع شود.';
    if (!selectedProvince) nextErrors.province = 'استان را انتخاب کنید.';
    if (!selectedCity) nextErrors.city = 'شهر را انتخاب کنید.';
    if (!/^\d{10}$/.test(postalCode)) nextErrors.postalCode = 'کد پستی باید دقیقاً ۱۰ رقم باشد.';
    if (addressLine.trim().length < 10) nextErrors.addressLine = 'آدرس دقیق محل تحویل را وارد کنید (حداقل ۱۰ کاراکتر).';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validate() || isSaving) return;

    setIsSaving(true);
    try {
      await onSave({
        title,
        recipient_name: recipientName.trim(),
        phone: normalizeDigits(phone),
        province: selectedProvince,
        city: selectedCity,
        postal_code: postalCode,
        address_line: addressLine.trim(),
        is_default: true,
      });
      clearSessionState(draftKey);
      onClose();
    } catch {
      setErrors((current) => ({
        ...current,
        form: 'ذخیره آدرس انجام نشد. اطلاعات فرم حفظ شده است؛ لطفاً دوباره تلاش کنید.',
      }));
    } finally {
      setIsSaving(false);
    }
  };

  const choosePickerItem = (item: string) => {
    if (pickerMode === 'province') {
      setSelectedProvince(item);
      setSelectedCity('');
      clearError('province');
      clearError('city');
    } else {
      setSelectedCity(item);
      clearError('city');
    }
    setPickerMode(null);
    setPickerSearch('');
  };

  const openPicker = (mode: Exclude<PickerMode, null>) => {
    if (mode === 'city' && !selectedProvince) return;
    setPickerSearch('');
    setPickerMode(mode);
  };

  if (!isOpen) return null;

  const pickerTitle = pickerMode === 'province' ? 'انتخاب استان' : 'انتخاب شهر';
  const pickerHint = pickerMode === 'province'
    ? 'ابتدا استان محل تحویل را انتخاب کنید.'
    : `شهرهای استان ${selectedProvince}`;

  return (
    <ModalPortal>
      <div className="ui-modal-backdrop items-end bg-slate-950/60 backdrop-blur-xs p-0 sm:items-center sm:p-4 animate-in fade-in duration-200">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="address-modal-title"
        className="w-full max-w-lg h-[90dvh] sm:h-auto sm:max-h-[90vh] bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
      >
        <button type="button" onClick={onClose} className="sm:hidden min-h-9 flex items-center justify-center" aria-label="بستن فرم آدرس">
          <span className="w-12 h-1.5 rounded-full bg-slate-300" />
        </button>

        <header className="px-5 sm:px-7 pb-3 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div>
            <h2 id="address-modal-title" className="text-base font-black text-slate-900">{initialAddress ? 'ویرایش آدرس گیرنده' : 'افزودن آدرس جدید'}</h2>
            <p className="text-[11px] text-slate-500 mt-1">اطلاعات محل تحویل را دقیق و به فارسی وارد کنید.</p>
          </div>
          <button type="button" onClick={onClose} className="min-w-11 min-h-11 rounded-full text-slate-400 hover:bg-slate-100 flex items-center justify-center" aria-label="بستن فرم آدرس">
            <X className="w-5 h-5" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto scrollbar-none px-5 sm:px-7 py-4 space-y-4">
            {errors.form && (
              <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                {errors.form}
              </p>
            )}
            <fieldset className="space-y-2">
              <legend className="text-xs font-bold text-slate-700">عنوان آدرس</legend>
              <div className="grid grid-cols-3 gap-2">
                {['خانه', 'محل کار', 'سایر'].map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setTitle(item)}
                    className={`min-h-11 rounded-xl text-xs font-bold border transition ${title === item ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="space-y-1 block">
                <span className="text-xs font-bold text-slate-700">نام گیرنده</span>
                <input
                  value={recipientName}
                  onChange={(event) => { setRecipientName(event.target.value); clearError('recipientName'); }}
                  placeholder="مثال: علی احمدی"
                  className={`w-full min-h-11 px-3.5 text-sm bg-slate-50 border rounded-xl focus:outline-none transition ${errors.recipientName ? 'border-rose-500 bg-rose-50/20' : 'border-slate-200 focus:border-blue-500 focus:bg-white'}`}
                />
                {errors.recipientName && <span className="text-[11px] text-rose-600 font-medium">{errors.recipientName}</span>}
              </label>

              <label className="space-y-1 block">
                <span className="text-xs font-bold text-slate-700">شماره تماس گیرنده</span>
                <input
                  type="tel"
                  inputMode="numeric"
                  dir="ltr"
                  value={phone}
                  onChange={(event) => { setPhone(normalizeDigits(event.target.value).slice(0, 11)); clearError('phone'); }}
                  placeholder="09xxxxxxxxx"
                  className={`w-full min-h-11 px-3.5 text-sm bg-slate-50 border rounded-xl focus:outline-none font-sans transition ${errors.phone ? 'border-rose-500 bg-rose-50/20' : 'border-slate-200 focus:border-blue-500 focus:bg-white'}`}
                />
                {errors.phone && <span className="text-[11px] text-rose-600 font-medium">{errors.phone}</span>}
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-700">استان</span>
                <button
                  type="button"
                  onClick={() => openPicker('province')}
                  className={`w-full min-h-11 px-3.5 text-sm bg-slate-50 border rounded-xl text-right flex items-center justify-between gap-3 transition ${errors.province ? 'border-rose-500 bg-rose-50/20' : 'border-slate-200 hover:bg-white focus-visible:border-blue-500'}`}
                >
                  <span className={selectedProvince ? 'text-slate-900 font-semibold truncate' : 'text-slate-400'}>{selectedProvince || 'انتخاب استان'}</span>
                  <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                </button>
                {errors.province && <span className="text-[11px] text-rose-600 font-medium">{errors.province}</span>}
              </div>

              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-700">شهر</span>
                <button
                  type="button"
                  disabled={!selectedProvince}
                  onClick={() => openPicker('city')}
                  className={`w-full min-h-11 px-3.5 text-sm bg-slate-50 border rounded-xl text-right flex items-center justify-between gap-3 transition ${errors.city ? 'border-rose-500 bg-rose-50/20' : 'border-slate-200 hover:bg-white focus-visible:border-blue-500'} ${!selectedProvince ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span className={selectedCity ? 'text-slate-900 font-semibold truncate' : 'text-slate-400'}>{selectedCity || (selectedProvince ? 'انتخاب شهر' : 'ابتدا استان را انتخاب کنید')}</span>
                  <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                </button>
                {errors.city && <span className="text-[11px] text-rose-600 font-medium">{errors.city}</span>}
              </div>
            </div>

            <label className="space-y-1 block">
              <span className="text-xs font-bold text-slate-700">کد پستی (۱۰ رقم)</span>
              <input
                type="text"
                inputMode="numeric"
                dir="ltr"
                value={postalCode}
                onChange={(event) => { setPostalCode(normalizeDigits(event.target.value).slice(0, 10)); clearError('postalCode'); }}
                placeholder="1234567890"
                maxLength={10}
                className={`w-full min-h-11 px-3.5 text-sm bg-slate-50 border rounded-xl focus:outline-none font-sans transition ${errors.postalCode ? 'border-rose-500 bg-rose-50/20' : 'border-slate-200 focus:border-blue-500 focus:bg-white'}`}
              />
              <span className="block text-[11px] text-slate-400">فقط رقم وارد کنید؛ پس از تکمیل ۱۰ رقم، خطای مزاحم نمایش داده نمی‌شود.</span>
              {errors.postalCode && <span className="text-[11px] text-rose-600 font-medium">{errors.postalCode}</span>}
            </label>

            <label className="space-y-1 block">
              <span className="text-xs font-bold text-slate-700">آدرس کامل</span>
              <textarea
                rows={3}
                value={addressLine}
                onChange={(event) => { setAddressLine(event.target.value); clearError('addressLine'); }}
                placeholder="خیابان، کوچه، پلاک، واحد و توضیحات تحویل را وارد کنید…"
                className={`w-full min-h-24 px-3.5 py-3 text-sm bg-slate-50 border rounded-xl focus:outline-none resize-y transition ${errors.addressLine ? 'border-rose-500 bg-rose-50/20' : 'border-slate-200 focus:border-blue-500 focus:bg-white'}`}
              />
              {errors.addressLine && <span className="text-[11px] text-rose-600 font-medium">{errors.addressLine}</span>}
            </label>
          </div>

          <footer className="p-4 sm:px-7 border-t border-slate-100 bg-white flex items-center gap-2 shrink-0">
            <button type="button" onClick={onClose} disabled={isSaving} className="min-h-11 px-4 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition disabled:opacity-50">انصراف</button>
            <button type="submit" disabled={isSaving} className="min-h-11 flex-1 sm:flex-none sm:px-7 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-md shadow-blue-600/25 transition disabled:cursor-wait disabled:opacity-70">{isSaving ? 'در حال ذخیره…' : 'ذخیرهٔ آدرس'}</button>
          </footer>
        </form>
      </section>

      {pickerMode && (
        <div className="fixed inset-0 z-[60] flex items-end bg-slate-950/40" role="dialog" aria-modal="true" aria-label={pickerTitle}>
          <button type="button" onClick={() => setPickerMode(null)} className="absolute inset-0" aria-label="بستن انتخاب‌گر" />
          <section className="relative w-full max-w-lg mx-auto max-h-[78dvh] bg-white rounded-t-3xl shadow-2xl flex flex-col animate-in slide-in-from-bottom duration-200">
            <div className="min-h-10 flex items-center justify-center" aria-hidden="true"><span className="w-12 h-1.5 rounded-full bg-slate-300" /></div>
            <header className="px-5 pb-3 flex items-start justify-between gap-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-900">{pickerTitle}</h3>
                <p className="text-[11px] text-slate-500 mt-1">{pickerHint}</p>
              </div>
              <button type="button" onClick={() => setPickerMode(null)} className="min-w-11 min-h-11 rounded-xl text-slate-500 hover:bg-slate-100 flex items-center justify-center" aria-label="بستن"><X className="w-5 h-5" /></button>
            </header>
            <div className="p-4 border-b border-slate-100">
              <label className="relative block">
                <span className="sr-only">{`جستجوی ${pickerTitle}`}</span>
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input autoFocus value={pickerSearch} onChange={(event) => setPickerSearch(event.target.value)} placeholder={`جستجوی ${pickerMode === 'province' ? 'استان' : 'شهر'}…`} className="w-full min-h-11 pr-9 pl-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-blue-600 focus:outline-none" />
              </label>
            </div>
            <div className="overflow-y-auto scrollbar-none p-3 space-y-1">
              {pickerItems.length === 0 ? (
                <p className="p-5 text-center text-sm text-slate-500">موردی پیدا نشد.</p>
              ) : pickerItems.map((item) => {
                const selected = pickerMode === 'province' ? item === selectedProvince : item === selectedCity;
                return (
                  <button key={item} type="button" onClick={() => choosePickerItem(item)} className={`w-full min-h-11 px-3 text-right rounded-xl flex items-center justify-between gap-3 text-sm transition ${selected ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-700 hover:bg-slate-50'}`}>
                    <span>{item}</span>
                    {selected && <Check className="w-4 h-4 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      )}
      </div>
    </ModalPortal>
  );
};
