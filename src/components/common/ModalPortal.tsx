import React from 'react';
import { createPortal } from 'react-dom';

interface ModalPortalProps {
  children: React.ReactNode;
}

/**
 * Renders blocking dialogs at document.body so local stacking contexts created by
 * sticky, transform, opacity or positioned dashboard widgets cannot cover them.
 */
export const ModalPortal: React.FC<ModalPortalProps> = ({ children }) => {
  if (typeof document === 'undefined') return null;

  return createPortal(children, document.body);
};
