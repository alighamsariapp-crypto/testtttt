import {
  ActiveSession,
  CartItem,
  CartSummary,
  SupportTicket,
  TicketMessage,
  UserAddress,
  UserOrder,
  UserProfile,
  WalletTransaction,
  Product,
  ProductVariant,
  ProductVariantOption,
  ServiceItem,
} from '../types';

type ApiRecord = Record<string, any>;

const PRODUCT_IMAGE_FALLBACK = '/images/product-placeholder.svg';

const formatDate = (value?: string | null): string => {
  if (!value) return '';

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('fa-IR');
};

const formatDateTime = (value?: string | null): string => {
  if (!value) return '';

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : `${date.toLocaleDateString('fa-IR')} - ${date.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}`;
};

export const mapAddress = (address: ApiRecord): UserAddress => ({
  id: Number(address.id),
  title: address.title || (address.type === 'billing' ? 'محل کار' : address.type === 'shipping' ? 'خانه' : 'آدرس'),
  recipient_name: address.recipient_name,
  phone: address.phone,
  province: address.province,
  city: address.city,
  postal_code: address.postal_code,
  address_line: address.address_line,
  is_default: Boolean(address.is_default),
});

export const mapUser = (input: ApiRecord): UserProfile => {
  const user = (input && typeof input === 'object' && 'user' in input && input.user) ? (input.user as ApiRecord) : input;
  return {
    id: Number(user.id || 0),
    name: user.name || 'کاربر نوین‌نت',
    email: user.email || '',
    phone: user.phone || undefined,
    role: user.role || 'customer',
    status: user.status || 'active',
    loyalty_points: user.loyalty_points ?? 0,
    wallet_balance: user.wallet_balance ?? 0,
    orders_count: Number(user.orders_count ?? 0),
    open_tickets_count: Number(user.open_tickets_count ?? 0),
    last_order_at: user.last_order_at ? formatDate(user.last_order_at) : null,
    join_date: formatDate(user.created_at || user.join_date),
    email_verified: Boolean(user.email_verified || user.email_verified_at),
    phone_verified: Boolean(user.phone_verified || user.phone_verified_at),
    has_password: Boolean(user.has_password),
    addresses: Array.isArray(user.addresses) ? user.addresses.map(mapAddress) : undefined,
  };
};

const orderStatus = (status: string): UserOrder['status'] => {
  const statuses: Record<string, UserOrder['status']> = {
    pending: 'pending',
    awaiting_payment: 'pending',
    paid: 'processing',
    processing: 'preparing',
    preparing: 'preparing',
    shipped: 'shipping',
    shipping: 'shipping',
    completed: 'delivered',
    delivered: 'delivered',
    cancelled: 'cancelled',
    refunded: 'returned',
    returned: 'returned',
  };

  return statuses[status] || 'pending';
};

const orderStatusLabel = (status: UserOrder['status']): string => ({
  pending: 'در انتظار پرداخت',
  processing: 'در حال پردازش',
  preparing: 'در حال آماده‌سازی',
  shipping: 'ارسال شده',
  delivered: 'تحویل شده',
  cancelled: 'لغو شده',
  returned: 'مرجوع شده',
}[status]);

