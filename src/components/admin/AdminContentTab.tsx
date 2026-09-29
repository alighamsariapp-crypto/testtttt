import React, { useState } from 'react';
import { FileText, Plus, Edit3, Trash2, Search, CheckCircle2, Eye, Calendar } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ConfirmDialog } from '../common/ConfirmDialog';

export const AdminContentTab: React.FC = () => {
  const { showToast } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [posts, setPosts] = useState([
    {
      id: 1,
      title: 'راهنمای جامع خرید پهنای باند اختصاصی برای سازمان‌ها',
      category: 'راهنمای خرید',
      author: 'تیم فنی نوین‌نت',
      date: '۱۴۰۴/۰۶/۱۵',
      views: '۱,۴۲۰',
      status: 'منتشر شده'
    },
    {
      id: 2,
      title: 'مقایسه سرعت اینترنت فیبر نوری FTTH با VDSL و ADSL',
      category: 'مقالات تخصصی',
      author: 'مهندس رضایی',
      date: '۱۴۰۴/۰۶/۱۰',
      views: '۲,۸۹۰',
      status: 'منتشر شده'
    },
    {
      id: 3,
      title: 'چگونه پینگ اینترنت بازی را کاهش دهیم؟ (راهنمای گیمرها)',
      category: 'گیمینگ و پینگ',
      author: 'پشتیبانی شبکه',
      date: '۱۴۰۴/۰۵/۲۸',
      views: '۴,۱۲۰',
      status: 'پیش‌نویس'
    }
  ]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('مقالات تخصصی');
  const [postPendingDeletion, setPostPendingDeletion] = useState<{ id: number; title: string } | null>(null);

  const handleAddPost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      showToast('لطفاً عنوان مقاله را وارد کنید.', 'error');
      return;
    }
    const newPost = {
      id: Date.now(),
      title: newTitle,
      category: newCategory,
      author: 'مدیر سایت',
      date: 'امروز',
      views: '۰',
      status: 'منتشر شده'
    };
    setPosts([newPost, ...posts]);
    setNewTitle('');
    setIsModalOpen(false);
    showToast('مقاله جدید با موفقیت ایجاد شد.', 'success');
  };

  const handleDelete = (id: number) => {
    setPosts((currentPosts) => currentPosts.filter((post) => post.id !== id));
    setPostPendingDeletion(null);
    showToast('مقاله مورد نظر حذف گردید.', 'success');
  };

  const filteredPosts = posts.filter(p => p.title.includes(searchTerm) || p.category.includes(searchTerm));

  return (
    <div className="space-y-6" dir="rtl">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <FileText className="w-6 h-6 text-blue-600" />
            <span>مدیریت وبلاگ و محتوای سایت</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">افزودن و ویرایش مقالات، اخبار و راهنماهای منتشر شده در سایت</p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/20 transition active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>نوشتن مقاله جدید</span>
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="جستجو در مقالات..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pr-10 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600 transition"
          />
        </div>
      </div>

      {/* Posts Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="py-3.5 px-4">عنوان مقاله</th>
                <th className="py-3.5 px-4">دسته‌بندی</th>
                <th className="py-3.5 px-4">نویسنده</th>
                <th className="py-3.5 px-4">تاریخ انتشار</th>
                <th className="py-3.5 px-4">بازدید</th>
                <th className="py-3.5 px-4">وضعیت</th>
                <th className="py-3.5 px-4 text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
              {filteredPosts.map(post => (
                <tr key={post.id} className="hover:bg-slate-50/80 transition">
                  <td className="py-4 px-4 font-bold text-slate-900 max-w-xs truncate">{post.title}</td>
                  <td className="py-4 px-4">
                    <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-bold text-[11px]">
                      {post.category}
                    </span>
                  </td>
                  <td className="py-4 px-4">{post.author}</td>
                  <td className="py-4 px-4 text-slate-500 font-mono">{post.date}</td>
                  <td className="py-4 px-4 font-mono">{post.views}</td>
                  <td className="py-4 px-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                      post.status === 'منتشر شده' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}>
                      {post.status}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => showToast(`ویرایش مقاله #${post.id}`, 'info')}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 transition"
                        title="ویرایش"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setPostPendingDeletion({ id: post.id, title: post.title })}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 transition"
                        title="حذف"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        isOpen={Boolean(postPendingDeletion)}
        title="حذف مقاله"
        description={postPendingDeletion ? `مقاله «${postPendingDeletion.title}» حذف می‌شود. این عمل قابل بازگشت نیست.` : ''}
        confirmLabel="حذف مقاله"
        onCancel={() => setPostPendingDeletion(null)}
        onConfirm={() => {
          if (postPendingDeletion) handleDelete(postPendingDeletion.id);
        }}
      />

      {/* New Post Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <h3 className="text-base font-black text-slate-900 mb-4">افزودن مقاله جدید</h3>
            <form onSubmit={handleAddPost} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">عنوان مقاله</label>
                <input
                  type="text"
                  placeholder="مثال: راهنمای نصب و راه‌اندازی مودم..."
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600 transition"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">دسته‌بندی</label>
                <select
                  value={newCategory}
                  onChange={e => setNewCategory(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600 transition"
                >
                  <option value="مقالات تخصصی">مقالات تخصصی</option>
                  <option value="راهنمای خرید">راهنمای خرید</option>
                  <option value="گیمینگ و پینگ">گیمینگ و پینگ</option>
                  <option value="اخبار شبکه">اخبار شبکه</option>
                </select>
              </div>
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition"
                >
                  انتشار مقاله
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
