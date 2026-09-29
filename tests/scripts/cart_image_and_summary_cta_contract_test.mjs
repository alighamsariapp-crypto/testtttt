import { readFile } from 'node:fs/promises';

const read = (path) => readFile(path, 'utf8');

const [cartService, cartStep] = await Promise.all([
  read('app/Modules/Cart/Services/CartService.php'),
  read('src/components/cart/CartStep1Items.tsx'),
]);

const requiredContracts = [
  ['تصویر اختصاصی variant در پاسخ سبد', cartService, "$variant->attributes['image_url']"],
  ['fallback تصویر اصلی محصول در پاسخ سبد', cartService, '$variant->product->images'],
  ['ارسال image_url به آیتم سبد', cartService, "'image_url' => $imageUrl"],
  ['نمایش image_url در ردیف سبد', cartStep, 'src={item.image_url}'],
  ['کارت خلاصه relative برای CTA موبایل', cartStep, 'relative lg:col-span-4'],
  ['CTA موبایل absolute داخل کارت خلاصه', cartStep, 'absolute inset-x-6 bottom-5'],
  ['CTA با متن کامل', cartStep, '<span>ثبت و ادامه خرید</span>'],
];

const missing = requiredContracts
  .filter(([, source, needle]) => !source.includes(needle))
  .map(([label]) => label);

if (missing.length > 0) {
  throw new Error(`قراردادهای تصویر و CTA سبد پیدا نشدند: ${missing.join('، ')}`);
}

if (cartStep.includes('MOBILE FLOATING CHECKOUT BAR')) {
  throw new Error('نوار fixed سراسری checkout در موبایل نباید بازگردد.');
}

console.log('Cart image and summary CTA contract: PASS');
