import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, ChevronLeft, CreditCard, MessageSquareText, Save, ShieldCheck, Truck } from 'lucide-react';
import type { CheckoutConfiguration, CheckoutPaymentMethod, ShippingMethodConfig, SmsConnectionInfo, SmsSystemConfiguration } from '../../../types';
import { AppSelect } from './AppSelect';
import { SmsSettingsPage } from './SmsSettingsPage';
import './settings-workspace.css';
import './payment-shipping-settings.css';

type SettingsSection = 'payment' | 'shipping' | 'sms';

type PaymentToggleKey = 'online_enabled' | 'wallet_enabled' | 'bank_transfer_enabled';

const readSection = (): SettingsSection | null => {
  const value = new URLSearchParams(window.location.search).get('settings');
  return value === 'payment' || value === 'shipping' || value === 'sms' ? value : null;
};

const digitsOnly = (value: string): string => value.replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit))).replace(/\D/g, '');

function Toggle({ checked, label, hint, onChange }: { checked: boolean; label: string; hint: string; onChange: () => void }) {
  return <button type="button" className={`settings-switch-field ${checked ? 'is-on' : ''}`} onClick={onChange} aria-pressed={checked}>
    <span><b>{label}</b><small>{hint}</small></span><i><em /></i>
  </button>;
}

function priceField(label: string, value: number, onChange: (next: number) => void, hint: string) {
  const tomanValue = Math.floor(value / 10);
  return <label className="settings-page-field">
    <span>{label}</span>
    <input dir="ltr" inputMode="numeric" value={tomanValue === 0 ? '' : tomanValue.toLocaleString('en-US')} onChange={(event) => onChange(Number(digitsOnly(event.target.value) || 0) * 10)} placeholder="0" />
    <small>{hint}</small>
  </label>;
}

