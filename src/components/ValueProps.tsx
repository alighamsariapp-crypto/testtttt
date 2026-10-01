import React from 'react';
import { Truck, ShieldCheck, CreditCard } from 'lucide-react';

export const ValueProps: React.FC = () => {
  const props = [
    {
      title: 'ارسال سریع',
      description: 'تحویل در کمترین زمان ممکن در سراسر کشور',
      icon: Truck,
      color: 'bg-blue-50 text-blue-600',
    },
    {
      title: 'اعتماد و اعتبار',
      description: 'دارای نمادهای رسمی اعتماد و گارانتی اصالت کالا',
      icon: ShieldCheck,
      color: 'bg-emerald-50 text-emerald-600',
    },
    {
      title: 'تراکنش امن 24/7',
      description: 'پرداخت آنلاین با درگاه‌های معتبر بانکی شاپرک',
      icon: CreditCard,
      color: 'bg-indigo-50 text-indigo-600',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
        {props.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.title}
              className="p-5 bg-white border border-slate-100 rounded-3xl shadow-sm flex items-center gap-4 hover:border-slate-200 transition"
            >
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${item.color}`}>
                <Icon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="ui-text-card-title font-semibold text-slate-800">{item.title}</h3>
                <p className="ui-text-meta text-slate-500 mt-0.5 leading-relaxed">{item.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
