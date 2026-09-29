import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile('src/components/admin/staging/StagingAdminReplica.tsx', 'utf8');

assert.match(source, /onManageCategoryAttributes=\{\(category\) => setEditingCategoryAttributes\(category\)\}/, 'فرم کالا باید drawer مدیریت ویژگی‌های همان دسته را باز کند.');
assert.match(source, /function VariantConfigurationBuilder\(\{ category, definitions, options, colors, onManageCategoryAttributes/, 'سازندهٔ محور فروش باید دستهٔ انتخاب‌شده و callback مدیریت آن را دریافت کند.');
assert.match(source, /تنظیم RAM و حافظهٔ دسته/, 'دکمهٔ مستقیم تنظیم RAM و حافظه باید در فرم کالا نمایش داده شود.');
assert.match(source, /هنوز هیچ محور انتخابی برای دسته/, 'فرم کالا باید در نبود محور، پیام عملی و غیرگمراه‌کننده نمایش دهد.');
assert.match(source, /از دکمهٔ بالا «RAM انتخابی» یا «حافظه انتخابی» را تعریف و ذخیره کنید/, 'حالت خالی باید مسیر دقیق آماده‌سازی محور را توضیح دهد.');
assert.match(source, /dataType === "single_select" && definition\.options\.length > 0/, 'فقط ویژگی‌های انتخابی با گزینه‌های ثبت‌شده باید محور فروش شوند.');
assert.match(source, /حداکثر \$\{MAX_VARIANT_OPTIONS\.toLocaleString\("fa-IR"\)\} محور فروش/, 'سقف دو محور فروش باید حفظ شود.');
assert.match(source, /MAX_VARIANTS/, 'سقف تعداد ترکیب‌ها باید همچنان کنترل شود.');

console.log('Product axis quick-setup frontend contract passed.');
