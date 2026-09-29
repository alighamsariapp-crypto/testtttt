import { CatalogFacetResponse, Category, Product, ServiceItem, ThemeSettings, UserProfile } from '../types';
import { initialThemeSettings, sampleCategories, sampleProducts, sampleServices } from './mockData';

export interface AuthResult {
  user: UserProfile;
  token: string;
  is_new_user?: boolean;
}

export interface CheckoutResult {
  order_id: number;
  order_number: string;
  grand_total: number;
  currency: string;
  status: string;
  payment_status: string;
  items: Array<Record<string, any>>;
  payment_intent: {
    gateway: string;
    action?: string;
    reference_id?: string;
    payment_status?: string;
    payment_url?: string;
    instructions?: string;
    account_name?: string;
    card_number?: string;
  };
}

export const demoCustomer = (email = 'demo-user@preview.local'): UserProfile => ({
  id: 1,
  name: 'کاربر نمایشی نوین‌نت',
  email,
  role: 'customer',
  status: 'active',
  phone_verified: false,
  has_password: true,
});

export const getDemoProducts = (params: Record<string, any> = {}): { data: Product[]; total: number } => {
  let productPool: Product[] = sampleProducts;
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('apex_products');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) productPool = parsed as Product[];
      } catch (error) {
        console.error('Could not read demo products from local storage.', error);
      }
    }
  }
  let filtered = [...productPool];
  if (params.category_slug) filtered = filtered.filter((product) => product.category_slug === params.category_slug);
  if (params.search) {
    const search = String(params.search).toLowerCase();
    filtered = filtered.filter(
      (product) =>
        product.name.toLowerCase().includes(search) ||
        product.description?.toLowerCase().includes(search) ||
        product.sku?.toLowerCase().includes(search)
    );
  }
  return { data: filtered, total: filtered.length };
};

export const demoAdapter = {
  getCategories(): Category[] {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('apex_categories');
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch (e) {
          console.error(e);
        }
      }
    }
    return sampleCategories;
  },

  getProducts(params: Record<string, any> = {}): { data: Product[]; total: number } {
    return getDemoProducts(params);
  },

  getCatalogFacets(_params: Record<string, any> = {}): CatalogFacetResponse {
    return { price: { min: 0, max: 0 }, availability_count: 0, facets: [] };
  },

  getProductBySlug(slug: string): Product {
    const found = getDemoProducts().data.find((p) => p.slug === slug);
    if (!found) throw new Error('Product not found in demo catalog');
    return found;
  },

  getServices(): ServiceItem[] {
    return sampleServices;
  },

  createServiceRequest(_payload: any) {
    return {
      id: Math.floor(Math.random() * 1000) + 1,
      reference_number: 'REQ-' + Math.floor(Math.random() * 900000 + 100000),
      status: 'pending',
      message: 'درخواست شما با موفقیت ثبت شد و در صف بررسی کارشناسان قرار گرفت.',
    };
  },

  checkout(payload: { payment_gateway: string; idempotency_key?: string }): CheckoutResult {
    return {
      order_id: Math.floor(Math.random() * 9000) + 1000,
      order_number: 'ORD-' + Math.floor(Math.random() * 899999 + 100000),
      grand_total: 0,
      currency: 'IRR',
      status: 'pending',
      payment_status: 'pending',
      items: [],
      payment_intent: {
        gateway: payload.payment_gateway,
        action: 'ready',
      },
    };
  },

  sendOtp(_phone: string) {
    return {
      success: true,
      message: 'کد تایید با موفقیت ارسال شد (محیط آزمایشی)',
      expiresIn: 119,
    };
  },

  verifyOtp(_phone: string, _code: string): AuthResult {
    const user = demoCustomer();
    const token = 'demo_sanctum_token_' + Math.random().toString(36).substring(7);
    return { user, token };
  },

  requestPasswordResetSms(_phone: string) {
    return {
      success: true,
      message: 'در محیط نمایشی، مرحلهٔ بازیابی رمز آماده است.',
      expiresIn: 600,
      resendIn: 60,
    };
  },

  confirmPasswordResetSms(_payload: any): AuthResult {
    const token = 'demo_session_' + crypto.randomUUID();
    return { user: demoCustomer(), token };
  },

  startGoogleLogin(tokenSetter: { setToken: (t: string) => void }) {
    const token = 'demo_google_token_' + Math.random().toString(36).substring(7);
    tokenSetter.setToken(token);
  },

  login(credentials: { email: string; password: string }, tokenSetter: { setToken: (t: string) => void }): { user: UserProfile; token: string } {
    const user = demoCustomer(credentials.email.trim() || 'demo-user@preview.local');
    const token = 'demo_sanctum_token_' + Math.random().toString(36).substring(7);
    tokenSetter.setToken(token);
    return { user, token };
  },

  getProfile(): UserProfile {
    return demoCustomer();
  },

  getThemeSettings(): ThemeSettings {
    return initialThemeSettings;
  },

  saveThemeSettings(settings: ThemeSettings): ThemeSettings {
    return settings;
  },
};
