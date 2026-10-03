import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, KeyRound, LoaderCircle, MessageSquareText, RefreshCw, Save, ShieldCheck } from 'lucide-react';
import type { SmsConnectionInfo, SmsSystemConfiguration, SmsSystemEvent } from '../../../types';
import './sms-settings-page.css';

type Props = {
  value: SmsSystemConfiguration;
  onSave: (value: SmsSystemConfiguration) => Promise<void>;
  onTestConnection: () => Promise<SmsConnectionInfo>;
  notify: (message: string) => void;
  liveMode: boolean;
  onBack: () => void;
};

const events: SmsSystemEvent[] = ['otp', 'password_reset', 'order_paid', 'order_shipped', 'ticket_reply'];

function Toggle({ checked, label, hint, onChange, disabled = false }: { checked: boolean; label: string; hint: string; onChange: () => void; disabled?: boolean }) {
  return <button type="button" className={`settings-switch-field ${checked ? 'is-on' : ''}`} onClick={onChange} disabled={disabled} aria-pressed={checked}>
    <span><b>{label}</b><small>{hint}</small></span><i><em /></i>
  </button>;
}

export function SmsSettingsPage({ value, onSave, onTestConnection, notify, liveMode, onBack }: Props) {
  const [draft, setDraft] = useState<SmsSystemConfiguration>(value);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connection, setConnection] = useState<SmsConnectionInfo | null>(null);
  const dirty = useMemo(() => JSON.stringify({ ...draft, api_key: draft.api_key || '' }) !== JSON.stringify({ ...value, api_key: value.api_key || '' }), [draft, value]);

  useEffect(() => setDraft(value), [value]);

  const patch = (next: Partial<SmsSystemConfiguration>) => {
    setDraft((current) => ({ ...current, ...next }));
    setError('');
  };

  const patchTemplate = (event: SmsSystemEvent, updates: Partial<SmsSystemConfiguration['templates'][SmsSystemEvent]>) => {
    patch({ templates: { ...draft.templates, [event]: { ...draft.templates[event], ...updates } } });
  };

  const validate = (): string | null => {
    if (!draft.enabled) return null;
    if (!draft.api_key_configured && !draft.api_key.trim()) return 'برای فعال‌سازی، API Key کاوه‌نگار را وارد کنید.';
    if (!draft.sender.trim()) return 'برای فعال‌سازی، خط ارسال‌کنندهٔ تأییدشده را وارد کنید.';
    if (!draft.templates.otp.enabled) return 'برای ورود با شماره موبایل، پیامک OTP باید فعال بماند.';
    if (events.some((event) => draft.templates[event].enabled && !draft.templates[event].text.trim())) return 'متن هیچ‌یک از اعلان‌های فعال نباید خالی باشد.';
    return null;
  };

  const save = async () => {
    const validation = validate();
    if (validation) {
      setError(validation);
      return;
    }
    setSaving(true);
    try {
      await onSave(draft);
      setDraft((current) => ({ ...current, api_key: '', clear_api_key: false, api_key_configured: current.api_key_configured || Boolean(current.api_key.trim()) }));
      notify(liveMode ? 'تنظیمات کاوه‌نگار با موفقیت ذخیره شد.' : 'تنظیمات پیامک در محیط بازبینی ذخیره شد.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'ذخیرهٔ تنظیمات پیامکی انجام نشد.');
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    setError('');
    try {
      const result = await onTestConnection();
      setConnection(result);
      notify('اتصال کاوه‌نگار بدون ارسال پیامک بررسی شد.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'بررسی اتصال کاوه‌نگار انجام نشد.');
    } finally {
      setTesting(false);
    }
  };

  return <section className="settings-workspace settings-detail-page sms-settings-page">
    <header className="settings-detail-top"><button type="button" className="settings-page-back" onClick={onBack}><ArrowRight size={18} />بازگشت به تنظیمات</button><span>{liveMode ? 'تنظیمات زنده' : 'محیط بازبینی'}</span></header>
    <main className="settings-page-main payment-shipping-editor">
      <div className="settings-page-title"><div className="settings-page-icon"><MessageSquareText size={22} /></div><div><h1>پیامک‌های سیستمی</h1><p>کاوه‌نگار، ورود با موبایل و اعلان‌های مهم فروشگاه را به‌صورت جداگانه مدیریت کنید.</p></div></div>
      <div className="settings-page-note"><ShieldCheck size={15} />API Key رمزگذاری‌شده ذخیره می‌شود، پس از ذخیره دوباره نمایش داده نمی‌شود و هرگز در API مشتری یا GitHub قرار نمی‌گیرد. این بخش برای پیامک‌های سیستمی است؛ کمپین تبلیغاتی جدا خواهد بود.</div>

      <section className="settings-toggle-stack payment-shipping-toggles">
        <Toggle checked={draft.enabled} label="فعال‌سازی ارسال پیامک" hint="تا زمانی که این گزینه خاموش باشد، هیچ OTP یا اعلان سیستمی ارسال نمی‌شود." onChange={() => patch({ enabled: !draft.enabled })} />
      </section>

      <section className="settings-custom-card sms-credential-card">
        <b><KeyRound size={17} /> اتصال کاوه‌نگار</b>
        <small>ابتدا کلید API و یک خط تأییدشدهٔ کاوه‌نگار را وارد کنید. دکمهٔ تست فقط اعتبار حساب را می‌خواند و پیامک نمی‌فرستد.</small>
        <div className="sms-settings-grid">
          <label className="settings-page-field"><span>API Key کاوه‌نگار</span><input dir="ltr" type="password" autoComplete="new-password" value={draft.api_key ?? ''} onChange={(event) => patch({ api_key: event.target.value.trim(), clear_api_key: false })} placeholder={draft.api_key_configured ? 'کلید قبلی محفوظ است؛ فقط برای جایگزینی کلید جدید وارد کنید' : 'API Key'} /><small>{draft.api_key_configured ? 'کلید ذخیره‌شده فعال است.' : 'هنوز کلیدی ذخیره نشده است.'}</small></label>
          <label className="settings-page-field"><span>خط ارسال‌کننده</span><input dir="ltr" inputMode="numeric" value={draft.sender ?? ''} onChange={(event) => patch({ sender: event.target.value.replace(/[^+0-9]/g, '') })} placeholder="مثال: 1000xxxx" /><small>یک خط فعال و تأییدشده در کاوه‌نگار وارد کنید.</small></label>
          <label className="settings-page-field"><span>نام الگوی کد امنیتی در کاوه‌نگار</span><input dir="ltr" value={draft.otp_template ?? ''} onChange={(event) => patch({ otp_template: event.target.value.replace(/[^A-Za-z0-9_-]/g, '') })} placeholder="اختیاری؛ مثال: noovinnetcode" /><small>اگر الگوی Lookup دارید، همان الگو برای ورود با شماره و بازیابی رمز استفاده می‌شود. متن الگو باید عمومی باشد؛ مانند «کد امنیتی نوین‌نت: %token».</small></label>
        </div>
        {draft.api_key_configured && <label className="sms-clear-key"><input type="checkbox" checked={Boolean(draft.clear_api_key)} onChange={(event) => patch({ clear_api_key: event.target.checked, api_key: event.target.checked ? '' : draft.api_key })} />حذف API Key ذخیره‌شده در ذخیره‌سازی بعدی</label>}
        <div className="sms-connection-row"><button type="button" onClick={test} disabled={testing || !draft.api_key_configured}><RefreshCw size={16} className={testing ? 'is-spinning' : ''} />{testing ? 'در حال بررسی...' : 'تست اتصال بدون SMS'}</button>{connection && <span><CheckCircle2 size={16} />اتصال تأیید شد · اعتبار: {(connection.remaining_credit ?? 0).toLocaleString('fa-IR')} ریال</span>}</div>
      </section>

      <section className="sms-template-section"><header><div><b>رویدادهای پیامکی</b><small>هر اعلان مستقل است. فعال‌سازی آن فقط بعد از ذخیرهٔ تنظیمات و روشن‌بودن کل سیستم اثر می‌گذارد.</small></div></header><div className="sms-template-list">{events.map((event) => <article key={event} className={draft.templates[event].enabled ? 'is-enabled' : ''}><Toggle checked={draft.templates[event].enabled} label={draft.templates[event].label} hint={event === 'otp' ? 'کد ورود و تأیید شمارهٔ موبایل' : event === 'password_reset' ? 'کد بازیابی رمز؛ در صورت ثبت Lookup از همان الگوی کد امنیتی استفاده می‌کند' : event === 'order_paid' ? 'فقط بعد از تأیید پرداخت سفارش' : event === 'order_shipped' ? 'فقط وقتی وضعیت سفارش به ارسال‌شده تغییر کند' : 'فقط هنگام اولین پاسخ پشتیبانی'} onChange={() => patchTemplate(event, { enabled: !draft.templates[event].enabled })} /><label className="settings-page-field"><span>متن پیامک</span><textarea value={draft.templates[event]?.text ?? ''} onChange={(change) => patchTemplate(event, { text: change.target.value.slice(0, 900) })} rows={event === 'otp' || event === 'password_reset' ? 2 : 3} /><small>{event === 'otp' || event === 'password_reset' ? 'متغیر قابل‌استفاده: {code}' : event === 'order_paid' ? 'متغیرها: {name}، {order_number}، {amount}' : event === 'order_shipped' ? 'متغیرها: {name}، {order_number}، {tracking_suffix}' : 'متغیرها: {name}، {ticket_number}'}</small></label></article>)}</div></section>
    </main>
    {error && <p className="settings-form-error" role="alert">{error}</p>}
    <footer className="settings-page-footer"><button type="button" onClick={onBack} disabled={saving}>انصراف</button><button type="button" className="primary" disabled={!dirty || saving} onClick={save}><Save size={16} />{saving ? 'در حال ذخیره...' : 'ذخیرهٔ تغییرها'}</button></footer>
  </section>;
}
