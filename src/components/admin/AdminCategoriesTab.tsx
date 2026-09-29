import React, { useState } from 'react';
import { 
  Layers, 
  Plus, 
  Edit3, 
  Trash2, 
  Check, 
  X, 
  FolderTree, 
  ChevronRight, 
  Package, 
  AlertTriangle,
  Sparkles
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Category } from '../../types';

export const AdminCategoriesTab: React.FC = () => {
  const { categories, products, addCategory, updateCategory, deleteCategory, navigateToCategory } = useApp();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const [formData, setFormData] = useState<Partial<Category>>({
    name: '',
    slug: '',
    icon: 'Radio',
    description: '',
    is_active: true,
    sort_order: 1,
    level: 1,
    children: []
  });

  const handleOpenNew = () => {
    setEditingCategory(null);
    setFormData({
      name: '',
      slug: '',
      icon: 'Radio',
      description: '',
      is_active: true,
      sort_order: categories.length + 1,
      level: 1,
      children: []
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (cat: Category) => {
    setEditingCategory(cat);
    setFormData(cat);
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) return;

    const slug = formData.slug?.trim() || formData.name.toLowerCase().replace(/\s+/g, '-');

    if (editingCategory) {
      updateCategory(editingCategory.id, {
        ...formData,
        slug
      });
    } else {
      addCategory({
        name: formData.name,
        slug,
        icon: formData.icon || 'Radio',
        description: formData.description || '',
        is_active: formData.is_active ?? true,
        sort_order: Number(formData.sort_order || 1),
        level: Number(formData.level || 1),
        children: []
      });
    }

    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300" dir="rtl">
      
      {/* Header */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-slate-700/80 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
              مدیریت دسته‌بندی‌ها و ساختار شاخه‌ای
            </h1>
            <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              {categories.length} دسته‌بندی
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            تعریف دسته‌ها و زیرشاخه‌های تجهیزات شبکه، فیبر نوری، سرور و خدمات مهندسی.
          </p>
        </div>

        <button
          id="admin-add-category-btn"
          onClick={handleOpenNew}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-blue-600/30 transition active:scale-95 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>افزودن دسته‌بندی جدید</span>
        </button>
      </div>

      {/* Categories Table */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 dark:bg-slate-850/60 border-b border-slate-200 dark:border-slate-700 text-slate-500 font-bold">
              <tr>
                <th className="py-3.5 px-4">عنوان دسته‌بندی</th>
                <th className="py-3.5 px-3">شناسه URL (اسلاگ)</th>
                <th className="py-3.5 px-3 text-center">تعداد کالاهای موجود</th>
                <th className="py-3.5 px-3 text-center">ترتیب نمایش</th>
                <th className="py-3.5 px-3 text-center">وضعیت</th>
                <th className="py-3.5 px-4 text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {categories.map((cat, index) => {
                const productCount = products.filter(p => p.category_slug === cat.slug).length;

                return (
                  <tr key={cat.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-750/50 transition group">
                    
                    {/* Category Title & Icon */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                          <Layers className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                            {cat.name}
                          </div>
                          {cat.description && (
                            <div className="text-[11px] text-slate-400 line-clamp-1">
                              {cat.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Slug */}
                    <td className="py-3 px-3 font-mono font-bold text-slate-500 dark:text-slate-400" dir="ltr">
                      {cat.slug}
                    </td>

                    {/* Product count */}
                    <td className="py-3 px-3 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-mono font-bold">
                        <Package className="w-3 h-3 text-slate-400" />
                        <span>{productCount} کالا</span>
                      </span>
                    </td>

                    {/* Sort Order */}
                    <td className="py-3 px-3 text-center font-mono font-bold text-slate-600 dark:text-slate-300">
                      {cat.sort_order ?? index + 1}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-3 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        cat.is_active !== false 
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' 
                          : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                      }`}>
                        {cat.is_active !== false ? 'فعال' : 'غیرفعال'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(cat)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                          title="ویرایش دسته"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(cat.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                          title="حذف دسته"
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

      {/* Add / Edit Category Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 dark:border-slate-700 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editingCategory ? 'ویرایش دسته‌بندی' : 'افزودن دسته‌بندی جدید'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  نام دسته‌بندی *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name || ''}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value, slug: prev.slug || e.target.value.toLowerCase().replace(/\s+/g, '-') }))}
                  placeholder="مثال: روتر و اکسس‌پوینت"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  شناسه URL (اسلاگ انگلیسی)
                </label>
                <input
                  type="text"
                  value={formData.slug || ''}
                  onChange={e => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                  placeholder="routers-access-points"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 font-mono"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  توضیحات کوتاه
                </label>
                <textarea
                  rows={2}
                  value={formData.description || ''}
                  onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="توضیح کوتاه درباره کالاهای این شاخه..."
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active ?? true}
                    onChange={e => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-600"></div>
                  <span className="ms-2.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                    وضعیت فعال در منو و فروشگاه
                  </span>
                </label>
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-bold transition"
                >
                  انصراف
                </button>
                <button
                  id="save-category-modal-btn"
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-lg shadow-blue-600/20"
                >
                  {editingCategory ? 'ذخیره تغییرات' : 'افزودن دسته'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirmId !== null && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-4 border border-slate-200 dark:border-slate-700 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                تایید حذف دسته‌بندی
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                آیا از حذف این دسته‌بندی مطمئن هستید؟
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
                id="confirm-delete-category-btn"
                onClick={() => {
                  deleteCategory(deleteConfirmId);
                  setDeleteConfirmId(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-lg shadow-rose-600/20"
              >
                حذف قطعی
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
