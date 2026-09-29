import React, { useState, useEffect } from 'react';
import { ArrowRight, Search, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { getStorefrontProducts } from '../utils/catalogQuality';

export const SearchOverlay: React.FC = () => {
  const { 
    isSearchOverlayOpen, 
    setSearchOverlayOpen, 
    products, 
    navigateToProduct, 
    setActiveView 
  } = useApp();

  useBodyScrollLock(isSearchOverlayOpen);

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Debounce search query to prevent excessive evaluations & race conditions
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 150);

    return () => {
      clearTimeout(handler);
    };
  }, [query]);

  const popularSearches = ['مودم 5G', 'مودم 4G', 'مودم همراه', 'روتر'];

  const filteredProducts = debouncedQuery
    ? getStorefrontProducts(products).filter(p =>
        p.name.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
        p.category_name?.toLowerCase().includes(debouncedQuery.toLowerCase())
      )
    : [];

  if (!isSearchOverlayOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] bg-white flex flex-col animate-in slide-in-from-bottom-8 duration-200">
      {/* Search Header Bar (Matching 2.png / 10.png) */}
      <div className="shrink-0 p-4 pt-[calc(1rem+env(safe-area-inset-top))] border-b border-slate-100 flex items-center gap-3">
        
        {/* Back Button (Right arrow in RTL) */}
        <button
          id="close-search-overlay-btn"
          onClick={() => setSearchOverlayOpen(false)}
          className="min-w-11 min-h-11 p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition"
          aria-label="بستن جست‌وجو"
        >
          <ArrowRight className="w-6 h-6" />
        </button>

        {/* Search Input */}
        <div className="flex-1 relative">
          <input
            id="mobile-search-overlay-input"
            type="text"
            placeholder="جستجو در محصولات..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="w-full pl-10 pr-4 py-2.5 bg-blue-50/50 border border-blue-500 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-800 placeholder:text-slate-400"
          />
          <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {query && (
              <button 
                onClick={() => setQuery('')}
                className="text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <Search className="w-4 h-4 text-slate-500" />
          </div>
        </div>

      </div>

      {/* Content Area */}
      <div className="p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] flex-1 overflow-y-auto">
        
        {/* Popular Searches Chips (Matching 2.png / 10.png) */}
        {!query.trim() && (
          <div>
            <h4 className="text-xs font-bold text-slate-500 mb-3.5">جستجوهای محبوب</h4>
            <div className="flex flex-wrap gap-2.5">
              {popularSearches.map((chip) => (
                <button
                  key={chip}
                  onClick={() => setQuery(chip)}
                  className="px-4 py-2 bg-slate-50 border border-slate-200/80 rounded-full text-xs font-medium text-slate-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Live Search Results */}
        {query.trim() && (
          <div>
            <div className="text-xs font-bold text-slate-400 mb-3">
              نتایج یافت شده ({filteredProducts.length})
            </div>
            {filteredProducts.length > 0 ? (
              <div className="space-y-2.5">
                {filteredProducts.map(p => (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => {
                      navigateToProduct(p.slug);
                      setSearchOverlayOpen(false);
                    }}
                    className="w-full min-h-16 flex items-center justify-between p-3 rounded-2xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/40 transition text-right"
                  >
                    <div className="flex items-center gap-3">
                      <img src={p.image_url} alt={p.name} className="w-12 h-12 rounded-xl object-cover bg-slate-100" />
                      <div>
                        <div className="text-sm font-semibold text-slate-800">{p.name}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{p.category_name}</div>
                      </div>
                    </div>
                    <div className="text-sm font-bold text-blue-600">
                      {p.effective_price?.toLocaleString('fa-IR')} {p.currency}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400 text-sm">
                هیچ محصولی مطابق با جستجوی شما یافت نشد.
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
