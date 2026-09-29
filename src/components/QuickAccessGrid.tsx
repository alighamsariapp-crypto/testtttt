import React, { useMemo } from 'react';
import { CreditCard, Globe, Laptop, Package, ShoppingBag, Tag, Wifi } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { openHomepageCustomUrl } from '../utils/homepageLinks';
import type { HomepageDestination, HomepageQuickAccessItem, QuickAccessIcon } from '../types';

const iconMap: Record<QuickAccessIcon, typeof Wifi> = { wifi: Wifi, simcard: CreditCard, laptop: Laptop, network: Package, services: Globe, globe: Globe, 'shopping-bag': ShoppingBag, tag: Tag };
const toneMap: Record<string, string> = {
  modem: 'bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100/80', simcard: 'bg-indigo-50 text-indigo-600 border-indigo-100 hover:bg-indigo-100/80', laptop: 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100', network: 'bg-sky-50 text-sky-600 border-sky-100 hover:bg-sky-100/80', services: 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100/80',
};
const fallbackItems: HomepageQuickAccessItem[] = [
  { id: 'modem', title: 'مودم', icon: 'wifi', category: 'modem-internet', destination: 'store', isVisible: true },
  { id: 'simcard', title: 'سیم‌کارت', icon: 'simcard', category: 'simcard', destination: 'store', isVisible: true },
  { id: 'laptop', title: 'لپ‌تاپ', icon: 'laptop', category: 'laptops', destination: 'store', isVisible: true },
  { id: 'network', title: 'تجهیزات شبکه', icon: 'network', category: 'networking-equipment', destination: 'store', isVisible: true },
  { id: 'services', title: 'خدمات آنلاین', icon: 'services', category: '', destination: 'services', isVisible: true },
];

export const QuickAccessGrid: React.FC = () => {
  const { setActiveView, navigateToCategory, appearanceSettings } = useApp();
  const items = useMemo(() => (appearanceSettings.quickAccessItems !== undefined ? appearanceSettings.quickAccessItems : fallbackItems).filter((item) => item.isVisible), [appearanceSettings.quickAccessItems]);
  const openDestination = (customUrl: string | undefined, destination: HomepageDestination | undefined, category: string) => {
    if (openHomepageCustomUrl(customUrl)) return;
    if (!destination || destination === 'store') { navigateToCategory(category || null, category ? [category] : []); return; }
    setActiveView(destination);
  };
  if (!items.length) return null;

  return <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
    <div className="flex items-center justify-between mb-4"><h2 className="text-sm font-bold text-slate-800 tracking-tight">دسترسی سریع</h2></div>
    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5 sm:gap-4">
      {items.map((item) => {
        const Icon = iconMap[item.icon] ?? Globe;
        return <button key={item.id} id={`quick-access-${item.id}`} onClick={() => openDestination(item.customUrl, item.destination, item.category)} className="flex flex-col items-center gap-2 p-2 sm:p-3.5 rounded-2xl transition group focus:outline-none cursor-pointer">
          <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center border transition-all duration-200 group-hover:scale-105 shadow-sm overflow-hidden ${toneMap[item.id] ?? 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'}`}>
            {item.imageUrl ? <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" /> : <Icon className="w-6 h-6 sm:w-7 sm:h-7" />}
          </div>
          <span className="text-[11px] sm:text-xs font-semibold text-slate-700 group-hover:text-blue-600 transition line-clamp-1">{item.title}</span>
        </button>;
      })}
    </div>
  </div>;
};
