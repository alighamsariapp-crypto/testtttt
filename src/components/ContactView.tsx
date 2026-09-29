import React, { useState } from 'react';
import { Phone, Mail, MapPin, Send, MessageSquare, CheckCircle2 } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const ContactView: React.FC = () => {
  const { staticContent } = useApp();
  const contact = staticContent.contact;
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSent(true);
    setTimeout(() => {
      setSent(false);
      setForm({ name: '', email: '', phone: '', message: '' });
    }, 3000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900">{contact.title}</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">{contact.subtitle}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Contact Info (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900">راه‌های ارتباطی مستقیم</h3>
            
            <div className="space-y-3 text-xs text-slate-600">
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl">
                <Phone className="w-5 h-5 text-blue-600 shrink-0" />
                <div>
                  <div className="font-bold text-slate-900">تلفن پشتیبانی</div>
                  <div className="text-slate-500 font-sans">{contact.supportPhone} ({contact.supportPhoneDesc})</div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl">
                <Mail className="w-5 h-5 text-blue-600 shrink-0" />
                <div>
                  <div className="font-bold text-slate-900">ایمیل پشتیبانی و سازمانی</div>
                  <div className="text-slate-500 font-sans">{contact.supportEmail}</div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl">
                <MapPin className="w-5 h-5 text-blue-600 shrink-0" />
                <div>
                  <div className="font-bold text-slate-900">نشانی دفتر مرکزی</div>
                  <div className="text-slate-500">{contact.centralOfficeAddress}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Message Form (7 cols) */}
        <div className="lg:col-span-7">
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900">ارسال پیام یا انتقاد</h3>

            {sent ? (
              <div className="p-6 bg-emerald-50 text-emerald-800 rounded-2xl text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                <h4 className="text-sm font-bold">پیام شما با موفقیت ارسال شد</h4>
                <p className="text-xs">همکاران ما در اسرع وقت با شما تماس خواهند گرفت.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">نام شما</label>
                    <input
                      type="text"
                      required
                      value={form.name}
                      onChange={e => setForm({ ...form, name: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">شماره تماس</label>
                    <input
                      type="tel"
                      required
                      value={form.phone}
                      onChange={e => setForm({ ...form, phone: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-sans"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">ایمیل</label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-sans"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">متن پیام</label>
                  <textarea
                    rows={4}
                    required
                    value={form.message}
                    onChange={e => setForm({ ...form, message: e.target.value })}
                    placeholder="پیام یا درخواست خود را بنویسید..."
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
                  />
                </div>

                <button
                  type="submit"
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow transition flex items-center gap-2"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>ارسال پیام</span>
                </button>
              </form>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