export const mapOrder = (order: ApiRecord): UserOrder => {
  const status = orderStatus(order.status);
  let shippingAddress: any = order.shipping_address_snapshot;
  if (typeof shippingAddress === 'string') {
    try {
      shippingAddress = JSON.parse(shippingAddress);
    } catch {
      shippingAddress = { address_line: shippingAddress, address: shippingAddress };
    }
  } else if (!shippingAddress && typeof order.shipping_address === 'object' && order.shipping_address !== null) {
    shippingAddress = order.shipping_address;
  }
  shippingAddress = shippingAddress || {};

  const fullAddressString = shippingAddress.address_line || shippingAddress.address || [shippingAddress.province, shippingAddress.city].filter(Boolean).join(' - ') || '';

  const addressObj = {
    full_name: shippingAddress.full_name || shippingAddress.recipient_name || order.customer_name || order.user?.name || '',
    recipient_name: shippingAddress.recipient_name || shippingAddress.full_name || order.customer_name || order.user?.name || '',
    phone: shippingAddress.phone || shippingAddress.recipient_phone || order.customer_phone || order.user?.phone || '',
    province: shippingAddress.province || '',
    city: shippingAddress.city || '',
    address: shippingAddress.address || shippingAddress.address_line || '',
    address_line: shippingAddress.address_line || shippingAddress.address || '',
    postal_code: shippingAddress.postal_code || '',
    trim: () => fullAddressString.trim(),
    toString: () => fullAddressString,
  };

  const rawDate = order.created_at || order.date;

  return {
    id: String(order.id),
    order_number: order.order_number,
    date: formatDate(rawDate) || String(rawDate || ''),
    created_at: formatDate(rawDate) || String(rawDate || ''),
    status,
    status_label: orderStatusLabel(status),
    total_amount: Number(order.subtotal ?? order.total_amount ?? order.grand_total ?? 0),
    discount_amount: Number(order.discount_total ?? order.discount_amount ?? 0),
    shipping_cost: Number(order.shipping_total ?? order.shipping_cost ?? 0),
    final_payable: Number(order.grand_total ?? order.final_payable ?? order.total_amount ?? 0),
    currency: order.currency || 'IRR',
    payment_method: order.payment_method || (Array.isArray(order.payments) && order.payments[0]?.gateway) || 'online',
    payment_status: order.payment_status || (Array.isArray(order.payments) && order.payments[0]?.status) || 'pending',
    item_count: Array.isArray(order.items) ? order.items.length : Number(order.items_count ?? order.item_count ?? 0),
    items: Array.isArray(order.items) ? order.items.map((item: ApiRecord) => ({
      id: item.id ? Number(item.id) : undefined,
      product_id: Number(item.product_id ?? 0),
      product_name: item.product_name_snapshot || item.product_name || item.name || 'کالا',
      name: item.product_name_snapshot || item.product_name || item.name || 'کالا',
      variant_name: item.variant_sku_snapshot || item.variant_name,
      variant_id: item.product_variant_id ? Number(item.product_variant_id) : (item.variant_id ? Number(item.variant_id) : undefined),
      quantity: Number(item.quantity ?? 0),
      unit_price: Number(item.unit_price ?? 0),
      total_price: Number(item.total_price ?? (Number(item.unit_price ?? 0) * Number(item.quantity ?? 1))),
      image_url: item.image_url,
    })) : [],
    shipping_address: addressObj as any,
    recipient_name: addressObj.recipient_name,
    recipient_phone: addressObj.phone,
    tracking_code: order.tracking_code,
    customer_name: addressObj.full_name,
    customer_email: order.customer_email || order.user?.email,
    customer_phone: addressObj.phone,
    user_id: order.user_id ? Number(order.user_id) : (order.user?.id ? Number(order.user.id) : undefined),
  };
};

const asNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const firstNonEmptyString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value;
  }
  return undefined;
};

const asStringRecord = (value: unknown): Record<string, string> | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;

  const record = Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>((result, [key, item]) => {
    if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
      result[key] = String(item);
    }
    return result;
  }, {});

  return Object.keys(record).length > 0 ? record : undefined;
};

const normalizeProductColors = (value: unknown): Product['colors'] | undefined => {
  if (!Array.isArray(value)) return undefined;

  const colors = value.reduce<NonNullable<Product['colors']>>((result, item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return result;

    const record = item as Record<string, unknown>;
    const name = firstNonEmptyString(record.name, record.label, record.value);
    const hex = firstNonEmptyString(record.hex, record.color_code, record.value_hex);
    if (name && hex) {
      const rawImages = Array.isArray(record.images)
        ? record.images
        : (Array.isArray(record.gallery) ? record.gallery : []);
      const images = rawImages
        .filter((img): img is string => typeof img === 'string' && img.trim().length > 0);
      const image = firstNonEmptyString(record.image, record.image_url, images[0]);
      if (image && !images.includes(image)) {
        images.unshift(image);
      }
      result.push({
        name,
        hex,
        images: images.length > 0 ? images : undefined,
        image: image || undefined,
      });
    }
    return result;
  }, []);

  return colors.length > 0 ? colors : undefined;
};

