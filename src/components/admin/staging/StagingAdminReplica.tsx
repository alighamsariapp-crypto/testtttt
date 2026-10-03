/* Design: Portal-inspired operational staging UI; mobile rows stay brief while the order drawer becomes a full operational record. */
// Design: Portal-inspired Novinet admin workspace; the Site tab is a compact storefront control center, never a page-builder, and changes only local demo state.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { BlogManagementPage } from "./BlogManagementPage";
import { ContentManagementPage } from "./ContentManagementPage";
import { OnlineServiceEditor, OnlineServicesPage } from "./OnlineServicesPage";
import { OnlineServiceCategoriesPage } from "./OnlineServiceCategoriesPage";
import { ProductEditorWorkspace } from "./ProductEditorWorkspace";
import { SettingsWorkspace } from "./SettingsWorkspace";
import { initialCheckoutConfiguration, initialSmsSystemConfiguration } from "../../../services/mockData";
import logo from "./assets/novinet-admin-logo.png";
import type { AdminCategoryAttributeDraft, AdminProductAttributeDefinition, AdminReplicaCategory, AdminReplicaLiveData, AdminReplicaOrder, AdminReplicaOrderStatus, AdminReplicaProduct, AdminReplicaTicket, AdminReplicaUser } from "./adminLiveData";
import { api } from "../../../services/api";
import { useSupportTicketAutoRefresh } from "../../../hooks/useSupportTicketAutoRefresh";
import type { AppearanceSettings, BlogPost, CheckoutConfiguration, ServiceCategoryItem, ServiceItem, SmsConnectionInfo, SmsSystemConfiguration, StaticPagesContent } from "../../../types";
import "./staging-admin.css";
import {
  BarChart3, Bell, Boxes, Check, ChevronDown, ChevronLeft, ClipboardList, Copy,
  CreditCard, Download, Eye, FilePenLine, Filter, FolderTree, GripVertical, Home, LogOut,
  Megaphone, Menu, MessageSquare, MoreVertical, Package, Pencil, Plus, Search, Settings, Store, FileText,
  ShieldCheck, ShoppingBag, SlidersHorizontal, Tag, Trash2, TrendingUp, UserRoundCog, Users, Wallet, X,
} from "lucide-react";

type Tab = "dashboard" | "orders" | "products" | "categories" | "discounts" | "campaigns" | "services" | "service-categories" | "blog" | "site" | "tickets" | "users" | "settings";
type BlogManagement = { posts: BlogPost[]; create: (draft: Omit<BlogPost, "id" | "views">) => Promise<BlogPost>; update: (id: number, draft: Partial<BlogPost>) => Promise<void>; remove: (id: number) => Promise<void> };
type ContentManagementBindings = { value: StaticPagesContent; save: <K extends keyof StaticPagesContent>(section: K, value: StaticPagesContent[K]) => Promise<void> };
type HomepageManagementBindings = { value: AppearanceSettings; save: (value: AppearanceSettings) => Promise<void> };
type CheckoutManagementBindings = { value: CheckoutConfiguration; save: (value: CheckoutConfiguration) => Promise<void> };
type SmsManagementBindings = { value: SmsSystemConfiguration; save: (value: SmsSystemConfiguration) => Promise<void>; testConnection: () => Promise<SmsConnectionInfo> };
type OperationalFocus = "orders-pending" | "tickets-open" | "products-low" | "discounts-active" | null;
type Tone = "amber" | "blue" | "purple" | "green" | "rose" | "slate";
type OrderStatus = AdminReplicaOrderStatus;
type ProductColor = { name: string; hex: string };
type ProductOption = { id: string; name: string; values: string[] };
type ProductAttribute = { id: string; label: string; value: string };
type ProductVariant = { id: string; color: string; optionValues?: Record<string, string>; price: number; stock: number; image?: string };

type DemoOrder = AdminReplicaOrder;
type DemoProduct = AdminReplicaProduct;
type DemoProductOperations = {
  saveProduct: (product: DemoProduct, mode: "create" | "update") => Promise<DemoProduct>;
  deleteProduct: (id: number) => void;
  toggleProductActive: (id: number) => void;
  toggleProductFeatured: (id: number) => void;
};
type ProductForm = DemoProduct & { colors: ProductColor[]; options: ProductOption[]; attributes: ProductAttribute[]; variants: ProductVariant[] };
type DemoCategory = AdminReplicaCategory;
type AttributeDataType = "single_select" | "multi_select" | "number" | "boolean" | "color";
type DemoDiscount = { id: number; code: string; title: string; amount: string; used: string; usedCount: number; usageLimit: number; minimumOrder: number; startsAt: string; endsAt: string; expires: string; active: boolean };
type CampaignKind = "سبد رهاشده" | "پرداخت رهاشده" | "خوش‌آمدگویی" | "پس از خرید" | "بازگردانی مشتری" | "موجودشدن کالا" | "وفاداری";
type DemoCampaign = { id: number; name: string; kind: CampaignKind; trigger: string; audience: string; channel: "پیامک" | "ایمیل"; offer: string; delay: string; delayValue: number; delayUnit: "دقیقه" | "ساعت" | "روز"; smsTemplate: string; frequency: string; active: boolean; delivered: number; recovered: number };
type DemoTicket = AdminReplicaTicket;
const ticketStatusToApi = { "باز": "open", "در حال بررسی": "investigating", "پاسخ داده شده": "answered", "بسته شده": "closed" } as const;
type DemoUser = AdminReplicaUser;
type OnlineServiceStatus = "پیش‌نویس" | "منتشرشده";
type OnlineServiceContactType = "تلگرام" | "واتس‌اپ" | "شماره تماس" | "لینک بیرونی";
type DemoOnlineService = { id: number; title: string; slug: string; category: string; serviceCategoryId: number; summary: string; body: string; documents: string[]; steps: string[]; faq: Array<{ question: string; answer: string }>; contactType: OnlineServiceContactType; contactUrl: string; ctaLabel: string; status: OnlineServiceStatus; updated: string };
type ConfirmState = { title: string; description: string; action: () => void } | null;

const serviceContactFromApi: Record<string, OnlineServiceContactType> = { telegram: "تلگرام", whatsapp: "واتس‌اپ", phone: "شماره تماس", external: "لینک بیرونی" };
const serviceContactToApi: Record<OnlineServiceContactType, "telegram" | "whatsapp" | "phone" | "external"> = { "تلگرام": "telegram", "واتس‌اپ": "whatsapp", "شماره تماس": "phone", "لینک بیرونی": "external" };
const attributeTypeLabels: Record<AttributeDataType, string> = { single_select: "انتخاب یک مقدار", multi_select: "انتخاب چند مقدار", number: "عدد", boolean: "بله / خیر", color: "رنگ" };
const categoryAttributeTemplates: Record<"ram" | "storage" | "new", Omit<AdminCategoryAttributeDraft, "sortOrder">> = {
  ram: { key: "ram", name: "حافظه RAM", dataType: "single_select", unit: "GB", options: ["8GB", "16GB", "32GB"], isFilterable: true, isRequired: false, inheritToChildren: true },
  storage: { key: "storage", name: "حافظه داخلی / SSD", dataType: "single_select", unit: "GB", options: ["256GB", "512GB", "1TB"], isFilterable: true, isRequired: false, inheritToChildren: true },
  new: { key: "attribute", name: "ویژگی جدید", dataType: "single_select", unit: "", options: [], isFilterable: true, isRequired: false, inheritToChildren: true },
};
const fromServiceCatalog = (service: ServiceItem): DemoOnlineService => ({ id: service.id, title: service.name, slug: service.slug, category: service.category, serviceCategoryId: service.service_category_id ?? service.service_category?.id ?? 0, summary: service.short_description, body: service.description, documents: service.documents ?? [], steps: service.steps ?? [], faq: service.faq ?? [], contactType: serviceContactFromApi[service.contact_type ?? "external"] ?? "لینک بیرونی", contactUrl: service.contact_url ?? "", ctaLabel: service.cta_label ?? "دریافت راهنمایی", status: service.is_active ? "منتشرشده" : "پیش‌نویس", updated: "دادهٔ واقعی" });
const toServiceCatalogPayload = (service: DemoOnlineService) => ({ name: service.title, slug: service.slug, service_category_id: service.serviceCategoryId, short_description: service.summary, description: service.body || undefined, documents: service.documents, steps: service.steps, faq: service.faq, contact_type: serviceContactToApi[service.contactType], contact_url: service.contactUrl, cta_label: service.ctaLabel, is_active: service.status === "منتشرشده" });

const productImages = [
  "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=120&q=80",
  "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=120&q=80",
  "https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?auto=format&fit=crop&w=120&q=80",
  "https://images.unsplash.com/photo-1556656793-08538906a9f8?auto=format&fit=crop&w=120&q=80",
];

