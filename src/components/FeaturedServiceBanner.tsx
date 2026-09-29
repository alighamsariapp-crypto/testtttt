import React from 'react';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { openHomepageCustomUrl } from '../utils/homepageLinks';
import type { HomepageDestination, HomepageServicesBanner } from '../types';

const fallbackBanner: HomepageServicesBanner = {
  title: 'خدمات آنلاین نوین‌نت؛ سریع و هوشمند',
  description: 'دسترسی آسان به خدمات دولتی و اداری از جمله ثبت‌نام کارت ملی، خدمات شناسنامه، فرم‌های گواهی و استعلامات برخط. با نوین‌نت، کارهای اداری خود را بدون نوبت و در کمترین زمان انجام دهید.',
  image: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&auto=format&fit=crop&q=80',
  primaryActionText: 'مشاهده لیست خدمات', primaryDestination: 'services', secondaryActionText: 'راهنمای ثبت‌نام', secondaryDestination: 'about', isVisible: true,
};

export const FeaturedServiceBanner: React.FC = () => {
  const { setActiveView, appearanceSettings } = useApp();
  const banner = appearanceSettings.servicesBanner ?? fallbackBanner;
  const go = (customUrl: string | undefined, destination: HomepageDestination) => {
    if (openHomepageCustomUrl(customUrl)) return;
    setActiveView(destination);
  };
  if (!banner.isVisible) return null;

  return <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <div className="bg-gradient-to-l from-slate-900 via-blue-950 to-slate-900 rounded-3xl overflow-hidden shadow-xl border border-blue-900/40 grid grid-cols-1 lg:grid-cols-12 items-center">
      <div className="lg:col-span-7 p-6 sm:p-10 text-white space-y-4">
        <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-white leading-tight">{banner.title}</h2>
        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-xl">{banner.description}</p>
        <div className="pt-3 flex flex-wrap items-center gap-3">
          <button id="view-services-list-btn" onClick={() => go(banner.primaryCustomUrl, banner.primaryDestination)} className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-blue-600/30 transition hover:gap-3"><span>{banner.primaryActionText}</span><ArrowLeft className="w-4 h-4" /></button>
          <button id="view-services-guide-btn" onClick={() => go(banner.secondaryCustomUrl, banner.secondaryDestination)} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-slate-200 text-xs sm:text-sm font-medium border border-white/20 transition"><BookOpen className="w-4 h-4" /><span>{banner.secondaryActionText}</span></button>
        </div>
      </div>
      <div className="lg:col-span-5 relative h-64 sm:h-80 lg:h-full min-h-[260px] overflow-hidden">
        {banner.image && <img src={banner.image} alt={banner.title} className="w-full h-full object-cover object-center opacity-85 hover:scale-105 transition-transform duration-700" />}
        <div className="absolute inset-0 bg-gradient-to-t lg:bg-gradient-to-r from-transparent via-blue-950/40 to-slate-900/90" />
      </div>
    </div>
  </div>;
};
