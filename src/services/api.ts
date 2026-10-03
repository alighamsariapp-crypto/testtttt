import { ActiveSession, CartSummary, CatalogFacetResponse, Category, PaymentStatusType, Product, ServiceCategoryItem, ServiceItem, SupportTicket, ThemeSettings, UserAddress, UserFavorite, UserOrder, UserProfile, WalletTransaction } from '../types';
import { initialThemeSettings } from './mockData';
import { mapActiveSession, mapAddress, mapCartSummary, mapOrder, mapProduct, mapService, mapTicket, mapUser, mapWalletTransaction } from './apiMappers';
import { API_BASE_URL, isDemoMode } from '../config/env';
import { demoAdapter, demoCustomer } from './demoAdapter';

export { isDemoMode, demoCustomer };

const API_BASE = API_BASE_URL;

const localizedApiError = (status: number, payload: Record<string, unknown> = {}): string => {
  const message = typeof payload.message === 'string' ? payload.message.trim() : '';
  const errorCode = typeof payload.error_code === 'string' ? payload.error_code.trim() : '';
  const normalized = message.toLowerCase();

  if (errorCode === 'INSUFFICIENT_STOCK') return 'موجودی انتخاب‌شده کافی نیست. تعداد را کاهش دهید یا رنگ دیگری انتخاب کنید.';
  if (errorCode === 'DUPLICATE_VARIANT_SKU') return 'کد یکی از رنگ‌ها تکراری است. رنگ‌های تکراری را حذف یا فرم را یک‌بار باز و دوباره ذخیره کنید.';
  if (errorCode === 'INVALID_VARIANT_SKU') return 'کد داخلی یکی از رنگ‌ها معتبر نیست. صفحه را یک‌بار تازه‌سازی و دوباره ذخیره کنید.';
  if (errorCode === 'DUPLICATE_VARIANT_COLOR') return 'هر رنگ باید فقط یک‌بار ثبت شود. رنگ تکراری را حذف کنید.';
  if (errorCode === 'INVALID_VARIANT_COLOR') return 'نام رنگ یکی از variantها معتبر نیست. رنگ را اصلاح کنید.';
  if (errorCode === 'INVENTORY_BELOW_RESERVED') return 'موجودی جدید از تعداد رزروشده کمتر است. ابتدا سفارش‌های رزروشده را بررسی کنید یا مقدار بالاتری وارد کنید.';
  if (errorCode === 'INVALID_PRODUCT_VARIANT') return 'یکی از رنگ‌ها به این محصول تعلق ندارد. صفحه را تازه‌سازی کنید تا اطلاعات صحیح دریافت شود.';
  if (errorCode === 'PRODUCT_UPDATE_FAILED') return 'ثبت تغییرات انجام نشد. رنگ، قیمت و موجودی را بررسی کنید و دوباره ذخیره کنید.';
  if (errorCode === 'PRODUCT_ATTRIBUTE_SCHEMA_MISSING') return 'ساختار ویژگی‌های دسته‌ای هنوز روی سرور فعال نشده است. ابتدا migration فروشگاه را اجرا کنید.';
  if (errorCode === 'PASSWORD_RESET_SMS_INVALID_OR_EXPIRED') return 'کد بازیابی نامعتبر یا منقضی شده است. یک کد جدید درخواست کنید.';
  if (errorCode === 'PASSWORD_RESET_SMS_ATTEMPT_LIMIT_REACHED') return 'تعداد تلاش‌های ناموفق زیاد بود. لطفاً یک کد جدید درخواست کنید.';
  if (errorCode === 'PASSWORD_RESET_SMS_RESEND_TOO_SOON') return 'برای درخواست کد جدید، چند لحظه صبر کنید.';
  if (errorCode === 'SMS_NOT_CONFIGURED' || errorCode === 'SMS_DISABLED') return 'سامانهٔ پیامک هنوز توسط مدیریت فعال نشده است.';
  if (errorCode === 'CART_CURRENCY_MISMATCH') return 'کالاهای سبد باید یک واحد پولی یکسان داشته باشند.';
  if (status === 401 || normalized.includes('unauthenticated')) return 'برای انجام این عملیات ابتدا وارد حساب کاربری شوید.';
  if (status === 403 || normalized.includes('unauthorized') || normalized.includes('forbidden')) return 'شما دسترسی لازم برای انجام این عملیات را ندارید.';
  if (status === 404 || normalized.includes('not found')) return 'اطلاعات درخواستی پیدا نشد یا دیگر در دسترس نیست.';
  const validationErrors = payload.errors;
  if (status === 422 || normalized.includes('given data was invalid') || normalized.includes('validation')) {
    if (validationErrors && typeof validationErrors === 'object') {
      const firstError = Object.values(validationErrors as Record<string, unknown>)
        .flatMap((field) => Array.isArray(field) ? field : [field])
        .find((field) => typeof field === 'string' && field.trim());
      if (typeof firstError === 'string') return firstError;
    }
    return 'اطلاعات واردشده معتبر نیست. لطفاً موارد فرم را بررسی کنید.';
  }
  if (status === 429 || normalized.includes('too many')) return 'تعداد درخواست‌ها زیاد است. لطفاً چند لحظه بعد دوباره تلاش کنید.';
  if (status >= 500) return 'در ارتباط با سرور خطایی رخ داد. لطفاً کمی بعد دوباره تلاش کنید.';
  if (normalized.includes('failed to fetch') || normalized.includes('network')) return 'ارتباط با اینترنت یا سرور برقرار نشد. اتصال خود را بررسی کنید.';
  return message && /[\u0600-\u06FF]/.test(message) ? message : 'انجام درخواست با خطا مواجه شد. لطفاً دوباره تلاش کنید.';
};

