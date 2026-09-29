import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const files = {
  mapper: await readFile(resolve(root, 'src/services/apiMappers.ts'), 'utf8'),
  detail: await readFile(resolve(root, 'src/components/ProductDetailView.tsx'), 'utf8'),
  admin: await readFile(resolve(root, 'src/components/admin/staging/StagingAdminReplica.tsx'), 'utf8'),
  adapter: await readFile(resolve(root, 'src/components/admin/staging/adminLiveData.ts'), 'utf8'),
  availability: await readFile(resolve(root, 'src/utils/productAvailability.ts'), 'utf8'),
  context: await readFile(resolve(root, 'src/context/AppContext.tsx'), 'utf8'),
  catalog: await readFile(resolve(root, 'src/components/CatalogView.tsx'), 'utf8'),
  popular: await readFile(resolve(root, 'src/components/PopularProducts.tsx'), 'utf8'),
  deals: await readFile(resolve(root, 'src/components/SpecialDeals.tsx'), 'utf8'),
  adminLayout: await readFile(resolve(root, 'src/components/admin/AdminLayout.tsx'), 'utf8'),
  colorVariantMapping: await readFile(resolve(root, 'src/components/admin/staging/productVariantColorMapping.ts'), 'utf8'),
  floatingCart: await readFile(resolve(root, 'src/components/MobileFloatingCart.tsx'), 'utf8'),
};

