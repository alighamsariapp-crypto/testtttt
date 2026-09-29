export interface Category {
  id: number;
  name: string;
  slug: string;
  description?: string;
  parent_id?: number | null;
  parent_slug?: string | null;
  level?: 1 | 2 | 3;
  icon?: string;
  image_url?: string;
  banner_url?: string;
  is_active: boolean;
  sort_order: number;
  featured_tags?: string[];
  children?: Category[];
}

export interface CategoryBreadcrumb {
  name: string;
  slug: string;
  path: string;
}

export interface ProductVariant {
  id: number;
  product_id: number;
  name: string;
  sku: string;
  price_override?: number | null;
  base_price?: number;
  original_price?: number;
  discount_price?: number | null;
  discount_percentage?: number;
  discount_percent?: number;
  effective_price?: number;
  stock_quantity?: number;
  is_active: boolean;
  attributes?: Record<string, string>;
  image_url?: string;
  images?: string[];
}

export interface ProductVariantOption {
  key: string;
  label: string;
}

export interface ProductComment {
  id: number;
  author: string;
  rating: number;
  date: string;
  title?: string;
  content: string;
  is_buyer?: boolean;
  likes?: number;
  dislikes?: number;
  pros?: string[];
  cons?: string[];
}

export interface Product {
  id: number;
  category_id: number;
  category_name?: string;
  category_slug?: string;
  subcategory_slug?: string;
  sub_subcategory_slug?: string;
  category_path?: string[]; // e.g. ['laptops', 'laptops-notebooks', 'lenovo']
  brand?: string;
  brand_slug?: string;
  technology?: string;
  colors?: Array<{ name: string; hex: string; images?: string[]; image?: string }>;
  device_compatibility?: Array<'mobile' | 'desktop' | 'tablet'>;
  
  // Specific Dynamic Attributes for SIM Cards
  sim_operator?: 'irancell' | 'mci' | 'rightel' | 'shatel-mobile' | string;
  sim_type?: 'permanent' | 'credit' | 'data' | string; // دائمی / اعتباری
  sim_status?: 'rond' | 'semi-rond' | 'normal' | 'zero' | string; // رند / صفر
  sim_prefix?: string; // e.g. '0912', '0935', '0990'
  sim_gift_internet?: string; // e.g. 'بسته ۱۰۰ گیگ'

  // Specific Dynamic Attributes for Laptops / Computers
  processor?: string; // e.g. 'Intel Core i7', 'AMD Ryzen 7', 'Apple M3'
  ram_capacity?: string; // e.g. '16GB', '32GB', '8GB'
  storage_capacity?: string; // e.g. '512GB SSD', '1TB SSD NVMe'
  gpu?: string; // e.g. 'RTX 4060', 'RTX 4050', 'Intel Iris Xe'
  screen_size?: string; // e.g. '15.6 اینچ', '14 اینچ', '16 اینچ'
  screen_resolution?: string; // e.g. 'Full HD', '2K QHD', 'Retina'
  os?: string; // e.g. 'Windows 11', 'macOS'

  // Specific Dynamic Attributes for Modems & Routers
  network_generation?: '5G' | '4G LTE' | 'TD-LTE' | 'FTTH' | 'VDSL' | string;
  modem_type?: 'desktop' | 'pocket' | 'dongle' | 'router' | string;
  ethernet_ports?: string; // e.g. '4 پورت گیگابیت', '2 پورت'
  wifi_standard?: string; // e.g. 'Wi-Fi 6 (802.11ax)', 'Wi-Fi 5'

  // Specific Dynamic Attributes for Network Switches & Equipment
  switch_type?: 'managed' | 'unmanaged' | 'poe' | string;
  poe_supported?: boolean;
  port_count?: string; // e.g. '8 پورت', '16 پورت', '24 پورت'