export interface AuthResult {
  user: UserProfile;
  token: string;
  is_new_user?: boolean;
}

type SmsPasswordResetDispatch = {
  success: boolean;
  message: string;
  expires_in?: number;
  expiresIn?: number;
  resend_in?: number;
  resendIn?: number;
};

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

export class ApiService {
  private baseUrl: string;
  private token: string | null = null;
  private cartSessionId: string;
  private cache: Map<string, { data: any; timestamp: number; ttl: number }> = new Map();
  private inFlightRequests: Map<string, Promise<any>> = new Map();
  private DEFAULT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

  constructor(baseUrl: string = API_BASE) {
    this.baseUrl = baseUrl;
    if (typeof localStorage !== 'undefined') {
      this.token = localStorage.getItem('apex_auth_token');
      this.cartSessionId = localStorage.getItem('apex_cart_session_id') || crypto.randomUUID();
      localStorage.setItem('apex_cart_session_id', this.cartSessionId);
    } else {
      this.cartSessionId = crypto.randomUUID();
    }
  }

  public setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('apex_auth_token', token);
    } else {
      localStorage.removeItem('apex_auth_token');
    }
    this.invalidateCache('/users');
  }

  public getToken(): string | null {
    return this.token;
  }

  public invalidateCache(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
      return;
    }
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  private getCached<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  private setCached(key: string, data: any, ttl = this.DEFAULT_CACHE_TTL): void {
    this.cache.set(key, { data, timestamp: Date.now(), ttl });
  }

  private async request<T>(endpoint: string, options: RequestInit = {}, customTTL?: number): Promise<T> {
    const method = options.method || 'GET';
    const isGet = method === 'GET';
    const shouldCache = isGet && options.cache !== 'no-store';
    const cacheKey = `${method}:${endpoint}`;
    
    // Fresh polling requests must bypass the in-memory cache as well as browser HTTP cache.
    if (shouldCache) {
      const cached = this.getCached<T>(cacheKey);
      if (cached !== null) {
        return cached;
      }

      // Check in-flight deduplication (Shared Promise for concurrent calls)
      const existingPromise = this.inFlightRequests.get(cacheKey);
      if (existingPromise) {
        return existingPromise as Promise<T>;
      }
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    headers['X-Session-ID'] = this.cartSessionId;

    const execute = async (): Promise<T> => {
      try {
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
          ...options,
          headers,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(localizedApiError(response.status, errorData));
        }

        const json = await response.json();
        const result = (json.data !== undefined ? json.data : json) as T;
        
        if (shouldCache) {
          this.setCached(cacheKey, result, customTTL ?? this.DEFAULT_CACHE_TTL);
        }

        return result;
      } catch (err) {
        if (err instanceof TypeError) {
          throw new Error(localizedApiError(0, { message: err.message }));
        }
        throw err;
      } finally {
        if (shouldCache) {
          this.inFlightRequests.delete(cacheKey);
        }
      }
    };

    const reqPromise = execute();
    if (shouldCache) {
      this.inFlightRequests.set(cacheKey, reqPromise);
    }
    return reqPromise;
  }

  // --- Categories (Static / Semi-Static: 15 min TTL) ---
  public async getCategories(): Promise<Category[]> {
    if (isDemoMode) {
      return demoAdapter.getCategories();
    }
    return await this.request<Category[]>('/categories', {}, 15 * 60 * 1000);
  }

  public async getCategoryBySlugOrId(slugOrId: string | number): Promise<Category> {
    return await this.request<Category>(`/categories/${slugOrId}`);
  }

  // --- Products Catalog (Semi-Dynamic: 5 min TTL) ---
  public async getProducts(params: Record<string, any> = {}): Promise<{ data: Product[]; total: number }> {
    if (isDemoMode) {
      return demoAdapter.getProducts(params);
    }
    const query = new URLSearchParams(params).toString();
    const res = await this.request<{ data?: Record<string, any>[]; total?: number; meta?: { total?: number } } | Record<string, any>[]>(`/products?${query}`, {}, 5 * 60 * 1000);
    const records = Array.isArray(res) ? res : (Array.isArray(res.data) ? res.data : []);
    return {
      data: records.map(mapProduct),
      total: Array.isArray(res) ? records.length : Number(res.total ?? res.meta?.total ?? records.length),
    };
  }

  public async getCatalogFacets(params: { category_slug?: string; category_id?: number; min_price?: number; max_price?: number; in_stock?: boolean; facets?: Record<string, string[]> } = {}): Promise<CatalogFacetResponse> {
    if (isDemoMode) {
      return demoAdapter.getCatalogFacets(params);
    }
    const query = new URLSearchParams();
    if (params.category_slug) query.set('category_slug', params.category_slug);
    if (params.category_id) query.set('category_id', String(params.category_id));
    if (params.min_price !== undefined) query.set('min_price', String(params.min_price));
    if (params.max_price !== undefined) query.set('max_price', String(params.max_price));
    if (params.in_stock) query.set('in_stock', '1');
    Object.entries(params.facets || {}).forEach(([key, values]) => values.forEach((value) => query.append(`facets[${key}][]`, value)));

    return await this.request<CatalogFacetResponse>(`/products/facets?${query.toString()}`, {}, 30 * 1000);
  }

  // --- Product Detail (5 min TTL) ---
  public async getProductBySlug(slug: string): Promise<Product> {
    if (isDemoMode) {
      return demoAdapter.getProductBySlug(slug);
    }
    return mapProduct(await this.request<Record<string, any>>(`/products/${slug}`, {}, 5 * 60 * 1000));
  }

  // --- Services (Static / Semi-Static: 15 min TTL) ---
  public async getServices(): Promise<ServiceItem[]> {
    if (isDemoMode) {
      return demoAdapter.getServices();
    }
    const services = await this.request<Record<string, any>[]>('/services', { cache: 'no-store' }, 15 * 60 * 1000);
    return services.map(mapService);
  }

  public async getAdminOnlineServices(): Promise<ServiceItem[]> {
    const services = await this.adminRequest<Record<string, any>[]>('/services/catalog');
    return services.map(mapService);
  }

  public async getAdminServiceCategories(): Promise<ServiceCategoryItem[]> {
    return this.adminRequest<ServiceCategoryItem[]>('/services/categories');
  }

  public async getAdminProductAttributeDefinitions(): Promise<Array<Record<string, any>>> {
    return this.adminRequest<Array<Record<string, any>>>('/product-attributes');
  }

  public async syncAdminCategoryProductAttributes(categoryId: number, definitions: Array<{ id: number; is_filterable?: boolean; is_required?: boolean; inherit_to_children?: boolean; sort_order?: number }>): Promise<Array<Record<string, any>>> {
    return this.adminRequest<Array<Record<string, any>>>(`/categories/${categoryId}/product-attributes`, {
      method: 'PUT',
      body: JSON.stringify({ definitions }),
    });
  }

  public async createAdminProductAttributeDefinition(payload: { key: string; name: string; data_type: 'single_select' | 'multi_select' | 'number' | 'boolean' | 'color'; unit?: string; options?: string[]; is_filterable: boolean; is_required: boolean; is_active: boolean; sort_order: number }): Promise<Record<string, any>> {
    return this.adminRequest<Record<string, any>>('/product-attributes', { method: 'POST', body: JSON.stringify(payload) });
  }

  public async updateAdminProductAttributeDefinition(id: number, payload: { key: string; name: string; data_type: 'single_select' | 'multi_select' | 'number' | 'boolean' | 'color'; unit?: string; options?: string[]; is_filterable: boolean; is_required: boolean; is_active: boolean; sort_order: number }): Promise<Record<string, any>> {
    return this.adminRequest<Record<string, any>>(`/product-attributes/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
  }

  public async createAdminServiceCategory(payload: Omit<ServiceCategoryItem, 'id' | 'services_count'>): Promise<ServiceCategoryItem> {
    return this.adminRequest<ServiceCategoryItem>('/services/categories', { method: 'POST', body: JSON.stringify(payload) });
  }

  public async updateAdminServiceCategory(id: number, payload: Omit<ServiceCategoryItem, 'id' | 'services_count'>): Promise<ServiceCategoryItem> {
    return this.adminRequest<ServiceCategoryItem>(`/services/categories/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
  }

  public async deleteAdminServiceCategory(id: number): Promise<void> {
    await this.adminRequest(`/services/categories/${id}`, { method: 'DELETE' });
  }

  public async createAdminOnlineService(payload: {
    name: string;
    slug: string;
    service_category_id: number;
    short_description: string;
    description?: string;
    documents?: string[];
    steps?: string[];
    faq?: Array<{ question: string; answer: string }>;
    contact_type: 'telegram' | 'whatsapp' | 'phone' | 'external';
    contact_url: string;
    cta_label: string;
    is_active: boolean;
  }): Promise<ServiceItem> {
    return mapService(await this.adminRequest<Record<string, any>>('/services/catalog', { method: 'POST', body: JSON.stringify(payload) }));
  }

  public async updateAdminOnlineService(id: number, payload: {
    name: string;
    slug: string;
    service_category_id: number;
    short_description: string;
    description?: string;
    documents?: string[];
    steps?: string[];
    faq?: Array<{ question: string; answer: string }>;
    contact_type: 'telegram' | 'whatsapp' | 'phone' | 'external';
    contact_url: string;
    cta_label: string;
    is_active: boolean;
  }): Promise<ServiceItem> {
    return mapService(await this.adminRequest<Record<string, any>>(`/services/catalog/${id}`, { method: 'PUT', body: JSON.stringify(payload) }));
  }

  public async deleteAdminOnlineService(id: number): Promise<void> {
    await this.adminRequest(`/services/catalog/${id}`, { method: 'DELETE' });
  }

  public async getAdminDiscounts(): Promise<any[]> {
    const res = await this.adminRequest<any>('/discounts');
    return Array.isArray(res) ? res : (res?.data || []);
  }

  public async createAdminDiscount(payload: {
    code: string;
    title: string;
    discount_type: 'percentage' | 'fixed';
    discount_value: number;
    min_order_amount?: number;
    max_discount_amount?: number | null;
    usage_limit?: number;
    starts_at?: string | null;
    expires_at?: string | null;
    is_active?: boolean;
  }): Promise<any> {
    return this.adminRequest<any>('/discounts', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async updateAdminDiscount(id: number | string, payload: Partial<{
    code: string;
    title: string;
    discount_type: 'percentage' | 'fixed';
    discount_value: number;
    min_order_amount?: number;
    max_discount_amount?: number | null;
    usage_limit?: number;
    starts_at?: string | null;
    expires_at?: string | null;
    is_active?: boolean;
  }>): Promise<any> {
    return this.adminRequest<any>(`/discounts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  public async toggleAdminDiscount(id: number | string): Promise<any> {
    return this.adminRequest<any>(`/discounts/${id}/toggle`, {
      method: 'POST',
    });
  }

  public async deleteAdminDiscount(id: number | string): Promise<any> {
    return this.adminRequest<any>(`/discounts/${id}`, {
      method: 'DELETE',
    });
  }

  public async submitServiceRequest(payload: {
    service_catalog_id?: number;
    title: string;
    requirements: string;
    custom_attributes?: Record<string, any>;
  }) {
    if (isDemoMode) {
      return demoAdapter.createServiceRequest(payload);
    }
    return await this.request('/service-requests', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async getCustomerServiceRequests(page = 1, perPage = 15): Promise<any> {
    return this.request(`/service-requests?page=${page}&per_page=${perPage}`);
  }

  public async getCustomerServiceRequest(requestIdOrNumber: string | number): Promise<any> {
    return this.request(`/service-requests/${requestIdOrNumber}`);
  }

  public async respondToServiceQuote(quoteId: number, action: 'accept' | 'reject'): Promise<any> {
    return this.request(`/service-requests/quotes/${quoteId}/respond`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    });
  }

  public async getAdminServiceRequests(status?: string, page = 1, perPage = 20): Promise<any> {
    const query = new URLSearchParams();
    if (status) query.set('status', status);
    query.set('page', String(page));
    query.set('per_page', String(perPage));
    return this.adminRequest(`/services/requests?${query.toString()}`);
  }

  public async createAdminServiceQuote(serviceRequestId: number, payload: {
    amount: number;
    currency?: string;
    scope_of_work?: string;
    terms?: string;
    valid_until?: string;
  }): Promise<any> {
    return this.adminRequest(`/services/requests/${serviceRequestId}/quotes`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async updateAdminServiceRequestStatus(serviceRequestId: number, payload: {
    status: string;
    assigned_staff_id?: number;
  }): Promise<any> {
    return this.adminRequest(`/services/requests/${serviceRequestId}/status`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  // --- Cart & Checkout (Dynamic - Invalidates caches when completed) ---
  public async getCheckoutConfiguration(): Promise<Record<string, any>> {
    return this.request<Record<string, any>>('/checkout/configuration');
  }

  public async validateCoupon(code: string, subtotal?: number): Promise<{
    valid: boolean;
    code: string;
    title: string;
    discount_type: string;
    discount_value: number;
    discount_amount: number;
    min_order_amount: number;
    max_discount_amount: number | null;
  }> {
    return this.request('/coupons/validate', {
      method: 'POST',
      body: JSON.stringify({ code, subtotal }),
    });
  }

  public async checkout(payload: {
    shipping_address: any;
    payment_gateway: string;
    shipping_method: string;
    idempotency_key?: string;
    notes?: string;
    coupon_code?: string;
    discount_code?: string;
  }): Promise<CheckoutResult> {
    const idempotencyKey = payload.idempotency_key ?? crypto.randomUUID();
    if (isDemoMode) {
      return demoAdapter.checkout({ ...payload, idempotency_key: idempotencyKey });
    }
    const res = await this.request<CheckoutResult>('/checkout', {
      method: 'POST',
      headers: { 'X-Idempotency-Key': idempotencyKey },
      body: JSON.stringify({ ...payload, idempotency_key: idempotencyKey }),
    });
    this.invalidateCache('/products');
    this.invalidateCache('/admin/discounts');
    return res;
  }

  public async getPaymentStatus(identifier: string, token?: string): Promise<{
    success: boolean;
    data: {
      order_id: number;
      order_number: string;
      order_status: string;
      payment_status: string;
      status: PaymentStatusType;
      amount: number;
      currency: string;
      gateway: string;
      payment_method?: string;
      reference_id?: string;
      track_id?: string;
      error_code?: string;
      created_at?: string;
      updated_at?: string;
    };
    message?: string;
  }> {
    if (isDemoMode) {
      return {
        success: true,
        data: {
          order_id: 1,
          order_number: identifier,
          order_status: 'paid',
          payment_status: 'paid',
          status: 'success',
          amount: 450000,
          currency: 'IRT',
          gateway: 'zibal',
          payment_method: 'پرداخت اینترنتی زیبال',
          reference_id: 'DEMO-123456',
        },
        message: 'عملیات موفق در حالت نمایشی',
      };
    }

    const headers: Record<string, string> = {};
    if (token) {
      headers['X-Payment-Status-Token'] = token;
    }

    return this.request(`/payments/status/${encodeURIComponent(identifier)}`, {
      method: 'GET',
      headers,
    });
  }

  public async exchangePaymentStatusToken(identifier: string, code: string): Promise<{
    success: boolean;
    data?: {
      token: string;
      order_id: number;
      order_number: string;
      expires_in: number;
    };
    error_code?: string;
    message?: string;
  }> {
    if (isDemoMode) {
      return {
        success: true,
        data: {
          token: 'demo-status-token',
          order_id: 1,
          order_number: identifier,
          expires_in: 300,
        },
      };
    }

    return this.request('/payments/status/exchange', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        order: identifier,
        code,
      }),
    });
  }

  // --- Auth ---
  public async sendOtp(phone: string): Promise<{ success: boolean; message: string; expiresIn: number }> {
    if (isDemoMode) {
      return demoAdapter.sendOtp(phone);
    }
    const res = await this.request<{ success: boolean; message: string; expires_in?: number; expiresIn?: number }>('/auth/otp/send', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });
    return {
      success: res.success,
      message: res.message,
      expiresIn: Number(res.expires_in ?? res.expiresIn ?? 120),
    };
  }

  public async verifyOtp(phone: string, code: string): Promise<AuthResult> {
    if (isDemoMode) {
      const res = demoAdapter.verifyOtp(phone, code);
      this.setToken(res.token);
      return res;
    }
    const res = await this.request<AuthResult>('/auth/otp/verify', {
      method: 'POST',
      body: JSON.stringify({ phone, code, device_name: 'web-client' }),
    });
    this.setToken(res.token);
    return { ...res, user: mapUser(res.user) };
  }

  public async requestPasswordResetSms(phone: string): Promise<{ success: boolean; message: string; expiresIn: number; resendIn: number }> {
    if (isDemoMode) {
      return demoAdapter.requestPasswordResetSms(phone);
    }
    const res = await this.request<SmsPasswordResetDispatch>('/auth/password-reset/sms/send', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });
    return {
      success: res.success,
      message: res.message,
      expiresIn: Number(res.expires_in ?? res.expiresIn ?? 600),
      resendIn: Number(res.resend_in ?? res.resendIn ?? 60),
    };
  }

  public async confirmPasswordResetSms(payload: { phone: string; code: string; password: string; password_confirmation: string }): Promise<AuthResult> {
    if (isDemoMode) {
      const res = demoAdapter.confirmPasswordResetSms(payload);
      this.setToken(res.token);
      return res;
    }
    const res = await this.request<AuthResult>('/auth/password-reset/sms/confirm', {
      method: 'POST',
      body: JSON.stringify({ ...payload, device_name: 'web-client' }),
    });
    this.setToken(res.token);
    return { ...res, user: mapUser(res.user) };
  }

  public startGoogleLogin(): void {
    if (isDemoMode) {
      demoAdapter.startGoogleLogin(this);
      return;
    }

    if (typeof window === 'undefined') {
      throw new Error('Google sign-in is only available in a browser.');
    }

    window.location.assign(`${API_BASE}/auth/google/redirect`);
  }

  public async exchangeGoogleHandoff(handoffCode: string): Promise<AuthResult> {
    const result = await this.request<AuthResult>('/auth/google/exchange', {
      method: 'POST',
      body: JSON.stringify({ handoff_code: handoffCode }),
    });

    this.setToken(result.token);
    return { ...result, user: mapUser(result.user) };
  }

  public async register(payload: { name: string; email: string; phone?: string; password: string }): Promise<{ user: UserProfile; token: string }> {
    const res = await this.request<{ user: UserProfile; token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    this.setToken(res.token);
    return { ...res, user: mapUser(res.user) };
  }

  public async login(credentials: { email: string; password: string }): Promise<{ user: UserProfile; token: string }> {
    if (isDemoMode) {
      return demoAdapter.login(credentials, this);
    }
    const res = await this.request<{ user: UserProfile; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    this.setToken(res.token);
    return { ...res, user: mapUser(res.user) };
  }

  public async changePassword(payload: { current_password?: string; password: string; password_confirmation: string }): Promise<void> {
    await this.request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async getProfile(): Promise<UserProfile> {
    if (isDemoMode) {
      return demoAdapter.getProfile();
    }
    const res = await this.request<Record<string, any>>('/users/me');
    return mapUser(res?.user || res);
  }

  // --- Customer account, cart and operational data ---
  public async updateProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
    const result = await this.request<Record<string, any>>('/users/me', {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
    this.invalidateCache('/users');
    return mapUser(result);
  }

  public async getAddresses(): Promise<UserAddress[]> {
    const result = await this.request<Record<string, any>[]>('/users/addresses', { cache: 'no-store' });
    return result.map(mapAddress);
  }

  public async createAddress(address: Omit<UserAddress, 'id'>): Promise<UserAddress> {
    const result = await this.request<Record<string, any>>('/users/addresses', {
      method: 'POST',
      // `type` is a backend category. The Persian title remains a separate display field.
      body: JSON.stringify({ ...address, type: 'shipping' }),
    });
    this.invalidateCache('/users');
    return mapAddress(result);
  }

  public async updateAddress(id: number, address: Partial<UserAddress>): Promise<UserAddress> {
    const result = await this.request<Record<string, any>>(`/users/addresses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(address),
    });
    this.invalidateCache('/users');
    return mapAddress(result);
  }

  public async deleteAddress(id: number): Promise<void> {
    await this.request(`/users/addresses/${id}`, { method: 'DELETE' });
    this.invalidateCache('/users');
  }

  public async getCart(): Promise<CartSummary> {
    return mapCartSummary(await this.request<Record<string, any>>('/cart'));
  }

  public async addCartItem(productVariantId: number, quantity: number): Promise<CartSummary> {
    return mapCartSummary(await this.request<Record<string, any>>('/cart/items', {
      method: 'POST',
      body: JSON.stringify({ product_variant_id: productVariantId, quantity }),
    }));
  }

  public async updateCartItem(itemId: string, quantity: number): Promise<CartSummary> {
    return mapCartSummary(await this.request<Record<string, any>>(`/cart/items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify({ quantity }),
    }));
  }

  public async removeCartItem(itemId: string): Promise<CartSummary> {
    return mapCartSummary(await this.request<Record<string, any>>(`/cart/items/${itemId}`, {
      method: 'DELETE',
    }));
  }

  public async clearCart(): Promise<void> {
    await this.request('/cart', { method: 'DELETE' });
  }

  public async getFavorites(): Promise<number[]> {
    const result = await this.request<Array<Record<string, any>>>('/favorites');
    const records = Array.isArray(result) ? result : [];
    return records.map((favorite) => Number(favorite.product_id));
  }

  public async getFavoritesDetailed(): Promise<UserFavorite[]> {
    const result = await this.request<Array<UserFavorite>>('/favorites');
    return Array.isArray(result) ? result : [];
  }

  public async addFavorite(productId: number): Promise<UserFavorite> {
    return this.request<UserFavorite>(`/favorites/${productId}`, { method: 'POST' });
  }

  public async removeFavorite(productId: number): Promise<void> {
    await this.request(`/favorites/${productId}`, { method: 'DELETE' });
  }

  public async getOrders(): Promise<UserOrder[]> {
    const result = await this.request<Record<string, any>>('/orders');
    const records = Array.isArray(result.data) ? result.data : [];
    return records.map(mapOrder);
  }

  public async getOrderById(orderId: string | number): Promise<UserOrder> {
    const result = await this.request<Record<string, any>>(`/orders/${orderId}`);
    const record = result.data ? result.data : result;
    return mapOrder(record);
  }

  public async cancelOrder(orderId: string): Promise<UserOrder> {
    return mapOrder(await this.request<Record<string, any>>(`/orders/${orderId}/cancel`, { method: 'POST' }));
  }

  public async getSupportTickets(): Promise<SupportTicket[]> {
    const result = await this.request<Record<string, any>>('/users/support-tickets', { cache: 'no-store' });
    const records = Array.isArray(result?.data) ? result.data : (Array.isArray(result) ? result : []);
    return records.map(mapTicket);
  }

  public async createSupportTicket(payload: { title: string; department: SupportTicket['department']; priority: SupportTicket['priority']; message: string }): Promise<SupportTicket> {
    return mapTicket(await this.request<Record<string, any>>('/users/support-tickets', {
      method: 'POST',
      body: JSON.stringify(payload),
    }));
  }

  public async replySupportTicket(ticketId: string, message: string): Promise<SupportTicket> {
    return mapTicket(await this.request<Record<string, any>>(`/users/support-tickets/${ticketId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    }));
  }

  public async closeSupportTicket(ticketId: string): Promise<SupportTicket> {
    return mapTicket(await this.request<Record<string, any>>(`/users/support-tickets/${ticketId}/close`, { method: 'POST' }));
  }

  public async getSessions(): Promise<ActiveSession[]> {
    const result = await this.request<Array<Record<string, any>>>('/users/sessions');
    return result.map(mapActiveSession);
  }

  public async terminateSession(sessionId: string): Promise<void> {
    await this.request(`/users/sessions/${sessionId}`, { method: 'DELETE' });
  }

  public async terminateOtherSessions(): Promise<void> {
    await this.request('/users/sessions', { method: 'DELETE' });
  }

  public async getWallet(): Promise<{ balance: number; transactions: WalletTransaction[] }> {
    const result = await this.request<Record<string, any>>('/users/wallet');
    const transactionData = result.transactions?.data || [];
    return {
      balance: Number(result.balance ?? 0),
      transactions: transactionData.map(mapWalletTransaction),
    };
  }

  public async createWalletDeposit(amount: number, description?: string): Promise<WalletTransaction> {
    return mapWalletTransaction(await this.request<Record<string, any>>('/users/wallet/deposits', {
      method: 'POST',
      body: JSON.stringify({ amount, description }),
    }));
  }

  // --- Published site content ---
  public async getPublicSettings(): Promise<Record<string, Record<string, unknown>>> {
    return this.request<Record<string, Record<string, unknown>>>('/settings/public', { cache: 'no-store' });
  }

  // --- Protected administration API ---
  public async adminRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const result = await this.request<T>(`/admin${endpoint}`, options);
    if ((options.method || 'GET') !== 'GET') {
      this.invalidateCache();
    }
    return result;
  }

  public async uploadAdminBlogImage(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('image', file);
    const headers: Record<string, string> = { Accept: 'application/json', 'X-Session-ID': this.cartSessionId };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;

    const response = await fetch(`${API_BASE}/admin/blog/images`, { method: 'POST', headers, body: formData });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(localizedApiError(response.status, payload));
    }

    const payload = await response.json();
    const url = payload?.data?.url ?? payload?.url;
    if (typeof url !== 'string' || !url) throw new Error('آدرس تصویر بارگذاری‌شده از سرور دریافت نشد.');
    this.invalidateCache('/admin');
    return url;
  }

  public async uploadAdminSiteMediaImage(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('image', file);
    const headers: Record<string, string> = { Accept: 'application/json', 'X-Session-ID': this.cartSessionId };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;

    const response = await fetch(`${API_BASE}/admin/site-media/images`, { method: 'POST', headers, body: formData });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(localizedApiError(response.status, payload));
    }

    const payload = await response.json();
    const url = payload?.data?.url ?? payload?.url;
    if (typeof url !== 'string' || !url) throw new Error('آدرس تصویر بارگذاری‌شده از سرور دریافت نشد.');
    this.invalidateCache('/admin');
    return url;
  }

  public async uploadAdminProductImage(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('image', file);
    const headers: Record<string, string> = { Accept: 'application/json', 'X-Session-ID': this.cartSessionId };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;

    const response = await fetch(`${API_BASE}/admin/products/images`, { method: 'POST', headers, body: formData });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(localizedApiError(response.status, payload));
    }

    const payload = await response.json();
    const url = payload?.data?.url ?? payload?.url;
    if (typeof url !== 'string' || !url) throw new Error('آدرس تصویر بارگذاری‌شده از سرور دریافت نشد.');
    this.invalidateCache('/products');
    this.invalidateCache('/admin');
    return url;
  }

  // --- Theme Management (Admin Settings) ---
  public async getThemeSettings(): Promise<ThemeSettings> {
    if (isDemoMode) {
      return demoAdapter.getThemeSettings();
    }
    const result = await this.adminRequest<Record<string, any>>('/settings/theme');
    return result.config ?? initialThemeSettings;
  }

  public async saveThemeSettings(settings: ThemeSettings): Promise<ThemeSettings> {
    if (isDemoMode) {
      return demoAdapter.saveThemeSettings(settings);
    }
    await this.adminRequest('/settings/theme', {
      method: 'PUT',
      body: JSON.stringify({ settings: { config: settings } }),
    });
    return settings;
  }
}

export const api = new ApiService();
