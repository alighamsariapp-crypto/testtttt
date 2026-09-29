import React, { useState } from 'react';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { 
  X, 
  Home, 
  Store, 
  Globe, 
  FileText, 
  Info, 
  Phone, 
  ChevronDown, 
  Wifi, 
  Laptop,
  Smartphone,
  Server,
  Headphones
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const MobileDrawer: React.FC = () => {
  const { 
    isMobileDrawerOpen, 
    setMobileDrawerOpen, 
    activeView,
    setActiveView, 
    navigateToCategory,
    navigateToServiceCategory,
    categories,
    services,
    themeSettings,
  } = useApp();

  useBodyScrollLock(isMobileDrawerOpen);

  // Accordion state - strictly closed by default
  const [openSubmenu, setOpenSubmenu] = useState<'store' | 'services' | null>(null);
  const [openStoreSection, setOpenStoreSection] = useState<string | null>(null);
  const [openLaptopSubcategory, setOpenLaptopSubcategory] = useState<boolean>(false);
  const publishedServices = services.filter((service) => service.is_active !== false);
  const serviceCategories = Array.from(new Set(publishedServices.map((service) => service.category?.trim() || 'خدمات آنلاین')));
  const storeRootCategories = categories.filter((category) => category.is_active && !category.parent_id);

  if (!isMobileDrawerOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex lg:hidden">
      {/* Dimmed Backdrop */}
      <button
        type="button"
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={() => setMobileDrawerOpen(false)}
        aria-label="بستن منو"
      />

      {/* Drawer Content Panel (RTL Slides from Right) */}
      <div className="relative w-full max-w-xs sm:max-w-sm bg-white h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-250 ease-out overflow-y-auto overscroll-contain scrollbar-none">
        
        {/* Top Bar with Close Button and Brand Logo */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-white sticky top-0 z-20">
          <button
            id="close-mobile-drawer-btn"
            onClick={() => setMobileDrawerOpen(false)}
            className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 transition active:scale-95 cursor-pointer"
            aria-label="بستن منو"
          >
            <X className="w-5 h-5" />
          </button>

          <span className="text-xl font-extrabold text-blue-700 font-sans" style={{ color: themeSettings.primary_color }}>
            {themeSettings.brand_name || 'noovinnet'}
          </span>
        </div>

        {/* Navigation List */}
        <div className="p-4 space-y-1.5 flex-1">
          
          {/* خانه (Home) */}
          <button
            onClick={() => {
              setActiveView('home');
              setMobileDrawerOpen(false);
            }}
            className={`w-full flex items-center justify-between p-3 rounded-2xl transition text-xs font-bold ${
              activeView === 'home' ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-3">
              <Home className={`w-4 h-4 ${activeView === 'home' ? 'text-blue-600' : 'text-slate-500'}`} />
              <span>خانه</span>
            </div>
            {activeView === 'home' && <span className="w-2 h-2 rounded-full bg-blue-600" />}
          </button>

          {/* ۱. فروشگاه (Store) Expandable Multi-Level Accordion */}
          <div className={`rounded-2xl border transition overflow-hidden ${
            activeView === 'store' || activeView === 'product-detail' ? 'border-blue-200 bg-blue-50/30' : 'border-slate-100 bg-slate-50/40'
          }`}>
            <button
              onClick={() => setOpenSubmenu(openSubmenu === 'store' ? null : 'store')}
              className={`w-full min-h-12 flex items-center justify-between gap-3 p-3 transition text-xs leading-5 font-bold ${
                activeView === 'store' || activeView === 'product-detail' ? 'text-blue-700 font-extrabold' : 'text-slate-800 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <Store className={`w-4 h-4 ${activeView === 'store' || activeView === 'product-detail' ? 'text-blue-600' : 'text-slate-500'}`} />
                <span>فروشگاه و محصولات</span>
              </div>
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${openSubmenu === 'store' ? 'rotate-180 text-blue-600' : 'text-slate-400'}`} />
            </button>

            {/* Level 2 Submenus */}
            {openSubmenu === 'store' && (
              <div className="p-2 space-y-1.5 bg-white border-t border-slate-100">
                {storeRootCategories.map((category) => {
                  const children = (category.children ?? []).filter((child) => child.is_active);
                  const isOpen = openStoreSection === category.slug;
                  return <div key={category.id} className="rounded-xl border border-slate-100 overflow-hidden"><button type="button" onClick={() => children.length ? setOpenStoreSection(isOpen ? null : category.slug) : (navigateToCategory(category.slug, [category.slug]), setMobileDrawerOpen(false))} className="w-full min-h-11 flex items-center justify-between gap-3 p-2.5 text-xs leading-5 font-bold text-slate-800 bg-slate-50/70"><span className="truncate">{category.name}</span><ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} /></button>{isOpen && <div className="p-2 space-y-1 bg-white border-t border-slate-100 text-xs"><button type="button" onClick={() => { navigateToCategory(category.slug, [category.slug]); setMobileDrawerOpen(false); }} className="w-full rounded-lg px-2 py-1.5 text-right font-bold text-blue-600 hover:bg-blue-50">همهٔ {category.name}</button>{children.map((child) => <button key={child.id} type="button" onClick={() => { navigateToCategory(child.slug, [category.slug, child.slug]); setMobileDrawerOpen(false); }} className="w-full rounded-lg px-2 py-1.5 text-right text-slate-600 hover:bg-blue-50 hover:text-blue-600">{child.name}</button>)}</div>}</div>;
                })}
                <button type="button" onClick={() => { navigateToCategory(null, []); setMobileDrawerOpen(false); }} className="w-full text-center py-2 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition cursor-pointer">مشاهده همه محصولات فروشگاه</button>
                {false && <>
                
                {/* Level 2: سیم‌کارت */}
                <div className="rounded-xl border border-slate-100 overflow-hidden">
                  <button
                    onClick={() => setOpenStoreSection(openStoreSection === 'simcard' ? null : 'simcard')}
                    className="w-full min-h-11 flex items-center justify-between gap-3 p-2.5 text-xs leading-5 font-bold text-slate-800 bg-slate-50/70"
                  >
                    <div className="flex items-center gap-2">
                      <Smartphone className="w-3.5 h-3.5 text-blue-600" />
                      <span>سیم‌کارت</span>
                    </div>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${openStoreSection === 'simcard' ? 'rotate-180' : ''}`} />
                  </button>

                  {openStoreSection === 'simcard' && (
                    <div className="p-2 pl-4 space-y-1 bg-white border-t border-slate-100 text-xs">
                      <button
                        onClick={() => {
                          navigateToCategory('irancell', ['simcard', 'irancell']);
                          setMobileDrawerOpen(false);
                        }}
                        className="w-full text-right py-1.5 px-2 rounded-lg text-slate-600 hover:bg-blue-50 hover:text-blue-600 font-medium"
                      >
                        • سیم‌کارت ایرانسل
                      </button>
                      <button
                        onClick={() => {
                          navigateToCategory('mci', ['simcard', 'mci']);
                          setMobileDrawerOpen(false);
                        }}
                        className="w-full text-right py-1.5 px-2 rounded-lg text-slate-600 hover:bg-blue-50 hover:text-blue-600 font-medium"
                      >
                        • سیم‌کارت همراه اول
                      </button>
                      <button
                        onClick={() => {
                          navigateToCategory('rightel', ['simcard', 'rightel']);
                          setMobileDrawerOpen(false);
                        }}
                        className="w-full text-right py-1.5 px-2 rounded-lg text-slate-600 hover:bg-blue-50 hover:text-blue-600 font-medium"
                      >
                        • سیم‌کارت رایتل
                      </button>
                      <button
                        onClick={() => {
                          navigateToCategory('irancell-permanent', ['simcard', 'irancell', 'irancell-permanent']);
                          setMobileDrawerOpen(false);
                        }}
                        className="w-full text-right py-1.5 px-2 rounded-lg text-slate-600 hover:bg-blue-50 hover:text-blue-600 font-medium"
                      >
                        • سیم‌کارت دائمی طلایی
                      </button>
                    </div>
                  )}
                </div>

                {/* Level 2: لپ‌تاپ و تجهیزات (3-level nested) */}
                <div className="rounded-xl border border-slate-100 overflow-hidden">
                  <button
                    onClick={() => setOpenStoreSection(openStoreSection === 'laptops' ? null : 'laptops')}
                    className="w-full min-h-11 flex items-center justify-between gap-3 p-2.5 text-xs leading-5 font-bold text-slate-800 bg-slate-50/70"
                  >
                    <div className="flex items-center gap-2">
                      <Laptop className="w-3.5 h-3.5 text-blue-600" />
                      <span>لپ‌تاپ و الترابوک</span>
                    </div>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${openStoreSection === 'laptops' ? 'rotate-180' : ''}`} />
                  </button>

                  {openStoreSection === 'laptops' && (
                    <div className="p-2 pl-4 space-y-1 bg-white border-t border-slate-100 text-xs">
                      {/* Level 3: لپ‌تاپ و نوت‌بوک */}
                      <button
                        onClick={() => setOpenLaptopSubcategory(!openLaptopSubcategory)}
                        className="w-full flex items-center justify-between py-1.5 px-2 rounded-lg text-slate-700 hover:bg-slate-50 font-bold"
                      >
                        <span>لپ‌تاپ بر اساس برند</span>
                        <ChevronDown className={`w-3 h-3 transition-transform ${openLaptopSubcategory ? 'rotate-180' : ''}`} />
                      </button>

                      {openLaptopSubcategory && (
                        <div className="pr-3 space-y-1 border-r-2 border-blue-100 my-1">
                          <button
                            onClick={() => {
                              navigateToCategory('lenovo', ['laptops', 'laptops-notebooks', 'lenovo']);
                              setMobileDrawerOpen(false);
                            }}
                            className="w-full text-right py-1 px-2 rounded text-slate-600 hover:text-blue-600 text-xs"
                          >
                            لپ‌تاپ لنوو (Lenovo)
                          </button>
                          <button
                            onClick={() => {
                              navigateToCategory('asus', ['laptops', 'laptops-notebooks', 'asus']);
                              setMobileDrawerOpen(false);
                            }}
                            className="w-full text-right py-1 px-2 rounded text-slate-600 hover:text-blue-600 text-xs"
                          >
                            لپ‌تاپ ایسوس (ASUS)
                          </button>
                          <button
                            onClick={() => {
                              navigateToCategory('apple', ['laptops', 'laptops-notebooks', 'apple']);
                              setMobileDrawerOpen(false);
                            }}
                            className="w-full text-right py-1 px-2 rounded text-slate-600 hover:text-blue-600 text-xs"
                          >
                            مک‌بوک اپل (Apple)
                          </button>
                          <button
                            onClick={() => {
                              navigateToCategory('hp', ['laptops', 'laptops-notebooks', 'hp']);
                              setMobileDrawerOpen(false);
                            }}
                            className="w-full text-right py-1 px-2 rounded text-slate-600 hover:text-blue-600 text-xs"
                          >
                            لپ‌تاپ اچ‌پی (HP)
                          </button>
                        </div>
                      )}

                      <button
                        onClick={() => {
                          navigateToCategory('ultrabook', ['laptops', 'ultrabook']);
                          setMobileDrawerOpen(false);
                        }}
                        className="w-full text-right py-1.5 px-2 rounded-lg text-slate-600 hover:bg-blue-50 hover:text-blue-600 font-medium"
                      >
                        • الترابوک سبک و اداری
                      </button>
                      <button
                        onClick={() => {
                          navigateToCategory('gaming-laptops', ['laptops', 'gaming-laptops']);
                          setMobileDrawerOpen(false);
                        }}
                        className="w-full text-right py-1.5 px-2 rounded-lg text-slate-600 hover:bg-blue-50 hover:text-blue-600 font-medium"
                      >
                        • لپ‌تاپ‌های گیمینگ حرفه‌ای
                      </button>
                    </div>
                  )}
                </div>

                {/* Level 2: مودم و اینترنت */}
                <div className="rounded-xl border border-slate-100 overflow-hidden">
                  <button
                    onClick={() => setOpenStoreSection(openStoreSection === 'modem' ? null : 'modem')}
                    className="w-full min-h-11 flex items-center justify-between gap-3 p-2.5 text-xs leading-5 font-bold text-slate-800 bg-slate-50/70"
                  >
                    <div className="flex items-center gap-2">
                      <Wifi className="w-3.5 h-3.5 text-blue-600" />
                      <span>مودم و اینترنت</span>
                    </div>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${openStoreSection === 'modem' ? 'rotate-180' : ''}`} />
                  </button>

                  {openStoreSection === 'modem' && (
                    <div className="p-2 pl-4 space-y-1 bg-white border-t border-slate-100 text-xs">
                      <button
                        onClick={() => {
                          navigateToCategory('modem-5g', ['modem-internet', 'modem-5g']);
                          setMobileDrawerOpen(false);
                        }}
                        className="w-full text-right py-1.5 px-2 rounded-lg text-slate-600 hover:bg-blue-50 hover:text-blue-600 font-medium"
                      >
                        • مودم 5G رومیزی
                      </button>
                      <button
                        onClick={() => {
                          navigateToCategory('modem-4g', ['modem-internet', 'modem-4g']);
                          setMobileDrawerOpen(false);
                        }}
                        className="w-full text-right py-1.5 px-2 rounded-lg text-slate-600 hover:bg-blue-50 hover:text-blue-600 font-medium"
                      >
                        • مودم 4G/LTE همراه
                      </button>
                      <button
                        onClick={() => {
                          navigateToCategory('modem-internet', ['modem-internet']);
                          setMobileDrawerOpen(false);
                        }}
                        className="w-full text-right py-1.5 px-2 rounded-lg text-slate-600 hover:bg-blue-50 hover:text-blue-600 font-medium"
                      >
                        • مودم فیبر نوری (FTTH)
                      </button>
                    </div>
                  )}
                </div>

                {/* Level 2: تجهیزات شبکه */}
                <div className="rounded-xl border border-slate-100 overflow-hidden">
                  <button
                    onClick={() => setOpenStoreSection(openStoreSection === 'network' ? null : 'network')}
                    className="w-full min-h-11 flex items-center justify-between gap-3 p-2.5 text-xs leading-5 font-bold text-slate-800 bg-slate-50/70"
                  >
                    <div className="flex items-center gap-2">
                      <Server className="w-3.5 h-3.5 text-blue-600" />
                      <span>تجهیزات شبکه</span>
                    </div>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${openStoreSection === 'network' ? 'rotate-180' : ''}`} />
                  </button>

                  {openStoreSection === 'network' && (
                    <div className="p-2 pl-4 space-y-1 bg-white border-t border-slate-100 text-xs">
                      <button
                        onClick={() => {
                          navigateToCategory('switches', ['networking-equipment', 'switches']);
                          setMobileDrawerOpen(false);
                        }}
                        className="w-full text-right py-1.5 px-2 rounded-lg text-slate-600 hover:bg-blue-50 hover:text-blue-600 font-medium"
                      >
                        • سوئیچ شبکه گیگابیت
                      </button>
                      <button
                        onClick={() => {
                          navigateToCategory('cables', ['networking-equipment', 'cables']);
                          setMobileDrawerOpen(false);
                        }}
                        className="w-full text-right py-1.5 px-2 rounded-lg text-slate-600 hover:bg-blue-50 hover:text-blue-600 font-medium"
                      >
                        • کابل شبکه Cat6
                      </button>
                    </div>
                  )}
                </div>

                {/* Level 2: لوازم جانبی */}
                <div className="rounded-xl border border-slate-100 overflow-hidden">
                  <button
                    onClick={() => setOpenStoreSection(openStoreSection === 'accessories' ? null : 'accessories')}
                    className="w-full min-h-11 flex items-center justify-between gap-3 p-2.5 text-xs leading-5 font-bold text-slate-800 bg-slate-50/70"
                  >
                    <div className="flex items-center gap-2">
                      <Headphones className="w-3.5 h-3.5 text-blue-600" />
                      <span>لوازم جانبی</span>
                    </div>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${openStoreSection === 'accessories' ? 'rotate-180' : ''}`} />
                  </button>

                  {openStoreSection === 'accessories' && (
                    <div className="p-2 pl-4 space-y-1 bg-white border-t border-slate-100 text-xs">
                      <button
                        onClick={() => {
                          navigateToCategory('accessories', ['accessories']);
                          setMobileDrawerOpen(false);
                        }}
                        className="w-full text-right py-1.5 px-2 rounded-lg text-slate-600 hover:bg-blue-50 hover:text-blue-600 font-medium"
                      >
                        • هدفون و هندزفری
                      </button>
                      <button
                        onClick={() => {
                          navigateToCategory('accessories', ['accessories']);
                          setMobileDrawerOpen(false);
                        }}
                        className="w-full text-right py-1.5 px-2 rounded-lg text-slate-600 hover:bg-blue-50 hover:text-blue-600 font-medium"
                      >
                        • شارژر و آداپتور
                      </button>
                    </div>
                  )}
                </div>

                {/* All Products button */}
                <button
                  onClick={() => {
                    navigateToCategory(null, []);
                    setMobileDrawerOpen(false);
                  }}
                  className="w-full text-center py-2 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition cursor-pointer"
                >
                  مشاهده همه محصولات فروشگاه ←
                </button>
                </>}
              </div>
            )}
          </div>

          {/* ۲. خدمات آنلاین (Online Services) Multi-Level Accordion */}
          <div className={`rounded-2xl border transition overflow-hidden ${
            activeView === 'services' || activeView === 'service-detail' ? 'border-blue-200 bg-blue-50/30' : 'border-slate-100 bg-slate-50/40'
          }`}>
            <button
              onClick={() => setOpenSubmenu(openSubmenu === 'services' ? null : 'services')}
              className={`w-full min-h-12 flex items-center justify-between gap-3 p-3 transition text-xs leading-5 font-bold ${
                activeView === 'services' || activeView === 'service-detail' ? 'text-blue-700 font-extrabold' : 'text-slate-800 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <Globe className={`w-4 h-4 ${activeView === 'services' || activeView === 'service-detail' ? 'text-blue-600' : 'text-slate-500'}`} />
                <span>خدمات آنلاین</span>
              </div>
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${openSubmenu === 'services' ? 'rotate-180 text-blue-600' : 'text-slate-400'}`} />
            </button>

            {openSubmenu === 'services' && (
              <div className="p-2 space-y-1 bg-white border-t border-slate-100">
                {serviceCategories.length ? serviceCategories.map((category) => {
                  return (
                  <button
                    key={category}
                    onClick={() => {
                      navigateToServiceCategory(category);
                      setMobileDrawerOpen(false);
                    }}
                    className="w-full min-h-11 text-right p-2.5 rounded-xl hover:bg-blue-50 text-xs leading-5 font-semibold text-slate-700 transition whitespace-normal"
                  >
                    <b className="block">{category}</b>
                  </button>
                ); }) : <p className="px-2 py-3 text-center text-xs leading-5 text-slate-500">هنوز دستهٔ فعالی برای نمایش وجود ندارد.</p>}

                <button
                  onClick={() => {
                    setActiveView('services');
                    setMobileDrawerOpen(false);
                  }}
                  className="w-full text-center py-2 text-xs font-bold text-blue-600 bg-blue-50 rounded-xl transition cursor-pointer"
                >
                  همه خدمات آنلاین ←
                </button>
              </div>
            )}
          </div>

          {/* ۳. مجله و راهنما (Magazine) */}
          <button
            onClick={() => {
              setActiveView('magazine');
              setMobileDrawerOpen(false);
            }}
            className={`w-full flex items-center justify-between p-3 rounded-2xl transition text-xs font-bold ${
              activeView === 'magazine' ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-3">
              <FileText className={`w-4 h-4 ${activeView === 'magazine' ? 'text-blue-600' : 'text-slate-500'}`} />
              <span>مجله و راهنما</span>
            </div>
            {activeView === 'magazine' && <span className="w-2 h-2 rounded-full bg-blue-600" />}
          </button>

          {/* ۴. درباره ما (About) */}
          <button
            onClick={() => {
              setActiveView('about');
              setMobileDrawerOpen(false);
            }}
            className={`w-full flex items-center justify-between p-3 rounded-2xl transition text-xs font-bold ${
              activeView === 'about' ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-3">
              <Info className={`w-4 h-4 ${activeView === 'about' ? 'text-blue-600' : 'text-slate-500'}`} />
              <span>درباره ما</span>
            </div>
            {activeView === 'about' && <span className="w-2 h-2 rounded-full bg-blue-600" />}
          </button>

          {/* ۵. تماس با ما (Contact) */}
          <button
            onClick={() => {
              setActiveView('contact');
              setMobileDrawerOpen(false);
            }}
            className={`w-full flex items-center justify-between p-3 rounded-2xl transition text-xs font-bold ${
              activeView === 'contact' ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-3">
              <Phone className={`w-4 h-4 ${activeView === 'contact' ? 'text-blue-600' : 'text-slate-500'}`} />
              <span>تماس با ما</span>
            </div>
            {activeView === 'contact' && <span className="w-2 h-2 rounded-full bg-blue-600" />}
          </button>


        </div>

        {/* Footer Support Info */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/80 text-center space-y-1">
          <div className="text-[11px] text-slate-500">پشتیبانی ۲۴ ساعته تلفنی</div>
          <div className="text-xs font-black text-slate-800 font-sans">۰۲۱-۸۸۸۸۹۹۹۹</div>
        </div>

      </div>
    </div>
  );
};
