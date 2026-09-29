import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const root = new URL('../..', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const editor = read('src/components/admin/staging/ContentManagementPage.tsx');
const replica = read('src/components/admin/staging/StagingAdminReplica.tsx');
const context = read('src/context/AppContext.tsx');
const api = read('src/services/api.ts');
const css = read('src/components/admin/staging/content-management.css');
const footer = read('src/components/Footer.tsx');
const homepageEditor = read('src/components/admin/staging/HomepageContentManagementPage.tsx');
const hero = read('src/components/HeroSection.tsx');
const quickAccess = read('src/components/QuickAccessGrid.tsx');
const servicesBanner = read('src/components/FeaturedServiceBanner.tsx');
const partners = read('src/components/PartnersSection.tsx');
const homepageLinks = read('src/utils/homepageLinks.ts');

const contracts = [
  ['تب سایت editor واقعی محتوا را نمایش می‌دهد', replica, '<ContentManagementPage'],
  ['دربارهٔ ما در editor وجود دارد', editor, 'صفحهٔ دربارهٔ ما'],
  ['تماس با ما در editor وجود دارد', editor, 'صفحهٔ تماس با ما'],
  ['فوتر و نشانه‌های اعتماد در editor وجود دارد', editor, 'فوتر و نشانه‌های اعتماد'],
  ['ذخیره و انتشار دارای وضعیت pending است', editor, 'در حال ذخیره…'],
  ['تنظیمات منتشرشده از endpoint عمومی خوانده می‌شوند', api, "'/settings/public'"],
  ['Context محتوای عمومی را در startup دریافت می‌کند', context, 'api.getPublicSettings()'],
  ['Context انتشار static content را به API مدیر متصل می‌کند', context, "'/settings/static_content'"],
  ['ذخیرهٔ static content تا پاسخ واقعی server منتظر می‌ماند', context, 'const updateStaticContent = async'],
  ['خطای ذخیرهٔ static content به editor برمی‌گردد', context, "await api.adminRequest('/settings/static_content'"],
  ['editor responsive دو ستونه دارد', css, 'grid-template-columns: repeat(2, minmax(0, 1fr))'],
  ['editor موبایل تک ستونه دارد', css, '.content-editor-grid { grid-template-columns: 1fr;'],
  ['افزودن شبکهٔ اجتماعی در editor وجود دارد', editor, 'افزودن شبکه'],
  ['آیکون بله در انتخاب‌های editor وجود دارد', editor, 'بله'],
  ['آیکون ایتا در انتخاب‌های editor وجود دارد', editor, 'ایتا'],
  ['مرتب‌سازی شبکه‌ها در editor وجود دارد', editor, 'moveSocialLink'],
  ['فوتر شبکه‌های اجتماعی پویا را نمایش می‌دهد', footer, 'socialLinks.map'],
  ['فوتر آیکون بله را پشتیبانی می‌کند', footer, 'bale: MessageCircle'],
  ['فوتر آیکون ایتا را پشتیبانی می‌کند', footer, 'eitaa: MessagesSquare'],
  ['upload تصویر شبکه‌های اجتماعی در editor وجود دارد', editor, 'تصویر ${link.label}'],
  ['upload تصویر نشان اعتماد در editor وجود دارد', editor, 'تصویر ${badge.label}'],
  ['مدیریت نشان‌های اعتماد قابل افزودن است', editor, 'افزودن نشان'],
  ['مرتب‌سازی نشان‌های اعتماد وجود دارد', editor, 'moveTrustBadge'],
  ['endpoint upload رسانهٔ سایت در API وجود دارد', api, 'uploadAdminSiteMediaImage'],
  ['فوتر تصویر اختصاصی شبکه را نمایش می‌دهد', footer, 'link.imageUrl ? <img'],
  ['فوتر تصویر نشان اعتماد را نمایش می‌دهد', footer, 'badge.imageUrl ? <img'],
  ['تب یکپارچهٔ محتوای صفحهٔ اصلی در CMS وجود دارد', editor, 'محتوای صفحهٔ اصلی'],
  ['پنل‌های جدا برای بخش‌های صفحهٔ اصلی وجود دارد', homepageEditor, 'homepage-section-tabs'],
  ['هر بخش فهرست خلاصهٔ آیتم‌ها دارد', homepageEditor, 'homepage-summary-card'],
  ['ویرایش هر آیتم در editor متمرکز انجام می‌شود', homepageEditor, 'homepage-editor-dialog'],
  ['editor اسلایدر اصلی را مدیریت می‌کند', homepageEditor, 'اسلایدر اصلی'],
  ['editor بنرهای کناری را مدیریت می‌کند', homepageEditor, 'بنرهای کناری'],
  ['editor دسترسی سریع را مدیریت می‌کند', homepageEditor, 'دسترسی سریع'],
  ['editor بنر خدمات آنلاین را مدیریت می‌کند', homepageEditor, 'بنر خدمات آنلاین'],
  ['editor همکاران را مدیریت می‌کند', homepageEditor, 'همکاران و برندها'],
  ['اسلایدر از تنظیمات صفحهٔ اصلی می‌خواند', hero, 'appearanceSettings.heroSlides'],
  ['بنرهای کناری از تنظیمات صفحهٔ اصلی می‌خوانند', hero, 'appearanceSettings.sidePromos'],
  ['دسترسی سریع از تنظیمات صفحهٔ اصلی می‌خواند', quickAccess, 'appearanceSettings.quickAccessItems'],
  ['بنر خدمات آنلاین از تنظیمات صفحهٔ اصلی می‌خواند', servicesBanner, 'appearanceSettings.servicesBanner'],
  ['همکاران از تنظیمات صفحهٔ اصلی می‌خوانند', partners, 'appearanceSettings.partners'],
  ['فیلد لینک دلخواه در editor وجود دارد', homepageEditor, 'لینک دلخواه (اختیاری)'],
  ['فیلد مستقل لینک CTA خدمات وجود دارد', homepageEditor, 'لینک دکمهٔ اصلی (اختیاری)'],
  ['دسترسی سریع لینک دلخواه را با اولویت باز می‌کند', quickAccess, 'openDestination(item.customUrl, item.destination, item.category)'],
  ['اسلایدر لینک دلخواه را با اولویت باز می‌کند', hero, 'openHomepageCustomUrl(customUrl)'],
  ['خدمات آنلاین لینک‌های CTA دلخواه را باز می‌کند', servicesBanner, 'openHomepageCustomUrl(customUrl)'],
  ['کارت همکار لینک دلخواه را با اولویت باز می‌کند', partners, 'openHomepageCustomUrl(partner.customUrl)'],
  ['لینک‌های دلخواه فقط با پروتکل مجاز باز می‌شوند', homepageLinks, 'ALLOWED_PROTOCOLS'],
];

const missing = contracts.filter(([, content, expected]) => !content.includes(expected)).map(([label]) => label);
if (missing.length) throw new Error(`قراردادهای CMS پایه ناقص‌اند: ${missing.join('، ')}`);

execFileSync('npx', ['tsx', 'tests/scripts/homepage_custom_links_test.ts'], { stdio: 'inherit' });
console.log('Admin content management contract: PASS');
