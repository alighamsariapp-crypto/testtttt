import React from 'react';
import { useApp } from '../context/AppContext';
import { CartStep1Items } from './cart/CartStep1Items';
import { CartStep2Address } from './cart/CartStep2Address';
import { CartStep3Payment } from './cart/CartStep3Payment';
import { CartSkeleton } from './common/Skeletons';

export const CartView: React.FC = () => {
  const { checkoutStep, isLoadingData } = useApp();

  if (isLoadingData) {
    return <CartSkeleton />;
  }

  switch (checkoutStep) {
    case 1:
      return <CartStep1Items />;
    case 2:
      return <CartStep2Address />;
    case 3:
      return <CartStep3Payment />;
    default:
      return <CartStep1Items />;
  }
};

export default CartView;

