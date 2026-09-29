import { useEffect } from 'react';

let activeLocks = 0;
let savedScrollY = 0;
let previousBodyCssText = '';
let previousHtmlCssText = '';

/**
 * Prevents the document behind a modal, drawer, or fullscreen overlay from moving.
 * Multiple simultaneous overlays share one lock and the original scroll position is restored on close.
 */
export const useBodyScrollLock = (isLocked: boolean): void => {
  useEffect(() => {
    if (!isLocked || typeof window === 'undefined') return;

    const { body, documentElement } = document;
    if (activeLocks === 0) {
      savedScrollY = window.scrollY;
      previousBodyCssText = body.style.cssText;
      previousHtmlCssText = documentElement.style.cssText;
      body.style.position = 'fixed';
      body.style.top = `-${savedScrollY}px`;
      body.style.left = '0';
      body.style.right = '0';
      body.style.width = '100%';
      body.style.overflow = 'hidden';
      body.style.overscrollBehavior = 'none';
      documentElement.style.overflow = 'hidden';
      documentElement.style.overscrollBehavior = 'none';
    }
    activeLocks += 1;

    return () => {
      activeLocks = Math.max(0, activeLocks - 1);
      if (activeLocks !== 0) return;

      body.style.cssText = previousBodyCssText;
      documentElement.style.cssText = previousHtmlCssText;
      window.scrollTo({ top: savedScrollY, left: 0, behavior: 'instant' });
    };
  }, [isLocked]);
};
