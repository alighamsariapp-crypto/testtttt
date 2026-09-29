import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';
import { Header } from './components/Header';
import { MobileDrawer } from './components/MobileDrawer';
import { MobileBottomNav } from './components/MobileBottomNav';
import { SearchOverlay } from './components/SearchOverlay';
import { HeroSection } from './components/HeroSection';
import { QuickAccessGrid } from './components/QuickAccessGrid';
import { PopularProducts } from './components/PopularProducts';
import { SpecialDeals } from './components/SpecialDeals';
import { FeaturedServiceBanner } from './components/FeaturedServiceBanner';
import { PartnersSection } from './components/PartnersSection';
import { ValueProps } from './components/ValueProps';
import { Footer } from './components/Footer';
import { AuthModal } from './components/AuthModal';
import { ErrorBoundary } from './components/common/ErrorBoundary';

function lazyWithRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<any>,
  namedExport?: string
) {
  return React.lazy(async () => {
    try {
      const module = await factory();
      const comp = (namedExport && module[namedExport]) || module.default || (namedExport ? undefined : Object.values(module)[0]);
      if (!comp) {
        throw new Error(`Component export "${namedExport || 'default'}" not found in module`);
      }
      return { default: comp };
    } catch (err) {
      console.warn(`Dynamic import failed for ${namedExport || 'module'}, retrying...`, err);
      await new Promise((resolve) => setTimeout(resolve, 500));
      const module = await factory();
      const comp = (namedExport && module[namedExport]) || module.default || (namedExport ? undefined : Object.values(module)[0]);
      if (!comp) {
        throw new Error(`Component export "${namedExport || 'default'}" not found after retry`);
      }
      return { default: comp };
    }
  });
}

// Secondary routes are loaded only when a visitor opens them. This preserves
// existing paths and UI while keeping the initial storefront download smaller.
const CatalogView = lazyWithRetry(() => import('./components/CatalogView'), 'CatalogView');
const ProductDetailView = lazyWithRetry(() => import('./components/ProductDetailView'), 'ProductDetailView');
const ServicesView = lazyWithRetry(() => import('./components/ServicesView'), 'ServicesView');
const OnlineServiceDetailView = lazyWithRetry(() => import('./components/OnlineServiceDetailView'), 'OnlineServiceDetailView');
const CartView = lazyWithRetry(() => import('./components/CartView'), 'CartView');
const CheckoutView = lazyWithRetry(() => import('./components/CheckoutView'), 'CheckoutView');
const MagazineView = lazyWithRetry(() => import('./components/MagazineView'), 'MagazineView');
const ArticleDetailView = lazyWithRetry(() => import('./components/ArticleDetailView'), 'ArticleDetailView');
const AboutView = lazyWithRetry(() => import('./components/AboutView'), 'AboutView');
const ContactView = lazyWithRetry(() => import('./components/ContactView'), 'ContactView');
const ProfileView = lazyWithRetry(() => import('./components/ProfileView'), 'ProfileView');
const PaymentStatusView = lazyWithRetry(() => import('./components/PaymentStatusView'), 'PaymentStatusView');
const AuthView = lazyWithRetry(() => import('./components/AuthView'), 'AuthView');
const TypographyTestView = lazyWithRetry(() => import('./components/TypographyTestView'), 'TypographyTestView');
const NotFoundView = lazyWithRetry(() => import('./components/NotFoundView'), 'NotFoundView');
const AdminLayout = lazyWithRetry(() => import('./components/admin/AdminLayout'), 'AdminLayout');

const RouteFallback: React.FC = () => (
  <div className="min-h-[18rem] max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6" aria-busy="true" aria-live="polite" aria-label="در حال بارگذاری صفحه">
    <div className="rounded-3xl border border-slate-100 bg-white p-5 sm:p-7 shadow-xs space-y-5">
      <div className="h-5 w-36 rounded-lg bg-slate-100 animate-pulse" />
      <div className="h-9 w-2/3 max-w-md rounded-xl bg-slate-100 animate-pulse" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3">
        {[1, 2, 3].map((item) => <div key={item} className="h-28 rounded-2xl bg-slate-50 animate-pulse" />)}
      </div>
      <span className="sr-only">در حال آماده‌سازی محتوا</span>
    </div>
  </div>
);

