import React from 'react';
import { ArrowLeft, BookOpen, Headphones, Info, LaptopMinimal, Mail, MapPin, Phone, Instagram, Send, Linkedin, ShoppingBag, Globe2, MessageCircle, MessagesSquare } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { FooterTrustBadge } from '../types';

export const Footer: React.FC = () => {
  const { setActiveView, setSelectedCategorySlug, themeSettings, staticContent } = useApp();
  const socialLinks = staticContent.contact.socialLinks?.filter((link) => link.isVisible && link.url) ?? [
    { id: 'instagram', label: 'اینستاگرام', url: staticContent.contact.instagramUrl, icon: 'instagram' as const, isVisible: true },
    { id: 'telegram', label: 'تلگرام', url: staticContent.contact.telegramUrl, icon: 'telegram' as const, isVisible: true },
    { id: 'whatsapp', label: 'واتس‌اپ', url: staticContent.contact.whatsappUrl, icon: 'whatsapp' as const, isVisible: true },
  ].filter((link) => link.url);
  const trustBadges: FooterTrustBadge[] = staticContent.footer.trustBadges?.filter((badge) => badge.isVisible) ?? [
    { id: 'enamad', label: 'اینماد', caption: staticContent.footer.enamadStar, imageUrl: '', url: '', isVisible: staticContent.footer.showEnamad },
    { id: 'samandehi', label: 'ساماندهی', caption: staticContent.footer.samandehiStatus, imageUrl: '', url: '', isVisible: staticContent.footer.showSamandehi },
  ].filter((badge) => badge.isVisible);
  const socialIcon = { instagram: Instagram, telegram: Send, whatsapp: MessageCircle, bale: MessageCircle, eitaa: MessagesSquare, linkedin: Linkedin, website: Globe2 } as const;

  return (
    <footer className="bg-slate-900 text-slate-300 pt-12 pb-24 lg:pb-12 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 pb-10 border-b border-slate-800">
          <div className="lg:col-span-4 space-y-4">
            <span className="text-2xl font-extrabold text-white font-sans tracking-tight" style={{ color: themeSettings.primary_color }}>
              {themeSettings.brand_name || 'noovinnet'}
            </span>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              {staticContent.footer.brandDescription}
            </p>
            {socialLinks.length > 0 && <div className="flex flex-wrap items-center gap-3 pt-2">
              {socialLinks.map((link) => {
                const Icon = socialIcon[link.icon];
                return <a key={link.id} href={link.url} target="_blank" rel="noreferrer" className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-blue-600 hover:text-white flex items-center justify-center overflow-hidden transition text-slate-400" aria-label={link.label} title={link.label}>
                  {link.imageUrl ? <img src={link.imageUrl} alt={link.label} className="h-full w-full object-contain p-1" /> : <Icon className="w-4 h-4" />}
                </a>;
              })}
            </div>}
          </div>

          <nav className="lg:col-span-3 space-y-3" aria-label="دسترسی سریع">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-sm font-bold text-white">دسترسی سریع</h4>
              <span className="text-[10px] text-slate-500">منوی سایت</span>
            </div>
            <ul className="grid gap-2">
              <li><button onClick={() => { setSelectedCategorySlug(null); setActiveView('store'); }} className="group w-full min-h-11 rounded-xl border border-slate-700 bg-slate-800/80 px-3 text-right text-xs text-slate-200 hover:border-blue-500 hover:bg-blue-600 hover:text-white transition flex items-center justify-between gap-3"><span className="inline-flex items-center gap-2"><ShoppingBag className="w-4 h-4 text-blue-400 group-hover:text-white" />فروشگاه و محصولات</span><ArrowLeft className="w-3.5 h-3.5 text-slate-500 group-hover:text-white" /></button></li>
              <li><button onClick={() => setActiveView('services')} className="group w-full min-h-11 rounded-xl border border-slate-700 bg-slate-800/80 px-3 text-right text-xs text-slate-200 hover:border-blue-500 hover:bg-blue-600 hover:text-white transition flex items-center justify-between gap-3"><span className="inline-flex items-center gap-2"><LaptopMinimal className="w-4 h-4 text-blue-400 group-hover:text-white" />سامانه خدمات آنلاین</span><ArrowLeft className="w-3.5 h-3.5 text-slate-500 group-hover:text-white" /></button></li>
              <li><button onClick={() => setActiveView('magazine')} className="group w-full min-h-11 rounded-xl border border-slate-700 bg-slate-800/80 px-3 text-right text-xs text-slate-200 hover:border-blue-500 hover:bg-blue-600 hover:text-white transition flex items-center justify-between gap-3"><span className="inline-flex items-center gap-2"><BookOpen className="w-4 h-4 text-blue-400 group-hover:text-white" />مجله و اخبار فناوری</span><ArrowLeft className="w-3.5 h-3.5 text-slate-500 group-hover:text-white" /></button></li>
              <li><button onClick={() => setActiveView('about')} className="group w-full min-h-11 rounded-xl border border-slate-700 bg-slate-800/80 px-3 text-right text-xs text-slate-200 hover:border-blue-500 hover:bg-blue-600 hover:text-white transition flex items-center justify-between gap-3"><span className="inline-flex items-center gap-2"><Info className="w-4 h-4 text-blue-400 group-hover:text-white" />درباره نوین‌نت</span><ArrowLeft className="w-3.5 h-3.5 text-slate-500 group-hover:text-white" /></button></li>
              <li><button onClick={() => setActiveView('contact')} className="group w-full min-h-11 rounded-xl border border-slate-700 bg-slate-800/80 px-3 text-right text-xs text-slate-200 hover:border-blue-500 hover:bg-blue-600 hover:text-white transition flex items-center justify-between gap-3"><span className="inline-flex items-center gap-2"><Headphones className="w-4 h-4 text-blue-400 group-hover:text-white" />تماس با پشتیبانی</span><ArrowLeft className="w-3.5 h-3.5 text-slate-500 group-hover:text-white" /></button></li>
            </ul>
          </nav>

          <div className="lg:col-span-3 space-y-3">
            <h4 className="text-sm font-bold text-white">ارتباط با ما</h4>
            <div className="space-y-2.5 text-xs text-slate-400">
              <div className="flex items-center gap-2.5"><Phone className="w-4 h-4 text-blue-400 shrink-0" /><span>{staticContent.contact.supportPhone} ({staticContent.contact.supportPhoneDesc})</span></div>
              <div className="flex items-center gap-2.5"><Mail className="w-4 h-4 text-blue-400 shrink-0" /><span>{staticContent.contact.supportEmail}</span></div>
              <div className="flex items-start gap-2.5"><MapPin className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" /><span>{staticContent.contact.centralOfficeAddress}</span></div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-3">
            <h4 className="text-sm font-bold text-white">نمادهای اعتماد</h4>
            {trustBadges.length > 0 ? <div className="flex flex-wrap gap-2">
              {trustBadges.map((badge) => {
                const badgeFace = <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 flex flex-col items-center justify-center overflow-hidden p-1 text-center text-[10px] text-slate-400 hover:border-blue-500 transition">
                  {badge.imageUrl ? <img src={badge.imageUrl} alt={badge.label} className="h-full w-full object-contain" /> : <><span className="font-bold text-blue-400 text-xs">{badge.label}</span><span>{badge.caption}</span></>}
                </div>;
                return badge.url ? <a key={badge.id} href={badge.url} target="_blank" rel="noreferrer" aria-label={`اعتبارسنجی ${badge.label}`} title={badge.label}>{badgeFace}</a> : <React.Fragment key={badge.id}>{badgeFace}</React.Fragment>;
              })}
            </div> : <p className="text-xs text-slate-500">نشانی برای نمایش ثبت نشده است.</p>}
          </div>
        </div>

        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-3">
          <p>{staticContent.footer.copyrightText}</p>
          <div className="flex items-center gap-4"><button onClick={() => setActiveView('about')} className="hover:text-slate-300 transition">قوانین و مقررات</button><span>•</span><button onClick={() => setActiveView('about')} className="hover:text-slate-300 transition">حریم خصوصی</button></div>
        </div>
      </div>
    </footer>
  );
};
