import React, { useState } from 'react';
import { 
  Settings, 
  Store, 
  CreditCard, 
  MessageSquare, 
  Truck, 
  Image as ImageIcon, 
  Save, 
  Check, 
  AlertCircle, 
  Plus, 
  Trash2, 
  Sparkles,
  ShieldCheck
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { StoreSettings } from '../../types';

export const AdminSettingsTab: React.FC = () => {
  const { storeSettings, updateStoreSettings, showToast } = useApp();

  const [activeSection, setActiveSection] = useState<'general' | 'gateways' | 'sms' | 'shipping' | 'banners'>('general');
  const [formData, setFormData] = useState<StoreSettings>(storeSettings);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateStoreSettings(formData);
    showToast('تنظیمات فروشگاه با موفقیت ذخیره و اعمال گردید', 'success');
  };

  const navItems: { id: typeof activeSection; label: string; icon: React.ElementType }[] = [
    { id: 'general', label: 'مشخصات فروشگاه', icon: Store },
    { id: 'gateways', label: 'درگاه‌های پرداخت شاپرک', icon: CreditCard },
    { id: 'sms', label: 'سامانه پیامک و اعلان‌ها', icon: MessageSquare },
    { id: 'shipping', label: 'روش‌های ارسال و باربری', icon: Truck },
    { id: 'banners', label: 'اسلایدر و بنرهای تبلیغاتی', icon: ImageIcon },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300" dir="rtl">
      
      {/* Top Header Card */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-slate-700/80 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
            پیکربندی و تنظیمات سیستمی فروشگاه
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            مدیریت درگاه‌های بانکی، هزینه ارسال، سامانه‌های پیامکی و اطلاعات تماس شرکت.
          </p>
        </div>

        <button
          id="admin-save-settings-top-btn"
          onClick={handleSave}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-blue-600/30 transition active:scale-95 shrink-0"
        >
          <Save className="w-4 h-4" />
          <span>ذخیره کلیه تنظیمات</span>
        </button>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Settings Navigation Menu (Span 3) */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-800/90 rounded-2xl p-3 border border-slate-200 dark:border-slate-700/80 shadow-sm space-y-1">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-bold transition text-right ${
                  isActive 
                    ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800' 
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-750'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Settings Content Area (Span 9) */}
        <div className="lg:col-span-9 bg-white dark:bg-slate-800/90 rounded-2xl p-6 border border-slate-200 dark:border-slate-700/80 shadow-sm">
          <form onSubmit={handleSave} className="space-y-6">
            
            {/* 1. General Settings */}
            {activeSection === 'general' && (
              <div className="space-y-4">
                <div className="border-b border-slate-100 dark:border-slate-700 pb-3">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">مشخصات اصلی فروشگاه و شرکت</h2>
                  <p className="text-xs text-slate-400">نام تجاری، شعار و راه‌های ارتباطی درج شده در فوتر و سربرگ فاکتورها</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">نام فروشگاه</label>
                    <input
                      type="text"
                      value={formData.store_name}
                      onChange={e => setFormData(prev => ({ ...prev, store_name: e.target.value }))}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">شعار تجاری</label>
                    <input
                      type="text"
                      value={formData.store_slogan}
                      onChange={e => setFormData(prev => ({ ...prev, store_slogan: e.target.value }))}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">شماره تلفن تماس ثابت</label>
                    <input
                      type="text"
                      value={formData.contact_phone}
                      onChange={e => setFormData(prev => ({ ...prev, contact_phone: e.target.value }))}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                      dir="ltr"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">ایمیل پشتیبانی</label>
                    <input
                      type="email"
                      value={formData.contact_email}
                      onChange={e => setFormData(prev => ({ ...prev, contact_email: e.target.value }))}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                      dir="ltr"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">آدرس دفتر مرکزی و انبار</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={e => setFormData(prev => ({ ...prev, address: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">ساعات کاری و پاسخگویی</label>
                  <input
                    type="text"
                    value={formData.working_hours}
                    onChange={e => setFormData(prev => ({ ...prev, working_hours: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            )}

            {/* 2. Gateways Settings */}
            {activeSection === 'gateways' && (
              <div className="space-y-4">
                <div className="border-b border-slate-100 dark:border-slate-700 pb-3">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">درگاه‌های پرداخت آنلاین شاپرک</h2>
                  <p className="text-xs text-slate-400">تنظیم کلیدهای اتصال به زرین‌پال، به پرداخت ملت، سامان کیش و پرداخت در محل</p>
                </div>

                <div className="space-y-4">
                  {/* Zarinpal */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">درگاه زرین‌پال (ZarinPal)</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.gateways.zarinpal.enabled}
                          onChange={e => setFormData(prev => ({
                            ...prev,
                            gateways: {
                              ...prev.gateways,
                              zarinpal: { ...prev.gateways.zarinpal, enabled: e.target.checked }
                            }
                          }))}
                          className="sr-only peer"
                        />
                        <div className="w-10 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">مرچنت کد (Merchant ID):</label>
                      <input
                        type="text"
                        value={formData.gateways.zarinpal.merchant_id}
                        onChange={e => setFormData(prev => ({
                          ...prev,
                          gateways: {
                            ...prev.gateways,
                            zarinpal: { ...prev.gateways.zarinpal, merchant_id: e.target.value }
                          }
                        }))}
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono"
                        dir="ltr"
                      />
                    </div>
                  </div>

                  {/* Mellat */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">به‌پرداخت ملت (Mellat IPG)</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.gateways.mellat.enabled}
                          onChange={e => setFormData(prev => ({
                            ...prev,
                            gateways: {
                              ...prev.gateways,
                              mellat: { ...prev.gateways.mellat, enabled: e.target.checked }
                            }
                          }))}
                          className="sr-only peer"
                        />
                        <div className="w-10 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 mb-1">Terminal ID:</label>
                        <input
                          type="text"
                          value={formData.gateways.mellat.terminal_id}
                          onChange={e => setFormData(prev => ({
                            ...prev,
                            gateways: {
                              ...prev.gateways,
                              mellat: { ...prev.gateways.mellat, terminal_id: e.target.value }
                            }
                          }))}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono"
                          dir="ltr"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 mb-1">User Name:</label>
                        <input
                          type="text"
                          value={formData.gateways.mellat.username}
                          onChange={e => setFormData(prev => ({
                            ...prev,
                            gateways: {
                              ...prev.gateways,
                              mellat: { ...prev.gateways.mellat, username: e.target.value }
                            }
                          }))}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono"
                          dir="ltr"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 3. SMS Settings */}
            {activeSection === 'sms' && (
              <div className="space-y-4">
                <div className="border-b border-slate-100 dark:border-slate-700 pb-3">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">سامانه ارسال پیامک خودکار</h2>
                  <p className="text-xs text-slate-400">ارسال کد تایید ورود (OTP)، اعلان ثبت سفارش و ارسال کد رهگیری پستی به خریدار</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">پنل ارائه‌دهنده</label>
                    <select
                      value={formData.sms_provider}
                      onChange={e => setFormData(prev => ({ ...prev, sms_provider: e.target.value as 'kavenegar' | 'farazsms' | 'ghasedak' }))}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white"
                    >
                      <option value="kavenegar">کاوه نگار (KaveNegar)</option>
                      <option value="farazsms">فراز اس ام اس (FarazSMS / IPPanel)</option>
                      <option value="ghasedak">قاصدک (Ghasedak)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">شماره اختصاصی خط پیامک</label>
                    <input
                      type="text"
                      value={formData.sms_sender_number}
                      onChange={e => setFormData(prev => ({ ...prev, sms_sender_number: e.target.value }))}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-mono text-slate-900 dark:text-white"
                      dir="ltr"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">API Key سامانه پیامک</label>
                  <input
                    type="password"
                    value={formData.sms_api_key}
                    onChange={e => setFormData(prev => ({ ...prev, sms_api_key: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-mono text-slate-900 dark:text-white"
                    dir="ltr"
                  />
                </div>
              </div>
            )}

            {/* 4. Shipping Settings */}
            {activeSection === 'shipping' && (
              <div className="space-y-4">
                <div className="border-b border-slate-100 dark:border-slate-700 pb-3">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">روش‌های ارسال و باربری کالا</h2>
                  <p className="text-xs text-slate-400">تعیین هزینه‌های پست پیشتاز، تیپاکس و حداقل مبلغ سفارش برای ارسال رایگان</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">هزینه ثابت پست پیشتاز (تومان)</label>
                    <input
                      type="number"
                      step="5000"
                      value={formData.shipping_cost_default}
                      onChange={e => setFormData(prev => ({ ...prev, shipping_cost_default: Number(e.target.value) }))}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-mono text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">سقف ارسال رایگان (تومان)</label>
                    <input
                      type="number"
                      step="50000"
                      value={formData.free_shipping_threshold}
                      onChange={e => setFormData(prev => ({ ...prev, free_shipping_threshold: Number(e.target.value) }))}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-mono text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 5. Banners Settings */}
            {activeSection === 'banners' && (
              <div className="space-y-4">
                <div className="border-b border-slate-100 dark:border-slate-700 pb-3">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">اسلایدرها و بنرهای تبلیغاتی صفحه اصلی</h2>
                  <p className="text-xs text-slate-400">مدیریت تصاویر، عنوان، دکمه و لینک اسلایدر بزرگ صفحه نخست</p>
                </div>

                <div className="space-y-4">
                  {formData.banners.map((banner, index) => (
                    <div key={banner.id} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900 dark:text-white">اسلاید شماره {index + 1}</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 mb-1">عنوان اسلاید:</label>
                          <input
                            type="text"
                            value={banner.title}
                            onChange={e => {
                              const newBanners = [...formData.banners];
                              newBanners[index].title = e.target.value;
                              setFormData(prev => ({ ...prev, banners: newBanners }));
                            }}
                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 mb-1">آدرس تصویر (Image URL):</label>
                          <input
                            type="text"
                            value={banner.image}
                            onChange={e => {
                              const newBanners = [...formData.banners];
                              newBanners[index].image = e.target.value;
                              setFormData(prev => ({ ...prev, banners: newBanners }));
                            }}
                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono"
                            dir="ltr"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Save Button */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-end">
              <button
                id="admin-save-settings-btn"
                type="submit"
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-blue-600/30 transition active:scale-95"
              >
                <Save className="w-4 h-4" />
                <span>ذخیره تغییرات این بخش</span>
              </button>
            </div>

          </form>
        </div>

      </div>

    </div>
  );
};