const requiredContracts = [
  ['mapper تصویر variant', files.mapper, 'image_url: firstNonEmptyString(variant.image_url, variant.attributes?.image_url)'],
  ['انتخاب رنگ storefront', files.detail, 'const selectColor = (colorName: string)'],
  ['تطبیق رنگ با variant فعال', files.detail, 'const matchingVariant = activeColorVariants.find'],
  ['نمایش تصویر variant', files.detail, 'setActiveImage(variant.image_url || product.image_url)'],
  ['upload تصویر محصول', files.admin, 'api.uploadAdminProductImage(file)'],
  ['ذخیرهٔ تصویر variant', files.adapter, 'image_url: serverImage(variant.image)'],
  ['یک variant برای هر رنگ در فرم ادمین', files.colorVariantMapping, 'const variantsByColor = new Map'],
  ['حفظ جدیدترین variant تکراری رنگ', files.colorVariantMapping, 'Number(variant.id) > Number(current.id)'],
  ['همگام‌سازی کامل رنگ و variant در فرم', files.admin, 'const synchronizeVariantsWithColors ='],
  ['ترکیب رنگ‌محور کالا', files.admin, 'const appendMissingVariants = (colors: ProductColor[], current: ProductVariant[]'],
  ['انتظار پاسخ API هنگام ذخیرهٔ کالا', files.admin, 'await operations.saveProduct(saved, editingProduct === "new" ? "create" : "update")'],
  ['تبدیل امن مشخصات پیچیدهٔ محصول', files.detail, 'const formatSpecValue = (value: unknown): string =>'],
  ['استفاده از تبدیل امن در جدول مشخصات', files.detail, '{formatSpecValue(val)}'],
  ['نرمال‌سازی رنگ‌های metadata ادمین', files.mapper, 'const normalizeProductColors = (value: unknown): Product[\'colors\'] | undefined =>'],
  ['حذف metadata رنگ از مشخصات مشتری', files.mapper, "const ignoredKeys = new Set(['novinet_admin_colors', 'admin_colors', 'images', 'image_url']);"],
  ['نرمال‌سازی مشخصات به متن', files.mapper, 'const normalizeProductSpecs = (value: unknown): Record<string, string> | undefined =>'],
  ['بازنشانی فرم هنگام تغییر کالا', files.admin, 'const productIdentity = product?.id ?? "new";'],
  ['حذف variant رنگ نامرتبط از فرم', files.colorVariantMapping, 'if (!key || !colorsByKey.has(key)) continue;'],
  ['ارسال موجودی پایه به API', files.adapter, 'initial_stock: Math.max(0, asNumber(product.stock))'],
  ['variant جدید با موجودی صفر', files.admin, 'price: nonNegativeInteger(price), stock: 0'],
  ['معیار مشترک variant قابل فروش', files.availability, 'export const isSellableVariant'],
  ['فیلتر variant فعال و دارای موجودی', files.availability, 'variant?.is_active && (variant.stock_quantity ?? 0) > 0'],
  ['محاسبهٔ موجودی API از variantهای فعال', files.mapper, 'in_stock: hasVariants ? hasVariantStock'],
  ['انتخاب variant قابل فروش در سبد', files.context, 'getDefaultSellableVariant(product)'],
  ['جلوگیری از درخواست سبد برای کالای ناموجود', files.context, 'این کالا در حال حاضر ناموجود است.'],
  ['کارت کاتالوگ با معیار واحد موجودی', files.catalog, 'const canQuickAdd = isProductPurchasable(product);'],
  ['کارت محبوب با معیار واحد موجودی', files.popular, 'const canPurchase = isProductPurchasable(product);'],
  ['کارت پیشنهاد ویژه با معیار واحد موجودی', files.deals, 'const canPurchase = isProductPurchasable(product);'],
  ['fallback تصویر کاتالوگ', files.catalog, "event.currentTarget.src = '/images/product-placeholder.svg'"],
  ['fallback تصویر صفحهٔ محصول', files.detail, "event.currentTarget.src = '/images/product-placeholder.svg'"],
  ['افزودن asynchronous به سبد', files.context, 'const addToCart = async'],
  ['نتیجهٔ موفقیت واقعی افزودن به سبد', files.context, 'return true;'],
  ['نمایش موفقیت فقط پس از پاسخ سبد', files.detail, 'const added = await addToCart(product, quantity, selectedVariantId);'],
  ['سقف تعداد صفحهٔ محصول', files.detail, 'const isAtQuantityLimit = isOutOfStock || quantity >= selectedStock;'],
  ['محدودسازی دکمهٔ افزایش به موجودی', files.detail, 'Math.min(selectedStock, current + 1)'],
  ['انتخابگر دایره‌ای رنگ فعال', files.detail, 'const colorChoices = activeColorVariants.reduce'],
  ['غیرفعال‌سازی رنگ ناموجود', files.detail, 'disabled={unavailable}'],
  ['ثبت await شدهٔ ویرایش محصول در ادمین', files.adminLayout, 'await updateProduct(product.id, payload);'],
  ['CTA درون صفحه فقط از تبلت به بالا', files.detail, 'hidden sm:block rounded-2xl'],
  ['تنها نوار خرید موبایل محصول', files.detail, 'sm:hidden fixed inset-x-3 bottom-[76px]'],
  ['ترتیب قطعی کنترل تعداد', files.detail, 'dir="ltr" className="flex shrink-0 items-center'],
  ['عدم نمایش سبد شناور روی صفحهٔ محصول', files.floatingCart, "activeView === 'product-detail'"],
];

const missing = requiredContracts.filter(([, content, snippet]) => !content.includes(snippet)).map(([label]) => label);
if (missing.length) {
  throw new Error(`قراردادهای media frontend پیدا نشدند: ${missing.join('، ')}`);
}

const forbiddenContracts = [
  ['فیلد سایز در فرم ادمین', files.admin, '<b>سایزها</b>'],
  ['ارسال سایز در payload ادمین', files.adapter, 'size: variant.size'],
  ['انتقال خام attributes به مشخصات مشتری', files.mapper, 'specs: product.specs || attributes'],
  ['ارسال stock_quantity به‌جای موجودی پایه', files.adapter, 'stock_quantity: Math.max(0, asNumber(product.stock))'],
];

const present = forbiddenContracts.filter(([, content, snippet]) => content.includes(snippet)).map(([label]) => label);
if (present.length) {
  throw new Error(`قراردادهای حذف‌شده نباید بازگردند: ${present.join('، ')}`);
}

console.log('Product media frontend contract: PASS');