  name: string;
  title_en?: string;
  slug: string;
  sku: string;
  description?: string;
  base_price: number;
  original_price?: number;
  discount_price?: number;
  effective_price?: number;
  discount_percentage?: number;
  discount_percent?: number;
  currency: string;
  image?: string;
  image_url?: string;
  gallery_urls?: string[];
  guarantee?: string;
  is_active: boolean;
  is_featured: boolean;
  is_bestseller?: boolean;
  is_smart?: boolean;
  rating?: number;
  review_count?: number;
  in_stock: boolean;
  stock_quantity?: number;
  // Admin writes inventory through this API-only field; the server creates or updates the master variant inventory.
  initial_stock?: number;
  variants?: ProductVariant[];
  /** محورهای انتخابی variant مانند رنگ، RAM یا حافظه؛ در metadata محصول نگه‌داری می‌شوند. */
  variant_options?: ProductVariantOption[];
  specs?: Record<string, string | string[]>;
  comments?: ProductComment[];
}

export interface CatalogFacetOption {
  value: string;
  label: string;
  count: number;
}

export interface CatalogFacet {
  key: string;
  label: string;
  type: 'single_select' | 'multi_select' | 'number' | 'boolean' | 'color' | string;
  unit?: string | null;
  sort_order: number;
  options: CatalogFacetOption[];
}

export interface CatalogFacetResponse {
  category_id?: number | null;
  price: { min: number; max: number };
  availability_count: number;
  facets: CatalogFacet[];
}

export interface ServiceItem {
  id: number;
  name: string;
  slug: string;
  category: string;
  service_category_id?: number;
  service_category?: ServiceCategoryItem;
  short_description: string;
  description: string;
  estimated_base_price: number;
  currency: string;
  icon?: string;
  image_url?: string;
  is_active: boolean;
  documents?: string[];
  steps?: string[];
  faq?: Array<{ question: string; answer: string }>;
  contact_type?: 'telegram' | 'whatsapp' | 'phone' | 'external';
  contact_url?: string;
  cta_label?: string;
  required_fields?: Array<{
    name: string;
    label: string;
    type: string;
    required: boolean;
  }>;
}

export interface ServiceCategoryItem {
  id: number;
  name: string;
  slug: string;
  description?: string;
  is_active: boolean;
  sort_order: number;
  services_count?: number;
}

export interface CartItem {
  id: string; // unique item key
  product_id: number;
  product_variant_id: number;
  product_name: string;
  variant_name: string;
  sku: string;
  unit_price: number;
  currency: string;
  quantity: number;
  subtotal: number;
  available_stock?: number;
  image_url?: string;
}

export interface CouponData {
  code: string;
  discount_amount: number;
  description: string;
}

export interface CartSummary {
  items: CartItem[];
  item_count: number;
  subtotal: number;
  discount_total: number;
  coupon_discount: number;
  tax_total: number;
  shipping_total: number;
  grand_total: number;
  currency: string;
  applied_coupon?: CouponData | null;
}

export interface UserAddress {
  id: number;
  title: string; // e.g. "خانه", "محل کار"
  recipient_name: string;
  phone: string;
  province: string;
  city: string;
  postal_code: string;
  address_line: string;
  is_default?: boolean;
}

export interface UserFavorite {
  id: number;
  user_id: number;
  product_id: number;
  created_at?: string;
  updated_at?: string;
  product?: Product;
}

export interface UserProfile {
  id: number;
  name: string;
  email: string;
  phone?: string;
  national_id?: string;
  birth_date?: string;
  role: 'customer' | 'staff' | 'admin';
  status: 'active' | 'suspended';
  loyalty_points?: number;
  wallet_balance?: number;
  orders_count?: number;
  open_tickets_count?: number;
  last_order_at?: string | null;
  join_date?: string;
  security_level?: 'ضعیف' | 'متوسط' | 'عالی';
  is_2fa_enabled?: boolean;
  email_verified?: boolean;
  phone_verified?: boolean;
  has_password?: boolean;
  addresses?: UserAddress[];
}

export type OrderStatus = 'pending' | 'processing' | 'preparing' | 'shipping' | 'delivered' | 'cancelled' | 'returned';

export interface OrderItem {
  id?: number;
  product_id: number;
  product_name: string;
  name?: string;
  variant_name?: string;
  variant_id?: number;
  quantity: number;
  unit_price: number;
  total_price?: number;
  image_url?: string;
}