export function SettingsWorkspace({ value, onSave, smsManagement, notify, liveMode }: { value: CheckoutConfiguration; onSave: (value: CheckoutConfiguration) => Promise<void>; smsManagement?: { value: SmsSystemConfiguration; save: (value: SmsSystemConfiguration) => Promise<void>; testConnection: () => Promise<SmsConnectionInfo> }; notify: (message: string) => void; liveMode: boolean }) {
  const [selected, setSelected] = useState<SettingsSection | null>(readSection);
  const [draft, setDraft] = useState<CheckoutConfiguration>(value);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(value);
  const activeMethods = useMemo(() => draft.shipping.methods.filter((method) => method.enabled), [draft.shipping.methods]);

  useEffect(() => setDraft(value), [value]);
  useEffect(() => {
    const sync = () => setSelected(readSection());
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  const patch = (next: Partial<CheckoutConfiguration>) => {
    setDraft((current) => ({ ...current, ...next }));
    setError('');
  };

  const open = (section: SettingsSection) => {
    setSelected(section);
    setError('');
    window.history.pushState(null, '', `?tab=settings&settings=${section}`);
  };

  const back = () => {
    setSelected(null);
    setError('');
    window.history.pushState(null, '', '?tab=settings');
  };

  const enabledPaymentMethods = (): CheckoutPaymentMethod[] => {
    const { payment } = draft;
    return [
      ...(payment.online_enabled ? ['online' as const] : []),
      ...(payment.wallet_enabled ? ['wallet' as const] : []),
      ...(payment.bank_transfer_enabled ? ['bank_transfer' as const] : []),
    ];
  };

  const changePaymentToggle = (key: PaymentToggleKey) => {
    const payment = { ...draft.payment, [key]: !draft.payment[key] };
    const enabled = ([
      ...(payment.online_enabled ? ['online' as const] : []),
      ...(payment.wallet_enabled ? ['wallet' as const] : []),
      ...(payment.bank_transfer_enabled ? ['bank_transfer' as const] : []),
    ]);
    patch({ payment: { ...payment, default_method: enabled.includes(payment.default_method) ? payment.default_method : (enabled[0] ?? payment.default_method) } });
  };

  const updateShippingMethod = (id: string, updates: Partial<ShippingMethodConfig>) => {
    const methods = draft.shipping.methods.map((method) => method.id === id ? { ...method, ...updates } : method);
    const currentDefault = draft.shipping.default_method_id;
    const nextDefault = methods.some((method) => method.id === currentDefault && method.enabled)
      ? currentDefault
      : (methods.find((method) => method.enabled)?.id ?? currentDefault);
    patch({ shipping: { methods, default_method_id: nextDefault } });
  };

  const validate = (): string | null => {
    if (enabledPaymentMethods().length === 0) return 'حداقل یک روش پرداخت را فعال نگه دارید.';
    if (draft.payment.online_enabled && !draft.payment.zibal_sandbox && !draft.payment.zibal_merchant.trim()) return 'برای فعال‌سازی پرداخت واقعی، merchant code زیبال را وارد کنید.';
    if (draft.payment.bank_transfer_enabled && digitsOnly(draft.payment.bank_card_number).length !== 16) return 'برای واریز به حساب، شماره کارت ۱۶ رقمی وارد کنید.';
    if (draft.payment.bank_transfer_enabled && draft.payment.bank_account_name.trim().length < 2) return 'نام صاحب حساب واریز را وارد کنید.';
    if (activeMethods.length === 0) return 'حداقل یک روش ارسال را فعال نگه دارید.';
    if (!activeMethods.some((method) => method.id === draft.shipping.default_method_id)) return 'یک روش ارسال فعال را به‌عنوان پیش‌فرض انتخاب کنید.';
    if (draft.shipping.methods.some((method) => !method.id || method.base_cost < 0 || method.free_shipping_threshold < 0)) return 'هزینه و آستانهٔ ارسال باید عدد صفر یا بزرگ‌تر باشند.';
    return null;
  };

  const save = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    try {
      await onSave(draft);
      notify(liveMode ? 'تنظیمات پرداخت و ارسال با موفقیت ذخیره شد.' : 'تنظیمات در محیط بازبینی ذخیره شد.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'ذخیره‌سازی تنظیمات انجام نشد.');
    } finally {
      setSaving(false);
    }
  };

  const paymentEditor = () => {
    const paymentOptions = enabledPaymentMethods().map((method) => ({
      value: method,
      label: method === 'online' ? 'پرداخت اینترنتی' : method === 'wallet' ? 'کیف پول نوین‌نت' : 'واریز به حساب',
    }));

    return <main className="settings-page-main payment-shipping-editor">
      <div className="settings-page-title"><div className="settings-page-icon"><CreditCard size={22} /></div><div><h1>روش‌های دریافت پول</h1><p>روش‌های فعال خرید و مسیر پیش‌فرض پرداخت را تعیین کنید.</p></div></div>
      <div className="settings-page-note"><ShieldCheck size={15} />اطلاعات حساب واریزی فقط برای مدیران ذخیره می‌شود و در API عمومی checkout نمایش داده نمی‌شود. کلیدها و اطلاعات اتصال درگاه آنلاین هرگز در GitHub ثبت نخواهند شد.</div>
      <section className="settings-toggle-stack payment-shipping-toggles">
        <Toggle checked={draft.payment.online_enabled} label="پرداخت اینترنتی زیبال" hint="هدایت امن خریدار به درگاه زیبال و تأیید server-side پرداخت" onChange={() => changePaymentToggle('online_enabled')} />
        <Toggle checked={draft.payment.wallet_enabled} label="کیف پول نوین‌نت" hint="کسر آنی از موجودی قابل‌استفادهٔ مشتری" onChange={() => changePaymentToggle('wallet_enabled')} />
        <Toggle checked={draft.payment.bank_transfer_enabled} label="واریز به حساب" hint="ثبت سفارش با دستورالعمل پرداخت و پیگیری دستی" onChange={() => changePaymentToggle('bank_transfer_enabled')} />
      </section>
      {draft.payment.online_enabled && <section className="settings-custom-card"><b>تنظیم درگاه آنلاین زیبال</b><small>ابتدا با حالت آزمایشی تست کنید. برای پرداخت واقعی، merchant code را فقط پس از فعال‌شدن درگاه در زیبال وارد کنید.</small><div><Toggle checked={draft.payment.zibal_sandbox} label="حالت آزمایشی زیبال" hint="بدون دریافت پول واقعی؛ merchant تست رسمی زیبال استفاده می‌شود" onChange={() => patch({ payment: { ...draft.payment, zibal_sandbox: !draft.payment.zibal_sandbox, zibal_merchant: draft.payment.zibal_sandbox ? '' : 'zibal' } })} />{!draft.payment.zibal_sandbox && <label className="settings-page-field"><span>Merchant code زیبال</span><input dir="ltr" type="password" autoComplete="off" value={draft.payment.zibal_merchant} onChange={(event) => patch({ payment: { ...draft.payment, zibal_merchant: event.target.value.trim() } })} placeholder="merchant code زیبال" /><small>رمزگذاری‌شده ذخیره می‌شود و به مشتری نمایش داده نمی‌شود.</small></label>}</div></section>}
      <section className="settings-page-fields">
        <label className="settings-page-field"><span>روش پیش‌فرض</span><AppSelect value={draft.payment.default_method} options={paymentOptions} onChange={(next) => patch({ payment: { ...draft.payment, default_method: next as CheckoutPaymentMethod } })} ariaLabel="روش پیش‌فرض پرداخت" /></label>
      </section>
      {draft.payment.bank_transfer_enabled && <section className="settings-custom-card"><b>اطلاعات واریز به حساب</b><small>این اطلاعات در دستورالعمل سفارش‌های واریزی استفاده می‌شود.</small><div>{<label className="settings-page-field"><span>نام صاحب حساب</span><input value={draft.payment.bank_account_name} onChange={(event) => patch({ payment: { ...draft.payment, bank_account_name: event.target.value } })} /></label>}{<label className="settings-page-field"><span>شماره کارت</span><input dir="ltr" inputMode="numeric" value={draft.payment.bank_card_number} onChange={(event) => patch({ payment: { ...draft.payment, bank_card_number: digitsOnly(event.target.value).slice(0, 16) } })} placeholder="0000 0000 0000 0000" /></label>}</div></section>}
    </main>;
  };

  const shippingEditor = () => <main className="settings-page-main payment-shipping-editor">
    <div className="settings-page-title"><div className="settings-page-icon"><Truck size={22} /></div><div><h1>روش‌های ارسال</h1><p>روش‌های قابل‌انتخاب و هزینهٔ server-side هر روش را مدیریت کنید.</p></div></div>
    <div className="settings-page-note"><ShieldCheck size={15} />مبلغ‌ها در این فرم به تومان وارد می‌شوند و با قرارداد ریالی سفارش در سرور ذخیره و محاسبه می‌شوند؛ کاربر قادر به تغییر آن نیست.</div>
    <section className="payment-shipping-methods">
      {draft.shipping.methods.map((method) => <article key={method.id} className={method.enabled ? 'is-enabled' : ''}>
        <header><div><b>{method.title}</b><small>{method.description}</small></div><Toggle checked={method.enabled} label={method.enabled ? 'فعال' : 'غیرفعال'} hint="نمایش در checkout" onChange={() => updateShippingMethod(method.id, { enabled: !method.enabled })} /></header>
        <div className="settings-page-fields payment-shipping-fields">
          {priceField('هزینهٔ پایه (تومان)', method.base_cost, (base_cost) => updateShippingMethod(method.id, { base_cost }), 'برای رایگان‌بودن، صفر وارد کنید.')}
          {priceField('ارسال رایگان از مبلغ (تومان)', method.free_shipping_threshold, (free_shipping_threshold) => updateShippingMethod(method.id, { free_shipping_threshold }), 'صفر یعنی این روش آستانهٔ ارسال رایگان ندارد.')}
        </div>
        <button type="button" className={`settings-default-method ${draft.shipping.default_method_id === method.id ? 'is-default' : ''}`} disabled={!method.enabled} onClick={() => patch({ shipping: { ...draft.shipping, default_method_id: method.id } })}>{draft.shipping.default_method_id === method.id ? <><Check size={15} />روش پیش‌فرض checkout</> : 'انتخاب به‌عنوان پیش‌فرض'}</button>
      </article>)}
    </section>
  </main>;

  if (selected === 'sms' && smsManagement) {
    return <SmsSettingsPage value={smsManagement.value} onSave={smsManagement.save} onTestConnection={smsManagement.testConnection} notify={notify} liveMode={liveMode} onBack={back} />;
  }

  if (selected) {
    const isPayment = selected === 'payment';
    return <section className="settings-workspace settings-detail-page">
      <header className="settings-detail-top"><button type="button" className="settings-page-back" onClick={back}><ArrowRight size={18} />بازگشت به تنظیمات</button><span>{liveMode ? 'تنظیمات زنده' : 'محیط بازبینی'}</span></header>
      {isPayment ? paymentEditor() : shippingEditor()}
      {error && <p className="settings-form-error" role="alert">{error}</p>}
      <footer className="settings-page-footer"><button type="button" onClick={back} disabled={saving}>انصراف</button><button type="button" className="primary" disabled={!dirty || saving} onClick={save}><Save size={16} />{saving ? 'در حال ذخیره...' : 'ذخیرهٔ تغییرها'}</button></footer>
    </section>;
  }

  const enabledPaymentCount = enabledPaymentMethods().length;
  return <section className="settings-workspace settings-list-page payment-shipping-list">
    <header className="settings-list-title"><div><span>پنل مدیریت نوین‌نت</span><h1>تنظیمات</h1><p>تنظیمات عملیاتی فروش و پیامک‌های سیستمی را از بخش‌های مستقل مدیریت کنید.</p></div><small>{liveMode ? 'تنظیمات زنده' : 'محیط بازبینی'}</small></header>
    <main className="settings-vertical-list"><section className="settings-list-block"><header><b>فروش و عملیات</b><small>۲ بخش</small></header>
      <button type="button" onClick={() => open('payment')}><i><CreditCard size={21} /></i><span><b>روش‌های دریافت پول</b><small>انتخاب روش‌های پرداخت قابل‌استفاده در checkout</small></span><em>{enabledPaymentCount.toLocaleString('fa-IR')} فعال</em><ChevronLeft size={18} /></button>
      <button type="button" onClick={() => open('shipping')}><i><Truck size={21} /></i><span><b>روش‌های ارسال</b><small>فعال‌سازی روش، هزینهٔ پایه و آستانهٔ ارسال رایگان</small></span><em>{activeMethods.length.toLocaleString('fa-IR')} فعال</em><ChevronLeft size={18} /></button>
    </section>{smsManagement && <section className="settings-list-block"><header><b>ارتباط با مشتری</b><small>۱ بخش</small></header><button type="button" onClick={() => open('sms')}><i><MessageSquareText size={21} /></i><span><b>پیامک‌های سیستمی</b><small>اتصال کاوه‌نگار، OTP و اعلان‌های سفارش و پشتیبانی</small></span><em>{smsManagement.value.enabled ? 'فعال' : 'غیرفعال'}</em><ChevronLeft size={18} /></button></section>}</main>
  </section>;
}
