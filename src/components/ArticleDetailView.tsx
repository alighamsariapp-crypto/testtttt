import React, { useEffect } from 'react';
import { ArrowRight, CalendarDays, Clock, Eye, FileWarning, Tag, UserRound } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { updateDocumentSEO } from '../utils/seo';

const safeArticleHref = (value: string): string | null => {
  const href = value.trim();
  if (!href) return null;
  if (href.startsWith('/') || href.startsWith('#')) return href;

  try {
    const parsed = new URL(href);
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol) ? href : null;
  } catch {
    return null;
  }
};

const renderArticleParagraph = (paragraph: string): React.ReactNode => {
  const expression = /\[([^\]]+)\]\(([^)\s]+)\)/g;
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = expression.exec(paragraph)) !== null) {
    const href = safeArticleHref(match[2]);
    if (!href) continue;
    if (match.index > cursor) nodes.push(paragraph.slice(cursor, match.index));
    const opensNewTab = href.startsWith('http://') || href.startsWith('https://');
    nodes.push(<a key={`${match.index}-${href}`} href={href} target={opensNewTab ? '_blank' : undefined} rel={opensNewTab ? 'noreferrer' : undefined} className="font-semibold text-blue-700 underline decoration-blue-300 underline-offset-4 hover:text-blue-900">{match[1]}</a>);
    cursor = match.index + match[0].length;
  }

  if (!nodes.length) return paragraph;
  if (cursor < paragraph.length) nodes.push(paragraph.slice(cursor));
  return nodes;
};

export const ArticleDetailView: React.FC = () => {
  const { blogPosts, selectedArticleSlug, navigateTo } = useApp();
  const article = blogPosts.find((post) => post.isPublished && post.slug === selectedArticleSlug);

  useEffect(() => {
    if (article) {
      updateDocumentSEO({
        title: `${article.title} | مجله نوین‌نت`,
        description: article.summary,
        canonical: `/magazine/${article.slug}`,
        image: article.image,
        ogType: 'article',
      });
      return;
    }

    updateDocumentSEO({
      title: 'مقاله یافت نشد | نوین‌نت',
      description: 'مقالهٔ موردنظر وجود ندارد، منتشر نشده یا نشانی آن تغییر کرده است.',
      canonical: typeof window === 'undefined' ? '/magazine' : window.location.pathname,
      ogType: 'website',
    });
  }, [article]);

  if (!article) {
    return (
      <main className="min-h-[65vh] max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <section className="bg-white border border-slate-100 shadow-sm rounded-3xl p-7 sm:p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto"><FileWarning className="w-7 h-7" /></div>
          <h1 className="ui-text-page-title mt-4 text-slate-900">مقاله پیدا نشد</h1>
          <p className="ui-text-body mt-2 text-slate-500">این مطلب منتشر نشده، حذف شده یا نشانی آن تغییر کرده است.</p>
          <button type="button" onClick={() => navigateTo('magazine')} className="ui-control ui-control--large ui-text-button mt-6 bg-blue-600 text-white hover:bg-blue-700 inline-flex items-center gap-2">
            <ArrowRight className="w-4 h-4" /> بازگشت به مجله
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
      <button type="button" onClick={() => navigateTo('magazine')} className="ui-control ui-control--compact ui-text-button text-blue-700 hover:bg-blue-50 inline-flex items-center gap-2 mb-5">
        <ArrowRight className="w-4 h-4" /> بازگشت به مجله و راهنما
      </button>

      <article className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <img src={article.image} alt={article.title} className="w-full aspect-[16/9] max-h-[28rem] object-cover" />
        <div className="p-5 sm:p-9">
          <div className="ui-text-meta flex flex-wrap items-center gap-2 text-slate-500">
            <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-semibold">{article.category}</span>
            <span className="inline-flex items-center gap-1"><UserRound className="w-3.5 h-3.5" />{article.author}</span>
            <span className="inline-flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" />{article.date}</span>
            <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{article.readTime}</span>
            <span className="inline-flex items-center gap-1"><Eye className="w-3.5 h-3.5" />{(article.views ?? 0).toLocaleString('fa-IR')} بازدید</span>
          </div>

          <h1 className="ui-text-page-title mt-5 text-slate-900">{article.title}</h1>
          <p className="ui-text-body mt-5 text-slate-600 font-medium border-r-4 border-blue-500 pr-4">{article.summary}</p>

          <div className="ui-text-body mt-7 pt-7 border-t border-slate-100 space-y-5 text-slate-700">
            {article.content.split(/\n{2,}/).filter(Boolean).map((paragraph, index) => <p key={`para-${index}`}>{renderArticleParagraph(paragraph)}</p>)}
          </div>

          {article.tags && article.tags.length > 0 && (
            <div className="mt-8 pt-5 border-t border-slate-100 flex flex-wrap gap-2">
              {article.tags.map((tag) => <span key={tag} className="ui-text-meta inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 text-slate-600"><Tag className="w-3.5 h-3.5" />{tag}</span>)}
            </div>
          )}
        </div>
      </article>
    </main>
  );
};
