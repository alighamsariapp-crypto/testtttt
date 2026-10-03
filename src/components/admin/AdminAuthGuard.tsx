import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { isDemoMode } from '../../config/env';

const getLoginErrorMessage = (error: unknown): string => {
  const rawMessage = error instanceof Error ? error.message.toLowerCase() : '';
  if (/network|failed to fetch|load failed|connection|timeout/i.test(rawMessage)) {
    return 'ارتباط با سرور برقرار نشد. اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.';
  }
  return 'ایمیل یا رمز عبور صحیح نیست. لطفاً اطلاعات ورود را دوباره بررسی کنید.';
};

export const AdminAuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loginAsAdminDemo, navigateTo, login, showToast } = useApp();
  const demoMode = isDemoMode;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const isAuthorized = user && (user.role === 'admin' || user.role === 'staff');

  if (isAuthorized) return <>{children}</>;

  const handleStandardAdminLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    try {
      const loggedInUser = await login(email.trim(), password, { suppressSuccessToast: true });
      if (loggedInUser.role !== 'admin' && loggedInUser.role !== 'staff') {
        setErrorMessage('ورود به حساب انجام شد، اما این حساب اجازه دسترسی به پنل مدیریت را ندارد.');
        return;
      }
      showToast('احراز هویت مدیر با موفقیت انجام شد.', 'success');
    } catch (error) {
      setErrorMessage(getLoginErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4 selection:bg-blue-500 selection:text-white" dir="rtl">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600/20 border border-blue-500/30 text-blue-400 mb-4 shadow-lg shadow-blue-500/10">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white mb-2">ورود به پنل مدیریت نوین‌نت</h1>
          <p className="text-sm text-slate-400">دسترسی به این بخش صرفاً برای مدیران و کارشناسان مجاز سیستم تعریف شده است.</p>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl space-y-6">
          {demoMode && (
            <div className="p-4 rounded-xl bg-gradient-to-r from-blue-900/40 to-indigo-900/40 border border-blue-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-blue-300 font-bold text-sm">
                  <Sparkles className="w-4 h-4 text-blue-400 animate-pulse" />
                  <span>دسترسی نمایشی به پنل مدیریت</span>
                </div>
                <span className="text-[11px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full font-mono">Demo only</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">این گزینه فقط در محیط توسعه برای بررسی رابط کاربری فعال است.</p>
              <button id="admin-quick-login-btn" type="button" onClick={loginAsAdminDemo} className="w-full min-h-11 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm transition shadow-lg shadow-blue-600/30 active:scale-[0.98]">
                <UserCheck className="w-4 h-4" />
                <span>ورود نمایشی مدیر</span>
              </button>
            </div>
          )}

          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-700 w-full" />
            <span className="bg-slate-800 px-3 text-xs text-slate-500 shrink-0 font-medium">ورود با حساب مدیریت</span>
            <div className="border-t border-slate-700 w-full" />
          </div>

          <form onSubmit={handleStandardAdminLogin} className="space-y-4" noValidate>
            {errorMessage && (
              <div className="p-3 rounded-xl border border-rose-400/30 bg-rose-950/30 text-rose-100 text-xs leading-relaxed flex items-start gap-2" role="alert">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-300" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div>
              <label htmlFor="admin-login-email" className="block text-xs font-bold text-slate-300 mb-1.5">نام کاربری، ایمیل یا شماره موبایل</label>
              <input
                id="admin-login-email"
                type="text"
                required
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="admin یا admin@apexstore.local یا 09120000000"
                aria-invalid={Boolean(errorMessage)}
                className="w-full min-h-11 bg-slate-900/80 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus:border-blue-400 transition text-left"
                dir="ltr"
              />
            </div>

            <div>
              <label htmlFor="admin-login-password" className="block text-xs font-bold text-slate-300 mb-1.5">رمز عبور</label>
              <div className="relative">
                <input
                  id="admin-login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  aria-invalid={Boolean(errorMessage)}
                  className="w-full min-h-11 bg-slate-900/80 border border-slate-700 rounded-xl px-4 py-2.5 pl-12 text-sm text-white placeholder-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus:border-blue-400 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 transition"
                  aria-label={showPassword ? 'پنهان کردن رمز عبور' : 'نمایش رمز عبور'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4 mx-auto" /> : <Eye className="w-4 h-4 mx-auto" />}
                </button>
              </div>
            </div>

            <button id="admin-submit-login-btn" type="submit" disabled={isLoading} className="w-full min-h-11 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm transition active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              <span>{isLoading ? 'در حال تأیید...' : 'احراز هویت و ورود'}</span>
            </button>
          </form>

          <button type="button" onClick={() => navigateTo('auth')} className="w-full inline-flex justify-center items-center gap-1.5 text-xs font-semibold text-blue-300 hover:text-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded-lg py-1 transition">
            <KeyRound className="w-3.5 h-3.5" />
            بازیابی رمز عبور از صفحهٔ ورود
          </button>

          <div className="pt-2 text-center">
            <button id="admin-back-to-store-btn" type="button" onClick={() => navigateTo('home')} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded-lg py-1 transition">
              <ArrowRight className="w-3.5 h-3.5" />
              <span>بازگشت به وب‌سایت و فروشگاه نوین‌نت</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
