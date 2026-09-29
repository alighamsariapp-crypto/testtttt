// Design: Portal-inspired Novinet admin workspace; this adapter maps real read-only state into the approved staging presentation without inventing operational values.
import type { Category, Product, SupportTicket, UserAddress, UserOrder, UserProfile } from '../../../types';
import logoFallback from './assets/novinet-admin-logo.png';

export type AdminReplicaOrderStatus = 'نیازمند تایید' | 'آماده‌سازی' | 'ارسال شده' | 'تحویل شده' | 'لغو شده';
export type AdminReplicaProductColor = { name: string; hex: string; images?: string[]; image?: string };
export type AdminReplicaProductOption = { id: string; name: string; values: string[] };
export type AdminReplicaProductAttribute = { id: string; label: string; value: string };
export type AdminReplicaProductVariant = { id: string; color: string; optionValues?: Record<string, string>; price: number; original_price?: number; discount_percent?: number; stock: number; image?: string; is_active?: boolean; sku?: string };
export type AdminProductAttributeDefinition = {
  id: number;
  key: string;
  name: string;
  dataType: 'single_select' | 'multi_select' | 'number' | 'boolean' | 'color' | string;
  unit?: string;
  options: string[];
  categoryIds: number[];
  isRequired: boolean;
  isFilterable: boolean;
  isActive?: boolean;
  sortOrder?: number;
  categoryConfigs?: Record<number, {
    isFilterable: boolean;
    isRequired: boolean;
    inheritToChildren: boolean;
    sortOrder: number;
  }>;
};

export type AdminCategoryAttributeDraft = {
  id?: number;
  key: string;
  name: string;
  dataType: 'single_select' | 'multi_select' | 'number' | 'boolean' | 'color';
  unit?: string;
  options: string[];
  isFilterable: boolean;
  isRequired: boolean;
  inheritToChildren: boolean;
  sortOrder: number;
};

export type AdminReplicaOrder = {
  id: number;
  number: string;
  customer: string;
  amount: number;
  status: AdminReplicaOrderStatus;
  date: string;
  address: string;
  tracking: string;
  items: number;
  payment: string;
  fulfillment: string;
  recipientPhone?: string;
  lineItems?: Array<{ name: string; quantity: number; amount: number; image?: string }>;
};

export type AdminReplicaProduct = {
  id: number;
  name: string;
  sku: string;
  price: number;
  basePrice?: number;
  regularPrice?: number;
  originalPrice?: number;
  original_price?: number;
  discountPercent?: number;
  discount_percent?: number;
  discount_percentage?: number;
  stock: number;
  category: string;
  categoryId?: number;
  brand?: string;
  active: boolean;
  featured: boolean;
  image: string;
  gallery: string[];
  description: string;
  shortDescription?: string;
  warranty?: string;
  sold: number;
  updated: string;
  colors?: AdminReplicaProductColor[];
  options?: AdminReplicaProductOption[];
  attributes?: AdminReplicaProductAttribute[];
  facetValues?: Record<string, string>;
  variants?: AdminReplicaProductVariant[];
};

export type AdminReplicaCategory = { id: number; name: string; slug: string; products: number; active: boolean; parentId?: number | null };
export type AdminReplicaTicketStatus = 'باز' | 'در حال بررسی' | 'پاسخ داده شده' | 'بسته شده';
export type AdminReplicaTicket = {
  id: string;
  ticketNumber: string;
  title: string;
  department: string;
  updated: string;
  status: AdminReplicaTicketStatus;
  priority: 'فوری' | 'عادی' | 'کم';
  archived: boolean;
  unreadCount: number;
  messages: Array<{ id: number; sender: 'customer' | 'admin'; body: string; createdAt?: string; time: string; readAt?: string | null }>;
};
export type AdminReplicaUser = {
  id: number;
  name: string;
  email: string;
  phone?: string;
  role: 'مدیر ارشد' | 'کارشناس' | 'مشتری';
  wallet: number;
  active: boolean;
  joinDate?: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  hasPassword: boolean;
  addresses: UserAddress[];
  ordersCount: number;
  openTicketsCount: number;
  lastOrderAt?: string | null;
};
export type AdminReplicaDashboard = {
  totalUsers: number;
  totalProducts: number;
  totalOrders: number;
  pendingOrders: number;
  totalRevenue: number;
  pendingPayments: number;
  pendingServiceRequests: number;
};

