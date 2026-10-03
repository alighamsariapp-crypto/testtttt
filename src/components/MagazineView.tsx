import React from 'react';
import { ArrowLeft, Clock, Eye } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const MagazineView: React.FC = () => {
  const { blogPosts, navigateToArticle } = useApp();
  const publishedPosts = blogPosts.filter((post) => post.isPublished);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7 sm:py-10 space-y-6">
      <header>
        <h1 className="ui-text-page-title text-slate-900">مجله و وبلاگ تخصصی نوین‌نت</h1>
        <p className="ui-text-body text-slate-500 mt-1">راهنماهای کاربردی، اخبار فناوری و مطالب قابل اشتراک</p>
      </header>

      {publishedPosts.length === 0 ? (
        <section className="ui-text-body rounded-3xl border border-slate-100 bg-white p-8 text-center text-slate-500">هنوز مقالهٔ منتشرشده‌ای وجود ندارد.</section>
      ) : (
        <section className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
          {publishedPosts.map((article) => (
            <article key={article.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition flex flex-col">
              <button type="button" onClick={() => navigateToArticle(article.slug)} className="block text-right group">
                <img src={article.image} alt={article.title} className="w-full h-44 sm:h-48 object-cover group-hover:scale-[1.02] transition-transform duration-300" />
              </button>
              <div className="p-5 flex flex-col flex-1">
                <div className="ui-text-meta flex items-center justify-between text-slate-400">
                  <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{article.readTime}</span>
                  <span className="inline-flex items-center gap-1"><Eye className="w-3.5 h-3.5" />{(article.views ?? 0).toLocaleString('fa-IR')} بازدید</span>
                </div>
                <span className="ui-text-meta mt-3 w-fit px-2 py-0.5 rounded-md bg-blue-50 text-blue-700">{article.category}</span>
                <h2 className="ui-text-card-title mt-3 text-slate-900 line-clamp-2">{article.title}</h2>
                <p className="ui-text-body mt-2 text-slate-500 line-clamp-3">{article.summary}</p>
                <button type="button" onClick={() => navigateToArticle(article.slug)} className="ui-control ui-control--compact ui-text-button mt-4 -mr-2 w-fit text-blue-700 hover:bg-blue-50 inline-flex items-center gap-1">
                  ادامهٔ مطلب <ArrowLeft className="w-3.5 h-3.5" />
                </button>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
};
