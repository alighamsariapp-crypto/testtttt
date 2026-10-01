import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { openHomepageCustomUrl } from '../utils/homepageLinks';
import type { HomepageDestination, HomepageSideBanner } from '../types';

const legacySidePromos = (settings: ReturnType<typeof useApp>['appearanceSettings']): HomepageSideBanner[] => [
  { id: 'side-1', title: settings.sidePromo1Title, subtitle: settings.sidePromo1Subtitle, image: settings.sidePromo1Image, tag: settings.sidePromo1Tag, actionText: 'مشاهده', category: 'simcard', destination: 'store', isVisible: true },
  { id: 'side-2', title: settings.sidePromo2Title, subtitle: settings.sidePromo2Subtitle, image: settings.sidePromo2Image, tag: settings.sidePromo2Tag, actionText: 'مشاهده', category: 'modem-internet', destination: 'store', isVisible: true },
];

export const HeroSection: React.FC = () => {
  const { setActiveView, setSelectedCategorySlug, appearanceSettings } = useApp();
  const [currentSlide, setCurrentSlide] = useState(0);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const slides = useMemo(() => (appearanceSettings.heroSlides ?? []).filter((slide) => slide.isVisible !== false), [appearanceSettings.heroSlides]);
  const sidePromos = useMemo(() => (appearanceSettings.sidePromos !== undefined ? appearanceSettings.sidePromos : legacySidePromos(appearanceSettings)).filter((promo) => promo.isVisible), [appearanceSettings]);

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = window.setInterval(() => setCurrentSlide((previous) => (previous + 1) % slides.length), 6000);
    return () => window.clearInterval(timer);
  }, [slides.length]);

  const changeSlide = (direction: -1 | 1) => {
    if (slides.length < 2) return;
    setCurrentSlide((previous) => (previous + direction + slides.length) % slides.length);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse') return;
    swipeStartRef.current = { x: event.clientX, y: event.clientY };
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start || event.pointerType === 'mouse') return;
    const horizontalDistance = event.clientX - start.x;
    const verticalDistance = event.clientY - start.y;
    if (Math.abs(horizontalDistance) < 42 || Math.abs(horizontalDistance) <= Math.abs(verticalDistance)) return;
    changeSlide(horizontalDistance < 0 ? 1 : -1);
  };

  const openDestination = (customUrl: string | undefined, destination: HomepageDestination | undefined, category: string) => {
    if (openHomepageCustomUrl(customUrl)) return;
    if (!destination || destination === 'store') {
      setSelectedCategorySlug(category || null);
      setActiveView('store');
      return;
    }
    setActiveView(destination);
  };

  const activeSlide = slides[currentSlide] || slides[0];
  if (!activeSlide && sidePromos.length === 0) return null;

  return <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-6">
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-6">
      {activeSlide && <div className="lg:col-span-8 relative rounded-2xl sm:rounded-3xl overflow-hidden h-[200px] sm:h-[320px] lg:h-[380px] bg-slate-950 shadow-lg flex flex-col justify-end p-4 sm:p-8 text-white group touch-pan-y" role="region" aria-roledescription="carousel" aria-label="اسلایدر پیشنهادهای نوین‌نت" onPointerDown={handlePointerDown} onPointerUp={handlePointerUp} onPointerCancel={() => { swipeStartRef.current = null; }}>

        <div className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105" style={{ backgroundImage: `url(${activeSlide.image})` }} />
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundColor: activeSlide.overlayColor || '#0F172A', opacity: Math.min(100, Math.max(0, activeSlide.overlayOpacity ?? 72)) / 100 }} />
        <div className="relative z-10 space-y-1.5 sm:space-y-3 max-w-lg">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/30 text-blue-200 ui-text-badge font-semibold backdrop-blur-md border border-blue-400/30"><Sparkles className="w-3.5 h-3.5 text-blue-300" /><span>{activeSlide.badge || 'پیشنهاد ویژه نوین‌نت'}</span></div>
          <h1 className="text-lg sm:text-2xl lg:text-3xl font-bold leading-tight tracking-tight text-white line-clamp-1 sm:line-clamp-2">{activeSlide.title}</h1>
          <p className="ui-text-meta sm:ui-text-body text-slate-200 line-clamp-1 leading-relaxed">{activeSlide.subtitle}</p>
          <div className="pt-1"><button id="hero-main-cta-btn" onClick={() => openDestination(activeSlide.customUrl, activeSlide.destination, activeSlide.category)} className="inline-flex items-center gap-1.5 px-4 sm:px-6 py-2 sm:py-2.5 rounded-full bg-white text-blue-900 ui-text-button font-semibold shadow-lg hover:bg-blue-50 active:scale-95 transition-all"><span>{activeSlide.actionText}</span><ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></button></div>
        </div>
        {slides.length > 1 && <div className="absolute bottom-3 left-4 sm:bottom-4 sm:left-6 z-10 flex items-center gap-1.5">{slides.map((slide, index) => <button key={slide.id} onClick={() => setCurrentSlide(index)} className={`h-1.5 sm:h-2 rounded-full transition-all ${currentSlide === index ? 'w-5 sm:w-6 bg-white' : 'w-1.5 sm:w-2 bg-white/40'}`} aria-label={`اسلاید ${index + 1}`} />)}</div>}
      </div>}
      {sidePromos.length > 0 && <div className="hidden lg:flex lg:col-span-4 flex-col gap-4">{sidePromos.map((promo, index) => <div className="flex-1 relative rounded-3xl overflow-hidden p-5 text-white shadow-md flex flex-col justify-between group bg-slate-950" key={promo.id}>
        {promo.image && <div className="absolute inset-0 bg-cover bg-center group-hover:scale-105 transition-transform duration-500" style={{ backgroundImage: `url(${promo.image})` }} />}
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundColor: promo.overlayColor || (index % 2 === 0 ? '#1D4ED8' : '#0F172A'), opacity: Math.min(100, Math.max(0, promo.overlayOpacity ?? 68)) / 100 }} />
        <div className="relative z-10 space-y-1"><span className="ui-text-badge font-semibold uppercase text-white/90">{promo.tag}</span><h3 className="ui-text-card-title sm:text-base font-semibold">{promo.title}</h3><p className="ui-text-meta text-white/80">{promo.subtitle}</p></div>
        <div className="relative z-10"><button onClick={() => openDestination(promo.customUrl, promo.destination, promo.category)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white text-slate-900 ui-text-button font-semibold active:scale-95 transition-all shadow hover:bg-slate-100"><span>{promo.actionText || 'مشاهده'}</span><ArrowLeft className="w-3.5 h-3.5" /></button></div>
      </div>)}</div>}
    </div>
  </div>;
};
