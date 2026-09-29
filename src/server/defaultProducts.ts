export interface SeedVariant {
  id: number;
  product_id: number;
  name: string;
  sku: string;
  price_override?: number | null;
  base_price?: number;
  original_price?: number;
  discount_percent?: number;
  discount_percentage?: number;
  discount_price?: number | null;
  effective_price?: number;
  price?: number;
  stock?: number;
  stock_quantity: number;
  inventory?: {
    quantity: number;
    reserved_quantity?: number;
    safety_threshold?: number;
  };
  is_active: boolean;
  image_url?: string;
  images?: string[];
  attributes?: Record<string, any>;
}

export interface SeedProduct {
  id: number;
  category_id: number;
  name: string;
  slug: string;
  sku: string;
  description: string;
  short_description?: string;
  base_price: number;
  compare_price?: number;
  original_price?: number;
  discount_percent?: number;
  discount_percentage?: number;
  discount_price?: number;
  effective_price?: number;
  currency: string;
  stock_quantity: number;
  in_stock: boolean;
  is_active: boolean;
  is_featured: boolean;
  images: string[];
  gallery_urls?: string[];
  colors?: Array<{
    name: string;
    hex: string;
    images: string[];
    image?: string;
  }>;
  variant_options?: Array<{ key: string; label: string }>;
  attributes: Record<string, any>;
  variants: SeedVariant[];
}