export type AdminReplicaLiveData = {
  source: 'live';
  userName: string;
  userRole: string;
  orders: AdminReplicaOrder[];
  products: AdminReplicaProduct[];
  categories: AdminReplicaCategory[];
  tickets: AdminReplicaTicket[];
  users: AdminReplicaUser[];
  dashboard: AdminReplicaDashboard | null;
  dashboardLoading: boolean;
  dashboardError: boolean;
  productAttributeDefinitions?: AdminProductAttributeDefinition[];
  operations?: AdminReplicaOperations;
};

export type AdminReplicaOperations = {
  saveProduct: (product: AdminReplicaProduct, mode: 'create' | 'update') => Promise<void>;
  deleteProduct: (id: number) => void;
  toggleProductActive: (id: number) => void;
  toggleProductFeatured: (id: number) => void;
  saveCategory: (category: AdminReplicaCategory, mode: 'create' | 'update') => void;
  deleteCategory: (id: number) => void;
  toggleCategoryActive: (id: number, active: boolean) => void;
  saveCategoryProductAttributes: (categoryId: number, drafts: AdminCategoryAttributeDraft[]) => Promise<void>;
  saveOrder: (order: AdminReplicaOrder) => void;
  replyTicket: (ticketId: string, message: string) => Promise<void>;
  updateTicketStatus: (ticketId: string, status: SupportTicket['status']) => Promise<void>;
  markTicketRead: (ticketId: string) => Promise<void>;
  archiveTicket: (ticketId: string) => Promise<void>;
  restoreTicket: (ticketId: string) => Promise<void>;
  deleteTicket: (ticketId: string) => Promise<void>;
  saveUser: (user: AdminReplicaUser) => Promise<void>;
};

export type AdminDashboardResponse = {
  metrics?: {
    total_users?: number;
    total_products?: number;
    total_orders?: number;
    pending_orders?: number;
    total_revenue_irr?: number;
    pending_service_requests?: number;
    pending_payments?: number;
  };
};

const asNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

// Backend amounts are stored in IRR; the approved admin presentation labels monetary values as تومان.
const toToman = (value: unknown, currency = 'IRR') => {
  const amount = asNumber(value);
  return currency.toUpperCase() === 'IRR' ? Math.round(amount / 10) : amount;
};

const toIrr = (toman: unknown) => Math.round(asNumber(toman) * 10);
const serverImage = (value: string | undefined) => value && !value.startsWith('blob:') ? value : undefined;
const stableVariantSku = (baseSku: string, variantId: string, color: string, optionValues: Record<string, string> = {}) => {
  const numericId = Number(variantId);
  if (Number.isFinite(numericId)) return `${baseSku}-V${Math.trunc(numericId)}`;
  const signature = [color.trim(), ...Object.entries(optionValues).sort(([left], [right]) => left.localeCompare(right)).map(([key, value]) => `${key}:${value.trim()}`)].join('|');
  const hash = Array.from(signature).reduce((total, character) => ((total * 31) + character.codePointAt(0)!) >>> 0, 7);
  return `${baseSku}-V${hash.toString(36).toUpperCase()}`;
};

const orderStatuses: Record<UserOrder['status'], AdminReplicaOrderStatus> = {
  pending: 'نیازمند تایید',
  processing: 'آماده‌سازی',
  preparing: 'آماده‌سازی',
  shipping: 'ارسال شده',
  delivered: 'تحویل شده',
  cancelled: 'لغو شده',
  returned: 'لغو شده',
};

const orderStatus = (status: UserOrder['status']): AdminReplicaOrderStatus => orderStatuses[status];

const paymentStatus = (status: UserOrder['status']) => {
  if (status === 'pending') return 'در انتظار پرداخت';
  if (status === 'cancelled' || status === 'returned') return 'بازپرداخت';
  return 'پرداخت موفق';
};