const normalizeProductSpecs = (value: unknown): Record<string, string | string[]> | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;

  const ignoredKeys = new Set(['novinet_admin_colors', 'admin_colors', 'images', 'image_url', 'novinet_variant_axes']);
  const specs = Object.entries(value as Record<string, unknown>).reduce<Record<string, string | string[]>>((result, [key, item]) => {
    if (ignoredKeys.has(key)) return result;
    if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
      result[key] = String(item);
    } else if (Array.isArray(item)) {
      const values = item
        .filter((entry): entry is string | number | boolean => typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean')
        .map(String)
        .filter((entry) => entry.trim().length > 0);
      if (values.length > 0) result[key] = values;
    }
    return result;
  }, {});

  return Object.keys(specs).length > 0 ? specs : undefined;
};

const normalizeVariantOptions = (value: unknown): ProductVariantOption[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const options = value.reduce<ProductVariantOption[]>((result, item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return result;
    const record = item as Record<string, unknown>;
    const key = firstNonEmptyString(record.key);
    const label = firstNonEmptyString(record.label, record.name);
    if (key && label && !result.some((option) => option.key === key)) result.push({ key, label });
    return result;
  }, []);
  return options.length > 0 ? options : undefined;
};

export const mapProduct = (product: ApiRecord): Product => {
  const imageList = Array.isArray(product.images) ? product.images : [];
  const attributes = product.attributes && typeof product.attributes === 'object' && !Array.isArray(product.attributes) ? product.attributes : {};
  const normalizedColors = normalizeProductColors(product.colors ?? attributes.novinet_admin_colors);
  const normalizedSpecs = normalizeProductSpecs(product.specs ?? attributes);
  const variantOptions = normalizeVariantOptions(product.variant_options ?? attributes.novinet_variant_axes);
  const productImage = firstNonEmptyString(product.image, product.image_url, imageList[0]) || PRODUCT_IMAGE_FALLBACK;
  const galleryUrls = Array.isArray(product.gallery_urls)
    ? product.gallery_urls.filter((image: unknown): image is string => typeof image === 'string' && image.trim().length > 0)
    : imageList.filter((image: unknown): image is string => typeof image === 'string' && image.trim().length > 0);

  const rawVariants = Array.isArray(product.variants) ? product.variants : [];
  let variants: ProductVariant[] = rawVariants.map((variant: ApiRecord) => {
    const inventoryQuantity = variant.inventory?.quantity;
    const sellableStock = inventoryQuantity === undefined
      ? asNumber(variant.stock_quantity)
      : Math.max(0, asNumber(inventoryQuantity) - asNumber(variant.inventory?.reserved_quantity));

    const vOrig = variant.original_price ?? variant.base_price ?? variant.price_override ?? product.base_price;
    const vDisc = variant.discount_percent ?? variant.discount_percentage;
    const vAttributes = asStringRecord(variant.attributes) || {};
    const vColor = vAttributes.color || vAttributes.رنگ || (typeof variant.color === 'string' ? variant.color : undefined);
    const matchingColor = normalizedColors?.find((c) => c.name.toLocaleLowerCase() === vColor?.toLocaleLowerCase());
    const explicitImageUrl = firstNonEmptyString(variant.image_url, vAttributes.image_url);
    const vImageUrl = explicitImageUrl || matchingColor?.image || matchingColor?.images?.[0];
    const rawVariantImages = Array.isArray(variant.images)
      ? variant.images.filter((img: unknown): img is string => typeof img === 'string' && img.trim().length > 0)
      : [];
    const vImages = rawVariantImages.length > 0 ? rawVariantImages : (matchingColor?.images || (vImageUrl ? [vImageUrl] : []));

    return {
      id: asNumber(variant.id),
      product_id: asNumber(variant.product_id ?? product.id),
      name: variant.name || 'پیش‌فرض',
      sku: variant.sku || product.sku || '',
      price_override: variant.price_override === null || variant.price_override === undefined ? null : asNumber(variant.price_override),
      base_price: vOrig === undefined || vOrig === null ? undefined : asNumber(vOrig),
      original_price: vOrig === undefined || vOrig === null ? undefined : asNumber(vOrig),
      discount_price: variant.discount_price === undefined || variant.discount_price === null ? null : asNumber(variant.discount_price),
      discount_percentage: vDisc === undefined || vDisc === null ? undefined : asNumber(vDisc),
      discount_percent: vDisc === undefined || vDisc === null ? undefined : asNumber(vDisc),
      effective_price: variant.effective_price ? asNumber(variant.effective_price) : (variant.price_override === null || variant.price_override === undefined ? undefined : asNumber(variant.price_override)),
      stock_quantity: sellableStock,
      is_active: variant.is_active !== false && variant.is_active !== 0 && variant.is_active !== '0',
      attributes: vAttributes,
      image_url: vImageUrl,
      images: vImages.length > 0 ? vImages : undefined,
    };
  });

  const basePrice = asNumber(product.base_price);
  const discountPrice = product.discount_price ?? product.compare_price ?? undefined;
  const effectivePrice = asNumber(product.effective_price ?? product.discount_price ?? product.base_price);

  // If no variants exist, provide a default variant so carting & availability work seamlessly
  const hasOriginalVariants = variants.length > 0;
  if (!hasOriginalVariants) {
    const rawStock = product.stock_quantity !== undefined
      ? asNumber(product.stock_quantity)
      : (product.initial_stock !== undefined
          ? asNumber(product.initial_stock)
          : (product.in_stock === false ? 0 : 10));
    variants = [{
      id: asNumber(product.id) || 1,
      product_id: asNumber(product.id) || 1,
      name: 'استاندارد',
      sku: product.sku || '',
      price_override: discountPrice === undefined || discountPrice === null ? null : asNumber(discountPrice),
      effective_price: effectivePrice,
      stock_quantity: Math.max(0, rawStock),
      is_active: product.is_active !== false,
      attributes: {},
      image_url: productImage,
    }];
  }

  const activeVariants = variants.filter((variant) => variant.is_active);
  const calculatedStock = activeVariants.reduce((sum, variant) => sum + Math.max(0, variant.stock_quantity ?? 0), 0);
  const isExplicitlyOutOfStock = product.in_stock === false || (product.stock_quantity !== undefined && asNumber(product.stock_quantity) <= 0 && !hasOriginalVariants);
  const inStock = !isExplicitlyOutOfStock && calculatedStock > 0 && activeVariants.length > 0;

  return {
    id: asNumber(product.id),
    category_id: asNumber(product.category_id),
    category_name: product.category_name || product.category?.name,
    category_slug: product.category_slug || product.category?.slug,
    subcategory_slug: product.subcategory_slug,
    sub_subcategory_slug: product.sub_subcategory_slug,
    category_path: Array.isArray(product.category_path) ? product.category_path : undefined,
    brand: product.brand || attributes.brand,
    brand_slug: product.brand_slug,
    technology: product.technology || attributes.technology,
    colors: normalizedColors,
    device_compatibility: Array.isArray(product.device_compatibility) ? product.device_compatibility : undefined,
    sim_operator: product.sim_operator || attributes.sim_operator,
    sim_type: product.sim_type || attributes.sim_type,
    sim_status: product.sim_status || attributes.sim_status,
    sim_prefix: product.sim_prefix || attributes.sim_prefix,
    sim_gift_internet: product.sim_gift_internet || attributes.sim_gift_internet,
    processor: product.processor || attributes.processor,
    ram_capacity: product.ram_capacity || product.ram || attributes.ram_capacity || attributes.ram,
    storage_capacity: product.storage_capacity || product.storage || attributes.storage_capacity || attributes.storage,
    gpu: product.gpu || attributes.gpu,
    screen_size: product.screen_size || attributes.screen_size,
    screen_resolution: product.screen_resolution || attributes.screen_resolution,
    os: product.os || attributes.os,
    network_generation: product.network_generation || attributes.network_generation,
    modem_type: product.modem_type || attributes.modem_type,
    ethernet_ports: product.ethernet_ports || attributes.ethernet_ports,
    wifi_standard: product.wifi_standard || attributes.wifi_standard,
    switch_type: product.switch_type || attributes.switch_type,
    poe_supported: product.poe_supported ?? attributes.poe_supported,
    port_count: product.port_count || product.ports_count || attributes.port_count || attributes.ports_count,
    name: product.name || 'کالای بدون نام',
    title_en: product.title_en || undefined,
    slug: product.slug || String(product.id),
    sku: product.sku || '',
    description: product.description || undefined,
    base_price: basePrice,
    original_price: product.original_price !== undefined ? asNumber(product.original_price) : basePrice,
    discount_price: discountPrice === undefined || discountPrice === null ? undefined : asNumber(discountPrice),
    effective_price: effectivePrice,
    discount_percentage: product.discount_percentage === undefined ? (product.discount_percent === undefined ? undefined : asNumber(product.discount_percent)) : asNumber(product.discount_percentage),
    discount_percent: product.discount_percent === undefined ? (product.discount_percentage === undefined ? undefined : asNumber(product.discount_percentage)) : asNumber(product.discount_percent),
    currency: product.currency || 'IRR',
    image: productImage,
    image_url: productImage,
    gallery_urls: galleryUrls.length > 0 ? galleryUrls : [productImage],
    guarantee: product.guarantee || attributes.guarantee,
    is_active: product.is_active !== false,
    is_featured: Boolean(product.is_featured),
    is_bestseller: Boolean(product.is_bestseller),
    is_smart: Boolean(product.is_smart),
    rating: product.rating === undefined ? undefined : asNumber(product.rating),
    review_count: product.review_count === undefined ? undefined : asNumber(product.review_count),
    in_stock: inStock,
    stock_quantity: calculatedStock,
    variants,
    variant_options: variantOptions,
    specs: normalizedSpecs,
    comments: Array.isArray(product.comments) ? product.comments : undefined,
  };
};