export interface UserOrder {
  id: string;
  order_number: string; // e.g. 'ORD-7829-X' or 'NN-8492'
  date: string;
  created_at?: string;
  status: OrderStatus;
  status_label: string;
  total_amount: number;
  discount_amount?: number;
  shipping_cost?: number;
  final_payable?: number;
  currency: string;
  items: OrderItem[];
  item_count: number;
  shipping_address?: any;
  recipient_name?: string;
  recipient_phone?: string;
  tracking_code?: string;
  current_step?: 1 | 2 | 3 | 4; // 1: ثبت سفارش, 2: آماده‌سازی, 3: ارسال, 4: تحویل
  estimated_delivery?: string;
  payment_method?: string;
  payment_status?: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  user_id?: number;
  user?: {
    id: number;
    name: string;
    email: string;
    phone?: string;
  };
}

export interface DiscountCoupon {
  id: string;
  code: string;
  title: string;
  type?: 'percentage' | 'fixed';
  discount_type?: 'percentage' | 'fixed';
  value?: number;
  discount_value?: number;
  min_order_amount: number;
  max_discount_amount?: number;
  usage_limit: number;
  usage_count?: number;
  used_count?: number;
  start_date?: string;
  expiry_date: string;
  is_active: boolean;
}

export interface StoreSettings {
  store_name: string;
  store_slogan: string;
  contact_phone: string;
  contact_email: string;
  address: string;
  working_hours: string;
  gateways: {
    zarinpal: { enabled: boolean; merchant_id: string };
    mellat: { enabled: boolean; terminal_id: string; username: string };
    saman: { enabled: boolean; merchant_id: string };
    cod: { enabled: boolean };
  };
  sms_provider: 'kavenegar' | 'farazsms' | 'ghasedak';
  sms_sender_number: string;
  sms_api_key: string;
  shipping_cost_default: number;
  free_shipping_threshold: number;
  banners: Array<{
    id: number;
    title: string;
    image: string;
    link: string;
  }>;
}

export type TicketStatus = 'open' | 'investigating' | 'answered' | 'closed';

export interface TicketMessage {
  id: number;
  sender: 'user' | 'support';
  author: string;
  time: string;
  date: string;
  message: string;
  attachments?: string[];
  created_at?: string;
  read_at?: string | null;
}

export interface SupportTicket {
  /** شناسهٔ داخلی تیکت برای فراخوانی API. */
  id: string;
  /** شمارهٔ قابل‌نمایش تیکت برای مشتری و پشتیبانی. */
  ticket_number: string;
  title: string;
  department: 'فروش و تمدید' | 'پشتیبانی فنی' | 'مالی و فاکتور' | 'عمومی و پیشنهادات';
  status: TicketStatus;
  status_label: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  last_update: string;
  created_at: string;
  closed_at?: string | null;
  archived_at?: string | null;
  messages: TicketMessage[];
}

export interface ActiveSession {
  id: string;
  device: string;
  browser: string;
  os: string;
  location: string;
  ip: string;
  last_active: string;
  created_at?: string;
  expires_at?: string;
  is_current: boolean;
}

export interface WalletTransaction {
  id: string;
  type: 'deposit' | 'purchase' | 'refund' | 'cashback';
  amount: number;
  date: string;
  description: string;
  tracking_code: string;
  status: 'successful' | 'pending' | 'failed';
}

export type ProfileSubView =
  | 'dashboard'
  | 'analytics'
  | 'orders' 
  | 'favorites' 
  | 'addresses' 
  | 'support' 
  | 'wallet' 
  | 'security' 
  | 'settings';

export interface ThemeSettings {
  font_family: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  bg_color: string;
  text_color: string;
  border_radius: string;
  brand_name: string;
}

export type AdminSubTab = 
  | 'dashboard'
  | 'overview' 
  | 'products'
  | 'categories'
  | 'orders'
  | 'users'
  | 'tickets'
  | 'discounts'
  | 'content'
  | 'appearance' 
  | 'gateways' 
  | 'sms'
  | 'settings';

export interface BlogPost {
  id: number;
  title: string;
  slug: string;
  summary: string;
  content: string;
  image: string;
  author: string;
  category: string;
  date: string;
  readTime: string;
  views: number;
  isPublished: boolean;
  tags?: string[];
}