const paymentMethod = (order: UserOrder) => order.payment_method?.trim() || 'روش پرداخت ثبت نشده';
const fulfillmentMethod = (order: UserOrder) => order.status === 'shipping' || order.status === 'delivered' ? 'ارسال ثبت شده' : 'روش ارسال ثبت نشده';

const userRoleLabels: Record<UserProfile['role'], AdminReplicaUser['role']> = {
  admin: 'مدیر ارشد',
  staff: 'کارشناس',
  customer: 'مشتری',
};

export const mapLiveUser = (user: UserProfile): AdminReplicaUser => ({
  id: user.id,
  name: user.name || 'کاربر نوین‌نت',
  email: user.email || 'ایمیل ثبت نشده',
  phone: user.phone,
  role: userRoleLabels[user.role],
  wallet: toToman(user.wallet_balance, 'IRR'),
  active: user.status === 'active',
  joinDate: user.join_date,
  emailVerified: Boolean(user.email_verified),
  phoneVerified: Boolean(user.phone_verified),
  hasPassword: Boolean(user.has_password),
  addresses: user.addresses ?? [],
  ordersCount: Math.max(0, asNumber(user.orders_count)),
  openTicketsCount: Math.max(0, asNumber(user.open_tickets_count)),
  lastOrderAt: user.last_order_at,
});

export const mapLiveOrder = (order: UserOrder): AdminReplicaOrder => ({
  id: asNumber(order.id),
  number: order.order_number || `#${order.id}`,
  customer: order.recipient_name?.trim() || 'مشتری ثبت‌نشده',
  amount: toToman(order.total_amount, order.currency),
  status: orderStatus(order.status),
  date: order.date || 'تاریخ ثبت نشده',
  address: (typeof order.shipping_address === 'string'
    ? order.shipping_address.trim()
    : order.shipping_address?.address_line ||
      order.shipping_address?.address ||
      [order.shipping_address?.province, order.shipping_address?.city].filter(Boolean).join(' - ')) || 'نشانی ثبت نشده',
  tracking: order.tracking_code || '',
  items: Math.max(0, asNumber(order.item_count || order.items.length)),
  payment: paymentStatus(order.status),
  fulfillment: fulfillmentMethod(order),
  recipientPhone: order.recipient_phone,
  lineItems: order.items.map((item) => ({
    name: item.product_name,
    quantity: Math.max(0, asNumber(item.quantity)),
    amount: toToman(item.unit_price, order.currency),
    image: item.image_url,
  })),
});

export const calculateFinalPrice = (price: number, discountPercent: number): number => {
  const safeDiscount = Math.max(0, Math.min(100, Number(discountPercent || 0)));
  if (safeDiscount === 0 || price <= 0) return price;
  return Math.round(price * (1 - safeDiscount / 100));
};

