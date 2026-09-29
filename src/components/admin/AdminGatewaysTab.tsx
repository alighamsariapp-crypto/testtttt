import React, { useState } from 'react';
import { CreditCard, CheckCircle2, Shield, Settings, ToggleLeft, ToggleRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const AdminGatewaysTab: React.FC = () => {
  const { showToast } = useApp();
  const [gateways, setGateways] = useState([
    { id: 'zarinpal', name: 'زرین‌پال (Zarinpal)', active: true, merchantId: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', mode: 'درگاه مستقیم' },
    { id: 'mellat', name: 'به پرداخت ملت (Beh Pardakht)', active: false, merchantId: '12345678', mode: 'توسعه‌دهنده' },
    { id: 'saman', name: 'سامان کیش (Sep)', active: true, merchantId: '987654321', mode: 'درگاه مستقیم' }
  ]);

  const toggleGateway = (id: string) => {
    setGateways(gateways.map(g => {
      if (g.id === id) {
        const nextState = !g.active;
        showToast(`وضعیت درگاه ${g.name} به ${nextState ? 'فعال' : 'غیرفعال'} تغییر یافت.`, 'success');
        return { ...g, active: nextState };
      }
      return g;
    }));
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Top Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-blue-600" />
            <span>مدیریت درگاه‌های پرداخت بانکی</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">تنظیمات کلیدهای اتصال به درگاه‌های پرداخت و کیف پول الکترونیک</p>
        </div>
      </div>

      {/* Gateways Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {gateways.map(g => (
          <div key={g.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <CreditCard className="w-5 h-5" />
                </div>
                <button
                  onClick={() => toggleGateway(g.id)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition ${
                    g.active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${g.active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                  <span>{g.active ? 'فعال' : 'غیرفعال'}</span>
                </button>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-900">{g.name}</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">{g.mode}</p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">مرچنت کد / توکن امنیتی</label>
                <input
                  type="text"
                  readOnly
                  value={g.merchantId}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-600 focus:outline-none"
                />
              </div>
            </div>

            <button
              onClick={() => showToast(`تنظیمات درگاه ${g.name} ذخیره شد.`, 'success')}
              className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-600 text-xs font-bold transition flex items-center justify-center gap-2"
            >
              <Settings className="w-4 h-4" />
              <span>ویرایش تنظیمات</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
