import React, { useState } from 'react';
import { MessageSquare, CheckCircle2, Save, Send } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const AdminSmsTab: React.FC = () => {
  const { showToast } = useApp();
  const [provider, setProvider] = useState('kavenegar');
  const [apiKey, setApiKey] = useState('983457923485792348759234');
  const [senderNumber, setSenderNumber] = useState('30005050');
  const [templates, setTemplates] = useState([
    { id: 1, title: 'کد تایید ورود (OTP)', pattern: 'کد تایید شما در نوین‌نت: {code}', active: true },
    { id: 2, title: 'اطلاع‌رسانی ثبت سفارش', pattern: 'سفارش شما با شماره {order_id} با موفقیت ثبت شد.', active: true },
    { id: 3, title: 'تغییر وضعیت ارسال', pattern: 'مشتری گرامی، سفارش شما به پست تحویل داده شد. کد رهگیری: {tracking_code}', active: true }
  ]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    showToast('تنظیمات سامانه پیامک با موفقیت ذخیره شد.', 'success');
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Top Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-blue-600" />
            <span>سامانه پیامک و الگوهای ارسالی (SMS)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">مدیریت وب‌سرویس پیامکی، الگوهای کد تایید و اطلاع‌رسانی سفارشات</p>
        </div>
        <button
          onClick={handleSave}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/20 transition active:scale-95"
        >
          <Save className="w-4 h-4" />
          <span>ذخیره تغییرات</span>
        </button>
      </div>

      {/* Gateway API Configuration */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">اطلاعات پنل پیامک</h3>
        <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">ارائه‌دهنده سرویس</label>
            <select
              value={provider}
              onChange={e => setProvider(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600 transition"
            >
              <option value="kavenegar">کاوه‌نگار (Kavenegar)</option>
              <option value="ippanel">ای‌پی‌پنل (IPPanel)</option>
              <option value="mellipty">ملی‌پيامک (MelliPayamak)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">کلید دسترسی (API Key)</label>
            <input
              type="text"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-600 transition"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">شماره ارسال‌کننده</label>
            <input
              type="text"
              value={senderNumber}
              onChange={e => setSenderNumber(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-600 transition"
            />
          </div>
        </form>
      </div>

      {/* SMS Patterns List */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">الگوهای پیامکی فعال</h3>
        <div className="space-y-3">
          {templates.map(t => (
            <div key={t.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900">{t.title}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">فعال</span>
                </div>
                <p className="text-xs font-mono text-slate-600 bg-white px-3 py-2 rounded-lg border border-slate-200">{t.pattern}</p>
              </div>
              <button
                onClick={() => showToast(`تست ارسال الگو: ${t.title}`, 'info')}
                className="self-start sm:self-center px-3.5 py-2 rounded-xl bg-slate-200 hover:bg-blue-600 hover:text-white text-slate-700 text-xs font-bold transition flex items-center gap-1.5 shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                <span>ارسال تست</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
