import React from 'react';
import { X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { ModalPortal } from './common/ModalPortal';

const AuthView = React.lazy(() => import('./AuthView').then((module) => ({ default: module.AuthView })));

export const AuthModal: React.FC = () => {
  const { isAuthModalOpen, setAuthModalOpen } = useApp();
  useBodyScrollLock(isAuthModalOpen);

  if (!isAuthModalOpen) return null;

  return (
    <ModalPortal>
      <div className="ui-modal-backdrop p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="ui-modal-panel w-full h-full bg-white sm:h-auto sm:max-w-lg sm:rounded-3xl relative overflow-hidden flex flex-col justify-between animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
        
        {/* Close Button on Desktop */}
        <button
          onClick={() => setAuthModalOpen(false)}
          className="absolute top-4 left-4 z-10 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition hidden sm:flex"
          aria-label="بستن پنجره"
        >
          <X className="w-5 h-5" />
        </button>

        <React.Suspense fallback={<div className="min-h-[12rem]" aria-busy="true" aria-label="در حال بارگذاری فرم ورود" />}>
          <AuthView isModal={true} onCloseModal={() => setAuthModalOpen(false)} />
        </React.Suspense>
      </div>
      </div>
    </ModalPortal>
  );
};
