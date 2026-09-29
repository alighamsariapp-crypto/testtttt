import type {
  AdminProductAttributeDefinition,
  AdminReplicaCategory as DemoCategory,
  AdminReplicaProduct as DemoProduct,
  AdminReplicaProductColor as ProductColorOption,
  AdminReplicaProductOption as ProductCustomOption,
  AdminReplicaProductVariant as ProductVariant,
} from '../adminLiveData';

export type ProductType = 'simple' | 'variable';

export type SectionKey = 'info' | 'pricing' | 'images' | 'variants' | 'description';

export interface ProductFormState {
  id: number;
  name: string;
  sku: string;
  basePrice: number; // قیمت اصلی (ورودی مدیر)
  discountPercent: number; // درصد تخفیف (ورودی مدیر)
  price: number; // قیمت نهایی محاسبه‌شده (فقط خواندنی در UI)
  regularPrice?: number;
  stock: number;
  lowStockThreshold?: number;
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
  productType: ProductType;
  colors: ProductColorOption[];
  options: ProductCustomOption[];
  attributes: { key: string; val: string }[];
  facetValues: Record<string, string>;
  variants: ProductVariant[];
  slug: string;
}

export interface SectionConfig {
  id: SectionKey;
  label: string;
}

export {
  DemoCategory,
  DemoProduct,
  AdminProductAttributeDefinition,
  ProductColorOption,
  ProductCustomOption,
  ProductVariant,
};
