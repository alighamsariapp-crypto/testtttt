import React from 'react';
import { ArrowLeft, ClipboardList, ExternalLink, Headphones, Sparkles } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const ServicesView: React.FC = () => {
  const { services, navigateToService, navigateToServiceCategory, selectedServiceCategory, setActiveView, isLoadingData } = useApp();
  const publishedServices = services.filter((service) => service.is_active !== false);
  const serviceCategories = Array.from(new Set(publishedServices.map((service) => service.category?.trim() || 'خدمات آنلاین')));
  const filteredServices = selectedServiceCategory
    ? publishedServices.filter((service) => (service.category?.trim() || 'خدمات آنلاین') === selectedServiceCategory)
    : [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-9">
      <header className="bg-slate-950 rounded-[2rem] p-6 sm:p-10 text-white shadow-xl mb-7 overflow-hidden relative">
        <div className="absolute -top-24 -left-20 w-56 h-56 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="relative max-w-2xl space-y-3">
          <span className="inline-flex px-3 py-1 rounded-full bg-blue-400/15 text-blue-200 text-[11px] font-bold border border-blue-300/20">راهنما و ارتباط مستقیم</span>
          <h1 className="text-xl sm:text-3xl font-extrabold">{selectedServiceCategory || 'خدمات آنلاین نوین‌نت'}</h1>
          <p className="text-xs sm:text-sm text-slate-300 leading-7">{selectedServiceCategory ? `فهرست خدمات منتشرشده در دستهٔ ${selectedServiceCategory}.` : 'ابتدا دستهٔ خدمت موردنیاز خود را انتخاب کنید؛ هر دسته صفحهٔ مستقل و فهرست کامل خدمات خودش را دارد.'}</p>
          {selectedServiceCategory && <button type="button" onClick={() => setActiveView('services')} className="inline-flex items-center gap-2 text-xs font-bold text-blue-200 hover:text-white transition"><ArrowLeft className="w-4 h-4" />بازگشت به دسته‌های خدمات</button>}
        </div>
      </header>

      {isLoadingData ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5" aria-label="در حال بارگذاری خدمات" aria-busy="true">{[1, 2, 3].map((item) => <div key={item} className="h-52 rounded-3xl bg-slate-100 animate-pulse" />)}</div>
      ) : publishedServices.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-xs p-8 sm:p-12 text-center max-w-2xl mx-auto space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto"><ClipboardList className="w-8 h-8" /></div>
          <div className="space-y-2"><h2 className="text-lg font-extrabold text-slate-900">هنوز خدمتی منتشر نشده است</h2><p className="text-xs sm:text-sm text-slate-500 leading-relaxed">پس از انتشار هر خدمت در پنل مدیریت، صفحهٔ اختصاصی آن در اینجا نمایش داده می‌شود.</p></div>
          <button type="button" onClick={() => setActiveView('contact')} className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition"><Headphones className="w-4 h-4" />ارتباط با پشتیبانی</button>
        </div>
      ) : selectedServiceCategory ? (
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5" aria-label="فهرست خدمات منتشرشده">
          {filteredServices.map((service) => (
            <article key={service.id} className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm hover:shadow-md hover:border-blue-200 transition flex flex-col justify-between gap-5">
              <div className="space-y-3"><div className="flex items-center justify-between gap-3"><span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full">{service.category}</span><Sparkles className="w-4 h-4 text-blue-500" /></div><h2 className="text-base font-extrabold text-slate-800">{service.name}</h2><p className="text-xs text-slate-500 leading-6">{service.short_description}</p></div>
              <button type="button" onClick={() => navigateToService(service.slug)} className="w-full min-h-11 py-2.5 rounded-xl bg-slate-50 hover:bg-blue-600 hover:text-white text-slate-700 text-xs font-bold transition flex items-center justify-center gap-2"><span>مشاهدهٔ راهنما</span><ArrowLeft className="w-3.5 h-3.5" /></button>
            </article>
          ))}
        </section>
      ) : (
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5" aria-label="دسته‌های خدمات منتشرشده">
          {serviceCategories.map((category) => {
            const count = publishedServices.filter((service) => (service.category?.trim() || 'خدمات آنلاین') === category).length;
            return <button key={category} type="button" onClick={() => navigateToServiceCategory(category)} className="min-h-40 rounded-3xl border border-slate-100 bg-white p-5 text-right shadow-sm transition hover:border-blue-200 hover:shadow-md"><span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-[11px] font-bold text-blue-700">{count.toLocaleString('fa-IR')} خدمت</span><h2 className="mt-4 text-base font-extrabold text-slate-800">{category}</h2><p className="mt-2 text-xs leading-6 text-slate-500">مشاهدهٔ همهٔ خدمات و راهنماهای منتشرشدهٔ این دسته</p><span className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-blue-700">مشاهدهٔ دسته <ArrowLeft className="w-3.5 h-3.5" /></span></button>;
          })}
        </section>
      )}
    </div>
  );
};