export const mapLiveProduct = (product: Product, categories: Category[] = [], definitions: AdminProductAttributeDefinition[] = []): AdminReplicaProduct => {
  const prodAny = product as any;
  const variantOptions: Array<{ key: string; label: string }> = product.variant_options
    ?? (Array.isArray(prodAny?.attributes?.novinet_variant_axes) ? prodAny.attributes.novinet_variant_axes : [])
    ?? [];
  const configurableVariants = (product.variants ?? []).filter((variant) => {
    const attributes = variant.attributes ?? {};
    return Boolean(attributes.color || attributes.رنگ || variantOptions.some((option) => attributes[option.key] || attributes[option.label]));
  });
  const colors: AdminReplicaProductColor[] = (product.colors ?? []).map((c) => ({
    name: c.name,
    hex: c.hex,
    images: c.images ? [...c.images] : (c.image ? [c.image] : []),
    image: c.image || c.images?.[0] || '',
  }));
  configurableVariants.forEach((variant) => {
    const name = variant.attributes?.color || variant.attributes?.رنگ;
    const vImg = variant.image_url || variant.attributes?.image_url;
    if (name && !colors.some((color) => color.name === name)) {
      colors.push({
        name,
        hex: '#64748b',
        images: vImg ? [vImg] : [],
        image: vImg || '',
      });
    }
  });
  // If a color has no images yet, populate with matching variant image if available
  colors.forEach((col) => {
    if (!col.images || col.images.length === 0) {
      const matchingVariantImgs = configurableVariants
        .filter((v) => (v.attributes?.color || v.attributes?.رنگ) === col.name)
        .map((v) => v.image_url || v.attributes?.image_url)
        .filter((img): img is string => Boolean(img));
      if (matchingVariantImgs.length > 0) {
        col.images = Array.from(new Set(matchingVariantImgs));
        col.image = col.image || col.images[0];
      }
    }
  });
  const variants = configurableVariants.map((variant, vIdx) => {
    const variantAny = variant as any;
    const vOrigIrr = variantAny.original_price ?? variantAny.base_price ?? variant.price_override ?? product.base_price;
    const origP = toToman(vOrigIrr, product.currency);
    const rawDisc = variantAny.discount_percent ?? variantAny.discount_percentage;
    const discPct = rawDisc !== undefined && rawDisc !== null
      ? Math.max(0, Math.min(100, Number(rawDisc)))
      : (variant.discount_price && vOrigIrr > variant.discount_price
        ? Math.round(((vOrigIrr - variant.discount_price) / vOrigIrr) * 100)
        : (origP > toToman(variant.effective_price ?? variant.price_override ?? product.effective_price ?? product.base_price, product.currency)
          ? Math.round(((origP - toToman(variant.effective_price ?? variant.price_override ?? product.effective_price ?? product.base_price, product.currency)) / origP) * 100)
          : 0));
    const finalP = discPct > 0 ? calculateFinalPrice(origP, discPct) : (toToman(variant.effective_price ?? variant.price_override ?? product.effective_price ?? product.base_price, product.currency) || origP);
    const rawId = variant.id !== undefined && variant.id !== null ? String(variant.id).trim() : '';
    const validId = rawId && rawId !== 'undefined' && rawId !== 'null' && rawId !== 'NaN'
      ? rawId
      : `v_${product.id || 'p'}_${vIdx}_${(variant.attributes?.color || variant.attributes?.رنگ || 'c').replace(/\s+/g, '_')}`;

    const optionVals: Record<string, string> = {};
    variantOptions.forEach((option) => {
      const val = variant.attributes?.[option.key] ?? variant.attributes?.[option.label] ?? '';
      if (val) {
        optionVals[option.key] = val;
        optionVals[option.label] = val;
      }
    });

    const stockQty = Math.max(0, asNumber(variant.stock_quantity ?? variantAny.stock ?? variantAny.inventory?.quantity ?? 0));

    return {
      id: validId,
      color: variant.attributes?.color || variant.attributes?.رنگ || '',
      optionValues: optionVals,
      price: finalP,
      original_price: origP,
      discount_percent: discPct,
      stock: stockQty,
      image: variant.image_url || variant.attributes?.image_url,
      sku: variant.sku || '',
      is_active: variant.is_active !== false,
    };
  });
  const gallery = Array.from(new Set([product.image_url, product.image, ...(product.gallery_urls || [])].filter((image): image is string => Boolean(image))));
  const specs = product.specs || {};
  const definitionKeys = new Set(definitions.map((definition) => definition.key));
  const variantOptionKeys = new Set(variantOptions.map((option) => option.key));

  const rawOriginalIrr = prodAny.original_price ?? product.base_price;
  const originalPriceToman = toToman(rawOriginalIrr, product.currency);
  const rawProdDisc = prodAny.discount_percent ?? product.discount_percentage;
  const productDiscountPct = rawProdDisc !== undefined && rawProdDisc !== null
    ? Math.max(0, Math.min(100, Number(rawProdDisc)))
    : (product.discount_price && product.base_price > product.discount_price
      ? Math.round(((product.base_price - product.discount_price) / product.base_price) * 100)
      : (product.effective_price && rawOriginalIrr > product.effective_price
        ? Math.round(((rawOriginalIrr - product.effective_price) / rawOriginalIrr) * 100)
        : 0));
  const finalPriceToman = productDiscountPct > 0
    ? calculateFinalPrice(originalPriceToman, productDiscountPct)
    : (product.discount_price ? toToman(product.discount_price, product.currency) : (product.effective_price ? toToman(product.effective_price, product.currency) : originalPriceToman));

  return {
    id: product.id,
    name: product.name,
    sku: product.sku || `SKU-${product.id}`,
    price: finalPriceToman,
    basePrice: originalPriceToman,
    regularPrice: originalPriceToman,
    discountPercent: productDiscountPct,
    stock: Math.max(0, asNumber(product.stock_quantity)),
    category: product.category_name || product.category_slug || categories.find((category) => category.id === product.category_id)?.name || '',
    categoryId: product.category_id || undefined,
    brand: product.brand,
    active: product.is_active,
    featured: product.is_featured,
    image: gallery[0] || logoFallback,
    gallery,
    description: product.description || '',
    // The public catalog API does not expose sales analytics per product. Do not
    // fabricate a negative value in an operational admin form; the UI renders
    // this as an unavailable metric and keeps the editable fallback at zero.
    sold: 0,
    updated: 'دادهٔ فعلی',
    colors,
    options: variantOptions.map((option) => ({ id: option.key, name: option.label, values: Array.from(new Set(variants.map((variant) => variant.optionValues?.[option.key]).filter((value): value is string => Boolean(value)))) })),
    attributes: Object.entries(specs).filter(([key]) => !definitionKeys.has(key) && key !== 'brand').map(([label, value], index) => ({ id: `${product.id}-${index}`, label, value: Array.isArray(value) ? value.join('، ') : String(value) })),
    facetValues: Object.fromEntries(Object.entries(specs).filter(([key]) => definitionKeys.has(key) && !variantOptionKeys.has(key)).map(([key, value]) => [key, Array.isArray(value) ? value[0] ?? '' : String(value)])),
    variants,
  };
};