const initialOrders: DemoOrder[] = [
  { id: 1, number: "ORD-2023-8901", customer: "علی رضایی", amount: 135000, status: "نیازمند تایید", date: "۱۴۰۳/۰۸/۱۵", address: "تهران، میدان ونک", tracking: "", items: 2, payment: "پرداخت موفق", fulfillment: "پیک شهری" },
  { id: 2, number: "ORD-2023-8900", customer: "سارا احمدی", amount: 450000, status: "آماده‌سازی", date: "۱۴۰۳/۰۸/۱۵", address: "تهران، سعادت‌آباد", tracking: "", items: 1, payment: "پرداخت موفق", fulfillment: "پست پیشتاز" },
  { id: 3, number: "ORD-2023-8899", customer: "محمد کریمی", amount: 820000, status: "نیازمند تایید", date: "۱۴۰۳/۰۸/۱۴", address: "مشهد، بلوار احمدآباد", tracking: "", items: 2, payment: "در انتظار پرداخت", fulfillment: "پست پیشتاز" },
  { id: 4, number: "ORD-2023-8898", customer: "زهرا موسوی", amount: 150000, status: "ارسال شده", date: "۱۴۰۳/۰۸/۱۴", address: "اصفهان، خیابان شیخ بهایی", tracking: "IR-942350", items: 1, payment: "پرداخت موفق", fulfillment: "پست پیشتاز" },
  { id: 5, number: "ORD-2023-8897", customer: "دکتر علیرضا فاتح", amount: 480000, status: "تحویل شده", date: "۱۴۰۳/۰۸/۱۳", address: "شیراز، خیابان زند", tracking: "IR-942210", items: 2, payment: "پرداخت موفق", fulfillment: "تحویل حضوری" },
];
const initialProducts: DemoProduct[] = [
  { id: 1, name: "لپ‌تاپ ۱۵.۶ اینچ لنوو مدل Legion Pro 5 - i7 16GB 1TB RTX4060", sku: "LNV-LGN-P5-4060", price: 880000, stock: 8, category: "لپ‌تاپ و کامپیوتر", brand: "لنوو", active: true, featured: true, image: productImages[0], gallery: [productImages[0], productImages[2]], description: "لپ‌تاپ حرفه‌ای برای کارهای روزمره و پردازش سنگین.", colors: [{ name: "مشکی", hex: "#111827" }, { name: "خاکستری", hex: "#64748b" }], variants: [{ id: "black", color: "مشکی", price: 880000, stock: 5, image: productImages[0] }, { id: "gray", color: "خاکستری", price: 895000, stock: 3, image: productImages[2] }], options: [{ id: "ram", name: "رم", values: ["۱۶GB", "۳۲GB"] }, { id: "storage", name: "حافظه", values: ["۵۱۲GB", "۱TB"] }], attributes: [{ id: "cpu", label: "پردازنده", value: "Core i7" }, { id: "display", label: "نمایشگر", value: "۱۵.۶ اینچ" }], sold: 28, updated: "امروز" },
  { id: 2, name: "لپ‌تاپ لنوو مدل ThinkPad E16 - Core i5 16GB 512GB SSD", sku: "LNV-TP-E16-I5", price: 432000, stock: 14, category: "لپ‌تاپ و کامپیوتر", active: true, featured: false, image: productImages[1], gallery: [productImages[1]], description: "مدل اداری با صفحه‌نمایش بزرگ و حافظهٔ سریع.", sold: 17, updated: "دیروز" },
  { id: 3, name: "لپ‌تاپ ۱۴ اینچ ایسوس مدل ZenBook 14 OLED - Ultra 7 32GB 1TB", sku: "ASUS-ZB14-U7", price: 920000, stock: 6, category: "لپ‌تاپ و کامپیوتر", brand: "ایسوس", active: true, featured: true, image: productImages[2], gallery: [productImages[2]], description: "لپ‌تاپ سبک با نمایشگر OLED و توان پردازشی بالا.", sold: 21, updated: "امروز" },
  { id: 4, name: "مک‌بوک ایر ۱۳ اینچ اپل با تراشه M3 - رم 16GB و حافظه 512GB", sku: "APL-MBA13-M3", price: 960000, stock: 11, category: "لپ‌تاپ و کامپیوتر", active: true, featured: true, image: productImages[0], gallery: [productImages[0]], description: "مدل سبک اپل با تراشهٔ M3 و باتری ماندگار.", sold: 12, updated: "۲ روز پیش" },
  { id: 5, name: "سیم‌کارت دائمی ایرانسل شماره ۰۹۳۵ همراه بسته ۱ گیگابایت هدیه", sku: "IRN-SIM-0935-PERM", price: 330000, stock: 3, category: "سیم‌کارت و اینترنت", active: true, featured: false, image: productImages[3], gallery: [productImages[3]], description: "سیم‌کارت دائمی با بستهٔ هدیه و امکان فعال‌سازی سریع.", sold: 34, updated: "امروز" },
  { id: 6, name: "مودم روتر Huawei 5G مدل H112-372", sku: "HW-5G-H112", price: 850000, stock: 18, category: "مودم و تجهیزات شبکه", active: true, featured: true, image: productImages[1], gallery: [productImages[1]], description: "مودم 5G برای خانه و کسب‌وکار با اتصال پایدار.", sold: 41, updated: "دیروز" },
];
const initialCategories: DemoCategory[] = [
  { id: 1, name: "مودم و تجهیزات شبکه", slug: "modem-and-network", products: 8, active: true },
  { id: 2, name: "سیم‌کارت و اینترنت", slug: "sim-card-and-internet", products: 4, active: true },
  { id: 3, name: "لپ‌تاپ و کامپیوتر", slug: "laptop-and-computer", products: 2, active: true },
  { id: 4, name: "خدمات سازمانی", slug: "enterprise-services", products: 0, active: false },
  { id: 5, name: "موبایل", slug: "mobile", products: 0, active: true },
];
const demoProductAttributeDefinitions: AdminProductAttributeDefinition[] = [
  { id: 1, key: "processor", name: "پردازنده (CPU)", dataType: "single_select", options: ["Core i5", "Core i7", "Ryzen 5", "Ryzen 7", "Apple M3"], categoryIds: [3], isRequired: false, isFilterable: true },
  { id: 2, key: "ram", name: "حافظهٔ RAM", dataType: "single_select", unit: "GB", options: ["8GB", "12GB", "16GB", "32GB"], categoryIds: [3, 5], isRequired: false, isFilterable: true },
  { id: 3, key: "storage", name: "حافظهٔ داخلی / SSD", dataType: "single_select", unit: "GB", options: ["128GB", "256GB", "512GB", "1TB"], categoryIds: [3, 5], isRequired: false, isFilterable: true },
  { id: 4, key: "gpu", name: "کارت گرافیک (GPU)", dataType: "single_select", options: ["RTX 4050", "RTX 4060", "Iris Xe", "بدون گرافیک مجزا"], categoryIds: [3], isRequired: false, isFilterable: true },
  { id: 5, key: "network_generation", name: "نسل شبکه", dataType: "single_select", options: ["4G", "5G", "TD-LTE"], categoryIds: [1, 5], isRequired: false, isFilterable: true },
  { id: 6, key: "modem_type", name: "نوع مودم", dataType: "single_select", options: ["رومیزی", "همراه", "روتر"], categoryIds: [1], isRequired: false, isFilterable: true },
  { id: 7, key: "wifi_standard", name: "استاندارد Wi‑Fi", dataType: "single_select", options: ["Wi‑Fi 5", "Wi‑Fi 6", "Wi‑Fi 6E"], categoryIds: [1], isRequired: false, isFilterable: true },
  { id: 8, key: "ethernet_ports", name: "تعداد پورت شبکه", dataType: "number", unit: "پورت", options: [], categoryIds: [1], isRequired: false, isFilterable: true },
  { id: 9, key: "battery_capacity", name: "ظرفیت باتری", dataType: "number", unit: "mAh", options: [], categoryIds: [5], isRequired: false, isFilterable: true },
];
const initialDiscounts: DemoDiscount[] = [
  { id: 1, code: "NOWRUZ1404", title: "تخفیف ویژه جشنواره نوروزی", amount: "۱۵٪", used: "۱۴۲ از ۵۰۰ بار", usedCount: 142, usageLimit: 500, minimumOrder: 200000, startsAt: "۱۴۰۳/۱۲/۲۰", endsAt: "۱۴۰۴/۰۱/۱۵", expires: "تا ۱۴۰۴/۰۱/۱۵", active: true },
  { id: 2, code: "FIRSTBUY", title: "تخفیف خرید اول مشتریان جدید", amount: "۳۰٬۰۰۰ تومان", used: "۴۸۹ از ۱۰۰۰ بار", usedCount: 489, usageLimit: 1000, minimumOrder: 150000, startsAt: "۱۴۰۳/۱۰/۰۱", endsAt: "۱۴۰۳/۱۲/۲۹", expires: "تا ۱۴۰۳/۱۲/۲۹", active: true },
  { id: 3, code: "MODEM5G", title: "تخفیف ویژه خرید انواع مودم و سیم‌کارت", amount: "۱۰٪", used: "۸۵ از ۲۰۰ بار", usedCount: 85, usageLimit: 200, minimumOrder: 500000, startsAt: "۱۴۰۴/۰۱/۰۱", endsAt: "۱۴۰۴/۰۶/۳۱", expires: "تا ۱۴۰۴/۰۶/۳۱", active: true },
  { id: 4, code: "YALDA50", title: "جشنواره شب یلدا", amount: "۲۰٪", used: "۳۰۰ از ۳۰۰ بار", usedCount: 300, usageLimit: 300, minimumOrder: 0, startsAt: "۱۴۰۳/۰۹/۱۵", endsAt: "۱۴۰۳/۱۰/۰۱", expires: "تا ۱۴۰۳/۱۰/۰۱", active: false },
];
const initialCampaigns: DemoCampaign[] = [
  { id: 1, name: "بازیابی پرداخت ناتمام", kind: "پرداخت رهاشده", trigger: "شروع پرداخت بدون ثبت سفارش", audience: "کاربر شناسایی‌شده", channel: "پیامک", offer: "۱۵٪ · اعتبار ۲۴ ساعت", delay: "۱ ساعت پس از رهاسازی", delayValue: 1, delayUnit: "ساعت", smsTemplate: "{{نام_کاربر}}، پرداخت شما برای {{نام_کالا}} ناتمام مانده است. با کد {{کد_تخفیف}} تا ۲۴ ساعت ۱۵٪ تخفیف بگیرید: {{لینک}}", frequency: "هر ۱۴ روز", active: true, delivered: 82, recovered: 13 },
  { id: 2, name: "یادآوری سبد خرید", kind: "سبد رهاشده", trigger: "افزودن کالا بدون شروع پرداخت", audience: "کاربر شناسایی‌شده", channel: "پیامک", offer: "یادآوری بدون تخفیف", delay: "۴ ساعت پس از رهاسازی", delayValue: 4, delayUnit: "ساعت", smsTemplate: "{{نام_کاربر}}، {{نام_کالا}} هنوز در سبد شماست. ادامهٔ خرید: {{لینک}}", frequency: "هر ۷ روز", active: true, delivered: 106, recovered: 19 },
  { id: 3, name: "مزیت خرید اول", kind: "خوش‌آمدگویی", trigger: "عضویت در خبرنامه", audience: "عضو جدید با رضایت بازاریابی", channel: "پیامک", offer: "۱۰٪ · اعتبار ۷ روز", delay: "بلافاصله", delayValue: 0, delayUnit: "دقیقه", smsTemplate: "{{نام_کاربر}}، به نوین‌نت خوش آمدید. با کد {{کد_تخفیف}} برای خرید اول خود ۱۰٪ تخفیف بگیرید: {{لینک}}", frequency: "فقط یک‌بار", active: true, delivered: 64, recovered: 12 },
  { id: 4, name: "پیشنهاد پس از خرید مودم", kind: "پس از خرید", trigger: "ثبت سفارش مودم", audience: "خریدار مودم", channel: "پیامک", offer: "پیشنهاد سیم‌کارت و اینترنت", delay: "۳ روز پس از تحویل", delayValue: 3, delayUnit: "روز", smsTemplate: "{{نام_کاربر}}، برای تکمیل تجربهٔ {{نام_کالا}}، بستهٔ اینترنت پیشنهادی شما آماده است: {{لینک}}", frequency: "برای هر سفارش", active: true, delivered: 38, recovered: 7 },
  { id: 5, name: "بازگشت مشتری غیرفعال", kind: "بازگردانی مشتری", trigger: "عدم سفارش مجدد", audience: "بدون خرید طی ۹۰ روز", channel: "پیامک", offer: "۱۲٪ · اعتبار ۴۸ ساعت", delay: "۹۰ روز پس از آخرین سفارش", delayValue: 90, delayUnit: "روز", smsTemplate: "{{نام_کاربر}}، دلمان برایتان تنگ شده. با کد {{کد_تخفیف}} تا ۴۸ ساعت از ۱۲٪ تخفیف استفاده کنید: {{لینک}}", frequency: "هر ۹۰ روز", active: false, delivered: 0, recovered: 0 },
  { id: 6, name: "خبر موجودشدن کالا", kind: "موجودشدن کالا", trigger: "بازگشت موجودی کالا", audience: "درخواست‌دهندهٔ همان کالا", channel: "پیامک", offer: "لینک مستقیم محصول", delay: "همان لحظه", delayValue: 0, delayUnit: "دقیقه", smsTemplate: "{{نام_کاربر}}، {{نام_کالا}} دوباره موجود شد. پیش از اتمام موجودی سفارش دهید: {{لینک}}", frequency: "برای هر درخواست", active: true, delivered: 21, recovered: 9 },
  { id: 7, name: "قدردانی مشتری وفادار", kind: "وفاداری", trigger: "رسیدن به سومین سفارش", audience: "مشتری وفادار", channel: "پیامک", offer: "۱۵٪ · اعتبار ۱۴ روز", delay: "پس از تکمیل سفارش", delayValue: 0, delayUnit: "دقیقه", smsTemplate: "{{نام_کاربر}}، بابت همراهی شما سپاسگزاریم. کد {{کد_تخفیف}} برای خرید بعدی شما فعال است: {{لینک}}", frequency: "فقط یک‌بار", active: false, delivered: 0, recovered: 0 },
];
const initialTickets: DemoTicket[] = [
  { id: "demo-ticket-1", ticketNumber: "DEMO-1", title: "عدم اتصال اینترنت در منطقه صادقیه", department: "شبکه و اتصال", updated: "۲ دقیقه پیش", status: "باز", priority: "فوری", archived: false, unreadCount: 1, messages: [{ id: 101, sender: "customer", body: "سلام، برای این مورد راهنمایی می‌خواهم. لطفاً وضعیت را بررسی کنید.", createdAt: "2026-08-26T10:00:00Z", time: "۱۳:۳۰" }, { id: 102, sender: "admin", body: "کارشناس پشتیبانی در حال بررسی درخواست شماست.", createdAt: "2026-08-26T10:02:00Z", time: "۱۳:۳۲" }] },
  { id: "demo-ticket-2", ticketNumber: "DEMO-2", title: "نیاز به فاکتور رسمی سفارش ۸۸۹۸", department: "فروش و مالی", updated: "۲ ساعت پیش", status: "در حال بررسی", priority: "عادی", archived: false, unreadCount: 1, messages: [{ id: 201, sender: "customer", body: "لطفاً نسخهٔ رسمی فاکتور سفارش را ارسال کنید.", createdAt: "2026-08-26T08:00:00Z", time: "۱۱:۳۰" }] },
  { id: "demo-ticket-3", ticketNumber: "DEMO-3", title: "پیگیری زمان تحویل مودم", department: "ارسال و تحویل", updated: "دیروز", status: "بسته شده", priority: "کم", archived: false, unreadCount: 0, messages: [{ id: 301, sender: "admin", body: "سفارش تحویل شرکت حمل شده است.", createdAt: "2026-08-25T09:00:00Z", time: "۱۲:۳۰" }] },
];
const initialUsers: DemoUser[] = [
  { id: 1, name: "علی محمدی", email: "admin@demo.local", phone: "۰۹۱۲۱۲۳۴۵۶۷", role: "مدیر ارشد", wallet: 12500000, active: true, joinDate: "۱۴۰۳/۰۸/۰۱", emailVerified: true, phoneVerified: true, hasPassword: true, addresses: [{ id: 101, title: "دفتر", recipient_name: "علی محمدی", phone: "۰۹۱۲۱۲۳۴۵۶۷", province: "تهران", city: "تهران", postal_code: "۱۴۳۸۷۶۴۳۲۱", address_line: "تهران، میدان ونک، خیابان ملاصدرا، پلاک ۱۲" }], ordersCount: 18, openTicketsCount: 0, lastOrderAt: "۱۴۰۵/۰۵/۲۸" },
  { id: 2, name: "سارا احمدی", email: "sara@example.com", phone: "۰۹۱۲۷۶۵۴۳۲۱", role: "مشتری", wallet: 0, active: true, joinDate: "۱۴۰۴/۰۲/۱۲", emailVerified: true, phoneVerified: true, hasPassword: true, addresses: [{ id: 201, title: "خانه", recipient_name: "سارا احمدی", phone: "۰۹۱۲۷۶۵۴۳۲۱", province: "تهران", city: "تهران", postal_code: "۱۴۷۸۹۵۴۳۲۱", address_line: "تهران، سعادت‌آباد، خیابان سرو غربی، کوچه سوم، پلاک ۸" }], ordersCount: 4, openTicketsCount: 1, lastOrderAt: "۱۴۰۵/۰۵/۲۴" },
  { id: 3, name: "محمد کریمی", email: "m.karimi@example.com", phone: "۰۹۳۵۱۲۳۴۵۶۷", role: "مشتری", wallet: 1200000, active: true, joinDate: "۱۴۰۳/۱۱/۰۸", emailVerified: true, phoneVerified: false, hasPassword: true, addresses: [{ id: 301, title: "خانه", recipient_name: "محمد کریمی", phone: "۰۹۳۵۱۲۳۴۵۶۷", province: "خراسان رضوی", city: "مشهد", postal_code: "۹۱۸۷۶۵۴۳۲۱", address_line: "مشهد، بلوار احمدآباد، خیابان بهار، پلاک ۳۴" }, { id: 302, title: "محل کار", recipient_name: "محمد کریمی", phone: "۰۹۳۵۱۲۳۴۵۶۷", province: "خراسان رضوی", city: "مشهد", postal_code: "۹۱۸۷۶۵۴۳۲۲", address_line: "مشهد، خیابان دانشگاه، مجتمع تجاری نوین، واحد ۱۴" }], ordersCount: 9, openTicketsCount: 2, lastOrderAt: "۱۴۰۵/۰۵/۲۶" },
  { id: 4, name: "پشتیبانی نوین‌نت", email: "support@demo.local", phone: "۰۲۱۸۸۸۸۸۸۸۸", role: "کارشناس", wallet: 0, active: true, joinDate: "۱۴۰۳/۰۹/۰۱", emailVerified: true, phoneVerified: true, hasPassword: true, addresses: [], ordersCount: 0, openTicketsCount: 0, lastOrderAt: null },
];
const initialServiceCategories: ServiceCategoryItem[] = [
  { id: 1, name: "خدمات خودرو", slug: "vehicle-services", description: "", is_active: true, sort_order: 10, services_count: 1 },
  { id: 2, name: "بیمه و استعلام", slug: "insurance-and-inquiry", description: "", is_active: true, sort_order: 20, services_count: 1 },
  { id: 3, name: "خدمات قضایی", slug: "legal-services", description: "", is_active: true, sort_order: 30, services_count: 1 },
  { id: 4, name: "خدمات عمومی", slug: "general-services", description: "", is_active: true, sort_order: 40, services_count: 0 },
];
const initialOnlineServices: DemoOnlineService[] = [
  { id: 1, title: "استعلام خلافی خودرو", slug: "vehicle-fines-inquiry", category: "خدمات خودرو", serviceCategoryId: 1, summary: "راهنمای مدارک و مراحل استعلام خلافی خودرو پیش از ارتباط با پشتیبانی.", body: "پیش از شروع، مدارک را آماده کنید. کارشناس پشتیبانی نوین‌نت پس از دریافت اطلاعات لازم، مسیر انجام خدمت را به شما اعلام می‌کند.", documents: ["کارت ملی مالک خودرو", "شماره پلاک خودرو", "شماره موبایل در دسترس"], steps: ["مدارک لازم را آماده کنید.", "از طریق تلگرام با پشتیبانی ارتباط بگیرید.", "اطلاعات خواسته‌شده را برای کارشناس ارسال کنید."], faq: [{ question: "آیا این خدمت آنلاین و خودکار است؟", answer: "خیر؛ این صفحه راهنماست و ادامه از طریق پشتیبانی انجام می‌شود." }], contactType: "تلگرام", contactUrl: "https://t.me/novinet_support", ctaLabel: "ادامه در تلگرام", status: "منتشرشده", updated: "امروز" },
  { id: 2, title: "راهنمای ثبت‌نام بیمه خودرو", slug: "car-insurance-guidance", category: "بیمه و استعلام", serviceCategoryId: 2, summary: "مدارک موردنیاز و مسیر ارتباط برای دریافت راهنمایی ثبت‌نام بیمه خودرو.", body: "شرایط بیمه با توجه به نوع خودرو و سابقهٔ بیمه متفاوت است. پیش از ارتباط، اطلاعات پایه را آماده داشته باشید.", documents: ["کارت خودرو", "بیمه‌نامهٔ قبلی در صورت وجود"], steps: ["اطلاعات خودرو را آماده کنید.", "با پشتیبانی تماس بگیرید."], faq: [], contactType: "شماره تماس", contactUrl: "tel:+982100000000", ctaLabel: "تماس با پشتیبانی", status: "پیش‌نویس", updated: "دیروز" },
  { id: 3, title: "راهنمای دریافت استعلام ثنا", slug: "sana-inquiry-guide", category: "خدمات قضایی", serviceCategoryId: 3, summary: "مراحل و مدارک لازم برای دریافت راهنمایی استعلام سامانهٔ ثنا.", body: "این خدمت فقط مسیر راهنمایی و ارتباط را ارائه می‌کند و هیچ اطلاعات قضایی در سایت دریافت یا ذخیره نمی‌شود.", documents: ["کد ملی", "شماره موبایل مالک"], steps: ["مدارک را آماده کنید.", "از طریق مسیر اعلام‌شده با پشتیبانی ارتباط بگیرید."], faq: [{ question: "آیا اطلاعات ثنا در سایت وارد می‌شود؟", answer: "خیر؛ این صفحه هیچ فرم دریافت اطلاعات حساس ندارد." }], contactType: "تلگرام", contactUrl: "https://t.me/novinet_support", ctaLabel: "دریافت راهنمایی", status: "منتشرشده", updated: "۳ روز پیش" },
];
const menuItems: Array<{ id: Tab; label: string; icon: typeof Home }> = [
  { id: "dashboard", label: "پیشخوان", icon: Home }, { id: "orders", label: "سفارش‌ها", icon: ClipboardList }, { id: "products", label: "کالا و موجودی", icon: Package }, { id: "categories", label: "دسته‌بندی‌ها", icon: FolderTree }, { id: "discounts", label: "تخفیف‌ها", icon: Tag }, { id: "campaigns", label: "کمپین‌های خودکار", icon: Megaphone }, { id: "services", label: "خدمات آنلاین", icon: FileText }, { id: "blog", label: "وبلاگ و مقالات", icon: FilePenLine }, { id: "site", label: "سایت", icon: Store }, { id: "tickets", label: "تیکت‌ها", icon: MessageSquare }, { id: "users", label: "مشتریان", icon: Users }, { id: "settings", label: "تنظیمات", icon: Settings },
];
const orderStatuses: OrderStatus[] = ["نیازمند تایید", "آماده‌سازی", "ارسال شده", "تحویل شده", "لغو شده"];
const money = (amount: number | undefined | null) => `${(Number.isFinite(amount) ? amount! : 0).toLocaleString("fa-IR")} تومان`;
const toneOf = (label: string): Tone => label.includes("تایید") ? "amber" : label.includes("آماده") ? "blue" : label.includes("ارسال") ? "purple" : label.includes("تحویل") || label === "فعال" || label === "باز" ? "green" : label.includes("لغو") || label === "غیرفعال" ? "rose" : "slate";
const buildSku = (category: string, name: string) => { const prefix = category.includes("لپ‌تاپ") ? "LPT" : category.includes("مودم") ? "MDM" : category.includes("سیم‌کارت") ? "SIM" : category.includes("خدمات") ? "SRV" : "PRD"; const source = `${category}|${name}`.trim() || "new-product"; const hash = Array.from(source).reduce((total, character) => ((total * 31) + character.codePointAt(0)!) >>> 0, 7); return `NVT-${prefix}-${hash.toString(36).toUpperCase().padStart(5, "0")}`; };
const MAX_COLORS = 12; const MAX_VARIANT_OPTIONS = 2; const MAX_VARIANTS = 24; const MAX_GALLERY_IMAGES = 12;
const cleanText = (value: string) => value.trim().replace(/\s+/g, " ");
const categoryFamily = (value: string) => {
  const name = cleanText(value).toLocaleLowerCase('fa-IR');
  if (/(لپ[‌\s-]*تاپ|کامپیوتر|نوت[‌\s-]*بوک|اولترابوک)/.test(name)) return 'laptop';
  if (/(موبایل|گوشی)/.test(name)) return 'mobile';
  if (/(مودم|شبکه|روتر)/.test(name)) return 'network';
  if (/(سیم[‌\s-]*کارت)/.test(name)) return 'sim';
  return name;
};
const nonNegativeInteger = (value: number) => Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
const parseLocalizedNumber = (value: string) => { const fa = "۰۱۲۳۴۵۶۷۸۹"; const ar = "٠١٢٣٤٥٦٧٨٩"; const latin = value.replace(/[۰-۹]/g, (digit) => String(fa.indexOf(digit))).replace(/[٠-٩]/g, (digit) => String(ar.indexOf(digit))).replace(/[٬,\s]/g, ""); return Number(latin); };
const canonicalKey = (value: string) => cleanText(value).toLocaleLowerCase('fa-IR');
const canonicalOptions = (options: ProductOption[]) => options.reduce<ProductOption[]>((unique, option) => {
  const id = cleanText(option.id); const name = cleanText(option.name);
  const values = option.values.map(cleanText).filter(Boolean).filter((value, index, list) => list.findIndex((item) => canonicalKey(item) === canonicalKey(value)) === index);
  return id && name && values.length && !unique.some((item) => item.id === id) ? [...unique, { id, name, values }] : unique;
}, []).slice(0, MAX_VARIANT_OPTIONS);
const variantSelectionKey = (color: string, optionValues: Record<string, string> = {}) => [canonicalKey(color), ...Object.entries(optionValues).sort(([left], [right]) => left.localeCompare(right)).map(([key, value]) => `${key}:${canonicalKey(value)}`)].join("|");
const variantId = (color: string, optionValues: Record<string, string> = {}) => `v:${encodeURIComponent(variantSelectionKey(color, optionValues))}`;
const variantLabel = (variant: ProductVariant, options: ProductOption[]) => [cleanText(variant.color), ...options.map((option) => cleanText(variant.optionValues?.[option.id] ?? "")).filter(Boolean)].filter(Boolean).join(" · ") || "پیکربندی پیش‌فرض";
const optionCombinations = (options: ProductOption[]) => options.reduce<Record<string, string>[]>((combinations, option) => combinations.flatMap((combination) => option.values.map((value) => ({ ...combination, [option.id]: value }))), [{}]);
const projectedVariantCount = (colors: ProductColor[], options: ProductOption[]) => {
  const canonical = canonicalOptions(options);
  if (options.some((option) => !option.values.length)) return 0;
  if (!colors.length && !canonical.length) return 0;
  return (colors.length || 1) * (canonical.length ? canonical.reduce((total, option) => total * option.values.length, 1) : 1);
};
const synchronizeVariantCombinations = (colors: ProductColor[], options: ProductOption[], current: ProductVariant[], price: number): ProductVariant[] => {
  const canonicalColors = colors.reduce<ProductColor[]>((unique, color) => {
    const name = cleanText(color.name);
    return name && !unique.some((item) => canonicalKey(item.name) === canonicalKey(name)) ? [...unique, { ...color, name }] : unique;
  }, []).slice(0, MAX_COLORS);
  const canonicalVariantOptions = canonicalOptions(options);
  const variantsBySelection = new Map<string, ProductVariant>();
  for (const variant of current) {
    const color = cleanText(variant.color);
    const optionValues = Object.fromEntries(canonicalVariantOptions.map((option) => [option.id, cleanText(variant.optionValues?.[option.id] ?? "")]).filter(([, value]) => Boolean(value)));
    const key = variantSelectionKey(color, optionValues);
    if ((color || Object.keys(optionValues).length) && !variantsBySelection.has(key)) variantsBySelection.set(key, { ...variant, color, optionValues });
  }
  const colorValues = canonicalColors.length ? canonicalColors.map((color) => color.name) : [""];
  const combinations = canonicalVariantOptions.length ? optionCombinations(canonicalVariantOptions) : [{}];
  if (!canonicalColors.length && !canonicalVariantOptions.length) return [];
  const claimedVariantIds = new Set<string>();
  return colorValues.flatMap((color) => combinations.map((optionValues) => ({ color, optionValues }))).slice(0, MAX_VARIANTS).map(({ color, optionValues }) => {
    const exactVariant = variantsBySelection.get(variantSelectionKey(color, optionValues));
    const currentVariant = exactVariant && !claimedVariantIds.has(exactVariant.id)
      ? exactVariant
      : current.find((variant) => !claimedVariantIds.has(variant.id) && canonicalKey(variant.color) === canonicalKey(color));
    if (currentVariant) claimedVariantIds.add(currentVariant.id);
    return currentVariant
      ? { ...currentVariant, color, optionValues, price: nonNegativeInteger(currentVariant.price), stock: nonNegativeInteger(currentVariant.stock) }
      : { id: variantId(color, optionValues), color, optionValues, price: nonNegativeInteger(price), stock: 0 };
  });
};
const inferredOptionsFromVariants = (variants: ProductVariant[]): ProductOption[] => Object.entries(variants.reduce<Record<string, string[]>>((result, variant) => {
  Object.entries(variant.optionValues ?? {}).forEach(([key, value]) => { if (value && !result[key]?.includes(value)) result[key] = [...(result[key] ?? []), value]; });
  return result;
}, {})).map(([id, values]) => ({ id, name: id, values }));
const pruneVariants = (colors: ProductColor[], current: ProductVariant[]) => synchronizeVariantCombinations(colors, inferredOptionsFromVariants(current), current, 0);
const normalizeProductForSave = (form: ProductForm, sku: string): DemoProduct => { const colors = form.colors.reduce<ProductColor[]>((list, color) => { const name = cleanText(color.name); return name && !list.some((item) => canonicalKey(item.name) === canonicalKey(name)) ? [...list, { name, hex: color.hex }] : list; }, []).slice(0, MAX_COLORS); const options = canonicalOptions(form.options); const variants = synchronizeVariantCombinations(colors, options, form.variants, form.price); const gallery = Array.from(new Set(form.gallery.filter(Boolean))).slice(0, MAX_GALLERY_IMAGES); const image = gallery.includes(form.image) ? form.image : gallery[0] ?? productImages[0]; const price = variants.length ? Math.min(...variants.map((variant) => variant.price)) : nonNegativeInteger(form.price); const stock = variants.length ? variants.reduce((total, variant) => total + variant.stock, 0) : nonNegativeInteger(form.stock); return { ...form, name: cleanText(form.name), sku: cleanText(sku).toUpperCase(), category: cleanText(form.category), price, stock, sold: nonNegativeInteger(form.sold), image, gallery: gallery.length ? gallery : [image], colors, options, variants }; };

const mapCouponToDemoDiscount = (c: any): DemoDiscount => {
  const isPercent = c.discount_type === "percentage" || c.type === "percentage";
  const val = Number(c.discount_value ?? c.value ?? 0);
  const amountStr = isPercent ? `${val}٪` : `${Math.round(val / 10).toLocaleString("fa-IR")} تومان`;
  const usedCount = Number(c.usage_count ?? c.used_count ?? 0);
  const usageLimit = Number(c.usage_limit ?? 0);
  const used = `${(usedCount ?? 0).toLocaleString("fa-IR")} از ${(usageLimit ?? 0).toLocaleString("fa-IR")} بار`;
  const minOrderToman = Math.round(Number(c.min_order_amount || 0) / 10);
  return {
    id: Number(c.id),
    code: String(c.code),
    title: String(c.title || c.code),
    amount: amountStr,
    used,
    usedCount,
    usageLimit,
    minimumOrder: minOrderToman,
    startsAt: c.starts_at || "همین حالا",
    endsAt: c.expires_at || "بدون تاریخ",
    expires: c.expires_at ? `تا ${c.expires_at}` : "بدون تاریخ",
    active: Boolean(c.is_active),
  };
};

const parseDiscountAmountInput = (amountStr: string): { type: "percentage" | "fixed"; value: number } => {
  const isPercent = amountStr.includes("%") || amountStr.includes("٪");
  const num = parseLocalizedNumber(amountStr);
  if (isPercent) {
    return { type: "percentage", value: Math.min(100, Math.max(1, num)) };
  }
  return { type: "fixed", value: num > 0 && num < 1000000000 ? num * 10 : num };
};

