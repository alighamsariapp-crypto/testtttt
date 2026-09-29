import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Key, 
  Smartphone, 
  Mail, 
  Laptop, 
  Lock, 
  AlertTriangle, 
  CheckCircle2, 
  LogOut, 
  X, 
  Eye, 
  EyeOff,
  ShieldAlert,
  Globe
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { ModalPortal } from '../common/ModalPortal';

export const SecurityTab: React.FC = () => {
  const { user, activeSessions, terminateSession, terminateOtherSessions, updatePassword, showToast } = useApp();
  
  // Modals
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isTerminateOthersDialogOpen, setIsTerminateOthersDialogOpen] = useState(false);
  useBodyScrollLock(isPasswordModalOpen);

  const openPasswordModal = () => {
    setPasswordError('');
    setShowPassword(false);
    setIsPasswordModalOpen(true);
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('تکرار کلمه عبور جدید مطابقت ندارد.');
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      setPasswordError('کلمه عبور باید حداقل ۸ کاراکتر باشد.');
      return;
    }

    setIsSavingPassword(true);
    try {
      await updatePassword(passwordForm.currentPassword, passwordForm.newPassword, passwordForm.confirmPassword);
      setIsPasswordModalOpen(false);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : 'خطا در به‌روزرسانی رمز عبور.');
    } finally {
      setIsSavingPassword(false);
    }
  };

  const completedSecurityChecks = [user?.has_password, user?.phone_verified].filter(Boolean).length;
  const securitySummary = completedSecurityChecks === 2
    ? { label: 'تکمیل‌شده', description: 'رمز عبور و شماره موبایل این حساب تأیید شده‌اند.' }
    : completedSecurityChecks === 1
      ? { label: 'نیازمند تکمیل', description: 'برای افزایش امنیت، رمز عبور و شماره موبایل حساب را تکمیل و تأیید کنید.' }
      : { label: 'نیازمند اقدام', description: 'برای استفادهٔ امن‌تر از حساب، رمز عبور و شماره موبایل را تکمیل کنید.' };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-black text-slate-900">امنیت و حریم خصوصی</h1>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold font-sans ${completedSecurityChecks === 2 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>
              {securitySummary.label}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">مدیریت رمز عبور، احراز هویت دومرحله‌ای و دستگاه‌های متصل به حساب کاربری</p>
        </div>
      </div>

      {/* Security Health Score Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-blue-950 rounded-3xl p-6 text-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white">وضعیت امنیت حساب: {securitySummary.label}</h3>
            <p className="text-xs text-slate-300 leading-relaxed max-w-md">
              {securitySummary.description}
            </p>
          </div>
        </div>

        <button
          onClick={openPasswordModal}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-xs font-bold transition shadow-sm shrink-0 flex items-center gap-1.5"
        >
          <Key className="w-4 h-4" />
          <span>{user?.has_password ? 'تغییر رمز عبور' : 'تعیین رمز عبور'}</span>
        </button>
      </div>

      {/* Security Options Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Password Card */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div className="space-y-0.5">
              <h4 className="text-xs font-bold text-slate-900">رمز عبور حساب</h4>
              <p className="text-[11px] text-slate-500">آخرین تغییر: ۳ ماه پیش</p>
            </div>
          </div>

          <button
            onClick={openPasswordModal}
            className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition"
          >
            {user?.has_password ? 'تغییر رمز' : 'تعیین رمز'}
          </button>
        </div>

        {/* Verified Phone State */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div className="space-y-0.5">
              <h4 className="text-xs font-bold text-slate-900">تأیید شماره موبایل</h4>
              <p className="text-[11px] text-slate-500">شمارهٔ تأییدشده برای ورود با کد یک‌بارمصرف استفاده می‌شود.</p>
            </div>
          </div>

          <span className={`px-3 py-1.5 rounded-xl text-[11px] font-bold ${user?.phone_verified ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200'}`}>
            {user?.phone_verified ? 'تأیید شده' : 'تأیید نشده'}
          </span>
        </div>

      </div>

      {/* Active Sessions List */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Laptop className="w-4 h-4 text-blue-600" />
              <span>نشست‌ها و دستگاه‌های متصل ({activeSessions.length})</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">دستگاه‌هایی که در حال حاضر به حساب کاربری شما دسترسی دارند</p>
          </div>

          {activeSessions.length > 1 && (
            <button
              type="button"
              onClick={() => setIsTerminateOthersDialogOpen(true)}
              className="px-3.5 py-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold transition flex items-center gap-1.5 shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>خروج از سایر دستگاه‌ها</span>
            </button>
          )}
        </div>

        <div className="space-y-3">
          {activeSessions.map((session) => (
            <div 
              key={session.id}
              className={`p-4 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
                session.is_current ? 'bg-blue-50/40 border-blue-200' : 'bg-slate-50 border-slate-100'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  session.is_current ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
                }`}>
                  <Laptop className="w-5 h-5" />
                </div>
                
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{session.device}</span>
                    {session.is_current && (
                      <span className="px-2 py-0.5 rounded-md bg-blue-600 text-white text-[10px] font-bold">
                        دستگاه فعلی شما
                      </span>
                    )}
                  </div>
                  <div className="text-slate-500 text-[11px] flex flex-wrap items-center gap-2">
                    <span>{session.browser}</span>
                    <span>•</span>
                    <span className="font-mono">{session.ip}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Globe className="w-3 h-3 text-slate-400" />
                      <span>{session.location}</span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                <span className="text-[11px] text-slate-400">آخرین فعالیت: {session.last_active}</span>
                {!session.is_current && (
                  <button
                    onClick={() => terminateSession(session.id)}
                    className="px-3 py-1.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-[11px] font-bold transition"
                  >
                    قطع دسترسی
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <ConfirmDialog
        isOpen={isTerminateOthersDialogOpen}
        title="خروج از سایر دستگاه‌ها"
        description="تمام نشست‌های دیگر این حساب خاتمه پیدا می‌کنند. نشست فعلی شما حفظ می‌شود."
        confirmLabel="خروج از سایر دستگاه‌ها"
        onCancel={() => setIsTerminateOthersDialogOpen(false)}
        onConfirm={() => {
          terminateOtherSessions();
          setIsTerminateOthersDialogOpen(false);
        }}
      />

      {/* Password Change Modal */}
      {isPasswordModalOpen && (
        <ModalPortal>
          <div className="ui-modal-backdrop animate-in fade-in duration-200">
          <div className="ui-modal-panel max-w-md w-full p-6 sm:p-8 space-y-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-base font-black text-slate-900">{user?.has_password ? 'تغییر کلمه عبور' : 'تعیین کلمه عبور'}</h3>
              <button
                onClick={() => { setIsPasswordModalOpen(false); setPasswordError(''); }}
                className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-700 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {passwordError && <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-semibold leading-5 text-rose-700" role="alert" aria-live="assertive">{passwordError}</p>}

            <form onSubmit={handlePasswordChange} className="space-y-4 text-xs">
              {user?.has_password && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">کلمه عبور فعلی</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={passwordForm.currentPassword}
                    onChange={(e) => { setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value })); setPasswordError(''); }}
                    required
                    placeholder="••••••••"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none font-mono"
                  />
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">کلمه عبور جدید</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={passwordForm.newPassword}
                  onChange={(e) => { setPasswordForm(prev => ({ ...prev, newPassword: e.target.value })); setPasswordError(''); }}
                  required
                  placeholder="حداقل ۸ کاراکتر"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">تکرار کلمه عبور جدید</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={passwordForm.confirmPassword}
                  onChange={(e) => { setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value })); setPasswordError(''); }}
                  required
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none font-mono"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{showPassword ? 'مخفی کردن رمزها' : 'نمایش کلمات عبور'}</span>
                </button>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => { setIsPasswordModalOpen(false); setPasswordError(''); }}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold transition"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={isSavingPassword}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-bold transition shadow-lg shadow-blue-600/20 disabled:opacity-60"
                >
                  {isSavingPassword ? 'در حال ذخیره‌سازی...' : 'ثبت رمز جدید'}
                </button>
              </div>
            </form>
          </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
};