export const mapLiveCategories = (categories: Category[], products: Product[]): AdminReplicaCategory[] => {
  const productCounts = products.reduce<Map<number, number>>((counts, product) => counts.set(product.category_id, (counts.get(product.category_id) || 0) + 1), new Map());
  const flattenTree = (nodes: Category[]): Category[] => nodes.flatMap((category) => [category, ...flattenTree(category.children || [])]);
  return flattenTree(categories).map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    products: productCounts.get(category.id) || 0,
    active: category.is_active,
    parentId: category.parent_id ?? null,
  }));
};

export const mapDashboard = (response: AdminDashboardResponse | null): AdminReplicaDashboard | null => {
  const metrics = response?.metrics;
  if (!metrics) return null;
  return {
    totalUsers: asNumber(metrics.total_users),
    totalProducts: asNumber(metrics.total_products),
    totalOrders: asNumber(metrics.total_orders),
    pendingOrders: asNumber(metrics.pending_orders),
    totalRevenue: toToman(metrics.total_revenue_irr),
    pendingPayments: asNumber(metrics.pending_payments),
    pendingServiceRequests: asNumber(metrics.pending_service_requests),
  };
};

export const toProductWritePayload = (product: AdminReplicaProduct, categories: Category[]): Omit<Product, 'id'> => {
  const flattenCategories = (nodes: Category[]): Category[] => nodes.flatMap((node) => [node, ...flattenCategories(node.children || [])]);
  const allCategories = flattenCategories(categories);
  const category = allCategories.find((item) => item.id === product.categoryId)
    ?? allCategories.find((item) => item.name === product.category);
  const colors = (product.colors || [])
    .filter((color) => color.name.trim() && color.hex.trim())
    .map((color) => {
      const rawImages = (color.images || (color.image ? [color.image] : []))
        .map(serverImage)
        .filter((img): img is string => Boolean(img?.trim()));
      const validImages = Array.from(new Set(rawImages));
      const mainImg = serverImage(color.image) || validImages[0] || '';
      return {
        name: color.name.trim(),
        hex: color.hex.trim(),
        images: validImages,
        image: mainImg,
      };
    });
  const colorKeys = new Set(colors.map((color) => color.name.trim().toLocaleLowerCase('fa-IR')));
  const specs: Record<string, string | string[]> = Object.fromEntries((product.attributes || []).map(({ label, value }) => [label.trim(), value.trim()]).filter(([label, value]) => label && value));
  Object.entries(product.facetValues || {}).forEach(([key, value]) => {
    if (key.trim() && value.trim()) specs[key] = value.trim();
  });
  if (product.brand?.trim()) specs.brand = product.brand.trim();
  const options = (product.options ?? []).map((option) => ({ ...option, id: option.id.trim(), name: option.name.trim(), values: option.values.map((value) => value.trim()).filter(Boolean) })).filter((option) => option.id && option.name && option.values.length);
  options.forEach((option) => {
    const values = Array.from(new Set((product.variants ?? []).map((variant) => variant.optionValues?.[option.id]).filter((value): value is string => Boolean(value))));
    if (values.length > 0) specs[option.id] = values;
  });
  const attributes = { ...specs, ...(colors.length ? { novinet_admin_colors: colors } : {}), ...(options.length ? { novinet_variant_axes: options.map((option) => ({ key: option.id, label: option.name })) } : {}) };
  const images = Array.from(new Set(product.gallery.map(serverImage).filter((image): image is string => Boolean(image))));

  const rawOriginalToman = product.basePrice ?? product.regularPrice ?? product.price ?? 0;
  const originalPriceToman = Number(rawOriginalToman);
  const discountPercent = Math.max(0, Math.min(100, Number(product.discountPercent ?? 0)));
  const finalPriceToman = discountPercent > 0 ? calculateFinalPrice(originalPriceToman, discountPercent) : originalPriceToman;

  const originalPriceIrr = toIrr(originalPriceToman);
  const finalPriceIrr = toIrr(finalPriceToman);

  const variants = (product.variants || [])
    .filter((variant) => colorKeys.has(variant.color.trim().toLocaleLowerCase('fa-IR')) || Object.values(variant.optionValues ?? {}).some((value) => value.trim()))
    .map((variant, vIdx) => {
      const parsedNumId = Number(variant.id);
      const stableId = Number.isFinite(parsedNumId) && parsedNumId > 0 ? parsedNumId : undefined;
      const stockVal = Math.max(0, asNumber(variant.stock));
      const vOrigToman = Number(variant.original_price ?? variant.price ?? originalPriceToman);
      const vDisc = Math.max(0, Math.min(100, Number(variant.discount_percent ?? 0)));
      const vFinalToman = vDisc > 0 ? calculateFinalPrice(vOrigToman, vDisc) : vOrigToman;
      const vOrigIrr = toIrr(vOrigToman);
      const vFinalIrr = toIrr(vFinalToman);

      const vColorObj = colors.find((c) => c.name.toLocaleLowerCase('fa-IR') === variant.color.trim().toLocaleLowerCase('fa-IR'));
      const explicitImg = serverImage(variant.image);
      const vMainImg = explicitImg || vColorObj?.image || vColorObj?.images?.[0] || '';
      const vImages = vColorObj?.images?.length ? vColorObj.images : (vMainImg ? [vMainImg] : []);

      return {
        id: stableId,
        temporary_id: variant.id,
        name: [variant.color.trim(), ...options.map((option) => variant.optionValues?.[option.id] ?? variant.optionValues?.[option.name] ?? '').filter(Boolean)].filter(Boolean).join(' · ') || 'پیش‌فرض',
        sku: stableVariantSku(product.sku.trim(), variant.id, variant.color, variant.optionValues),
        base_price: vOrigIrr,
        original_price: vOrigIrr,
        price_override: vOrigIrr,
        discount_price: vDisc > 0 ? vFinalIrr : null,
        effective_price: vFinalIrr,
        discount_percentage: vDisc,
        discount_percent: vDisc,
        price: vFinalIrr,
        stock: stockVal,
        stock_quantity: stockVal,
        inventory: { quantity: stockVal, reserved_quantity: 0 },
        is_active: variant.is_active !== false,
        image_url: vMainImg || undefined,
        images: vImages.length ? vImages : undefined,
        attributes: {
          ...(variant.color.trim() ? { color: variant.color.trim() } : {}),
          ...Object.fromEntries(
            options.map((option) => [option.id, variant.optionValues?.[option.id] ?? variant.optionValues?.[option.name] ?? '']).filter(([, value]) => Boolean(value))
          ),
          ...(vMainImg ? { image_url: vMainImg } : {}),
        },
      };
    });
  const variantAxes = options.map((option) => ({ key: option.id, label: option.name }));
  const totalStock = variants.length > 0
    ? variants.filter((v) => v.is_active !== false).reduce((sum, v) => sum + (v.stock_quantity || 0), 0)
    : Math.max(0, asNumber(product.stock));

  const payload = {
    ...(category ? { category_id: category.id } : {}),
    name: product.name.trim(),
    slug: product.sku.trim().toLowerCase(),
    sku: product.sku.trim(),
    description: product.description.trim(),
    base_price: originalPriceIrr,
    original_price: originalPriceIrr,
    discount_price: discountPercent > 0 ? finalPriceIrr : null,
    effective_price: finalPriceIrr,
    discount_percentage: discountPercent,
    discount_percent: discountPercent,
    currency: 'IRR',
    is_active: product.active,
    is_featured: product.featured,
    in_stock: totalStock > 0,
    stock_quantity: totalStock,
    initial_stock: totalStock,
    images,
    colors: colors.length ? colors : undefined,
    variant_options: variantAxes.length ? variantAxes : undefined,
    attributes: Object.keys(attributes).length ? attributes : undefined,
    variants: variants as unknown as Product['variants'],
  };
  return payload as Omit<Product, 'id'>;
};

