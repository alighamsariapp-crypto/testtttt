import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, CheckCircle2, ChevronLeft, Eye, FilePenLine, FileText, Filter, ImagePlus, Link2, Link2Off, Pencil, Plus, Search, Send, Tag, Trash2, Upload, UserRound, X } from "lucide-react";
import { api } from "../../../services/api";
import type { BlogPost } from "../../../types";
import "./blog-management.css";

type Draft = Omit<BlogPost, "id" | "views">;
type EditorValue = BlogPost | "new" | null;
type LinkSelection = { start: number; end: number; label: string };

type Props = {
  posts: BlogPost[];
  liveMode: boolean;
  onCreate: (draft: Draft) => Promise<BlogPost>;
  onUpdate: (id: number, draft: Partial<BlogPost>) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  notify: (message: string) => void;
};

const newDraft = (): Draft => ({
  title: "", slug: "", summary: "", content: "", image: "", author: "تیم محتوای نوین‌نت", category: "راهنما", date: new Date().toLocaleDateString("fa-IR"), readTime: "۵ دقیقه مطالعه", isPublished: false, tags: [],
});

const makeSlug = (value: string) => {
  const normalized = value.trim().toLocaleLowerCase("fa-IR").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "");
  return normalized || `article-${Date.now()}`;
};

const statusLabel = (post: BlogPost) => post.isPublished ? "منتشرشده" : "پیش‌نویس";

function markdownLinkUrl(value: string): string | null {
  const href = value.trim();
  if (!href) return null;
  if (href.startsWith("/") || href.startsWith("#")) return href;

  try {
    const parsed = new URL(href);
    return ["http:", "https:", "mailto:", "tel:"].includes(parsed.protocol) ? href : null;
  } catch {
    return null;
  }
}