export const DEFAULT_PRODUCTS_LIST: SeedProduct[] = [
  {
    id: 101,
    category_id: 2,
    name: "لپ‌تاپ گیمینگ ایسوس مدل TUF A15",
    slug: "asus-tuf-a15-demo",
    sku: "ASUS-TUF-A15",
    description: "لپ‌تاپ گیمینگ ایسوس با نمایشگر ۱۵.۶ اینچ و پردازنده قدرتمند.",
    base_price: 685000000,
    original_price: 685000000,
    discount_price: 649000000,
    discount_percent: 5,
    effective_price: 649000000,
    currency: "IRR",
    stock_quantity: 6,
    in_stock: true,
    is_active: true,
    is_featured: true,
    images: ["https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=900&q=80"],
    attributes: { brand: "ایسوس", processor: "Ryzen 7", ram: "16GB", storage: "1TB SSD" },
    variants: [
      {
        id: 1001,
        product_id: 101,
        name: "پیش‌فرض",
        sku: "ASUS-TUF-A15",
        is_active: true,
        stock_quantity: 6,
        stock: 6,
        price_override: 685000000,
        original_price: 685000000,
        discount_price: 649000000,
        discount_percent: 5,
        effective_price: 649000000,
        price: 649000000,
        inventory: { quantity: 6, reserved_quantity: 0 },
      },
    ],
  },
  {
    id: 102,
    category_id: 3,
    name: "لپ‌تاپ لنوو مدل ThinkPad E16",
    slug: "lenovo-thinkpad-e16-demo",
    sku: "LEN-TP-E16",
    description: "لپ‌تاپ اداری لنوو با حافظهٔ SSD و باتری با دوام.",
    base_price: 522000000,
    original_price: 522000000,
    effective_price: 522000000,
    currency: "IRR",
    stock_quantity: 10,
    in_stock: true,
    is_active: true,
    is_featured: false,
    images: ["https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=900&q=80"],
    attributes: { brand: "لنوو", processor: "Core i5", ram: "16GB", storage: "512GB SSD" },
    variants: [
      {
        id: 1002,
        product_id: 102,
        name: "پیش‌فرض",
        sku: "LEN-TP-E16",
        is_active: true,
        stock_quantity: 10,
        stock: 10,
        price_override: 522000000,
        original_price: 522000000,
        effective_price: 522000000,
        price: 522000000,
        inventory: { quantity: 10, reserved_quantity: 0 },
      },
    ],
  },
  {
    id: 103,
    category_id: 4,
    name: "گوشی موبایل سامسونگ مدل Galaxy S24",
    slug: "samsung-s24-demo",
    sku: "SAM-S24",
    description: "گوشی پرچم‌دار سامسونگ مجهز به هوش مصنوعی گلکسی.",
    base_price: 478000000,
    original_price: 478000000,
    effective_price: 478000000,
    currency: "IRR",
    stock_quantity: 18,
    in_stock: true,
    is_active: true,
    is_featured: true,
    images: [
      "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1565849904461-04a58ad377e0?auto=format&fit=crop&w=900&q=80",
    ],
    gallery_urls: [
      "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1565849904461-04a58ad377e0?auto=format&fit=crop&w=900&q=80",
    ],
    colors: [
      {
        name: "مشکی",
        hex: "#1e293b",
        images: [
          "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=900&q=80",
          "https://images.unsplash.com/photo-1580910051074-3eb694886505?auto=format&fit=crop&w=900&q=80",
        ],
        image: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=900&q=80",
      },
      {
        name: "آبی",
        hex: "#2563eb",
        images: [
          "https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?auto=format&fit=crop&w=900&q=80",
          "https://images.unsplash.com/photo-1574944985070-8f3ebc6b79d2?auto=format&fit=crop&w=900&q=80",
        ],
        image: "https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?auto=format&fit=crop&w=900&q=80",
      },
      {
        name: "نارنجی",
        hex: "#ea580c",
        images: [
          "https://images.unsplash.com/photo-1565849904461-04a58ad377e0?auto=format&fit=crop&w=900&q=80",
          "https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&w=900&q=80",
        ],
        image: "https://images.unsplash.com/photo-1565849904461-04a58ad377e0?auto=format&fit=crop&w=900&q=80",
      },
    ],
    variant_options: [{ key: "storage", label: "حافظه داخلی" }],
    attributes: {
      brand: "سامسونگ",
      ram: "8GB",
      storage: ["256GB", "512GB"],
      novinet_variant_axes: [{ key: "storage", label: "حافظه داخلی" }],
    },
    variants: [
      {
        id: 10031,
        product_id: 103,
        name: "مشکی · 256GB",
        sku: "SAM-S24-BLK-256",
        is_active: true,
        attributes: { color: "مشکی", storage: "256GB", image_url: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=900&q=80" },
        image_url: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=900&q=80",
        inventory: { quantity: 5, reserved_quantity: 0 },
        stock_quantity: 5,
        stock: 5,
        base_price: 478000000,
        original_price: 478000000,
        effective_price: 478000000,
        price: 478000000,
      },
      {
        id: 10032,
        product_id: 103,
        name: "مشکی · 512GB",
        sku: "SAM-S24-BLK-512",
        is_active: true,
        attributes: { color: "مشکی", storage: "512GB", image_url: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=900&q=80" },
        image_url: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=900&q=80",
        inventory: { quantity: 3, reserved_quantity: 0 },
        stock_quantity: 3,
        stock: 3,
        base_price: 528000000,
        original_price: 528000000,
        effective_price: 528000000,
        price: 528000000,
      },
      {
        id: 10033,
        product_id: 103,
        name: "آبی · 256GB",
        sku: "SAM-S24-BLU-256",
        is_active: true,
        attributes: { color: "آبی", storage: "256GB", image_url: "https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?auto=format&fit=crop&w=900&q=80" },
        image_url: "https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?auto=format&fit=crop&w=900&q=80",
        inventory: { quantity: 4, reserved_quantity: 0 },
        stock_quantity: 4,
        stock: 4,
        base_price: 478000000,
        original_price: 478000000,
        effective_price: 478000000,
        price: 478000000,
      },
      {
        id: 10034,
        product_id: 103,
        name: "آبی · 512GB",
        sku: "SAM-S24-BLU-512",
        is_active: true,
        attributes: { color: "آبی", storage: "512GB", image_url: "https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?auto=format&fit=crop&w=900&q=80" },
        image_url: "https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?auto=format&fit=crop&w=900&q=80",
        inventory: { quantity: 2, reserved_quantity: 0 },
        stock_quantity: 2,
        stock: 2,
        base_price: 528000000,
        original_price: 528000000,
        effective_price: 528000000,
        price: 528000000,
      },
      {
        id: 10035,
        product_id: 103,
        name: "نارنجی · 256GB",
        sku: "SAM-S24-ORG-256",
        is_active: true,
        attributes: { color: "نارنجی", storage: "256GB", image_url: "https://images.unsplash.com/photo-1565849904461-04a58ad377e0?auto=format&fit=crop&w=900&q=80" },
        image_url: "https://images.unsplash.com/photo-1565849904461-04a58ad377e0?auto=format&fit=crop&w=900&q=80",
        inventory: { quantity: 2, reserved_quantity: 0 },
        stock_quantity: 2,
        stock: 2,
        base_price: 478000000,
        original_price: 478000000,
        effective_price: 478000000,
        price: 478000000,
      },
      {
        id: 10036,
        product_id: 103,
        name: "نارنجی · 512GB",
        sku: "SAM-S24-ORG-512",
        is_active: true,
        attributes: { color: "نارنجی", storage: "512GB", image_url: "https://images.unsplash.com/photo-1565849904461-04a58ad377e0?auto=format&fit=crop&w=900&q=80" },
        image_url: "https://images.unsplash.com/photo-1565849904461-04a58ad377e0?auto=format&fit=crop&w=900&q=80",
        inventory: { quantity: 2, reserved_quantity: 0 },
        stock_quantity: 2,
        stock: 2,
        base_price: 528000000,
        original_price: 528000000,
        effective_price: 528000000,
        price: 528000000,
      },
    ],
  },
  {
    id: 104,
    category_id: 6,
    name: "مودم 5G هواوی مدل H112-372",
    slug: "huawei-h112-demo",
    sku: "HUA-H112-5G",
    description: "مودم رومیزی 5G با Wi‑Fi 6 و پشتیبانی از سیم‌کارت نوین‌نت.",
    base_price: 219000000,
    original_price: 219000000,
    effective_price: 219000000,
    currency: "IRR",
    stock_quantity: 4,
    in_stock: true,
    is_active: true,
    is_featured: true,
    images: ["https://images.unsplash.com/photo-1544197150-b99a580bb7a8?auto=format&fit=crop&w=900&q=80"],
    attributes: { brand: "هواوی", network_generation: ["5G", "4G"], modem_type: "رومیزی" },
    variants: [
      {
        id: 1004,
        product_id: 104,
        name: "پیش‌فرض",
        sku: "HUA-H112-5G",
        is_active: true,
        stock_quantity: 4,
        stock: 4,
        price_override: 219000000,
        original_price: 219000000,
        effective_price: 219000000,
        price: 219000000,
        inventory: { quantity: 4, reserved_quantity: 0 },
      },
    ],
  },
];
