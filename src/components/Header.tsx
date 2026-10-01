import React, { useState, useRef, useEffect } from 'react';
import { 
  Search, 
  ShoppingCart, 
  Heart, 
  ChevronDown, 
  Menu, 
  Wifi, 
  CreditCard, 
  Headphones, 
  Server, 
  Smartphone, 
  Laptop,
  ArrowLeft,
  X,
  Sparkles,
  Zap,
  Globe,
  Sliders,

} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getStorefrontProducts } from '../utils/catalogQuality';

export const Header: React.FC = () => {
  const {
    activeView,
    setActiveView,
    cartSummary,
    favorites,
    user,
    setAuthModalOpen,
    setProfileSubTab,
    setMobileDrawerOpen,
    setSearchOverlayOpen,
    setSelectedCategorySlug,
    navigateToCategory,
    navigateToProduct,
    navigateToService,
    navigateToServiceCategory,
    products,
    categories,
    services,
    setSelectedProductSlug,
    themeSettings,
    appearanceSettings,
  } = useApp();

  const [hoveredMenu, setHoveredMenu] = useState<'store' | 'services' | null>(null);
  const [activeStoreTab, setActiveStoreTab] = useState<string | null>(null);
  const [activeServiceTab, setActiveServiceTab] = useState<string | null>(null);
  
  // Search dropdown
  const [desktopSearchQuery, setDesktopSearchQuery] = useState('');
  const [isSearchDropdownOpen, setSearchDropdownOpen] = useState(false);
  const searchDropdownRef = useRef<HTMLDivElement>(null);
  const menuTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Close search dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchDropdownRef.current && !searchDropdownRef.current.contains(event.target as Node)) {
        setSearchDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMenuEnter = (menu: 'store' | 'services') => {
    if (menuTimeoutRef.current) {
      clearTimeout(menuTimeoutRef.current);
    }
    setHoveredMenu(menu);
  };

  const handleMenuLeave = () => {
    menuTimeoutRef.current = setTimeout(() => {
      setHoveredMenu(null);
    }, 150);
  };

  const searchResults = desktopSearchQuery.trim()
    ? getStorefrontProducts(products).filter(p =>
        p.name.toLowerCase().includes(desktopSearchQuery.toLowerCase()) ||
        p.category_name?.toLowerCase().includes(desktopSearchQuery.toLowerCase()) ||
        p.brand?.toLowerCase().includes(desktopSearchQuery.toLowerCase())
      ).slice(0, 5)
    : [];

  const publishedServices = services.filter((service) => service.is_active !== false);
  const serviceCategories = Array.from(new Set(publishedServices.map((service) => service.category?.trim() || 'خدمات آنلاین')));
  const selectedServiceCategory = serviceCategories.includes(activeServiceTab ?? '') ? activeServiceTab : serviceCategories[0] ?? null;
  const selectedCategoryServices = selectedServiceCategory
    ? publishedServices.filter((service) => (service.category?.trim() || 'خدمات آنلاین') === selectedServiceCategory)
    : [];
  const storeRootCategories = categories.filter((category) => category.is_active && !category.parent_id);
  const selectedStoreCategory = storeRootCategories.find((category) => category.slug === activeStoreTab) ?? storeRootCategories[0] ?? null;
  const selectedStoreChildren = (selectedStoreCategory?.children ?? []).filter((category) => category.is_active);

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-100/90 shadow-2xs">
      
      {/* Dynamic Top Announcement Banner (Controlled from Admin Appearance) */}
      {appearanceSettings?.topBannerEnabled && (
        <div 
          className="px-4 py-2 text-center text-xs font-bold transition-colors flex items-center justify-center gap-2"
          style={{
            backgroundColor: appearanceSettings.topBannerBgColor || '#1E293B',
            color: appearanceSettings.topBannerTextColor || '#FFFFFF'
          }}
        >
          <span>{appearanceSettings.topBannerText}</span>
          {appearanceSettings.topBannerLinkText && (
            <button
              onClick={() => {
                if (appearanceSettings.topBannerLinkUrl.startsWith('/')) {
                  setActiveView('store');
                }
              }}
              className="underline font-normal ui-text-meta opacity-90 hover:opacity-100 transition"
            >
              {appearanceSettings.topBannerLinkText} ←
            </button>
          )}
        </div>
      )}

      {/* Main Header Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20 gap-3 sm:gap-6">
          
          {/* Right Section (RTL): Mobile Hamburger + Brand Logo + Nav Links */}
          <div className="flex items-center gap-4 lg:gap-8 min-w-0">
            {/* Mobile Hamburger Button */}
            <button
              id="mobile-menu-toggle-btn"
              onClick={() => setMobileDrawerOpen(true)}
              className="lg:hidden p-2 rounded-xl text-slate-700 hover:bg-slate-100 transition active:scale-95 shrink-0"
              aria-label="باز کردن منو"
            >
              <Menu className="w-6 h-6" />
            </button>

            {/* Brand Logo */}
            <button
              id="brand-logo-btn"
              onClick={() => setActiveView('home')}
              className="flex items-center gap-2 group cursor-pointer focus:outline-none shrink-0"
            >
              <span 
                className="text-2xl sm:text-3xl font-bold tracking-tight text-blue-700 transition-transform group-hover:scale-102" 
                style={{ color: appearanceSettings.brandPrimaryColor || themeSettings.primary_color }}
              >
                {themeSettings.brand_name || 'noovinnet'}
              </span>
            </button>

            {/* Desktop Navigation Links */}
            <nav className="hidden lg:flex items-center gap-5 xl:gap-7 ui-text-label text-slate-700">
              
              {/* خانه (Home) */}
              <button
                onClick={() => setActiveView('home')}
                className={`py-2 transition-colors hover:text-blue-600 cursor-pointer ${
                  activeView === 'home' ? 'text-blue-600 font-semibold border-b-2 border-blue-600' : ''
                }`}
              >
                خانه
              </button>

              {/* فروشگاه (Store) Multi-Level Mega Dropdown */}
              <div 
                className="relative py-7"
                onMouseEnter={() => handleMenuEnter('store')}
                onMouseLeave={handleMenuLeave}
              >
                <button
                  id="nav-store-btn"
                  onClick={() => navigateToCategory(null, [])}
                  className={`flex items-center gap-1.5 py-2 transition-colors hover:text-blue-600 cursor-pointer ${
                    activeView === 'store' || activeView === 'product-detail'
                      ? 'text-blue-600 font-semibold border-b-2 border-blue-600'
                      : hoveredMenu === 'store'
                      ? 'text-blue-600 font-semibold'
                      : ''
                  }`}
                >
                  <span>فروشگاه</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${hoveredMenu === 'store' ? 'rotate-180 text-blue-600' : 'text-slate-400'}`} />
                </button>

                {/* Fixed-Height Zero-Layout-Shift Mega Menu */}
                {hoveredMenu === 'store' && (
                  <div 
                    className="absolute top-full right-0 w-[780px] bg-white rounded-3xl shadow-2xl border border-slate-100 p-5 flex gap-5 z-50 animate-in fade-in slide-in-from-top-1 duration-150 h-[380px] overflow-hidden"
                    onMouseEnter={() => handleMenuEnter('store')}
                    onMouseLeave={handleMenuLeave}
                  >
                    <div className="flex w-full gap-5" aria-label="دسته‌بندی‌های فروشگاه">
                      <aside className="w-52 shrink-0 border-l border-slate-100 pl-4 flex flex-col">
                        <div className="px-3 pb-2 ui-text-meta font-bold text-slate-400">دسته‌بندی‌های فروشگاه</div>
                        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
                          {storeRootCategories.map((category) => {
                            const isActive = selectedStoreCategory?.id === category.id;
                            return <button key={category.id} type="button" onMouseEnter={() => setActiveStoreTab(category.slug)} onFocus={() => setActiveStoreTab(category.slug)} onClick={() => { navigateToCategory(category.slug, [category.slug]); setHoveredMenu(null); }} className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-right ui-text-button transition ${isActive ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'text-slate-700 hover:bg-slate-50'}`}><span className="truncate">{category.name}</span><ChevronDown className={`h-3.5 w-3.5 rotate-90 ${isActive ? 'text-white' : 'text-slate-400'}`} /></button>;
                          })}
                        </div>
                        <button type="button" onClick={() => { navigateToCategory(null, []); setHoveredMenu(null); }} className="mt-3 w-full rounded-xl bg-slate-100 px-3 py-2 text-center ui-text-button text-slate-600 transition hover:bg-blue-50 hover:text-blue-700">همهٔ محصولات</button>
                      </aside>
                      <section className="min-w-0 flex-1 overflow-y-auto">
                        {selectedStoreCategory ? <><div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2"><div><b className="block ui-text-card-title text-slate-800">{selectedStoreCategory.name}</b><small className="mt-1 block ui-text-meta text-slate-500">{selectedStoreCategory.description || 'مشاهدهٔ کالاهای این دسته و زیردسته‌های آن'}</small></div><button type="button" onClick={() => { navigateToCategory(selectedStoreCategory.slug, [selectedStoreCategory.slug]); setHoveredMenu(null); }} className="ui-text-meta font-bold text-blue-600 hover:underline">مشاهدهٔ همه</button></div>{selectedStoreChildren.length ? <div className="grid grid-cols-2 gap-3">{selectedStoreChildren.slice(0, 8).map((child) => <button key={child.id} type="button" onClick={() => { navigateToCategory(child.slug, [selectedStoreCategory.slug, child.slug]); setHoveredMenu(null); }} className="rounded-xl border border-slate-100 p-3 text-right transition hover:border-blue-100 hover:bg-blue-50/60"><b className="block text-xs font-semibold text-slate-800">{child.name}</b><small className="mt-1 block truncate ui-text-meta text-slate-500">{child.description || `مشاهدهٔ محصولات ${child.name}`}</small></button>)}</div> : <div className="grid min-h-40 place-items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 text-center"><div><b className="block text-xs font-semibold text-slate-700">زیردسته‌ای برای این گروه ثبت نشده است</b><small className="mt-2 block ui-text-meta leading-5 text-slate-500">کالاهای همین دسته از صفحهٔ اختصاصی آن قابل مشاهده‌اند.</small></div></div>}</> : <div className="grid h-full place-items-center text-center"><div><b className="block text-sm font-semibold text-slate-800">دستهٔ فعالی برای فروشگاه ثبت نشده است</b><small className="mt-2 block text-xs text-slate-500">از پنل مدیریت، دستهٔ اصلی و زیردسته‌ها را بسازید.</small></div></div>}
                      </section>
                    </div>
                    {false && <>
                    {/* Level 1: Subcategories Column */}
                    <div className="w-52 border-l border-slate-100 pl-4 space-y-1.5 flex flex-col justify-between">
                      <div className="space-y-1">
                        <div className="text-[11px] font-bold text-slate-400 px-3 py-1 uppercase tracking-wider">
                          دسته‌بندی‌های منتخب
                        </div>

                        {/* سیم‌کارت */}
                        <button
                          onMouseEnter={() => setActiveStoreTab('simcard')}
                          onClick={() => {
                            navigateToCategory('simcard', ['simcard']);
                            setHoveredMenu(null);
                          }}
                          className={`w-full text-right px-3.5 py-2.5 rounded-2xl text-xs font-bold transition flex items-center justify-between ${
                            activeStoreTab === 'simcard'
                              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                              : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Smartphone className="w-4 h-4" />
                            <span>سیم‌کارت</span>
                          </div>
                          <ChevronDown className={`w-3.5 h-3.5 rotate-90 ${activeStoreTab === 'simcard' ? 'text-white' : 'text-slate-400'}`} />
                        </button>

                        {/* لپ‌تاپ و تجهیزات */}
                        <button
                          onMouseEnter={() => setActiveStoreTab('laptops')}
                          onClick={() => {
                            navigateToCategory('laptops', ['laptops']);
                            setHoveredMenu(null);
                          }}
                          className={`w-full text-right px-3.5 py-2.5 rounded-2xl text-xs font-bold transition flex items-center justify-between ${
                            activeStoreTab === 'laptops'
                              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                              : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Laptop className="w-4 h-4" />
                            <span>لپ‌تاپ و تجهیزات</span>
                          </div>
                          <ChevronDown className={`w-3.5 h-3.5 rotate-90 ${activeStoreTab === 'laptops' ? 'text-white' : 'text-slate-400'}`} />
                        </button>

                        {/* مودم و اینترنت */}
                        <button
                          onMouseEnter={() => setActiveStoreTab('modem')}
                          onClick={() => {
                            navigateToCategory('modem-internet', ['modem-internet']);
                            setHoveredMenu(null);
                          }}
                          className={`w-full text-right px-3.5 py-2.5 rounded-2xl text-xs font-bold transition flex items-center justify-between ${
                            activeStoreTab === 'modem'
                              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                              : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Wifi className="w-4 h-4" />
                            <span>مودم و اینترنت</span>
                          </div>
                          <ChevronDown className={`w-3.5 h-3.5 rotate-90 ${activeStoreTab === 'modem' ? 'text-white' : 'text-slate-400'}`} />
                        </button>

                        {/* تجهیزات شبکه */}
                        <button
                          onMouseEnter={() => setActiveStoreTab('network')}
                          onClick={() => {
                            navigateToCategory('networking-equipment', ['networking-equipment']);
                            setHoveredMenu(null);
                          }}
                          className={`w-full text-right px-3.5 py-2.5 rounded-2xl text-xs font-bold transition flex items-center justify-between ${
                            activeStoreTab === 'network'
                              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                              : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Server className="w-4 h-4" />
                            <span>تجهیزات شبکه</span>
                          </div>
                          <ChevronDown className={`w-3.5 h-3.5 rotate-90 ${activeStoreTab === 'network' ? 'text-white' : 'text-slate-400'}`} />
                        </button>

                        {/* لوازم جانبی */}
                        <button
                          onMouseEnter={() => setActiveStoreTab('accessories')}
                          onClick={() => {
                            navigateToCategory('accessories', ['accessories']);
                            setHoveredMenu(null);
                          }}
                          className={`w-full text-right px-3.5 py-2.5 rounded-2xl text-xs font-bold transition flex items-center justify-between ${
                            activeStoreTab === 'accessories'
                              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                              : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Headphones className="w-4 h-4" />
                            <span>لوازم جانبی</span>
                          </div>
                          <ChevronDown className={`w-3.5 h-3.5 rotate-90 ${activeStoreTab === 'accessories' ? 'text-white' : 'text-slate-400'}`} />
                        </button>
                      </div>

                      {/* View All Store Products CTA */}
                      <button
                        onClick={() => {
                          navigateToCategory(null, []);
                          setHoveredMenu(null);
                        }}
                        className="w-full text-center py-2 px-3 rounded-xl bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 text-xs font-bold transition"
                      >
                        مرور همه دسته‌بندی‌ها
                      </button>
                    </div>

                    {/* Level 2 & 3: Interactive Dynamic Grid Area */}
                    <div className="flex-1 flex flex-col justify-between overflow-y-auto">
                      
                      {/* SIMCARD TAB */}
                      {activeStoreTab === 'simcard' && (
                        <div className="space-y-3 animate-in fade-in duration-150">
                          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                            <span className="text-xs font-extrabold text-slate-800">انواع سیم‌کارت و اپراتورها</span>
                            <span className="text-[11px] text-blue-600 font-semibold">پوشش 5G و 4G</span>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <button
                              onClick={() => {
                                navigateToCategory('irancell', ['simcard', 'irancell']);
                                setHoveredMenu(null);
                              }}
                              className="text-right p-3 rounded-2xl bg-amber-50/50 hover:bg-amber-100/60 border border-amber-200/60 transition group"
                            >
                              <div className="text-xs font-extrabold text-amber-900 group-hover:text-amber-800">سیم‌کارت ایرانسل</div>
                              <div className="text-[11px] text-amber-700/80 mt-0.5">دائمی و اعتباری با بسته هدیه</div>
                            </button>

                            <button
                              onClick={() => {
                                navigateToCategory('mci', ['simcard', 'mci']);
                                setHoveredMenu(null);
                              }}
                              className="text-right p-3 rounded-2xl bg-sky-50/50 hover:bg-sky-100/60 border border-sky-200/60 transition group"
                            >
                              <div className="text-xs font-extrabold text-sky-900 group-hover:text-sky-800">سیم‌کارت همراه اول</div>
                              <div className="text-[11px] text-sky-700/80 mt-0.5">شماره رند، دائمی و اعتباری</div>
                            </button>

                            <button
                              onClick={() => {
                                navigateToCategory('rightel', ['simcard', 'rightel']);
                                setHoveredMenu(null);
                              }}
                              className="text-right p-3 rounded-2xl bg-fuchsia-50/50 hover:bg-fuchsia-100/60 border border-fuchsia-200/60 transition group"
                            >
                              <div className="text-xs font-extrabold text-fuchsia-900 group-hover:text-fuchsia-800">سیم‌کارت رایتل</div>
                              <div className="text-[11px] text-fuchsia-700/80 mt-0.5">اینترنت مقرون‌به‌صرفه و پرسرعت</div>
                            </button>

                            <button
                              onClick={() => {
                                navigateToCategory('irancell-permanent', ['simcard', 'irancell', 'irancell-permanent']);
                                setHoveredMenu(null);
                              }}
                              className="text-right p-3 rounded-2xl bg-emerald-50/50 hover:bg-emerald-100/60 border border-emerald-200/60 transition group"
                            >
                              <div className="text-xs font-extrabold text-emerald-900 group-hover:text-emerald-800">سیم‌کارت دائمی طلایی</div>
                              <div className="text-[11px] text-emerald-700/80 mt-0.5">ثبت سریع با تحویل فوری</div>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* LAPTOP TAB */}
                      {activeStoreTab === 'laptops' && (
                        <div className="space-y-3 animate-in fade-in duration-150">
                          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                            <span className="text-xs font-extrabold text-slate-800">انواع لپ‌تاپ و الترابوک بر اساس برند</span>
                            <span className="text-[11px] text-blue-600 font-semibold">گارانتی ۱۸ ماهه معتبر</span>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <button
                              onClick={() => {
                                navigateToCategory('lenovo', ['laptops', 'laptops-notebooks', 'lenovo']);
                                setHoveredMenu(null);
                              }}
                              className="text-right p-3 rounded-2xl hover:bg-blue-50/50 border border-slate-100 transition group"
                            >
                              <div className="text-xs font-bold text-slate-800 group-hover:text-blue-600">لپ‌تاپ لنوو (Lenovo)</div>
                              <div className="text-[11px] text-slate-500 mt-0.5">Legion، ThinkPad و LOQ گیمینگ</div>
                            </button>

                            <button
                              onClick={() => {
                                navigateToCategory('asus', ['laptops', 'laptops-notebooks', 'asus']);
                                setHoveredMenu(null);
                              }}
                              className="text-right p-3 rounded-2xl hover:bg-blue-50/50 border border-slate-100 transition group"
                            >
                              <div className="text-xs font-bold text-slate-800 group-hover:text-blue-600">لپ‌تاپ ایسوس (ASUS)</div>
                              <div className="text-[11px] text-slate-500 mt-0.5">ROG، TUF و ZenBook باریک</div>
                            </button>

                            <button
                              onClick={() => {
                                navigateToCategory('apple', ['laptops', 'laptops-notebooks', 'apple']);
                                setHoveredMenu(null);
                              }}
                              className="text-right p-3 rounded-2xl hover:bg-blue-50/50 border border-slate-100 transition group"
                            >
                              <div className="text-xs font-bold text-slate-800 group-hover:text-blue-600">مک‌بوک اپل (Apple)</div>
                              <div className="text-[11px] text-slate-500 mt-0.5">MacBook Air و Pro با تراشه M3</div>
                            </button>

                            <button
                              onClick={() => {
                                navigateToCategory('hp', ['laptops', 'laptops-notebooks', 'hp']);
                                setHoveredMenu(null);
                              }}
                              className="text-right p-3 rounded-2xl hover:bg-blue-50/50 border border-slate-100 transition group"
                            >
                              <div className="text-xs font-bold text-slate-800 group-hover:text-blue-600">لپ‌تاپ اچ‌پی (HP)</div>
                              <div className="text-[11px] text-slate-500 mt-0.5">Victus و Pavilion اداری</div>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* MODEM TAB */}
                      {activeStoreTab === 'modem' && (
                        <div className="space-y-3 animate-in fade-in duration-150">
                          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                            <span className="text-xs font-extrabold text-slate-800">انواع مودم و تجهیزات اینترنت</span>
                            <span className="text-[11px] text-blue-600 font-semibold">پشتیبانی از Wi-Fi 6</span>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <button
                              onClick={() => {
                                navigateToCategory('modem-5g', ['modem-internet', 'modem-5g']);
                                setHoveredMenu(null);
                              }}
                              className="text-right p-3 rounded-2xl hover:bg-slate-50 border border-slate-100 transition group"
                            >
                              <div className="text-xs font-bold text-slate-800 group-hover:text-blue-600">مودم 5G رومیزی</div>
                              <div className="text-[11px] text-slate-500 mt-0.5">سرعت تا ۳.۶ گیگابیت بر ثانیه</div>
                            </button>

                            <button
                              onClick={() => {
                                navigateToCategory('modem-4g', ['modem-internet', 'modem-4g']);
                                setHoveredMenu(null);
                              }}
                              className="text-right p-3 rounded-2xl hover:bg-slate-50 border border-slate-100 transition group"
                            >
                              <div className="text-xs font-bold text-slate-800 group-hover:text-blue-600">مودم 4G/LTE همراه</div>
                              <div className="text-[11px] text-slate-500 mt-0.5">جیبی و پرتابل با باتری قوی</div>
                            </button>

                            <button
                              onClick={() => {
                                navigateToCategory('modem-internet', ['modem-internet']);
                                setHoveredMenu(null);
                              }}
                              className="text-right p-3 rounded-2xl hover:bg-slate-50 border border-slate-100 transition group"
                            >
                              <div className="text-xs font-bold text-slate-800 group-hover:text-blue-600">مودم فیبر نوری (ONT)</div>
                              <div className="text-[11px] text-slate-500 mt-0.5">مخصوص اینترنت FTTH و تانوما</div>
                            </button>

                            <button
                              onClick={() => {
                                navigateToCategory('modem-internet', ['modem-internet']);
                                setHoveredMenu(null);
                              }}
                              className="text-right p-3 rounded-2xl hover:bg-slate-50 border border-slate-100 transition group"
                            >
                              <div className="text-xs font-bold text-slate-800 group-hover:text-blue-600">مودم TD-LTE مبین‌نت و ایرانسل</div>
                              <div className="text-[11px] text-slate-500 mt-0.5">مناسب منازل و برج‌ها</div>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* NETWORK TAB */}
                      {activeStoreTab === 'network' && (
                        <div className="space-y-3 animate-in fade-in duration-150">
                          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                            <span className="text-xs font-extrabold text-slate-800">تجهیزات تخصصی شبکه و زیرساخت</span>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <button
                              onClick={() => {
                                navigateToCategory('switches', ['networking-equipment', 'switches']);
                                setHoveredMenu(null);
                              }}
                              className="text-right p-3 rounded-2xl hover:bg-slate-50 border border-slate-100 transition group"
                            >
                              <div className="text-xs font-bold text-slate-800 group-hover:text-blue-600">سوئیچ شبکه گیگابیت</div>
                              <div className="text-[11px] text-slate-500 mt-0.5">سیسکو، تی‌پی‌لینک و دی‌لینک</div>
                            </button>

                            <button
                              onClick={() => {
                                navigateToCategory('networking-equipment', ['networking-equipment']);
                                setHoveredMenu(null);
                              }}
                              className="text-right p-3 rounded-2xl hover:bg-slate-50 border border-slate-100 transition group"
                            >
                              <div className="text-xs font-bold text-slate-800 group-hover:text-blue-600">روترهای گیمینگ و حرفه‌ای</div>
                              <div className="text-[11px] text-slate-500 mt-0.5">ایسوس، میکروتیک و هوآوی</div>
                            </button>

                            <button
                              onClick={() => {
                                navigateToCategory('cables', ['networking-equipment', 'cables']);
                                setHoveredMenu(null);
                              }}
                              className="text-right p-3 rounded-2xl hover:bg-slate-50 border border-slate-100 transition group"
                            >
                              <div className="text-xs font-bold text-slate-800 group-hover:text-blue-600">کابل شبکه Cat6 SFTP</div>
                              <div className="text-[11px] text-slate-500 mt-0.5">نگزنس تمام مس با تست فلوک</div>
                            </button>

                            <button
                              onClick={() => {
                                navigateToCategory('networking-equipment', ['networking-equipment']);
                                setHoveredMenu(null);
                              }}
                              className="text-right p-3 rounded-2xl hover:bg-slate-50 border border-slate-100 transition group"
                            >
                              <div className="text-xs font-bold text-slate-800 group-hover:text-blue-600">رک و متعلقات شبکه</div>
                              <div className="text-[11px] text-slate-500 mt-0.5">پچ‌پنل، پاورماژول و کابل‌منیجر</div>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* ACCESSORIES TAB */}
                      {activeStoreTab === 'accessories' && (
                        <div className="space-y-3 animate-in fade-in duration-150">
                          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                            <span className="text-xs font-extrabold text-slate-800">لوازم جانبی و اکسسوری</span>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <button
                              onClick={() => {
                                navigateToCategory('accessories', ['accessories']);
                                setHoveredMenu(null);
                              }}
                              className="text-right p-3 rounded-2xl hover:bg-slate-50 border border-slate-100 transition group"
                            >
                              <div className="text-xs font-bold text-slate-800 group-hover:text-blue-600">هدفون و هندزفری بی‌سیم</div>
                              <div className="text-[11px] text-slate-500 mt-0.5">سونی، انکر و سامسونگ</div>
                            </button>

                            <button
                              onClick={() => {
                                navigateToCategory('accessories', ['accessories']);
                                setHoveredMenu(null);
                              }}
                              className="text-right p-3 rounded-2xl hover:bg-slate-50 border border-slate-100 transition group"
                            >
                              <div className="text-xs font-bold text-slate-800 group-hover:text-blue-600">آداپتور و شارژر سریع</div>
                              <div className="text-[11px] text-slate-500 mt-0.5">توان بالا GaN با گارانتی</div>
                            </button>

                            <button
                              onClick={() => {
                                navigateToCategory('accessories', ['accessories']);
                                setHoveredMenu(null);
                              }}
                              className="text-right p-3 rounded-2xl hover:bg-slate-50 border border-slate-100 transition group"
                            >
                              <div className="text-xs font-bold text-slate-800 group-hover:text-blue-600">پاوربانک و باتری مودم</div>
                              <div className="text-[11px] text-slate-500 mt-0.5">ظرفیت ۱۰ تا ۳۰ هزار میلی‌آمپر</div>
                            </button>

                            <button
                              onClick={() => {
                                navigateToCategory('accessories', ['accessories']);
                                setHoveredMenu(null);
                              }}
                              className="text-right p-3 rounded-2xl hover:bg-slate-50 border border-slate-100 transition group"
                            >
                              <div className="text-xs font-bold text-slate-800 group-hover:text-blue-600">تبدیل و دانگل شبکه</div>
                              <div className="text-[11px] text-slate-500 mt-0.5">کارت شبکه USB و تایپ C</div>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Bottom Banner inside Mega Menu */}
                      <div className="mt-4 p-3 bg-blue-50/70 border border-blue-100 rounded-2xl flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 text-blue-900 font-bold">
                          <Zap className="w-4 h-4 text-amber-500" />
                          <span>ارسال فوری سفارش‌های تهران در کمتر از ۳ ساعت</span>
                        </div>
                        <button 
                          onClick={() => {
                            setSelectedCategorySlug(null);
                            setActiveView('store');
                            setHoveredMenu(null);
                          }}
                          className="text-blue-700 hover:underline font-extrabold"
                        >
                          خرید آنی
                        </button>
                      </div>

                    </div>
                    </>}
                  </div>
                )}
              </div>

              {/* خدمات آنلاین (Online Services) Multi-Level Mega Dropdown */}
              <div 
                className="relative py-7"
                onMouseEnter={() => handleMenuEnter('services')}
                onMouseLeave={handleMenuLeave}
              >
                <button
                  id="nav-services-btn"
                  onClick={() => setActiveView('services')}
                  className={`flex items-center gap-1.5 py-2 transition-colors hover:text-blue-600 cursor-pointer ${
                    activeView === 'services' || activeView === 'service-detail'
                      ? 'text-blue-600 font-semibold border-b-2 border-blue-600'
                      : hoveredMenu === 'services'
                      ? 'text-blue-600 font-semibold'
                      : ''
                  }`}
                >
                  <span>خدمات آنلاین</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${hoveredMenu === 'services' ? 'rotate-180 text-blue-600' : 'text-slate-400'}`} />
                </button>

                {/* Fixed-Height Mega Menu for Services */}
                {hoveredMenu === 'services' && (
                  <div 
                    className="absolute top-full right-0 w-[720px] bg-white rounded-3xl shadow-2xl border border-slate-100 p-5 flex gap-5 z-50 animate-in fade-in slide-in-from-top-1 duration-150 h-[360px] overflow-hidden"
                    onMouseEnter={() => handleMenuEnter('services')}
                    onMouseLeave={handleMenuLeave}
                  >
                    {publishedServices.length === 0 && (
                      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-center px-10 space-y-3 bg-white rounded-3xl">
                        <Sparkles className="w-8 h-8 text-blue-600" />
                        <div className="space-y-1">
                          <h3 className="text-sm font-extrabold text-slate-900">خدمت آنلاین فعالی ثبت نشده است</h3>
                          <p className="text-xs text-slate-500 leading-relaxed">فقط خدمات آمادهٔ ثبت و پیگیری در این بخش نمایش داده می‌شوند.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => { setActiveView('services'); setHoveredMenu(null); }}
                          className="min-h-11 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition"
                        >
                          مشاهدهٔ وضعیت خدمات
                        </button>
                      </div>
                    )}
                    {publishedServices.length > 0 && <>
                      <aside className="w-56 shrink-0 border-l border-slate-100 pl-4 flex flex-col" aria-label="دسته‌های خدمات آنلاین">
                        <div className="px-3 pb-2 text-[11px] font-bold text-slate-400">دسته‌بندی خدمات آنلاین</div>
                        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
                          {serviceCategories.map((category) => {
                            const isActive = selectedServiceCategory === category;
                            return <button
                              key={category}
                              type="button"
                              onMouseEnter={() => setActiveServiceTab(category)}
                              onFocus={() => setActiveServiceTab(category)}
                              onClick={() => { navigateToServiceCategory(category); setHoveredMenu(null); }}
                              className={`flex w-full items-center justify-between rounded-2xl px-3.5 py-3 text-right text-xs font-bold transition ${isActive ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'text-slate-700 hover:bg-slate-50'}`}
                              aria-current={isActive ? 'true' : undefined}
                            >
                              <span className="truncate">{category}</span>
                              <ArrowLeft className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                            </button>;
                          })}
                        </div>
                        <button type="button" onClick={() => { setActiveView('services'); setHoveredMenu(null); }} className="mt-3 w-full rounded-xl bg-slate-100 px-3 py-2 text-center text-xs font-bold text-slate-600 transition hover:bg-blue-50 hover:text-blue-700">همهٔ دسته‌ها ←</button>
                      </aside>

                      <section className="min-w-0 flex-1 overflow-y-auto pr-1" aria-label="خدمات دستهٔ فعال">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                          <div>
                            <span className="block ui-text-card-title text-slate-800">{selectedServiceCategory}</span>
                            <small className="mt-1 block ui-text-meta text-slate-500">خدمات منتشرشدهٔ این دسته</small>
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-3">
                          {selectedCategoryServices.slice(0, 4).map((service) => <button key={service.id} type="button" onClick={() => { navigateToService(service.slug); setHoveredMenu(null); }} className="min-h-20 rounded-2xl border border-slate-100 p-3 text-right transition hover:border-blue-200 hover:bg-blue-50/60 group"><span className="block truncate ui-text-body font-semibold text-slate-800 group-hover:text-blue-700">{service.name}</span><small className="mt-1 block line-clamp-2 ui-text-meta leading-5 text-slate-500">{service.short_description || service.description || 'مشاهدهٔ راهنما و مراحل انجام خدمت'}</small></button>)}
                        </div>
                        <button type="button" onClick={() => { if (selectedServiceCategory) navigateToServiceCategory(selectedServiceCategory); setHoveredMenu(null); }} className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-blue-700 transition hover:text-blue-900">مشاهدهٔ همهٔ خدمات {selectedServiceCategory}<ArrowLeft className="h-3.5 w-3.5" /></button>
                      </section>
                    </>}

                    {false && <>
                    {/* Legacy fixed services menu kept as source reference; real published services render above. */}
                    {/* Level 1: Subcategories Column */}
                    <div className="w-52 border-l border-slate-100 pl-4 space-y-1.5 flex flex-col justify-between" aria-hidden={services.length === 0}>
                      <div className="space-y-1">
                        <div className="text-[11px] font-bold text-slate-400 px-3 py-1 uppercase tracking-wider">
                          دسته‌های خدمات
                        </div>

                        {/* خدمات ایرانسل */}
                        <button
                          onMouseEnter={() => setActiveServiceTab('irancell')}
                          onClick={() => {
                            setActiveView('services');
                            setHoveredMenu(null);
                          }}
                          className={`w-full text-right px-3.5 py-2.5 rounded-2xl text-xs font-bold transition flex items-center justify-between ${
                            activeServiceTab === 'irancell'
                              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                              : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <span>خدمات ایرانسل</span>
                          <ChevronDown className={`w-3.5 h-3.5 rotate-90 ${activeServiceTab === 'irancell' ? 'text-white' : 'text-slate-400'}`} />
                        </button>

                        {/* خدمات همراه اول */}
                        <button
                          onMouseEnter={() => setActiveServiceTab('mci')}
                          onClick={() => {
                            setActiveView('services');
                            setHoveredMenu(null);
                          }}
                          className={`w-full text-right px-3.5 py-2.5 rounded-2xl text-xs font-bold transition flex items-center justify-between ${
                            activeServiceTab === 'mci'
                              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                              : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <span>خدمات همراه اول</span>
                          <ChevronDown className={`w-3.5 h-3.5 rotate-90 ${activeServiceTab === 'mci' ? 'text-white' : 'text-slate-400'}`} />
                        </button>

                        {/* سایر خدمات */}
                        <button
                          onMouseEnter={() => setActiveServiceTab('other')}
                          onClick={() => {
                            setActiveView('services');
                            setHoveredMenu(null);
                          }}
                          className={`w-full text-right px-3.5 py-2.5 rounded-2xl text-xs font-bold transition flex items-center justify-between ${
                            activeServiceTab === 'other'
                              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                              : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <span>سایر خدمات آنلاین</span>
                          <ChevronDown className={`w-3.5 h-3.5 rotate-90 ${activeServiceTab === 'other' ? 'text-white' : 'text-slate-400'}`} />
                        </button>
                      </div>

                      <button
                        onClick={() => {
                          setActiveView('services');
                          setHoveredMenu(null);
                        }}
                        className="w-full text-center py-2 px-3 rounded-xl bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 text-xs font-bold transition"
                      >
                        مشاهده تمامی خدمات ←
                      </button>
                    </div>

                    {/* Level 2 & 3: Content Grid */}
                    <div className="flex-1 flex flex-col justify-between overflow-y-auto" aria-hidden={services.length === 0}>
                      
                      {activeServiceTab === 'irancell' && (
                        <div className="space-y-3 animate-in fade-in duration-150">
                          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                            <span className="text-xs font-extrabold text-slate-800">خدمات آنی اپراتور ایرانسل</span>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <button
                              onClick={() => { setActiveView('services'); setHoveredMenu(null); }}
                              className="text-right p-3 rounded-2xl hover:bg-amber-50/50 border border-slate-100 transition group"
                            >
                              <div className="text-xs font-bold text-slate-800 group-hover:text-amber-800">خرید بسته اینترنت ایرانسل</div>
                              <div className="text-[11px] text-slate-500 mt-0.5">بسته‌های روزانه، هفتگی و ماهانه</div>
                            </button>

                            <button
                              onClick={() => { setActiveView('services'); setHoveredMenu(null); }}
                              className="text-right p-3 rounded-2xl hover:bg-amber-50/50 border border-slate-100 transition group"
                            >
                              <div className="text-xs font-bold text-slate-800 group-hover:text-amber-800">شارژ مستقیم سیم‌کارت</div>
                              <div className="text-[11px] text-slate-500 mt-0.5">شارژ شگفت‌انگیز و عادی</div>
                            </button>

                            <button
                              onClick={() => { setActiveView('services'); setHoveredMenu(null); }}
                              className="text-right p-3 rounded-2xl hover:bg-amber-50/50 border border-slate-100 transition group"
                            >
                              <div className="text-xs font-bold text-slate-800 group-hover:text-amber-800">استعلام مانده و ریزمکالمات</div>
                              <div className="text-[11px] text-slate-500 mt-0.5">گزارش آنی کارکرد خط</div>
                            </button>

                            <button
                              onClick={() => { setActiveView('services'); setHoveredMenu(null); }}
                              className="text-right p-3 rounded-2xl hover:bg-amber-50/50 border border-slate-100 transition group"
                            >
                              <div className="text-xs font-bold text-slate-800 group-hover:text-amber-800">ترابرد به ایرانسل</div>
                              <div className="text-[11px] text-slate-500 mt-0.5">حفظ شماره با تعویض اپراتور</div>
                            </button>
                          </div>
                        </div>
                      )}

                      {activeServiceTab === 'mci' && (
                        <div className="space-y-3 animate-in fade-in duration-150">
                          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                            <span className="text-xs font-extrabold text-slate-800">خدمات آنی اپراتور همراه اول</span>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <button
                              onClick={() => { setActiveView('services'); setHoveredMenu(null); }}
                              className="text-right p-3 rounded-2xl hover:bg-sky-50/50 border border-slate-100 transition group"
                            >
                              <div className="text-xs font-bold text-slate-800 group-hover:text-sky-800">بسته‌های اینترنت آلفا+</div>
                              <div className="text-[11px] text-slate-500 mt-0.5">بسته‌های بلندمدت و نامحدود شبانه</div>
                            </button>

                            <button
                              onClick={() => { setActiveView('services'); setHoveredMenu(null); }}
                              className="text-right p-3 rounded-2xl hover:bg-sky-50/50 border border-slate-100 transition group"
                            >
                              <div className="text-xs font-bold text-slate-800 group-hover:text-sky-800">پرداخت قبض میان‌دوره و پایان‌دوره</div>
                              <div className="text-[11px] text-slate-500 mt-0.5">تسویه آنی با وصل فوری خط</div>
                            </button>

                            <button
                              onClick={() => { setActiveView('services'); setHoveredMenu(null); }}
                              className="text-right p-3 rounded-2xl hover:bg-sky-50/50 border border-slate-100 transition group"
                            >
                              <div className="text-xs font-bold text-slate-800 group-hover:text-sky-800">شارژ مستقیم همراه اول</div>
                              <div className="text-[11px] text-slate-500 mt-0.5">با دریافت امتیاز باشگاه مشتریان</div>
                            </button>

                            <button
                              onClick={() => { setActiveView('services'); setHoveredMenu(null); }}
                              className="text-right p-3 rounded-2xl hover:bg-sky-50/50 border border-slate-100 transition group"
                            >
                              <div className="text-xs font-bold text-slate-800 group-hover:text-sky-800">تبدیل اعتباری به دائمی</div>
                              <div className="text-[11px] text-slate-500 mt-0.5">بدون تغییر شماره تلفن</div>
                            </button>
                          </div>
                        </div>
                      )}

                      {activeServiceTab === 'other' && (
                        <div className="space-y-3 animate-in fade-in duration-150">
                          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                            <span className="text-xs font-extrabold text-slate-800">سایر خدمات تخصصی و عمومی</span>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <button
                              onClick={() => { setActiveView('services'); setHoveredMenu(null); }}
                              className="text-right p-3 rounded-2xl hover:bg-slate-50 border border-slate-100 transition group"
                            >
                              <div className="text-xs font-bold text-slate-800 group-hover:text-blue-600">استعلام اصالت و گارانتی مودم</div>
                              <div className="text-[11px] text-slate-500 mt-0.5">بررسی وضعیت رجیستری و گارانتی</div>
                            </button>

                            <button
                              onClick={() => { setActiveView('services'); setHoveredMenu(null); }}
                              className="text-right p-3 rounded-2xl hover:bg-slate-50 border border-slate-100 transition group"
                            >
                              <div className="text-xs font-bold text-slate-800 group-hover:text-blue-600">تست سرعت اینترنت (Speedtest)</div>
                              <div className="text-[11px] text-slate-500 mt-0.5">سنجش پینگ، دانلود و آپلود</div>
                            </button>

                            <button
                              onClick={() => { setActiveView('contact'); setHoveredMenu(null); }}
                              className="text-right p-3 rounded-2xl hover:bg-slate-50 border border-slate-100 transition group"
                            >
                              <div className="text-xs font-bold text-slate-800 group-hover:text-blue-600">مشاوره فنی زیرساخت شبکه</div>
                              <div className="text-[11px] text-slate-500 mt-0.5">ارتباط مستقیم با کارشناسان</div>
                            </button>

                            <button
                              onClick={() => { setActiveView('magazine'); setHoveredMenu(null); }}
                              className="text-right p-3 rounded-2xl hover:bg-slate-50 border border-slate-100 transition group"
                            >
                              <div className="text-xs font-bold text-slate-800 group-hover:text-blue-600">مجله و راهنمای تنظیمات</div>
                              <div className="text-[11px] text-slate-500 mt-0.5">آموزش کانفیگ روتر و APN</div>
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="mt-4 p-3 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between text-xs">
                        <span className="text-slate-600 font-medium">پشتیبانی ۲۴ ساعته خدمات آنلاین: ۰۲۱-۸۸۸۸۹۹۹۹</span>
                        <button 
                          onClick={() => { setActiveView('contact'); setHoveredMenu(null); }}
                          className="text-blue-600 hover:underline font-bold"
                        >
                          تماس با ما
                        </button>
                      </div>

                    </div>
                    </>}
                  </div>
                )}
              </div>

              {/* مقالات و اخبار (Magazine) */}
              <button
                onClick={() => setActiveView('magazine')}
                className={`py-2 transition-colors hover:text-blue-600 cursor-pointer ${
                  activeView === 'magazine' ? 'text-blue-600 font-bold border-b-2 border-blue-600' : ''
                }`}
              >
                مجله و راهنما
              </button>

              {/* درباره ما (About) */}
              <button
                onClick={() => setActiveView('about')}
                className={`py-2 transition-colors hover:text-blue-600 cursor-pointer ${
                  activeView === 'about' ? 'text-blue-600 font-bold border-b-2 border-blue-600' : ''
                }`}
              >
                درباره ما
              </button>

              {/* تماس با ما (Contact) */}
              <button
                onClick={() => setActiveView('contact')}
                className={`py-2 transition-colors hover:text-blue-600 cursor-pointer ${
                  activeView === 'contact' ? 'text-blue-600 font-bold border-b-2 border-blue-600' : ''
                }`}
              >
                تماس با ما
              </button>

            </nav>
          </div>

          {/* Left Section (RTL): Search Input + Wishlist + Cart + Profile */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            
            {/* Desktop Instant Search Bar */}
            <div className="relative hidden md:block w-48 lg:w-64" ref={searchDropdownRef}>
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={desktopSearchQuery}
                  onChange={(e) => {
                    setDesktopSearchQuery(e.target.value);
                    setSearchDropdownOpen(true);
                  }}
                  onFocus={() => setSearchDropdownOpen(true)}
                  placeholder="جستجوی کالا، مودم، سیم‌کارت..."
                  className="w-full bg-slate-100/80 hover:bg-slate-100 focus:bg-white text-xs text-slate-800 placeholder-slate-400 rounded-2xl pl-8 pr-10 py-2.5 border border-transparent focus:border-blue-500 focus:outline-hidden transition"
                />
                <Search className="w-4 h-4 text-slate-400 absolute right-3 pointer-events-none" />
                {desktopSearchQuery && (
                  <button 
                    onClick={() => {
                      setDesktopSearchQuery('');
                      setSearchDropdownOpen(false);
                    }}
                    className="absolute left-2.5 p-1 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Instant Search Results Dropdown */}
              {isSearchDropdownOpen && desktopSearchQuery.trim() && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 z-50 space-y-1">
                  {searchResults.length > 0 ? (
                    searchResults.map(p => (
                      <button
                        key={p.id}
                        onClick={() => {
                          navigateToProduct(p.slug);
                          setSearchDropdownOpen(false);
                          setDesktopSearchQuery('');
                        }}
                        className="w-full p-2 rounded-xl hover:bg-slate-50 text-right flex items-center justify-between text-xs transition"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {p.image_url && (
                            <img src={p.image_url} alt={p.name} className="w-7 h-7 object-contain rounded-md bg-slate-50 p-0.5 shrink-0" />
                          )}
                          <span className="truncate text-slate-800 font-medium">{p.name}</span>
                        </div>
                        <span className="ui-text-meta font-bold text-blue-600 shrink-0 ui-numeric">
                          {p.effective_price?.toLocaleString('fa-IR')} تومان
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="p-3 text-center text-xs text-slate-400">
                      محصولی یافت نشد
                    </div>
                  )}
                  <button
                    onClick={() => {
                      setActiveView('store');
                      setSearchDropdownOpen(false);
                    }}
                    className="w-full text-center py-2 ui-text-meta font-bold text-blue-600 hover:bg-blue-50 rounded-xl transition"
                  >
                    مشاهده همه در فروشگاه
                  </button>
                </div>
              )}
            </div>

            {/* Mobile Search Button */}
            <button
              type="button"
              onClick={() => setSearchOverlayOpen(true)}
              className="md:hidden p-2 rounded-2xl bg-slate-100/80 hover:bg-blue-50 hover:text-blue-600 text-slate-700 transition active:scale-95 cursor-pointer"
              aria-label="باز کردن جست‌وجو"
            >
              <Search className="w-5 h-5" />
            </button>

            {/* Wishlist / Favorites Button */}
            <button
              id="header-favorites-btn"
              onClick={() => {
                if (user) {
                  setProfileSubTab('favorites');
                  setActiveView('profile');
                } else {
                  setAuthModalOpen(true);
                }
              }}
              className="relative p-2 sm:p-2.5 rounded-2xl bg-slate-100/80 hover:bg-rose-50 hover:text-rose-600 text-slate-700 transition active:scale-95 cursor-pointer"
              aria-label="علاقه‌مندی‌ها"
              title="علاقه‌مندی‌ها"
            >
              <Heart className="w-5 h-5" />
              {favorites.length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white ui-text-badge flex items-center justify-center shadow-xs animate-in zoom-in ui-numeric">
                  {favorites.length}
                </span>
              )}
            </button>

            {/* Cart Button with Live Counter Badge */}
            <button
              id="header-cart-btn"
              onClick={() => setActiveView('cart')}
              className="relative p-2 sm:p-2.5 rounded-2xl bg-slate-100/80 hover:bg-blue-50 hover:text-blue-600 text-slate-700 transition active:scale-95 cursor-pointer"
              aria-label="سبد خرید"
            >
              <ShoppingCart className="w-5 h-5" />
              {cartSummary.item_count > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white ui-text-badge flex items-center justify-center shadow-xs animate-in zoom-in ui-numeric">
                  {cartSummary.item_count}
                </span>
              )}
            </button>

            {/* User Profile / Login Button */}
            <button
              id="header-user-btn"
              onClick={() => {
                if (user) {
                  setProfileSubTab('dashboard');
                  setActiveView('profile');
                } else {
                  setAuthModalOpen(true);
                }
              }}
              className="hidden md:flex items-center gap-2 px-3.5 py-2 sm:py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white ui-text-button shadow-md shadow-blue-500/20 transition active:scale-95 cursor-pointer"
            >
              <span className="hidden sm:inline">
                {user ? user.name.split(' ')[0] : 'ورود / ثبت‌نام'}
              </span>
            </button>

          </div>

        </div>
      </div>
    </header>
  );
};
