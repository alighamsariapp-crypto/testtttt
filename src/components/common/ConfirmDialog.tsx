import React, { useEffect, useRef } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  isBusy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  description,
  confirmLabel,
  cancelLabel = 'انصراف',
  tone = 'danger',
  isBusy = false,
  onConfirm,
  onCancel,
}) => {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  useBodyScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen) return;
    cancelButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isBusy) onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isBusy, onCancel]);

  if (!isOpen) return null;

  const confirmClass = tone === 'danger'
    ? 'bg-rose-600 hover:bg-rose-700 focus-visible:ring-rose-300'
    : 'bg-blue-600 hover:bg-blue-700 focus-visible:ring-blue-300';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="presentation">
      <button type="button" className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => !isBusy && onCancel()} aria-label="بستن پنجرهٔ تأیید" />
      <section className="relative w-full max-w-sm rounded-3xl bg-white border border-slate-200 shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150" role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-description">
        <div className="flex items-start justify-between gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${tone === 'danger' ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'}`}>
            <AlertTriangle className="w-6 h-6" />
          </div>
          <button type="button" onClick={onCancel} disabled={isBusy} className="w-10 h-10 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50 transition" aria-label="بستن پنجرهٔ تأیید">
            <X className="w-5 h-5 mx-auto" />
          </button>
        </div>
        <div className="space-y-1.5">
          <h2 id="confirm-dialog-title" className="text-base font-extrabold text-slate-900">{title}</h2>
          <p id="confirm-dialog-description" className="text-xs sm:text-sm text-slate-600 leading-relaxed">{description}</p>
        </div>
        <div className="flex items-center justify-end gap-2 pt-2">
          <button ref={cancelButtonRef} type="button" onClick={onCancel} disabled={isBusy} className="min-h-11 px-4 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50 transition">
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} disabled={isBusy} className={`min-h-11 px-5 rounded-xl text-xs font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-60 transition ${confirmClass}`}>
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
};
