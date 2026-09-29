import React from 'react';

/**
 * Skeleton pulse base component
 */
export const SkeletonBox: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse bg-slate-200/80 rounded-2xl ${className}`} />
);

/**
 * Product Card Skeleton for Grid
 */
export const ProductCardSkeleton: React.FC = () => (
  <div className="bg-white rounded-3xl p-4 border border-slate-100 shadow-2xs flex flex-col justify-between space-y-4">
    {/* Top Badges & Fav */}
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        <SkeletonBox className="w-14 h-5 rounded-lg" />
        <SkeletonBox className="w-16 h-5 rounded-lg" />
      </div>
      <SkeletonBox className="w-8 h-8 rounded-xl" />
    </div>

    {/* Image placeholder */}
    <div className="w-full aspect-4/3 flex items-center justify-center p-2">
      <SkeletonBox className="w-4/5 h-4/5 rounded-2xl" />
    </div>

    {/* Title & category */}
    <div className="space-y-2">
      <SkeletonBox className="w-1/3 h-3.5 rounded-md" />
      <SkeletonBox className="w-full h-5 rounded-md" />
      <SkeletonBox className="w-3/4 h-4 rounded-md" />
    </div>

    {/* Specs Tags */}
    <div className="flex items-center gap-1.5 pt-1">
      <SkeletonBox className="w-12 h-4 rounded-md" />
      <SkeletonBox className="w-16 h-4 rounded-md" />
      <SkeletonBox className="w-14 h-4 rounded-md" />
    </div>

    {/* Price & Action button */}
    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
      <div className="space-y-1">
        <SkeletonBox className="w-10 h-3 rounded-md" />
        <SkeletonBox className="w-24 h-6 rounded-lg" />
      </div>
      <SkeletonBox className="w-10 h-10 rounded-2xl" />
    </div>
  </div>
);

/**
 * Product Grid Skeleton (Displays a responsive grid of card skeletons)
 */
export const ProductGridSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 animate-in fade-in duration-200">
    {Array.from({ length: count }).map((_, i) => (
      <ProductCardSkeleton key={`product-skel-${i}`} />
    ))}
  </div>
);

/**
 * Sidebar Filters Skeleton
 */
export const FilterSidebarSkeleton: React.FC = () => (
  <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-xs space-y-5 animate-pulse">
    {/* Header */}
    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
      <SkeletonBox className="w-28 h-5 rounded-md" />
      <SkeletonBox className="w-12 h-4 rounded-md" />
    </div>

    {/* Switch row */}
    <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50">
      <SkeletonBox className="w-24 h-4 rounded-md" />
      <SkeletonBox className="w-10 h-6 rounded-full" />
    </div>

    {/* Accordion Skeletons */}
    <div className="space-y-4 pt-2">
      <div className="space-y-2">
        <SkeletonBox className="w-20 h-4 rounded-md" />
        <SkeletonBox className="w-full h-8 rounded-xl" />
        <SkeletonBox className="w-full h-8 rounded-xl" />
      </div>
      <div className="space-y-2 pt-2 border-t border-slate-100">
        <SkeletonBox className="w-24 h-4 rounded-md" />
        <div className="flex gap-2">
          <SkeletonBox className="w-16 h-7 rounded-xl" />
          <SkeletonBox className="w-16 h-7 rounded-xl" />
          <SkeletonBox className="w-16 h-7 rounded-xl" />
        </div>
      </div>
      <div className="space-y-2 pt-2 border-t border-slate-100">
        <SkeletonBox className="w-28 h-4 rounded-md" />
        <SkeletonBox className="w-full h-6 rounded-lg" />
      </div>
    </div>
  </div>
);

/**
 * Category Header / Banner Skeleton
 */
export const CategoryHeaderSkeleton: React.FC = () => (
  <div className="mb-6 p-6 rounded-3xl bg-slate-900/90 text-white shadow-xl space-y-4 animate-pulse">
    <div className="flex items-center gap-3">
      <SkeletonBox className="w-12 h-12 rounded-2xl bg-slate-800" />
      <div className="space-y-2">
        <SkeletonBox className="w-40 h-6 rounded-lg bg-slate-800" />
        <SkeletonBox className="w-64 h-4 rounded-md bg-slate-800" />
      </div>
    </div>
    <div className="flex gap-2 pt-2">
      <SkeletonBox className="w-24 h-8 rounded-xl bg-slate-800" />
      <SkeletonBox className="w-28 h-8 rounded-xl bg-slate-800" />
      <SkeletonBox className="w-20 h-8 rounded-xl bg-slate-800" />
    </div>
  </div>
);

/**
 * Product Detail Page Skeleton
 */
export const ProductDetailSkeleton: React.FC = () => (
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8 animate-in fade-in duration-200">
    {/* Breadcrumbs */}
    <div className="flex items-center gap-2">
      <SkeletonBox className="w-12 h-4 rounded-md" />
      <SkeletonBox className="w-4 h-4 rounded-md" />
      <SkeletonBox className="w-20 h-4 rounded-md" />
      <SkeletonBox className="w-4 h-4 rounded-md" />
      <SkeletonBox className="w-32 h-4 rounded-md" />
    </div>

    {/* Main Grid: Gallery (right) & Info (left) in RTL */}
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      
      {/* Right Column (5 cols): Gallery */}
      <div className="lg:col-span-5 space-y-4">
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xs">
          <SkeletonBox className="w-full aspect-square rounded-2xl" />
        </div>
        <div className="flex gap-3 justify-center">
          <SkeletonBox className="w-16 h-16 rounded-2xl" />
          <SkeletonBox className="w-16 h-16 rounded-2xl" />
          <SkeletonBox className="w-16 h-16 rounded-2xl" />
          <SkeletonBox className="w-16 h-16 rounded-2xl" />
        </div>
      </div>

      {/* Left Column (7 cols): Details, Variants & Buy Box */}
      <div className="lg:col-span-7 space-y-6">
        
        {/* Title & Badges */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SkeletonBox className="w-20 h-5 rounded-full" />
              <SkeletonBox className="w-24 h-5 rounded-full" />
            </div>
            <SkeletonBox className="w-9 h-9 rounded-2xl" />
          </div>

          <div className="space-y-2">
            <SkeletonBox className="w-3/4 h-7 rounded-xl" />
            <SkeletonBox className="w-1/2 h-5 rounded-lg" />
          </div>

          {/* Rating */}
          <div className="flex items-center gap-2 pt-2">
            <SkeletonBox className="w-24 h-5 rounded-md" />
            <SkeletonBox className="w-16 h-4 rounded-md" />
          </div>
        </div>

        {/* Specs highlights */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xs space-y-4">
          <SkeletonBox className="w-32 h-5 rounded-md" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <SkeletonBox className="h-14 rounded-2xl" />
            <SkeletonBox className="h-14 rounded-2xl" />
            <SkeletonBox className="h-14 rounded-2xl" />
            <SkeletonBox className="h-14 rounded-2xl" />
            <SkeletonBox className="h-14 rounded-2xl" />
            <SkeletonBox className="h-14 rounded-2xl" />
          </div>
        </div>

        {/* Price & Purchase Box */}
        <div className="bg-white rounded-3xl p-6 border border-blue-100 shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <SkeletonBox className="w-16 h-4 rounded-md" />
              <SkeletonBox className="w-36 h-8 rounded-xl" />
            </div>
            <SkeletonBox className="w-24 h-8 rounded-xl" />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <SkeletonBox className="w-28 h-12 rounded-2xl" />
            <SkeletonBox className="flex-1 h-12 rounded-2xl" />
          </div>
        </div>

      </div>
    </div>
  </div>
);

/**
 * Cart Page Partial Skeleton
 */
export const CartSkeleton: React.FC = () => (
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 animate-in fade-in duration-200">
    {/* Breadcrumbs */}
    <div className="flex items-center gap-2">
      <SkeletonBox className="w-12 h-4 rounded-md" />
      <SkeletonBox className="w-4 h-4 rounded-md" />
      <SkeletonBox className="w-20 h-4 rounded-md" />
    </div>

    {/* Stepper bar */}
    <div className="border-b border-slate-100 pb-4">
      <div className="flex items-center justify-center gap-8 max-w-md mx-auto">
        <SkeletonBox className="w-24 h-8 rounded-full" />
        <SkeletonBox className="w-24 h-8 rounded-full" />
        <SkeletonBox className="w-24 h-8 rounded-full" />
      </div>
    </div>

    {/* Main Grid */}
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
      
      {/* Items list (8 cols) */}
      <div className="lg:col-span-8 space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={`cart-item-skel-${i}`} className="bg-white rounded-3xl border border-slate-100 p-4 sm:p-5 shadow-xs flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-1">
              <SkeletonBox className="w-20 h-20 rounded-2xl shrink-0" />
              <div className="space-y-2 flex-1">
                <SkeletonBox className="w-3/4 h-5 rounded-md" />
                <SkeletonBox className="w-1/3 h-4 rounded-md" />
                <SkeletonBox className="w-24 h-5 rounded-md" />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3">
              <SkeletonBox className="w-24 h-9 rounded-xl" />
              <SkeletonBox className="w-8 h-8 rounded-xl" />
            </div>
          </div>
        ))}
      </div>

      {/* Summary Sidebar (4 cols) */}
      <div className="lg:col-span-4 space-y-4">
        <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-xs space-y-4">
          <SkeletonBox className="w-28 h-5 rounded-md" />
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex justify-between">
              <SkeletonBox className="w-20 h-4 rounded-md" />
              <SkeletonBox className="w-24 h-4 rounded-md" />
            </div>
            <div className="flex justify-between">
              <SkeletonBox className="w-16 h-4 rounded-md" />
              <SkeletonBox className="w-20 h-4 rounded-md" />
            </div>
            <div className="flex justify-between pt-2 border-t border-slate-100">
              <SkeletonBox className="w-24 h-5 rounded-md" />
              <SkeletonBox className="w-28 h-6 rounded-lg" />
            </div>
          </div>
          <SkeletonBox className="w-full h-12 rounded-2xl pt-2" />
        </div>
      </div>

    </div>
  </div>
);