function BlogEditor({ post, liveMode, saving, onClose, onSave }: { post: EditorValue; liveMode: boolean; saving: boolean; onClose: () => void; onSave: (draft: Draft) => Promise<void> }) {
  const [draft, setDraft] = useState<Draft>(() => post && post !== "new" ? { ...post } : newDraft());
  const [tagsText, setTagsText] = useState(() => post && post !== "new" ? (post.tags ?? []).join("، ") : "");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(Boolean(post && post !== "new"));
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageError, setImageError] = useState("");
  const [linkSelection, setLinkSelection] = useState<LinkSelection | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkError, setLinkError] = useState("");
  const contentRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setDraft(post && post !== "new" ? { ...post } : newDraft());
    setTagsText(post && post !== "new" ? (post.tags ?? []).join("، ") : "");
    setSlugManuallyEdited(Boolean(post && post !== "new"));
    setUploadingImage(false);
    setImageError("");
    setLinkSelection(null);
    setLinkUrl("");
    setLinkError("");
  }, [post]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const save = async () => {
    const title = draft.title.trim();
    const summary = draft.summary.trim();
    const content = draft.content.trim();
    const image = draft.image.trim();
    if (!title || !summary || !content || !image || uploadingImage) return;
    await onSave({ ...draft, title, summary, content, image, slug: draft.slug.trim() || makeSlug(title), tags: Array.from(new Set(tagsText.split(/[،,]/).map((tag) => tag.trim()).filter(Boolean))) });
  };
  const invalid = !draft.title.trim() || !draft.summary.trim() || !draft.content.trim() || !draft.image.trim() || uploadingImage;

  const uploadFeaturedImage = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setImageError("فقط فایل تصویری قابل بارگذاری است.");
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      setImageError("حجم تصویر نباید بیشتر از ۶ مگابایت باشد.");
      return;
    }

    setImageError("");
    setUploadingImage(true);
    try {
      set("image", liveMode ? await api.uploadAdminBlogImage(file) : URL.createObjectURL(file));
    } catch (error) {
      setImageError(error instanceof Error ? error.message : "بارگذاری تصویر با خطا روبه‌رو شد.");
    } finally {
      setUploadingImage(false);
    }
  };

  const openLinkDialog = () => {
    const textarea = contentRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const label = draft.content.slice(start, end);
    if (!label.trim()) {
      setLinkError("ابتدا یک کلمه یا بخش موردنظر از متن مقاله را انتخاب کنید.");
      return;
    }
    setLinkError("");
    setLinkSelection({ start, end, label });
    setLinkUrl("");
  };

  const applyLink = () => {
    if (!linkSelection) return;
    const href = markdownLinkUrl(linkUrl);
    if (!href) {
      setLinkError("نشانی معتبر وارد کنید؛ مانند https://example.com یا /services.");
      return;
    }
    const { start, end, label } = linkSelection;
    set("content", `${draft.content.slice(0, start)}[${label}](${href})${draft.content.slice(end)}`);
    setLinkSelection(null);
    setLinkUrl("");
    setLinkError("");
    requestAnimationFrame(() => {
      contentRef.current?.focus();
      contentRef.current?.setSelectionRange(start, start + label.length + href.length + 4);
    });
  };

  const removeLink = () => {
    const textarea = contentRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const expression = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match: RegExpExecArray | null = null;
    let selectedMatch: RegExpExecArray | null = null;
    while ((match = expression.exec(draft.content)) !== null) {
      if (start >= match.index && end <= match.index + match[0].length) {
        selectedMatch = match;
        break;
      }
    }
    if (!selectedMatch) {
      setLinkError("نشانگر را روی متن لینک‌شده قرار دهید یا همان لینک را انتخاب کنید.");
      return;
    }
    const linkedText = selectedMatch[1];
    const nextContent = `${draft.content.slice(0, selectedMatch.index)}${linkedText}${draft.content.slice(selectedMatch.index + selectedMatch[0].length)}`;
    set("content", nextContent);
    setLinkError("");
    requestAnimationFrame(() => {
      contentRef.current?.focus();
      contentRef.current?.setSelectionRange(selectedMatch.index, selectedMatch.index + linkedText.length);
    });
  };

  return <section className="blog-editor" aria-label={post === "new" ? "ساخت مقاله" : "ویرایش مقاله"}>
    <header className="blog-editor-header"><div><button type="button" className="blog-back" onClick={onClose}><ChevronLeft size={17} />بازگشت به مقاله‌ها</button><span>{post === "new" ? "مقالهٔ جدید" : "ویرایش مقاله"}</span><h2>{post === "new" ? "ساخت مقاله برای مجلهٔ نوین‌نت" : "ویرایش و کنترل انتشار مقاله"}</h2><p>عنوان و خلاصه به‌عنوان SEO پایهٔ صفحهٔ مقاله استفاده می‌شوند. فقط مقالهٔ منتشرشده در سایت عمومی دیده می‌شود.</p></div><div className="blog-editor-actions"><button type="button" className="blog-cancel" disabled={saving || uploadingImage} onClick={onClose}>انصراف</button><button type="button" className="blog-save" disabled={saving || invalid} onClick={() => void save()}><Send size={16} />{saving ? "در حال ذخیره…" : uploadingImage ? "در حال بارگذاری تصویر…" : draft.isPublished ? "ذخیره و انتشار" : "ذخیرهٔ پیش‌نویس"}</button></div></header>
    <div className="blog-editor-layout"><section className="blog-editor-main"><div className="blog-form-card"><h3>محتوای مقاله</h3><label className="blog-field blog-full"><span>عنوان مقاله <b>*</b></span><input value={draft.title} onChange={(event) => { const value = event.target.value; set("title", value); if (!slugManuallyEdited) set("slug", makeSlug(value)); }} placeholder="عنوان روشن و قابل‌جستجو بنویسید" /></label><label className="blog-field blog-full"><span>خلاصهٔ مقاله <b>*</b></span><textarea rows={3} value={draft.summary} onChange={(event) => set("summary", event.target.value)} placeholder="خلاصه‌ای کوتاه برای کارت مجله و موتورهای جستجو" /></label><div className="blog-field blog-full"><span>متن کامل مقاله <b>*</b></span><div className="blog-content-tools" aria-label="ابزار متن مقاله"><button type="button" onMouseDown={(event) => event.preventDefault()} onClick={openLinkDialog}><Link2 size={15} />افزودن لینک</button><button type="button" onMouseDown={(event) => event.preventDefault()} onClick={removeLink}><Link2Off size={15} />حذف لینک</button><small>یک کلمه یا جمله را انتخاب کنید، سپس «افزودن لینک» را بزنید.</small></div><textarea ref={contentRef} className="blog-body-input" rows={15} value={draft.content} onChange={(event) => set("content", event.target.value)} placeholder="هر پاراگراف را با یک خط خالی جدا کنید…" />{linkError && <small className="blog-editor-error" role="alert">{linkError}</small>}</div></div><div className="blog-form-card blog-meta-card"><h3>مشخصات و SEO پایه</h3><div className="blog-form-grid"><label className="blog-field blog-full"><span>نشانی مقاله (slug)</span><input dir="ltr" value={draft.slug} onChange={(event) => { setSlugManuallyEdited(true); set("slug", event.target.value); }} placeholder="example-article-slug" /></label><label className="blog-field"><span>دسته‌بندی</span><input value={draft.category} onChange={(event) => set("category", event.target.value)} placeholder="مثلاً راهنما" /></label><label className="blog-field"><span>نام نویسنده</span><input value={draft.author} onChange={(event) => set("author", event.target.value)} /></label><label className="blog-field"><span>تاریخ نمایش</span><input value={draft.date} onChange={(event) => set("date", event.target.value)} /></label><label className="blog-field"><span>زمان مطالعه</span><input value={draft.readTime} onChange={(event) => set("readTime", event.target.value)} placeholder="۵ دقیقه مطالعه" /></label><label className="blog-field blog-full"><span>برچسب‌ها</span><input value={tagsText} onChange={(event) => setTagsText(event.target.value)} placeholder="۵G، مودم، راهنما" /><small>برچسب‌ها را با ویرگول یا «،» جدا کنید.</small></label></div></div></section><aside className="blog-editor-side"><section className="blog-publish-card"><h3>وضعیت انتشار</h3><label className="blog-publish-switch"><input type="checkbox" checked={draft.isPublished} onChange={(event) => set("isPublished", event.target.checked)} /><span>{draft.isPublished ? <CheckCircle2 size={17} /> : <FileText size={17} />}</span><div><b>{draft.isPublished ? "منتشرشده" : "پیش‌نویس"}</b><small>{draft.isPublished ? "در مجله و صفحهٔ عمومی دیده می‌شود." : "فقط در پنل ادمین قابل‌مشاهده است."}</small></div></label></section><section className="blog-image-card"><h3><ImagePlus size={16} />تصویر شاخص <b>*</b></h3><p>فایل تصویر را از دستگاه انتخاب کنید؛ URL دستی لازم نیست.</p><label className="blog-image-upload-action"><input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploadingImage} onChange={(event) => { void uploadFeaturedImage(event.target.files); event.currentTarget.value = ""; }} /><Upload size={16} />{uploadingImage ? "در حال بارگذاری…" : draft.image ? "تغییر تصویر شاخص" : "انتخاب و بارگذاری تصویر"}</label><small>JPG، PNG یا WEBP · حداکثر ۶ مگابایت</small>{imageError && <small className="blog-editor-error" role="alert">{imageError}</small>}{draft.image ? <><img src={draft.image} alt="پیش‌نمایش تصویر شاخص" onError={(event) => { event.currentTarget.style.display = "none"; }} /><button type="button" className="blog-remove-image" disabled={uploadingImage} onClick={() => set("image", "")}><X size={14} />حذف تصویر</button></> : <div className="blog-image-placeholder"><ImagePlus size={24} /><span>پیش‌نمایش تصویر شاخص</span></div>}</section><section className="blog-preview-card"><span>پیش‌نمایش کارت مجله</span><b>{draft.category || "دسته‌بندی"}</b><h4>{draft.title || "عنوان مقاله"}</h4><p>{draft.summary || "خلاصهٔ مقاله اینجا نمایش داده می‌شود."}</p><small><UserRound size={13} />{draft.author || "نویسنده"}<CalendarDays size={13} />{draft.date || "تاریخ"}</small></section></aside></div>
    {linkSelection && <div className="blog-link-backdrop" role="presentation"><section className="blog-link-dialog" role="dialog" aria-modal="true" aria-labelledby="blog-link-title"><header><div><Link2 size={18} /><h2 id="blog-link-title">افزودن لینک</h2></div><button type="button" aria-label="بستن" onClick={() => { setLinkSelection(null); setLinkUrl(""); setLinkError(""); }}><X size={17} /></button></header><p>متن انتخاب‌شده: <b>«{linkSelection.label}»</b></p><label className="blog-field"><span>نشانی لینک</span><input dir="ltr" autoFocus value={linkUrl} onChange={(event) => { setLinkUrl(event.target.value); setLinkError(""); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); applyLink(); } }} placeholder="https://example.com یا /services" /></label>{linkError && <small className="blog-editor-error" role="alert">{linkError}</small>}<footer><button type="button" onClick={() => { setLinkSelection(null); setLinkUrl(""); setLinkError(""); }}>انصراف</button><button type="button" className="primary" onClick={applyLink}>ثبت لینک</button></footer></section></div>}
  </section>;
}