export interface AboutPageContent {
  badge: string;
  title: string;
  heroDescription: string;
  missionTitle: string;
  missionText: string;
  qualityTitle: string;
  qualityText: string;
  supportTitle: string;
  supportText: string;
  statsExperience: string;
  statsCustomers: string;
  statsBranches: string;
  bannerImage?: string;
}

export type SocialLinkIcon = 'instagram' | 'telegram' | 'whatsapp' | 'bale' | 'eitaa' | 'linkedin' | 'website';

export interface SocialLink {
  id: string;
  label: string;
  url: string;
  icon: SocialLinkIcon;
  imageUrl?: string;
  isVisible: boolean;
}

export interface FooterTrustBadge {
  id: string;
  label: string;
  caption: string;
  imageUrl?: string;
  url?: string;
  isVisible: boolean;
}

export interface ContactPageContent {
  title: string;
  subtitle: string;
  supportPhone: string;
  supportPhoneDesc: string;
  supportEmail: string;
  salesEmail: string;
  centralOfficeAddress: string;
  workingHours: string;
  instagramUrl: string;
  telegramUrl: string;
  whatsappUrl: string;
  mapEmbedUrl?: string;
  socialLinks?: SocialLink[];
}

export interface FooterContent {
  brandDescription: string;
  enamadStar: string;
  samandehiStatus: string;
  copyrightText: string;
  showEnamad: boolean;
  showSamandehi: boolean;
  trustBadges?: FooterTrustBadge[];
}

export interface StaticPagesContent {
  about: AboutPageContent;
  contact: ContactPageContent;
  footer: FooterContent;
}

export type HomepageDestination = 'store' | 'services' | 'about' | 'contact';

export interface HeroSlideItem {
  id: number;
  title: string;
  subtitle: string;
  image: string;
  actionText: string;
  category: string;
  badge: string;
  isVisible?: boolean;
  destination?: HomepageDestination;
  customUrl?: string;
  overlayColor?: string;
  overlayOpacity?: number;
}

export interface HomepageSideBanner {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  tag: string;
  actionText: string;
  category: string;
  destination?: HomepageDestination;
  customUrl?: string;
  overlayColor?: string;
  overlayOpacity?: number;
  isVisible: boolean;
}

export type QuickAccessIcon = 'wifi' | 'simcard' | 'laptop' | 'network' | 'services' | 'globe' | 'shopping-bag' | 'tag';

export interface HomepageQuickAccessItem {
  id: string;
  title: string;
  icon: QuickAccessIcon;
  imageUrl?: string;
  category: string;
  destination?: HomepageDestination;
  customUrl?: string;
  isVisible: boolean;
}

export interface HomepageServicesBanner {
  title: string;
  description: string;
  image: string;
  primaryActionText: string;
  primaryDestination: HomepageDestination;
  primaryCustomUrl?: string;
  secondaryActionText: string;
  secondaryDestination: HomepageDestination;
  secondaryCustomUrl?: string;
  isVisible: boolean;
}

export interface HomepagePartner {
  id: string;
  name: string;
  logoText: string;
  logoImage?: string;
  subtitle: string;
  category: string;
  customUrl?: string;
  isVisible: boolean;
}

export interface AppearanceSettings {
  topBannerEnabled: boolean;
  topBannerText: string;
  topBannerBgColor: string;
  topBannerTextColor: string;
  topBannerLinkText: string;
  topBannerLinkUrl: string;
  brandPrimaryColor?: string;
  brandSecondaryColor?: string;
  brandAccentColor?: string;
  heroSlides: HeroSlideItem[];
  sidePromo1Title: string;
  sidePromo1Subtitle: string;
  sidePromo1Image: string;
  sidePromo1Tag: string;
  sidePromo2Title: string;
  sidePromo2Subtitle: string;
  sidePromo2Image: string;
  sidePromo2Tag: string;
  sidePromos?: HomepageSideBanner[];
  quickAccessItems?: HomepageQuickAccessItem[];
  servicesBanner?: HomepageServicesBanner;
  partners?: HomepagePartner[];
}

