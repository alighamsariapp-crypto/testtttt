import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { 
  ActiveView, 
  CartItem, 
  CartSummary, 
  Category, 
  CouponData, 
  Product, 
  ProductVariant,
  ServiceItem, 
  ThemeSettings, 
  UserAddress, 
  UserProfile,
  PaymentStatusData,
  PaymentStatusType,
  ProfileSubView,
  UserOrder,
  SupportTicket,
  TicketMessage,
  ActiveSession,
  WalletTransaction,
  AdminSubTab,
  BlogPost,
  StaticPagesContent,
  AppearanceSettings,
  PaymentGatewayConfig,
  GatewayProvider,
  SmsPanelConfig,
  SmsTemplateConfig,
  DiscountCoupon,
  StoreSettings,
  CheckoutConfiguration,
  CheckoutPaymentMethod,
  SmsConnectionInfo,
  SmsSystemConfiguration
} from '../types';
import { api, isDemoMode } from '../services/api';
import { mapOrder, mapProduct, mapTicket, mapUser } from '../services/apiMappers';
import { getDefaultSellableVariant, isProductPurchasable, isSellableVariant } from '../utils/productAvailability';
import { 
  initialCartItems, 
  initialThemeSettings, 
  mockUserAddresses, 
  mockUserProfile, 
  mockUserOrders, 
  mockAllOrders,
  mockAllUsers,
  mockSupportTickets, 
  mockActiveSessions, 
  mockWalletTransactions,
  initialAppearanceSettings,
  initialStaticPagesContent,
  initialBlogPosts,
  initialPaymentGateways,
  initialSmsConfig,
  initialSmsSystemConfiguration,
  mockDiscountCoupons,
  initialStoreSettings,
  initialCheckoutConfiguration
} from '../services/mockData';
import { updateDocumentSEO } from '../utils/seo';
import { 
  normalizeCategorySlug, 
  findCategoryBySlug, 
  getCategoryAncestors, 
  flattenCategories,
  getCategoryDescendantSlugs
} from '../utils/categoryHelpers';
import { SESSION_STATE_KEYS, clearSessionState, clearSessionStateByPrefix, readSessionState, writeSessionState } from '../utils/sessionState';

const toStorefrontColor = (value: string | undefined, fallback: string): string => /^#[0-9a-fA-F]{6}$/.test(value ?? '') ? value! : fallback;

const readCheckoutStep = (): 1 | 2 | 3 => {
  const savedStep = readSessionState<unknown>(SESSION_STATE_KEYS.checkoutStep, 1);
  return savedStep === 2 || savedStep === 3 ? savedStep : 1;
};

const readPaymentMethod = (): CheckoutPaymentMethod => {
  const stored = readSessionState<unknown>(SESSION_STATE_KEYS.checkoutPaymentMethod, 'online');
  return stored === 'wallet' || stored === 'bank_transfer' ? stored : 'online';
};

const readPaymentReturn = (): PaymentStatusData => {
  const fallback: PaymentStatusData = {
    status: 'pending',
    orderNumber: '',
    amount: 0,
    isVerified: false,
    isLoading: false,
  };
  if (typeof window === 'undefined' || window.location.pathname !== '/payment-status') return fallback;

  const searchParams = new URLSearchParams(window.location.search);
  const hashString = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
  const hashParams = new URLSearchParams(hashString);

  const orderNumber = searchParams.get('order') || searchParams.get('identifier') || hashParams.get('order') || '';
  const exchangeCode = searchParams.get('exchange_code') || searchParams.get('code') || hashParams.get('exchange_code') || hashParams.get('code') || undefined;
  const fragmentToken = hashParams.get('token') || undefined;
  const errorCode = searchParams.get('error') || hashParams.get('error') || undefined;

  // Security Hardening: Immediately remove exchange code, secret tokens, and hash fragments from URL
  // to prevent leakage via browser history, server logs, screenshots, and referrer headers.
  try {
    const hasSensitiveParams = searchParams.has('exchange_code') || searchParams.has('code') || searchParams.has('token') || Boolean(window.location.hash);
    if (hasSensitiveParams) {
      const cleanUrl = window.location.pathname + (orderNumber ? `?order=${encodeURIComponent(orderNumber)}` : '');
      window.history.replaceState({}, document.title, cleanUrl);
    }
  } catch {}

  // Security Trust Boundary: Query parameters are user-controlled and MUST NOT be
  // the source of truth for payment status, amounts, gateways, or reference IDs.
  // Financial truth is strictly verified server-side.
  return {
    status: 'pending',
    orderNumber,
    statusToken: fragmentToken,
    exchangeCode,
    amount: 0,
    isVerified: false,
    isLoading: Boolean(orderNumber),
    errorCode,
  };
};

// The admin writer uses the Laravel payload name `stock`, while storefront variants
// consume `stock_quantity`. Keep this conversion limited to the local demo cache;
// real API responses already use the storefront contract.
const normalizeDemoProductVariants = (variants: Product['variants'] | undefined, productId: number, fallbackPrice: number): ProductVariant[] | undefined => {
  if (!variants) return undefined;
  return variants.map((variant, index) => {
    const candidate = variant as ProductVariant & { stock?: unknown };
    const rawId = Number(candidate.id);
    const rawStock = Number(candidate.stock_quantity ?? candidate.stock ?? 0);
    const effectivePrice = Number(candidate.effective_price ?? candidate.price_override ?? fallbackPrice);
    return {
      ...candidate,
      id: Number.isFinite(rawId) && rawId > 0 ? rawId : productId + index + 1,
      product_id: productId,
      effective_price: Number.isFinite(effectivePrice) ? effectivePrice : fallbackPrice,
      stock_quantity: Number.isFinite(rawStock) ? Math.max(0, Math.floor(rawStock)) : 0,
      is_active: candidate.is_active ?? true,
      image_url: candidate.image_url ?? candidate.attributes?.image_url,
    };
  });
};

interface ParsedRoute {
  view: ActiveView;
  productSlug?: string;
  serviceSlug?: string;
  serviceCategory?: string;
  categorySlug?: string;
  categoryHierarchy?: string[];
  articleSlug?: string;
}

interface AppContextType {
  // Navigation & Views
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
  selectedProductSlug: string | null;
  setSelectedProductSlug: (slug: string | null) => void;
  selectedArticleSlug: string | null;
  setSelectedArticleSlug: (slug: string | null) => void;
  selectedCategorySlug: string | null;
  setSelectedCategorySlug: (slug: string | null) => void;
  categoryHierarchy: string[];
  setCategoryHierarchy: (hierarchy: string[]) => void;
  selectedServiceSlug: string | null;
  setSelectedServiceSlug: (slug: string | null) => void;
  selectedServiceCategory: string | null;
  setSelectedServiceCategory: (category: string | null) => void;

  // Direct Semantic Navigators (Deep linking & browser history push)
  navigateToCategory: (slug: string | null, hierarchy?: string[]) => void;
  navigateToProduct: (slug: string) => void;
  navigateToArticle: (slug: string) => void;
  navigateToService: (slug: string) => void;
  navigateToServiceCategory: (category: string) => void;
  navigateTo: (view: ActiveView, customPath?: string) => void;
  copyShareLink: (customPath?: string) => Promise<boolean>;

  // Modals & Drawers
  isMobileDrawerOpen: boolean;
  setMobileDrawerOpen: (open: boolean) => void;
  isSearchOverlayOpen: boolean;
  setSearchOverlayOpen: (open: boolean) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  isAuthModalOpen: boolean;
  setAuthModalOpen: (open: boolean) => void;
  isAdminCustomizerOpen: boolean;
  setAdminCustomizerOpen: (open: boolean) => void;
  activeMegaMenu: 'store' | 'services' | null;
  setActiveMegaMenu: (menu: 'store' | 'services' | null) => void;

  // Data
  categories: Category[];
  products: Product[];
  services: ServiceItem[];
  isLoadingData: boolean;
  isFilterLoading: boolean;
  setIsFilterLoading: (loading: boolean) => void;
  refreshCatalog: () => void;

  // Cart & Multi-Step Checkout
  checkoutStep: 1 | 2 | 3;
  setCheckoutStep: (step: 1 | 2 | 3) => void;
  cart: CartItem[];
  cartSummary: CartSummary;
  addToCart: (product: Product, quantity?: number, variantId?: number) => Promise<boolean>;
  updateCartQuantity: (itemKey: string, quantity: number) => void;
  removeFromCart: (itemKey: string) => void;
  clearCart: () => void;
  refreshCart: () => Promise<void>;

  // Coupons
  appliedCoupon: CouponData | null;
  applyCoupon: (code: string) => Promise<{ success: boolean; message: string }> | { success: boolean; message: string };
  removeCoupon: () => void;

  // Addresses
  addresses: UserAddress[];
  selectedAddressId: number | null;
  setSelectedAddressId: (id: number | null) => void;
  addAddress: (addr: Omit<UserAddress, 'id'>) => Promise<UserAddress>;
  updateAddress: (id: number, addr: Partial<UserAddress>) => Promise<UserAddress>;
  deleteAddress: (id: number) => void;

  // Payment
  paymentMethod: CheckoutPaymentMethod;
  setPaymentMethod: (method: CheckoutPaymentMethod) => void;
  paymentStatusData: PaymentStatusData;
  setPaymentStatusData: (data: PaymentStatusData) => void;
  triggerPaymentStatus: (data: Partial<PaymentStatusData>) => void;

  // Favorites
  favorites: number[];
  toggleFavorite: (productId: number) => void;
  isFavorite: (productId: number) => boolean;

  // User & Auth
  user: UserProfile | null;
  updateUserProfile: (updates: Partial<UserProfile>) => Promise<void>;
  updatePassword: (currentPassword: string, newPassword: string, confirmation: string) => Promise<void>;
  login: (email: string, password: string, options?: { suppressSuccessToast?: boolean }) => Promise<UserProfile>;
  loginWithPhone: (phone: string, code: string) => Promise<void>;
  sendOtpCode: (phone: string) => Promise<{ success: boolean; message: string; expiresIn: number }>;
  requestPasswordResetSms: (phone: string) => Promise<{ success: boolean; message: string; expiresIn: number; resendIn: number }>;
  resetPasswordWithSms: (payload: { phone: string; code: string; password: string; password_confirmation: string }) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => void;

  // Profile Specific State & Actions
  profileSubTab: ProfileSubView;
  setProfileSubTab: (tab: ProfileSubView) => void;
  openProfileTab: (tab: ProfileSubView) => void;
  
  // Orders
  userOrders: UserOrder[];
  cancelOrder: (orderId: string) => void;
  reorderItems: (order: UserOrder) => void;

  // Support Tickets
  supportTickets: SupportTicket[];
  addSupportTicket: (ticket: { title: string; department: SupportTicket['department']; priority: SupportTicket['priority']; message: string }) => Promise<SupportTicket>;
  addTicketReply: (ticketId: string, message: string) => Promise<void>;
  closeSupportTicket: (ticketId: string) => void;
  refreshSupportTickets: () => Promise<void>;

  // Active Sessions
  activeSessions: ActiveSession[];
  terminateSession: (sessionId: string) => void;
  terminateOtherSessions: () => void;

  // Wallet
  walletTransactions: WalletTransaction[];
  addWalletCredit: (amount: number, description?: string) => void;

  // Toast Notifications
  toast: { message: string; type: 'success' | 'info' | 'error' } | null;
  showToast: (message: string, type?: 'success' | 'info' | 'error') => void;
  hideToast: () => void;

  // Theme & Branding
  themeSettings: ThemeSettings;
  updateThemeSettings: (settings: Partial<ThemeSettings>) => void;

  // ================= ADMIN PANEL STATES & ACTIONS =================
  adminSubTab: AdminSubTab;
  setAdminSubTab: (tab: AdminSubTab) => void;
  openAdminTab: (tab: AdminSubTab) => void;

  // Appearance CMS
  appearanceSettings: AppearanceSettings;
  updateAppearanceSettings: (settings: Partial<AppearanceSettings>) => Promise<void>;

  // Static Pages CMS
  staticContent: StaticPagesContent;
  updateStaticContent: <K extends keyof StaticPagesContent>(section: K, data: Partial<StaticPagesContent[K]>) => Promise<void>;

  // Blog CMS
  blogPosts: BlogPost[];
  addBlogPost: (post: Omit<BlogPost, 'id' | 'views'>) => Promise<BlogPost>;
  updateBlogPost: (id: number, post: Partial<BlogPost>) => Promise<void>;
  deleteBlogPost: (id: number) => Promise<void>;

  // Operational checkout settings
  checkoutConfiguration: CheckoutConfiguration;
  updateCheckoutConfiguration: (config: CheckoutConfiguration) => Promise<void>;

  // Operational Kavenegar SMS settings (admin-only API key)
  smsSystemConfiguration: SmsSystemConfiguration;
  updateSmsSystemConfiguration: (config: SmsSystemConfiguration) => Promise<void>;
  testSmsSystemConnection: () => Promise<SmsConnectionInfo>;

  // Payment Gateways Config
  paymentGateways: PaymentGatewayConfig[];
  updatePaymentGateway: (id: GatewayProvider, updates: Partial<PaymentGatewayConfig>) => void;
  setDefaultPaymentGateway: (id: GatewayProvider) => void;

  // SMS Panel Config
  smsConfig: SmsPanelConfig;
  updateSmsConfig: (updates: Partial<SmsPanelConfig>) => void;
  updateSmsTemplate: (key: keyof SmsPanelConfig['templates'], updates: Partial<SmsTemplateConfig>) => void;
  sendTestSms: (phone: string, text: string) => Promise<{ success: boolean; message: string }>;

  // Product Operations (Admin)
  addProduct: (product: Omit<Product, 'id'>) => Promise<Product>;
  updateProduct: (id: number, updates: Partial<Product>) => Promise<Product>;
  deleteProduct: (id: number) => void;
  toggleProductStock: (id: number) => void;
  toggleProductFeatured: (id: number) => void;
  toggleProductActive: (id: number) => void;

