import React, { useState } from 'react';
import { Type, Check, ArrowRight, Palette, Sliders, ShieldCheck, Sparkles, Hash, ShoppingBag, Tag } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const TypographyTestView: React.FC = () => {
  const { setActiveView } = useApp();
  
  const [selectedWeight, setSelectedWeight] = useState<'all' | '400' | '500' | '600' | '700' | '800'>('all');
  const [samplePrice] = useState(14850000);
  const [sampleDiscount] = useState(15);

  const vazirmatnWeights = [
    { weight: '400', label: 'عادی (Regular 400)', role: 'متن بدنه، توضیحات، نظرات', sample: 'پشتیبانی از فناوری شبکه بی‌سیم نسل پنجم' },
    { weight: '500', label: 'متوسط (Medium 500)', role: 'فراداده، برچسب‌ها، تاریخ و زیرعنوان‌ها', sample: 'ارسال فوری تهران • گارانتی ۲۴ ماهه نوین‌نت' },
    { weight: '600', label: 'نیمه‌برجسته (SemiBold 600)', role: 'عناوین کارت محصول، دکمه‌ها، نشان‌ها', sample: 'مودم روتر بی‌سیم هوآوی مدل 5G CPE Pro 2' },
    { weight: '700', label: 'برجسته (Bold 700)', role: 'عناوین اصلی، تیتر بخش‌ها، قیمت‌ها', sample: 'فروشگاه تخصصی تجهیزات ارتباطی و اینترنت پرسرعت' },
    { weight: '800', label: 'فوق‌برجسته (ExtraBold 800)', role: 'تأکید ویژه تخفیف و بنرهای شاخص', sample: 'تخفیف شگفت‌انگیز پاییزه نوین‌نت' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      
      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 ui-text-meta text-slate-500 mb-1">
            <button onClick={() => setActiveView('home')} className="hover:text-blue-600 transition-colors">خانه</button>
            <span>/</span>
            <span className="text-slate-800 font-semibold">سیستم و آزمایشگاه تایپوگرافی</span>
          </nav>
          <h1 className="ui-text-page-title text-slate-900 flex items-center gap-2.5">
            <Type className="w-6 h-6 text-blue-600" />
            <span>سیستم تایپوگرافی، مقیاس و اعداد فارسی (Vazirmatn)</span>
          </h1>
          <p className="ui-text-meta text-slate-500 mt-1">
            مقیاس یکپارچه تایپوگرافی فروشگاهی مطابق استاندارد‌های دیجی‌کالا و وب فارسی: خوانا، منضبط، بدون فونت‌های مونو/سنس تصادفی
          </p>
        </div>

        <button
          onClick={() => setActiveView('home')}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white ui-text-button transition shadow-xs"
        >
          <span>بازگشت به فروشگاه</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* 1. Official Storefront Font: Vazirmatn Weight Scale */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="ui-text-section-title text-slate-900 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-blue-600" />
              <span>خانواده قلم رسمی فروشگاه: وزیرمتن (Vazirmatn)</span>
            </h2>
            <p className="ui-text-meta text-slate-500 mt-0.5">
              فونت رسمی و واحد کل برنامه با بارگذاری محلی فرمت مدرن WOFF2 و پشتیبانی کامل اعداد و ارقام فارسی
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 ui-text-badge self-start sm:self-auto">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>استاندارد خوانایی WCAG AA</span>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
          {vazirmatnWeights.map(w => (
            <div 
              key={w.weight}
              className={`p-4 rounded-xl border transition ${
                selectedWeight === w.weight || selectedWeight === 'all'
                  ? 'border-blue-200 bg-blue-50/20'
                  : 'border-slate-100 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="ui-text-badge text-blue-700 bg-blue-100/60 px-2 py-0.5 rounded-md">
                  {w.label}
                </span>
                <span className="ui-text-meta text-slate-400">وزن {w.weight}</span>
              </div>
              <p className="ui-text-meta text-slate-500 mb-2">{w.role}</p>
              <p className="ui-text-body text-slate-900" style={{ fontWeight: Number(w.weight) }}>
                {w.sample}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Headings Spectrum (H1 -> H4) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-6">
        <h2 className="ui-text-section-title text-slate-900 pb-3 border-b border-slate-100 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-500" />
          <span>سلسله‌مراتب عناوین و تیترها (Headings Hierarchy)</span>
        </h2>

        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
            <div className="ui-text-badge text-blue-600">عنوان صفحه / Page Title (Desktop: 26px / Mobile: 22px / Bold 700)</div>
            <h1 className="ui-text-page-title text-slate-900">
              نسل پنجم اینترنت پرسرعت با پوشش سراسری و مودم 5G هوآوی
            </h1>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
            <div className="ui-text-badge text-blue-600">عنوان بخش / Section Title (Desktop: 20px / Mobile: 18px / Bold 700)</div>
            <h2 className="ui-text-section-title text-slate-900">
              تجهیزات تخصصی شبکه، روتر و سوئیچ‌های مدیریتی لایه دو
            </h2>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
            <div className="ui-text-badge text-blue-600">عنوان کارت محصول / Product Card Title (14–15px / SemiBold 600 / LineHeight 1.55)</div>
            <h3 className="ui-text-card-title text-slate-900">
              مودم روتر بی‌سیم ۴ آنتنه هوآوی مدل B612 نسخه آنلاک با پشتیبانی از سیم‌کارت TD-LTE
            </h3>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
            <div className="ui-text-badge text-blue-600">متن بدنه و توضیحات / Body Text (14–15px / Regular 400 / LineHeight 1.8)</div>
            <p className="ui-text-body text-slate-700">
              این روتر دارای درگاه‌های گیگابیتی و وای‌فای دوبانده با استانداردهای رمزگذاری WPA3 است که امنیت و پایداری کامل را برای شبکه‌های اداری و خانگی تضمین می‌کند.
            </p>
          </div>
        </div>
      </div>

      {/* 3. Persian Numerals vs English Digits & Prices */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Persian Digits & Price Formatting */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
          <h2 className="ui-text-section-title text-slate-900 flex items-center gap-2">
            <Hash className="w-5 h-5 text-emerald-600" />
            <span>تایپوگرافی قیمت‌ها و اعداد فارسی (Persian Prices & Digits)</span>
          </h2>

          <div className="space-y-4">
            {/* Card Price */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
              <div>
                <span className="ui-text-meta text-slate-600 block">قیمت کارت کالا (`ui-price`):</span>
                <span className="ui-text-meta text-slate-400">۱۶–۱۸ پیکسل / وزن ۷۰۰ با ارقام تراز</span>
              </div>
              <div className="ui-price text-slate-900 flex items-baseline gap-1">
                <span>{samplePrice.toLocaleString('fa-IR')}</span>
                <span className="ui-text-meta font-normal text-slate-500">تومان</span>
              </div>
            </div>

            {/* Hero / Detail Price with Discount */}
            <div className="p-4 rounded-xl bg-red-50/50 border border-red-100 flex items-center justify-between">
              <div>
                <span className="inline-block px-2 py-0.5 rounded-md bg-red-600 text-white ui-text-badge mb-1">
                  {sampleDiscount}٪ تخفیف
                </span>
                <div className="ui-text-meta text-slate-400 line-through">
                  {samplePrice.toLocaleString('fa-IR')} تومان
                </div>
              </div>
              <div className="ui-price-hero text-red-600 flex items-baseline gap-1">
                <span>{Math.round(samplePrice * (1 - sampleDiscount / 100)).toLocaleString('fa-IR')}</span>
                <span className="ui-text-meta font-normal text-slate-600">تومان</span>
              </div>
            </div>

            {/* Persian Digits Comparison */}
            <div className="p-4 rounded-xl bg-blue-50/40 border border-blue-100 space-y-2">
              <div className="ui-text-meta font-semibold text-blue-900">تراز ارقام فارسی و انگلیسی در قلم وزیرمتن:</div>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 rounded-lg bg-white border border-blue-200">
                  <div className="ui-text-meta text-slate-400 mb-0.5">ارقام فارسی (FA):</div>
                  <div className="ui-text-body font-bold text-slate-900 ui-numeric">۰ ۱ ۲ ۳ ۴ ۵ ۶ ۷ ۸ ۹</div>
                </div>
                <div className="p-2.5 rounded-lg bg-white border border-blue-200">
                  <div className="ui-text-meta text-slate-400 mb-0.5">ارقام لاتین (EN):</div>
                  <div className="ui-text-body font-bold text-slate-900 ui-numeric">0 1 2 3 4 5 6 7 8 9</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 4. Mixed Persian + English Readability */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
          <h2 className="ui-text-section-title text-slate-900 flex items-center gap-2">
            <Palette className="w-5 h-5 text-indigo-600" />
            <span>جریان متن دوزبانه (Persian + English Flow)</span>
          </h2>

          <div className="space-y-3 ui-text-body text-slate-700">
            <p className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
              مودم روتر <strong className="text-blue-700 font-semibold">Huawei 5G CPE Pro 2</strong> با پشتیبانی از فناوری{' '}
              <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-800 ui-text-badge font-semibold">Wi-Fi 6 Plus</span> سرعت دانلود را تا{' '}
              <strong className="text-slate-900 font-semibold">۳.۶ گیگابیت بر ثانیه</strong> افزایش می‌دهد.
            </p>

            <p className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
              کابل شبکه <strong className="text-blue-700 font-semibold">Nexans Cat6 SFTP LSZH</strong> دارای تست فلوک چنل و پرمننت با فرکانس{' '}
              <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-800 ui-text-badge font-semibold">250MHz</span> تمام مس ۱۰۰٪ با گارانتی تعویض.
            </p>

            <p className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
              شماره پشتیبانی ۲۴ ساعته: <span className="font-semibold text-slate-900 ui-numeric">۰۲۱-۸۸۸۸۹۹۹۹</span> | ایمیل سازمانی:{' '}
              <span className="text-blue-600 font-medium">support@noovinnet.ir</span>
            </p>
          </div>
        </div>

      </div>

      {/* 5. Button Variants & Semantic Labels */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
        <h2 className="ui-text-section-title text-slate-900 pb-2 border-b border-slate-100">
          دکمه‌ها و تعاملات فروشگاهی (Buttons & Controls Typography)
        </h2>

        <div className="flex flex-wrap items-center gap-3">
          <button className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white ui-text-button transition shadow-xs active:scale-95">
            دکمه اصلی (Primary CTA)
          </button>
          
          <button className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white ui-text-button transition shadow-xs active:scale-95">
            دکمه تیره (Dark Action)
          </button>

          <button className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white ui-text-button transition shadow-xs active:scale-95">
            تأیید و پرداخت (Success)
          </button>

          <button className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 ui-text-button transition active:scale-95">
            دکمه ثانویه (Secondary)
          </button>

          <button className="px-5 py-2.5 rounded-xl border border-slate-300 hover:border-slate-400 text-slate-700 ui-text-button transition active:scale-95">
            دکمه خطی (Outline)
          </button>

          <button className="px-5 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 ui-text-button transition active:scale-95">
            دکمه حذف (Danger)
          </button>
        </div>
      </div>

    </div>
  );
};