export const mapService = (service: ApiRecord): ServiceItem => ({
  id: asNumber(service.id),
  name: service.name || 'خدمت آنلاین',
  slug: service.slug || String(service.id),
  category: service.category || 'خدمات آنلاین',
  service_category_id: service.service_category_id === undefined || service.service_category_id === null ? undefined : asNumber(service.service_category_id),
  service_category: service.service_category && typeof service.service_category === 'object' ? {
    id: asNumber((service.service_category as ApiRecord).id),
    name: String((service.service_category as ApiRecord).name || service.category || 'خدمات آنلاین'),
    slug: String((service.service_category as ApiRecord).slug || ''),
    description: typeof (service.service_category as ApiRecord).description === 'string' ? (service.service_category as ApiRecord).description : undefined,
    is_active: (service.service_category as ApiRecord).is_active !== false,
    sort_order: asNumber((service.service_category as ApiRecord).sort_order),
    services_count: (service.service_category as ApiRecord).services_count === undefined ? undefined : asNumber((service.service_category as ApiRecord).services_count),
  } : undefined,
  short_description: service.short_description || service.description || '',
  description: service.description || service.short_description || '',
  estimated_base_price: asNumber(service.estimated_base_price),
  currency: service.currency || 'IRR',
  icon: service.icon || undefined,
  image_url: service.image_url || undefined,
  is_active: service.is_active !== false,
  documents: Array.isArray(service.documents) ? service.documents.filter((item: unknown) => typeof item === 'string') : [],
  steps: Array.isArray(service.steps) ? service.steps.filter((item: unknown) => typeof item === 'string') : [],
  faq: Array.isArray(service.faq) ? service.faq.filter((item: ApiRecord) => typeof item?.question === 'string' && typeof item?.answer === 'string').map((item: ApiRecord) => ({ question: item.question, answer: item.answer })) : [],
  contact_type: ['telegram', 'whatsapp', 'phone', 'external'].includes(String(service.contact_type)) ? service.contact_type : undefined,
  contact_url: typeof service.contact_url === 'string' ? service.contact_url : undefined,
  cta_label: typeof service.cta_label === 'string' ? service.cta_label : undefined,
  required_fields: Array.isArray(service.required_fields) ? service.required_fields : [],
});

