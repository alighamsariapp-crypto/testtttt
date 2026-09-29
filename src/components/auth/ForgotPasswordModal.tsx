import React, { useEffect, useState } from 'react';
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, KeyRound, Loader2, Lock, Smartphone, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { ModalPortal } from '../common/ModalPortal';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBackToLogin: () => void;
}

const toEnglishDigits = (value: string) => value.replace(/[۰-۹٠-٩]/g, (digit) => {
  const digits = '۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩';
  return String(digits.indexOf(digit) % 10);
});

const normalizePhone = (value: string) => {
  const digits = toEnglishDigits(value).replace(/[^0-9+]/g, '');
  if (digits.startsWith('+98')) return `0${digits.slice(3)}`;
  if (digits.startsWith('0098')) return `0${digits.slice(4)}`;
  if (digits.startsWith('98')) return `0${digits.slice(2)}`;
  return digits;
};

const formatTimer = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({ isOpen, onClose, onBackToLogin }) => {
  const { showToast, requestPasswordResetSms, resetPasswordWithSms } = useApp();
  const [step, setStep] = useState<'input' | 'verify' | 'success'>('input');
  const [phone, setPhone] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resendSeconds, setResendSeconds] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  useBodyScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen) {
      setStep('input');
      setPhone('');
      setVerificationCode('');
      setNewPassword('');
      setConfirmPassword('');
      setResendSeconds(0);
      setErrorMsg('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || step !== 'verify' || resendSeconds <= 0) return;
    const timer = window.setInterval(() => setResendSeconds((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [isOpen, step, resendSeconds]);

  if (!isOpen) return null;

  const sendCode = async () => {
    const normalizedPhone = normalizePhone(phone);
    if (!/^09\d{9}$/.test(normalizedPhone)) {
      setErrorMsg('شمارهٔ موبایل ایران را به‌صورت ۰۹xxxxxxxxx وارد کنید.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    try {
      const result = await requestPasswordResetSms(normalizedPhone);
      setPhone(normalizedPhone);
      setResendSeconds(Math.max(0, result.resendIn));
      setStep('verify');
      showToast('اگر حساب واجدشرایطی با این شماره وجود داشته باشد، کد بازیابی ارسال می‌شود.', 'info');
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'ارسال کد بازیابی انجام نشد.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendCode = async (event: React.FormEvent) => {
    event.preventDefault();
    await sendCode();
  };

  const handleResendCode = async () => {
    if (resendSeconds > 0 || isLoading) return;
    await sendCode();
  };

  const handleResetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    const code = toEnglishDigits(verificationCode).replace(/\D/g, '');

    if (!/^\d{6}$/.test(code)) {
      setErrorMsg('کد بازیابی باید ۶ رقم باشد.');
      return;
    }
    if (newPassword.length < 8) {
      setErrorMsg('رمز عبور جدید باید حداقل ۸ کاراکتر باشد.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('رمز عبور جدید با تکرار آن یکسان نیست.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    try {
      await resetPasswordWithSms({
        phone: normalizePhone(phone),
        code,
        password: newPassword,
        password_confirmation: confirmPassword,
      });
      setStep('success');
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'بازیابی رمز عبور انجام نشد.');
    } finally {
      setIsLoading(false);
    }
  };

  const changePhone = () => {
    setStep('input');
    setVerificationCode('');
    setNewPassword('');
    setConfirmPassword('');
    setErrorMsg('');
  };

  return (
    <ModalPortal>
      <div className="ui-modal-backdrop animate-in fade-in duration-200">
        <button type="button" className="fixed inset-0" onClick={onClose} aria-label="بستن بازیابی رمز" />

        <div className="ui-modal-panel relative z-10 w-full max-w-md p-6 sm:p-8 text-center space-y-6 animate-in zoom-in-95 duration-200">
          <button type="button" onClick={onClose} className="absolute top-4 left-4 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition" aria-label="بستن">
            <X className="w-5 h-5" />
          </button>

          {step === 'input' && (
            <div className="space-y-6">
              <div className="w-16 h-16 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto shadow-inner"><KeyRound className="w-8 h-8" /></div>
              <div className="space-y-2">
                <h2 className="text-xl font-black text-slate-900">فراموشی رمز عبور</h2>
                <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">شمارهٔ موبایلی را وارد کنید که قبلاً در حساب کاربری خود تأیید کرده‌اید.</p>
              </div>

              {errorMsg && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs text-right flex items-center gap-2"><AlertCircle className="w-4 h-4 shrink-0" /><span>{errorMsg}</span></div>}

              <form onSubmit={handleSendCode} className="space-y-4 text-right">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">شمارهٔ موبایل</label>
                  <div className="relative">
                    <input type="tel" inputMode="numeric" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} required placeholder="09xxxxxxxxx" className="w-full pl-4 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-900 font-mono focus:bg-white focus:border-blue-600 focus:outline-none transition" dir="ltr" />
                    <Smartphone className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>
                <button type="submit" disabled={isLoading} className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-bold transition shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 disabled:opacity-60">
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span>ارسال کد بازیابی</span><ArrowLeft className="w-4 h-4" /></>}
                </button>
              </form>

              <button type="button" onClick={onBackToLogin} className="text-xs font-bold text-slate-500 hover:text-blue-600 transition flex items-center justify-center gap-1.5 mx-auto"><ArrowRight className="w-4 h-4" /><span>بازگشت به صفحه ورود</span></button>
            </div>
          )}

          {step === 'verify' && (
            <div className="space-y-6">
              <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-inner"><Lock className="w-8 h-8" /></div>
              <div className="space-y-1">
                <h2 className="text-xl font-black text-slate-900">تعیین رمز عبور جدید</h2>
                <p className="text-xs text-slate-500 leading-relaxed">کد ارسال‌شده به <span className="font-mono font-bold text-slate-700" dir="ltr">{phone}</span> را وارد کنید.</p>
              </div>

              {errorMsg && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs text-right flex items-center gap-2"><AlertCircle className="w-4 h-4 shrink-0" /><span>{errorMsg}</span></div>}

              <form onSubmit={handleResetPassword} className="space-y-4 text-right">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">کد بازیابی ۶ رقمی</label>
                  <input type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={verificationCode} onChange={(event) => setVerificationCode(toEnglishDigits(event.target.value).replace(/\D/g, '').slice(0, 6))} placeholder="------" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-center text-base font-mono font-bold tracking-widest focus:bg-white focus:border-blue-600 focus:outline-none" dir="ltr" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">رمز عبور جدید</label>
                  <input type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="حداقل ۸ کاراکتر" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">تکرار رمز عبور جدید</label>
                  <input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="تکرار رمز عبور" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none" />
                </div>
                <button type="submit" disabled={isLoading} className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-bold transition shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 disabled:opacity-60">
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>ذخیرهٔ رمز عبور و ورود</span>}
                </button>
              </form>

              <div className="space-y-3">
                {resendSeconds > 0 ? <p className="text-xs text-slate-500">امکان ارسال مجدد تا <span className="font-mono font-bold text-blue-600" dir="ltr">{formatTimer(resendSeconds)}</span> دیگر</p> : <button type="button" onClick={handleResendCode} disabled={isLoading} className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline disabled:opacity-60">ارسال مجدد کد بازیابی</button>}
                <button type="button" onClick={changePhone} className="block mx-auto text-xs text-slate-400 hover:text-blue-600 transition">اصلاح شمارهٔ موبایل</button>
              </div>
            </div>
          )}

          {step === 'success' && (
            <div className="space-y-6 py-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner"><CheckCircle2 className="w-8 h-8" /></div>
              <div className="space-y-2"><h2 className="text-xl font-black text-slate-900">رمز عبور تغییر کرد</h2><p className="text-xs text-slate-500">رمز جدید ذخیره شد و برای امنیت، همهٔ نشست‌های قبلی از حساب خارج شدند. اکنون وارد حساب خود هستید.</p></div>
              <button type="button" onClick={onClose} className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-bold transition shadow-md shadow-blue-500/20">ادامه</button>
            </div>
          )}
        </div>
      </div>
    </ModalPortal>
  );
};