export type CheckoutPaymentMethod = 'online' | 'wallet' | 'bank_transfer' | 'zibal' | 'test';

export interface AvailablePaymentGateway {
  id: string;
  name: string;
  title: string;
  display_label: string;
  description: string;
  environment: 'production' | 'sandbox' | 'internal' | 'offline' | 'staging' | string;
  environment_label: string;
  is_test: boolean;
  enabled: boolean;
  capabilities: string[];
  currencies?: string[];
  disabled_reason?: string | null;
}

export interface ShippingMethodConfig {
  id: string;
  title: string;
  description: string;
  enabled: boolean;
  base_cost: number;
  free_shipping_threshold: number;
}

export interface CheckoutConfiguration {
  payment: {
    online_enabled: boolean;
    online_provider: 'zibal';
    zibal_sandbox: boolean;
    zibal_merchant: string;
    wallet_enabled: boolean;
    bank_transfer_enabled: boolean;
    default_method: CheckoutPaymentMethod;
    bank_account_name: string;
    bank_card_number: string;
    gateways?: AvailablePaymentGateway[];
  };
  gateways?: AvailablePaymentGateway[];
  shipping: {
    default_method_id: string;
    methods: ShippingMethodConfig[];
  };
}

export type GatewayProvider = 'zarinpal' | 'mellat' | 'saman' | 'idpay' | 'zibal';

export interface PaymentGatewayConfig {
  id: GatewayProvider;
  name: string;
  title: string;
  description: string;
  logo: string;
  isEnabled: boolean;
  isDefault: boolean;
  isSandbox: boolean;
  merchantId: string;
  terminalId?: string;
  username?: string;
  password?: string;
  feePercentage: number;
  dailyLimit: number;
}

export type SmsProvider = 'kavenegar' | 'farapayamak' | 'melipayamak' | 'yektasms' | 'payamresan';

export interface SmsTemplateConfig {
  id: string;
  name: string;
  patternCode: string;
  templateText: string;
  isActive: boolean;
}

export interface SmsPanelConfig {
  provider: SmsProvider;
  apiKey: string;
  senderLine: string;
  isEnabled: boolean;
  creditBalance: number;
  templates: {
    otp: SmsTemplateConfig;
    orderCreated: SmsTemplateConfig;
    orderShipped: SmsTemplateConfig;
    ticketReply: SmsTemplateConfig;
  };
}

export type SmsSystemEvent = 'otp' | 'password_reset' | 'order_paid' | 'order_shipped' | 'ticket_reply';

export interface SmsSystemTemplate {
  enabled: boolean;
  label: string;
  text: string;
}

export interface SmsSystemConfiguration {
  provider: 'kavenegar';
  enabled: boolean;
  /** Always blank when read from the server; write only to replace the saved key. */
  api_key: string;
  api_key_configured: boolean;
  clear_api_key?: boolean;
  sender: string;
  otp_template: string;
  templates: Record<SmsSystemEvent, SmsSystemTemplate>;
}

export interface SmsConnectionInfo {
  remaining_credit: number;
  expires_at: number | string | null;
  account_type: string | null;
}

export type PaymentStatusType = 
  | 'redirecting' 
  | 'success' 
  | 'failed' 
  | 'cancelled' 
  | 'pending' 
  | 'unknown'
  | 'unavailable';

export interface PaymentStatusData {
  status: PaymentStatusType;
  orderNumber: string;
  trackingCode?: string;
  amount: number;
  currency?: string;
  paymentMethod?: string;
  instructions?: string;
  date?: string;
  errorMessage?: string;
  errorCode?: string;
  gatewayTime?: string;
  statusToken?: string;
  exchangeCode?: string;
  isVerified?: boolean;
  isLoading?: boolean;
  orderStatus?: string;
}

export type ActiveView = 
  | 'home'
  | 'store'
  | 'product-detail'
  | 'services'
  | 'service-detail'
  | 'cart'
  | 'checkout'
  | 'payment-status'
  | 'auth'
  | 'profile'
  | 'orders'
  | 'magazine'
  | 'article'
  | 'about'
  | 'contact'
  | 'typography-test'
  | 'admin'
  | 'not-found';
