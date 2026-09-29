import React from 'react';
import { Home, Store, ArrowRight, Compass, ShieldAlert, Laptop, Smartphone, Wifi } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const NotFoundView: React.FC = () => {
  const { setActiveView, navigateToCategory, themeSettings } = useApp();

  return (
    <div className="min-h-[65vh] flex items-center justify-center py-16 px-4">
      <div className="max-w-xl w-full text-center space-y-8 bg-white p-8 sm:p-12 rounded-3xl border border-slate-100 shadow-xl">
        {/* Error Badge & Icon */}
        <div className="relative inline-flex items-center justify-center">
          <div className="w-24 h-24 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 ring-8 ring-rose-50/50">
            <ShieldAlert className="w-12 h-12" />
          </div>
          <span className="absolute -bottom-2 px-3 py-0.5 rounded-full text-xs font-black bg-rose-600 text-white shadow-md">
            ۴۰۴
          </span>
        </div>

        {/* Text Explanations */}
        <div className="space-y-3">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight">
            صفحه مورد نظر پیدا نشد!
          </h1>
          <p className="text-sm text-slate-500 leading-relaxed max-w-md mx-auto">
            آدرس وارد شده ممکن است اشتباه تایپ شده باشد یا این صفحه حذف و یا به آدرس دیگری منتقل شده باشد.
          </p>
        </div>

        {/* Quick Action Navigation Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={() => setActiveView('home')}
            className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 active:scale-95 cursor-pointer"
            style={{ backgroundColor: themeSettings.primary_color }}
          >
            <Home className="w-4 h-4" />
            <span>بازگشت به صفحه اصلی</span>
          </button>

          <button
            onClick={() => navigateToCategory(null, [])}
            className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
          >
            <Store className="w-4 h-4" />
            <span>مشاهده همه محصولات</span>
          </button>
        </div>

        {/* Category Shortcuts */}
        <div className="pt-6 border-t border-slate-100">
          <div className="text-xs font-bold text-slate-400 mb-3 flex items-center justify-center gap-1.5">
            <Compass className="w-3.5 h-3.5" />
            <span>شاید دنبال یکی از این بخش‌ها هستید:</span>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              onClick={() => navigateToCategory('laptops', ['laptops'])}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-blue-50 hover:text-blue-600 text-xs font-semibold text-slate-600 border border-slate-100 transition cursor-pointer"
            >
              <Laptop className="w-3.5 h-3.5 text-blue-500" />
              <span>لپ‌تاپ و تجهیزات</span>
            </button>

            <button
              onClick={() => navigateToCategory('simcard', ['simcard'])}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-blue-50 hover:text-blue-600 text-xs font-semibold text-slate-600 border border-slate-100 transition cursor-pointer"
            >
              <Smartphone className="w-3.5 h-3.5 text-amber-500" />
              <span>سیم‌کارت</span>
            </button>

            <button
              onClick={() => navigateToCategory('modem-internet', ['modem-internet'])}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-blue-50 hover:text-blue-600 text-xs font-semibold text-slate-600 border border-slate-100 transition cursor-pointer"
            >
              <Wifi className="w-3.5 h-3.5 text-cyan-500" />
              <span>مودم و اینترنت</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