export function StagingAdminReplica({ liveData, demoProducts, demoProductOperations, contentManagement, homepageManagement, blogManagement, checkoutManagement, smsManagement }: { liveData?: AdminReplicaLiveData; demoProducts?: DemoProduct[]; demoProductOperations?: DemoProductOperations; contentManagement: ContentManagementBindings; homepageManagement: HomepageManagementBindings; blogManagement?: BlogManagement; checkoutManagement?: CheckoutManagementBindings; smsManagement?: SmsManagementBindings }) {
  const params = new URLSearchParams(window.location.search);
  const operations = liveData?.operations;
  const readOnly = Boolean(liveData && !operations);
  const readOnlyNotice = "داده‌های واقعی به‌صورت خواندنی نمایش داده می‌شوند؛ اتصال ثبت و ویرایش در مرحلهٔ بعد فعال می‌شود.";
  const [tab, setTab] = useState<Tab>(() => menuItems.some((item) => item.id === params.get("tab")) ? params.get("tab") as Tab : "dashboard");
  const [operationalFocus, setOperationalFocus] = useState<OperationalFocus>(() => ["orders-pending", "tickets-open", "products-low", "discounts-active"].includes(params.get("focus") ?? "") ? params.get("focus") as OperationalFocus : null);
  const [orders, setOrders] = useState<DemoOrder[]>(() => liveData?.orders ?? initialOrders);
  const [products, setProducts] = useState<DemoProduct[]>(() => liveData?.products ?? demoProducts ?? initialProducts);
  const [categories, setCategories] = useState<DemoCategory[]>(() => liveData?.categories ?? initialCategories);
  const [discounts, setDiscounts] = useState(initialDiscounts);
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [tickets, setTickets] = useState<DemoTicket[]>(() => liveData?.tickets ?? initialTickets);
  const [users, setUsers] = useState<DemoUser[]>(() => liveData?.users ?? initialUsers);
  const [onlineServices, setOnlineServices] = useState<DemoOnlineService[]>(() => liveData ? [] : initialOnlineServices);
  const [serviceCategories, setServiceCategories] = useState<ServiceCategoryItem[]>(() => liveData ? [] : initialServiceCategories);
  const [onlineServicesLoading, setOnlineServicesLoading] = useState(Boolean(liveData));
  const [demoCheckoutConfiguration, setDemoCheckoutConfiguration] = useState<CheckoutConfiguration>(initialCheckoutConfiguration);
  const [demoSmsSystemConfiguration, setDemoSmsSystemConfiguration] = useState<SmsSystemConfiguration>(initialSmsSystemConfiguration);
  const [query, setQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<DemoOrder | null>(null);
  const [editingProduct, setEditingProduct] = useState<DemoProduct | null | "new">(null);
  const [editingCategory, setEditingCategory] = useState<DemoCategory | null | "new">(null);
  const [editingCategoryAttributes, setEditingCategoryAttributes] = useState<DemoCategory | null>(null);
  const [editingDiscount, setEditingDiscount] = useState<DemoDiscount | null | "new">(null);
  const [editingCampaign, setEditingCampaign] = useState<DemoCampaign | null | "new">(null);
  const [editingUser, setEditingUser] = useState<DemoUser | null>(null);
  const [editingOnlineService, setEditingOnlineService] = useState<DemoOnlineService | "new" | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [toast, setToast] = useState("");
  const [managedDemoProductAttributeDefinitions, setManagedDemoProductAttributeDefinitions] = useState<AdminProductAttributeDefinition[]>(demoProductAttributeDefinitions);
  const activeProductAttributeDefinitions = liveData?.productAttributeDefinitions?.length ? liveData.productAttributeDefinitions : managedDemoProductAttributeDefinitions;
  useEffect(() => { if (liveData) setOrders(liveData.orders); }, [liveData]);
  useEffect(() => { if (liveData) setProducts(liveData.products); }, [liveData]);
  useEffect(() => { if (!liveData && demoProducts) setProducts(demoProducts); }, [demoProducts, liveData]);
  useEffect(() => { if (liveData) setCategories(liveData.categories); }, [liveData]);
  useEffect(() => { if (liveData) setTickets(liveData.tickets); }, [liveData]);
  useEffect(() => { if (liveData) setUsers(liveData.users); }, [liveData]);
  useEffect(() => {
    if (!liveData) return;
    let active = true;
    void api.getAdminDiscounts()
      .then((realCoupons) => {
        if (!active || !Array.isArray(realCoupons)) return;
        setDiscounts(realCoupons.map(mapCouponToDemoDiscount));
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [liveData]);
  useEffect(() => {
    if (!liveData) return;
    let active = true;
    setOnlineServicesLoading(true);
    void Promise.allSettled([api.getAdminOnlineServices(), api.getAdminServiceCategories()])
      .then(([servicesResult, categoriesResult]) => {
        if (!active) return;
        if (servicesResult.status === "fulfilled") setOnlineServices(servicesResult.value.map(fromServiceCatalog));
        else notify("بارگذاری خدمات آنلاین انجام نشد.");
        if (categoriesResult.status === "fulfilled") setServiceCategories(categoriesResult.value);
      })
      .finally(() => { if (active) setOnlineServicesLoading(false); });
    return () => { active = false; };
  }, [liveData]);
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 2600); };
  const chooseTab = (next: Tab, focus: OperationalFocus = null) => { setTab(next); setOperationalFocus(focus); setQuery(""); setMobileOpen(false); window.history.replaceState(null, "", `?tab=${next}${focus ? `&focus=${focus}` : ""}`); };
  const count = (id: Tab) => id === "orders" ? orders.filter((order) => order.status === "نیازمند تایید").length : id === "products" ? products.length : id === "tickets" ? tickets.filter((ticket) => ticket.status !== "بسته شده").length : 0;
  const openConfirm = (title: string, description: string, action: () => void) => setConfirm({ title, description, action });

  const content = editingProduct ? (
    <ProductEditorWorkspace
      product={editingProduct === "new" ? null : editingProduct}
      categories={categories}
      definitions={activeProductAttributeDefinitions}
      existingSkus={products.filter((row) => row.id !== (editingProduct === "new" ? 0 : editingProduct.id)).map((row) => row.sku)}
      onManageCategoryAttributes={(category) => setEditingCategoryAttributes(category)}
      liveMode={Boolean(operations)}
      onClose={() => setEditingProduct(null)}
      onSave={async (saved) => {
        const mode = editingProduct === "new" ? "create" : "update";
        if (operations) {
          await operations.saveProduct(saved, mode);
          setEditingProduct(null);
          return;
        }
        const persisted = demoProductOperations ? await demoProductOperations.saveProduct(saved, mode) : { ...saved, id: mode === "create" ? Date.now() : saved.id };
        setProducts((old) => mode === "create" ? [persisted, ...old] : old.map((row) => row.id === persisted.id ? persisted : row));
        setEditingProduct(null);
        notify(mode === "create" ? "کالا در فروشگاه ثبت شد." : "ویرایش کالا ذخیره شد.");
      }}
    />
  ) : tab === "dashboard" ? <Dashboard orders={orders} products={products} discounts={discounts} tickets={tickets} liveDashboard={liveData?.dashboard ?? null} dashboardLoading={liveData?.dashboardLoading ?? false} dashboardError={liveData?.dashboardError ?? false} operatorName={liveData?.userName} onTab={chooseTab} onOperational={chooseTab} />
    : tab === "orders" ? <OrdersPage rows={orders} query={query} setQuery={setQuery} initialFilter={operationalFocus === "orders-pending" ? "نیازمند تایید" : null} onOpen={setSelectedOrder} notify={notify} />
      : tab === "products" ? <ProductsPage rows={products} categories={categories} query={query} setQuery={setQuery} operationalFocus={operationalFocus} readOnly={readOnly} onNew={() => readOnly ? notify(readOnlyNotice) : setEditingProduct("new")} onEdit={(product) => readOnly ? notify(readOnlyNotice) : setEditingProduct(product)} onDelete={(product) => readOnly ? notify(readOnlyNotice) : operations ? openConfirm("حذف کالا", `کالای «${product.name}» از فروشگاه حذف می‌شود. این عمل قابل بازگشت نیست.`, () => operations.deleteProduct(product.id)) : openConfirm("حذف کالا", `«${product.name}» فقط از دادهٔ demo حذف می‌شود.`, () => { demoProductOperations?.deleteProduct(product.id); setProducts((old) => old.filter((row) => row.id !== product.id)); notify("کالا از دادهٔ نمایشی حذف شد."); })} onToggleFeatured={(id) => readOnly ? notify(readOnlyNotice) : operations ? operations.toggleProductFeatured(id) : (demoProductOperations?.toggleProductFeatured(id), setProducts((old) => old.map((row) => row.id === id ? { ...row, featured: !row.featured } : row)))} onToggleActive={(id) => readOnly ? notify(readOnlyNotice) : operations ? operations.toggleProductActive(id) : (demoProductOperations?.toggleProductActive(id), setProducts((old) => old.map((row) => row.id === id ? { ...row, active: !row.active } : row)))} />
      : tab === "categories" ? <CategoriesPage rows={categories} query={query} setQuery={setQuery} readOnly={readOnly} onNew={() => readOnly ? notify(readOnlyNotice) : setEditingCategory("new")} onEdit={(category) => readOnly ? notify(readOnlyNotice) : setEditingCategory(category)} onManageAttributes={(category) => readOnly ? notify(readOnlyNotice) : setEditingCategoryAttributes(category)} onToggleActive={(id) => { const category = categories.find((item) => item.id === id); if (readOnly) notify(readOnlyNotice); else if (category && operations) operations.toggleCategoryActive(id, !category.active); else setCategories((old) => old.map((row) => row.id === id ? { ...row, active: !row.active } : row)); }} onDelete={(category) => readOnly ? notify(readOnlyNotice) : operations ? openConfirm("حذف دسته", `دستهٔ «${category.name}» از فروشگاه حذف می‌شود. ابتدا مطمئن شوید کالایی به آن وابسته نیست.`, () => operations.deleteCategory(category.id)) : openConfirm("حذف دسته", `«${category.name}» فقط از دادهٔ demo حذف می‌شود.`, () => { setCategories((old) => old.filter((row) => row.id !== category.id)); notify("دسته از دادهٔ نمایشی حذف شد."); })} />
          : tab === "discounts" ? <DiscountsPage rows={discounts} query={query} setQuery={setQuery} operationalFocus={operationalFocus} onNew={() => setEditingDiscount("new")} onEdit={setEditingDiscount} onToggle={async (id) => {
            if (liveData) {
              try {
                await api.toggleAdminDiscount(id);
                setDiscounts((old) => old.map((row) => row.id === id ? { ...row, active: !row.active } : row));
                notify("وضعیت کد تخفیف با موفقیت تغییر کرد.");
              } catch (err: any) {
                notify(err.message || "خطا در تغییر وضعیت کد تخفیف");
              }
            } else {
              setDiscounts((old) => old.map((row) => row.id === id ? { ...row, active: !row.active } : row));
            }
          }} onDelete={(discount) => openConfirm("حذف کد تخفیف", `کد «${discount.code}» از پایگاه داده حذف می‌شود.`, async () => {
            if (liveData) {
              try {
                await api.deleteAdminDiscount(discount.id);
                setDiscounts((old) => old.filter((row) => row.id !== discount.id));
                notify(`کد تخفیف ${discount.code} حذف شد.`);
              } catch (err: any) {
                notify(err.message || "خطا در حذف کد تخفیف");
              }
            } else {
              setDiscounts((old) => old.filter((row) => row.id !== discount.id));
              notify("کد تخفیف حذف شد.");
            }
          })} onCopy={async (code) => { await navigator.clipboard?.writeText(code).catch(() => undefined); notify(`کد ${code} کپی شد.`); }} />
            : tab === "campaigns" ? <CampaignsPage rows={campaigns} query={query} setQuery={setQuery} onNew={() => setEditingCampaign("new")} onEdit={setEditingCampaign} onToggle={(id) => setCampaigns((old) => old.map((row) => row.id === id ? { ...row, active: !row.active } : row))} onPreview={(campaign) => notify(`پیش‌نمایش «${campaign.name}» در demo آماده است؛ هیچ پیامکی ارسال نمی‌شود.`)} onDelete={(campaign) => openConfirm("حذف کمپین", `«${campaign.name}» فقط از دادهٔ demo حذف می‌شود.`, () => { setCampaigns((old) => old.filter((row) => row.id !== campaign.id)); notify("کمپین demo حذف شد."); })} />
              : tab === "tickets" ? <TicketsPage rows={tickets} operationalFocus={operationalFocus} onChange={setTickets} notify={notify} liveMode={Boolean(liveData)} onReply={operations?.replyTicket} onUpdateStatus={operations ? (ticketId, status) => operations.updateTicketStatus(ticketId, ticketStatusToApi[status]) : undefined} onMarkRead={operations?.markTicketRead} onArchive={operations?.archiveTicket} onRestore={operations?.restoreTicket} onPermanentDelete={operations?.deleteTicket} onRequestConfirm={openConfirm} onDelete={(ids) => { if (liveData) { notify("حذف تیکت در پنل عملیاتی غیرفعال است."); return; } const targets = tickets.filter((ticket) => ids.includes(ticket.id)); if (!targets.length) return; const isBulk = targets.length > 1; openConfirm(isBulk ? "حذف گروهی تیکت‌ها" : "حذف تیکت", isBulk ? `${targets.length.toLocaleString("fa-IR")} تیکت انتخاب‌شده فقط از دادهٔ demo حذف می‌شود.` : `«${targets[0].title}» فقط از دادهٔ demo حذف می‌شود.`, () => { setTickets((old) => old.filter((ticket) => !ids.includes(ticket.id))); notify(isBulk ? `${targets.length.toLocaleString("fa-IR")} تیکت نمایشی حذف شد.` : "تیکت نمایشی حذف شد."); }); }} />
                : tab === "service-categories" ? <OnlineServiceCategoriesPage rows={serviceCategories} onBack={() => chooseTab("services")} onSave={async (category, draft) => { if (liveData) { const saved = category ? await api.updateAdminServiceCategory(category.id, draft) : await api.createAdminServiceCategory(draft); setServiceCategories((old) => category ? old.map((row) => row.id === saved.id ? saved : row) : [...old, saved].sort((left, right) => left.sort_order - right.sort_order)); if (category) { const refreshed = await api.getAdminOnlineServices(); setOnlineServices(refreshed.map(fromServiceCatalog)); } notify(category ? "دستهٔ خدمات ویرایش شد." : "دستهٔ خدمات ایجاد شد."); return; } const saved: ServiceCategoryItem = category ? { ...category, ...draft } : { ...draft, id: Date.now(), services_count: 0 }; setServiceCategories((old) => category ? old.map((row) => row.id === saved.id ? saved : row) : [...old, saved].sort((left, right) => left.sort_order - right.sort_order)); notify(category ? "دستهٔ خدمات در دادهٔ نمایشی ویرایش شد." : "دستهٔ خدمات در دادهٔ نمایشی ایجاد شد."); }} onDelete={(category) => openConfirm("حذف دستهٔ خدمات", `دستهٔ «${category.name}» حذف می‌شود. این کار فقط برای دستهٔ بدون خدمت مجاز است.`, () => { if (liveData) { void api.deleteAdminServiceCategory(category.id).then(() => { setServiceCategories((old) => old.filter((row) => row.id !== category.id)); notify("دستهٔ خدمات حذف شد."); }).catch((error) => notify(error instanceof Error ? error.message : "حذف دسته انجام نشد.")); return; } setServiceCategories((old) => old.filter((row) => row.id !== category.id)); notify("دستهٔ خدمات از دادهٔ نمایشی حذف شد."); })} />
                : tab === "services" ? <OnlineServicesPage rows={onlineServices} categories={serviceCategories} query={query} setQuery={setQuery} loading={onlineServicesLoading} onManageCategories={() => chooseTab("service-categories")} onNew={() => setEditingOnlineService("new")} onEdit={setEditingOnlineService} onDelete={(service) => openConfirm("حذف خدمت آنلاین", `صفحهٔ «${service.title}» حذف می‌شود. اگر برای آن درخواست ثبت شده باشد، به‌جای حذف آن را پیش‌نویس کنید.`, () => { if (liveData) { void api.deleteAdminOnlineService(service.id).then(() => { setOnlineServices((old) => old.filter((row) => row.id !== service.id)); notify("خدمت آنلاین حذف شد."); }).catch((error) => notify(error instanceof Error ? error.message : "حذف خدمت انجام نشد.")); return; } setOnlineServices((old) => old.filter((row) => row.id !== service.id)); notify("خدمت از دادهٔ نمایشی حذف شد."); })} />
                : tab === "blog" ? (blogManagement ? <BlogManagementPage posts={blogManagement.posts} liveMode={Boolean(liveData)} onCreate={blogManagement.create} onUpdate={blogManagement.update} onDelete={blogManagement.remove} notify={notify} /> : <Empty />)
                : tab === "site" ? <ContentManagementPage value={contentManagement.value} homepageValue={homepageManagement.value} liveMode={Boolean(liveData)} onSave={contentManagement.save} onSaveHomepage={homepageManagement.save} notify={notify} />
	                : tab === "users" ? <UsersPage rows={users} query={query} setQuery={setQuery} onEdit={setEditingUser} />
	                  : <SettingsWorkspace value={checkoutManagement?.value ?? demoCheckoutConfiguration} liveMode={Boolean(liveData)} onSave={async (next) => { if (checkoutManagement) { await checkoutManagement.save(next); return; } setDemoCheckoutConfiguration(next); }} smsManagement={smsManagement ?? { value: demoSmsSystemConfiguration, save: async (next) => { setDemoSmsSystemConfiguration(next); }, testConnection: async () => ({ remaining_credit: 50000, expires_at: null, account_type: 'Preview' }) }} notify={notify} />;

  return <div className={`app-shell ${liveData ? "live-data" : ""} ${readOnly ? "read-only-data" : ""}`} dir="rtl">
    <Sidebar tab={tab} chooseTab={chooseTab} counts={{ orders: count("orders"), products: count("products"), tickets: count("tickets") }} mobileOpen={mobileOpen} close={() => setMobileOpen(false)} source={liveData?.source} />
    {mobileOpen && <button className="sidebar-overlay" aria-label="بستن منو" onClick={() => setMobileOpen(false)} />}
    <div className="workspace"><Header onMenu={() => setMobileOpen(true)} onManage={() => { chooseTab("users"); notify(readOnly ? readOnlyNotice : "مدیریت حساب نمایشی باز شد."); }} onSettings={() => chooseTab("settings")} onLogout={() => { window.location.assign("/"); }} userName={liveData?.userName} userRole={liveData?.userRole} source={liveData?.source} /><main className="workspace-main">{content}</main><MobileNav tab={tab} chooseTab={chooseTab} counts={{ orders: count("orders"), products: count("products"), tickets: count("tickets") }} /></div>
    {toast && <div className="toast" role="status">{toast}</div>}
    {selectedOrder && <OrderDrawer order={selectedOrder} liveMode={Boolean(operations)} onClose={() => setSelectedOrder(null)} onSave={(saved) => { if (readOnly) { setSelectedOrder(null); notify(readOnlyNotice); return; } if (operations) { operations.saveOrder(saved); setSelectedOrder(null); return; } setOrders((old) => old.map((row) => row.id === saved.id ? saved : row)); setSelectedOrder(null); notify("وضعیت سفارش در دادهٔ نمایشی ذخیره شد."); }} />}

    {editingCategory && <CategoryEditor category={editingCategory === "new" ? null : editingCategory} categories={categories} liveMode={Boolean(operations)} onClose={() => setEditingCategory(null)} onSave={(saved) => { if (operations) { operations.saveCategory(saved, editingCategory === "new" ? "create" : "update"); setEditingCategory(null); return; } setCategories((old) => editingCategory === "new" ? [{ ...saved, id: Date.now(), products: 0 }, ...old] : old.map((row) => row.id === saved.id ? saved : row)); setEditingCategory(null); notify(editingCategory === "new" ? "دسته در دادهٔ نمایشی ایجاد شد." : "ویرایش دسته ذخیره شد."); }} />}
    {editingCategoryAttributes && <CategoryAttributeEditor category={editingCategoryAttributes} definitions={activeProductAttributeDefinitions} liveMode={Boolean(operations)} onClose={() => setEditingCategoryAttributes(null)} onSave={async (drafts) => { if (operations) { await operations.saveCategoryProductAttributes(editingCategoryAttributes.id, drafts); notify("ویژگی‌های دسته و گزینه‌های انتخابی ذخیره شد."); setEditingCategoryAttributes(null); return; } setManagedDemoProductAttributeDefinitions((current) => { const attachedIds = new Set(drafts.map((draft) => draft.id).filter((id): id is number => Boolean(id))); const updated = current.map((definition) => { const draft = drafts.find((item) => item.id === definition.id); if (draft) { return { ...definition, key: draft.key, name: draft.name, dataType: draft.dataType, unit: draft.unit || undefined, options: draft.options, isFilterable: draft.isFilterable, isRequired: draft.isRequired, categoryIds: Array.from(new Set([...definition.categoryIds, editingCategoryAttributes.id])), categoryConfigs: { ...(definition.categoryConfigs ?? {}), [editingCategoryAttributes.id]: { isFilterable: draft.isFilterable, isRequired: draft.isRequired, inheritToChildren: draft.inheritToChildren, sortOrder: draft.sortOrder } } }; } return attachedIds.has(definition.id) ? definition : { ...definition, categoryIds: definition.categoryIds.filter((id) => id !== editingCategoryAttributes.id) }; }); const created = drafts.filter((draft) => !draft.id).map((draft, index) => ({ id: Date.now() + index, key: draft.key, name: draft.name, dataType: draft.dataType, unit: draft.unit || undefined, options: draft.options, categoryIds: [editingCategoryAttributes.id], isFilterable: draft.isFilterable, isRequired: draft.isRequired, isActive: true, sortOrder: draft.sortOrder, categoryConfigs: { [editingCategoryAttributes.id]: { isFilterable: draft.isFilterable, isRequired: draft.isRequired, inheritToChildren: draft.inheritToChildren, sortOrder: draft.sortOrder } } })); return [...updated, ...created]; }); notify("ویژگی‌های دسته در دادهٔ نمایشی ذخیره شد."); setEditingCategoryAttributes(null); }} />}
    {editingDiscount && <DiscountEditor discount={editingDiscount === "new" ? null : editingDiscount} onClose={() => setEditingDiscount(null)} onSave={async (saved) => {
      if (liveData) {
        try {
          const parsed = parseDiscountAmountInput(saved.amount);
          const payload = {
            code: saved.code,
            title: saved.title,
            discount_type: parsed.type,
            discount_value: parsed.value,
            usage_limit: saved.usageLimit,
            min_order_amount: (saved.minimumOrder || 0) * 10,
            is_active: saved.active,
          };
          if (editingDiscount === "new") {
            const created = await api.createAdminDiscount(payload);
            const couponData = created?.data || created;
            const mapped = mapCouponToDemoDiscount(couponData);
            setDiscounts((old) => [mapped, ...old]);
            notify("کد تخفیف جدید در پایگاه داده ایجاد شد.");
          } else {
            const updated = await api.updateAdminDiscount(saved.id, payload);
            const couponData = updated?.data || updated;
            const mapped = mapCouponToDemoDiscount(couponData);
            setDiscounts((old) => old.map((row) => row.id === saved.id ? mapped : row));
            notify("تغییرات کد تخفیف در پایگاه داده ذخیره شد.");
          }
          setEditingDiscount(null);
        } catch (err: any) {
          notify(err.message || "خطا در ذخیره کد تخفیف");
        }
      } else {
        setDiscounts((old) => editingDiscount === "new" ? [{ ...saved, id: Date.now() }, ...old] : old.map((row) => row.id === saved.id ? saved : row));
        setEditingDiscount(null);
        notify(editingDiscount === "new" ? "کد تخفیف ایجاد شد." : "ویرایش کد تخفیف ذخیره شد.");
      }
    }} />}
    {editingCampaign && <CampaignEditor campaign={editingCampaign === "new" ? null : editingCampaign} onClose={() => setEditingCampaign(null)} onSave={(saved) => { setCampaigns((old) => editingCampaign === "new" ? [{ ...saved, id: Date.now() }, ...old] : old.map((row) => row.id === saved.id ? saved : row)); setEditingCampaign(null); notify(editingCampaign === "new" ? "کمپین demo ایجاد شد." : "تنظیمات کمپین ذخیره شد."); }} />}
    {editingUser && <UserEditor user={editingUser} liveMode={Boolean(operations)} onClose={() => setEditingUser(null)} onSave={async (saved) => { if (operations) { await operations.saveUser(saved); setEditingUser(null); notify("تغییرات مشتری در API ذخیره شد."); return; } setUsers((old) => old.map((row) => row.id === saved.id ? saved : row)); setEditingUser(null); notify("اطلاعات کاربر در دادهٔ نمایشی ذخیره شد."); }} />}
    {editingOnlineService && <OnlineServiceEditor service={editingOnlineService === "new" ? null : editingOnlineService} categories={serviceCategories} existingSlugs={onlineServices.filter((row) => row.id !== (editingOnlineService === "new" ? 0 : editingOnlineService.id)).map((row) => row.slug)} onClose={() => setEditingOnlineService(null)} onSave={async (saved) => { const published = saved.status === "منتشرشده"; if (liveData) { const catalog = editingOnlineService === "new" ? await api.createAdminOnlineService(toServiceCatalogPayload(saved)) : await api.updateAdminOnlineService(saved.id, toServiceCatalogPayload(saved)); const next = fromServiceCatalog(catalog); setOnlineServices((old) => editingOnlineService === "new" ? [next, ...old] : old.map((row) => row.id === next.id ? next : row)); setEditingOnlineService(null); notify(published ? "خدمت منتشر شد و صفحهٔ اختصاصی آن آماده است." : "خدمت به‌صورت پیش‌نویس ذخیره شد."); return; } setOnlineServices((old) => editingOnlineService === "new" ? [{ ...saved, id: Date.now(), updated: "اکنون" }, ...old] : old.map((row) => row.id === saved.id ? { ...saved, updated: "اکنون" } : row)); setEditingOnlineService(null); notify(editingOnlineService === "new" ? (published ? "خدمت در محیط بازبینی منتشر شد." : "خدمت به‌صورت پیش‌نویس ذخیره شد.") : "ویرایش خدمت در محیط بازبینی ذخیره شد."); }} />}
    {confirm && <ConfirmDialog title={confirm.title} description={confirm.description} onCancel={() => setConfirm(null)} onConfirm={() => { confirm.action(); setConfirm(null); }} />}
  </div>;
}

function Brand() { return <div className="brand-lockup"><img src={logo} alt="نشان نوین‌نت" /><div><strong>نوین‌نت</strong><span>پنل مدیریت فروشگاه</span></div></div>; }
function Header({ onMenu, onManage, onSettings, onLogout, userName = "علی محمدی", userRole = "مدیر ارشد", source }: { onMenu: () => void; onManage: () => void; onSettings: () => void; onLogout: () => void; userName?: string; userRole?: string; source?: "live" }) {
  const [inboxOpen, setInboxOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [notifications, setNotifications] = useState(() => source === "live" ? [] : [{ id: 1, title: "دو سفارش نیازمند تأیید است", detail: "سفارش‌های ORD-2023-8901 و ORD-2023-8899", time: "۵ دقیقه پیش", read: false, tab: "orders" as Tab }, { id: 2, title: "موجودی یک کالا رو به اتمام است", detail: "ZenBook 14 OLED فقط ۶ عدد موجودی دارد.", time: "۲۵ دقیقه پیش", read: false, tab: "products" as Tab }, { id: 3, title: "تیکت پشتیبانی جدید", detail: "درخواست جدیدی در بخش شبکه و اتصال ثبت شده است.", time: "۱ ساعت پیش", read: true, tab: "tickets" as Tab }]);
  const unread = notifications.filter((item) => !item.read).length;
  const markRead = (id: number) => setNotifications((items) => items.map((item) => item.id === id ? { ...item, read: true } : item));
  const initial = userName.trim().slice(0, 1) || "ن";
  return <header className="global-header"><button className="mobile-menu" onClick={onMenu}><Menu /></button><div className="global-note"><img className="header-brand-mark" src={logo} alt="" /><span>پنل مدیریت</span><span className="demo-dot">{source === "live" ? "دادهٔ واقعی" : "DEMO"}</span></div><div className="header-actions"><div className="header-popover-wrap"><IconButton label="اعلان‌ها" onClick={() => { setInboxOpen((open) => !open); setAccountOpen(false); }}><Bell size={19} />{unread > 0 && <i>{unread.toLocaleString("fa-IR")}</i>}</IconButton>{inboxOpen && <section className="header-popover inbox-popover"><header><span><b>اعلان‌ها</b><small>{unread.toLocaleString("fa-IR")} خوانده‌نشده</small></span>{notifications.length > 0 && <button onClick={() => setNotifications([])}>خواندن و پاک‌کردن همه</button>}</header><div>{notifications.length ? notifications.map((item) => <button key={item.id} className={item.read ? "inbox-item" : "inbox-item unread"} onClick={() => markRead(item.id)}><span className="inbox-dot" /><span><b>{item.title}</b><small>{item.detail}</small><em>{item.time}</em></span></button>) : <p className="header-empty-note">فهرست اعلان‌ها خالی است.</p>}</div><footer>{source === "live" ? "این بخش هنوز فقط خواندنی است." : "اعلان‌ها فقط در محیط بازبینی هستند."}</footer></section>}</div><div className="header-popover-wrap"><button className="profile-chip" onClick={() => { setAccountOpen((open) => !open); setInboxOpen(false); }}><div className="profile-avatar">{initial}</div><span><b>{userName}</b><small>{userRole}</small></span><ChevronDown size={14} /></button>{accountOpen && <section className="header-popover account-popover"><div className="account-summary"><div className="profile-avatar">{initial}</div><span><b>{userName}</b><small>{userRole} · {source === "live" ? "دادهٔ واقعی" : "محیط بازبینی"}</small></span></div><button onClick={() => { setAccountOpen(false); onManage(); }}><UserRoundCog size={17} />مدیریت حساب</button><button onClick={() => { setAccountOpen(false); onSettings(); }}><Settings size={17} />تنظیمات پنل</button><button className="logout-action" onClick={onLogout}><LogOut size={17} />خروج از پنل</button></section>}</div></div></header>;
}
function Sidebar({ tab, chooseTab, counts, mobileOpen, close, source }: { tab: Tab; chooseTab: (next: Tab) => void; counts: Partial<Record<Tab, number>>; mobileOpen: boolean; close: () => void; source?: "live" }) { return <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}><div className="sidebar-brand"><Brand /><button className="mobile-close" onClick={close}><X /></button></div><p className="menu-caption">فضای کاری</p><nav>{menuItems.slice(0, 8).map((item) => <MenuItem key={item.id} item={item} active={tab === item.id} count={counts[item.id]} onClick={() => chooseTab(item.id)} />)}</nav><p className="menu-caption">مشتری و تنظیمات</p><nav>{menuItems.slice(8).map((item) => <MenuItem key={item.id} item={item} active={tab === item.id} count={counts[item.id]} onClick={() => chooseTab(item.id)} />)}</nav><div className="sidebar-footer"><span>{source === "live" ? "اتصال خواندنی" : "محیط بازبینی"}</span><b>{source === "live" ? "دادهٔ واقعی" : "دادهٔ نمایشی"}</b></div></aside>; }
function MenuItem({ item, active, count, onClick }: { key?: string; item: { id: Tab; label: string; icon: typeof Home }; active: boolean; count?: number; onClick: () => void }) { const Icon = item.icon; return <button className={`menu-item ${active ? "active" : ""}`} onClick={onClick}><Icon size={18} /><span>{item.label}</span>{typeof count === "number" && count > 0 && <em>{count.toLocaleString("fa-IR")}</em>}</button>; }
function MobileNav({ tab, chooseTab, counts }: { tab: Tab; chooseTab: (next: Tab) => void; counts: Partial<Record<Tab, number>> }) { return <nav className="mobile-nav">{menuItems.slice(0, 5).map((item) => { const Icon = item.icon; return <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => chooseTab(item.id)}><Icon size={19} /><span>{item.label.replace(" و موجودی", "")}</span>{counts[item.id] ? <i>{counts[item.id]}</i> : null}</button>; })}</nav>; }
function Status({ children }: { children: string }) { return <span className={`status status-${toneOf(children)}`}>{children}</span>; }
function IconButton({ label, children, onClick }: { label: string; children: ReactNode; onClick?: () => void }) { return <button className="icon-button" aria-label={label} title={label} onClick={onClick}>{children}</button>; }
function SectionHeader({ title, count, action, onAction }: { title: string; count?: string; action?: string; onAction?: () => void }) { return <header className="page-topbar"><div className="page-title-wrap"><h1>{title}</h1>{count && <span className="count-pill">{count}</span>}</div>{action && <button className="text-action" onClick={onAction}><Plus size={17} />{action}</button>}</header>; }
function ChoiceMenu({ value, options, onChange, label, disabled = false }: { value: string; options: string[]; onChange: (value: string) => void; label?: string; disabled?: boolean }) { const [open, setOpen] = useState(false); return <div className="choice-menu"><button type="button" aria-label={label} className="select-control" disabled={disabled} onClick={() => setOpen((old) => !old)}>{value}<ChevronDown size={16} /></button>{open && !disabled && <div className="choice-list">{options.map((option) => <button type="button" key={option} onClick={() => { onChange(option); setOpen(false); }} className={option === value ? "active" : ""}>{option}{option === value && <Check size={14} />}</button>)}</div>}</div>; }
function FlatToolbar({ selectLabel, options, selected, setSelected, query, setQuery }: { selectLabel: string; options: string[]; selected: string; setSelected: (value: string) => void; query: string; setQuery: (value: string) => void }) {
  const [filterOpen, setFilterOpen] = useState(false);
  return <><div className="app-toolbar"><label className="rail-search"><Search size={21} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="جستجو" /></label><div className="toolbar-icon-actions"><IconButton label={selectLabel} onClick={() => setFilterOpen((open) => !open)}><Filter size={20} /></IconButton><IconButton label="خروجی لیست" onClick={() => navigator.clipboard?.writeText("خروجی نمایشی نوین‌نت").catch(() => undefined)}><Download size={19} /></IconButton></div></div>{filterOpen && <div className="filter-drawer compact-filter"><span>{selectLabel}:</span>{options.map((option) => <button key={option} className={selected === option ? "active" : ""} onClick={() => { setSelected(option); setFilterOpen(false); }}>{option}</button>)}</div>}</>;
}

function Dashboard({ orders, products, discounts, tickets, liveDashboard, dashboardLoading, dashboardError, operatorName, onTab, onOperational }: { orders: DemoOrder[]; products: DemoProduct[]; discounts: DemoDiscount[]; tickets: DemoTicket[]; liveDashboard: AdminReplicaLiveData["dashboard"]; dashboardLoading: boolean; dashboardError: boolean; operatorName?: string; onTab: (tab: Tab) => void; onOperational: (tab: Tab, focus: OperationalFocus) => void }) {
  const [period, setPeriod] = useState<"هفته" | "ماه" | "سال">("هفته");
  const [report, setReport] = useState<"sales" | "retention" | "signups" | null>(null);
  const isLive = Boolean(operatorName);
  const demoData = { هفته: { labels: ["ش", "ی", "د", "س", "چ", "پ", "ج"], values: [18, 32, 24, 48, 39, 55, 64], total: "۲,۸۴۰,۰۰۰", change: "+۱۲٫۸٪", signups: "۳۲", retention: "۴۲٫۷٪" }, ماه: { labels: ["۱", "۵", "۱۰", "۱۵", "۲۰", "۲۵", "۳۰"], values: [25, 44, 35, 59, 53, 72, 66], total: "۱۲,۴۸۰,۰۰۰", change: "+۸٫۴٪", signups: "۱۲۸", retention: "۴۴٫۱٪" }, سال: { labels: ["فرو", "ارد", "خرد", "تیر", "مرد", "شه", "مهر"], values: [29, 38, 54, 45, 61, 75, 80], total: "۱۱۶,۷۰۰,۰۰۰", change: "+۲۳٫۱٪", signups: "۱,۸۴۰", retention: "۴۶٫۳٪" } }[period];
  const data = isLive ? { labels: demoData.labels, values: [0, 0, 0, 0, 0, 0, 0], total: liveDashboard ? money(liveDashboard.totalRevenue) : dashboardLoading ? "در حال بارگذاری" : "در دسترس نیست", change: "", signups: "", retention: "" } : demoData;
  const max = Math.max(1, ...data.values); const chartPoints = data.values.map((value, index) => `${(index / (data.values.length - 1)) * 100},${88 - (value / max) * 68}`).join(" ");
  const averageOrder = liveDashboard && liveDashboard.totalOrders > 0 ? Math.round(liveDashboard.totalRevenue / liveDashboard.totalOrders) : 0;
  const metrics: Array<[string, string, string, typeof Wallet, "sales" | "retention" | "signups"]> = isLive ? [["فروش ثبت‌شده", liveDashboard ? money(liveDashboard.totalRevenue) : "در حال بارگذاری", "aggregate فعلی", Wallet, "sales"], ["تعداد سفارش", `${(liveDashboard?.totalOrders ?? orders.length).toLocaleString("fa-IR")} سفارش`, "aggregate فعلی", ShoppingBag, "sales"], ["میانگین سفارش", liveDashboard ? money(averageOrder) : "در حال بارگذاری", "بر پایه aggregate", TrendingUp, "sales"], ["کاربران", `${(liveDashboard?.totalUsers ?? 0).toLocaleString("fa-IR")} حساب`, "aggregate فعلی", Users, "retention"], ["پرداخت در انتظار", `${(liveDashboard?.pendingPayments ?? 0).toLocaleString("fa-IR")} مورد`, "نیازمند رسیدگی", UserRoundCog, "signups"]] : [["فروش خالص", `${data.total} تومان`, data.change, Wallet, "sales"], ["تعداد سفارش", `${orders.length * (period === "هفته" ? 3 : period === "ماه" ? 13 : 168)} سفارش`, "+۶٫۲٪", ShoppingBag, "sales"], ["میانگین سفارش", "۴۶۵,۰۰۰ تومان", "+۲٫۴٪", TrendingUp, "sales"], ["نرخ مشتری بازگشتی", data.retention, "+۴٫۹٪", Users, "retention"], ["عضویت جدید", `${data.signups} عضو`, "+۱۰٫۶٪", UserRoundCog, "signups"]];
  const queues: Array<[string, string, typeof ClipboardList, Tab, string, OperationalFocus]> = isLive ? [["سفارش نیازمند اقدام", `${(liveDashboard?.pendingOrders ?? orders.filter((order) => order.status === "نیازمند تایید").length).toLocaleString("fa-IR")} مورد`, ClipboardList, "orders", "amber", "orders-pending"], ["موجودی کم", `${products.filter((product) => product.stock < 7).length.toLocaleString("fa-IR")} کالا`, Boxes, "products", "rose", "products-low"]] : [["سفارش نیازمند اقدام", `${orders.filter((order) => order.status === "نیازمند تایید").length} مورد`, ClipboardList, "orders", "amber", "orders-pending"], ["تیکت بدون پاسخ", `${tickets.filter((ticket) => ticket.status !== "بسته شده").length} مورد`, MessageSquare, "tickets", "blue", "tickets-open"], ["موجودی کم", `${products.filter((product) => product.stock < 7).length} کالا`, Boxes, "products", "rose", "products-low"], ["کد تخفیف فعال", `${discounts.filter((discount) => discount.active).length} مورد`, Tag, "discounts", "green", "discounts-active"]];
  const shortName = (name: string) => name.length > 34 ? `${name.slice(0, 34)}…` : name;
  return <section className="dashboard-workspace">
    <header className="dashboard-command"><div><span>پیشخوان عملیاتی</span><h1>سلام {operatorName || "علی"}، امروز فروشگاه در جریان است.</h1><small>{isLive ? dashboardError ? "دادهٔ فهرست‌ها واقعی است؛ aggregate پیشخوان موقتاً در دسترس نیست." : "کالاها، سفارش‌ها و aggregateهای نمایش‌داده‌شده از دادهٔ واقعی خوانده می‌شوند." : "داده‌ها در این محیط صرفاً نمایشی هستند."}</small></div>{!isLive && <div className="period-switcher">{(["هفته", "ماه", "سال"] as const).map((item) => <button key={item} className={period === item ? "active" : ""} onClick={() => setPeriod(item)}>{item}</button>)}</div>}</header>
    <section className="metric-grid">{metrics.map(([label, value, change, Icon, reportKind]) => <button key={label} className="metric-card" onClick={isLive ? undefined : () => setReport(reportKind)}><span className="metric-icon"><Icon size={19} /></span><div><small>{label}</small><b>{value}</b><em>{isLive ? change : `${change} نسبت به دوره قبل`}</em></div>{!isLive && <ChevronLeft size={16} />}</button>)}</section>
    <section className="analytics-grid"><article className="sales-panel"><header><div><span>{isLive ? "روند فروش" : "عملکرد فروش"}</span><b>{isLive ? data.total : `${data.total} تومان`}</b></div>{isLive ? <span className="trend-positive">گزارش دوره‌ای هنوز متصل نیست</span> : <span className="trend-positive"><TrendingUp size={15} />{data.change}</span>}</header><div className="chart-wrap"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label={`نمودار فروش ${period}`}><defs><linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2563eb" stopOpacity=".18" /><stop offset="100%" stopColor="#2563eb" stopOpacity="0" /></linearGradient></defs><path d={`M 0,100 L ${chartPoints.split(" ").join(" L ")} L 100,100 Z`} fill="url(#salesFill)" /><polyline points={chartPoints} fill="none" stroke="#2563eb" strokeWidth="2.4" vectorEffect="non-scaling-stroke" /></svg><div className="chart-labels">{data.labels.map((label) => <span key={label}>{label}</span>)}</div></div><footer><span><i />{isLive ? "برای نمودار واقعی، API گزارش دوره‌ای لازم است." : "روند فروش"}</span>{!isLive && <button onClick={() => setReport("sales")}>مشاهدهٔ گزارش <ChevronLeft size={14} /></button>}</footer></article><article className="action-panel"><header><span>نیازمند اقدام</span><button onClick={() => onTab("orders")}>مشاهده همه</button></header>{queues.map(([label, amount, Icon, target, tone, focus]) => <button key={label} className="action-row" onClick={() => onOperational(target, focus)}><span className={`action-icon ${tone}`}><Icon size={17} /></span><span><b>{label}</b><small>{amount}</small></span><ChevronLeft size={15} /></button>)}</article></section>
    <section className="dashboard-detail-grid"><article className="flat-panel dashboard-orders"><div className="panel-heading"><h2>آخرین سفارش‌ها</h2><button onClick={() => onTab("orders")}>همه سفارش‌ها <ChevronLeft size={15} /></button></div>{orders.slice(0, 4).map((order) => <button className="compact-row" key={order.id} onClick={() => onTab("orders")}><span><b>{order.number}</b><small>{order.customer} · {order.date}</small></span><span><strong>{money(order.amount)}</strong><Status>{order.status}</Status></span></button>)}</article><article className="flat-panel dashboard-stock"><div className="panel-heading"><h2>موجودی نیازمند بررسی</h2><button onClick={() => onTab("products")}>کالاها <ChevronLeft size={15} /></button></div>{products.filter((product) => product.stock < 15).slice(0, 4).map((product) => <button className="compact-row" key={product.id} onClick={() => onTab("products")}><span><b>{shortName(product.name)}</b><small>{product.sku}</small></span><span className={product.stock < 7 ? "stock-low" : "stock-ok"}>{product.stock} موجود</span></button>)}</article></section>
    {report && <DashboardReportDrawer kind={report} initialPeriod={period} onClose={() => setReport(null)} />}
  </section>;
}

function DashboardReportDrawer({ kind, initialPeriod, onClose }: { kind: "sales" | "retention" | "signups"; initialPeriod: "هفته" | "ماه" | "سال"; onClose: () => void }) {
  const [period, setPeriod] = useState(initialPeriod);
  const report = { sales: { title: "گزارش عملکرد فروش", subtitle: "جزئیات روند فروش و سفارش‌ها", icon: BarChart3, values: { هفته: ["۲,۸۴۰,۰۰۰ تومان", "+۱۲٫۸٪", "۱۵ سفارش"], ماه: ["۱۲,۴۸۰,۰۰۰ تومان", "+۸٫۴٪", "۶۵ سفارش"], سال: ["۱۱۶,۷۰۰,۰۰۰ تومان", "+۲۳٫۱٪", "۸۴۰ سفارش"] }, labels: ["فروش خالص", "نرخ رشد", "تعداد سفارش"] }, retention: { title: "گزارش وفاداری مشتری", subtitle: "تحلیل مشتریان بازگشتی و خرید تکراری", icon: Users, values: { هفته: ["۴۲٫۷٪", "۲۱ مشتری", "۱٫۸ سفارش"], ماه: ["۴۴٫۱٪", "۹۴ مشتری", "۲٫۱ سفارش"], سال: ["۴۶٫۳٪", "۱,۲۰۶ مشتری", "۲٫۴ سفارش"] }, labels: ["نرخ مشتری بازگشتی", "مشتری وفادار", "میانگین خرید تکراری"] }, signups: { title: "گزارش عضویت جدید", subtitle: "رشد پایگاه مشتری و تکمیل ثبت‌نام", icon: UserRoundCog, values: { هفته: ["۳۲ عضو", "۸۸٪", "+۱۰٫۶٪"], ماه: ["۱۲۸ عضو", "۹۱٪", "+۱۴٫۲٪"], سال: ["۱,۸۴۰ عضو", "۹۳٪", "+۲۶٫۵٪"] }, labels: ["عضویت جدید", "نرخ تکمیل", "رشد نسبت به دوره قبل"] } }[kind];
  const Icon = report.icon; const values = report.values[period];
  return <div className="drawer-backdrop report-backdrop" onClick={onClose}><aside className="report-drawer" onClick={(event) => event.stopPropagation()}><header><span className="report-icon"><Icon size={20} /></span><div><small>گزارش وضعیت</small><h2>{report.title}</h2><p>{report.subtitle} · دادهٔ demo</p></div><IconButton label="بستن گزارش" onClick={onClose}><X size={18} /></IconButton></header><div className="report-periods">{(["هفته", "ماه", "سال"] as const).map((item) => <button key={item} className={period === item ? "active" : ""} onClick={() => setPeriod(item)}>{item}</button>)}</div><section className="report-summary">{report.labels.map((label, index) => <div key={label}><small>{label}</small><b>{values[index]}</b></div>)}</section><section className="report-rows"><header><b>وضعیت دورهٔ {period}</b><span>به‌روزرسانی نمایشی</span></header>{["دورهٔ جاری", "دورهٔ قبل", "پیش‌بینی دورهٔ بعد"].map((label, index) => <div key={label}><span>{label}</span><strong>{index === 0 ? values[0] : index === 1 ? "در حال مقایسه" : "روند صعودی"}</strong></div>)}</section><footer><button onClick={onClose}>بستن</button><button className="primary" onClick={() => window.print()}>چاپ گزارش</button></footer></aside></div>;
}

function OrdersPage({ rows, query, setQuery, initialFilter, onOpen, notify }: { rows: DemoOrder[]; query: string; setQuery: (value: string) => void; initialFilter: OrderStatus | null; onOpen: (row: DemoOrder) => void; notify: (message: string) => void }) {
  const [filterOpen, setFilterOpen] = useState(false);
  const [filter, setFilter] = useState<string>(initialFilter ?? "همه سفارش‌ها");
  const filtered = rows.filter((row) => (filter === "همه سفارش‌ها" || row.status === filter) && `${row.number} ${row.customer} ${row.address}`.includes(query));
  const awaiting = rows.filter((row) => row.status === "نیازمند تایید").length;
  const sent = rows.filter((row) => row.status === "ارسال شده").length;
  return <section className="app-page orders-workspace">
    <header className="command-bar"><div className="command-title"><ClipboardList size={20} /><h1>سفارش‌ها</h1><span>{rows.length.toLocaleString("fa-IR")}</span></div><button className="command-action" onClick={() => notify("ثبت سفارش در محیط demo فقط نمایشی است.")}><Plus size={17} />ثبت سفارش</button></header>
    <div className="order-insights"><button onClick={() => setFilter("نیازمند تایید")}><small>نیازمند تأیید</small><b>{awaiting.toLocaleString("fa-IR")}</b></button><button onClick={() => setFilter("ارسال شده")}><small>در مسیر ارسال</small><b>{sent.toLocaleString("fa-IR")}</b></button><span><small>ارزش سفارش‌های امروز</small><b>{money(rows.slice(0, 3).reduce((total, row) => total + row.amount, 0))}</b></span></div>
    <div className="search-rail"><label className="rail-search"><Search size={22} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="شماره سفارش، مشتری یا شهر را جستجو کنید" /></label><div className="rail-actions"><IconButton label="فیلتر سفارش‌ها" onClick={() => setFilterOpen((open) => !open)}><Filter size={20} /></IconButton><IconButton label="خروجی سفارش‌ها" onClick={() => notify("خروجی CSV نمایشی آماده شد.")}><Download size={19} /></IconButton></div></div>
    {filterOpen && <div className="filter-drawer"><span>وضعیت سفارش:</span>{["همه سفارش‌ها", ...orderStatuses].map((item) => <button key={item} className={filter === item ? "active" : ""} onClick={() => { setFilter(item); setFilterOpen(false); }}>{item}</button>)}</div>}
    <div className="orders-column-head"><span>سفارش و مشتری</span><span>پرداخت و ارسال</span><span>وضعیت</span><span>مبلغ</span><span>عملیات</span></div>
    <section className="orders-ops-list">{filtered.map((row) => <article className="order-ops-row" key={row.id}><input className="row-check" type="checkbox" aria-label={`انتخاب ${row.number}`} /><button className="order-primary" onClick={() => onOpen(row)}><span className="order-marker">{(row.items ?? 0).toLocaleString("fa-IR")}</span><span><b>{row.number}</b><small><span className="order-customer">{row.customer}</span><i>·</i><span className="order-address">{row.address}</span></small></span></button><div className="order-flow"><span className={row.payment === "پرداخت موفق" ? "payment-chip success" : "payment-chip pending"}><CreditCard size={13} />{row.payment}</span><small><Package size={13} />{row.fulfillment}{row.tracking ? ` · ${row.tracking}` : ""}</small></div><div className="order-status"><Status>{row.status}</Status><small>{row.date}</small></div><strong className="order-amount">{money(row.amount)}</strong><span className="order-actions"><IconButton label="جزئیات سفارش" onClick={() => onOpen(row)}><Eye size={17} /></IconButton><button className="edit-link" onClick={() => onOpen(row)}>رسیدگی <ChevronLeft size={14} /></button></span></article>)}{filtered.length === 0 && <Empty />}</section>
  </section>;
}

function ProductsPage({ rows, categories, query, setQuery, operationalFocus, readOnly, onNew, onEdit, onDelete, onToggleFeatured, onToggleActive }: { rows: DemoProduct[]; categories: DemoCategory[]; query: string; setQuery: (value: string) => void; operationalFocus: OperationalFocus; readOnly: boolean; onNew: () => void; onEdit: (product: DemoProduct) => void; onDelete: (product: DemoProduct) => void; onToggleFeatured: (id: number) => void; onToggleActive: (id: number) => void }) {
  const [category, setCategory] = useState("همه دسته‌ها"); const [stock, setStock] = useState(operationalFocus === "products-low" ? "کم‌موجود" : "همه"); const [filterOpen, setFilterOpen] = useState(false);
  const filtered = rows.filter((row) => (category === "همه دسته‌ها" || row.category === category) && (stock === "همه" || (stock === "موجود" ? row.stock > 0 : stock === "کم‌موجود" ? row.stock < 7 : row.stock === 0)) && `${row.name} ${row.sku}`.includes(query));
  const shortName = (name: string) => name.replace("لپ‌تاپ ", "").replace("مدل ", "").replace(/ - .+$/, "").replace("مک‌بوک ایر ", "MacBook Air ").replace("سیم‌کارت دائمی ایرانسل ", "ایرانسل ").replace("مودم روتر ", "مودم ");
  const low = rows.filter((row) => row.stock < 7).length; const totalSold = rows.reduce((total, row) => total + row.sold, 0);
  return <section className="app-page products-workspace"><header className="command-bar"><div className="command-title"><Package size={20} /><h1>کالاها</h1><span>{rows.length.toLocaleString("fa-IR")}</span></div><button className="command-action" onClick={onNew}><Plus size={17} />افزودن کالا</button></header><div className="product-insights"><button onClick={() => setStock("کم‌موجود")}><small>موجودی کم</small><b>{low.toLocaleString("fa-IR")} کالا</b></button><span><small>فروش ثبت‌شده</small><b>{totalSold.toLocaleString("fa-IR")} قلم</b></span><span><small>دستهٔ انتخاب‌شده</small><b>{category}</b></span></div><div className="search-rail"><label className="rail-search"><Search size={22} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="نام کالا، SKU یا دسته را جستجو کنید" /></label><div className="rail-actions"><IconButton label="فیلتر کالاها" onClick={() => setFilterOpen((open) => !open)}><Filter size={20} /></IconButton><IconButton label="خروجی کالاها" onClick={() => navigator.clipboard?.writeText("خروجی نمایشی کالاها").catch(() => undefined)}><Download size={19} /></IconButton></div></div>{filterOpen && <div className="filter-drawer product-filter"><span>دسته:</span>{["همه دسته‌ها", ...categories.map((row) => row.name)].map((item) => <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>)}</div>}<div className="filter-tabs product-stock-tabs"><span>موجودی:</span>{["همه", "موجود", "کم‌موجود", "ناموجود"].map((item) => <button key={item} className={stock === item ? "active" : ""} onClick={() => setStock(item)}>{item}</button>)}</div><div className="products-column-head"><span>کالا</span><span>دسته</span><span>موجودی</span><span>فروش</span><span>وضعیت</span><span>عملیات</span></div><section className="products-ops-list">{filtered.map((row) => <article className="product-ops-row" key={row.id}><input className="row-check" type="checkbox" aria-label={`انتخاب ${row.name}`} /><button className="product-primary" onClick={() => onEdit(row)}><img src={row.image} alt="" /><span><b>{shortName(row.name)}</b><small><span className="product-sku">{row.sku}</span><i>·</i><span className="product-price">{money(row.price)}</span></small></span></button><span className="product-category">{row.category}</span><div className="stock-cell"><b className={row.stock < 7 ? "warn" : ""}>{(row.stock ?? 0).toLocaleString("fa-IR")} موجود</b><span><i style={{ width: `${Math.min(100, (row.stock ?? 0) * 5)}%` }} /></span><small>به‌روزرسانی {row.updated}</small></div><div className="sales-cell"><b>{(row.sold ?? 0).toLocaleString("fa-IR")}</b><small>فروش ثبت‌شده</small></div><div className="product-status-control"><span>نمایش</span><button className={row.active ? "status status-green" : "status status-rose"} onClick={() => onToggleActive(row.id)}>{row.active ? "فعال" : "غیرفعال"}</button></div><span className="product-actions"><IconButton label="ویرایش کالا" onClick={() => onEdit(row)}><Pencil size={17} /></IconButton><button className={row.featured ? "star-action active" : "star-action"} aria-label="نمایش ویژه" onClick={() => onToggleFeatured(row.id)}>★</button><IconButton label="حذف کالا" onClick={() => onDelete(row)}><Trash2 size={17} /></IconButton></span></article>)}{filtered.length === 0 && <Empty />}</section></section>;
}

function CategoriesPage({ rows, query, setQuery, readOnly, onNew, onEdit, onManageAttributes, onToggleActive, onDelete }: { rows: DemoCategory[]; query: string; setQuery: (value: string) => void; readOnly: boolean; onNew: () => void; onEdit: (category: DemoCategory) => void; onManageAttributes: (category: DemoCategory) => void; onToggleActive: (id: number) => void; onDelete: (category: DemoCategory) => void }) {
  const [status, setStatus] = useState("همه");
  const filtered = rows.filter((row) => (status === "همه" || (status === "فعال" ? row.active : !row.active)) && `${row.name} ${row.slug}`.toLocaleLowerCase("fa-IR").includes(query.toLocaleLowerCase("fa-IR")));
  const visibleRows = filtered.filter((row) => !row.parentId).flatMap((parent) => [parent, ...filtered.filter((row) => row.parentId === parent.id)]);
  const active = rows.filter((row) => row.active).length; const assigned = rows.reduce((total, row) => total + row.products, 0);
  return <section className="app-page category-workspace"><header className="command-bar"><div className="command-title"><FolderTree size={20} /><h1>دسته‌بندی‌ها</h1><span>{rows.length.toLocaleString("fa-IR")}</span></div><button className="command-action" onClick={onNew}><Plus size={17} />افزودن دسته</button></header><div className="category-insights"><span><small>دستهٔ فعال</small><b>{active.toLocaleString("fa-IR")}</b></span><span><small>کل کالاهای دسته‌بندی‌شده</small><b>{assigned.toLocaleString("fa-IR")}</b></span><span><small>بدون کالا</small><b>{rows.filter((row) => row.products === 0).length.toLocaleString("fa-IR")}</b></span></div><div className="category-search-rail"><label className="rail-search"><Search size={21} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="نام دسته یا slug را جست‌وجو کنید" /></label><div className="category-filter-tabs" aria-label="فیلتر وضعیت">{["همه", "فعال", "غیرفعال"].map((item) => <button type="button" key={item} className={status === item ? "active" : ""} onClick={() => setStatus(item)}>{item}</button>)}</div></div><section className="category-ops-list">{visibleRows.map((row) => <article className={`category-ops-row${row.parentId ? " category-child-row" : ""}`} key={row.id}><span className={row.active ? "category-mark active" : "category-mark"}><FolderTree size={18} /></span><button className="category-primary" onClick={() => onEdit(row)}><b>{row.parentId ? `↳ ${row.name}` : row.name}</b><small>{row.parentId ? `زیرمجموعهٔ ${rows.find((parent) => parent.id === row.parentId)?.name ?? "دستهٔ اصلی"}` : `/${row.slug}`}</small></button><div className="category-volume"><b>{(row.products ?? 0).toLocaleString("fa-IR")} کالا</b><small>{row.parentId ? "زیرمجموعهٔ فروشگاه" : row.products ? "قابل نمایش در فروشگاه" : "آمادهٔ تخصیص کالا"}</small></div><button type="button" className={row.active ? "status status-green" : "status status-rose"} onClick={() => onToggleActive(row.id)}>{row.active ? "فعال" : "غیرفعال"}</button><span className="category-actions"><IconButton label={`مدیریت ویژگی‌های ${row.name}`} onClick={() => onManageAttributes(row)}><SlidersHorizontal size={16} /></IconButton><IconButton label={`ویرایش ${row.name}`} onClick={() => onEdit(row)}><Pencil size={16} /></IconButton><IconButton label={`حذف ${row.name}`} onClick={() => onDelete(row)}><Trash2 size={16} /></IconButton></span></article>)}{visibleRows.length === 0 && <Empty />}</section></section>;
}

function DiscountsPage({ rows, query, setQuery, operationalFocus, onNew, onEdit, onToggle, onDelete, onCopy }: { rows: DemoDiscount[]; query: string; setQuery: (value: string) => void; operationalFocus: OperationalFocus; onNew: () => void; onEdit: (discount: DemoDiscount) => void; onToggle: (id: number) => void; onDelete: (discount: DemoDiscount) => void; onCopy: (code: string) => void }) {
  const [status, setStatus] = useState(operationalFocus === "discounts-active" ? "فعال" : "همه");
  const usage = (row: DemoDiscount) => ({ used: row.usedCount, limit: row.usageLimit });
  const filtered = rows.filter((row) => (status === "همه" || (status === "فعال" ? row.active : !row.active)) && `${row.code} ${row.title}`.toLocaleLowerCase("fa-IR").includes(query.toLocaleLowerCase("fa-IR")));
  const active = rows.filter((row) => row.active).length; const totalUsed = rows.reduce((total, row) => total + usage(row).used, 0); const full = rows.filter((row) => { const count = usage(row); return count.limit > 0 && count.used >= count.limit; }).length;
  return <section className="app-page discount-workspace"><header className="command-bar"><div className="command-title"><Tag size={20} /><h1>تخفیف‌ها</h1><span>{rows.length.toLocaleString("fa-IR")}</span></div><button className="command-action" onClick={onNew}><Plus size={17} />افزودن کد</button></header><div className="discount-insights"><span><small>کد فعال</small><b>{active.toLocaleString("fa-IR")}</b></span><span><small>مصرف ثبت‌شده</small><b>{totalUsed.toLocaleString("fa-IR")}</b></span><span><small>سقف تکمیل‌شده</small><b>{full.toLocaleString("fa-IR")}</b></span></div><div className="discount-search-rail"><label className="rail-search"><Search size={21} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="کد یا عنوان تخفیف را جست‌وجو کنید" /></label><div className="discount-filter-tabs" aria-label="فیلتر وضعیت">{["همه", "فعال", "غیرفعال"].map((item) => <button type="button" key={item} className={status === item ? "active" : ""} onClick={() => setStatus(item)}>{item}</button>)}</div></div><section className="discount-ops-list">{filtered.map((row) => { const count = usage(row); const percentage = count.limit ? Math.min(100, Math.round((count.used / count.limit) * 100)) : 0; return <article className="discount-ops-row" key={row.id}><span className={row.active ? "discount-mark active" : "discount-mark"}>%</span><button className="discount-primary" onClick={() => onEdit(row)}><b>{row.title}</b><small dir="ltr">{row.code}</small></button><strong className="discount-amount">{row.amount}</strong><div className="discount-usage"><span><b>{`${count.used.toLocaleString("fa-IR")} از ${count.limit.toLocaleString("fa-IR")} بار`}</b><small>{percentage.toLocaleString("fa-IR")}٪ سقف</small></span><i><em style={{ width: `${percentage}%` }} /></i></div><div className="discount-state"><small>{`${row.startsAt} تا ${row.endsAt}`}</small><small className="discount-minimum-order">{row.minimumOrder > 0 ? `حداقل خرید ${money(row.minimumOrder)}` : "بدون حداقل خرید"}</small><button type="button" className={row.active ? "status status-green" : "status status-rose"} onClick={() => onToggle(row.id)}>{row.active ? "فعال" : "غیرفعال"}</button></div><span className="discount-actions"><IconButton label={`کپی ${row.code}`} onClick={() => onCopy(row.code)}><Copy size={16} /></IconButton><IconButton label={`ویرایش ${row.title}`} onClick={() => onEdit(row)}><Pencil size={16} /></IconButton><IconButton label={`حذف ${row.title}`} onClick={() => onDelete(row)}><Trash2 size={16} /></IconButton></span></article>; })}{filtered.length === 0 && <Empty />}</section></section>;
}

function CampaignsPage({ rows, query, setQuery, onNew, onEdit, onToggle, onPreview, onDelete }: { rows: DemoCampaign[]; query: string; setQuery: (value: string) => void; onNew: () => void; onEdit: (campaign: DemoCampaign) => void; onToggle: (id: number) => void; onPreview: (campaign: DemoCampaign) => void; onDelete: (campaign: DemoCampaign) => void }) {
  const [status, setStatus] = useState("همه");
  const filtered = rows.filter((row) => (status === "همه" || (status === "فعال" ? row.active : !row.active)) && `${row.name} ${row.kind} ${row.trigger} ${row.audience}`.includes(query));
  const active = rows.filter((row) => row.active).length;
  const delivered = rows.reduce((total, row) => total + row.delivered, 0);
  const recovered = rows.reduce((total, row) => total + row.recovered, 0);
  return <section className="app-page campaign-workspace">
    <header className="command-bar"><div className="command-title"><Megaphone size={20} /><h1>کمپین‌های خودکار</h1><span>{rows.length.toLocaleString("fa-IR")}</span></div><button className="command-action" onClick={onNew}><Plus size={17} />افزودن کمپین</button></header>
    <div className="campaign-safe-note"><ShieldCheck size={17} /><span>این صفحه فقط workflow و پیام نمایشی را مدیریت می‌کند؛ هیچ پیامک یا ایمیلی در staging ارسال نمی‌شود.</span></div>
    <div className="campaign-insights"><span><small>کمپین فعال</small><b>{active.toLocaleString("fa-IR")}</b></span><span><small>ارسال نمایشی</small><b>{delivered.toLocaleString("fa-IR")}</b></span><span><small>بازگشت فرضی</small><b>{recovered.toLocaleString("fa-IR")}</b></span></div>
    <div className="campaign-search-rail"><label className="rail-search"><Search size={21} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="نام، trigger یا مخاطب را جست‌وجو کنید" /></label><div className="campaign-filter-tabs" aria-label="فیلتر وضعیت">{["همه", "فعال", "غیرفعال"].map((item) => <button type="button" key={item} className={status === item ? "active" : ""} onClick={() => setStatus(item)}>{item}</button>)}</div></div>
    <section className="campaign-ops-list">{filtered.map((row) => { const rate = row.delivered ? Math.round((row.recovered / row.delivered) * 100) : 0; return <article className="campaign-ops-row" key={row.id}><span className={row.active ? "campaign-mark active" : "campaign-mark"}><Megaphone size={17} /></span><button className="campaign-primary" onClick={() => onEdit(row)}><b>{row.name}</b><small>{row.kind} · {row.trigger}</small></button><div className="campaign-offer"><b>{row.offer}</b><small>{row.audience}</small></div><div className="campaign-schedule"><b>{row.delay}</b><small>تکرار: {row.frequency}</small></div><div className="campaign-performance"><b>{row.delivered.toLocaleString("fa-IR")} ارسال</b><small>{row.recovered.toLocaleString("fa-IR")} بازگشت · {rate.toLocaleString("fa-IR")}٪</small></div><div className="campaign-state"><button type="button" className={row.active ? "status status-green" : "status status-rose"} onClick={() => onToggle(row.id)}>{row.active ? "فعال" : "غیرفعال"}</button><small>{row.channel}</small></div><span className="campaign-actions"><IconButton label={`پیش‌نمایش ${row.name}`} onClick={() => onPreview(row)}><Eye size={16} /></IconButton><IconButton label={`ویرایش ${row.name}`} onClick={() => onEdit(row)}><Pencil size={16} /></IconButton><IconButton label={`حذف ${row.name}`} onClick={() => onDelete(row)}><Trash2 size={16} /></IconButton></span></article>; })}{filtered.length === 0 && <Empty />}</section>
  </section>;
}

function TicketsPage({ rows, operationalFocus, onChange, notify, onDelete, liveMode, onReply, onUpdateStatus, onMarkRead, onArchive, onRestore, onPermanentDelete, onRequestConfirm }: { rows: DemoTicket[]; operationalFocus: OperationalFocus; onChange: (next: DemoTicket[]) => void; notify: (message: string) => void; onDelete: (ids: string[]) => void; liveMode: boolean; onReply?: (ticketId: string, message: string) => Promise<void>; onUpdateStatus?: (ticketId: string, status: keyof typeof ticketStatusToApi) => Promise<void>; onMarkRead?: (ticketId: string) => Promise<void>; onArchive?: (ticketId: string) => Promise<void>; onRestore?: (ticketId: string) => Promise<void>; onPermanentDelete?: (ticketId: string) => Promise<void>; onRequestConfirm: (title: string, description: string, action: () => void) => void }) {
  const [selectedId, setSelectedId] = useState<string>(rows[0]?.id ?? "");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  useSupportTicketAutoRefresh(liveMode);
  const [reply, setReply] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState(operationalFocus === "tickets-open" ? "باز" : "همه");
  const [showDetail, setShowDetail] = useState(false);
  const [ticketActionPending, setTicketActionPending] = useState<"archive" | "restore" | "delete" | null>(null);
  const archiveView = statusFilter === "بایگانی";
  const filtered = rows.filter((row) => (archiveView ? row.archived : !row.archived) && (operationalFocus !== "tickets-open" || row.status !== "بسته شده") && (archiveView || statusFilter === "همه" || row.status === statusFilter) && `${row.title} ${row.ticketNumber} ${row.department} ${row.priority}`.includes(query));
  // A reply can change the ticket status and remove it from the current filter.
  // Keep the selected conversation open until the manager explicitly selects another ticket.
  const selected = rows.find((row) => row.id === selectedId) ?? filtered[0];
  useEffect(() => { setSelectedIds((ids) => ids.filter((id) => rows.some((row) => row.id === id))); if (selectedId && !rows.some((row) => row.id === selectedId)) { setSelectedId(rows[0]?.id ?? ""); setShowDetail(false); } }, [rows, selectedId]);
  const updateSelected = (updates: Partial<DemoTicket>) => selected && onChange(rows.map((row) => row.id === selected.id ? { ...row, ...updates } : row));
  const send = async () => {
    if (!selected || !reply.trim()) return notify("ابتدا متن پاسخ را وارد کنید.");
    const message = reply.trim();
    try {
      if (liveMode && onReply) await onReply(selected.id, message);
      else updateSelected({ messages: [...selected.messages, { id: Date.now(), sender: "admin", body: message, createdAt: new Date().toISOString(), time: new Date().toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" }) }], updated: "همین حالا" });
      setReply("");
      notify(liveMode ? "پاسخ برای مشتری ثبت شد." : "پاسخ در دادهٔ نمایشی ثبت شد.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "ارسال پاسخ تیکت انجام نشد.");
    }
  };
  const changeStatus = async (status: keyof typeof ticketStatusToApi) => {
    if (!selected) return;
    try {
      if (liveMode && onUpdateStatus) await onUpdateStatus(selected.id, status);
      else updateSelected({ status });
      notify(liveMode ? "وضعیت تیکت به‌روزرسانی شد." : "وضعیت تیکت در دادهٔ نمایشی به‌روز شد.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "به‌روزرسانی وضعیت تیکت انجام نشد.");
    }
  };
  const openTicket = (id: string) => {
    setSelectedId(id);
    setShowDetail(true);
    const ticket = rows.find((row) => row.id === id);
    if (liveMode && ticket && ticket.unreadCount > 0 && onMarkRead) {
      void onMarkRead(id).catch((error) => notify(error instanceof Error ? error.message : "ثبت خوانده‌شدن پیام‌ها انجام نشد."));
    }
  };
  const sortedMessages = selected ? [...selected.messages].sort((left, right) => (left.createdAt || '').localeCompare(right.createdAt || '')) : [];
  const archiveSelected = async () => {
    if (!selected || !onArchive || ticketActionPending) return;
    setTicketActionPending("archive");
    try {
      await onArchive(selected.id);
      setStatusFilter("بایگانی");
      setSelectedId(selected.id);
    } catch (error) {
      notify(error instanceof Error ? error.message : "بایگانی تیکت انجام نشد.");
    } finally {
      setTicketActionPending(null);
    }
  };
  const restoreSelected = async () => {
    if (!selected || !onRestore || ticketActionPending) return;
    setTicketActionPending("restore");
    try {
      await onRestore(selected.id);
      setStatusFilter("همه");
      setSelectedId(selected.id);
    } catch (error) {
      notify(error instanceof Error ? error.message : "بازگردانی تیکت انجام نشد.");
    } finally {
      setTicketActionPending(null);
    }
  };
  const deleteSelected = () => {
    if (!selected || !onPermanentDelete || ticketActionPending) return;
    onRequestConfirm("حذف دائمی تیکت", `تیکت بایگانی‌شدهٔ «${selected.title}» و تمام پیام‌های آن برای همیشه حذف می‌شود. این عمل قابل بازگشت نیست.`, () => {
      setTicketActionPending("delete");
      void onPermanentDelete(selected.id)
        .catch((error) => notify(error instanceof Error ? error.message : "حذف دائمی تیکت انجام نشد."))
        .finally(() => setTicketActionPending(null));
    });
  };
  const toggleSelection = (id: string) => setSelectedIds((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]);
  const allFilteredSelected = filtered.length > 0 && filtered.every((row) => selectedIds.includes(row.id));
  const toggleAllFiltered = () => setSelectedIds((ids) => allFilteredSelected ? ids.filter((id) => !filtered.some((row) => row.id === id)) : [...ids, ...filtered.map((row) => row.id).filter((id) => !ids.includes(id))]);
  const openCount = rows.filter((row) => row.status === "باز").length;
  const reviewingCount = rows.filter((row) => row.status === "در حال بررسی").length;
  return <section className="tickets-ops-page">
    <header className="command-bar"><div className="command-title"><MessageSquare size={20} /><h1>تیکت‌های پشتیبانی</h1><span>{rows.filter((row) => !row.archived && row.status !== "بسته شده").length.toLocaleString("fa-IR")}</span></div><div className="ticket-header-stats"><span><b>{openCount.toLocaleString("fa-IR")}</b> باز</span><span><b>{reviewingCount.toLocaleString("fa-IR")}</b> در حال بررسی</span></div></header>
    <section className="tickets-ops-workspace">
      <aside className={`ticket-list-panel ${showDetail ? "mobile-hidden" : ""}`}>
        <div className="ticket-list-tools">
          <label className="ticket-search"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="جست‌وجوی تیکت" /></label>
          <div className="ticket-filter-tabs">{["همه", "باز", "در حال بررسی", "پاسخ داده شده", "بسته شده", "بایگانی"].map((item) => <button key={item} type="button" className={statusFilter === item ? "active" : ""} onClick={() => setStatusFilter(item)}>{item}</button>)}</div>
          <div className="ticket-selection-bar">{liveMode ? <small>{archiveView ? "تیکت‌های بایگانی‌شده؛ حذف دائمی فقط با تأیید جداگانه ممکن است." : "پیام‌های جدید مشتری با نشان قرمز مشخص می‌شوند."}</small> : <><label><input type="checkbox" checked={allFilteredSelected} onChange={toggleAllFiltered} />انتخاب همه</label>{selectedIds.length > 0 ? <span><b>{selectedIds.length.toLocaleString("fa-IR")} انتخاب</b><button type="button" onClick={() => onDelete(selectedIds)}><Trash2 size={14} />حذف</button></span> : <small>برای حذف گروهی، تیکت‌ها را انتخاب کنید.</small>}</>}</div>
        </div>
        <div className="ticket-queue"><div className="ticket-queue-heading"><span>{archiveView ? "بایگانی" : "صف رسیدگی"}</span><b>{filtered.length.toLocaleString("fa-IR")} مورد</b></div>{filtered.map((row) => <article className={selected?.id === row.id ? "ticket-queue-row active" : "ticket-queue-row"} key={row.id}><input className="ticket-row-check" type="checkbox" aria-label={`انتخاب ${row.title}`} checked={selectedIds.includes(row.id)} onChange={() => toggleSelection(row.id)} /><span className={`ticket-priority ${row.priority === "فوری" ? "urgent" : row.priority === "عادی" ? "normal" : "low"}`} /><button className="ticket-queue-open" onClick={() => openTicket(row.id)}><span className="ticket-queue-copy"><b>{row.title}</b><small>{row.department} · {row.updated}</small></span>{liveMode && row.unreadCount > 0 && <em className="ticket-unread-badge">{row.unreadCount.toLocaleString("fa-IR")} جدید</em>}</button><span className="ticket-queue-meta"><Status>{row.archived ? "بایگانی" : row.status}</Status><small>{row.priority}</small>{!liveMode && <button type="button" className="ticket-delete-one" aria-label={`حذف ${row.title}`} title="حذف تیکت" onClick={() => onDelete([row.id])}><Trash2 size={13} /></button>}</span></article>)}{filtered.length === 0 && <Empty />}</div>
      </aside>
      {selected && <article className={`ticket-conversation-panel ${showDetail ? "show" : ""}`}>
        <header className="ticket-conversation-header"><button className="ticket-mobile-back" onClick={() => setShowDetail(false)}><ChevronLeft size={17} />فهرست</button><span><small>{selected.department} · اولویت {selected.priority}</small><h2>{selected.title}</h2></span><span className="ticket-detail-actions"><ChoiceMenu value={selected.status} options={["باز", "در حال بررسی", "پاسخ داده شده", "بسته شده"]} disabled={selected.archived || ticketActionPending !== null} onChange={(status) => { void changeStatus(status as keyof typeof ticketStatusToApi); }} />{liveMode && !selected.archived && selected.status === "بسته شده" && <button type="button" disabled={ticketActionPending !== null} className="ticket-action archive" onClick={() => void archiveSelected()}>{ticketActionPending === "archive" ? "در حال بایگانی…" : "بایگانی"}</button>}{liveMode && selected.archived && <><button type="button" disabled={ticketActionPending !== null} className="ticket-action restore" onClick={() => void restoreSelected()}>{ticketActionPending === "restore" ? "در حال بازگردانی…" : "بازگردانی"}</button><button type="button" disabled={ticketActionPending !== null} className="ticket-action danger" onClick={deleteSelected}>{ticketActionPending === "delete" ? "در حال حذف…" : "حذف دائمی"}</button></>}{!liveMode && <button type="button" className="ticket-delete-trigger" aria-label="حذف تیکت" title="حذف تیکت" onClick={() => onDelete([selected.id])}><Trash2 size={15} /></button>}</span></header>
        <div className="ticket-thread"><div className="ticket-thread-note"><MessageSquare size={14} />{liveMode ? "پیام‌ها بر اساس زمان ثبت نمایش داده می‌شوند؛ پیام جدید مشتری با نشان قرمز در فهرست مشخص است." : "گفت‌وگو فقط در محیط بازبینی ثبت می‌شود."}</div><div className="ticket-context-bar"><span><small>شناسه</small><b>{selected.ticketNumber}</b></span><span><small>آخرین تغییر</small><b>{selected.updated}</b></span><span><small>وضعیت جاری</small><b>{selected.archived ? "بایگانی" : selected.status}</b></span></div>{sortedMessages.map((message) => <div className={`ticket-message ${message.sender}`} key={message.id}><small>{message.sender === "customer" ? "مشتری" : "پشتیبانی نوین‌نت"} · {message.time}</small><p>{message.body}</p></div>)}</div>
        <footer className="ticket-composer"><div className="ticket-reply-suggestions"><button type="button" onClick={() => setReply("سلام، درخواست شما بررسی شد و نتیجه به‌زودی اعلام می‌شود.")}>پاسخ بررسی</button><button type="button" onClick={() => setReply("برای بررسی دقیق‌تر، لطفاً شماره سفارش یا تصویر خطا را ارسال کنید.")}>درخواست اطلاعات</button></div><div className="reply-box"><input disabled={selected.archived} value={reply} onChange={(event) => setReply(event.target.value)} placeholder={selected.archived ? "تیکت بایگانی‌شده است" : "پاسخ خود را بنویسید..."} onKeyDown={(event) => event.key === "Enter" && send()} /><button disabled={selected.archived} onClick={send}>ارسال</button></div><small className="ticket-composer-note"><ShieldCheck size={13} />{selected.archived ? "برای پاسخ‌دادن، ابتدا تیکت را از بایگانی بازگردانید." : liveMode ? "پاسخ پس از تأیید API برای مشتری ثبت می‌شود." : "پاسخ فقط در محیط بازبینی ثبت می‌شود."}</small></footer>
      </article>}
    </section>
  </section>;
}

function UsersPage({ rows, query, setQuery, onEdit }: { rows: DemoUser[]; query: string; setQuery: (value: string) => void; onEdit: (user: DemoUser) => void }) { const [role, setRole] = useState("همه نقش‌ها"); const normalizedQuery = query.trim().toLocaleLowerCase("fa-IR"); const filtered = rows.filter((row) => (role === "همه نقش‌ها" || row.role === role) && (!normalizedQuery || `${row.name} ${row.email} ${row.phone ?? ""}`.toLocaleLowerCase("fa-IR").includes(normalizedQuery))); return <><SectionHeader title="کاربران" count={`${rows.length.toLocaleString("fa-IR")} حساب کاربری`} /><FlatToolbar selectLabel="همه نقش‌ها" options={["همه نقش‌ها", "مدیر ارشد", "کارشناس", "مشتری"]} selected={role} setSelected={setRole} query={query} setQuery={setQuery} /><section className="data-table simple-table"><div className="table-head"><span>کاربر</span><span>ایمیل</span><span>دسترسی</span><span>کیف پول</span><span>عملیات</span></div>{filtered.map((row) => <article className="table-row" key={row.id}><span className="user-cell"><i>{row.name.slice(0, 1)}</i><b>{row.name}</b></span><small dir="ltr">{row.email}</small><span className="role-chip">{row.role}</span><strong>{money(row.wallet)}</strong><button className="edit-link" onClick={() => onEdit(row)}><Pencil size={15} />مدیریت</button></article>)}{filtered.length === 0 && <Empty />}</section></>; }

function SettingsPage({ notify }: { notify: (message: string) => void }) { const [active, setActive] = useState("عمومی"); const [form, setForm] = useState({ name: "نوین‌نت", slogan: "اینترنت و تجهیزات هوشمند", phone: "021-00000000", email: "support@demo.local", address: "تهران، ایران" }); const update = (key: keyof typeof form, value: string) => setForm((old) => ({ ...old, [key]: value })); return <><SectionHeader title="تنظیمات" action="ذخیره" onAction={() => notify("تنظیمات در دادهٔ نمایشی ذخیره شد.")} /><section className="settings-layout"><nav className="settings-nav">{["عمومی", "فروشگاه", "پرداخت", "پیامک", "ارسال", "ظاهر"].map((item) => <button key={item} className={active === item ? "active" : ""} onClick={() => setActive(item)}>{item}</button>)}</nav><form className="settings-form" onSubmit={(event) => { event.preventDefault(); notify("تنظیمات در دادهٔ نمایشی ذخیره شد."); }}><div className="form-heading"><h2>تنظیمات {active}</h2><p>تغییرهای این بخش فقط دادهٔ نمایشی مرورگر را تغییر می‌دهند.</p></div><label>نام فروشگاه<input value={form.name ?? ""} onChange={(event) => update("name", event.target.value)} /></label><label>شعار تجاری<input value={form.slogan ?? ""} onChange={(event) => update("slogan", event.target.value)} /></label><label>شماره تماس<input value={form.phone ?? ""} dir="ltr" onChange={(event) => update("phone", event.target.value)} /></label><label>ایمیل پشتیبانی<input value={form.email ?? ""} dir="ltr" onChange={(event) => update("email", event.target.value)} /></label><label className="full">آدرس دفتر مرکزی<input value={form.address ?? ""} onChange={(event) => update("address", event.target.value)} /></label><button className="inline-save" type="submit">ذخیره در demo</button></form></section></>; }

function OrderDrawer({ order, liveMode, onClose, onSave }: { order: DemoOrder; liveMode: boolean; onClose: () => void; onSave: (order: DemoOrder) => void }) {
  const [status, setStatus] = useState<OrderStatus>(order.status);
  const [tracking, setTracking] = useState(order.tracking ?? "");
  const itemNames = order.id % 2 === 0 ? ["مودم روتر هوشمند 5G", "بستهٔ اینترنت تکمیلی"] : ["تجهیزات سفارش نوین‌نت", "خدمت پشتیبانی و راه‌اندازی"];
  const fallbackItems = Array.from({ length: order.items }, (_, index) => ({ name: itemNames[index] ?? "کالای تکمیلی سفارش", quantity: 1, amount: index === 0 ? Math.floor(order.amount * (order.items > 1 ? .8 : 1)) : order.amount - Math.floor(order.amount * .8) }));
  const items = liveMode && order.lineItems?.length ? order.lineItems : fallbackItems;
  const currentStep = orderStatuses.indexOf(status);
  const timeline = ["ثبت سفارش", "تأیید پرداخت", "آماده‌سازی", "ارسال برای مشتری", "تحویل سفارش"];
  return <DrawerShell className="order-drawer" onClose={onClose} title="رسیدگی سفارش" subtitle={liveMode ? `${order.number} · تغییر وضعیت و رهگیری واقعی` : order.number}>
    <div className="order-drawer-scroll">
      <section className="order-record-hero">
        <div><span>شماره سفارش</span><b>{order.number}</b><small>ثبت در {order.date} · ساعت ۰۹:۳۲</small></div>
        <Status>{status}</Status>
      </section>

      <section className="order-progress-section">
        <div className="section-label"><b>وضعیت رسیدگی</b><small>همهٔ گزینه‌ها برای تغییر مستقیم باز هستند.</small></div>
        <div className="order-status-options">{orderStatuses.map((option) => <button key={option} className={status === option ? `active ${toneOf(option)}` : ""} onClick={() => setStatus(option)}>{status === option && <Check size={13} />}{option}</button>)}</div>
        <label className="tracking-field"><span>کد رهگیری ارسال</span><input value={tracking ?? ""} onChange={(event) => setTracking(event.target.value)} placeholder="مثال: IR-123456" /><small>{tracking ? "کد رهگیری برای مشتری قابل نمایش است." : "پس از تحویل به ارسال‌کننده، کد رهگیری را وارد کنید."}</small></label>
      </section>

      <section className="order-facts-grid">
        <article><small>خریدار</small><b>{order.customer}</b><span>{liveMode ? order.recipientPhone || "شماره تماس ثبت نشده" : "۰۹۱۲ *** ۶۷۸۹"}</span></article>
        <article><small>روش پرداخت</small><b>{order.payment}</b><span>{liveMode ? "وضعیت ثبت‌شده در سفارش" : `درگاه آنلاین · DEMO-PAY-${order.id.toLocaleString("fa-IR")}`}</span></article>
        <article><small>روش ارسال</small><b>{order.fulfillment}</b><span>{tracking || "کد رهگیری هنوز ثبت نشده"}</span></article>
        <article><small>منشأ سفارش</small><b>فروشگاه آنلاین</b><span>ثبت مستقیم توسط مشتری</span></article>
      </section>

      <section className="order-detail-section">
        <div className="section-label"><b>نشانی تحویل</b><small>{liveMode ? "نشانی ثبت‌شدهٔ سفارش" : "دادهٔ نمایشی سفارش"}</small></div>
        <p className="address-detail">{liveMode ? order.address : `${order.address}، خیابان اصلی، پلاک ۱۲، واحد ۵`}</p>
        <div className="address-meta"><span>گیرنده: {order.customer}</span><span>کدپستی: ۱۴۱۵۶-۱۲۳۴۵</span></div>
      </section>

      <section className="order-detail-section order-items-section">
        <div className="section-label"><b>اقلام سفارش</b><small>{order.items.toLocaleString("fa-IR")} قلم</small></div>
        {items.map((item, index) => <div className="order-item" key={`${item.name}-${index}`}><span className="item-quantity">{item.quantity.toLocaleString("fa-IR")}</span><div><b>{item.name}</b><small>تعداد {item.quantity.toLocaleString("fa-IR")} · قیمت واحد {money(item.amount)}</small></div><strong>{money(item.amount)}</strong></div>)}
      </section>

      <section className="order-totals">
        <div><span>جمع اقلام</span><strong>{money(order.amount)}</strong></div>
        <div><span>تخفیف</span><strong>۰ تومان</strong></div>
        <div><span>هزینه ارسال</span><strong>۰ تومان</strong></div>
        <div className="total-payable"><span>مبلغ قابل پرداخت</span><strong>{money(order.amount)}</strong></div>
      </section>

      <section className="order-timeline-section">
        <div className="section-label"><b>روند سفارش</b><small>وضعیت عملیاتی سفارش</small></div>
        <ol className="order-timeline">{timeline.map((item, index) => <li className={index <= Math.max(0, currentStep) ? "complete" : ""} key={item}><i>{index < Math.max(0, currentStep) ? <Check size={12} /> : (index + 1).toLocaleString("fa-IR")}</i><div><b>{item}</b><small>{index === 0 ? `${order.date} · ۰۹:۳۲` : index <= Math.max(0, currentStep) ? liveMode ? "وضعیت در سفارش ثبت شده" : "در دادهٔ نمایشی ثبت شده" : "در انتظار انجام"}</small></div></li>)}</ol>
      </section>
    </div>
    <DrawerFooter onClose={onClose} onSave={() => onSave({ ...order, status, tracking })} label="ذخیره رسیدگی" />
  </DrawerShell>;
}
function ProductEditor({ product, categories, definitions, existingSkus, onManageCategoryAttributes, liveMode, onClose, onSave }: { product: DemoProduct | null; categories: DemoCategory[]; definitions: AdminProductAttributeDefinition[]; existingSkus: string[]; onManageCategoryAttributes: (category: DemoCategory) => void; liveMode: boolean; onClose: () => void; onSave: (product: DemoProduct) => Promise<void> }) {
  const emptyForm: DemoProduct = { id: 0, name: "", sku: "", price: 0, stock: 0, category: categories[0]?.name ?? "", active: true, featured: false, image: liveMode ? "" : productImages[0], gallery: liveMode ? [] : [productImages[0]], description: "", sold: 0, updated: "همین حالا" };
  const makeForm = (source: DemoProduct): ProductForm => { const colors = (source.colors ?? []).map((color) => ({ ...color })); const options = (source.options ?? []).map((option) => ({ ...option, values: [...option.values] })); return { ...source, gallery: source.gallery.length ? [...source.gallery] : liveMode ? [] : [source.image], description: source.description ?? "", colors, options, attributes: (source.attributes ?? []).map((attribute) => ({ ...attribute })), facetValues: { ...(source.facetValues ?? {}) }, variants: synchronizeVariantCombinations(colors, options, (source.variants ?? []).map((variant) => ({ ...variant, optionValues: { ...(variant.optionValues ?? {}) } })), source.price) }; };
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<ProductForm>(() => makeForm(product ?? emptyForm));
  const [skuOverride, setSkuOverride] = useState(Boolean(product?.sku));
  const [integrityMessage, setIntegrityMessage] = useState("");
  const [uploadingImages, setUploadingImages] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [colorName, setColorName] = useState(""); const [colorHex, setColorHex] = useState("#2563eb"); const [attributeLabel, setAttributeLabel] = useState(""); const [attributeValue, setAttributeValue] = useState("");
  const productIdentity = product?.id ?? "new";
  useEffect(() => {
    setStep(0);
    setForm(makeForm(product ?? emptyForm));
    setSkuOverride(Boolean(product?.sku));
    setIntegrityMessage("");
    setUploadingImages(false);
    setIsSaving(false);
    setColorName("");
    setColorHex("#2563eb");
    setAttributeLabel("");
    setAttributeValue("");
  }, [productIdentity]);
  const steps = ["هویت", "قیمت و موجودی", "تصاویر", "جزئیات"];
  const suggestedSku = buildSku(form.category, form.name);
  const update = <K extends keyof ProductForm>(key: K, value: ProductForm[K]) => setForm((old) => ({ ...old, [key]: value }));
  // Legacy demo products may keep a valid category name while carrying an ID from
  // another catalogue source. Resolve both forms so their configurable axes stay visible.
  const selectedCategoryFamily = categoryFamily(form.category);
  const categoryIdsByName = categories
    .filter((category) => category.name.trim() === form.category.trim() || categoryFamily(category.name) === selectedCategoryFamily)
    .map((category) => category.id);
  const selectedCategoryIds = Array.from(new Set([form.categoryId, ...categoryIdsByName].filter((id): id is number => Number.isFinite(id))));
  const categoryDefinitions = definitions.filter((definition) => !definition.categoryIds.length || selectedCategoryIds.some((id) => definition.categoryIds.includes(id)));
  const selectedCategory = categories.find((category) => category.id === form.categoryId) ?? categories.find((category) => category.name.trim() === form.category.trim()) ?? categories.find((category) => categoryFamily(category.name) === selectedCategoryFamily) ?? null;
  const updateFacet = (key: string, value: string) => setForm((old) => ({ ...old, facetValues: { ...(old.facetValues ?? {}), [key]: value } }));
  const addImages = async (files: FileList | null) => { if (!files?.length) return; const selected = Array.from(files).filter((file) => file.type.startsWith("image/")); if (!selected.length) return; const remaining = MAX_GALLERY_IMAGES - form.gallery.length; if (remaining <= 0) { setIntegrityMessage(`حداکثر ${MAX_GALLERY_IMAGES.toLocaleString("fa-IR")} تصویر برای هر کالا مجاز است.`); return; } setIntegrityMessage(""); if (!liveMode) { const images = selected.map((file) => URL.createObjectURL(file)); setForm((old) => ({ ...old, image: old.gallery.length ? old.image : images[0], gallery: [...old.gallery, ...images.slice(0, remaining)] })); return; } setUploadingImages(true); try { const images = await Promise.all(selected.slice(0, remaining).map((file) => api.uploadAdminProductImage(file))); setForm((old) => ({ ...old, image: old.gallery.length ? old.image : images[0], gallery: [...old.gallery, ...images] })); } catch (error) { setIntegrityMessage(error instanceof Error ? error.message : "بارگذاری تصویر با خطا روبه‌رو شد."); } finally { setUploadingImages(false); } };
  const removeImage = (image: string) => setForm((old) => { const gallery = old.gallery.filter((item) => item !== image); return { ...old, gallery, image: old.image === image ? gallery[0] ?? (liveMode ? "" : productImages[0]) : old.image }; });
  const addColor = () => { const name = cleanText(colorName); if (!name) return; if (form.colors.some((color) => color.name.toLocaleLowerCase("fa-IR") === name.toLocaleLowerCase("fa-IR"))) { setIntegrityMessage("این رنگ قبلاً ثبت شده است."); return; } if (form.colors.length >= MAX_COLORS) { setIntegrityMessage(`حداکثر ${MAX_COLORS.toLocaleString("fa-IR")} رنگ برای هر کالا مجاز است.`); return; } const colors = [...form.colors, { name, hex: colorHex }]; if (projectedVariantCount(colors, form.options) > MAX_VARIANTS) { setIntegrityMessage(`این انتخاب بیش از ${MAX_VARIANTS.toLocaleString("fa-IR")} ترکیب می‌سازد؛ ابتدا مقدارهای پیکربندی را کم کنید.`); return; } setIntegrityMessage(""); setForm((old) => ({ ...old, colors, variants: synchronizeVariantCombinations(colors, old.options, old.variants, old.price) })); setColorName(""); };
  const toggleVariantOption = (definition: AdminProductAttributeDefinition) => {
    const selected = form.options.some((option) => option.id === definition.key);
    if (selected) {
      const options = form.options.filter((option) => option.id !== definition.key);
      setForm((old) => ({ ...old, options, variants: synchronizeVariantCombinations(old.colors, options, old.variants, old.price) }));
      return;
    }
    if (form.options.length >= MAX_VARIANT_OPTIONS) { setIntegrityMessage(`برای سبک‌ماندن ثبت کالا، حداکثر ${MAX_VARIANT_OPTIONS.toLocaleString("fa-IR")} محور فروش انتخاب کنید.`); return; }
    setIntegrityMessage("");
    setForm((old) => ({ ...old, options: [...old.options, { id: definition.key, name: definition.name, values: [] }] }));
  };
  const toggleOptionValue = (optionId: string, value: string) => {
    const options = form.options.map((option) => option.id !== optionId ? option : { ...option, values: option.values.includes(value) ? option.values.filter((item) => item !== value) : [...option.values, value] });
    const count = projectedVariantCount(form.colors, options);
    if (count > MAX_VARIANTS) { setIntegrityMessage(`این انتخاب ${count.toLocaleString("fa-IR")} ترکیب می‌سازد و از سقف ${MAX_VARIANTS.toLocaleString("fa-IR")} بیشتر است.`); return; }
    setIntegrityMessage("");
    setForm((old) => ({ ...old, options, variants: synchronizeVariantCombinations(old.colors, options, old.variants, old.price) }));
  };
  const addAttribute = () => { const label = attributeLabel.trim(); const value = attributeValue.trim(); if (!label || !value) return; update("attributes", [...form.attributes, { id: `${Date.now()}-${label}`, label, value }]); setAttributeLabel(""); setAttributeValue(""); };
  const validateStep = (targetStep: number) => {
    if (targetStep === 0) {
      if (!cleanText(form.name)) { setIntegrityMessage("برای ادامه، نام کالا را در مرحلهٔ هویت وارد کنید."); return false; }
      if (!cleanText(form.category)) { setIntegrityMessage("برای ادامه، یک دسته‌بندی انتخاب کنید."); return false; }
    }
    if (targetStep === 1) {
      if (!Number.isFinite(form.price) || form.price <= 0) { setIntegrityMessage("قیمت اصلی باید بزرگ‌تر از صفر باشد."); return false; }
      if (!Number.isFinite(form.stock) || form.stock < 0) { setIntegrityMessage("موجودی نمی‌تواند منفی باشد؛ صفر یعنی کالا ناموجود است."); return false; }
    }
    return true;
  };
  const goToStep = (nextStep: number) => { if (nextStep > step && !validateStep(step)) return; setIntegrityMessage(""); setStep(nextStep); };
  const save = async () => {
    if (!validateStep(0)) { setStep(0); return; }
    if (!validateStep(1)) { setStep(1); return; }
    if (form.options.some((option) => option.values.length === 0)) { setIntegrityMessage("برای هر محور فروش، دست‌کم یک مقدار انتخاب کنید یا محور را حذف کنید."); setStep(3); return; }
    const requestedVariantCount = projectedVariantCount(form.colors, form.options);
    if (requestedVariantCount > MAX_VARIANTS) { setIntegrityMessage(`تعداد ترکیب‌ها از سقف ${MAX_VARIANTS.toLocaleString("fa-IR")} بیشتر است. مقدارهای رنگ یا پیکربندی را کم کنید.`); setStep(3); return; }
    const sku = skuOverride && cleanText(form.sku) ? cleanText(form.sku) : suggestedSku;
    if (existingSkus.some((item) => item.toLocaleUpperCase("en-US") === sku.toLocaleUpperCase("en-US"))) { setIntegrityMessage("این SKU قبلاً برای کالای دیگری ثبت شده است؛ کد دیگری انتخاب کنید."); setSkuOverride(true); setStep(0); return; }
    const normalized = normalizeProductForSave(form, sku);
    const normalizedVariants = normalized.variants ?? [];
    if (form.variants.length !== normalizedVariants.length) { setIntegrityMessage("یک یا چند ترکیب رنگ نامعتبر یا تکراری است؛ رنگ‌های کالا را بررسی کنید."); setStep(3); return; }
    setIntegrityMessage("");
    setIsSaving(true);
    try {
      await onSave(normalized);
    } catch (error) {
      setIntegrityMessage(error instanceof Error ? error.message : "ثبت کالا با خطا روبه‌رو شد. لطفاً دوباره تلاش کنید.");
    } finally {
      setIsSaving(false);
    }
  };
  return <DrawerShell className="product-editor" onClose={onClose} title={product ? "ویرایش کالا" : "افزودن کالای جدید"} subtitle={liveMode ? "اطلاعات، گالری و تصاویر اختصاصی ترکیب‌ها با API فروشگاه ثبت می‌شوند." : "همهٔ تغییرها فقط در دادهٔ demo مرورگر ثبت می‌شوند."}>
    <nav className="stepper" aria-label="مراحل فرم کالا">{steps.map((label, index) => <button type="button" key={label} className={step === index ? "active" : step > index ? "complete" : ""} onClick={() => goToStep(index)}>{`${(index + 1).toLocaleString("fa-IR")}. ${label}`}</button>)}</nav>{integrityMessage && <p className="form-integrity-message" role="alert">{integrityMessage}</p>}
    <section className="product-editor-scroll">
      {step === 0 && <div className="product-stage"><header><span>مرحله ۱ از ۴</span><h3>هویت و نمایش کالا</h3><p>نام و دسته را وارد کنید؛ SKU به‌صورت خودکار ساخته می‌شود و فقط در صورت نیاز قابل ویرایش است.</p></header><div className="product-stage-grid"><label>نام کالا<input value={form.name ?? ""} onChange={(event) => { update("name", event.target.value); if (!skuOverride) update("sku", ""); }} placeholder="مثال: مودم روتر نوین‌نت" /></label><label>دسته‌بندی<ChoiceMenu value={form.category} options={categories.map((row) => row.name)} onChange={(value) => { setForm((old) => ({ ...old, category: value, categoryId: categories.find((category) => category.name === value)?.id })); if (!skuOverride) update("sku", ""); }} /></label><label className="sku-field">کد SKU<div className="sku-input-row"><input dir="ltr" value={(skuOverride ? form.sku : suggestedSku) ?? ""} readOnly={!skuOverride} onChange={(event) => update("sku", event.target.value.toUpperCase())} placeholder="پس از ثبت نام کالا ساخته می‌شود" /><button type="button" onClick={() => { if (skuOverride) { setSkuOverride(false); update("sku", ""); } else { setSkuOverride(true); update("sku", suggestedSku); } }}>{skuOverride ? "خودکار" : "ویرایش"}</button></div><small>{skuOverride ? "کد دلخواه مدیر ذخیره می‌شود." : "کد خودکار بر پایهٔ دسته و نام کالا ساخته می‌شود."}</small></label><label>وضعیت نمایش<ChoiceMenu value={form.active ? "فعال" : "غیرفعال"} options={["فعال", "غیرفعال"]} onChange={(value) => update("active", value === "فعال")} /></label></div></div>}
      {step === 1 && <div className="product-stage"><header><span>مرحله ۲ از ۴</span><h3>قیمت و موجودی</h3><p>{liveMode ? "قیمت اصلی اجباری است. موجودی صفر معتبر است و کالا را ناموجود نشان می‌دهد؛ آمار فروش از API گزارش خوانده می‌شود." : "قیمت فروش و موجودی قابل عرضه را تنظیم کنید."}</p></header><div className="product-stage-grid"><label>قیمت اصلی (تومان) <b>*</b><input inputMode="numeric" value={form.price || ""} onChange={(event) => update("price", parseLocalizedNumber(event.target.value))} placeholder="مثال: ۱۲۵۰۰۰۰" /></label><label>تعداد موجودی<input inputMode="numeric" value={form.stock || ""} onChange={(event) => update("stock", parseLocalizedNumber(event.target.value))} placeholder="۰ یعنی ناموجود" /></label><label>تعداد فروش ثبت‌شده<input inputMode="numeric" value={form.sold || ""} disabled={liveMode} onChange={(event) => update("sold", Number(event.target.value))} placeholder="۰" /></label><div className="inventory-note"><small>وضعیت موجودی</small><b className={form.stock < 7 ? "warn" : ""}>{form.stock > 0 ? form.stock < 7 ? "موجودی کم" : "موجود" : "ناموجود"}</b><span>{(form.stock ?? 0).toLocaleString("fa-IR")} واحد آمادهٔ فروش</span></div></div></div>}
      {step === 2 && <div className="product-stage"><header><span>مرحله ۳ از ۴</span><h3>تصویر کارت و گالری <small>اختیاری</small></h3><p>{liveMode ? "تصویر اصلی و گالری مستقیم روی سرور بارگذاری می‌شوند. کالا بدون تصویر هم ثبت می‌شود، اما برای نمایش فروشگاه تصویر توصیه می‌شود." : "تصویر اصلی در list و کارت‌ها نمایش داده می‌شود؛ گالری فقط در دادهٔ demo مرورگر نگهداری می‌شود."}</p></header><div className="media-upload-row"><label className="image-upload-action"><input type="file" accept="image/*" multiple disabled={uploadingImages} onChange={(event) => { void addImages(event.target.files); event.currentTarget.value = ""; }} />{uploadingImages ? "در حال بارگذاری…" : "بارگذاری تصویر"}</label><span>PNG، JPG یا WEBP · حداکثر ۶ مگابایت برای هر فایل</span></div><div className="gallery-grid">{form.gallery.map((image, index) => <article className={form.image === image ? "gallery-card cover" : "gallery-card"} key={`${image}-${index}`}><img src={image} alt="" /><div><button type="button" onClick={() => update("image", image)}>{form.image === image ? "تصویر کارت" : "انتخاب برای کارت"}</button>{form.gallery.length > 1 && <button type="button" className="remove-image" onClick={() => removeImage(image)}>حذف</button>}</div></article>)}</div></div>}
      {step === 3 && <div className="product-stage"><header><span>مرحله ۴ از ۴</span><h3>جزئیات و ویژگی‌ها <small>همه اختیاری</small></h3><p>ویژگی‌های بالایی بر پایهٔ دسته انتخاب‌شده ثبت می‌شوند و برای فیلتر فروشگاه قابل استفاده‌اند.</p></header><div className="product-stage-grid"><label className="full">توضیحات کالا <small>اختیاری</small><textarea value={form.description ?? ""} onChange={(event) => update("description", event.target.value)} placeholder="توضیح کوتاه و کاربردی کالا..." rows={6} /></label>{categoryDefinitions.length > 0 && <section className="configuration-section full category-facet-section"><div className="configuration-heading"><span><b>ویژگی‌های این دسته</b><small>فیلتر و مشخصات فروشگاه از همین مقادیر خوانده می‌شود.</small></span><em>{categoryDefinitions.length.toLocaleString("fa-IR")}</em></div><div className="product-stage-grid facet-field-grid">{categoryDefinitions.map((definition) => { const value = form.facetValues?.[definition.key] ?? ""; return <label key={definition.id}><span>{definition.name}{definition.unit ? ` (${definition.unit})` : ""}</span>{definition.dataType === "number" ? <input inputMode="numeric" value={value} onChange={(event) => updateFacet(definition.key, event.target.value)} /> : definition.options.length > 0 ? <ChoiceMenu value={value || "انتخاب نشده"} options={["انتخاب نشده", ...definition.options]} onChange={(next) => updateFacet(definition.key, next === "انتخاب نشده" ? "" : next)} /> : <input value={value} onChange={(event) => updateFacet(definition.key, event.target.value)} />}</label>; })}</div></section>}<section className="configuration-section full"><div className="configuration-heading"><span><b>رنگ‌ها</b><small>اختیاری؛ برای کالای رنگ‌بندی‌دار</small></span><em>{form.colors.length.toLocaleString("fa-IR")}</em></div><div className="config-builder color-builder"><input value={colorName} onChange={(event) => setColorName(event.target.value)} placeholder="نام رنگ؛ مثال: مشکی" /><input type="color" value={colorHex} onChange={(event) => setColorHex(event.target.value)} aria-label="کد رنگ" /><button type="button" onClick={addColor}>افزودن رنگ</button></div><div className="color-token-list">{form.colors.length ? form.colors.map((color, index) => <span className="color-token" key={`${color.name}-${index}`}><i style={{ background: color.hex }} /><b>{color.name}</b><button type="button" aria-label={`حذف رنگ ${color.name}`} onClick={() => setForm((old) => { const colors = old.colors.filter((_, itemIndex) => itemIndex !== index); return { ...old, colors, variants: pruneVariants(colors, old.variants) }; })}>×</button></span>) : <p className="config-empty">رنگی برای این کالا لازم نیست.</p>}</div></section><section className="configuration-section full"><div className="configuration-heading"><span><b>ویژگی‌های آزاد</b><small>فقط برای مشخصاتی که فیلتر فروشگاه نیستند.</small></span><em>{form.attributes.length.toLocaleString("fa-IR")}</em></div><div className="config-builder two-input"><input value={attributeLabel} onChange={(event) => setAttributeLabel(event.target.value)} placeholder="نام ویژگی؛ مثال: جنس بدنه" /><input value={attributeValue} onChange={(event) => setAttributeValue(event.target.value)} placeholder="مقدار؛ مثال: آلومینیوم" /><button type="button" onClick={addAttribute}>افزودن ویژگی</button></div><div className="attribute-list">{form.attributes.length ? form.attributes.map((attribute) => <article key={attribute.id}><b>{attribute.label}</b><span>{attribute.value}</span><button type="button" aria-label={`حذف ویژگی ${attribute.label}`} onClick={() => update("attributes", form.attributes.filter((item) => item.id !== attribute.id))}>×</button></article>) : <p className="config-empty">ویژگی آزاد تعریف نشده است.</p>}</div></section><button type="button" className={form.featured ? "feature-toggle active" : "feature-toggle"} onClick={() => update("featured", !form.featured)}><span><b>نمایش ویژه</b><small>کالا در جایگاه‌های ویژهٔ فروشگاه نشان داده شود.</small></span><i>{form.featured ? "روشن" : "خاموش"}</i></button></div></div>}
      {step === 3 && <section className="product-stage product-brand-stage"><header><span>طبقه‌بندی حرفه‌ای کالا</span><h3>برند محصول <small>مستقل از دسته‌بندی</small></h3><p>مثال: دستهٔ «لپ‌تاپ و کامپیوتر» و برند «ایسوس». برند فیلتر و صفحهٔ اختصاصی دارد و زیر‌دستهٔ مصنوعی نیست.</p></header><label>برند<input value={form.brand ?? ""} onChange={(event) => update("brand", event.target.value)} placeholder="مثال: ایسوس، لنوو، سامسونگ" /></label></section>}
      {step === 3 && <VariantConfigurationBuilder category={selectedCategory} definitions={categoryDefinitions} options={form.options} colors={form.colors} onManageCategoryAttributes={onManageCategoryAttributes} onToggleOption={toggleVariantOption} onToggleValue={toggleOptionValue} />}
      {step === 3 && <ProductVariantEditor liveMode={liveMode} colors={form.colors} options={form.options} variants={form.variants} gallery={form.gallery} fallbackImage={form.image} basePrice={form.price} onChange={(variants) => update("variants", variants)} onError={setIntegrityMessage} />}
    </section>
    <footer className="product-editor-footer"><button type="button" disabled={isSaving} onClick={onClose}>انصراف</button>{step > 0 && <button type="button" disabled={isSaving} onClick={() => { setIntegrityMessage(""); setStep((current) => current - 1); }}>مرحله قبل</button>}<button type="button" className="primary" disabled={uploadingImages || isSaving} onClick={() => { if (step < steps.length - 1) goToStep(step + 1); else void save(); }}>{uploadingImages ? "در حال بارگذاری…" : isSaving ? "در حال ذخیره…" : step < steps.length - 1 ? "مرحله بعد" : product ? "ذخیره تغییرات" : "ثبت کالا"}</button></footer>
  </DrawerShell>;
}
function VariantConfigurationBuilder({ category, definitions, options, colors, onManageCategoryAttributes, onToggleOption, onToggleValue }: { category: DemoCategory | null; definitions: AdminProductAttributeDefinition[]; options: ProductOption[]; colors: ProductColor[]; onManageCategoryAttributes: (category: DemoCategory) => void; onToggleOption: (definition: AdminProductAttributeDefinition) => void; onToggleValue: (optionId: string, value: string) => void }) {
  const available = definitions.filter((definition) => definition.dataType === "single_select" && definition.options.length > 0);
  const count = projectedVariantCount(colors, options);
  return <section className="configuration-section full variant-axis-section"><div className="configuration-heading"><span><b>محورهای فروش و پیکربندی</b><small>RAM و حافظه را اول برای دستهٔ کالا تعریف کنید، سپس در همین‌جا برای این کالا انتخاب کنید؛ حداکثر دو محور.</small></span><em>{options.length.toLocaleString("fa-IR")}</em></div>{category ? <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-2"><span className="text-[11px] font-medium text-blue-950">دستهٔ این کالا: <b>{category.name}</b></span><button type="button" className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-[11px] font-bold text-blue-700" onClick={() => onManageCategoryAttributes(category)}>تنظیم RAM و حافظهٔ دسته</button></div> : <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">ابتدا در مرحلهٔ هویت یک دسته برای کالا انتخاب کنید تا محورهای فروش همان دسته را تنظیم کنید.</p>}{available.length ? <><div className="space-y-3">{available.map((definition) => { const option = options.find((item) => item.id === definition.key); const selected = Boolean(option); return <article className={`rounded-xl border p-3 ${selected ? "border-blue-200 bg-blue-50/40" : "border-slate-100 bg-white"}`} key={definition.id}><div className="flex items-center justify-between gap-3"><div><b className="text-xs text-slate-800">{definition.name}</b><p className="mt-1 text-[11px] text-slate-500">{selected ? "مقدارهای فروش را انتخاب کنید." : "به‌عنوان مشخصه و فیلتر باقی می‌ماند."}</p></div><button type="button" className={selected ? "rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-bold text-white" : "rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700"} onClick={() => onToggleOption(definition)}>{selected ? "حذف محور" : "محور فروش"}</button></div>{selected && <div className="mt-3 flex flex-wrap gap-2">{definition.options.map((value) => <button type="button" key={value} onClick={() => onToggleValue(definition.key, value)} className={`rounded-full border px-3 py-1.5 text-[11px] font-bold transition ${option?.values.includes(value) ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-600"}`}>{value}</button>)}</div>}</article>; })}</div><p className="mt-3 text-[11px] text-slate-500">{options.some((option) => option.values.length === 0) ? "برای هر محور فروش، حداقل یک مقدار انتخاب کنید." : count ? `${count.toLocaleString("fa-IR")} ترکیب برای ثبت ساخته می‌شود.` : "برای ساخت variant، رنگ یا دست‌کم یک محور فروش انتخاب کنید."}</p></> : <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-[11px] text-slate-600">{category ? <>هنوز هیچ محور انتخابی برای دستهٔ «{category.name}» آماده نیست. از دکمهٔ بالا «RAM انتخابی» یا «حافظه انتخابی» را تعریف و ذخیره کنید؛ پس از بسته‌شدن این پنجره، همین بخش فوراً گزینه‌ها را نشان می‌دهد.</> : "بدون دسته، محور فروش قابل‌تعریف نیست."}</div>}</section>;
}
function ProductVariantEditor({ liveMode, colors, options, variants, gallery, fallbackImage, basePrice, onChange, onError }: { liveMode: boolean; colors: ProductColor[]; options: ProductOption[]; variants: ProductVariant[]; gallery: string[]; fallbackImage: string; basePrice: number; onChange: (variants: ProductVariant[]) => void; onError: (message: string) => void }) {
  const [imageEditor, setImageEditor] = useState<string | null>(null);
  const [uploadingVariant, setUploadingVariant] = useState<string | null>(null);
  const canGenerate = (colors.length > 0 || options.length > 0) && !options.some((option) => option.values.length === 0);
  const generateVariants = () => { if (!canGenerate) return; onChange(synchronizeVariantCombinations(colors, options, variants, basePrice)); };
  const updateVariant = <K extends keyof ProductVariant>(id: string, key: K, value: ProductVariant[K]) => onChange(variants.map((variant) => variant.id === id ? { ...variant, [key]: value } : variant));
  const uploadVariantImage = async (id: string, files: FileList | null) => { const file = files?.[0]; if (!file || !file.type.startsWith("image/")) return; if (!liveMode) { updateVariant(id, "image", URL.createObjectURL(file)); return; } setUploadingVariant(id); try { updateVariant(id, "image", await api.uploadAdminProductImage(file)); } catch (error) { onError(error instanceof Error ? error.message : "بارگذاری تصویر پیکربندی با خطا روبه‌رو شد."); } finally { setUploadingVariant(null); } };
  return <section className="variant-section"><header className="variant-heading"><span><b>قیمت، موجودی و تصویر هر ترکیب</b><small>هر ترکیب قابل خرید کد داخلی، قیمت و موجودی مستقل دارد. برای حذف ترکیب، رنگ یا مقدار محور فروش را بردارید.</small></span><em>{variants.length.toLocaleString("fa-IR")}</em></header>{canGenerate ? <><div className="variant-summary"><span>{colors.length.toLocaleString("fa-IR")} رنگ</span><span>{options.length.toLocaleString("fa-IR")} محور فروش</span><b>{projectedVariantCount(colors, options).toLocaleString("fa-IR")} ترکیب</b><button type="button" onClick={generateVariants}>به‌روزرسانی ترکیب‌ها</button></div>{variants.length ? <div className="variant-list">{variants.map((variant) => <article key={variant.id}><button type="button" className="variant-image-trigger" aria-label={`تصویر ${variantLabel(variant, options)}`} onClick={() => setImageEditor((current) => current === variant.id ? null : variant.id)}><img src={variant.image ?? fallbackImage} alt="" /><span>تصویر</span></button><div className="variant-name"><b>{variantLabel(variant, options)}</b></div><label>قیمت<input inputMode="numeric" value={variant.price || ""} onChange={(event) => updateVariant(variant.id, "price", parseLocalizedNumber(event.target.value))} /></label><label>موجودی<input inputMode="numeric" value={variant.stock || ""} onChange={(event) => updateVariant(variant.id, "stock", parseLocalizedNumber(event.target.value))} /></label>{imageEditor === variant.id && <div className="variant-image-panel"><b>تصویر {variantLabel(variant, options)}</b><div className="variant-gallery-picker">{gallery.map((image, index) => <button type="button" className={variant.image === image ? "selected" : ""} key={`${image}-${index}`} onClick={() => updateVariant(variant.id, "image", image)}><img src={image} alt="" /><span>گالری {index + 1}</span></button>)}</div><div className="variant-image-actions"><label><input type="file" accept="image/*" disabled={uploadingVariant === variant.id} onChange={(event) => { void uploadVariantImage(variant.id, event.target.files); event.currentTarget.value = ""; }} />{uploadingVariant === variant.id ? "در حال بارگذاری…" : "بارگذاری تصویر اختصاصی"}</label>{variant.image && <button type="button" onClick={() => updateVariant(variant.id, "image", undefined)}>بازگشت به تصویر اصلی</button>}</div></div>}</article>)}</div> : <p className="variant-empty">با تغییر رنگ یا مقدار محور فروش، جدول ترکیب‌ها خودکار ساخته می‌شود.</p>}</> : <p className="variant-empty">ابتدا برای هر محور فروش دست‌کم یک مقدار انتخاب کنید.</p>}</section>;
}
function CategoryAttributeEditor({ category, definitions, liveMode, onClose, onSave }: { category: DemoCategory; definitions: AdminProductAttributeDefinition[]; liveMode: boolean; onClose: () => void; onSave: (drafts: AdminCategoryAttributeDraft[]) => Promise<void> }) {
  const draftFromDefinition = (definition: AdminProductAttributeDefinition): AdminCategoryAttributeDraft => {
    const config = definition.categoryConfigs?.[category.id];
    const dataType = (["single_select", "multi_select", "number", "boolean", "color"] as AttributeDataType[]).includes(definition.dataType as AttributeDataType) ? definition.dataType as AttributeDataType : "single_select";
    return { id: definition.id, key: definition.key, name: definition.name, dataType, unit: definition.unit ?? "", options: [...definition.options], isFilterable: config?.isFilterable ?? definition.isFilterable, isRequired: config?.isRequired ?? definition.isRequired, inheritToChildren: config?.inheritToChildren ?? true, sortOrder: config?.sortOrder ?? definition.sortOrder ?? 100 };
  };
  const [drafts, setDrafts] = useState<AdminCategoryAttributeDraft[]>(() => definitions.filter((definition) => definition.categoryIds.includes(category.id)).map(draftFromDefinition));
  const [optionInputs, setOptionInputs] = useState<Record<string, string>>({});
  const [issue, setIssue] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { setDrafts(definitions.filter((definition) => definition.categoryIds.includes(category.id)).map(draftFromDefinition)); setOptionInputs({}); setIssue(""); }, [category.id, definitions]);
  const updateDraft = (index: number, updates: Partial<AdminCategoryAttributeDraft>) => setDrafts((current) => current.map((draft, currentIndex) => currentIndex === index ? { ...draft, ...updates } : draft));
  const addTemplate = (template: "ram" | "storage" | "new") => {
    const seed = categoryAttributeTemplates[template];
    if (template !== "new" && drafts.some((draft) => draft.key === seed.key)) { setIssue(`ویژگی «${seed.name}» قبلاً به این دسته متصل شده است.`); return; }
    const existing = template === "new" ? undefined : definitions.find((definition) => definition.key === seed.key);
    if (existing) { attachExisting(existing); setIssue(""); return; }
    const serial = drafts.length + 1;
    setDrafts((current) => [...current, { ...seed, key: template === "new" ? `attribute_${serial}` : seed.key, name: template === "new" ? `ویژگی جدید ${serial.toLocaleString("fa-IR")}` : seed.name, options: [...seed.options], sortOrder: (current.length + 1) * 10 }]);
    setIssue("");
  };
  const attachExisting = (definition: AdminProductAttributeDefinition) => {
    if (drafts.some((draft) => draft.id === definition.id || draft.key === definition.key)) return;
    setDrafts((current) => [...current, draftFromDefinition(definition)]);
  };
  const addOption = (index: number) => {
    const inputKey = String(index);
    const value = cleanText(optionInputs[inputKey] ?? "");
    if (!value) return;
    const draft = drafts[index];
    if (draft.options.some((option) => canonicalKey(option) === canonicalKey(value))) { setIssue("این مقدار قبلاً ثبت شده است."); return; }
    if (draft.options.length >= 100) { setIssue("حداکثر ۱۰۰ مقدار برای هر ویژگی مجاز است."); return; }
    updateDraft(index, { options: [...draft.options, value] });
    setOptionInputs((current) => ({ ...current, [inputKey]: "" }));
    setIssue("");
  };
  const save = async () => {
    const keys = new Set<string>();
    for (const draft of drafts) {
      const key = cleanText(draft.key);
      if (!/^[A-Za-z][A-Za-z0-9_-]{0,79}$/.test(key)) { setIssue("کلید ویژگی باید با حرف انگلیسی شروع شود و فقط حرف، عدد، خط تیره یا زیرخط داشته باشد."); return; }
      if (keys.has(key.toLowerCase())) { setIssue("کلید هر ویژگی در این دسته باید یکتا باشد."); return; }
      if (!cleanText(draft.name)) { setIssue("نام همهٔ ویژگی‌ها را وارد کنید."); return; }
      if ((draft.dataType === "single_select" || draft.dataType === "multi_select") && draft.options.length === 0) { setIssue(`برای «${draft.name}» حداقل یک مقدار انتخابی اضافه کنید.`); return; }
      keys.add(key.toLowerCase());
    }
    setSaving(true);
    setIssue("");
    try {
      await onSave(drafts.map((draft, index) => ({ ...draft, key: cleanText(draft.key), name: cleanText(draft.name), unit: cleanText(draft.unit ?? "") || undefined, options: (draft.dataType === "single_select" || draft.dataType === "multi_select") ? draft.options.map(cleanText).filter(Boolean) : [], sortOrder: Math.max(0, Number.isFinite(draft.sortOrder) ? Math.floor(draft.sortOrder) : (index + 1) * 10) })));
    } catch (error) {
      setIssue(error instanceof Error ? error.message : "ذخیره ویژگی‌های دسته انجام نشد.");
      setSaving(false);
    }
  };
  const availableDefinitions = definitions.filter((definition) => !definition.categoryIds.includes(category.id));
  return <DrawerShell className="category-attribute-drawer" onClose={onClose} title={`ویژگی‌های «${category.name}»`} subtitle={liveMode ? "ویژگی‌ها و مقدارهای انتخابی با API فروشگاه ذخیره می‌شوند." : "این تغییرها فقط در دادهٔ preview مرورگر ذخیره می‌شوند."}>
    <section className="category-attribute-editor">
      <header className="category-attribute-intro"><SlidersHorizontal size={20} /><span><b>تنظیم ویژگی‌های این دسته</b><small>فقط «انتخاب یک مقدار» با گزینه‌های ثبت‌شده می‌تواند در فرم کالا محور فروش شود.</small></span></header>
      {issue && <p className="form-integrity-message" role="alert">{issue}</p>}
      <div className="attribute-template-actions"><button type="button" onClick={() => addTemplate("ram")}><Plus size={15} />RAM انتخابی</button><button type="button" onClick={() => addTemplate("storage")}><Plus size={15} />حافظه انتخابی</button><button type="button" className="muted" onClick={() => addTemplate("new")}><Plus size={15} />ویژگی جدید</button></div>
      {drafts.length ? <div className="category-attribute-draft-list">{drafts.map((draft, index) => { const typeLabel = attributeTypeLabels[draft.dataType]; const supportsOptions = draft.dataType === "single_select" || draft.dataType === "multi_select"; return <article className="category-attribute-draft" key={draft.id ? `attr-${draft.id}` : `draft-${draft.key || index}-${index}`}><header><span><b>{draft.name || "ویژگی جدید"}</b><small>{draft.id ? "ویژگی متصل‌شده" : "ویژگی جدید"}</small></span><button type="button" className="remove-draft" aria-label={`حذف ${draft.name || "ویژگی"} از دسته`} onClick={() => setDrafts((current) => current.filter((_, currentIndex) => currentIndex !== index))}><Trash2 size={16} /></button></header><div className="category-attribute-field-grid"><label>نام ویژگی<input value={draft.name ?? ""} onChange={(event) => updateDraft(index, { name: event.target.value })} placeholder="مثال: حافظه RAM" /></label><label>کلید داخلی <small>انگلیسی</small><input dir="ltr" value={draft.key ?? ""} onChange={(event) => updateDraft(index, { key: event.target.value.toLowerCase().replace(/\s+/g, "_") })} placeholder="ram" /></label><label>نوع داده<ChoiceMenu value={typeLabel} options={Object.values(attributeTypeLabels)} onChange={(value) => updateDraft(index, { dataType: (Object.entries(attributeTypeLabels).find(([, label]) => label === value)?.[0] ?? "single_select") as AttributeDataType, options: value === attributeTypeLabels.single_select || value === attributeTypeLabels.multi_select ? draft.options : [] })} /></label><label>واحد <small>اختیاری</small><input value={draft.unit ?? ""} onChange={(event) => updateDraft(index, { unit: event.target.value })} placeholder="GB، اینچ، mAh" /></label></div>{supportsOptions && <section className="attribute-options-editor"><header><span><b>مقدارهای قابل انتخاب</b><small>همین گزینه‌ها در فرم کالا و فیلتر فروشگاه ظاهر می‌شوند.</small></span><em>{draft.options.length.toLocaleString("fa-IR")}</em></header><div className="attribute-option-input"><input value={optionInputs[String(index)] ?? ""} onChange={(event) => setOptionInputs((current) => ({ ...current, [String(index)]: event.target.value }))} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addOption(index); } }} placeholder="مثال: 16GB" /><button type="button" onClick={() => addOption(index)}>افزودن مقدار</button></div><div className="attribute-option-chips">{draft.options.map((option) => <span key={option}>{option}<button type="button" aria-label={`حذف مقدار ${option}`} onClick={() => updateDraft(index, { options: draft.options.filter((item) => item !== option) })}>×</button></span>)}</div></section>}<div className="attribute-rule-toggles"><button type="button" className={draft.isFilterable ? "active" : ""} onClick={() => updateDraft(index, { isFilterable: !draft.isFilterable })}><Check size={14} />فیلتر فروشگاه</button><button type="button" className={draft.isRequired ? "active" : ""} onClick={() => updateDraft(index, { isRequired: !draft.isRequired })}><Check size={14} />ثبت اجباری</button><button type="button" className={draft.inheritToChildren ? "active" : ""} onClick={() => updateDraft(index, { inheritToChildren: !draft.inheritToChildren })}><Check size={14} />برای زیر‌دسته‌ها</button></div></article>; })}</div> : <p className="category-attribute-empty">هنوز ویژگی‌ای به این دسته وصل نیست. RAM یا حافظهٔ انتخابی را اضافه کنید، یا یک ویژگی موجود را از فهرست پایین متصل کنید.</p>}
      {availableDefinitions.length > 0 && <section className="existing-category-attributes"><header><span><b>ویژگی‌های آماده</b><small>برای استفاده در این دسته، روی افزودن بزنید.</small></span></header><div>{availableDefinitions.slice(0, 12).map((definition) => <button type="button" key={definition.id} onClick={() => attachExisting(definition)}><span><b>{definition.name}</b><small>{attributeTypeLabels[definition.dataType as AttributeDataType] ?? definition.dataType}</small></span><Plus size={16} /></button>)}</div></section>}
    </section>
    <DrawerFooter onClose={onClose} onSave={() => { void save(); }} label={saving ? "در حال ذخیره…" : "ذخیره ویژگی‌های دسته"} />
  </DrawerShell>;
}
function CategoryEditor({ category, categories, liveMode, onClose, onSave }: { category: DemoCategory | null; categories: DemoCategory[]; liveMode: boolean; onClose: () => void; onSave: (category: DemoCategory) => void }) {
  const [form, setForm] = useState<DemoCategory>(category ?? { id: 0, name: "", slug: "", products: 0, active: true, parentId: null });
  const parentOptions = ["دستهٔ اصلی", ...categories.filter((item) => item.id !== category?.id).map((item) => item.name)];
  const selectedParent = categories.find((item) => item.id === form.parentId)?.name || "دستهٔ اصلی";
  return <DrawerShell onClose={onClose} title={category ? "ویرایش دسته" : "ایجاد دسته"} subtitle={liveMode ? "پس از ذخیره، تغییر با API فروشگاه ثبت می‌شود." : "این تغییر فقط در دادهٔ نمایشی ثبت می‌شود"}><section className="editor-form"><label>نام دسته<input value={form.name ?? ""} onChange={(event) => setForm({ ...form, name: event.target.value, slug: category ? form.slug : event.target.value.toLowerCase().replace(/\s+/g, "-") })} /></label><label>دستهٔ والد<ChoiceMenu value={selectedParent} options={parentOptions} onChange={(value) => setForm({ ...form, parentId: value === "دستهٔ اصلی" ? null : categories.find((item) => item.name === value)?.id ?? null })} /></label><label>Slug<input value={form.slug ?? ""} dir="ltr" onChange={(event) => setForm({ ...form, slug: event.target.value })} /></label><label>وضعیت<ChoiceMenu value={form.active ? "فعال" : "غیرفعال"} options={["فعال", "غیرفعال"]} onChange={(value) => setForm({ ...form, active: value === "فعال" })} /></label></section><DrawerFooter onClose={onClose} onSave={() => form.name.trim() && onSave(form)} label="ذخیره دسته" /></DrawerShell>;
}
function DiscountEditor({ discount, onClose, onSave }: { discount: DemoDiscount | null; onClose: () => void; onSave: (discount: DemoDiscount) => void }) {
  const [form, setForm] = useState<DemoDiscount>(discount ?? { id: 0, code: "", title: "", amount: "۱۰٪", used: "۰ از ۱۰۰ بار", usedCount: 0, usageLimit: 100, minimumOrder: 0, startsAt: "همین حالا", endsAt: "بدون تاریخ", expires: "بدون تاریخ", active: true });
  const updateNumber = (key: "usageLimit" | "usedCount" | "minimumOrder", value: string) => setForm((old) => ({ ...old, [key]: parseLocalizedNumber(value) }));
  const save = () => {
    if (!form.code.trim() || !form.title.trim()) return;
    const usageLimit = nonNegativeInteger(form.usageLimit);
    const usedCount = Math.min(nonNegativeInteger(form.usedCount), usageLimit);
    const minimumOrder = nonNegativeInteger(form.minimumOrder);
    const endsAt = form.endsAt.trim() || "بدون تاریخ";
    onSave({ ...form, code: form.code.trim().toUpperCase(), title: form.title.trim(), usageLimit, usedCount, minimumOrder, startsAt: form.startsAt.trim() || "همین حالا", endsAt, used: `${usedCount.toLocaleString("fa-IR")} از ${usageLimit.toLocaleString("fa-IR")} بار`, expires: `تا ${endsAt}` });
  };
  return <DrawerShell onClose={onClose} title={discount ? "ویرایش کد تخفیف" : "ایجاد کد تخفیف"} subtitle="شرایط کد فقط در دادهٔ demo مرورگر ثبت می‌شود">
    <section className="editor-form discount-editor">
      <div className="form-heading full"><h2>اطلاعات و شرایط کد</h2><p>سقف مصرف و حداقل خرید، شرط‌های اصلی استفاده از کد هستند.</p></div>
      <label>عنوان جشنواره<input value={form.title ?? ""} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
      <label>کد تخفیف<input value={form.code ?? ""} dir="ltr" onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} /></label>
      <label>مقدار تخفیف<input value={form.amount ?? ""} onChange={(event) => setForm({ ...form, amount: event.target.value })} placeholder="مثال: ۱۰٪ یا ۳۰٬۰۰۰ تومان" /></label>
      <label>حداکثر دفعات استفاده<input inputMode="numeric" value={form.usageLimit || ""} onChange={(event) => updateNumber("usageLimit", event.target.value)} placeholder="مثال: ۵۰۰" /></label>
      <label>تعداد مصرف‌شده<input inputMode="numeric" value={form.usedCount || ""} onChange={(event) => updateNumber("usedCount", event.target.value)} placeholder="۰" /></label>
      <label>حداقل مبلغ سفارش (تومان)<input inputMode="numeric" value={form.minimumOrder || ""} onChange={(event) => updateNumber("minimumOrder", event.target.value)} placeholder="۰ برای بدون حداقل خرید" /></label>
      <label>شروع اعتبار<input value={form.startsAt ?? ""} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} placeholder="مثال: ۱۴۰۴/۰۱/۰۱" /></label>
      <label>پایان اعتبار<input value={form.endsAt ?? ""} onChange={(event) => setForm({ ...form, endsAt: event.target.value })} placeholder="مثال: ۱۴۰۴/۱۲/۲۹" /></label>
      <label>وضعیت<ChoiceMenu value={form.active ? "فعال" : "غیرفعال"} options={["فعال", "غیرفعال"]} onChange={(value) => setForm({ ...form, active: value === "فعال" })} /></label>
    </section>
    <DrawerFooter onClose={onClose} onSave={save} label="ذخیره شرایط کد" />
  </DrawerShell>;
}
function CampaignEditor({ campaign, onClose, onSave }: { campaign: DemoCampaign | null; onClose: () => void; onSave: (campaign: DemoCampaign) => void }) {
  const [form, setForm] = useState<DemoCampaign>(campaign ?? { id: 0, name: "", kind: "سبد رهاشده", trigger: "افزودن کالا بدون تکمیل خرید", audience: "کاربر شناسایی‌شده", channel: "پیامک", offer: "یادآوری بدون تخفیف", delay: "۱ ساعت پس از trigger", delayValue: 1, delayUnit: "ساعت", smsTemplate: "{{نام_کاربر}}، {{نام_کالا}} هنوز در سبد شماست. ادامهٔ خرید: {{لینک}}", frequency: "هر ۷ روز", active: true, delivered: 0, recovered: 0 });
  const variables = [{ label: "نام مشتری", token: "{{نام_کاربر}}" }, { label: "نام کالا", token: "{{نام_کالا}}" }, { label: "کد تخفیف", token: "{{کد_تخفیف}}" }, { label: "لینک", token: "{{لینک}}" }, { label: "مبلغ سبد", token: "{{مبلغ_سبد}}" }];
  const sample = { "{{نام_کاربر}}": "سارا احمدی", "{{نام_کالا}}": "مودم 5G H112-372", "{{کد_تخفیف}}": "NOVIN15", "{{لینک}}": "noovinnet.ir/r/ab12", "{{مبلغ_سبد}}": "۸۵۰٬۰۰۰ تومان" };
  const preview = Object.entries(sample).reduce((text, [token, value]) => text.replaceAll(token, value), form.smsTemplate);
  const addVariable = (token: string) => setForm((old) => ({ ...old, smsTemplate: `${old.smsTemplate}${old.smsTemplate ? " " : ""}${token}` }));
  const save = () => { if (!form.name.trim() || !form.trigger.trim() || !form.audience.trim()) return; const delayValue = nonNegativeInteger(form.delayValue); const delay = delayValue === 0 ? "بلافاصله" : `${delayValue.toLocaleString("fa-IR")} ${form.delayUnit} پس از trigger`; onSave({ ...form, name: cleanText(form.name), trigger: cleanText(form.trigger), audience: cleanText(form.audience), offer: cleanText(form.offer), delay, delayValue, smsTemplate: form.smsTemplate.trim(), frequency: cleanText(form.frequency), delivered: nonNegativeInteger(form.delivered), recovered: nonNegativeInteger(form.recovered) }); };
  return <DrawerShell className="campaign-drawer" onClose={onClose} title={campaign ? "ویرایش کمپین" : "ایجاد کمپین"} subtitle="تنظیمات فقط برای پیش‌نمایش workflow در مرورگر ذخیره می‌شوند"><section className="editor-form campaign-editor"><div className="form-heading full"><h2>قانون، زمان و پیام کمپین</h2><p>در اجرای واقعی، trigger و مخاطب باید توسط backend و پنل پیامکی اعتبارسنجی شوند.</p></div><label>نام کمپین<input value={form.name ?? ""} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label>نوع سناریو<ChoiceMenu value={form.kind} options={["سبد رهاشده", "پرداخت رهاشده", "خوش‌آمدگویی", "پس از خرید", "بازگردانی مشتری", "موجودشدن کالا", "وفاداری"]} onChange={(value) => setForm({ ...form, kind: value as CampaignKind })} /></label><label>trigger<input value={form.trigger ?? ""} onChange={(event) => setForm({ ...form, trigger: event.target.value })} /></label><label>مخاطب<input value={form.audience ?? ""} onChange={(event) => setForm({ ...form, audience: event.target.value })} /></label><label>کانال<ChoiceMenu value={form.channel} options={["پیامک", "ایمیل"]} onChange={(value) => setForm({ ...form, channel: value as DemoCampaign["channel"] })} /></label><label>پیشنهاد یا تخفیف<input value={form.offer ?? ""} onChange={(event) => setForm({ ...form, offer: event.target.value })} /></label><label className="delay-field">تأخیر ارسال<div className="delay-control"><input inputMode="numeric" dir="ltr" value={form.delayValue || ""} onChange={(event) => setForm({ ...form, delayValue: parseLocalizedNumber(event.target.value) })} placeholder="۰" /><ChoiceMenu value={form.delayUnit} options={["دقیقه", "ساعت", "روز"]} onChange={(value) => setForm({ ...form, delayUnit: value as DemoCampaign["delayUnit"] })} /></div><small>{(form.delayValue ?? 0) === 0 ? "ارسال فوری پس از trigger" : `ارسال ${(form.delayValue ?? 0).toLocaleString("fa-IR")} ${form.delayUnit} پس از trigger`}</small></label><label>محدودیت تکرار<input value={form.frequency ?? ""} onChange={(event) => setForm({ ...form, frequency: event.target.value })} /></label><label>وضعیت<ChoiceMenu value={form.active ? "فعال" : "غیرفعال"} options={["فعال", "غیرفعال"]} onChange={(value) => setForm({ ...form, active: value === "فعال" })} /></label><div className="sms-template-field full"><span>متن پیامک</span><textarea value={form.smsTemplate ?? ""} onChange={(event) => setForm({ ...form, smsTemplate: event.target.value })} placeholder="متن پیامک را بنویسید..." /><div className="sms-variable-chips">{variables.map((item) => <button type="button" key={item.token} onClick={() => addVariable(item.token)}>{item.label}</button>)}</div></div><section className="sms-preview full"><header><span><Megaphone size={16} />پیش‌نمایش زنده</span><small>دادهٔ نمونه · ارسال واقعی ندارد</small></header><p>{preview || "برای مشاهدهٔ پیام، متن پیامک را وارد کنید."}</p></section></section><DrawerFooter onClose={onClose} onSave={save} label="ذخیره تنظیمات کمپین" /></DrawerShell>;
}
function UserEditor({ user, liveMode, onClose, onSave }: { user: DemoUser; liveMode: boolean; onClose: () => void; onSave: (user: DemoUser) => Promise<void> }) {
  const [form, setForm] = useState(user);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    setError("");
    setIsSaving(true);
    try {
      await onSave(form);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "ذخیره‌سازی مشتری انجام نشد.");
    } finally {
      setIsSaving(false);
    }
  };
  const verificationFacts = [
    { label: "تأیید ایمیل", value: form.emailVerified ? "تأیید شده" : "تأیید نشده", good: form.emailVerified },
    { label: "تأیید موبایل", value: form.phoneVerified ? "تأیید شده" : "تأیید نشده", good: form.phoneVerified },
    { label: "روش ورود", value: form.hasPassword ? "رمز عبور فعال" : "ورود با شماره موبایل", good: true },
  ];

  return <DrawerShell className="customer-editor-drawer" onClose={onClose} title="پروندهٔ مشتری" subtitle={liveMode ? `${user.email} · اطلاعات از API مشتریان خوانده شده است.` : `${user.email} · دادهٔ نمایشی برای بازبینی رابط`}>
    <div className="customer-editor-scroll">
      <section className="customer-detail-hero">
        <div><small>شناسهٔ مشتری</small><b>#{(form.id ?? 0).toLocaleString("fa-IR")}</b><span>{form.joinDate ? `عضویت از ${form.joinDate}` : "تاریخ عضویت ثبت نشده"}</span></div>
        <span className={form.active ? "customer-account-state active" : "customer-account-state suspended"}>{form.active ? "حساب فعال" : "حساب محدود"}</span>
      </section>

      <section className="customer-detail-section">
        <header><div><span>اطلاعات تماس و حساب</span><small>مشخصات ثبت‌شدهٔ صاحب حساب</small></div></header>
        <div className="customer-fact-grid">
          <article><small>نام کامل</small><b>{form.name}</b></article>
          <article><small>شماره موبایل</small><b dir="ltr">{form.phone || "ثبت نشده"}</b></article>
          <article className="wide"><small>ایمیل</small><b dir="ltr">{form.email || "ثبت نشده"}</b></article>
          <article><small>نقش حساب</small><b>{form.role}</b></article>
          <article><small>تاریخ عضویت</small><b>{form.joinDate || "ثبت نشده"}</b></article>
        </div>
        <div className="customer-verification-list">{verificationFacts.map((item) => <span className={item.good ? "verified" : "unverified"} key={item.label}><ShieldCheck size={14} /><small>{item.label}</small><b>{item.value}</b></span>)}</div>
      </section>

      <section className="customer-detail-section">
        <header><div><span>آدرس‌های ثبت‌شده</span><small>{form.addresses.length ? `${form.addresses.length.toLocaleString("fa-IR")} نشانی در حساب مشتری` : "هنوز نشانی ثبت نشده است"}</small></div></header>
        <div className="customer-address-list">{form.addresses.length ? form.addresses.map((address) => <article className="customer-address-card" key={address.id}>
          <header><div><b>{address.title}</b>{address.is_default && <em>آدرس پیش‌فرض</em>}</div><span>{address.recipient_name}</span></header>
          <p>{address.address_line}</p>
          <footer><span>{address.province}، {address.city}</span><span>کدپستی: <b dir="ltr">{address.postal_code}</b></span><span>گیرنده: <b dir="ltr">{address.phone}</b></span></footer>
        </article>) : <p className="customer-empty-address">این مشتری هنوز نشانی برای ارسال یا صورتحساب ثبت نکرده است.</p>}</div>
      </section>

      <section className="customer-detail-section customer-activity-section">
        <header><div><span>خلاصهٔ فعالیت</span><small>شاخص‌های ثبت‌شده در فروشگاه</small></div></header>
        <div className="customer-activity-grid">
          <article><small>موجودی کیف پول</small><b>{money(form.wallet)}</b><span>اعتبار قابل استفاده</span></article>
          <article><small>کل سفارش‌ها</small><b>{(form.ordersCount ?? 0).toLocaleString("fa-IR")}</b><span>سفارش ثبت‌شده</span></article>
          <article><small>تیکت‌های باز</small><b>{(form.openTicketsCount ?? 0).toLocaleString("fa-IR")}</b><span>{form.openTicketsCount ? "نیازمند پیگیری" : "بدون مورد باز"}</span></article>
          <article><small>آخرین سفارش</small><b>{form.lastOrderAt || "ثبت نشده"}</b><span>تاریخ آخرین سفارش</span></article>
        </div>
      </section>

      <section className="editor-form customer-editor-form">
        {error && <p className="form-integrity-message" role="alert">{error}</p>}
        <div className="customer-editor-heading"><b>مدیریت دسترسی و اعتبار</b><small>{liveMode ? "تغییرها فقط پس از پاسخ موفق API ثبت می‌شوند." : "تغییرها فقط در دادهٔ نمایشی ذخیره می‌شوند."}</small></div>
        <label>نام<input value={form.name ?? ""} disabled={liveMode} onChange={(event) => setForm({ ...form, name: event.target.value })} /><small>{liveMode ? "نام و ایمیل از حساب کاربری خوانده می‌شوند." : "نام فقط در دادهٔ نمایشی قابل ویرایش است."}</small></label>
        <label>سطح دسترسی<ChoiceMenu value={form.role} options={["مدیر ارشد", "کارشناس", "مشتری"]} onChange={(value) => setForm({ ...form, role: value as DemoUser["role"] })} /></label>
        <label>کیف پول (تومان)<input inputMode="numeric" value={form.wallet ?? ""} onChange={(event) => setForm({ ...form, wallet: parseLocalizedNumber(event.target.value) })} /></label>
        <label>وضعیت<ChoiceMenu value={form.active ? "فعال" : "غیرفعال"} options={["فعال", "غیرفعال"]} onChange={(value) => setForm({ ...form, active: value === "فعال" })} /></label>
      </section>
    </div>
    <DrawerFooter onClose={onClose} onSave={() => void save()} disabled={isSaving} label={isSaving ? "در حال ذخیره…" : "ذخیره تغییرات"} />
  </DrawerShell>;
}
function DrawerShell({ title, subtitle, onClose, children, className = "" }: { title: string; subtitle: string; onClose: () => void; children: ReactNode; className?: string }) { return <div className="drawer-backdrop" onMouseDown={(event) => event.currentTarget === event.target && onClose()}><aside className={`drawer ${className}`}><div className="drawer-top"><span><small>{subtitle}</small><h2>{title}</h2></span><IconButton label="بستن" onClick={onClose}><X size={19} /></IconButton></div>{children}</aside></div>; }
function DrawerFooter({ onClose, onSave, label, disabled = false }: { onClose: () => void; onSave: () => void; label: string; disabled?: boolean }) { return <footer className="drawer-footer"><button onClick={onClose} disabled={disabled}>انصراف</button><button className="primary" onClick={onSave} disabled={disabled}>{label}</button></footer>; }
function ConfirmDialog({ title, description, onCancel, onConfirm }: { title: string; description: string; onCancel: () => void; onConfirm: () => void }) { return <div className="modal-backdrop"><section className="confirm-dialog"><h2>{title}</h2><p>{description}</p><div><button onClick={onCancel}>انصراف</button><button className="danger" onClick={onConfirm}>تأیید حذف</button></div></section></div>; }
function Empty() { return <div className="empty-state"><div className="empty-state-icon"><Package size={28} /></div><b>موردی پیدا نشد</b><span>فیلتر یا عبارت جست‌وجو را تغییر دهید.</span></div>; }

export default StagingAdminReplica;