export const toCategoryWritePayload = (category: AdminReplicaCategory): Omit<Category, 'id'> => ({
  name: category.name.trim(),
  slug: category.slug.trim(),
  is_active: category.active,
  parent_id: category.parentId ?? null,
  level: 1,
  sort_order: 1,
});

const mapLiveTicket = (ticket: SupportTicket): AdminReplicaTicket => {
  const status: Record<SupportTicket['status'], AdminReplicaTicketStatus> = {
    open: 'باز',
    investigating: 'در حال بررسی',
    answered: 'پاسخ داده شده',
    closed: 'بسته شده',
  };
  const priority: Record<SupportTicket['priority'], AdminReplicaTicket['priority']> = {
    urgent: 'فوری',
    high: 'فوری',
    medium: 'عادی',
    low: 'کم',
  };

  return {
    id: ticket.id,
    ticketNumber: (ticket as SupportTicket & { ticket_number?: string }).ticket_number || ticket.id,
    title: ticket.title,
    department: ticket.department,
    updated: ticket.last_update,
    status: status[ticket.status],
    priority: priority[ticket.priority],
    archived: Boolean(ticket.archived_at),
    unreadCount: ticket.messages.filter((message) => message.sender === 'user' && !message.read_at).length,
    messages: ticket.messages.map((message) => ({
      id: message.id,
      sender: message.sender === 'support' ? 'admin' : 'customer',
      body: message.message,
      createdAt: message.created_at,
      time: message.time,
      readAt: message.read_at,
    })),
  };
};

export const createLiveAdminData = ({ user, orders, products, categories, tickets, users, dashboard, dashboardLoading, dashboardError, productAttributeDefinitions = [], operations }: {
  user: UserProfile;
  orders: UserOrder[];
  products: Product[];
  categories: Category[];
  tickets: SupportTicket[];
  users: UserProfile[];
  dashboard: AdminDashboardResponse | null;
  dashboardLoading: boolean;
  dashboardError: boolean;
  productAttributeDefinitions?: AdminProductAttributeDefinition[];
  operations?: AdminReplicaOperations;
}): AdminReplicaLiveData => ({
  source: 'live',
  userName: user.name || 'مدیر نوین‌نت',
  userRole: user.role === 'admin' ? 'مدیر ارشد' : 'کارشناس',
  orders: orders.map(mapLiveOrder),
  products: products.map((product) => mapLiveProduct(product, categories, productAttributeDefinitions)),
  categories: mapLiveCategories(categories, products),
  tickets: tickets.map(mapLiveTicket),
  users: users.map(mapLiveUser),
  dashboard: mapDashboard(dashboard),
  dashboardLoading,
  dashboardError,
  productAttributeDefinitions,
  operations,
});
