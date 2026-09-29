import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Camera, CheckCircle2, Eye, EyeOff, FilePenLine, ImagePlus, Info, LayoutTemplate, Link2, Mail, Phone, Plus, Save, ShieldCheck, Trash2, UploadCloud } from "lucide-react";
import { api } from "../../../services/api";
import type { AppearanceSettings, FooterTrustBadge, SocialLink, SocialLinkIcon, StaticPagesContent } from "../../../types";
import { HomepageContentManagementPage } from "./HomepageContentManagementPage";
import "./content-management.css";

type ContentSection = keyof StaticPagesContent;
type Props = {
  value: StaticPagesContent;
  homepageValue: AppearanceSettings;
  liveMode: boolean;
  onSave: <K extends ContentSection>(section: K, value: StaticPagesContent[K]) => Promise<void>;
  onSaveHomepage: (value: AppearanceSettings) => Promise<void>;
  notify: (message: string) => void;
};

type UploadTarget = `social:${string}` | `badge:${string}`;
const MAX_SITE_MEDIA_BYTES = 2 * 1024 * 1024;
const supportedSiteMedia = new Set(["image/jpeg", "image/png", "image/webp"]);

function TextField({ label, value, onChange, type = "text", dir }: { label: string; value: string; onChange: (value: string) => void; type?: "text" | "email" | "url"; dir?: "rtl" | "ltr" }) {
  return <label className="content-field"><span>{label}</span><input type={type} dir={dir} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function TextArea({ label, value, onChange, rows = 3 }: { label: string; value: string; onChange: (value: string) => void; rows?: number }) {
  return <label className="content-field content-field-wide"><span>{label}</span><textarea rows={rows} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function ImageUploadControl({ label, imageUrl, uploading, onUpload, onRemove }: { label: string; imageUrl?: string; uploading: boolean; onUpload: (file: File) => void; onRemove: () => void }) {
  return <div className="content-image-upload">
    <div className="content-image-preview" aria-label={`پیش‌نمایش ${label}`}>
      {imageUrl ? <img src={imageUrl} alt={label} /> : <ImagePlus size={22} aria-hidden="true" />}
    </div>
    <div className="content-image-upload-copy"><strong>{label}</strong><small>{imageUrl ? "تصویر آمادهٔ نمایش در فوتر" : "هنوز تصویری انتخاب نشده است"}</small></div>
    <label className="content-image-upload-button"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) onUpload(file); event.currentTarget.value = ""; }} /><UploadCloud size={15} />{uploading ? "در حال بارگذاری…" : imageUrl ? "جایگزینی تصویر" : "انتخاب تصویر"}</label>
    {imageUrl && <button type="button" className="content-image-remove" onClick={onRemove}><Trash2 size={14} />حذف تصویر</button>}
  </div>;
}

