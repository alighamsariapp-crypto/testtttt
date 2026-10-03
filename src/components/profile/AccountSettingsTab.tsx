import React, { useEffect, useState } from 'react';
import { 
  User, 
  Phone, 
  Mail, 
  CreditCard, 
  Calendar, 
  Save, 
  CheckCircle2, 
  Sparkles,
  ShieldCheck,
  Bell,
  KeyRound,
  LogOut,
  ChevronLeft,
  Star,
  Smartphone
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { ModalPortal } from '../common/ModalPortal';
import { LogoutModal } from './LogoutModal';
import { UserIdentityBadge } from '../common/UserIdentityBadge';
import { isIranianMobile, normalizeIranianMobile } from '../../utils/phone';

export const AccountSettingsTab: React.FC = () => {
  const { user, canAccessAdmin, updateUserProfile, logout, setActiveView, showToast } = useApp();

  const [formData, setFormData] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    email: user?.email || '',
  });

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        phone: user.phone || '',
        email: user.email || '',
      });
    }
  }, [user?.name, user?.phone, user?.email]);

  // Notification Toggles (Matching Image 01 & Image 02)
  const [notifications, setNotifications] = useState({
    orderUpdates: true,     // به‌روزرسانی سفارش‌ها (دریافت پیامک برای وضعیت سفارش)
    specialOffers: false,   // پیشنهادات ویژه (اطلاع از تخفیف‌ها و کمپین‌ها)
    securityAlerts: true,   // هشدارهای امنیتی (اطلاع از ورودهای جدید به حساب)
  });

  // Modals & States
  const [isSaving, setIsSaving] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isTwoFactorOpen, setIsTwoFactorOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  useBodyScrollLock(isChangePasswordOpen || isTwoFactorOpen);

  if (!user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const phone = normalizeIranianMobile(formData.phone);
    if (!isIranianMobile(phone)) {
      showToast('شماره موبایل باید با ۰۹ شروع شود و دقیقاً ۱۱ رقم داشته باشد.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      await updateUserProfile({
        name: formData.name.trim(),
        phone,
        email: formData.email.trim(),
      });
      setFormData((current) => ({ ...current, phone }));
      showToast('اطلاعات شخصی با موفقیت به‌روزرسانی شد.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'ذخیره اطلاعات حساب با خطا روبه‌رو شد. دوباره تلاش کنید.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleNotification = (key: keyof typeof notifications) => {
    setNotifications(prev => ({ ...prev, [key]: !prev[key] }));
    showToast('تنظیمات اطلاع‌رسانی به‌روزرسانی شد.', 'info');
  };

  const handleLogoutConfirm = () => {
    setIsLogoutModalOpen(false);
    logout();
    setActiveView('home');
  };

  return (
    <div className="space-y-6">
      
      {/* Top Profile Summary Badge Card (Matches Image 01 & Image 02) */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-right">
          
          <UserIdentityBadge
            name={formData.name}
            className="w-20 h-20 rounded-3xl bg-blue-50 text-blue-600 ring-4 ring-blue-50 shadow-md"
            iconClassName="w-8 h-8"
          />

          {/* User Details & Badges */}
          <div className="space-y-1">
            <div className="flex items-center justify-center sm:justify-start gap-2.5 flex-wrap">
              <h2 className="text-base sm:text-lg font-black text-slate-900">{formData.name}</h2>
              <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-bold flex items-center gap-1 border border-blue-100">
                <Star className="w-3 h-3 fill-blue-600 text-blue-600" />
                <span>عضو ویژه</span>
              </span>
            </div>
            
            <p className="text-xs text-slate-500 font-mono" dir="ltr">{formData.phone || formData.email}</p>
            <p className="text-[11px] text-slate-400">عضویت از فروردین ۱۴۰۲</p>
          </div>

        </div>

        {/* Verified Shield Badge */}
        <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-2xl text-xs font-bold">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>هویت کاربری تأیید شده</span>
        </div>
      </div>

      {/* Main Settings Grid */}
      <div className="space-y-6">
        
        {/* ========================================================================= */}
        {/* CARD 1: PERSONAL INFORMATION (اطلاعات شخصی - Matches Image 01 & 02) */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-sm space-y-6">
          
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <User className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-black text-slate-900">اطلاعات شخصی</h3>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              
              {/* Full Name */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">نام و نام خانوادگی</label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                  placeholder="کاربر نوین‌نت"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none transition"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">شماره موبایل</label>
                <input
                  type="tel"
                  dir="ltr"
                  value={formData.phone || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: normalizeIranianMobile(e.target.value) }))}
                  inputMode="tel"
                  autoComplete="tel-national"
                  required
                  placeholder="09xxxxxxxxx"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-mono text-left focus:bg-white focus:border-blue-600 focus:outline-none transition"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">ایمیل</label>
                <input
                  type="email"
                  dir="ltr"
                  value={formData.email || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="premium@noovinnet.ir"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-mono text-left focus:bg-white focus:border-blue-600 focus:outline-none transition"
                />
              </div>

            </div>

            {/* Save Button */}
            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-xs transition shadow-sm shadow-blue-500/20 flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'در حال ذخیره‌سازی...' : 'ذخیره تغییرات'}</span>
              </button>
            </div>
          </form>

        </div>

        {/* ========================================================================= */}
        {/* CARD 2: NOTIFICATION SETTINGS (تنظیمات اطلاع‌رسانی - Matches Image 01 & 02) */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-sm space-y-6">
          
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">تنظیمات اطلاع‌رسانی</h3>
              <p className="text-xs text-slate-500 mt-0.5">مدیریت هشدارهای پیامکی و اعلان‌های وضعیت حساب</p>
            </div>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            
            {/* Toggle 1: به‌روزرسانی سفارش‌ها (Matches Image 01 & 02) */}
            <div className="py-4 first:pt-0 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <h4 className="font-bold text-slate-900">به‌روزرسانی سفارش‌ها</h4>
                <p className="text-slate-500 text-[11px]">دریافت پیامک برای وضعیت سفارش و رهگیری مرسولات پستی</p>
              </div>

              <button
                type="button"
                onClick={() => toggleNotification('orderUpdates')}
                className={`w-12 h-6 rounded-full transition-colors duration-200 ease-in-out relative p-0.5 shrink-0 ${
                  notifications.orderUpdates ? 'bg-blue-600' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`block w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                    notifications.orderUpdates ? 'translate-x-0' : '-translate-x-6'
                  }`}
                />
              </button>
            </div>

            {/* Toggle 2: پیشنهادات ویژه (Matches Image 01 & 02) */}
            <div className="py-4 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <h4 className="font-bold text-slate-900">پیشنهادات ویژه</h4>
                <p className="text-slate-500 text-[11px]">اطلاع از تخفیف‌ها، کد‌های هدیه و کمپین‌های فصلی نوین‌نت</p>
              </div>

              <button
                type="button"
                onClick={() => toggleNotification('specialOffers')}
                className={`w-12 h-6 rounded-full transition-colors duration-200 ease-in-out relative p-0.5 shrink-0 ${
                  notifications.specialOffers ? 'bg-blue-600' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`block w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                    notifications.specialOffers ? 'translate-x-0' : '-translate-x-6'
                  }`}
                />
              </button>
            </div>

            {/* Toggle 3: هشدارهای امنیتی (Matches Image 01 & 02) */}
            <div className="py-4 last:pb-0 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <h4 className="font-bold text-slate-900">هشدارهای امنیتی</h4>
                <p className="text-slate-500 text-[11px]">اطلاع از ورودهای جدید به حساب کاربری و تغییر رمز عبور</p>
              </div>

              <button
                type="button"
                onClick={() => toggleNotification('securityAlerts')}
                className={`w-12 h-6 rounded-full transition-colors duration-200 ease-in-out relative p-0.5 shrink-0 ${
                  notifications.securityAlerts ? 'bg-blue-600' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`block w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                    notifications.securityAlerts ? 'translate-x-0' : '-translate-x-6'
                  }`}
                />
              </button>
            </div>

          </div>

        </div>

        {/* ========================================================================= */}
        {/* CARD 3: SECURITY & ACCOUNT ACTIONS (امنیت - Matches Image 02 Mobile & Desktop) */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-sm space-y-4 text-xs">
          
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">امنیت حساب</h3>
              <p className="text-xs text-slate-500 mt-0.5">مدیریت رمز عبور و اعتبارسنجی دو مرحله‌ای</p>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            
            {/* Change Password Action */}
            <button
              type="button"
              onClick={() => setIsChangePasswordOpen(true)}
              className="w-full py-3.5 flex items-center justify-between hover:bg-slate-50 rounded-2xl px-2 transition text-right group"
            >
              <div className="flex items-center gap-3">
                <KeyRound className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition" />
                <span className="font-bold text-slate-800">تغییر رمز عبور</span>
              </div>
              <ChevronLeft className="w-4 h-4 text-slate-400" />
            </button>

            {/* 2FA Action */}
            <button
              type="button"
              onClick={() => setIsTwoFactorOpen(true)}
              className="w-full py-3.5 flex items-center justify-between hover:bg-slate-50 rounded-2xl px-2 transition text-right group"
            >
              <div className="flex items-center gap-3">
                <Smartphone className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition" />
                <span className="font-bold text-slate-800">احراز هویت دو مرحله‌ای (2FA)</span>
              </div>
              <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full">
                {twoFactorEnabled ? 'فعال' : 'غیرفعال'}
              </span>
            </button>

          </div>

          {/* Admin Panel & Logout Action Buttons */}
          <div className="pt-4 border-t border-slate-100 space-y-2.5">
            {canAccessAdmin && (
              <button
                id="account-settings-admin-link"
                type="button"
                onClick={() => setActiveView('admin')}
                className="w-full py-3 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-2xl font-bold transition flex items-center justify-center gap-2 border border-amber-200/60"
              >
                <ShieldCheck className="w-4 h-4 text-amber-600" />
                <span>ورود به پنل مدیریت</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsLogoutModalOpen(true)}
              className="w-full py-3 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-2xl font-bold transition flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4 rotate-180" />
              <span>خروج از حساب کاربری</span>
            </button>
          </div>

        </div>

      </div>

      {/* Logout Confirmation Modal (Matches Image 07 & Image 08) */}
      <LogoutModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        onConfirm={handleLogoutConfirm}
      />

      {/* Change Password Mini Modal */}
      {isChangePasswordOpen && (
        <ModalPortal>
          <div className="ui-modal-backdrop animate-in fade-in duration-200">
          <div className="ui-modal-panel relative z-10 p-6 max-w-sm w-full space-y-4 text-right">
            <h3 className="text-sm font-black text-slate-900">تغییر رمز عبور</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">رمز عبور فعلی</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">رمز عبور جدید</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="حداقل ۶ کاراکتر"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsChangePasswordOpen(false)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-bold"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsChangePasswordOpen(false);
                  showToast('رمز عبور جدید با موفقیت ذخیره شد.', 'success');
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-sm"
              >
                ذخیره رمز جدید
              </button>
            </div>
          </div>
          </div>
        </ModalPortal>
      )}

      {/* Two-Factor Authentication Modal */}
      {isTwoFactorOpen && (
        <ModalPortal>
          <div className="ui-modal-backdrop animate-in fade-in duration-200">
          <div className="ui-modal-panel relative z-10 p-6 max-w-sm w-full space-y-4 text-right">
            <h3 className="text-sm font-black text-slate-900">احراز هویت دو مرحله‌ای</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              با فعال‌سازی این قابلیت، هنگام ورود به حساب یک کد پیامکی به شماره {formData.phone} ارسال خواهد شد.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsTwoFactorOpen(false)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-bold"
              >
                بستن
              </button>
              <button
                type="button"
                onClick={() => {
                  setTwoFactorEnabled(!twoFactorEnabled);
                  setIsTwoFactorOpen(false);
                  showToast(twoFactorEnabled ? 'احراز هویت دو مرحله‌ای غیرفعال شد.' : 'احراز هویت دو مرحله‌ای با موفقیت فعال شد.', 'success');
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold text-white shadow-sm ${
                  twoFactorEnabled ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {twoFactorEnabled ? 'غیرفعال‌سازی 2FA' : 'فعال‌سازی 2FA'}
              </button>
            </div>
          </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
};