  // Category Operations (Admin)
  addCategory: (category: Omit<Category, 'id'>) => Category;
  updateCategory: (id: number, updates: Partial<Category>) => void;
  deleteCategory: (id: number) => void;

  // Order Operations (Admin)
  allOrders: UserOrder[];
  updateOrderStatus: (orderId: string, status: UserOrder['status'], trackingCode?: string) => void;
  deleteOrder: (orderId: string) => void;

  // User Management (Admin)
  allUsers: UserProfile[];
  updateUserRole: (userId: number, role: UserProfile['role'], status?: UserProfile['status']) => Promise<void>;
  updateUserStatus: (userId: number, status: 'active' | 'suspended') => Promise<void>;
  adjustUserWallet: (userId: number, amount: number, note: string) => Promise<void>;

  // Ticket Operations (Admin)
  adminReplyTicket: (ticketId: string, message: string, newStatus?: SupportTicket['status']) => Promise<void>;
  updateTicketStatus: (ticketId: string, status: SupportTicket['status'], priority?: SupportTicket['priority']) => Promise<void>;
  markAdminTicketRead: (ticketId: string) => Promise<void>;
  archiveAdminTicket: (ticketId: string) => Promise<void>;
  restoreAdminTicket: (ticketId: string) => Promise<void>;
  deleteAdminTicket: (ticketId: string) => Promise<void>;

  // Discount Coupons (Admin)
  discountCoupons: DiscountCoupon[];
  addDiscountCoupon: (coupon: Omit<DiscountCoupon, 'id'>) => DiscountCoupon;
  deleteDiscountCoupon: (id: string) => void;
  toggleDiscountCoupon: (id: string) => void;

  // Store Settings (Admin)
  storeSettings: StoreSettings;
  updateStoreSettings: (settings: Partial<StoreSettings>) => void;

  // Auth Helpers
  loginAsAdminDemo: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Helper to construct exact URL from view state
export const buildPathFromState = (
  view: ActiveView,
  prodSlug?: string | null,
  servSlug?: string | null,
  catSlug?: string | null,
  hierarchy?: string[],
  articleSlug?: string | null,
  serviceCategory?: string | null,
): string => {
  switch (view) {
    case 'home':
      return '/';
    case 'admin':
      return '/admin';
    case 'store':
      if (hierarchy && hierarchy.length > 0) {
        return `/store/${hierarchy.join('/')}`;
      }
      if (catSlug) {
        return `/store/${catSlug}`;
      }
      return '/store';
    case 'product-detail':
      return prodSlug ? `/product/${prodSlug}` : '/store';
    case 'services':
      return serviceCategory ? `/services/category/${encodeURIComponent(serviceCategory)}` : '/services';
    case 'service-detail':
      return servSlug ? `/services/${servSlug}` : '/services';
    case 'cart':
      return '/cart';
    case 'checkout':
      return '/checkout';
    case 'payment-status':
      return '/payment-status';
    case 'auth':
      return '/auth';
    case 'profile':
      return '/profile';
    case 'orders':
      return '/orders';
    case 'magazine':
      return '/magazine';
    case 'article':
      return articleSlug ? `/magazine/${articleSlug}` : '/magazine';
    case 'about':
      return '/about';
    case 'contact':
      return '/contact';
    case 'typography-test':
      return '/typography-test';
    case 'not-found':
      return typeof window !== 'undefined' ? window.location.pathname : '/404';
    default:
      return '/';
  }
};

// Robust URL Parser for direct access, reloads & shared links
export const parseRouteFromPath = (pathname: string): ParsedRoute => {
  // Normalize path (remove trailing slash except root)
  const path = pathname.replace(/\/$/, '') || '/';

  if (path === '/' || path === '') return { view: 'home' };
  if (path === '/admin' || path.startsWith('/admin/')) return { view: 'admin' };
  if (path === '/cart') return { view: 'cart' };
  if (path === '/checkout') return { view: 'checkout' };
  if (path === '/payment-status') return { view: 'payment-status' };
  if (path === '/auth') return { view: 'auth' };
  if (path === '/profile') return { view: 'profile' };
  if (path === '/orders') return { view: 'orders' };
  if (path.startsWith('/magazine/')) {
    const articleSlug = path.replace('/magazine/', '').trim();
    return articleSlug ? { view: 'article', articleSlug } : { view: 'magazine' };
  }
  if (path === '/magazine') return { view: 'magazine' };
  if (path === '/about') return { view: 'about' };
  if (path === '/contact') return { view: 'contact' };
  if (path === '/typography-test') return { view: 'typography-test' };

  if (path === '/services') return { view: 'services' };
  if (path.startsWith('/services/category/')) {
    const serviceCategory = path.replace('/services/category/', '').trim();
    return serviceCategory ? { view: 'services', serviceCategory: decodeURIComponent(serviceCategory) } : { view: 'services' };
  }
  if (path.startsWith('/services/') || path.startsWith('/service/')) {
    const sSlug = path.replace(/^\/services?\//, '').trim();
    if (sSlug) {
      return { view: 'service-detail', serviceSlug: sSlug };
    }
    return { view: 'services' };
  }

  if (path === '/product') {
    return { view: 'product-detail', productSlug: 'not-found' };
  }

  if (path.startsWith('/product/')) {
    const pSlug = path.replace('/product/', '').trim();
    return { view: 'product-detail', productSlug: pSlug || 'not-found' };
  }

  // Handle /category/:slug alias
  if (path.startsWith('/category/')) {
    const cSlug = path.replace('/category/', '').trim();
    if (cSlug) {
      return { view: 'store', categorySlug: cSlug, categoryHierarchy: [cSlug] };
    }
    return { view: 'store', categorySlug: undefined, categoryHierarchy: [] };
  }

  // Handle /store and nested /store/:level1/:level2/:level3
  if (path === '/store') {
    return { view: 'store', categorySlug: undefined, categoryHierarchy: [] };
  }

  if (path.startsWith('/store/')) {
    const segments = path.replace('/store/', '').split('/').filter(Boolean);
    if (segments.length > 0) {
      const activeSlug = segments[segments.length - 1];
      return {
        view: 'store',
        categorySlug: activeSlug,
        categoryHierarchy: segments,
      };
    }
    return { view: 'store', categorySlug: undefined, categoryHierarchy: [] };
  }

  // Any unmatched / invalid URL gets a real 404 NotFound state
  return { view: 'not-found' };
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Initialize state from current window pathname
  const initialRoute = typeof window !== 'undefined' 
    ? parseRouteFromPath(window.location.pathname) 
    : { view: 'home' as ActiveView };

  const [activeView, setActiveViewState] = useState<ActiveView>(initialRoute.view);
  const [selectedProductSlug, setSelectedProductSlug] = useState<string | null>(initialRoute.productSlug || null);
  const [selectedArticleSlug, setSelectedArticleSlug] = useState<string | null>(initialRoute.articleSlug || null);
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string | null>(initialRoute.categorySlug || null);
  const [categoryHierarchy, setCategoryHierarchy] = useState<string[]>(initialRoute.categoryHierarchy || (initialRoute.categorySlug ? [initialRoute.categorySlug] : []));
  const [selectedServiceSlug, setSelectedServiceSlug] = useState<string | null>(initialRoute.serviceSlug || null);
  const [selectedServiceCategory, setSelectedServiceCategory] = useState<string | null>(initialRoute.serviceCategory || null);
  const [isFilterLoading, setIsFilterLoading] = useState(false);

  // Core Data
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Sync state to URL and scroll smoothly/instantly to top
  const syncRouteToHistory = useCallback((
    view: ActiveView, 
    prodSlug?: string | null, 
    servSlug?: string | null, 
    catSlug?: string | null,
    hierarchy?: string[],
    articleSlug?: string | null,
    serviceCategory?: string | null,
  ) => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      const targetPath = buildPathFromState(view, prodSlug, servSlug, catSlug, hierarchy, articleSlug, serviceCategory);
      if (window.location.pathname !== targetPath) {
        window.history.pushState({ view, prodSlug, catSlug, hierarchy, articleSlug, serviceCategory }, '', targetPath);
      }
    }
  }, []);

  // Standard setActiveView
  const setActiveView = useCallback((view: ActiveView) => {
    setActiveViewState(view);
    if (view === 'store' && !selectedCategorySlug) {
      syncRouteToHistory('store', null, null, null, []);
    } else if (view === 'home') {
      setSelectedCategorySlug(null);
      setCategoryHierarchy([]);
      syncRouteToHistory('home');
    } else if (view === 'services') {
      setSelectedServiceCategory(null);
      syncRouteToHistory('services');
    } else {
      syncRouteToHistory(view, selectedProductSlug, selectedServiceSlug, selectedCategorySlug, categoryHierarchy, selectedArticleSlug, selectedServiceCategory);
    }
  }, [selectedProductSlug, selectedServiceSlug, selectedCategorySlug, categoryHierarchy, selectedArticleSlug, selectedServiceCategory, syncRouteToHistory]);

  // Dedicated Category Navigator
  const navigateToCategory = useCallback((slug: string | null, hierarchy: string[] = []) => {
    if (!slug) {
      setSelectedCategorySlug(null);
      setCategoryHierarchy([]);
      setActiveViewState('store');
      syncRouteToHistory('store', null, null, null, []);
      return;
    }

    let computedHierarchy = hierarchy && hierarchy.length > 0 ? hierarchy : [];
    if (computedHierarchy.length === 0 && categories.length > 0) {
      const ancestors = getCategoryAncestors(slug, categories);
      if (ancestors.length > 0) {
        computedHierarchy = ancestors.map(a => a.slug);
      } else {
        computedHierarchy = [slug];
      }
    } else if (computedHierarchy.length === 0) {
      computedHierarchy = [slug];
    }

    setSelectedCategorySlug(slug);
    setCategoryHierarchy(computedHierarchy);
    setActiveViewState('store');
    syncRouteToHistory('store', null, null, slug, computedHierarchy);
  }, [categories, syncRouteToHistory]);

  // Dedicated Product Navigator
  const navigateToProduct = useCallback((slug: string) => {
    setSelectedProductSlug(slug);
    setActiveViewState('product-detail');
    syncRouteToHistory('product-detail', slug);
  }, [syncRouteToHistory]);

  // Dedicated Article Navigator
  const navigateToArticle = useCallback((slug: string) => {
    setSelectedArticleSlug(slug);
    setActiveViewState('article');
    syncRouteToHistory('article', null, null, null, [], slug);
  }, [syncRouteToHistory]);

  // Dedicated Service Navigator
  const navigateToService = useCallback((slug: string) => {
    setSelectedServiceSlug(slug);
    setSelectedServiceCategory(null);
    setActiveViewState('service-detail');
    syncRouteToHistory('service-detail', null, slug);
  }, [syncRouteToHistory]);

  const navigateToServiceCategory = useCallback((category: string) => {
    setSelectedServiceSlug(null);
    setSelectedServiceCategory(category);
    setActiveViewState('services');
    syncRouteToHistory('services', null, null, null, [], null, category);
  }, [syncRouteToHistory]);