const MainLayout: React.FC = () => {
  const { activeView, toast, hideToast } = useApp();

  // Admin view has its own standalone dedicated layout
  if (activeView === 'admin') {
    return (
      <>
        {/* Global Toast Notification */}
        {toast && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[110] animate-in fade-in slide-in-from-top-4 duration-300 max-w-md w-[92%] sm:w-auto">
            <div className={`p-3.5 sm:px-5 sm:py-3.5 rounded-2xl shadow-2xl border flex items-center gap-3 backdrop-blur-md ${
              toast.type === 'success'
                ? 'bg-emerald-900/90 text-white border-emerald-500/30'
                : toast.type === 'error'
                ? 'bg-rose-900/90 text-white border-rose-500/30'
                : 'bg-slate-900/90 text-white border-slate-700/50'
            }`}>
              {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
              {toast.type === 'error' && <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />}
              {toast.type === 'info' && <Info className="w-5 h-5 text-blue-400 shrink-0" />}
              <span className="text-xs sm:text-sm font-bold tracking-tight">{toast.message}</span>
              <button
                onClick={hideToast}
                className="min-w-9 min-h-9 p-1 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition ml-auto"
                aria-label="بستن پیام"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
        <React.Suspense fallback={<RouteFallback />}>
          <AdminLayout />
        </React.Suspense>
      </>
    );
  }

  const isStandalonePage = activeView === 'payment-status' || activeView === 'auth';

  return (
    <div className="storefront-theme min-h-screen bg-slate-50/50 text-slate-900 font-sans flex flex-col selection:bg-blue-600/20 selection:text-blue-900">
      {/* Global Toast Notification */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[110] animate-in fade-in slide-in-from-top-4 duration-300 max-w-md w-[92%] sm:w-auto">
          <div className={`p-3.5 sm:px-5 sm:py-3.5 rounded-2xl shadow-2xl border flex items-center gap-3 backdrop-blur-md ${
            toast.type === 'success'
              ? 'bg-emerald-900/90 text-white border-emerald-500/30'
              : toast.type === 'error'
              ? 'bg-rose-900/90 text-white border-rose-500/30'
              : 'bg-slate-900/90 text-white border-slate-700/50'
          }`}>
            {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
            {toast.type === 'error' && <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />}
            {toast.type === 'info' && <Info className="w-5 h-5 text-blue-400 shrink-0" />}
            <span className="text-xs sm:text-sm font-bold tracking-tight">{toast.message}</span>
            <button
              onClick={hideToast}
              className="p-1 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition ml-auto"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Desktop & Mobile Top Header */}
      {!isStandalonePage && <Header />}

      {/* Slide-in Mobile Drawer */}
      <MobileDrawer />

      {/* Fullscreen Mobile Search Overlay */}
      <SearchOverlay />

      {/* Auth Modal */}
      <AuthModal />

      {/* Dynamic Main View Switcher */}
      <main className="flex-1">
        <ErrorBoundary>
          <React.Suspense fallback={<RouteFallback />}>
            {activeView === 'home' && (
              <>
                <HeroSection />
                <QuickAccessGrid />
                <PopularProducts />
                <SpecialDeals />
                <FeaturedServiceBanner />
                <PartnersSection />
                <ValueProps />
              </>
            )}

            {activeView === 'store' && <CatalogView />}
            {activeView === 'product-detail' && <ProductDetailView />}
            {activeView === 'services' && <ServicesView />}
            {activeView === 'service-detail' && <OnlineServiceDetailView />}
            {activeView === 'cart' && <CartView />}
            {activeView === 'checkout' && <CheckoutView />}
            {activeView === 'payment-status' && <PaymentStatusView />}
            {activeView === 'auth' && <AuthView />}
            {activeView === 'magazine' && <MagazineView />}
            {activeView === 'article' && <ArticleDetailView />}
            {activeView === 'about' && <AboutView />}
            {activeView === 'contact' && <ContactView />}
            {activeView === 'profile' && <ProfileView />}
            {activeView === 'typography-test' && <TypographyTestView />}
            {activeView === 'not-found' && <NotFoundView />}
          </React.Suspense>
        </ErrorBoundary>
      </main>

      {/* Global Footer (only on standard pages) */}
      {!isStandalonePage && <Footer />}

      {/* Fixed Mobile Bottom Navigation Bar */}
      {!isStandalonePage && <MobileBottomNav />}
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
}
