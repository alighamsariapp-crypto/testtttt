import React, { useState } from 'react';
import { 
  Package, 
  Search, 
  Filter, 
  Plus, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  Star, 
  ExternalLink, 
  AlertTriangle,
  Layers,
  ChevronLeft,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Product } from '../../types';
import { AdminProductModal } from './AdminProductModal';
import { catalogQualityLabel, getCatalogQualityIssues } from '../../utils/catalogQuality';

export const AdminProductsTab: React.FC<{ onOpenNewProductModal: () => void }> = ({ onOpenNewProductModal }) => {
  const { 
    products, 
    categories, 
    deleteProduct, 
    toggleProductStock, 
    toggleProductFeatured, 
    toggleProductActive,
    navigateToProduct 
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'out_of_stock' | 'discounted'>('all');
  
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const productsNeedingReview = products.filter((product) => getCatalogQualityIssues(product).length > 0);

  // Filter products
  const filteredProducts = products.filter(p => {
    // Search match
    const matchesSearch = !searchTerm.trim() || 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.brand?.toLowerCase().includes(searchTerm.toLowerCase());

    // Category match
    const matchesCategory = selectedCategory === 'all' || p.category_slug === selectedCategory;

    // Stock filter match
    let matchesStock = true;
    if (stockFilter === 'in_stock') matchesStock = p.in_stock;
    if (stockFilter === 'out_of_stock') matchesStock = !p.in_stock;
    if (stockFilter === 'discounted') matchesStock = !!(p.discount_percentage && p.discount_percentage > 0);

    return matchesSearch && matchesCategory && matchesStock;
  });

  const handleOpenEdit = (product: Product) => {
    setEditingProduct(product);
    setIsModalOpen(true);
  };

  const handleOpenNew = () => {
    setEditingProduct(null);
    setIsModalOpen(true);
  };

  const handleDelete = (id: number) => {
    deleteProduct(id);
    setDeleteConfirmId(null);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300" dir="rtl">
      
      {/* Top Header Card */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-slate-700/80 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
              مدیریت محصولات و انبار کالاها
            </h1>
            <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              {products.length} کالا
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            ثبت، ویرایش مشخصات، به‌روزرسانی قیمت‌ها و تغییر آنی وضعیت موجودی انبار.
          </p>
          {productsNeedingReview.length > 0 && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-amber-50 border border-amber-200 px-2.5 py-1.5 text-[11px] font-bold text-amber-800 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-200">
              <AlertTriangle className="w-3.5 h-3.5" />
              {productsNeedingReview.length} کالا نیازمند تکمیل اطلاعات است و در فروشگاه عمومی نمایش داده نمی‌شود.
            </p>
          )}
        </div>

        <button
          id="admin-add-product-main-btn"
          onClick={handleOpenNew}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-blue-600/30 transition active:scale-95 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>افزودن کالای جدید</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-4 border border-slate-200 dark:border-slate-700/80 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          
          {/* Search Input */}
          <div className="sm:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="admin-products-search"
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="جستجو در نام کالا، کد انبار (SKU)، برند یا مشخصات..."
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pr-10 pl-4 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition"
            />
          </div>

          {/* Category Dropdown */}
          <div>
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
            >
              <option value="all">همه دسته‌بندی‌ها ({categories.length})</option>
              {categories.map(c => (
                <option key={c.id} value={c.slug}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Stock Filter Quick Tabs */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-700/60 text-xs">
          <span className="text-slate-400 font-bold ml-2">فیلتر موجودی:</span>
          {(['all', 'in_stock', 'out_of_stock', 'discounted'] as const).map(tab => {
            const labels = {
              all: 'همه کالاها',
              in_stock: 'موجود در انبار',
              out_of_stock: 'ناموجود / اتمام',
              discounted: 'دارای تخفیف ویژه'
            };
            const isActive = stockFilter === tab;
            return (
              <button
                key={tab}
                onClick={() => setStockFilter(tab)}
                className={`px-3 py-1.5 rounded-xl font-bold transition ${
                  isActive 
                    ? 'bg-blue-600 text-white shadow-sm' 
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                {labels[tab]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Products Table (Desktop) */}
      <div className="hidden md:block bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 dark:bg-slate-850/60 border-b border-slate-200 dark:border-slate-700 text-slate-500 font-bold">
              <tr>
                <th className="py-3.5 px-4">تصویر و مشخصات کالا</th>
                <th className="py-3.5 px-3">کد انبار (SKU)</th>
                <th className="py-3.5 px-3">دسته‌بندی / برند</th>
                <th className="py-3.5 px-3">قیمت و تخفیف</th>
                <th className="py-3.5 px-3 text-center">موجودی انبار</th>
                <th className="py-3.5 px-3 text-center">پیشنهاد ویژه</th>
                <th className="py-3.5 px-4 text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {filteredProducts.map(product => {
                const categoryObj = categories.find(c => c.slug === product.category_slug);
                return (
                  <tr key={product.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-750/50 transition group">
                    
                    {/* Image & Title */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={product.image}
                          alt={product.name}
                          className="w-12 h-12 rounded-xl object-contain bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-1 shrink-0"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=300&auto=format&fit=crop&q=80';
                          }}
                        />
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm line-clamp-1">
                            {product.name}
                          </div>
                          {product.title_en && (
                            <div className="text-[11px] text-slate-400 font-mono line-clamp-1" dir="ltr">
                              {product.title_en}
                            </div>
                          )}
                          {getCatalogQualityIssues(product).length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {getCatalogQualityIssues(product).map((issue) => (
                                <span key={issue} className="inline-flex items-center gap-1 rounded-md bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-200">
                                  <AlertTriangle className="w-3 h-3" />
                                  {catalogQualityLabel(issue)}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* SKU */}
                    <td className="py-3 px-3 font-mono font-bold text-slate-600 dark:text-slate-300">
                      {product.sku || '---'}
                    </td>

                    {/* Category & Brand */}
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">
                        {categoryObj?.name || product.category_slug}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {product.brand || 'NoovinNet'}
                      </div>
                    </td>

                    {/* Pricing */}
                    <td className="py-3 px-3">
                      {product.discount_price ? (
                        <div>
                          <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {(product.discount_price || 0).toLocaleString('fa-IR')} تومان
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px]">
                            <span className="line-through text-slate-400 font-mono">
                              {(product.base_price || 0).toLocaleString('fa-IR')}
                            </span>
                            <span className="text-rose-500 font-bold font-mono">
                              %{product.discount_percentage || 0}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="font-mono font-bold text-slate-900 dark:text-white">
                          {(product.base_price || 0).toLocaleString('fa-IR')} تومان
                        </div>
                      )}
                    </td>

                    {/* Stock Toggle Button */}
                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={() => toggleProductStock(product.id)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border transition ${
                          product.in_stock 
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100' 
                            : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-300 dark:border-rose-800 hover:bg-rose-100'
                        }`}
                        title="کلیک جهت تغییر وضعیت موجودی"
                      >
                        {product.in_stock ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>موجود ({product.stock_quantity ?? '—'})</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3.5 h-3.5" />
                            <span>ناموجود</span>
                          </>
                        )}
                      </button>
                    </td>

                    {/* Featured Toggle */}
                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={() => toggleProductFeatured(product.id)}
                        className={`p-1.5 rounded-lg transition ${
                          product.is_featured 
                            ? 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/30' 
                            : 'text-slate-300 dark:text-slate-600 hover:text-amber-400'
                        }`}
                        title="پیشنهاد ویژه"
                      >
                        <Star className={`w-4 h-4 ${product.is_featured ? 'fill-amber-500' : ''}`} />
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* Preview */}
                        <button
                          onClick={() => navigateToProduct(product.slug)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                          title="مشاهده در سایت"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>

                        {/* Edit */}
                        <button
                          onClick={() => handleOpenEdit(product)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                          title="ویرایش کالا"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => setDeleteConfirmId(product.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                          title="حذف کالا"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Products Cards (Mobile) */}
      <div className="md:hidden space-y-3">
        {filteredProducts.map(product => {
          const categoryObj = categories.find(c => c.slug === product.category_slug);
          return (
            <div key={product.id} className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
              <div className="flex items-start gap-3">
                <img
                  src={product.image || product.image_url || 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=200&auto=format&fit=crop&q=80'}
                  alt={product.name}
                  className="w-16 h-16 rounded-xl object-contain bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-1 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm line-clamp-2">
                    {product.name}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {categoryObj?.name || product.category_slug} • {product.sku}
                  </div>
                  {getCatalogQualityIssues(product).length > 0 && (
                    <div className="mt-1 inline-flex items-center gap-1 rounded-md bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-200">
                      <AlertTriangle className="w-3 h-3" />
                      نیازمند تکمیل اطلاعات
                    </div>
                  )}
                  <div className="font-mono font-bold text-blue-600 dark:text-blue-400 text-xs mt-1">
                    {((product.discount_price || product.effective_price) ?? product.base_price ?? 0).toLocaleString('fa-IR')} تومان
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-700 text-xs">
                <button
                  onClick={() => toggleProductStock(product.id)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                    product.in_stock 
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-300' 
                      : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-300'
                  }`}
                >
                  {product.in_stock ? `موجود (${product.stock_quantity ?? '—'})` : 'ناموجود'}
                </button>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => navigateToProduct(product.slug)}
                    className="p-2 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleOpenEdit(product)}
                    className="p-2 rounded-xl text-slate-400 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirmId(product.id)}
                    className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredProducts.length === 0 && (
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-12 text-center border border-slate-200 dark:border-slate-700">
          <Package className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">
            کالایی با فیلترهای انتخابی یافت نشد
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            عبارت جستجو را تغییر دهید یا فیلترها را ریست نمایید.
          </p>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId !== null && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-4 border border-slate-200 dark:border-slate-700 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                تایید حذف کالا
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                آیا از حذف این کالا از دیتابیس و فروشگاه اطمینان کامل دارید؟ این عمل غیرقابل بازگشت است.
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-2.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-bold transition"
              >
                انصراف
              </button>
              <button
                id="confirm-delete-product-btn"
                onClick={() => handleDelete(deleteConfirmId)}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-lg shadow-rose-600/20"
              >
                حذف قطعی
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Product Modal */}
      <AdminProductModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingProduct(null);
        }}
        productToEdit={editingProduct}
      />

    </div>
  );
};