const ticketStatusLabel = (status: string): string => ({
  open: 'باز',
  investigating: 'در حال بررسی',
  answered: 'پاسخ داده شده',
  closed: 'بسته شده',
}[status] || status);

export const mapTicketMessage = (message: ApiRecord): TicketMessage => ({
  id: Number(message.id),
  sender: message.sender === 'support' ? 'support' : 'user',
  author: message.user?.name || (message.sender === 'support' ? 'پشتیبانی نوین‌نت' : 'شما'),
  date: formatDate(message.created_at),
  time: message.created_at ? new Date(message.created_at).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }) : '',
  message: message.message,
  attachments: Array.isArray(message.attachments) ? message.attachments : undefined,
  created_at: typeof message.created_at === 'string' ? message.created_at : undefined,
  read_at: typeof message.read_at === 'string' ? message.read_at : null,
});

export const mapTicket = (ticket: ApiRecord): SupportTicket => ({
  id: String(ticket.id),
  ticket_number: ticket.ticket_number || String(ticket.id),
  title: ticket.title,
  department: ticket.department,
  status: ticket.status,
  status_label: ticketStatusLabel(ticket.status),
  priority: ticket.priority,
  last_update: formatDateTime(ticket.last_reply_at || ticket.updated_at),
  created_at: formatDateTime(ticket.created_at),
  closed_at: typeof ticket.closed_at === 'string' ? ticket.closed_at : null,
  archived_at: typeof ticket.archived_at === 'string' ? ticket.archived_at : null,
  messages: Array.isArray(ticket.messages) ? ticket.messages.map(mapTicketMessage) : [],
});

