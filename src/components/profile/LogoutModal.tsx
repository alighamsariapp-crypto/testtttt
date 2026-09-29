import React from 'react';
import { LogOut, X, ShieldCheck } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { UserIdentityBadge } from '../common/UserIdentityBadge';
import { ModalPortal } from '../common/ModalPortal';

interface LogoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const LogoutModal: React.FC<LogoutModalProps> = ({ isOpen, onClose, onConfirm }) => {
  const { user } = useApp();
  useBodyScrollLock(isOpen);

  if (!isOpen || !user) return null;

  return (
    <ModalPortal>
      <div className="ui-modal-backdrop p-0 sm:p-4 animate-in fade-in duration-200">
      
      {/* Backdrop click */}
      <button type="button" className="fixed inset-0" onClick={onClose} aria-label="بستن پنجره خروج" />

      {/* ========================================================================= */}
      {/* DESKTOP MODAL (Matches Image 07) */}
      {/* ========================================================================= */}
      <div className="ui-modal-panel hidden sm:block relative z-10 p-8 max-w-md w-full text-center space-y-6 animate-in zoom-in-95 duration-200">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Logout Circular Icon */}
        <div className="w-16 h-16 rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto shadow-inner">
          <LogOut className="w-8 h-8 rotate-180" />
        </div>

        {/* Heading & Text */}
        <div className="space-y-2">
          <h3 className="text-xl font-black text-slate-900">خروج از حساب کاربری</h3>
          <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
            آیا مطمئن هستید که می‌خواهید از سیستم <span className="font-sans font-bold text-blue-600">noovinnet</span> خارج شوید؟ برای دسترسی مجدد نیاز به ورود خواهید داشت.
          </p>
        </div>

        {/* User Card Preview */}
        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3.5 flex items-center gap-3 text-right">
          <UserIdentityBadge
            name={user.name}
            className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 ring-2 ring-white shadow-xs"
            iconClassName="w-4 h-4"
          />
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-bold text-slate-900 truncate">{user.name}</h4>
            <p className="text-[11px] text-slate-400 font-mono truncate">{user.email || user.phone}</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-2xl text-xs font-bold transition border border-slate-200"
          >
            انصراف
          </button>

          <button
            type="button"
            onClick={onConfirm}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-bold transition shadow-md shadow-blue-500/20"
          >
            بله، خارج می‌شوم
          </button>
        </div>

        {/* Secure connection indicator */}
        <div className="pt-2 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>ارتباط امن و خروج مطمئن از سرور</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MOBILE BOTTOM SHEET (Matches Image 08) */}
      {/* ========================================================================= */}
      <div className="ui-modal-panel sm:hidden relative z-10 rounded-t-3xl p-6 w-full text-center space-y-5 animate-in slide-in-from-bottom duration-300">
        {/* Handle Bar */}
        <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto -mt-2 mb-2" />

        {/* Red Logout Circle */}
        <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto shadow-inner">
          <LogOut className="w-8 h-8 rotate-180" />
        </div>

        {/* Heading & Subtitle */}
        <div className="space-y-1.5">
          <h3 className="text-lg font-black text-slate-900">خروج از حساب کاربری</h3>
          <p className="text-xs text-slate-500 leading-relaxed px-2">
            آیا مطمئن هستید که می‌خواهید از حساب کاربری خود در نوین‌نت خارج شوید؟ برای دسترسی مجدد نیاز به ورود خواهید داشت.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5 pt-2">
          <button
            type="button"
            onClick={onConfirm}
            className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-xs font-bold transition shadow-md shadow-rose-500/20 flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4 rotate-180" />
            <span>خروج از حساب</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-3.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-2xl text-xs font-bold transition border border-slate-200"
          >
            انصراف
          </button>
        </div>
      </div>

      </div>
    </ModalPortal>
  );
};