  // Generic Navigator
  const navigateTo = useCallback((view: ActiveView, customPath?: string) => {
    setActiveViewState(view);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      const targetPath = customPath || buildPathFromState(view, selectedProductSlug, selectedServiceSlug, selectedCategorySlug, categoryHierarchy, selectedArticleSlug);
      if (window.location.pathname !== targetPath) {
        window.history.pushState({ view }, '', targetPath);
      }
    }
  }, [selectedProductSlug, selectedServiceSlug, selectedCategorySlug, categoryHierarchy, selectedArticleSlug]);

  // Browser Back/Forward PopState Handler
  useEffect(() => {
    const handlePopState = () => {
      const parsed = parseRouteFromPath(window.location.pathname);
      setActiveViewState(parsed.view);
      setSelectedProductSlug(parsed.productSlug || null);
      setSelectedArticleSlug(parsed.articleSlug || null);
      setSelectedServiceSlug(parsed.serviceSlug || null);
      setSelectedServiceCategory(parsed.serviceCategory || null);
      setSelectedCategorySlug(parsed.categorySlug || null);
      setCategoryHierarchy(parsed.categoryHierarchy || (parsed.categorySlug ? [parsed.categorySlug] : []));
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Synchronize SEO & Page Titles for Non-Product Views
  useEffect(() => {
    if (activeView === 'product-detail' || activeView === 'article') {
      // Handled dynamically inside the corresponding detail view.
      return;
    }

    if (activeView === 'home') {
      updateDocumentSEO({
        title: 'نوین‌نت | فروشگاه و خدمات آنلاین',
        description: 'فروشگاه و خدمات آنلاین نوین‌نت؛ خرید تجهیزات شبکه، سیم‌کارت و خدمات دیجیتال با پشتیبانی تخصصی.',
        canonical: '/',
        ogType: 'website'
      });
    } else if (activeView === 'store') {
      const activeCat = selectedCategorySlug ? findCategoryBySlug(selectedCategorySlug, categories) : null;
      const catTitle = activeCat ? `${activeCat.name} | نوین‌نت` : 'فروشگاه و محصولات | نوین‌نت';
      const categoryPath = categoryHierarchy.length > 0
        ? `/store/${categoryHierarchy.join('/')}`
        : selectedCategorySlug
          ? `/store/${selectedCategorySlug}`
          : '/store';
      updateDocumentSEO({
        title: catTitle,
        description: activeCat?.description || 'مشاهده و خرید تجهیزات شبکه، مودم، سیم‌کارت و خدمات دیجیتال نوین‌نت.',
        canonical: categoryPath,
        ogType: 'website'
      });
    } else if (activeView === 'cart' || activeView === 'checkout') {
      updateDocumentSEO({
        title: 'سبد خرید و تسویه حساب | نوین‌نت',
        description: 'مشاهده اقلام سبد خرید، ثبت آدرس و نهایی‌سازی سفارش در نوین‌نت.',
        canonical: '/cart',
        ogType: 'website'
      });
    } else if (activeView === 'services' || activeView === 'service-detail') {
      updateDocumentSEO({
        title: selectedServiceCategory ? `${selectedServiceCategory} | خدمات آنلاین نوین‌نت` : 'خدمات آنلاین | نوین‌نت',
        description: selectedServiceCategory ? `فهرست خدمات ${selectedServiceCategory} در نوین‌نت.` : 'دسترسی به خدمات آنلاین و دیجیتال نوین‌نت با پشتیبانی تخصصی.',
        canonical: selectedServiceCategory ? `/services/category/${encodeURIComponent(selectedServiceCategory)}` : '/services',
        ogType: 'website'
      });
    } else if (activeView === 'about') {
      updateDocumentSEO({
        title: 'درباره ما | نوین‌نت',
        description: 'آشنایی با نوین‌نت، خدمات و ارزش‌های ما.',
        canonical: '/about',
        ogType: 'website'
      });
    } else if (activeView === 'contact') {
      updateDocumentSEO({
        title: 'تماس با ما | نوین‌نت',
        description: 'راه‌های ارتباط با پشتیبانی نوین‌نت.',
        canonical: '/contact',
        ogType: 'website'
      });
    } else if (activeView === 'not-found') {
      updateDocumentSEO({
        title: 'صفحه یافت نشد (۴۰۴) | نوین‌نت',
        description: 'صفحه مورد نظر شما پیدا نشد.',
        canonical: window.location.pathname,
        ogType: 'website'
      });
    }
  }, [activeView, selectedCategorySlug, categoryHierarchy, selectedServiceCategory, categories]);

  // Multi-step Checkout State (1: Cart items, 2: Address, 3: Payment)
  // The current step is safe to keep for the current browser tab and restores a user
  // after an app remount (for example, when returning from Telegram).
  const [checkoutStep, setCheckoutStepState] = useState<1 | 2 | 3>(readCheckoutStep);

  const moveInternalViewToTop = useCallback((headingId: string) => {
    if (typeof window === 'undefined') return;

    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
      window.setTimeout(() => {
        document.getElementById(headingId)?.focus({ preventScroll: true });
      }, prefersReducedMotion ? 0 : 250);
    });
  }, []);

  const setCheckoutStep = useCallback((step: 1 | 2 | 3) => {
    setCheckoutStepState(step);
    moveInternalViewToTop('checkout-step-heading');
  }, [moveInternalViewToTop]);

  // Overlays
  const [isMobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [isSearchOverlayOpen, setSearchOverlayOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAuthModalOpen, setAuthModalOpen] = useState(false);
  const [isAdminCustomizerOpen, setAdminCustomizerOpen] = useState(false);
  const [activeMegaMenu, setActiveMegaMenu] = useState<'store' | 'services' | null>(null);

  // Cart & Favorites
  const [cart, setCart] = useState<CartItem[]>(() => {
    if (!isDemoMode) {
      return [];
    }
    try {
      const saved = localStorage.getItem('apex_cart');
      return saved ? JSON.parse(saved) : initialCartItems;
    } catch {
      return initialCartItems;
    }
  });
  const [serverCartSummary, setServerCartSummary] = useState<CartSummary | null>(null);

  const [favorites, setFavorites] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem('apex_favorites');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Addresses State
  const [addresses, setAddresses] = useState<UserAddress[]>(() => {
    if (!isDemoMode) return [];

    try {
      const saved = localStorage.getItem('apex_addresses');
      return saved ? JSON.parse(saved) : mockUserAddresses;
    } catch {
      return mockUserAddresses;
    }
  });

  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(() => {
    return readSessionState<number | null>(
      SESSION_STATE_KEYS.checkoutSelectedAddress,
      addresses.length > 0 ? (addresses[0].id ?? null) : null,
    );
  });

  // Coupon State
  const [appliedCoupon, setAppliedCoupon] = useState<CouponData | null>(() => {
    try {
      const saved = localStorage.getItem('apex_coupon');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Payment Method & Status State
  const [paymentMethod, setPaymentMethod] = useState<CheckoutPaymentMethod>(readPaymentMethod);
  const [paymentStatusData, setPaymentStatusData] = useState<PaymentStatusData>(readPaymentReturn);

  const triggerPaymentStatus = (data: Partial<PaymentStatusData>) => {
    setPaymentStatusData(prev => ({
      ...prev,
      ...data,
    }));
    setActiveView('payment-status');
  };

  // User
  const [user, setUser] = useState<UserProfile | null>(() => {
    if (!isDemoMode) return null;

    try {
      const saved = localStorage.getItem('apex_user');
      if (!saved) return mockUserProfile;
      const storedUser = JSON.parse(saved) as UserProfile & { avatar?: unknown };
      delete storedUser.avatar;
      return storedUser;
    } catch {
      return mockUserProfile;
    }
  });

  // Profile Active Sub-Tab
  const [profileSubTab, setProfileSubTabState] = useState<ProfileSubView>(() =>
    readSessionState<ProfileSubView>(SESSION_STATE_KEYS.profileSubTab, 'dashboard'),
  );

  const setProfileSubTab = useCallback((tab: ProfileSubView) => {
    setProfileSubTabState(tab);
    moveInternalViewToTop('profile-content-heading');
  }, [moveInternalViewToTop]);

  // User Orders
  const [userOrders, setUserOrders] = useState<UserOrder[]>(() => {
    if (!isDemoMode) return [];

    try {
      const saved = localStorage.getItem('apex_user_orders');
      return saved ? JSON.parse(saved) : mockUserOrders;
    } catch {
      return mockUserOrders;
    }
  });

  // Support Tickets
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>(() => {
    if (!isDemoMode) return [];

    try {
      const saved = localStorage.getItem('apex_support_tickets');
      return saved ? JSON.parse(saved) : mockSupportTickets;
    } catch {
      return mockSupportTickets;
    }
  });

  // Active Sessions
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>(() => {
    if (!isDemoMode) return [];

    try {
      const saved = localStorage.getItem('apex_active_sessions');
      return saved ? JSON.parse(saved) : mockActiveSessions;
    } catch {
      return mockActiveSessions;
    }
  });

  // Wallet Transactions
  const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>(() => {
    if (!isDemoMode) return [];

    try {
      const saved = localStorage.getItem('apex_wallet_transactions');
      return saved ? JSON.parse(saved) : mockWalletTransactions;
    } catch {
      return mockWalletTransactions;
    }
  });

  // Theme Settings
  const [themeSettings, setThemeSettings] = useState<ThemeSettings>(() => {
    try {
      const saved = localStorage.getItem('apex_theme_settings');
      return saved ? JSON.parse(saved) : initialThemeSettings;
    } catch {
      return initialThemeSettings;
    }
  });

  // Sanitize localStorage in production: ensure sensitive entities are never stored or read from localStorage
  useEffect(() => {
    if (!isDemoMode && typeof window !== 'undefined') {
      const sensitiveKeys = [
        'apex_user',
        'apex_user_orders',
        'apex_support_tickets',
        'apex_active_sessions',
        'apex_wallet_transactions',
        'apex_all_orders',
        'apex_all_users',
        'apex_payment_gateways',
        'apex_sms_config',
        'apex_products',
        'apex_categories',
      ];
      sensitiveKeys.forEach((key) => localStorage.removeItem(key));
    }
  }, []);

  // In demo mode only, persist profile, orders, tickets, sessions, and wallet to localStorage
  useEffect(() => {
    if (isDemoMode && user) {
      localStorage.setItem('apex_user', JSON.stringify(user));
    }
  }, [user]);

  useEffect(() => {
    if (isDemoMode) {
      localStorage.setItem('apex_user_orders', JSON.stringify(userOrders));
    }
  }, [userOrders]);

  useEffect(() => {
    if (isDemoMode) {
      localStorage.setItem('apex_support_tickets', JSON.stringify(supportTickets));
    }
  }, [supportTickets]);

  useEffect(() => {
    if (isDemoMode) {
      localStorage.setItem('apex_active_sessions', JSON.stringify(activeSessions));
    }
  }, [activeSessions]);

  useEffect(() => {
    if (isDemoMode) {
      localStorage.setItem('apex_wallet_transactions', JSON.stringify(walletTransactions));
    }
  }, [walletTransactions]);

  // Open profile tab helper
  const openProfileTab = useCallback((tab: ProfileSubView) => {
    setProfileSubTab(tab);
    setActiveView('profile');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [setActiveView]);

  // Update user profile
  const updateUserProfile = async (updates: Partial<UserProfile>): Promise<void> => {
    if (!isDemoMode) {
      const updatedUser = await api.updateProfile(updates);
      setUser(updatedUser);
      return;
    }

    setUser(prev => prev ? { ...prev, ...updates } : null);
  };

  const updatePassword = async (currentPassword: string, newPassword: string, confirmation: string) => {
    await api.changePassword({
      current_password: currentPassword || undefined,
      password: newPassword,
      password_confirmation: confirmation,
    });
    setUser(prev => prev ? { ...prev, has_password: true } : null);
    showToast('رمز عبور حساب با موفقیت به‌روزرسانی شد.', 'success');
  };

  // Cancel order
  const cancelOrder = (orderId: string) => {
    if (!isDemoMode) {
      void api.cancelOrder(orderId)
        .then((updatedOrder) => {
          setUserOrders(prev => prev.map(order => order.id === updatedOrder.id ? updatedOrder : order));
          showToast(`سفارش ${updatedOrder.order_number} با موفقیت لغو شد.`, 'info');
        })
        .catch((error) => showToast(error instanceof Error ? error.message : 'خطا در لغو سفارش.', 'error'));
      return;
    }

    setUserOrders(prev => prev.map(ord => ord.id === orderId || ord.order_number === orderId ? { ...ord, status: 'cancelled', status_label: 'لغو شده' } : ord));
    showToast(`سفارش ${orderId} با موفقیت لغو شد.`, 'info');
  };

  // Reorder items
  const reorderItems = (order: UserOrder) => {
    order.items.forEach(item => {
      // Create mock product or find from catalog
      const prod = products.find(p => p.id === item.product_id) || {
        id: item.product_id,
        category_id: 1,
        name: item.product_name,
        slug: `product-${item.product_id}`,
        sku: `SKU-${item.product_id}`,
        base_price: item.unit_price,
        effective_price: item.unit_price,
        currency: 'تومان',
        is_active: true,
        is_featured: false,
        in_stock: true,
        image_url: item.image_url
      };
      addToCart(prod, item.quantity);
    });
    showToast('اقلام سفارش به سبد خرید افزوده شدند.', 'success');
  };

  // Add Support Ticket
  const addSupportTicket = async (ticketData: { 
    title: string; 
    department: SupportTicket['department']; 
    priority: SupportTicket['priority']; 
    message: string 
  }): Promise<SupportTicket> => {
    if (!isDemoMode) {
      try {
        const ticket = await api.createSupportTicket(ticketData);
        setSupportTickets(prev => [ticket, ...prev]);
        showToast(`تیکت ${ticket.ticket_number} با موفقیت ثبت شد.`, 'success');
        return ticket;
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'خطا در ثبت تیکت.', 'error');
        throw error;
      }
    }

    const now = new Date();
    const newTicket: SupportTicket = {
      id: `demo-${Date.now()}`,
      ticket_number: `TK-${Math.floor(1000 + Math.random() * 9000)}`,
      title: ticketData.title,
      department: ticketData.department,
      status: 'open',
      status_label: 'باز',
      priority: ticketData.priority,
      last_update: 'چند لحظه پیش',
      created_at: now.toLocaleString('fa-IR'),
      messages: [{ id: 1, sender: 'user', author: user?.name || 'کاربر', time: now.toLocaleTimeString('fa-IR'), date: now.toLocaleDateString('fa-IR'), message: ticketData.message }]
    };
    setSupportTickets(prev => [newTicket, ...prev]);
    showToast(`تیکت جدید با شناسه ${newTicket.ticket_number} با موفقیت ثبت گردید.`, 'success');
    return newTicket;
  };

  // Add reply to support ticket
  const addTicketReply = async (ticketId: string, messageText: string): Promise<void> => {
    if (!isDemoMode) {
      const ticket = await api.replySupportTicket(ticketId, messageText);
      setSupportTickets(prev => prev.map(current => current.id === ticket.id ? ticket : current));
      showToast('پیام شما با موفقیت ارسال شد.', 'success');
      return;
    }

    const now = new Date();
    setSupportTickets(prev => prev.map(ticket => ticket.id === ticketId ? {
      ...ticket,
      status: 'investigating',
      status_label: 'در حال بررسی / در انتظار پاسخ',
      last_update: 'هم‌اکنون',
      messages: [...ticket.messages, { id: ticket.messages.length + 1, sender: 'user', author: user?.name || 'شما', time: now.toLocaleTimeString('fa-IR'), date: now.toLocaleDateString('fa-IR'), message: messageText }]
    } : ticket));
    showToast('پیام شما با موفقیت ارسال شد.', 'success');
  };

  // Close ticket
  const closeSupportTicket = (ticketId: string) => {
    if (!isDemoMode) {
      void api.closeSupportTicket(ticketId)
        .then((ticket) => {
          setSupportTickets(prev => prev.map(current => current.id === ticket.id ? ticket : current));
          showToast(`تیکت ${ticket.ticket_number} بسته شد.`, 'info');
        })
        .catch((error) => showToast(error instanceof Error ? error.message : 'خطا در بستن تیکت.', 'error'));
      return;
    }

    setSupportTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: 'closed', status_label: 'بسته شده', last_update: 'هم‌اکنون' } : t));
    showToast(`تیکت ${ticketId} بسته شد.`, 'info');
  };

  // Terminate Active Session
  const terminateSession = (sessionId: string) => {
    if (!isDemoMode) {
      void api.terminateSession(sessionId)
        .then(() => {
          setActiveSessions(prev => prev.filter(session => session.id !== sessionId));
          showToast('نشست انتخابی با موفقیت خاتمه یافت.', 'success');
        })
        .catch((error) => showToast(error instanceof Error ? error.message : 'خطا در خاتمه دادن نشست.', 'error'));
      return;
    }

    setActiveSessions(prev => prev.filter(s => s.id !== sessionId));
    showToast('نشست انتخابی با موفقیت خاتمه یافت.', 'success');
  };

  const terminateOtherSessions = () => {
    if (!isDemoMode) {
      void api.terminateOtherSessions()
        .then(() => {
          setActiveSessions(prev => prev.filter(session => session.is_current));
          showToast('تمامی نشست‌های دیگر خاتمه یافتند.', 'success');
        })
        .catch((error) => showToast(error instanceof Error ? error.message : 'خطا در خاتمه دادن نشست‌ها.', 'error'));
      return;
    }

    setActiveSessions(prev => prev.filter(s => s.is_current));
    showToast('تمامی نشست‌های دیگر خاتمه یافتند.', 'success');
  };

  // Add Wallet Credit
  const addWalletCredit = (amount: number, description = 'افزایش موجودی کیف پول') => {
    if (!isDemoMode) {
      void api.createWalletDeposit(amount, description)
        .then((transaction) => {
          setWalletTransactions(prev => [transaction, ...prev]);
          showToast('درخواست شارژ ثبت شد؛ پس از تأیید پرداخت، موجودی کیف پول افزایش می‌یابد.', 'info');
        })
        .catch((error) => showToast(error instanceof Error ? error.message : 'خطا در ایجاد درخواست شارژ کیف پول.', 'error'));
      return;
    }

    const newTx: WalletTransaction = {
      id: `tx-${Date.now()}`,
      type: 'deposit',
      amount,
      date: new Date().toLocaleString('fa-IR'),
      description,
      tracking_code: `SH-${Math.floor(10000000 + Math.random() * 90000000)}`,
      status: 'pending'
    };
    setWalletTransactions(prev => [newTx, ...prev]);
    showToast('درخواست شارژ ثبت شد؛ موجودی فقط پس از تأیید پرداخت افزایش می‌یابد.', 'info');
  };

  const refreshSupportTickets = useCallback(async (): Promise<void> => {
    if (isDemoMode || !api.getToken()) return;

    try {
      if (user?.role === 'admin' || user?.role === 'staff') {
        const ticketPage = await api.adminRequest<Record<string, any>>('/tickets?include_archived=1&per_page=100', { cache: 'no-store' });
        const ticketRecords = Array.isArray(ticketPage.data)
          ? ticketPage.data
          : Array.isArray(ticketPage.data?.data)
            ? ticketPage.data.data
            : [];
        setSupportTickets(ticketRecords.map(mapTicket));
        return;
      }

      setSupportTickets(await api.getSupportTickets());
    } catch (error) {
      // Background refresh must stay silent; the existing conversation remains usable on temporary network failures.
      console.warn('Support tickets could not be refreshed in the background.', error);
    }
  }, [user?.role]);

  // Fetch initial data
  const refreshCatalog = async () => {
    setIsLoadingData(true);
    try {
      const [cats, prods, servs] = await Promise.allSettled([
        api.getCategories(),
        api.getProducts(),
        api.getServices(),
      ]);
      if (cats.status === 'fulfilled') setCategories(cats.value);
      else console.warn('Store categories could not be refreshed.', cats.reason);
      if (prods.status === 'fulfilled') setProducts(prods.value.data || []);
      else console.warn('Store products could not be refreshed.', prods.reason);
      if (servs.status === 'fulfilled') setServices(servs.value);
      else console.warn('Online services could not be refreshed.', servs.reason);
    } catch (e) {
      console.error('Failed to fetch store catalog:', e);
    } finally {
      setIsLoadingData(false);
    }
  };

  const refreshCart = async () => {
    if (isDemoMode) return;
    try {
      const summary = await api.getCart();
      applyServerCart(summary);
    } catch (err) {
      console.warn('Customer cart could not be refreshed from server.', err);
    }
  };

  const refreshCustomerData = async () => {
    if (isDemoMode || !api.getToken()) return;

    // Customer sub-resources are independent. A temporary failure in one optional endpoint
    // must never turn a successful login into a red global warning or discard the rest.
    const [profileResult, addressesResult, ordersResult, favoritesResult, ticketsResult, walletResult, cartResult, sessionsResult] = await Promise.allSettled([
      api.getProfile(),
      api.getAddresses(),
      api.getOrders(),
      api.getFavorites(),
      api.getSupportTickets(),
      api.getWallet(),
      api.getCart(),
      api.getSessions(),
    ]);

    if (profileResult.status === 'fulfilled') {
      setUser({
        ...profileResult.value,
        wallet_balance: walletResult.status === 'fulfilled' ? walletResult.value.balance : profileResult.value.wallet_balance,
      });
    } else {
      console.warn('Customer profile could not be refreshed after login.', profileResult.reason);
    }
    if (addressesResult.status === 'fulfilled') setAddresses(addressesResult.value);
    else console.warn('Customer addresses could not be refreshed.', addressesResult.reason);
    if (ordersResult.status === 'fulfilled') setUserOrders(ordersResult.value);
    else console.warn('Customer orders could not be refreshed.', ordersResult.reason);
    if (favoritesResult.status === 'fulfilled') setFavorites(favoritesResult.value);
    else console.warn('Customer favorites could not be refreshed.', favoritesResult.reason);
    if (ticketsResult.status === 'fulfilled') setSupportTickets(ticketsResult.value);
    else console.warn('Customer support tickets could not be refreshed.', ticketsResult.reason);
    if (walletResult.status === 'fulfilled') setWalletTransactions(walletResult.value.transactions);
    else console.warn('Customer wallet could not be refreshed.', walletResult.reason);
    if (cartResult.status === 'fulfilled') applyServerCart(cartResult.value);
    else console.warn('Customer cart could not be refreshed.', cartResult.reason);
    if (sessionsResult.status === 'fulfilled') setActiveSessions(sessionsResult.value);
    else console.warn('Customer sessions could not be refreshed.', sessionsResult.reason);
  };

  useEffect(() => {
    void refreshCatalog();
    void refreshCustomerData();
    void refreshCart();
  }, []);

  // Save cart changes in development-only demo mode
  useEffect(() => {
    if (isDemoMode) localStorage.setItem('apex_cart', JSON.stringify(cart));
  }, [cart]);

  // Keep demo product mutations available after navigating from the admin panel to the storefront.
  // Production never uses this cache; it always receives its catalogue from the API.
  useEffect(() => {
    if (isDemoMode && !isLoadingData) localStorage.setItem('apex_products', JSON.stringify(products));
  }, [products, isLoadingData]);

  // Save addresses changes in development-only demo mode
  useEffect(() => {
    if (isDemoMode) localStorage.setItem('apex_addresses', JSON.stringify(addresses));
  }, [addresses]);

  // Save coupon changes in development-only demo mode
  useEffect(() => {
    if (!isDemoMode) return;
    if (appliedCoupon) {
      localStorage.setItem('apex_coupon', JSON.stringify(appliedCoupon));
    } else {
      localStorage.removeItem('apex_coupon');
    }
  }, [appliedCoupon]);

  // Save favorites changes in development-only demo mode
  useEffect(() => {
    if (isDemoMode) localStorage.setItem('apex_favorites', JSON.stringify(favorites));
  }, [favorites]);

  // Sync theme css variables to root
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--color-primary', themeSettings.primary_color);
    root.style.setProperty('--color-secondary', themeSettings.secondary_color);
    root.style.setProperty('--color-accent', themeSettings.accent_color);
    root.style.setProperty('--color-bg', themeSettings.bg_color);
    root.style.setProperty('--color-text', themeSettings.text_color);
  }, [themeSettings]);

  // One global toast at a time. A newer action always replaces the prior message and timer.
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'info' | 'error' = 'success') => {
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    setToast({ message, type });
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 4000);
  }, []);

  const hideToast = useCallback(() => {
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = null;
    setToast(null);
  }, []);

  useEffect(() => () => {
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
  }, []);

  // Complete the server-side Google OAuth handoff after the browser returns to /auth.
  useEffect(() => {
    if (isDemoMode || typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const outcome = params.get('google_oauth');
    const handoffCode = params.get('handoff');

    if (!outcome) return;

    if (outcome !== 'complete' || !handoffCode) {
      const reason = params.get('reason');
      window.history.replaceState({}, '', '/auth');
      showToast(reason ? `ورود با گوگل انجام نشد: ${reason}` : 'ورود با گوگل لغو شد.', 'error');
      return;
    }

    let cancelled = false;

    void api.exchangeGoogleHandoff(handoffCode)
      .then((result) => {
        if (cancelled) return;
        setUser(result.user);
        setAuthModalOpen(false);
        window.history.replaceState({}, '', '/');
        setActiveViewState('home');
        void refreshCustomerData();
        showToast('ورود با گوگل با موفقیت انجام شد.', 'success');
      })
      .catch((error) => {
        if (cancelled) return;
        window.history.replaceState({}, '', '/auth');
        showToast(error instanceof Error ? error.message : 'خطا در تکمیل ورود با گوگل.', 'error');
      });

    return () => {
      cancelled = true;
    };
  }, [showToast]);

  // Copy shareable link helper
  const copyShareLink = async (customPath?: string): Promise<boolean> => {
    try {
      const urlToCopy = customPath 
        ? `${window.location.origin}${customPath.startsWith('/') ? customPath : `/${customPath}`}`
        : window.location.href;
      
      await navigator.clipboard.writeText(urlToCopy);
      showToast('لینک مستقیم صفحه با موفقیت کپی شد! می‌توانید آن را به اشتراک بگذارید.', 'success');
      return true;
    } catch {
      showToast('خطا در کپی لینک.', 'error');
      return false;
    }
  };

  // Cart Operations
  const applyServerCart = (summary: CartSummary) => {
    setCart(summary.items);
    setServerCartSummary(summary);
  };

  const addToCart = async (product: Product, quantity = 1, variantId?: number): Promise<boolean> => {
    if (product.variant_options?.length && !variantId) {
      const defaultVar = getDefaultSellableVariant(product);
      if (!defaultVar) {
        showToast('ابتدا پیکربندی و رنگ موردنظر را در صفحهٔ کالا انتخاب کنید.', 'info');
        return false;
      }
    }
    const requestedVariant = variantId ? product.variants?.find((variant) => variant.id === variantId) : undefined;
    const variant = requestedVariant || getDefaultSellableVariant(product) || {
      id: product.id || Date.now(),
      product_id: product.id || 0,
      name: 'استاندارد',
      sku: product.sku || '',
      price_override: product.discount_price ?? product.base_price,
      effective_price: product.effective_price ?? product.discount_price ?? product.base_price,
      stock_quantity: product.stock_quantity ?? (product.in_stock ? 10 : 0),
      is_active: product.is_active !== false,
    };

    if (!isProductPurchasable(product) && (!product.in_stock || (product.stock_quantity ?? 0) <= 0)) {
      showToast('این کالا در حال حاضر ناموجود است.', 'info');
      return false;
    }

    const availableStock = variant.stock_quantity ?? product.stock_quantity ?? (product.in_stock ? 10 : 0);
    const cartItem = cart.find((item) => item.product_variant_id === variant.id || item.product_id === product.id);
    const requestedQuantity = (cartItem?.quantity ?? 0) + quantity;

    if (availableStock > 0 && requestedQuantity > availableStock) {
      showToast('موجودی این گزینه برای تعداد درخواستی کافی نیست.', 'info');
      return false;
    }

    if (!isDemoMode) {
      try {
        const summary = await api.addCartItem(variant.id, quantity);
        applyServerCart(summary);
        showToast(`«${product.name}» به سبد خرید افزوده شد.`, 'success');
        return true;
      } catch (error: any) {
        const message = error?.message || 'خطا در افزودن به سبد خرید.';
        showToast(message, 'info');
        return false;
      }
    }

    const effectivePrice = variant.price_override ?? variant.effective_price ?? product.effective_price ?? product.base_price;
    const itemKey = `${product.id}-${variant.id}`;
    setCart(prev => {
      const existingIndex = prev.findIndex(item => item.id === itemKey || (item.product_id === product.id && item.product_variant_id === variant.id));
      if (existingIndex > -1) {
        const updated = [...prev];
        updated[existingIndex].quantity += quantity;
        updated[existingIndex].subtotal = updated[existingIndex].quantity * effectivePrice;
        return updated;
      }
      return [...prev, {
        id: itemKey,
        product_id: product.id,
        product_variant_id: variant.id,
        product_name: product.name,
        variant_name: variant.name || 'استاندارد',
        sku: variant.sku || product.sku,
        unit_price: effectivePrice,
        currency: product.currency || 'تومان',
        quantity,
        subtotal: quantity * effectivePrice,
        available_stock: availableStock,
        image_url: product.image_url,
      }];
    });
    showToast(`«${product.name}» به سبد خرید افزوده شد.`, 'success');
    return true;
  };

  const updateCartQuantity = (itemKey: string, quantity: number) => {
    const cartItem = cart.find((item) => item.id === itemKey);
    // Stock limits apply only when increasing quantity. A customer must always be
    // able to reduce or remove an item that is already above the current stock.
    const isIncreasingQuantity = cartItem !== undefined && quantity > cartItem.quantity;
    if (isIncreasingQuantity && cartItem.available_stock !== undefined && cartItem.available_stock > 0 && quantity > cartItem.available_stock) {
      showToast('موجودی محصول تمام شده است.', 'info');
      return;
    }

    if (!isDemoMode) {
      const request = quantity <= 0 ? api.removeCartItem(itemKey) : api.updateCartItem(itemKey, quantity);
      void request
        .then((summary) => applyServerCart(summary))
        .catch((error: any) => {
          const message = error?.message || 'خطا در بروزرسانی تعداد محصول.';
          showToast(message, 'info');
          void refreshCart();
        });
      return;
    }

    if (quantity <= 0) {
      removeFromCart(itemKey);
      return;
    }
    setCart(prev => prev.map(item => item.id === itemKey ? { ...item, quantity, subtotal: quantity * item.unit_price } : item));
  };

  const removeFromCart = (itemKey: string) => {
    if (!isDemoMode) {
      void api.removeCartItem(itemKey)
        .then((summary) => {
          applyServerCart(summary);
          showToast('آیتم از سبد خرید حذف شد.', 'info');
        })
        .catch((error: any) => {
          showToast(error?.message || 'خطا در حذف آیتم', 'info');
        });
      return;
    }

    setCart(prev => prev.filter(item => item.id !== itemKey));
    showToast('آیتم از سبد خرید حذف شد.', 'info');
  };

  const clearCart = () => {
    if (!isDemoMode) {
      void api.clearCart()
        .then(() => applyServerCart({ items: [], item_count: 0, subtotal: 0, discount_total: 0, coupon_discount: 0, tax_total: 0, shipping_total: 0, grand_total: 0, currency: 'IRR' }))
        .catch((error: any) => {
          showToast(error?.message || 'خطا در خالی کردن سبد خرید', 'info');
        });
      return;
    }

    setCart([]);
  };

  // Address operations are server-confirmed in production. This prevents a temporary client record
  // from looking saved when backend validation or connectivity rejects the request.
  const addAddress = async (addr: Omit<UserAddress, 'id'>): Promise<UserAddress> => {
    if (!isDemoMode) {
      try {
        const savedAddress = await api.createAddress(addr);
        const freshAddresses = await api.getAddresses();
        setAddresses(freshAddresses);
        setSelectedAddressId(savedAddress.id);
        return savedAddress;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'خطا در ثبت آدرس. لطفاً دوباره تلاش کنید.';
        showToast(message, 'error');
        throw error instanceof Error ? error : new Error(message);
      }
    }

    const newId = Date.now();
    const newAddress: UserAddress = { ...addr, id: newId };
    setAddresses(prev => [newAddress, ...prev]);
    setSelectedAddressId(newId);
    return newAddress;
  };

  const updateAddress = async (id: number, addr: Partial<UserAddress>): Promise<UserAddress> => {
    if (!isDemoMode) {
      try {
        const updatedAddress = await api.updateAddress(id, addr);
        const freshAddresses = await api.getAddresses();
        setAddresses(freshAddresses);
        return updatedAddress;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'خطا در ویرایش آدرس. لطفاً دوباره تلاش کنید.';
        showToast(message, 'error');
        throw error instanceof Error ? error : new Error(message);
      }
    }

    const existingAddress = addresses.find(address => address.id === id);
    if (!existingAddress) {
      const error = new Error('آدرس موردنظر یافت نشد.');
      showToast(error.message, 'error');
      throw error;
    }
    const updatedAddress = { ...existingAddress, ...addr };
    setAddresses(prev => prev.map(address => address.id === id ? updatedAddress : address));
    return updatedAddress;
  };

  const deleteAddress = (id: number) => {
    if (!isDemoMode) {
      void api.deleteAddress(id)
        .then(async () => {
          const freshAddresses = await api.getAddresses();
          setAddresses(freshAddresses);
          if (selectedAddressId === id) {
            const nextDefault = freshAddresses.find(address => address.is_default) || freshAddresses[0];
            setSelectedAddressId(nextDefault?.id ?? null);
          }
        })
        .catch((error) => showToast(error instanceof Error ? error.message : 'خطا در حذف آدرس.', 'error'));
      return;
    }

    setAddresses(prev => prev.filter(a => a.id !== id));
    if (selectedAddressId === id) {
      const remaining = addresses.filter(a => a.id !== id);
      setSelectedAddressId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  // Coupon Operations
  const applyCoupon = async (code: string): Promise<{ success: boolean; message: string }> => {
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) {
      return { success: false, message: 'لطفاً کد تخفیف را وارد کنید.' };
    }

    if (!isDemoMode) {
      try {
        const currentSubtotal = cart.reduce((acc, item) => acc + item.subtotal, 0);
        const res = await api.validateCoupon(cleanCode, currentSubtotal);
        const discountAmount = Number(res.discount_amount || 0);
        setAppliedCoupon({
          code: res.code,
          discount_amount: discountAmount,
          description: res.title || 'کد تخفیف اعمال شد',
        });
        return {
          success: true,
          message: `کد تخفیف «${res.code}» با موفقیت اعمال شد. (${discountAmount.toLocaleString('fa-IR')} ریال تخفیف)`,
        };
      } catch (err: any) {
        return {
          success: false,
          message: err.message || 'کد تخفیف وارد شده معتبر نیست یا منقضی شده است.',
        };
      }
    }

    if (cleanCode === 'NOOVIN20' || cleanCode === 'NVN20') {
      const discountAmount = 500000;
      setAppliedCoupon({
        code: 'NOOVIN20',
        discount_amount: discountAmount,
        description: 'کد تخفیف اعمال شد',
      });
      return { success: true, message: 'کد تخفیف ۲۰٪ (۵۰۰,۰۰۰ تومان) با موفقیت اعمال شد.' };
    }
    if (cleanCode === 'OFF50') {
      const discountAmount = 300000;
      setAppliedCoupon({
        code: 'OFF50',
        discount_amount: discountAmount,
        description: 'کد تخفیف جشنواره',
      });
      return { success: true, message: 'کد تخفیف ۳۰۰,۰۰۰ تومانی با موفقیت اعمال شد.' };
    }
    return { success: false, message: 'کد تخفیف وارد شده معتبر نیست یا منقضی شده است.' };
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
  };

  // Cart Summary Calculation
  const subtotal = cart.reduce((acc, item) => acc + item.subtotal, 0);
  const couponDiscount = appliedCoupon ? appliedCoupon.discount_amount : 0;
  const discountTotal = couponDiscount; 
  const shippingTotal = checkoutStep >= 2 ? 20000 : 0;
  const taxTotal = 0;
  const grandTotal = Math.max(0, subtotal - discountTotal + shippingTotal + taxTotal);

  const cartSummary: CartSummary = !isDemoMode && serverCartSummary
    ? {
        ...serverCartSummary,
        items: cart,
        discount_total: (serverCartSummary.discount_total || 0) + discountTotal,
        grand_total: Math.max(0, serverCartSummary.grand_total - discountTotal),
        applied_coupon: appliedCoupon ? { code: appliedCoupon.code, discount_amount: discountTotal, description: appliedCoupon.description } : null,
      }
    : {
        items: cart,
        item_count: cart.reduce((acc, item) => acc + item.quantity, 0),
        subtotal,
        discount_total: discountTotal,
        coupon_discount: couponDiscount,
        tax_total: taxTotal,
        shipping_total: shippingTotal,
        grand_total: grandTotal,
        currency: 'تومان',
        applied_coupon: appliedCoupon,
      };

  // Favorite operations
  const toggleFavorite = (productId: number) => {
    if (!isDemoMode) {
      const exists = favorites.includes(productId);
      const request = exists ? api.removeFavorite(productId) : api.addFavorite(productId);
      void request
        .then(() => setFavorites(prev => exists ? prev.filter(id => id !== productId) : [...prev, productId]))
        .catch((error) => showToast(error instanceof Error ? error.message : 'خطا در به‌روزرسانی علاقه‌مندی‌ها.', 'error'));
      return;
    }

    setFavorites(prev => prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]);
  };

  const isFavorite = (productId: number) => favorites.includes(productId);

  // Auth Operations
  const login = async (email: string, pass: string, options?: { suppressSuccessToast?: boolean }): Promise<UserProfile> => {
    const res = await api.login({ email, password: pass });
    setUser(res.user);
    if (isDemoMode) localStorage.setItem('apex_user', JSON.stringify(res.user));
    setAuthModalOpen(false);
    void refreshCustomerData();
    if (!options?.suppressSuccessToast) {
      showToast('ورود شما با موفقیت انجام شد.', 'success');
    }
    return res.user;
  };

  const loginWithPhone = async (phone: string, code: string) => {
    const res = await api.verifyOtp(phone, code);
    setUser(res.user);
    if (isDemoMode) localStorage.setItem('apex_user', JSON.stringify(res.user));
    setAuthModalOpen(false);
    void refreshCustomerData();
    showToast('ورود شما با موفقیت انجام شد.', 'success');
    if (activeView === 'auth') {
      setActiveView('home');
    }
  };

  const sendOtpCode = async (phone: string) => {
    return await api.sendOtp(phone);
  };

  const requestPasswordResetSms = async (phone: string) => {
    return await api.requestPasswordResetSms(phone);
  };

  const resetPasswordWithSms = async (payload: { phone: string; code: string; password: string; password_confirmation: string }) => {
    const result = await api.confirmPasswordResetSms(payload);
    setUser(result.user);
    if (isDemoMode) localStorage.setItem('apex_user', JSON.stringify(result.user));
    void refreshCustomerData();
    showToast('رمز عبور شما با موفقیت تغییر کرد و وارد حساب شدید.', 'success');
    if (activeView === 'auth') {
      setActiveView('home');
    }
  };

  const loginWithGoogle = async () => {
    if (isDemoMode) {
      api.startGoogleLogin();
      setUser(mockUserProfile);
      localStorage.setItem('apex_user', JSON.stringify(mockUserProfile));
      setAuthModalOpen(false);
      showToast('ورود نمایشی با گوگل انجام شد.', 'success');
      if (activeView === 'auth') {
        setActiveView('home');
      }
      return;
    }

    api.startGoogleLogin();
  };

  const logout = () => {
    api.setToken(null);
    setUser(null);
    setUserOrders([]);
    setSupportTickets([]);
    setWalletTransactions([]);
    setFavorites([]);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('apex_user');
      localStorage.removeItem('apex_user_orders');
      localStorage.removeItem('apex_support_tickets');
      localStorage.removeItem('apex_active_sessions');
      localStorage.removeItem('apex_wallet_transactions');
    }
    [
      SESSION_STATE_KEYS.checkoutStep,
      SESSION_STATE_KEYS.checkoutSelectedAddress,
      SESSION_STATE_KEYS.checkoutPaymentMethod,
      SESSION_STATE_KEYS.profileSubTab,
      SESSION_STATE_KEYS.adminSubTab,
      SESSION_STATE_KEYS.legacyCheckoutDraft,
      SESSION_STATE_KEYS.addressModalResume,
      SESSION_STATE_KEYS.supportResume,
      SESSION_STATE_KEYS.newTicketDraft,
    ].forEach(clearSessionState);
    clearSessionStateByPrefix(SESSION_STATE_KEYS.addressDraftPrefix);
    void refreshCart();
    showToast('با موفقیت از حساب کاربری خارج شدید.', 'info');
  };

  // Admin State Management
  const [adminSubTab, setAdminSubTab] = useState<AdminSubTab>(() =>
    readSessionState<AdminSubTab>(SESSION_STATE_KEYS.adminSubTab, 'overview'),
  );

  // Persist only non-sensitive navigation context for the current browser tab.
  // Passwords, OTP values, authentication tokens and payment details are never stored here.
  useEffect(() => {
    writeSessionState(SESSION_STATE_KEYS.checkoutStep, checkoutStep);
  }, [checkoutStep]);

  useEffect(() => {
    writeSessionState(SESSION_STATE_KEYS.checkoutSelectedAddress, selectedAddressId);
  }, [selectedAddressId]);

  useEffect(() => {
    writeSessionState(SESSION_STATE_KEYS.checkoutPaymentMethod, paymentMethod);
  }, [paymentMethod]);

  useEffect(() => {
    writeSessionState(SESSION_STATE_KEYS.profileSubTab, profileSubTab);
  }, [profileSubTab]);

  useEffect(() => {
    writeSessionState(SESSION_STATE_KEYS.adminSubTab, adminSubTab);
  }, [adminSubTab]);

  useEffect(() => {
    writeSessionState(SESSION_STATE_KEYS.checkoutSelectedAddress, selectedAddressId);
  }, [selectedAddressId]);

  useEffect(() => {
    if (addresses.length === 0) return;

    const selectedAddressExists = selectedAddressId !== null && addresses.some((address) => address.id === selectedAddressId);
    if (!selectedAddressExists) {
      const defaultAddr = addresses.find((address) => address.is_default) || addresses[0];
      setSelectedAddressId(defaultAddr?.id ?? null);
    }
  }, [addresses, selectedAddressId]);

  const [appearanceSettings, setAppearanceSettings] = useState<AppearanceSettings>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('apex_appearance_settings');
      if (saved) {
        try { return JSON.parse(saved); } catch (e) { console.error(e); }
      }
    }
    return initialAppearanceSettings;
  });

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--store-primary', toStorefrontColor(appearanceSettings.brandPrimaryColor, '#2563EB'));
    root.style.setProperty('--store-secondary', toStorefrontColor(appearanceSettings.brandSecondaryColor, '#1D4ED8'));
    root.style.setProperty('--store-accent', toStorefrontColor(appearanceSettings.brandAccentColor, '#DC2626'));
  }, [appearanceSettings.brandAccentColor, appearanceSettings.brandPrimaryColor, appearanceSettings.brandSecondaryColor]);

  const [staticContent, setStaticContent] = useState<StaticPagesContent>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('apex_static_content');
      if (saved) {
        try { return JSON.parse(saved); } catch (e) { console.error(e); }
      }
    }
    return initialStaticPagesContent;
  });

  const [blogPosts, setBlogPosts] = useState<BlogPost[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('apex_blog_posts');
      if (saved) {
        try { return JSON.parse(saved); } catch (e) { console.error(e); }
      }
    }
    return initialBlogPosts;
  });

  const [checkoutConfiguration, setCheckoutConfiguration] = useState<CheckoutConfiguration>(initialCheckoutConfiguration);
  const [smsSystemConfiguration, setSmsSystemConfiguration] = useState<SmsSystemConfiguration>(initialSmsSystemConfiguration);

  const [paymentGateways, setPaymentGateways] = useState<PaymentGatewayConfig[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('apex_payment_gateways');
      if (saved) {
        try { return JSON.parse(saved); } catch (e) { console.error(e); }
      }
    }
    return initialPaymentGateways;
  });

  const [smsConfig, setSmsConfig] = useState<SmsPanelConfig>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('apex_sms_config');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === 'object') {
            return {
              ...initialSmsConfig,
              ...parsed,
              templates: {
                ...initialSmsConfig.templates,
                ...(parsed.templates && typeof parsed.templates === 'object' && !Array.isArray(parsed.templates) ? parsed.templates : {})
              }
            };
          }
        } catch (e) {
          console.error('Failed to parse saved sms config:', e);
        }
      }
    }
    return initialSmsConfig;
  });

  const openAdminTab = useCallback((tab: AdminSubTab) => {
    setAdminSubTab(tab);
    setActiveView('admin');
    if (typeof window !== 'undefined') {
      const tabPath = tab === 'overview' ? '/admin' : `/admin/${tab}`;
      window.history.pushState({ view: 'admin', adminTab: tab }, '', tabPath);
    }
  }, [setActiveView]);

  const updateAppearanceSettings = async (updates: Partial<AppearanceSettings>): Promise<void> => {
    const updated = { ...appearanceSettings, ...updates };
    if (!isDemoMode) {
      await api.adminRequest('/settings/appearance', { method: 'PUT', body: JSON.stringify({ settings: { config: updated } }) });
    }
    setAppearanceSettings(updated);
  };

  const updateStaticContent = async <K extends keyof StaticPagesContent>(section: K, data: Partial<StaticPagesContent[K]>): Promise<void> => {
    const updated = { ...staticContent, [section]: { ...staticContent[section], ...data } };
    if (!isDemoMode) {
      await api.adminRequest('/settings/static_content', { method: 'PUT', body: JSON.stringify({ settings: { config: updated } }) });
    }
    setStaticContent(updated);
  };

  const persistBlogPosts = (posts: BlogPost[]) => api.adminRequest('/settings/blog_posts', { method: 'PUT', body: JSON.stringify({ settings: { posts } }) });

  const addBlogPost = async (postData: Omit<BlogPost, 'id' | 'views'>): Promise<BlogPost> => {
    const newPost: BlogPost = { ...postData, id: Date.now(), views: 0 };
    const updated = [newPost, ...blogPosts];
    if (!isDemoMode) await persistBlogPosts(updated);
    setBlogPosts(updated);
    return newPost;
  };

  const updateBlogPost = async (id: number, updates: Partial<BlogPost>): Promise<void> => {
    const updated = blogPosts.map(post => post.id === id ? { ...post, ...updates } : post);
    if (!isDemoMode) await persistBlogPosts(updated);
    setBlogPosts(updated);
  };

  const deleteBlogPost = async (id: number): Promise<void> => {
    const updated = blogPosts.filter(post => post.id !== id);
    if (!isDemoMode) await persistBlogPosts(updated);
    setBlogPosts(updated);
  };

  const updateCheckoutConfiguration = async (config: CheckoutConfiguration): Promise<void> => {
    if (!isDemoMode) {
      await api.adminRequest('/settings/checkout_config', { method: 'PUT', body: JSON.stringify({ settings: { config } }) });
    }
    setCheckoutConfiguration(config);
  };

  const updateSmsSystemConfiguration = async (config: SmsSystemConfiguration): Promise<void> => {
    let saved = config;
    if (!isDemoMode) {
      const response = await api.adminRequest<{ config?: SmsSystemConfiguration }>('/settings/sms_config', {
        method: 'PUT',
        body: JSON.stringify({ settings: { config } }),
      });
      if (response.config) saved = response.config;
    }
    setSmsSystemConfiguration({ ...saved, api_key: '', clear_api_key: false });
  };

  const testSmsSystemConnection = async (): Promise<SmsConnectionInfo> => {
    if (isDemoMode) {
      return { remaining_credit: 50000, expires_at: null, account_type: 'Preview' };
    }
    return api.adminRequest<SmsConnectionInfo>('/sms/test-connection', { method: 'POST' });
  };

  const persistPaymentGateways = (items: PaymentGatewayConfig[]) => api.adminRequest('/settings/payment_gateways', { method: 'PUT', body: JSON.stringify({ settings: { items } }) });

  const updatePaymentGateway = (id: GatewayProvider, updates: Partial<PaymentGatewayConfig>) => {
    const updated = paymentGateways.map(gateway => gateway.id === id ? { ...gateway, ...updates } : gateway);
    if (!isDemoMode) {
      void persistPaymentGateways(updated)
        .then(() => { setPaymentGateways(updated); showToast('پیکربندی درگاه پرداخت با موفقیت ذخیره شد.', 'success'); })
        .catch((error) => showToast(error instanceof Error ? error.message : 'خطا در ذخیره پیکربندی درگاه.', 'error'));
      return;
    }
    setPaymentGateways(updated);
    showToast('پیکربندی درگاه پرداخت با موفقیت ذخیره شد.', 'success');
  };

  const setDefaultPaymentGateway = (id: GatewayProvider) => {
    const updated = paymentGateways.map(gateway => ({ ...gateway, isDefault: gateway.id === id, isEnabled: gateway.id === id ? true : gateway.isEnabled }));
    if (!isDemoMode) {
      void persistPaymentGateways(updated)
        .then(() => { setPaymentGateways(updated); showToast('درگاه پیش‌فرض سایت تغییر یافت.', 'success'); })
        .catch((error) => showToast(error instanceof Error ? error.message : 'خطا در ذخیره درگاه پیش‌فرض.', 'error'));
      return;
    }
    setPaymentGateways(updated);
    showToast('درگاه پیش‌فرض سایت تغییر یافت.', 'success');
  };

  const persistSmsConfig = (config: SmsPanelConfig) => api.adminRequest('/settings/sms_config', { method: 'PUT', body: JSON.stringify({ settings: { config } }) });

  const updateSmsConfig = (updates: Partial<SmsPanelConfig>) => {
    const updated = { ...smsConfig, ...updates };
    if (!isDemoMode) {
      void persistSmsConfig(updated)
        .then(() => { setSmsConfig(updated); showToast('تنظیمات سامانه پیامک به‌روزرسانی شد.', 'success'); })
        .catch((error) => showToast(error instanceof Error ? error.message : 'خطا در ذخیره تنظیمات پیامک.', 'error'));
      return;
    }
    setSmsConfig(updated);
    showToast('تنظیمات سامانه پیامک به‌روزرسانی شد.', 'success');
  };

  const updateSmsTemplate = (key: keyof SmsPanelConfig['templates'], updates: Partial<SmsTemplateConfig>) => {
    const updated = { ...smsConfig, templates: { ...smsConfig.templates, [key]: { ...smsConfig.templates[key], ...updates } } };
    if (!isDemoMode) {
      void persistSmsConfig(updated)
        .then(() => { setSmsConfig(updated); showToast('الگوی پیامک با موفقیت ذخیره شد.', 'success'); })
        .catch((error) => showToast(error instanceof Error ? error.message : 'خطا در ذخیره الگوی پیامک.', 'error'));
      return;
    }
    setSmsConfig(updated);
    showToast('الگوی پیامک با موفقیت ذخیره شد.', 'success');
  };

  const sendTestSms = async (phone: string, text: string): Promise<{ success: boolean; message: string }> => {
    if (!phone || phone.length < 10) {
      return { success: false, message: 'لطفاً شماره موبایل معتبر ۱۰ یا ۱۱ رقمی وارد نمایید.' };
    }
    if (!smsConfig.isEnabled) {
      return { success: false, message: 'سامانه پیامک در وضعیت غیرفعال قرار دارد.' };
    }
    if (smsConfig.creditBalance <= 0) {
      return { success: false, message: 'اعتبار ریالی/پیامکی پنل پیامک کافی نمی‌باشد.' };
    }

    if (!isDemoMode) {
      return { success: false, message: 'ارسال پیامک نیازمند اتصال و اعتبارسنجی سرویس‌دهندهٔ انتخاب‌شده در سرور است.' };
    }

    // Simulate SMS gateway latency only in development demo mode
    await new Promise(resolve => setTimeout(resolve, 800));

    setSmsConfig(prev => {
      const updated = {
        ...prev,
        creditBalance: Math.max(0, prev.creditBalance - 1)
      };
      if (typeof window !== 'undefined') {
        localStorage.setItem('apex_sms_config', JSON.stringify(updated));
      }
      return updated;
    });

    return {
      success: true,
      message: `پیامک آزمایشی با موفقیت از خط ${smsConfig.senderLine} به شماره ${phone} ارسال شد.`
    };
  };

  // Theme customizer
  const updateThemeSettings = (newSettings: Partial<ThemeSettings>) => {
    setThemeSettings(prev => {
      const updated = { ...prev, ...newSettings };
      api.saveThemeSettings(updated);
      return updated;
    });
  };

  // ================= ADMIN PANEL STATES & CRUD IMPLEMENTATION =================
  const [allOrders, setAllOrders] = useState<UserOrder[]>(() => {
    if (!isDemoMode) return [];

    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('apex_all_orders');
      if (saved) {
        try { return JSON.parse(saved); } catch (e) { console.error(e); }
      }
    }
    return mockAllOrders;
  });

  const [allUsers, setAllUsers] = useState<UserProfile[]>(() => {
    if (!isDemoMode) return [];

    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('apex_all_users');
      if (saved) {
        try { return JSON.parse(saved); } catch (e) { console.error(e); }
      }
    }
    return mockAllUsers;
  });

  useEffect(() => {
    if (isDemoMode) return;
    let active = true;
    void Promise.all([api.getPublicSettings(), api.getCheckoutConfiguration()])
      .then(([settings, checkout]) => {
        if (!active) return;
        const appearance = settings.appearance?.config;
        const pages = settings.static_content?.config;
        const posts = settings.blog_posts?.posts;
        if (appearance && typeof appearance === 'object' && !Array.isArray(appearance)) {
          setAppearanceSettings((current) => ({ ...current, ...(appearance as Partial<AppearanceSettings>) }));
        }
        if (pages && typeof pages === 'object' && !Array.isArray(pages)) {
          const content = pages as Partial<StaticPagesContent>;
          setStaticContent((current) => ({
            about: { ...current.about, ...(content.about ?? {}) },
            contact: { ...current.contact, ...(content.contact ?? {}) },
            footer: { ...current.footer, ...(content.footer ?? {}) },
          }));
        }
        if (Array.isArray(posts)) setBlogPosts(posts as BlogPost[]);
        if (checkout && typeof checkout === 'object' && !Array.isArray(checkout)) {
          const config = checkout as Partial<CheckoutConfiguration>;
          const resolvedGateways = config.gateways ?? config.payment?.gateways;
          setCheckoutConfiguration((current) => ({
            ...current,
            ...config,
            gateways: resolvedGateways ?? current.gateways,
            payment: {
              ...current.payment,
              ...(config.payment ?? {}),
              gateways: resolvedGateways ?? current.payment?.gateways,
            },
            shipping: { ...current.shipping, ...(config.shipping ?? {}) },
          }));
        }
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  const refreshAdminData = async () => {
    if (isDemoMode || !user || (user.role !== 'admin' && user.role !== 'staff')) return;

    try {
      const [
        productResult,
        categoriesResult,
        orderResult,
        userResult,
        ticketResult,
        couponResult,
        appearanceResult,
        staticResult,
        blogResult,
        gatewayResult,
        smsResult,
        storeResult,
        checkoutResult,
      ] = await Promise.allSettled([
        api.adminRequest<Record<string, any>>('/products'),
        api.adminRequest<Category[]>('/categories'),
        api.adminRequest<Record<string, any>>('/orders'),
        api.adminRequest<Record<string, any>>('/users'),
        api.adminRequest<Record<string, any>>('/tickets?include_archived=1&per_page=100'),
        api.adminRequest<Record<string, any>>('/discounts'),
        api.adminRequest<Record<string, any>>('/settings/appearance'),
        api.adminRequest<Record<string, any>>('/settings/static_content'),
        api.adminRequest<Record<string, any>>('/settings/blog_posts'),
        api.adminRequest<Record<string, any>>('/settings/payment_gateways'),
        api.adminRequest<Record<string, any>>('/settings/sms_config'),
        api.adminRequest<Record<string, any>>('/settings/store_settings'),
        api.adminRequest<Record<string, any>>('/settings/checkout_config'),
      ]);

      if (productResult.status === 'fulfilled' && Array.isArray(productResult.value?.data)) {
        setProducts(productResult.value.data.map(mapProduct));
      }
      if (categoriesResult.status === 'fulfilled' && Array.isArray(categoriesResult.value)) {
        setCategories(categoriesResult.value);
      }
      if (orderResult.status === 'fulfilled' && Array.isArray(orderResult.value?.data)) {
        setAllOrders(orderResult.value.data.map(mapOrder));
      }
      if (userResult.status === 'fulfilled' && Array.isArray(userResult.value?.data)) {
        setAllUsers(userResult.value.data.map(mapUser));
      }
      if (ticketResult.status === 'fulfilled') {
        const raw = ticketResult.value?.data ?? ticketResult.value;
        const ticketRecords = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
        setSupportTickets(ticketRecords.map(mapTicket));
      }
      if (couponResult.status === 'fulfilled' && Array.isArray(couponResult.value?.data)) {
        setDiscountCoupons(couponResult.value.data.map((coupon: Record<string, any>) => ({
          ...coupon,
          id: String(coupon.id),
          expiry_date: coupon.expires_at || coupon.expiry_date || '',
          start_date: coupon.starts_at || coupon.start_date,
        })));
      }
      if (appearanceResult.status === 'fulfilled' && appearanceResult.value?.config) {
        setAppearanceSettings(appearanceResult.value.config);
      }
      if (staticResult.status === 'fulfilled' && staticResult.value?.config) {
        setStaticContent(staticResult.value.config);
      }
      if (blogResult.status === 'fulfilled' && Array.isArray(blogResult.value?.posts)) {
        setBlogPosts(blogResult.value.posts);
      }
      if (gatewayResult.status === 'fulfilled' && Array.isArray(gatewayResult.value?.items)) {
        setPaymentGateways(gatewayResult.value.items);
      }
      if (smsResult.status === 'fulfilled' && smsResult.value?.config) {
        setSmsSystemConfiguration((current) => ({
          ...current,
          ...(smsResult.value.config as Partial<SmsSystemConfiguration>),
          api_key: '',
        }));
      }
      if (storeResult.status === 'fulfilled' && storeResult.value?.config) {
        setStoreSettings(storeResult.value.config);
      }
      if (checkoutResult.status === 'fulfilled' && checkoutResult.value?.config) {
        const config = checkoutResult.value.config as Partial<CheckoutConfiguration>;
        setCheckoutConfiguration((current) => ({
          ...current,
          ...config,
          payment: { ...current.payment, ...(config.payment ?? {}) },
          shipping: { ...current.shipping, ...(config.shipping ?? {}) },
        }));
      }
    } catch (error) {
      console.error('Failed to fetch admin data:', error);
    }
  };

  useEffect(() => {
    void refreshAdminData();
  }, [user?.id, user?.role]);

  // Product Operations (Admin)
  const addProduct = async (productData: Omit<Product, 'id'>): Promise<Product> => {
    const demoProductId = Date.now();
    const demoVariants = normalizeDemoProductVariants(productData.variants, demoProductId, productData.base_price);
    const demoVariantStock = demoVariants?.reduce((total, variant) => total + (variant.stock_quantity ?? 0), 0);
    const demoStock = demoVariantStock ?? productData.initial_stock ?? productData.stock_quantity ?? (productData.in_stock ? 1 : 0);
    const flatCats = flattenCategories(categories);
    const demoCategory = flatCats.find((category) => category.id === productData.category_id || category.slug === productData.category_slug);
    const newProduct = mapProduct({ ...productData, id: demoProductId, variants: demoVariants, stock_quantity: demoStock, effective_price: productData.discount_price ?? productData.base_price, currency: productData.currency || 'IRR', is_active: productData.is_active ?? true, in_stock: demoStock > 0, category: demoCategory, category_name: demoCategory?.name || productData.category_name, category_slug: demoCategory?.slug || productData.category_slug });
    if (!isDemoMode) {
      try {
        const initialStock = productData.initial_stock ?? productData.stock_quantity ?? (productData.in_stock ? 1 : 0);
        const product = await api.adminRequest<Product>('/products', { method: 'POST', body: JSON.stringify({ ...productData, initial_stock: initialStock }) });
        const mappedProduct = mapProduct(product);
        setProducts(prev => [mappedProduct, ...prev]);
        showToast(`محصول «${mappedProduct.name}» با موفقیت اضافه شد.`, 'success');
        return mappedProduct;
      } catch (error) {
        console.warn('Backend product creation failed; applying local addition.', error);
      }
    }
    setProducts(prev => [newProduct, ...prev]);
    showToast(`محصول «${newProduct.name}» با موفقیت اضافه شد.`, 'success');
    return newProduct;
  };

  const updateProduct = async (id: number, updates: Partial<Product>): Promise<Product> => {
    if (!isDemoMode) {
      try {
        const { stock_quantity, ...productUpdates } = updates;
        const payload = {
          ...productUpdates,
          ...(stock_quantity !== undefined ? { initial_stock: stock_quantity } : {}),
        };
        const product = await api.adminRequest<Product>(`/products/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
        const mappedProduct = mapProduct(product);
        setProducts(prev => prev.map(current => current.id === id ? mappedProduct : current));
        showToast('تغییرات محصول با موفقیت ذخیره شد.', 'success');
        return mappedProduct;
      } catch (error) {
        console.warn('Backend product update failed; applying local update.', error);
      }
    }

    const currentProduct = products.find((product) => product.id === id);
    if (!currentProduct) {
      throw new Error('محصول برای ویرایش پیدا نشد.');
    }

    const demoVariants = updates.variants === undefined
      ? currentProduct.variants
      : normalizeDemoProductVariants(updates.variants, id, updates.base_price ?? currentProduct.base_price);
    const demoVariantStock = updates.variants === undefined ? undefined : (demoVariants ?? []).reduce((total, variant) => total + (variant.stock_quantity ?? 0), 0);
    const demoStock = demoVariantStock ?? updates.initial_stock ?? updates.stock_quantity ?? currentProduct.stock_quantity ?? 0;
    const flatCats = flattenCategories(categories);
    const demoCategory = flatCats.find((category) => category.id === (updates.category_id ?? currentProduct.category_id) || category.slug === (updates.category_slug ?? currentProduct.category_slug));
    const updatedProduct = mapProduct({ ...currentProduct, ...updates, variants: demoVariants, stock_quantity: demoStock, in_stock: demoStock > 0, category: demoCategory ?? (currentProduct.category_name ? { name: currentProduct.category_name, slug: currentProduct.category_slug } : undefined), category_name: demoCategory?.name ?? currentProduct.category_name, category_slug: demoCategory?.slug ?? currentProduct.category_slug });
    setProducts(prev => prev.map(product => product.id === id ? updatedProduct : product));
    showToast('تغییرات محصول با موفقیت ذخیره شد.', 'success');
    return updatedProduct;
  };

  const deleteProduct = (id: number) => {
    if (!isDemoMode) {
      void api.adminRequest(`/products/${id}`, { method: 'DELETE' })
        .then(() => { setProducts(prev => prev.filter(product => product.id !== id)); showToast('محصول با موفقیت حذف گردید.', 'info'); })
        .catch((error) => showToast(error instanceof Error ? error.message : 'خطا در حذف محصول.', 'error'));
      return;
    }
    setProducts(prev => prev.filter(product => product.id !== id));
    showToast('محصول با موفقیت حذف گردید.', 'info');
  };

  const toggleProductStock = (id: number) => {
    const product = products.find(item => item.id === id);
    if (!product) return;
    if (!isDemoMode) {
      void updateProduct(id, { stock_quantity: product.in_stock ? 0 : 1 })
        .catch((error) => showToast(error instanceof Error ? error.message : 'خطا در به‌روزرسانی موجودی.', 'error'));
      return;
    }
    setProducts(prev => prev.map(item => item.id === id ? { ...item, in_stock: !item.in_stock } : item));
    showToast('وضعیت موجودی محصول به‌روزرسانی شد.', 'success');
  };

  const toggleProductFeatured = (id: number) => {
    const product = products.find(item => item.id === id);
    if (!product) return;
    updateProduct(id, { is_featured: !product.is_featured });
  };

  const toggleProductActive = (id: number) => {
    const product = products.find(item => item.id === id);
    if (!product) return;
    updateProduct(id, { is_active: !product.is_active });
  };

  // Category Operations (Admin)
  const addCategory = (catData: Omit<Category, 'id'>): Category => {
    const newCategory: Category = { ...catData, id: Date.now(), is_active: catData.is_active ?? true, sort_order: catData.sort_order ?? 1, level: catData.level ?? 1 };
    if (!isDemoMode) {
      void api.adminRequest<Category>('/categories', { method: 'POST', body: JSON.stringify(catData) })
        .then((category) => {
          setCategories(prev => [...prev.filter(c => c.id !== category.id), category]);
          showToast(`دسته‌بندی «${category.name}» با موفقیت افزوده شد.`, 'success');
          void refreshCatalog();
        })
        .catch((error) => showToast(error instanceof Error ? error.message : 'خطا در افزودن دسته‌بندی.', 'error'));
      return newCategory;
    }
    setCategories(prev => [...prev, newCategory]);
    showToast(`دسته‌بندی «${newCategory.name}» با موفقیت افزوده شد.`, 'success');
    return newCategory;
  };

  const updateCategory = (id: number, updates: Partial<Category>) => {
    if (!isDemoMode) {
      void api.adminRequest<Category>(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(updates) })
        .then((category) => {
          setCategories(prev => prev.map(current => current.id === id ? category : current));
          showToast('دسته‌بندی با موفقیت به‌روزرسانی شد.', 'success');
          void refreshCatalog();
        })
        .catch((error) => showToast(error instanceof Error ? error.message : 'خطا در ویرایش دسته‌بندی.', 'error'));
      return;
    }
    setCategories(prev => prev.map(category => category.id === id ? { ...category, ...updates } : category));
    showToast('دسته‌بندی با موفقیت به‌روزرسانی شد.', 'success');
  };

  const deleteCategory = (id: number) => {
    if (!isDemoMode) {
      void api.adminRequest(`/categories/${id}`, { method: 'DELETE' })
        .then(() => {
          setCategories(prev => prev.filter(category => category.id !== id));
          showToast('دسته‌بندی با موفقیت حذف شد.', 'info');
          void refreshCatalog();
        })
        .catch((error) => showToast(error instanceof Error ? error.message : 'خطا در حذف دسته‌بندی.', 'error'));
      return;
    }
    setCategories(prev => prev.filter(category => category.id !== id));
    showToast('دسته‌بندی با موفقیت حذف شد.', 'info');
  };

  // Order Operations (Admin)
  const updateOrderStatus = (orderId: string, status: UserOrder['status'], trackingCode?: string) => {
    const statusLabels: Record<UserOrder['status'], string> = {
      pending: 'در انتظار پرداخت', processing: 'در حال پردازش', preparing: 'در حال آماده‌سازی', shipping: 'ارسال شده', delivered: 'تحویل داده شده', cancelled: 'لغو شده', returned: 'مرجوع شده'
    };
    const serverStatuses: Record<UserOrder['status'], string> = {
      pending: 'pending', processing: 'paid', preparing: 'processing', shipping: 'shipped', delivered: 'completed', cancelled: 'cancelled', returned: 'refunded'
    };

    if (!isDemoMode) {
      void api.adminRequest<Record<string, any>>(`/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: serverStatuses[status], tracking_code: trackingCode }),
      })
        .then((order) => {
          const updatedOrder = mapOrder(order);
          setAllOrders(prev => prev.map(current => current.id === updatedOrder.id ? updatedOrder : current));
          setUserOrders(prev => prev.map(current => current.id === updatedOrder.id ? updatedOrder : current));
          showToast(`وضعیت سفارش ${updatedOrder.order_number} به «${statusLabels[status]}» تغییر یافت.`, 'success');
        })
        .catch((error) => showToast(error instanceof Error ? error.message : 'خطا در به‌روزرسانی سفارش.', 'error'));
      return;
    }

    setAllOrders(prev => prev.map(order => order.id === orderId || order.order_number === orderId ? { ...order, status, status_label: statusLabels[status], tracking_code: trackingCode ?? order.tracking_code } : order));
    showToast(`وضعیت سفارش ${orderId} به «${statusLabels[status]}» تغییر یافت.`, 'success');
  };

  const deleteOrder = (orderId: string) => {
    if (!isDemoMode) {
      showToast('برای حفظ سوابق مالی، حذف سفارش مجاز نیست؛ در صورت نیاز وضعیت سفارش را به لغو‌شده تغییر دهید.', 'error');
      return;
    }
    setAllOrders(prev => prev.filter(order => order.id !== orderId && order.order_number !== orderId));
    showToast(`سفارش ${orderId} حذف گردید.`, 'info');
  };

  // User Management (Admin)
  const updateUserRole = async (userId: number, role: UserProfile['role'], status?: UserProfile['status']): Promise<void> => {
    const target = allUsers.find(current => current.id === userId);
    if (!target) return;
    const nextStatus = status ?? target.status;
    if (!isDemoMode) {
      try {
        const updated = await api.adminRequest<Record<string, any>>(`/users/${userId}/status`, { method: 'PATCH', body: JSON.stringify({ status: nextStatus, role }) });
        const mapped = mapUser({ ...target, ...updated, wallet_balance: updated.wallet_balance ?? target.wallet_balance });
        setAllUsers(prev => prev.map(current => current.id === userId ? mapped : current));
        if (user?.id === userId) setUser(mapped);
        showToast('سطح دسترسی کاربر با موفقیت تغییر یافت.', 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'خطا در تغییر نقش کاربر.', 'error');
        throw error;
      }
      return;
    }
    setAllUsers(prev => prev.map(current => current.id === userId ? { ...current, role, status: nextStatus } : current));
    showToast('سطح دسترسی کاربر با موفقیت تغییر یافت.', 'success');
  };

  const updateUserStatus = async (userId: number, status: 'active' | 'suspended'): Promise<void> => {
    const target = allUsers.find(current => current.id === userId);
    if (!target) return;
    if (!isDemoMode) {
      try {
        const updated = await api.adminRequest<Record<string, any>>(`/users/${userId}/status`, { method: 'PATCH', body: JSON.stringify({ status, role: target.role }) });
        const mapped = mapUser({ ...target, ...updated, wallet_balance: updated.wallet_balance ?? target.wallet_balance });
        setAllUsers(prev => prev.map(current => current.id === userId ? mapped : current));
        if (user?.id === userId) setUser(mapped);
        showToast('وضعیت حساب کاربری تغییر کرد.', 'info');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'خطا در تغییر وضعیت کاربر.', 'error');
        throw error;
      }
      return;
    }
    setAllUsers(prev => prev.map(current => current.id === userId ? { ...current, status } : current));
    showToast('وضعیت حساب کاربری تغییر کرد.', 'info');
  };

  const adjustUserWallet = async (userId: number, amount: number, note: string): Promise<void> => {
    if (!isDemoMode) {
      try {
        const res = await api.adminRequest<{ success: boolean; data?: { balance?: number } }>(`/users/${userId}/wallet-adjustments`, { method: 'POST', body: JSON.stringify({ amount, note }) });
        const newBalance = typeof res?.data?.balance === 'number' ? res.data.balance : undefined;
        setAllUsers(prev => prev.map(current => current.id === userId ? { ...current, wallet_balance: newBalance !== undefined ? newBalance : (current.wallet_balance || 0) + amount } : current));
        showToast('موجودی کیف پول کاربر با موفقیت به‌روزرسانی شد.', 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'خطا در تعدیل کیف پول.', 'error');
        throw error;
      }
      return;
    }
    setAllUsers(prev => prev.map(current => current.id === userId ? { ...current, wallet_balance: Math.max(0, (current.wallet_balance || 0) + amount) } : current));
    showToast('موجودی کیف پول کاربر با موفقیت به‌روزرسانی شد.', 'success');
  };

  // Ticket Operations (Admin)
  const adminReplyTicket = async (ticketId: string, message: string, newStatus: SupportTicket['status'] = 'answered'): Promise<void> => {
    if (!isDemoMode) {
      let mapped = mapTicket(await api.adminRequest<Record<string, any>>(`/tickets/${ticketId}/reply`, { method: 'POST', body: JSON.stringify({ message }) }));
      if (newStatus !== 'answered') {
        const updated = await api.adminRequest<Record<string, any>>(`/tickets/${ticketId}`, { method: 'PATCH', body: JSON.stringify({ status: newStatus }) });
        mapped = mapTicket(updated);
      }
      setSupportTickets(prev => prev.map(current => current.id === mapped.id ? mapped : current));
      showToast('پاسخ با موفقیت برای کاربر ارسال شد.', 'success');
      return;
    }

    const now = new Date();
    setSupportTickets(prev => prev.map(ticket => ticket.id === ticketId ? { ...ticket, status: newStatus, messages: [...ticket.messages, { id: Date.now(), sender: 'support', author: user?.name || 'مدیر سیستم', time: now.toLocaleTimeString('fa-IR'), date: now.toLocaleDateString('fa-IR'), message }] } : ticket));
    showToast('پاسخ با موفقیت برای کاربر ارسال شد.', 'success');
  };

  const updateTicketStatus = async (ticketId: string, status: SupportTicket['status'], priority?: SupportTicket['priority']): Promise<void> => {
    if (!isDemoMode) {
      const ticket = await api.adminRequest<Record<string, any>>(`/tickets/${ticketId}`, { method: 'PATCH', body: JSON.stringify({ status, priority }) });
      const mapped = mapTicket(ticket);
      setSupportTickets(prev => prev.map(current => current.id === mapped.id ? mapped : current));
      showToast('وضعیت تیکت به‌روزرسانی شد.', 'success');
      return;
    }
    setSupportTickets(prev => prev.map(ticket => ticket.id === ticketId ? { ...ticket, status, priority: priority || ticket.priority } : ticket));
    showToast('وضعیت تیکت به‌روزرسانی شد.', 'success');
  };

  const markAdminTicketRead = async (ticketId: string): Promise<void> => {
    if (!isDemoMode) {
      const ticket = mapTicket(await api.adminRequest<Record<string, any>>(`/tickets/${ticketId}/read`, { method: 'POST' }));
      setSupportTickets(prev => prev.map(current => current.id === ticket.id ? ticket : current));
      return;
    }

    setSupportTickets(prev => prev.map(ticket => ticket.id === ticketId ? {
      ...ticket,
      messages: ticket.messages.map(message => message.sender === 'user' ? { ...message, read_at: new Date().toISOString() } : message),
    } : ticket));
  };

  const archiveAdminTicket = async (ticketId: string): Promise<void> => {
    const ticket = mapTicket(await api.adminRequest<Record<string, any>>(`/tickets/${ticketId}/archive`, { method: 'POST' }));
    setSupportTickets(prev => prev.map(current => current.id === ticket.id ? ticket : current));
    showToast('تیکت بسته‌شده بایگانی شد.', 'success');
  };

  const restoreAdminTicket = async (ticketId: string): Promise<void> => {
    const ticket = mapTicket(await api.adminRequest<Record<string, any>>(`/tickets/${ticketId}/restore`, { method: 'POST' }));
    setSupportTickets(prev => prev.map(current => current.id === ticket.id ? ticket : current));
    showToast('تیکت از بایگانی بازگردانده شد.', 'success');
  };

  const deleteAdminTicket = async (ticketId: string): Promise<void> => {
    await api.adminRequest(`/tickets/${ticketId}`, { method: 'DELETE' });
    setSupportTickets(prev => prev.filter(ticket => ticket.id !== ticketId));
    showToast('تیکت بایگانی‌شده برای همیشه حذف شد.', 'success');
  };

  // Discount Coupons State (Admin)
  const [discountCoupons, setDiscountCoupons] = useState<DiscountCoupon[]>(() => isDemoMode ? mockDiscountCoupons : []);
  const mapDiscountCoupon = (coupon: Record<string, any>): DiscountCoupon => ({
    id: String(coupon.id),
    code: String(coupon.code || ''),
    title: String(coupon.title || ''),
    type: coupon.discount_type,
    discount_type: coupon.discount_type,
    value: Number(coupon.discount_value ?? 0),
    discount_value: Number(coupon.discount_value ?? 0),
    min_order_amount: Number(coupon.min_order_amount ?? 0),
    max_discount_amount: coupon.max_discount_amount == null ? undefined : Number(coupon.max_discount_amount),
    usage_limit: Number(coupon.usage_limit ?? 0),
    usage_count: Number(coupon.usage_count ?? 0),
    used_count: Number(coupon.usage_count ?? 0),
    start_date: coupon.starts_at || coupon.start_date,
    expiry_date: coupon.expires_at || coupon.expiry_date || '',
    is_active: Boolean(coupon.is_active),
  });

  const addDiscountCoupon = (couponData: Omit<DiscountCoupon, 'id'>): DiscountCoupon => {
    const newCoupon: DiscountCoupon = { ...couponData, id: `cpn-${Date.now()}`, discount_type: couponData.discount_type || couponData.type || 'percentage', discount_value: couponData.discount_value ?? couponData.value ?? 10, is_active: couponData.is_active ?? true };
    if (!isDemoMode) {
      void api.adminRequest<Record<string, any>>('/discounts', { method: 'POST', body: JSON.stringify({
        code: couponData.code, title: couponData.title, discount_type: couponData.discount_type || couponData.type || 'percentage', discount_value: couponData.discount_value ?? couponData.value ?? 10,
        min_order_amount: couponData.min_order_amount, max_discount_amount: couponData.max_discount_amount, usage_limit: couponData.usage_limit, starts_at: couponData.start_date, expires_at: couponData.expiry_date, is_active: couponData.is_active ?? true,
      }) })
        .then((coupon) => { const mapped = mapDiscountCoupon(coupon); setDiscountCoupons(prev => [mapped, ...prev]); showToast(`کد تخفیف «${mapped.code}» با موفقیت تعریف شد.`, 'success'); })
        .catch((error) => showToast(error instanceof Error ? error.message : 'خطا در تعریف کد تخفیف.', 'error'));
      return newCoupon;
    }
    setDiscountCoupons(prev => [newCoupon, ...prev]);
    showToast(`کد تخفیف «${newCoupon.code}» با موفقیت تعریف شد.`, 'success');
    return newCoupon;
  };

  const deleteDiscountCoupon = (id: string) => {
    if (!isDemoMode) {
      void api.adminRequest(`/discounts/${id}`, { method: 'DELETE' })
        .then(() => { setDiscountCoupons(prev => prev.filter(coupon => coupon.id !== id)); showToast('کد تخفیف با موفقیت حذف گردید.', 'info'); })
        .catch((error) => showToast(error instanceof Error ? error.message : 'خطا در حذف کد تخفیف.', 'error'));
      return;
    }
    setDiscountCoupons(prev => prev.filter(coupon => coupon.id !== id));
    showToast('کد تخفیف با موفقیت حذف گردید.', 'info');
  };

  const toggleDiscountCoupon = (id: string) => {
    if (!isDemoMode) {
      void api.adminRequest<Record<string, any>>(`/discounts/${id}/toggle`, { method: 'POST' })
        .then((coupon) => { const mapped = mapDiscountCoupon(coupon); setDiscountCoupons(prev => prev.map(current => current.id === id ? mapped : current)); showToast('وضعیت فعال‌بودن کد تخفیف تغییر یافت.', 'success'); })
        .catch((error) => showToast(error instanceof Error ? error.message : 'خطا در تغییر وضعیت کد تخفیف.', 'error'));
      return;
    }
    setDiscountCoupons(prev => prev.map(coupon => coupon.id === id ? { ...coupon, is_active: !coupon.is_active } : coupon));
    showToast('وضعیت فعال‌بودن کد تخفیف تغییر یافت.', 'success');
  };

  // Store Settings State (Admin)
  const [storeSettings, setStoreSettings] = useState<StoreSettings>(() => isDemoMode ? initialStoreSettings : initialStoreSettings);

  const updateStoreSettings = (settings: Partial<StoreSettings>) => {
    const updated = { ...storeSettings, ...settings };
    if (!isDemoMode) {
      void api.adminRequest('/settings/store_settings', { method: 'PUT', body: JSON.stringify({ settings: { config: updated } }) })
        .then(() => { setStoreSettings(updated); showToast('تنظیمات فروشگاه به‌روزرسانی شد.', 'success'); })
        .catch((error) => showToast(error instanceof Error ? error.message : 'خطا در ذخیره تنظیمات فروشگاه.', 'error'));
      return;
    }
    setStoreSettings(updated);
    showToast('تنظیمات فروشگاه به‌روزرسانی شد.', 'success');
  };

  const loginAsAdminDemo = () => {
    if (!isDemoMode) {
      showToast('ورود نمایشی در محیط انتشار غیرفعال است.', 'error');
      return;
    }

    const adminUser = mockAllUsers.find(u => u.role === 'admin') || {
      id: 1,
      name: 'مدیر نمایشی',
      email: 'demo-admin@preview.local',
      role: 'admin' as const,
      status: 'active' as const,
    };
    setUser(adminUser);
    api.setToken('admin_demo_token_valid');
    if (isDemoMode && typeof window !== 'undefined') {
      localStorage.setItem('apex_user', JSON.stringify(adminUser));
    }
    showToast('ورود با حساب مدیر کل با موفقیت انجام شد.', 'success');
  };

  return (
    <AppContext.Provider
      value={{
        activeView,
        setActiveView,
        selectedProductSlug,
        setSelectedProductSlug,
        selectedArticleSlug,
        setSelectedArticleSlug,
        selectedCategorySlug,
        setSelectedCategorySlug,
        categoryHierarchy,
        setCategoryHierarchy,
        selectedServiceSlug,
        setSelectedServiceSlug,
        selectedServiceCategory,
        setSelectedServiceCategory,
        navigateToCategory,
        navigateToProduct,
        navigateToArticle,
        navigateToService,
        navigateToServiceCategory,
        navigateTo,
        copyShareLink,
        isMobileDrawerOpen,
        setMobileDrawerOpen,
        isSearchOverlayOpen,
        setSearchOverlayOpen,
        searchQuery,
        setSearchQuery,
        isAuthModalOpen,
        setAuthModalOpen,
        isAdminCustomizerOpen,
        setAdminCustomizerOpen,
        activeMegaMenu,
        setActiveMegaMenu,
        categories,
        products,
        services,
        isLoadingData,
        isFilterLoading,
        setIsFilterLoading,
        refreshCatalog,
        checkoutStep,
        setCheckoutStep,
        cart,
        cartSummary,
        addToCart,
        updateCartQuantity,
        removeFromCart,
        clearCart,
        refreshCart,
        appliedCoupon,
        applyCoupon,
        removeCoupon,
        addresses,
        selectedAddressId,
        setSelectedAddressId,
        addAddress,
        updateAddress,
        deleteAddress,
        paymentMethod,
        setPaymentMethod,
        paymentStatusData,
        setPaymentStatusData,
        triggerPaymentStatus,
        favorites,
        toggleFavorite,
        isFavorite,
        user,
        updateUserProfile,
        updatePassword,
        login,
        loginWithPhone,
        sendOtpCode,
        requestPasswordResetSms,
        resetPasswordWithSms,
        loginWithGoogle,
        logout,
        profileSubTab,
        setProfileSubTab,
        openProfileTab,
        userOrders,
        cancelOrder,
        reorderItems,
        supportTickets,
        addSupportTicket,
        addTicketReply,
        closeSupportTicket,
        refreshSupportTickets,
        activeSessions,
        terminateSession,
        terminateOtherSessions,
        walletTransactions,
        addWalletCredit,
        toast,
        showToast,
        hideToast,
        themeSettings,
        updateThemeSettings,
        adminSubTab,
        setAdminSubTab,
        openAdminTab,
        appearanceSettings,
        updateAppearanceSettings,
        staticContent,
        updateStaticContent,
        blogPosts,
        addBlogPost,
        updateBlogPost,
        deleteBlogPost,
        checkoutConfiguration,
        updateCheckoutConfiguration,
        smsSystemConfiguration,
        updateSmsSystemConfiguration,
        testSmsSystemConnection,
        paymentGateways,
        updatePaymentGateway,
        setDefaultPaymentGateway,
        smsConfig,
        updateSmsConfig,
        updateSmsTemplate,
        sendTestSms,
        allOrders,
        updateOrderStatus,
        deleteOrder,
        allUsers,
        updateUserRole,
        updateUserStatus,
        adjustUserWallet,
        addProduct,
        updateProduct,
        deleteProduct,
        toggleProductStock,
        toggleProductFeatured,
        toggleProductActive,
        addCategory,
        updateCategory,
        deleteCategory,
        adminReplyTicket,
        updateTicketStatus,
        markAdminTicketRead,
        archiveAdminTicket,
        restoreAdminTicket,
        deleteAdminTicket,
        discountCoupons,
        addDiscountCoupon,
        deleteDiscountCoupon,
        toggleDiscountCoupon,
        storeSettings,
        updateStoreSettings,
        loginAsAdminDemo,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