export function ContentManagementPage({ value, homepageValue, liveMode, onSave, onSaveHomepage, notify }: Props) {
  const [draft, setDraft] = useState<StaticPagesContent>(value);
  const [homepageDraft, setHomepageDraft] = useState<AppearanceSettings>(homepageValue);
  const [section, setSection] = useState<ContentSection | "homepage">("homepage");
  const [saving, setSaving] = useState(false);
  const [capturingScreenshot, setCapturingScreenshot] = useState(false);
  const [uploadingTarget, setUploadingTarget] = useState<UploadTarget | null>(null);

  useEffect(() => setDraft(value), [value]);
  useEffect(() => setHomepageDraft(homepageValue), [homepageValue]);

  const staticDirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(value), [draft, value]);
  const homepageDirty = useMemo(() => JSON.stringify(homepageDraft) !== JSON.stringify(homepageValue), [homepageDraft, homepageValue]);
  const dirty = section === "homepage" ? homepageDirty : staticDirty;
  const labels: Record<ContentSection, string> = { about: "دربارهٔ ما", contact: "تماس با ما", footer: "فوتر و اعتماد" };
  const update = <K extends ContentSection, F extends keyof StaticPagesContent[K]>(target: K, field: F, next: StaticPagesContent[K][F]) => {
    setDraft((current) => ({ ...current, [target]: { ...current[target], [field]: next } }));
  };

  const save = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      if (section === "homepage") {
        await onSaveHomepage(homepageDraft);
        notify("محتوای صفحهٔ اصلی با موفقیت ذخیره و منتشر شد.");
      } else {
        await onSave(section, draft[section]);
        notify(`${labels[section]} با موفقیت ذخیره و برای بازدیدکنندگان منتشر شد.`);
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : "ذخیرهٔ محتوا انجام نشد.");
    } finally {
      setSaving(false);
    }
  };

  const uploadImage = async (file: File, target: UploadTarget, applyUrl: (url: string) => void) => {
    if (!supportedSiteMedia.has(file.type)) {
      notify("فقط تصویر JPG، PNG یا WEBP قابل بارگذاری است.");
      return;
    }
    if (file.size > MAX_SITE_MEDIA_BYTES) {
      notify("حجم هر تصویر فوتر حداکثر ۲ مگابایت است.");
      return;
    }

    setUploadingTarget(target);
    try {
      const imageUrl = liveMode ? await api.uploadAdminSiteMediaImage(file) : URL.createObjectURL(file);
      applyUrl(imageUrl);
      notify(liveMode ? "تصویر با موفقیت بارگذاری شد؛ برای انتشار نهایی ذخیره کنید." : "پیش‌نمایش تصویر در دادهٔ نمونه به‌روزرسانی شد.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "بارگذاری تصویر انجام نشد.");
    } finally {
      setUploadingTarget(null);
    }
  };

  const reset = () => {
    if (section === "homepage") setHomepageDraft(homepageValue);
    else setDraft(value);
  };

  const captureStorefrontScreenshot = async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      notify("مرورگر فعلی امکان گرفتن تصویر از صفحه را پشتیبانی نمی‌کند.");
      return;
    }

    let stream: MediaStream | undefined;
    let video: HTMLVideoElement | undefined;
    setCapturingScreenshot(true);
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      video = document.createElement("video");
      video.srcObject = stream;
      await video.play();
      await new Promise((resolve) => window.setTimeout(resolve, 250));
      const width = video.videoWidth;
      const height = video.videoHeight;
      if (!width || !height) throw new Error("تصویر صفحه آماده نشد.");
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d")?.drawImage(video, 0, 0, width, height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("ساخت فایل تصویر انجام نشد.");
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `noovinnet-site-${new Date().toISOString().slice(0, 10)}.png`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      notify("تصویر صفحه با فرمت PNG دانلود شد.");
    } catch (error) {
      const cancelled = error instanceof DOMException && error.name === "NotAllowedError";
      notify(cancelled ? "گرفتن تصویر لغو شد." : error instanceof Error ? error.message : "گرفتن تصویر صفحه انجام نشد.");
    } finally {
      stream?.getTracks().forEach((track) => track.stop());
      video?.pause();
      setCapturingScreenshot(false);
    }
  };
  const about = draft.about;
  const contact = draft.contact;
  const footer = draft.footer;
  const socialLinks = contact.socialLinks ?? [
    { id: "instagram", label: "اینستاگرام", url: contact.instagramUrl, icon: "instagram" as SocialLinkIcon, isVisible: true },
    { id: "telegram", label: "تلگرام", url: contact.telegramUrl, icon: "telegram" as SocialLinkIcon, isVisible: true },
    { id: "whatsapp", label: "واتس‌اپ", url: contact.whatsappUrl, icon: "whatsapp" as SocialLinkIcon, isVisible: true },
  ].filter((link) => link.url);
  const trustBadges: FooterTrustBadge[] = footer.trustBadges ?? [
    { id: "enamad", label: "اینماد", caption: footer.enamadStar, imageUrl: "", url: "", isVisible: footer.showEnamad },
    { id: "samandehi", label: "ساماندهی", caption: footer.samandehiStatus, imageUrl: "", url: "", isVisible: footer.showSamandehi },
  ];
  const socialIconOptions: Array<{ value: SocialLinkIcon; label: string }> = [
    { value: "instagram", label: "اینستاگرام" }, { value: "telegram", label: "تلگرام" }, { value: "whatsapp", label: "واتس‌اپ" },
    { value: "bale", label: "بله" }, { value: "eitaa", label: "ایتا" }, { value: "linkedin", label: "لینکدین" }, { value: "website", label: "وب‌سایت / لینک دیگر" },
  ];
  const updateSocialLink = (id: string, patch: Partial<SocialLink>) => update("contact", "socialLinks", socialLinks.map((link) => link.id === id ? { ...link, ...patch } : link));
  const addSocialLink = () => update("contact", "socialLinks", [...socialLinks, { id: `social-${Date.now()}`, label: "شبکهٔ جدید", url: "", icon: "website", imageUrl: "", isVisible: true }]);
  const removeSocialLink = (id: string) => update("contact", "socialLinks", socialLinks.filter((link) => link.id !== id));
  const moveSocialLink = (id: string, direction: -1 | 1) => {
    const index = socialLinks.findIndex((link) => link.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= socialLinks.length) return;
    const next = [...socialLinks];
    [next[index], next[target]] = [next[target], next[index]];
    update("contact", "socialLinks", next);
  };
  const updateTrustBadge = (id: string, patch: Partial<FooterTrustBadge>) => update("footer", "trustBadges", trustBadges.map((badge) => badge.id === id ? { ...badge, ...patch } : badge));
  const addTrustBadge = () => update("footer", "trustBadges", [...trustBadges, { id: `badge-${Date.now()}`, label: "نشان جدید", caption: "", imageUrl: "", url: "", isVisible: true }]);
  const removeTrustBadge = (id: string) => update("footer", "trustBadges", trustBadges.filter((badge) => badge.id !== id));
  const moveTrustBadge = (id: string, direction: -1 | 1) => {
    const index = trustBadges.findIndex((badge) => badge.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= trustBadges.length) return;
    const next = [...trustBadges];
    [next[index], next[target]] = [next[target], next[index]];
    update("footer", "trustBadges", next);
  };

  return <section className="content-management-page">
    <header className="content-management-header">
      <div><span className="content-management-eyebrow"><FilePenLine size={16} />مدیریت محتوای سایت</span><h1>صفحهٔ اصلی و اطلاعات عمومی</h1><p>تغییرها پس از ذخیره، از API عمومی سایت خوانده می‌شوند و در سایت واقعی نمایش خواهند یافت.</p></div>
      <div className="content-management-actions"><button type="button" className="content-reset" disabled={!dirty || saving || capturingScreenshot} onClick={reset}>بازنشانی</button><button type="button" className="content-reset" disabled={capturingScreenshot} onClick={() => void captureStorefrontScreenshot()}><Camera size={16} />{capturingScreenshot ? "انتخاب صفحه…" : "گرفتن تصویر صفحه"}</button><button type="button" className="content-save" disabled={!dirty || saving || capturingScreenshot} onClick={() => void save()}><Save size={16} />{saving ? "در حال ذخیره…" : "ذخیره و انتشار"}</button></div>
    </header>

    <div className="content-management-status"><span><CheckCircle2 size={15} />{liveMode ? "اتصال زنده فعال است" : "حالت بازبینی محلی"}</span><small>{liveMode ? "فقط مدیران مجاز امکان ثبت تغییر دارند." : "تغییرها فقط در دادهٔ نمونه ثبت می‌شوند."}</small></div>

    <nav className="content-management-tabs" aria-label="بخش‌های محتوای سایت">
      <button type="button" className={section === "homepage" ? "active" : ""} onClick={() => setSection("homepage")}><LayoutTemplate size={16} />محتوای صفحهٔ اصلی</button>
      {(["about", "contact", "footer"] as ContentSection[]).map((item) => <button type="button" key={item} className={section === item ? "active" : ""} onClick={() => setSection(item)}>{item === "about" ? <Info size={16} /> : item === "contact" ? <Phone size={16} /> : <ShieldCheck size={16} />}{labels[item]}</button>)}
    </nav>

    {section === "homepage" && <HomepageContentManagementPage value={homepageDraft} liveMode={liveMode} onChange={setHomepageDraft} notify={notify} />}

    {section === "about" && <section className="content-editor-card"><header><div><span>صفحهٔ دربارهٔ ما</span><h2>هویت، ماموریت و شاخص‌های برند</h2></div><small>محتوای این بخش در صفحهٔ «دربارهٔ ما» نمایش داده می‌شود.</small></header><div className="content-editor-grid"><TextField label="برچسب بالای صفحه" value={about.badge} onChange={(next) => update("about", "badge", next)} /><TextField label="عنوان اصلی" value={about.title} onChange={(next) => update("about", "title", next)} /><TextArea label="معرفی کوتاه" value={about.heroDescription} rows={4} onChange={(next) => update("about", "heroDescription", next)} /><TextField label="عنوان ماموریت" value={about.missionTitle} onChange={(next) => update("about", "missionTitle", next)} /><TextArea label="متن ماموریت" value={about.missionText} onChange={(next) => update("about", "missionText", next)} /><TextField label="عنوان کیفیت و اصالت" value={about.qualityTitle} onChange={(next) => update("about", "qualityTitle", next)} /><TextArea label="متن کیفیت و اصالت" value={about.qualityText} onChange={(next) => update("about", "qualityText", next)} /><TextField label="عنوان تیم پشتیبانی" value={about.supportTitle} onChange={(next) => update("about", "supportTitle", next)} /><TextArea label="متن تیم پشتیبانی" value={about.supportText} onChange={(next) => update("about", "supportText", next)} /><TextField label="آمار تجربه" value={about.statsExperience} onChange={(next) => update("about", "statsExperience", next)} /><TextField label="آمار مشتریان" value={about.statsCustomers} onChange={(next) => update("about", "statsCustomers", next)} /><TextField label="آمار شعب" value={about.statsBranches} onChange={(next) => update("about", "statsBranches", next)} /><TextField label="آدرس تصویر بنر" value={about.bannerImage ?? ""} dir="ltr" type="url" onChange={(next) => update("about", "bannerImage", next)} /></div></section>}

    {section === "contact" && <section className="content-editor-card"><header><div><span>صفحهٔ تماس با ما</span><h2>راه‌های ارتباط، ساعات کاری و شبکه‌های اجتماعی</h2></div><small>شماره و ایمیل فوتر نیز از همین اطلاعات استفاده می‌کنند.</small></header><div className="content-editor-grid"><TextField label="عنوان صفحه" value={contact.title} onChange={(next) => update("contact", "title", next)} /><TextField label="شمارهٔ پشتیبانی" value={contact.supportPhone} dir="ltr" onChange={(next) => update("contact", "supportPhone", next)} /><TextArea label="زیرعنوان صفحه" value={contact.subtitle} onChange={(next) => update("contact", "subtitle", next)} /><TextField label="توضیح شمارهٔ پشتیبانی" value={contact.supportPhoneDesc} onChange={(next) => update("contact", "supportPhoneDesc", next)} /><TextField label="ایمیل پشتیبانی" value={contact.supportEmail} dir="ltr" type="email" onChange={(next) => update("contact", "supportEmail", next)} /><TextField label="ایمیل فروش" value={contact.salesEmail} dir="ltr" type="email" onChange={(next) => update("contact", "salesEmail", next)} /><TextArea label="آدرس دفتر مرکزی" value={contact.centralOfficeAddress} onChange={(next) => update("contact", "centralOfficeAddress", next)} /><TextField label="ساعات کاری" value={contact.workingHours} onChange={(next) => update("contact", "workingHours", next)} /><section className="content-social-manager content-field-wide"><header><div><span>شبکه‌های اجتماعی و پیام‌رسان‌ها</span><small>برای هر شبکه می‌توانید آیکون استاندارد انتخاب کنید یا تصویر اختصاصی upload کنید؛ ترتیب فهرست در فوتر حفظ می‌شود.</small></div><button type="button" className="content-social-add" onClick={addSocialLink}><Plus size={15} />افزودن شبکه</button></header><div className="content-social-list">{socialLinks.length === 0 && <p className="content-social-empty">هنوز شبکه‌ای ثبت نشده است. برای نمونه می‌توانید «بله»، «ایتا» یا «اینستاگرام» اضافه کنید.</p>}{socialLinks.map((link, index) => <article className="content-social-row" key={link.id}><label><span>نام</span><input value={link.label} onChange={(event) => updateSocialLink(link.id, { label: event.target.value })} /></label><label><span>آیکون پیش‌فرض</span><select value={link.icon} onChange={(event) => updateSocialLink(link.id, { icon: event.target.value as SocialLinkIcon })}>{socialIconOptions.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label><label className="content-social-url"><span>لینک</span><input dir="ltr" type="url" value={link.url} placeholder="https://…" onChange={(event) => updateSocialLink(link.id, { url: event.target.value })} /></label><ImageUploadControl label={`تصویر ${link.label}`} imageUrl={link.imageUrl} uploading={uploadingTarget === `social:${link.id}`} onUpload={(file) => void uploadImage(file, `social:${link.id}`, (imageUrl) => updateSocialLink(link.id, { imageUrl }))} onRemove={() => updateSocialLink(link.id, { imageUrl: "" })} /><label className="content-social-visible"><input type="checkbox" checked={link.isVisible} onChange={(event) => updateSocialLink(link.id, { isVisible: event.target.checked })} />{link.isVisible ? <Eye size={15} /> : <EyeOff size={15} />}نمایش</label><div className="content-social-actions"><button type="button" title="بالا" aria-label="انتقال به بالا" disabled={index === 0} onClick={() => moveSocialLink(link.id, -1)}><ArrowUp size={15} /></button><button type="button" title="پایین" aria-label="انتقال به پایین" disabled={index === socialLinks.length - 1} onClick={() => moveSocialLink(link.id, 1)}><ArrowDown size={15} /></button><button type="button" className="danger" title="حذف" aria-label="حذف شبکه" onClick={() => removeSocialLink(link.id)}><Trash2 size={15} /></button></div></article>)}</div></section><TextArea label="نشانی یا لینک نقشه" value={contact.mapEmbedUrl ?? ""} onChange={(next) => update("contact", "mapEmbedUrl", next)} /></div></section>}

    {section === "footer" && <section className="content-editor-card"><header><div><span>فوتر و نشانه‌های اعتماد</span><h2>متن برند، نشان‌های تصویری و وضعیت نمایش</h2></div><small>هر نشان می‌تواند تصویر، عنوان، توضیح، لینک، ترتیب و وضعیت نمایش جداگانه داشته باشد.</small></header><div className="content-editor-grid"><TextArea label="توضیح برند در فوتر" value={footer.brandDescription} rows={4} onChange={(next) => update("footer", "brandDescription", next)} /><TextArea label="متن حقوق سایت" value={footer.copyrightText} onChange={(next) => update("footer", "copyrightText", next)} /><section className="content-badge-manager content-field-wide"><header><div><span>نشان‌های اعتماد و مجوزها</span><small>تصویر اینماد، ساماندهی یا هر نشان دیگر را مستقیم upload کنید؛ URL دستی لازم نیست.</small></div><button type="button" className="content-social-add" onClick={addTrustBadge}><Plus size={15} />افزودن نشان</button></header><div className="content-badge-list">{trustBadges.length === 0 && <p className="content-social-empty">هنوز نشانی ثبت نشده است. می‌توانید اینماد، ساماندهی یا هر مجوز معتبر دیگری اضافه کنید.</p>}{trustBadges.map((badge, index) => <article className="content-badge-row" key={badge.id}><ImageUploadControl label={`تصویر ${badge.label}`} imageUrl={badge.imageUrl} uploading={uploadingTarget === `badge:${badge.id}`} onUpload={(file) => void uploadImage(file, `badge:${badge.id}`, (imageUrl) => updateTrustBadge(badge.id, { imageUrl }))} onRemove={() => updateTrustBadge(badge.id, { imageUrl: "" })} /><label><span>عنوان نشان</span><input value={badge.label} onChange={(event) => updateTrustBadge(badge.id, { label: event.target.value })} /></label><label><span>توضیح کوتاه</span><input value={badge.caption} onChange={(event) => updateTrustBadge(badge.id, { caption: event.target.value })} /></label><label><span>لینک اعتبارسنجی (اختیاری)</span><input dir="ltr" type="url" value={badge.url ?? ""} placeholder="https://…" onChange={(event) => updateTrustBadge(badge.id, { url: event.target.value })} /></label><label className="content-social-visible"><input type="checkbox" checked={badge.isVisible} onChange={(event) => updateTrustBadge(badge.id, { isVisible: event.target.checked })} />{badge.isVisible ? <Eye size={15} /> : <EyeOff size={15} />}نمایش</label><div className="content-social-actions"><button type="button" title="بالا" aria-label="انتقال به بالا" disabled={index === 0} onClick={() => moveTrustBadge(badge.id, -1)}><ArrowUp size={15} /></button><button type="button" title="پایین" aria-label="انتقال به پایین" disabled={index === trustBadges.length - 1} onClick={() => moveTrustBadge(badge.id, 1)}><ArrowDown size={15} /></button><button type="button" className="danger" title="حذف" aria-label="حذف نشان" onClick={() => removeTrustBadge(badge.id)}><Trash2 size={15} /></button></div></article>)}</div></section></div></section>}

    <footer className="content-management-help"><Link2 size={16} /><span>تصاویر شبکه‌های اجتماعی و نشان‌های اعتماد به‌صورت مستقیم upload می‌شوند. فقط JPG، PNG یا WEBP تا حداکثر ۲ مگابایت پذیرفته می‌شود؛ بعد از upload حتماً «ذخیره و انتشار» را بزنید.</span></footer>
  </section>;
}