export const mapWalletTransaction = (transaction: ApiRecord): WalletTransaction => ({
  id: String(transaction.id),
  type: transaction.type === 'adjustment' ? 'cashback' : transaction.type,
  amount: Number(transaction.amount ?? 0),
  date: formatDateTime(transaction.created_at),
  description: transaction.description || '',
  tracking_code: transaction.reference || String(transaction.id),
  status: transaction.status,
});

export const mapCartSummary = (summary: ApiRecord): CartSummary => {
  const items: CartItem[] = Array.isArray(summary.items) ? summary.items.map((item: ApiRecord) => ({
    id: String(item.id),
    product_id: Number(item.product_id),
    product_variant_id: Number(item.variant_id),
    product_name: item.product_name,
    variant_name: item.variant_name,
    sku: item.variant_sku,
    unit_price: Number(item.unit_price),
    currency: item.currency || summary.currency || 'IRR',
    quantity: Number(item.quantity),
    subtotal: Number(item.total_price),
    available_stock: item.available_stock === undefined ? undefined : Number(item.available_stock),
    image_url: item.image_url,
  })) : [];

  return {
    items,
    item_count: Number(summary.item_count ?? items.length),
    subtotal: Number(summary.subtotal ?? 0),
    discount_total: Number(summary.discount_total ?? 0),
    coupon_discount: Number(summary.coupon_discount ?? 0),
    tax_total: Number(summary.tax ?? summary.tax_total ?? 0),
    shipping_total: Number(summary.shipping_total ?? 0),
    grand_total: Number(summary.grand_total ?? 0),
    currency: summary.currency || 'IRR',
    applied_coupon: summary.applied_coupon || null,
  };
};

export const mapActiveSession = (session: ApiRecord): ActiveSession => ({
  id: String(session.id),
  device: session.device || 'دستگاه ناشناس',
  browser: session.browser || 'مرورگر وب',
  os: session.os || '',
  location: session.location || '',
  ip: session.ip || '',
  last_active: formatDateTime(session.last_active || session.last_activity),
  created_at: session.created_at ? String(session.created_at) : undefined,
  expires_at: session.expires_at ? String(session.expires_at) : undefined,
  is_current: Boolean(session.is_current),
});
