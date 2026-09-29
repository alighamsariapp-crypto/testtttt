import React from 'react';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { X } from 'lucide-react';
import { ModalPortal } from './ModalPortal';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footerActions?: React.ReactNode;
  maxHeight?: string; // e.g. "max-h-[85vh]"
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footerActions,
  maxHeight = 'max-h-[85vh]',
}) => {
  useBodyScrollLock(isOpen);

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div className="ui-modal-backdrop flex-col justify-end p-0 sm:justify-center sm:items-center sm:p-4">
      {/* Backdrop */}
      <button
        type="button"
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
        aria-label="بستن پنجره"
      />

      {/* Sheet / Modal Container */}
      <section
        className={`relative bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl z-10 flex flex-col ${maxHeight} animate-in slide-in-from-bottom duration-250 ease-out border border-slate-100 overflow-hidden overscroll-contain`}
        role="dialog"
        aria-modal="true"
        aria-label={title || 'پنجرهٔ اطلاعات'}
      >
        {/* Mobile Pull / Drag Indicator */}
        <button type="button" onClick={onClose} className="sm:hidden min-h-11 pt-3 pb-1 w-full flex justify-center items-center" aria-label="بستن پنجره">
          <span className="w-12 h-1.5 rounded-full bg-slate-300 hover:bg-slate-400 transition" />
        </button>

        {/* Header */}
        {(title || icon) && (
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 bg-white shrink-0">
            <div className="flex items-center gap-3">
              {icon && (
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  {icon}
                </div>
              )}
              <div>
                {title && <h3 className="text-sm sm:text-base font-extrabold text-slate-900">{title}</h3>}
                {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="min-w-11 min-h-11 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition shrink-0"
              aria-label="بستن"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Internal Scrollable Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4 text-slate-700">
          {children}
        </div>

        {/* Sticky Action Footer */}
        {footerActions && (
          <div className="p-4 border-t border-slate-100 bg-slate-50/80 backdrop-blur-xs flex items-center gap-3 shrink-0">
            {footerActions}
          </div>
        )}
      </section>
      </div>
    </ModalPortal>
  );
};