export function BlogManagementPage({ posts, liveMode, onCreate, onUpdate, onDelete, notify }: Props) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "published" | "draft">("all");
  const [editor, setEditor] = useState<EditorValue>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<BlogPost | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const categories = useMemo(() => Array.from(new Set(posts.map((post) => post.category).filter(Boolean))), [posts]);
  const [category, setCategory] = useState("all");
  const rows = useMemo(() => posts.filter((post) => (status === "all" || (status === "published" ? post.isPublished : !post.isPublished)) && (category === "all" || post.category === category) && `${post.title} ${post.summary} ${post.author} ${post.tags?.join(" ") ?? ""}`.toLocaleLowerCase("fa-IR").includes(query.trim().toLocaleLowerCase("fa-IR"))), [posts, status, category, query]);
  const published = posts.filter((post) => post.isPublished).length;
  const totalViews = posts.reduce((sum, post) => sum + (post.views ?? 0), 0);

  const save = async (draft: Draft) => {
    setSaving(true);
    try {
      if (editor === "new") { await onCreate(draft); notify(draft.isPublished ? "مقاله منتشر شد." : "پیش‌نویس مقاله ذخیره شد."); }
      else if (editor) { await onUpdate(editor.id, draft); notify(draft.isPublished ? "مقاله به‌روزرسانی و منتشر شد." : "پیش‌نویس مقاله ذخیره شد."); }
      setEditor(null);
    } catch (error) { notify(error instanceof Error ? error.message : "ذخیرهٔ مقاله انجام نشد."); } finally { setSaving(false); }
  };
  const remove = async () => {
    if (!deleting) return;
    setDeletingBusy(true);
    try { await onDelete(deleting.id); notify("مقاله حذف شد."); setDeleting(null); } catch (error) { notify(error instanceof Error ? error.message : "حذف مقاله انجام نشد."); } finally { setDeletingBusy(false); }
  };

  if (editor) return <BlogEditor post={editor} liveMode={liveMode} saving={saving} onClose={() => setEditor(null)} onSave={save} />;
  return <section className="blog-management-page"><header className="blog-page-header"><div><span><FilePenLine size={16} />مدیریت محتوا</span><h1>وبلاگ و مقالات</h1><p>مقاله‌های منتشرشده بلافاصله برای بازدیدکنندگان مجله نمایش داده می‌شوند؛ پیش‌نویس‌ها فقط در این پنل می‌مانند.</p></div><button type="button" className="blog-create" onClick={() => setEditor("new")}><Plus size={17} />مقالهٔ جدید</button></header><section className="blog-stat-grid"><article><span>کل مقاله‌ها</span><b>{posts.length.toLocaleString("fa-IR")}</b><small>محتوای ثبت‌شده</small></article><article><span>منتشرشده</span><b>{published.toLocaleString("fa-IR")}</b><small>قابل‌نمایش در مجله</small></article><article><span>پیش‌نویس</span><b>{(posts.length - published).toLocaleString("fa-IR")}</b><small>نیازمند تکمیل یا بازبینی</small></article><article><span>بازدید ثبت‌شده</span><b>{totalViews.toLocaleString("fa-IR")}</b><small>از مقاله‌های موجود</small></article></section><section className="blog-list-card"><header><div><h2>فهرست مقاله‌ها</h2><p>{liveMode ? "دادهٔ زندهٔ وبلاگ" : "دادهٔ نمایشی وبلاگ"}</p></div><div className="blog-filters"><label><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="جستجوی عنوان، نویسنده یا برچسب" /></label><label><Filter size={16} /><select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="all">همهٔ وضعیت‌ها</option><option value="published">منتشرشده</option><option value="draft">پیش‌نویس</option></select></label><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">همهٔ دسته‌ها</option>{categories.map((item) => <option value={item} key={item}>{item}</option>)}</select></div></header>{rows.length === 0 ? <div className="blog-empty"><FileText size={26} /><b>مقاله‌ای با این فیلتر پیدا نشد.</b><button type="button" onClick={() => { setQuery(""); setStatus("all"); setCategory("all"); }}>پاک‌کردن فیلترها</button></div> : <div className="blog-table-wrap"><table><thead><tr><th>مقاله</th><th>وضعیت</th><th>نویسنده و زمان</th><th>بازدید</th><th aria-label="عملیات" /></tr></thead><tbody>{rows.map((post) => <tr key={post.id}><td><div className="blog-title-cell">{post.image ? <img src={post.image} alt="" /> : <span className="blog-title-fallback"><FileText size={17} /></span>}<div><b>{post.title}</b><small><Tag size={12} />{post.category}{post.tags?.length ? ` · ${post.tags.slice(0, 2).join("، ")}` : ""}</small></div></div></td><td><span className={`blog-status ${post.isPublished ? "published" : "draft"}`}>{post.isPublished ? <CheckCircle2 size={13} /> : <FileText size={13} />}{statusLabel(post)}</span></td><td><div className="blog-author-cell"><span><UserRound size={13} />{post.author}</span><small><CalendarDays size={13} />{post.date} · {post.readTime}</small></div></td><td><span className="blog-views"><Eye size={14} />{(post.views ?? 0).toLocaleString("fa-IR")}</span></td><td><div className="blog-row-actions"><button type="button" title="ویرایش مقاله" onClick={() => setEditor(post)}><Pencil size={15} /></button><button type="button" className="danger" title="حذف مقاله" onClick={() => setDeleting(post)}><Trash2 size={15} /></button></div></td></tr>)}</tbody></table></div>}</section>{deleting && <div className="blog-confirm-backdrop" role="presentation"><section className="blog-confirm" role="dialog" aria-modal="true" aria-labelledby="delete-blog-title"><div><Trash2 size={20} /></div><h2 id="delete-blog-title">حذف مقاله</h2><p>مقالهٔ «{deleting.title}» حذف می‌شود و دیگر در مجله قابل‌مشاهده نخواهد بود. این عمل قابل بازگشت نیست.</p><footer><button type="button" disabled={deletingBusy} onClick={() => setDeleting(null)}>انصراف</button><button type="button" className="danger" disabled={deletingBusy} onClick={() => void remove()}>{deletingBusy ? "در حال حذف…" : "حذف دائمی"}</button></footer></section></div>}</section>;
}
