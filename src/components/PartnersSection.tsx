import React, { useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { openHomepageCustomUrl } from '../utils/homepageLinks';
import type { HomepagePartner } from '../types';

const fallbackPartners: HomepagePartner[] = [
  { id: 'mci', name: 'همراه اول', logoText: 'MCI', subtitle: 'بزرگترین اپراتور کشور', category: '', isVisible: true },
  { id: 'irancell', name: 'ایرانسل', logoText: 'Irancell', subtitle: 'پیشرو در خدمات 5G', category: '', isVisible: true },
  { id: 'rightel', name: 'رایتل', logoText: 'RighTel', subtitle: 'پیشگام دیتای همراه', category: '', isVisible: true },
  { id: 'shatel', name: 'شاتل', logoText: 'Shatel', subtitle: 'اینترنت ثابت و فیبر نوری', category: '', isVisible: true },
  { id: 'huawei', name: 'هوآوی', logoText: 'Huawei', subtitle: 'مودم و تجهیزات شبکه', category: '', isVisible: true },
  { id: 'tplink', name: 'تی‌پی‌لینک', logoText: 'TP-Link', subtitle: 'تجهیزات وایرلس خانگی', category: '', isVisible: true },
  { id: 'mikrotik', name: 'میکروتیک', logoText: 'MikroTik', subtitle: 'تجهیزات مدیریت شبکه', category: '', isVisible: true },
  { id: 'cisco', name: 'سیسکو', logoText: 'Cisco', subtitle: 'زیرساخت سازمانی', category: '', isVisible: true },
];

export const PartnersSection: React.FC = () => {
  const { setSelectedCategorySlug, setActiveView, appearanceSettings } = useApp();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const partners = useMemo(() => (appearanceSettings.partners !== undefined ? appearanceSettings.partners : fallbackPartners).filter((partner) => partner.isVisible), [appearanceSettings.partners]);

  const handleMouseDown = (event: React.MouseEvent) => { if (!scrollRef.current) return; setIsDragging(true); setStartX(event.pageX - scrollRef.current.offsetLeft); setScrollLeft(scrollRef.current.scrollLeft); };
  const handleMouseMove = (event: React.MouseEvent) => { if (!isDragging || !scrollRef.current) return; event.preventDefault(); const x = event.pageX - scrollRef.current.offsetLeft; scrollRef.current.scrollLeft = scrollLeft - ((x - startX) * 1.5); };
  const openPartner = (partner: HomepagePartner) => { if (isDragging) return; if (openHomepageCustomUrl(partner.customUrl)) return; setSelectedCategorySlug(partner.category || null); setActiveView('store'); };
  if (!partners.length) return null;

  return <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <div className="flex items-center justify-between mb-5"><div><h2 className="text-base sm:text-lg font-black text-slate-900">همکاران و برندهای برتر</h2><p className="text-xs text-slate-400 mt-0.5">همکاری مستقیم با برترین اپراتورها و تولیدکنندگان تجهیزات مخابراتی</p></div><span className="text-[11px] font-bold text-slate-400 hidden sm:inline">← برای پیمایش بکشید یا ورق بزنید →</span></div>
    <div ref={scrollRef} onMouseDown={handleMouseDown} onMouseLeave={() => setIsDragging(false)} onMouseUp={() => setIsDragging(false)} onMouseMove={handleMouseMove} className={`flex items-center gap-3.5 overflow-x-auto pb-4 pt-1 select-none scrollbar-none cursor-grab ${isDragging ? 'cursor-grabbing' : ''}`} style={{ scrollBehavior: isDragging ? 'auto' : 'smooth' }}>
      {partners.map((partner) => <button type="button" key={partner.id} onClick={() => openPartner(partner)} className="min-w-[150px] sm:min-w-[170px] p-4 bg-white border border-slate-100/90 rounded-2xl flex flex-col items-center justify-center text-center hover:border-blue-200 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer shrink-0 group">
        <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mb-2 group-hover:bg-blue-50/50 transition overflow-hidden">{partner.logoImage ? <img src={partner.logoImage} alt={partner.name} className="w-full h-full object-contain p-1" /> : <span className="text-base sm:text-lg font-black tracking-tight text-blue-700 group-hover:scale-110 transition-transform">{partner.logoText}</span>}</div>
        <span className="text-xs font-bold text-slate-800 group-hover:text-blue-600 transition">{partner.name}</span><span className="text-[10px] text-slate-400 mt-0.5">{partner.subtitle}</span>
      </button>)}
    </div>
  </div>;
};
