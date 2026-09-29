import React, { useState } from 'react';
import { Type, Check, ArrowRight, Palette, Sliders, ShieldCheck, Sparkles, Hash } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const TypographyTestView: React.FC = () => {
  const { setActiveView } = useApp();
  
  const [selectedFont, setSelectedFont] = useState<'Vazirmatn' | 'Plus Jakarta Sans' | 'System'>('Vazirmatn');
  const [samplePrice, setSamplePrice] = useState(14850000);
  const [sampleDiscount, setSampleDiscount] = useState(15);

  const fontFamilies = [
    { id: 'Vazirmatn', name: 'وزیرمتن (Vazirmatn)', class: 'font-sans' },
    { id: 'Plus Jakarta Sans', name: 'Plus Jakarta Sans', class: 'font-sans' },
    { id: 'System', name: 'سیستم استاندارد (System UI)', class: 'font-mono' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      
      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <button onClick={() => setActiveView('home')} className="hover:text-blue-600">خانه</button>
            <span>/</span>
            <span className="text-slate-700 font-bold">آزمایشگاه و سیستم تایپوگرافی</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 flex items-center gap-2.5">
            <Type className="w-7 h-7 text-blue-600" />
            <span>سیستم تایپوگرافی، فونت و اعداد فارسی</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            بررسی یکپارچگی اندازه‌ها، وزن‌ها، اعداد فارسی، قیمت‌ها و خوانایی در تمامی رزولوشن‌ها
          </p>
        </div>

        <button
          onClick={() => setActiveView('home')}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-md shadow-blue-500/20"
        >
          <span>بازگشت به فروشگاه</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* 1. Font Family Tester Controller */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-blue-600" />
            <span>انتخاب و تست قلم (Font Family)</span>
          </h2>
          <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>استاندارد WCAG AA</span>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {fontFamilies.map(f => (
            <button
              key={f.id}
              onClick={() => setSelectedFont(f.id as any)}
              className={`p-4 rounded-2xl border text-right transition flex items-center justify-between ${
                selectedFont === f.id
                  ? 'border-blue-600 bg-blue-50/50 text-blue-900 ring-2 ring-blue-600/20 font-bold'
                  : 'border-slate-200 hover:bg-slate-50 text-slate-700'
              }`}
            >
              <div>
                <div className="text-sm font-bold">{f.name}</div>
                <div className="text-xs text-slate-400 mt-0.5">Aa ۱۲۳ متن نمونه</div>
              </div>
              {selectedFont === f.id && <Check className="w-5 h-5 text-blue-600" />}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Headings Spectrum (H1 -> H4) */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-6">
        <h2 className="text-sm font-bold text-slate-900 pb-3 border-b border-slate-100 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span>مقیاس عناوین و تیترها (Headings Hierarchy)</span>
        </h2>

        <div className="space-y-6">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
            <div className="text-[11px] font-bold text-blue-600 uppercase">H1 / 32px / ExtraBold (900)</div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              نسل پنجم اینترنت پرسرعت با پوشش سراسری و مودم 5G هوآوی
            </h1>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
            <div className="text-[11px] font-bold text-blue-600 uppercase">H2 / 24px / Bold (700)</div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">
              تجهیزات تخصصی شبکه، روتر و سوئیچ‌های مدیریتی لایه دو
            </h2>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
            <div className="text-[11px] font-bold text-blue-600 uppercase">H3 / 18px / SemiBold (600)</div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900">
              سیم‌کارت‌های دائمی و اعتباری با بسته‌های تخفیف‌دار اینترنت ماهانه
            </h3>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
            <div className="text-[11px] font-bold text-blue-600 uppercase">H4 / 15px / Medium (500)</div>
            <h4 className="text-sm sm:text-base font-semibold text-slate-800">
              راهنمای راه‌اندازی و کانفیگ پروتکل‌های امنیت شبکه
            </h4>
          </div>
        </div>
      </div>

      {/* 3. Persian Numerals vs English Digits & Prices */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Persian Digits & Price Formatting */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Hash className="w-4 h-4 text-emerald-600" />
            <span>ظاهر قیمت‌ها و اعداد فارسی (Persian Numbers & Prices)</span>
          </h2>

          <div className="space-y-4">
            {/* Standard Price */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-600 font-medium">قیمت عادی با ارقام فارسی:</span>
              <div className="text-lg font-black text-slate-900 font-sans">
                {samplePrice.toLocaleString('fa-IR')} <span className="text-xs font-normal text-slate-500">تومان</span>
              </div>
            </div>

            {/* Discounted Price with Pill */}
            <div className="p-4 rounded-2xl bg-red-50/50 border border-red-100 flex items-center justify-between">
              <div>
                <span className="px-2 py-0.5 rounded-lg bg-red-600 text-white text-[10px] font-black">
                  {sampleDiscount}٪ تخفیف
                </span>
                <div className="text-xs text-slate-400 line-through mt-1">
                  {samplePrice.toLocaleString('fa-IR')} تومان
                </div>
              </div>
              <div className="text-xl font-black text-red-600 font-sans">
                {Math.round(samplePrice * (1 - sampleDiscount / 100)).toLocaleString('fa-IR')}{' '}
                <span className="text-xs font-normal text-slate-600">تومان</span>
              </div>
            </div>

            {/* Persian Digits Comparison */}
            <div className="p-4 rounded-2xl bg-blue-50/40 border border-blue-100 space-y-2">
              <div className="text-xs font-bold text-blue-900">مقایسه کاراکترهای عددی:</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded-xl bg-white border border-blue-200">
                  <div className="text-[10px] text-slate-400">فارسی (FA):</div>
                  <div className="text-base font-bold text-slate-800">۰ ۱ ۲ ۳ ۴ ۵ ۶ ۷ ۸ ۹</div>
                </div>
                <div className="p-2 rounded-xl bg-white border border-blue-200">
                  <div className="text-[10px] text-slate-400">انگلیسی (EN):</div>
                  <div className="text-base font-bold text-slate-800">0 1 2 3 4 5 6 7 8 9</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 4. Mixed Persian + English Readability */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Palette className="w-4 h-4 text-indigo-600" />
            <span>متن ترکیبی فارسی و انگلیسی (Bilingual Flow)</span>
          </h2>

          <div className="space-y-3 text-xs sm:text-sm text-slate-700 leading-relaxed">
            <p className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
              مودم روتر <strong className="text-blue-700 font-bold">Huawei 5G CPE Pro 2</strong> با پشتیبانی از فناوری{' '}
              <span className="font-mono px-1.5 py-0.5 rounded bg-slate-200 text-slate-800 text-xs">Wi-Fi 6 Plus</span> سرعت دانلود را تا{' '}
              <strong className="text-slate-900">۳.۶ گیگابیت بر ثانیه</strong> افزایش می‌دهد.
            </p>

            <p className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
              کابل شبکه <strong className="text-blue-700 font-bold">Nexans Cat6 SFTP LSZH</strong> دارای تست فلوک چنل و پرمننت با فرکانس{' '}
              <span className="font-mono px-1.5 py-0.5 rounded bg-slate-200 text-slate-800 text-xs">250MHz</span> تمام مس ۱۰۰٪ با گارانتی تعویض.
            </p>

            <p className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
              شماره پشتیبانی ۲۴ ساعته: <span className="font-bold text-slate-900 font-sans">۰۲۱-۸۸۸۸۹۹۹۹</span> | ایمیل سازمانی:{' '}
              <span className="font-mono text-blue-600">support@noovinnet.ir</span>
            </p>
          </div>
        </div>

      </div>

      {/* 5. Button Variants & Touch Targets */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-4">
        <h2 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100">
          دکمه‌ها و تعاملات (Buttons & Controls)
        </h2>

        <div className="flex flex-wrap items-center gap-3">
          <button className="px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold transition shadow-md shadow-blue-500/20 active:scale-95">
            دکمه اصلی (Primary CTA)
          </button>
          
          <button className="px-6 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold transition shadow-md active:scale-95">
            دکمه تیره (Dark Action)
          </button>

          <button className="px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold transition shadow-md shadow-emerald-500/20 active:scale-95">
            تأیید و پرداخت (Success)
          </button>

          <button className="px-6 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-bold transition active:scale-95">
            دکمه ثانویه (Secondary)
          </button>

          <button className="px-6 py-3 rounded-2xl border border-slate-300 hover:border-slate-400 text-slate-700 text-xs sm:text-sm font-bold transition active:scale-95">
            دکمه خطی (Outline)
          </button>

          <button className="px-6 py-3 rounded-2xl bg-red-50 hover:bg-red-100 text-red-600 text-xs sm:text-sm font-bold transition active:scale-95">
            دکمه حذف (Danger)
          </button>
        </div>
      </div>

    </div>
  );
};
