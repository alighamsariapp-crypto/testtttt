import React from 'react';
import { ShieldCheck, Users, Target, Award, Building2, Users2 } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const AboutView: React.FC = () => {
  const { staticContent } = useApp();
  const about = staticContent.about;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Intro */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-3xl p-8 sm:p-12 text-white shadow-xl space-y-4">
        <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold border border-blue-400/30">
          {about.badge || 'درباره نوین‌نت'}
        </span>
        <h1 className="text-2xl sm:text-4xl font-black leading-tight">
          {about.title}
        </h1>
        <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed whitespace-pre-line">
          {about.heroDescription}
        </p>

        {/* Live Stats */}
        <div className="grid grid-cols-3 gap-4 pt-6 border-t border-white/10 text-center sm:text-right">
          <div>
            <div className="text-xl sm:text-2xl font-black text-amber-400">{about.statsExperience}</div>
            <div className="text-[11px] text-slate-300">سابقه درخشان</div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-emerald-400">{about.statsCustomers}</div>
            <div className="text-[11px] text-slate-300">مشتری وفادار</div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-blue-400">{about.statsBranches}</div>
            <div className="text-[11px] text-slate-300">پوشش سراسری</div>
          </div>
        </div>
      </div>

      {/* Values */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Target className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">{about.missionTitle || 'ماموریت ما'}</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            {about.missionText}
          </p>
        </div>

        <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">{about.qualityTitle || 'کیفیت و اصالت کالا'}</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            {about.qualityText}
          </p>
        </div>

        <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">{about.supportTitle || 'تیم مهندسی و پشتیبانی'}</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            {about.supportText}
          </p>
        </div>
      </div>
    </div>
  );
};
