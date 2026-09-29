import React, { useState } from 'react';
import { Palette, Image as ImageIcon, Plus, Trash2, CheckCircle2, Save } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const AdminAppearanceTab: React.FC = () => {
  const { showToast } = useApp();
  const [heroTitle, setHeroTitle] = useState('نسل جدید اینترنت پرسرعت سازمانی و خانگی');
  const [heroSubtitle, setHeroSubtitle] = useState('تجربه اتصال پایدار، پینگ فوق‌العاده پایین و پهنای باند اختصاصی با پشتیبانی ۲۴ ساعته');
  const [banners, setBanners] = useState([
    { id: 1, title: 'جشنواره تخفیف‌های فیبر نوری', subtitle: 'تا ۳۰٪ تخفیف نصب و راه‌اندازی مودم‌های دوباند', active: true },
    { id: 2, title: 'ترافیک نامحدود گیمینگ', subtitle: 'پینگ زیر ۲۰ میلی‌ثانیه مخصوص گیمرهای حرفه‌ای', active: true }
  ]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    showToast('تنظیمات ظاهری و بنرها با موفقیت ذخیره شد.', 'success');
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Top Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Palette className="w-6 h-6 text-blue-600" />
            <span>طراحی بنر، اسلایدر و ظاهر صفحه اصلی</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">مدیریت بنرهای تبلیغاتی، متن هیرو و اسلایدرهای صفحه اول سایت</p>
        </div>
        <button
          onClick={handleSave}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/20 transition active:scale-95"
        >
          <Save className="w-4 h-4" />
          <span>ذخیره تغییرات</span>
        </button>
      </div>

      {/* Main Hero Section Editor */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-blue-600" />
          <span>ویرایش بنر اصلی (Hero Banner)</span>
        </h3>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">عنوان اصلی هیرو</label>
            <input
              type="text"
              value={heroTitle}
              onChange={e => setHeroTitle(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600 transition"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">توضیحات تکمیلی</label>
            <textarea
              rows={3}
              value={heroSubtitle}
              onChange={e => setHeroSubtitle(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600 transition"
            />
          </div>
        </form>
      </div>

      {/* Active Promotional Banners */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Palette className="w-4 h-4 text-blue-600" />
            <span>اسلایدرها و بنرهای تخفیف فعال</span>
          </h3>
          <button
            onClick={() => showToast('افزودن بنر جدید', 'info')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 font-bold text-xs hover:bg-blue-100 transition"
          >
            <Plus className="w-4 h-4" />
            <span>افزودن بنر</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {banners.map(b => (
            <div key={b.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-start justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">فعال</span>
                <h4 className="text-xs font-bold text-slate-900 mt-2">{b.title}</h4>
                <p className="text-[11px] text-slate-500 mt-1">{b.subtitle}</p>
              </div>
              <button
                onClick={() => {
                  setBanners(banners.filter(x => x.id !== b.id));
                  showToast('بنر حذف شد.', 'success');
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
