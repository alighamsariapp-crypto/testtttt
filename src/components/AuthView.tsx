import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowRight, 
  HelpCircle, 
  Clock, 
  LogIn, 
  Edit2, 
  Loader2, 
  ShieldCheck, 
  Smartphone,
  ChevronLeft,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  X
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ForgotPasswordModal } from './auth/ForgotPasswordModal';

interface AuthViewProps {
  isModal?: boolean;
  onCloseModal?: () => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ isModal = false, onCloseModal }) => {
  const { 
    login,
    loginWithPhone, 
    sendOtpCode, 
    loginWithGoogle, 
    setActiveView 
  } = useApp();

  // Steps: 'phone' | 'otp' | 'password'
  const [step, setStep] = useState<'phone' | 'otp' | 'password'>('phone');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [activeDigitIndex, setActiveDigitIndex] = useState(0);
  
  // Timer & Loading state
  const [timerSeconds, setTimerSeconds] = useState(119); // 01:59
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Format phone number for display (e.g. 0912 345 6789)
  const formatPhoneDisplay = (raw: string) => {
    const cleaned = raw.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
    }
    return raw;
  };

  // Timer countdown
  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds(prev => prev - 1);
      }, 1000);
    } else if (timerSeconds === 0) {
      setIsTimerRunning(false);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timerSeconds]);

  // Format timer into MM:SS (e.g. 01:59)
  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Step 1: Send OTP code
  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phone.trim().replace(/[\s-]/g, '');
    if (!/^09\d{9}$/.test(cleanPhone)) {
      setErrorMsg('لطفاً شمارهٔ موبایل ۱۱ رقمی را با صفر اول وارد کنید؛ مانند ۰۹xxxxxxxxx.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await sendOtpCode(cleanPhone);
      setStep('otp');
      setTimerSeconds(res.expiresIn || 119);
      setIsTimerRunning(true);
      setOtpDigits(['', '', '', '', '', '']);
      setActiveDigitIndex(0);
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 150);
    } catch (err: any) {
      setErrorMsg(err.message || 'خطا در ارسال کد تایید');
    } finally {
      setIsLoading(false);
    }
  };

  // OTP inputs handling
  const handleOtpChange = (index: number, value: string) => {
    const cleaned = value.replace(/\D/g, '');
    const newDigits = [...otpDigits];

    if (cleaned.length > 1) {
      // Paste handling
      const pastedChars = cleaned.slice(0, 6).split('');
      pastedChars.forEach((char, i) => {
        if (i < 6) newDigits[i] = char;
      });
      setOtpDigits(newDigits);
      const nextIdx = Math.min(pastedChars.length, 5);
      setActiveDigitIndex(nextIdx);
      inputRefs.current[nextIdx]?.focus();
      return;
    }

    newDigits[index] = cleaned;
    setOtpDigits(newDigits);

    if (cleaned && index < 5) {
      setActiveDigitIndex(index + 1);
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      setActiveDigitIndex(index - 1);
      inputRefs.current[index - 1]?.focus();
    }
  };

  // Step 2: Verify OTP
  const handleOtpSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const code = otpDigits.join('');
    if (code.length < 6) {
      setErrorMsg('لطفاً کد تایید ۶ رقمی را به صورت کامل وارد نمایید.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    try {
      await loginWithPhone(phone, code);
      setSuccessMsg('ورود با موفقیت انجام شد!');
      if (onCloseModal) {
        onCloseModal();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'کد تایید وارد شده نادرست یا منقضی شده است.');
    } finally {
      setIsLoading(false);
    }
  };

  // Email and password login
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setErrorMsg('لطفاً ایمیل و رمز عبور خود را وارد نمایید.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    try {
      await login(email.trim(), password);
      setSuccessMsg('ورود با موفقیت انجام شد!');
      if (onCloseModal) {
        onCloseModal();
      }
    } catch (err: any) {
      setErrorMsg('ایمیل یا رمز عبور اشتباه است.');
    } finally {
      setIsLoading(false);
    }
  };

  // Resend OTP code
  const handleResendCode = async () => {
    if (isTimerRunning) return;
    setIsLoading(true);
    setErrorMsg('');
    try {
      await sendOtpCode(phone);
      setTimerSeconds(119);
      setIsTimerRunning(true);
      setOtpDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch (err: any) {
      setErrorMsg(err.message || 'خطا در ارسال مجدد کد');
    } finally {
      setIsLoading(false);
    }
  };

  // Google OAuth Login
  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      await loginWithGoogle();
      if (onCloseModal) {
        onCloseModal();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'خطا در احراز هویت با گوگل');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className={isModal ? "p-5 sm:p-8" : "min-h-screen bg-slate-50/60 flex flex-col justify-between"}>
        
        {/* Top Header (Desktop) - only when full page view */}
        {!isModal && (
          <header className="w-full max-w-7xl mx-auto px-4 sm:px-8 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setActiveView('home')} 
                className="text-2xl font-black text-blue-700 font-sans tracking-tight hover:opacity-90 transition"
              >
                noovinnet
              </button>
            </div>

            <button
              onClick={() => setShowSupportModal(true)}
              className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-blue-600 font-medium transition px-3 py-1.5 rounded-xl hover:bg-white"
            >
              <HelpCircle className="w-4 h-4 text-slate-400" />
              <span>پشتیبانی</span>
            </button>
          </header>
        )}

        {/* Main Content Area */}
        <div className="relative w-full max-w-md mx-auto my-auto px-4 py-8">
          {isModal && (
            <button
              type="button"
              onClick={onCloseModal}
              className="absolute left-5 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-800 sm:hidden"
              aria-label="بستن پنجره ورود"
            >
              <X className="h-5 w-5" />
            </button>
          )}
          
          {/* ========================================================================= */}
          {/* STEP 1: PHONE NUMBER INPUT (عکس-02 دسکتاپ و عکس-03 / 04 موبایل) */}
          {/* ========================================================================= */}
          {step === 'phone' && (
            <div className={`${isModal ? 'space-y-6 text-center' : 'bg-white rounded-3xl border border-slate-100 p-6 sm:p-10 shadow-xs space-y-6 text-center'} animate-in fade-in zoom-in-95 duration-200`}>
              
              {/* Top Logo / Icon */}
              <div className="space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center mx-auto shadow-lg shadow-blue-600/25">
                  <Smartphone className="w-7 h-7" />
                </div>

                {/* Title & Subtitle */}
                <div className="space-y-1.5">
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900">
                    ورود یا عضویت
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-500">
                    برای ادامه شماره موبایل خود را وارد کنید
                  </p>
                </div>
              </div>

              {/* Error Message */}
              {errorMsg && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs text-right flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Phone Form */}
              <form onSubmit={handlePhoneSubmit} className="space-y-4">
                <div className="relative flex items-center">
                  <input
                    id="auth-phone-input"
                    type="tel"
                    dir="ltr"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="09xx xxx xxxx"
                    autoComplete="tel"
                    inputMode="tel"
                    className="w-full px-4 py-3.5 text-sm sm:text-base font-bold text-slate-900 bg-slate-50/80 border border-slate-200 rounded-2xl focus:outline-none focus:border-blue-600 focus:bg-white transition text-left font-sans tracking-wider"
                  />
                </div>

                {/* Submit Button */}
                <button
                  id="auth-submit-phone-btn"
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs sm:text-sm font-bold shadow-lg shadow-blue-600/30 transition hover:scale-101 flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <span>ارسال کد تایید</span>
                  )}
                </button>
              </form>

              {/* Password Option Link */}
              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={() => setStep('password')}
                  className="text-blue-600 hover:text-blue-700 font-bold"
                >
                  ورود با رمز عبور
                </button>
                <button
                  type="button"
                  onClick={() => setIsForgotPasswordOpen(true)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  فراموشی رمز عبور؟
                </button>
              </div>

              {/* Divider (یا) */}
              <div className="relative flex items-center justify-center">
                <div className="border-t border-slate-100 w-full" />
                <span className="bg-white px-3 text-xs text-slate-400 shrink-0 font-medium">یا</span>
                <div className="border-t border-slate-100 w-full" />
              </div>

              {/* Google Social Login */}
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className="w-full py-3 px-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-2xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-3 shadow-2xs hover:border-slate-300"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>ورود با گوگل</span>
              </button>

            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP: PASSWORD LOGIN */}
          {/* ========================================================================= */}
          {step === 'password' && (
            <div className={`${isModal ? 'space-y-6 text-center' : 'bg-white rounded-3xl border border-slate-100 p-6 sm:p-10 shadow-xs space-y-6 text-center'} animate-in fade-in zoom-in-95 duration-200`}>
              
              <div className="flex items-center justify-between pb-1">
                <button
                  onClick={() => setStep('phone')}
                  className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-600 font-bold transition group"
                >
                  <ArrowRight className="w-4 h-4 transition group-hover:-translate-x-0.5" />
                  <span>ورود با کد پیامکی</span>
                </button>
              </div>

              <div className="space-y-1.5">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900">
                  ورود با رمز عبور
                </h1>
                <p className="text-xs sm:text-sm text-slate-500">
                  نام کاربری، ایمیل یا شماره موبایل و کلمه عبور خود را وارد نمایید
                </p>
              </div>

              {errorMsg && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs text-right flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handlePasswordSubmit} className="space-y-4 text-right">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">نام کاربری، ایمیل یا شماره موبایل</label>
                  <input
                    type="text"
                    dir="ltr"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin یا admin@apexstore.local یا 09120000000"
                    autoComplete="username"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none text-left"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">رمز عبور</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      dir="ltr"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none pl-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="text-left">
                  <button
                    type="button"
                    onClick={() => setIsForgotPasswordOpen(true)}
                    className="text-xs text-blue-600 font-bold hover:underline"
                  >
                    فراموشی رمز عبور؟
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs sm:text-sm font-bold shadow-lg shadow-blue-600/30 transition flex items-center justify-center gap-2"
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <span>ورود به حساب</span>}
                </button>
              </form>

            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 2: OTP VERIFICATION (عکس-01 دسکتاپ و عکس-05 موبایل) */}
          {/* ========================================================================= */}
          {step === 'otp' && (
            <div className={`${isModal ? 'space-y-6 text-center' : 'bg-white rounded-3xl border border-slate-100 p-6 sm:p-10 shadow-xs space-y-6 text-center'} animate-in fade-in zoom-in-95 duration-200`}>
              
              {/* Top Back Link */}
              <div className="flex items-center justify-between pb-1">
                <button
                  onClick={() => {
                    setStep('phone');
                    setErrorMsg('');
                  }}
                  className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-600 font-bold transition group"
                >
                  <ArrowRight className="w-4 h-4 transition group-hover:-translate-x-0.5" />
                  <span>بازگشت به اصلاح شماره</span>
                </button>

                <button
                  onClick={() => setStep('phone')}
                  className="sm:hidden p-2 text-slate-400 hover:text-blue-600 rounded-full hover:bg-slate-100"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>

              {/* Title & Description */}
              <div className="space-y-1.5">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900">
                  تایید شماره موبایل
                </h1>
                <div className="text-xs sm:text-sm text-slate-500 flex items-center justify-center gap-1.5 flex-wrap">
                  <span>کد تایید به شماره</span>
                  <span dir="ltr" className="inline-flex font-bold text-slate-900 font-mono tracking-wide tabular-nums" style={{ unicodeBidi: 'isolate' }}>
                    {formatPhoneDisplay(phone)}
                  </span>
                  <span>ارسال شد.</span>
                </div>
              </div>

              {/* Feedback messages */}
              {errorMsg && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs text-right flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl text-xs text-right flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* 6-Digit OTP Input Boxes */}
              <form onSubmit={handleOtpSubmit} className="space-y-6">
                <div className="flex items-center justify-center gap-2 sm:gap-2.5" dir="ltr">
                  {otpDigits.map((digit, idx) => {
                    const isActive = activeDigitIndex === idx;
                    return (
                      <input
                        key={`otp-slot-${idx}`}
                        ref={(el) => (inputRefs.current[idx] = el)}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(idx, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                        onFocus={() => setActiveDigitIndex(idx)}
                        className={`w-11 h-13 sm:w-13 sm:h-15 text-center text-lg sm:text-xl font-black rounded-2xl border-2 transition font-sans bg-white focus:outline-none ${
                          digit
                            ? 'border-blue-600 text-blue-700 bg-blue-50/10'
                            : isActive
                            ? 'border-blue-600 shadow-md shadow-blue-600/20'
                            : 'border-slate-200 text-slate-900 hover:border-slate-300'
                        }`}
                      />
                    );
                  })}
                </div>

                {/* Resend Timer Box */}
                <div className="flex items-center justify-center gap-2 text-xs text-slate-500 font-sans">
                  {isTimerRunning ? (
                    <div className="flex items-center gap-1.5 text-slate-700 font-bold">
                      <span className="text-blue-600">{formatTimer(timerSeconds)}</span>
                      <span className="font-sans font-normal text-slate-500">تا ارسال مجدد کد</span>
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResendCode}
                      disabled={isLoading}
                      className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline"
                    >
                      ارسال مجدد کد تایید
                    </button>
                  )}
                </div>

                {/* Submit Button */}
                <button
                  id="auth-verify-otp-btn"
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs sm:text-sm font-bold shadow-lg shadow-blue-600/30 transition hover:scale-101 flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" />
                      <span>تایید و ورود</span>
                    </>
                  )}
                </button>
              </form>

              {/* Bottom Support Link */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowSupportModal(true)}
                  className="text-xs text-slate-400 hover:text-blue-600 transition"
                >
                  آیا در دریافت کد مشکلی دارید؟
                </button>
              </div>

            </div>
          )}

          {/* Footer Disclaimer */}
          <p className="text-[11px] text-slate-400 text-center mt-6 leading-relaxed max-w-xs mx-auto">
            با ورود یا ثبت نام، شما <button onClick={() => setActiveView('about')} className="text-slate-600 hover:text-blue-600 font-semibold underline">شرایط استفاده</button> و <button onClick={() => setActiveView('about')} className="text-slate-600 hover:text-blue-600 font-semibold underline">حریم خصوصی</button> ما را می‌پذیرید.
          </p>

        </div>

        {/* Footer copyright when in full-page mode */}
        {!isModal && (
          <footer className="py-4 text-center text-[11px] text-slate-400 font-sans">
            .noovinnet Premium Tech. All rights reserved 2024 ©
          </footer>
        )}

        {/* Support / Help Modal */}
        {showSupportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-xl space-y-4 text-right">
              <h3 className="text-sm font-bold text-slate-900">راهنمای دریافت کد تایید</h3>
              <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
                <p>۱. از درست بودن شماره موبایل و آنتن‌دهی گوشی خود اطمینان حاصل فرمایید.</p>
                <p>۲. در صورت عدم دریافت پیامک پس از پایان زمان تایمر، دکمه «ارسال مجدد کد» را لمس کنید.</p>
                <p>۳. اگر مشکل ادامه داشت، با پشتیبانی فروشگاه تماس بگیرید؛ کد تأیید فقط از طریق پیامک ارسال می‌شود.</p>
              </div>
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowSupportModal(false)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold"
                >
                  متوجه شدم
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Forgot Password Modal (Matches Image 05 Desktop & Image 06 Mobile) */}
        <ForgotPasswordModal
          isOpen={isForgotPasswordOpen}
          onClose={() => setIsForgotPasswordOpen(false)}
          onBackToLogin={() => setIsForgotPasswordOpen(false)}
        />

      </div>
    </>
  );
};
