import { readFileSync } from 'node:fs';

const root = new URL('../..', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const workspace = read('src/components/admin/staging/BlogManagementPage.tsx');
const replica = read('src/components/admin/staging/StagingAdminReplica.tsx');
const context = read('src/context/AppContext.tsx');
const api = read('src/services/api.ts');
const backend = read('app/Modules/Settings/Services/SettingService.php');
const blogImageController = read('app/Modules/Settings/Controllers/BlogImageUploadController.php');
const articleDetail = read('src/components/ArticleDetailView.tsx');
const routes = read('routes/api.php');
const css = read('src/components/admin/staging/blog-management.css');

const contracts = [
  ['منوی وبلاگ در پنل وجود دارد', replica, 'وبلاگ و مقالات'],
  ['workspace واقعی وبلاگ رندر می‌شود', replica, '<BlogManagementPage'],
  ['ایجاد مقاله در editor وجود دارد', workspace, 'مقالهٔ جدید'],
  ['حالت پیش‌نویس و انتشار وجود دارد', workspace, 'وضعیت انتشار'],
  ['تصویر شاخص و preview وجود دارد', workspace, 'تصویر شاخص'],
  ['آپلود مستقیم تصویر شاخص وجود دارد', workspace, 'انتخاب و بارگذاری تصویر'],
  ['client API upload تصویر وبلاگ وجود دارد', api, 'uploadAdminBlogImage'],
  ['مسیر محافظت‌شدهٔ upload وبلاگ وجود دارد', routes, "/blog/images"],
  ['backend فایل تصویر وبلاگ را در مسیر جدا ذخیره می‌کند', blogImageController, "uploads'.DIRECTORY_SEPARATOR.'blog"],
  ['نوار ابزار افزودن و حذف لینک وجود دارد', workspace, 'افزودن لینک'],
  ['حذف لینک از متن وجود دارد', workspace, 'حذف لینک'],
  ['رندر امن لینک در مقالهٔ عمومی وجود دارد', articleDetail, 'safeArticleHref'],
  ['برچسب‌ها و SEO پایه قابل ویرایش‌اند', workspace, 'نشانی مقاله (slug)'],
  ['حذف مقاله confirmation دارد', workspace, 'حذف دائمی'],
  ['فیلتر و جستجوی مقالات وجود دارد', workspace, 'جستجوی عنوان، نویسنده یا برچسب'],
  ['عملیات وبلاگ promise-based است', context, 'addBlogPost: (post: Omit<BlogPost'],
  ['تنظیمات public وبلاگ در startup خوانده می‌شوند', context, 'settings.blog_posts?.posts'],
  ['API دریافت public settings دارد', api, "'/settings/public'"],
  ['backend گروه وبلاگ را public می‌کند', backend, "'blog_posts'"],
  ['layout responsive workspace وجود دارد', css, '.blog-editor-layout'],
  ['ظاهر upload تصویر هم‌سبک پنل است', css, '.blog-image-upload-action'],
  ['modal لینک هم‌سبک پنل است', css, '.blog-link-dialog'],
];

const missing = contracts.filter(([, content, expected]) => !content.includes(expected)).map(([label]) => label);
if (missing.length) throw new Error(`قراردادهای مدیریت وبلاگ ناقص‌اند: ${missing.join('، ')}`);
console.log('Admin blog management contract: PASS');
