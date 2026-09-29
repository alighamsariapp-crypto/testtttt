import React, { useState } from 'react';
import { 
  Wallet, 
  Plus, 
  ArrowUpRight, 
  ArrowDownLeft, 
  RotateCcw, 
  Sparkles, 
  CreditCard, 
  CheckCircle2, 
  XCircle,
  Clock, 
  X, 
  ShieldCheck,
  TrendingUp,
  Receipt,
  ArrowDownRight,
  ArrowUpLeft,
  ChevronLeft,
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { ModalPortal } from '../common/ModalPortal';
import { WalletTransaction } from '../../types';

export const WalletTab: React.FC = () => {
  const { user, walletTransactions, addWalletCredit, showToast } = useApp();
  const [isTopUpModalOpen, setIsTopUpModalOpen] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState<number>(1000000);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [selectedGateway, setSelectedGateway] = useState<'mellat' | 'saman' | 'parsian'>('saman');
  const [filterType, setFilterType] = useState<'all' | 'deposit' | 'purchase' | 'refund' | 'cashback'>('all');
  const [mobileFilter, setMobileFilter] = useState<'all' | 'deposit' | 'withdraw'>('all');
  useBodyScrollLock(isTopUpModalOpen);

  if (!user) return null;

  const currentBalance = user.wallet_balance ?? 0;
  
  // Calculate total deposits
  const totalDeposits = walletTransactions
    .filter(tx => tx.type === 'deposit' || tx.type === 'cashback')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const filteredTransactions = walletTransactions.filter(tx => {
    if (filterType === 'all') return true;
    return tx.type === filterType;
  });

  const mobileFilteredTransactions = walletTransactions.filter(tx => {
    if (mobileFilter === 'all') return true;
    if (mobileFilter === 'deposit') return tx.amount > 0;
    if (mobileFilter === 'withdraw') return tx.amount < 0;
    return true;
  });

  const handleTopUpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalAmount = customAmount ? parseInt(customAmount.replace(/\D/g, ''), 10) : selectedAmount;
    if (!finalAmount || finalAmount < 10000) {
      showToast('حداقل مبلغ افزایش موجودی ۱۰,۰۰۰ تومان می‌باشد.', 'error');
      return;
    }
    addWalletCredit(finalAmount, `درخواست شارژ کیف پول (درگاه ${selectedGateway === 'saman' ? 'سامان' : selectedGateway === 'mellat' ? 'ملت' : 'پارسیان'})`);
    setIsTopUpModalOpen(false);
    setCustomAmount('');
  };

  const getTransactionIcon = (type: WalletTransaction['type'], status: WalletTransaction['status']) => {
    if (status === 'failed') {
      return (
        <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
          <XCircle className="w-5 h-5" />
        </div>
      );
    }
    if (status === 'pending') {
      return (
        <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
          <Clock className="w-5 h-5" />
        </div>
      );
    }

    switch (type) {
      case 'deposit':
        return (
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <ArrowDownLeft className="w-5 h-5" />
          </div>
        );
      case 'purchase':
        return (
          <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
            <ArrowUpRight className="w-5 h-5" />
          </div>
        );
      case 'refund':
        return (
          <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <RotateCcw className="w-5 h-5" />
          </div>
        );
      case 'cashback':
      default:
        return (
          <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
        );
    }
  };

  const getTransactionTitle = (tx: WalletTransaction) => {
    if (tx.status === 'failed') return 'شارژ ناموفق حساب';
    switch (tx.type) {
      case 'deposit': return 'شارژ حساب';
      case 'purchase': return 'خرید سرویس / کالا';
      case 'refund': return 'استرداد وجه';
      case 'cashback': return 'پاداش نقدی باشگاه';
      default: return 'تراکنش مالی';
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Overview Cards (Desktop: Image 09, Mobile: Image 10) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        
        {/* Desktop & Mobile Card 1: Balance (Matches Image 09 & 10) */}
        <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 rounded-3xl p-6 text-white shadow-xl shadow-blue-500/10 flex flex-col justify-between space-y-4 relative overflow-hidden">
          <div className="absolute -left-10 -bottom-10 w-44 h-44 rounded-full bg-white/10 blur-2xl" />

          <div className="flex items-center justify-between relative z-10">
            <div className="ui-text-button flex items-center gap-2 text-blue-100">
              <Wallet className="w-4 h-4 text-blue-200" />
              <span>موجودی کیف پول</span>
            </div>
            <span className="ui-text-meta px-2.5 py-0.5 rounded-full bg-white/15 text-white backdrop-blur-xs">
              فعال
            </span>
          </div>

          <div className="relative z-10 space-y-1">
            <span className="ui-text-meta text-blue-200">موجودی فعلی قابل استفاده:</span>
            <div className="ui-price-hero text-white font-sans tracking-tight flex items-baseline gap-2">
              {currentBalance.toLocaleString('fa-IR')} <span className="ui-text-body font-normal text-blue-200">تومان</span>
            </div>
          </div>

          <div className="relative z-10 pt-3 border-t border-white/15 flex items-center justify-between">
            <span className="text-xs text-blue-100 font-mono">حساب: {user.phone || 'شماره تماس ثبت نشده'}</span>

            <button
              onClick={() => setIsTopUpModalOpen(true)}
              className="ui-text-button px-4 py-2 bg-white text-blue-700 hover:bg-blue-50 rounded-2xl transition shadow-sm flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>افزایش موجودی</span>
            </button>
          </div>
        </div>

        {/* Desktop Card 2: Total Deposits & Summary (Matches Image 09) */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div className="ui-text-button flex items-center gap-2 text-slate-700">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <span>مجموع واریز و شارژها</span>
            </div>
            <span className="ui-text-meta px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
              گردش مالی
            </span>
          </div>

          <div className="space-y-1">
            <span className="ui-text-meta text-slate-400">مجموع دریافتی‌ها و بازگشت وجه:</span>
            <div className="ui-price-hero text-slate-900 font-sans">
              {totalDeposits.toLocaleString('fa-IR')} <span className="ui-text-meta font-normal text-slate-500">تومان</span>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>تعداد کل تراکنش‌ها: <strong className="text-slate-800 font-sans">{walletTransactions.length} مورد</strong></span>
            <span className="text-emerald-600 font-bold flex items-center gap-1">
              <ShieldCheck className="w-4 h-4" />
              <span>تضمین امنیت نوین‌نت</span>
            </span>
          </div>
        </div>

      </div>

      {/* Financial Transactions Section (Matches Image 09 Desktop Table & Image 10 Mobile List) */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-100 shadow-sm space-y-5">
        
        {/* Header & Filter Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="ui-text-section-title text-slate-900 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-blue-600" />
              <span>تاریخچه تراکنش‌ها</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">ریز گردش حساب، شارژ، خرید سرویس‌ها و بازگشت وجه</p>
          </div>

          {/* Desktop Filter Pills (Matches Image 09) */}
          <div className="hidden sm:flex items-center gap-2">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                filterType === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              همه
            </button>
            <button
              onClick={() => setFilterType('deposit')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                filterType === 'deposit' ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              واریز
            </button>
            <button
              onClick={() => setFilterType('purchase')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                filterType === 'purchase' ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              خرید
            </button>
            <button
              onClick={() => setFilterType('refund')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                filterType === 'refund' ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              استرداد
            </button>
          </div>

          {/* Mobile Filter Tabs (Matches Image 10: همه / واریز / برداشت) */}
          <div className="sm:hidden flex items-center bg-slate-100 p-1 rounded-2xl text-xs font-bold">
            <button
              onClick={() => setMobileFilter('all')}
              className={`flex-1 py-1.5 rounded-xl transition text-center ${
                mobileFilter === 'all' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600'
              }`}
            >
              همه
            </button>
            <button
              onClick={() => setMobileFilter('deposit')}
              className={`flex-1 py-1.5 rounded-xl transition text-center ${
                mobileFilter === 'deposit' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600'
              }`}
            >
              واریز
            </button>
            <button
              onClick={() => setMobileFilter('withdraw')}
              className={`flex-1 py-1.5 rounded-xl transition text-center ${
                mobileFilter === 'withdraw' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600'
              }`}
            >
              برداشت
            </button>
          </div>
        </div>

        {/* Desktop Transactions Table (Matches Image 09) */}
        <div className="hidden sm:block overflow-x-auto">
          {filteredTransactions.length === 0 ? (
            <p className="text-center text-xs text-slate-400 py-8">تراکنشی در این دسته‌بندی یافت نشد.</p>
          ) : (
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                <tr>
                  <th className="py-3.5 px-4">نوع تراکنش</th>
                  <th className="py-3.5 px-4">کد پیگیری</th>
                  <th className="py-3.5 px-4">تاریخ و ساعت</th>
                  <th className="py-3.5 px-4">مبلغ</th>
                  <th className="py-3.5 px-4 text-center">وضعیت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTransactions.map((tx) => {
                  const isPositive = tx.amount > 0 && tx.status === 'successful';
                  const isFailed = tx.status === 'failed';
                  const isPending = tx.status === 'pending';
                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/70 transition">
                      {/* Transaction Type & Icon */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          {getTransactionIcon(tx.type, tx.status)}
                          <div>
                            <div className="font-bold text-slate-900">{getTransactionTitle(tx)}</div>
                            <div className="ui-text-meta text-slate-400">{tx.description}</div>
                          </div>
                        </div>
                      </td>

                      {/* Tracking Code */}
                      <td className="py-4 px-4 font-mono font-bold text-slate-600 text-[11px]">
                        {tx.tracking_code}
                      </td>

                      {/* Date */}
                      <td className="py-4 px-4 font-mono text-slate-500 text-[11px]">
                        {tx.date}
                      </td>

                      {/* Amount */}
                      <td className="py-4 px-4 font-bold font-sans">
                        <span className={`${
                          isFailed ? 'text-slate-400 line-through' :
                          isPending ? 'text-amber-700' : isPositive ? 'text-emerald-600' : 'text-slate-900'
                        }`}>
                          {isPositive ? '+' : ''}{tx.amount.toLocaleString('fa-IR')} تومان
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4 text-center">
                        {isFailed ? (
                          <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 text-[10px] font-bold border border-rose-200">ناموفق</span>
                        ) : isPending ? (
                          <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold border border-amber-200">در انتظار تأیید</span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">موفق</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* Desktop Pagination Note (Matches Image 09) */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>نمایش ۱ تا {filteredTransactions.length} از {walletTransactions.length} تراکنش</span>
            <div className="flex items-center gap-1 font-bold">
              <button className="px-2.5 py-1 rounded-lg bg-blue-600 text-white">۱</button>
              <button className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100">۲</button>
            </div>
          </div>
        </div>

        {/* Mobile Transactions List (Matches Image 10) */}
        <div className="sm:hidden divide-y divide-slate-100">
          {mobileFilteredTransactions.length === 0 ? (
            <p className="text-center text-xs text-slate-400 py-8">تراکنشی یافت نشد.</p>
          ) : (
            mobileFilteredTransactions.map((tx) => {
              const isPositive = tx.amount > 0 && tx.status === 'successful';
              const isFailed = tx.status === 'failed';
              const isPending = tx.status === 'pending';
              return (
                <div key={tx.id} className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3">
                    {getTransactionIcon(tx.type, tx.status)}
                    <div className="space-y-0.5">
                      <div className="font-bold text-slate-900">{getTransactionTitle(tx)}</div>
                      <div className="text-[10px] text-slate-400 font-mono">کد: {tx.tracking_code} • {tx.date.split(' ')[0]}</div>
                    </div>
                  </div>

                  <div className="text-left shrink-0">
                    <div className={`font-black font-sans text-xs ${
                      isFailed ? 'text-slate-400 line-through' :
                      isPending ? 'text-amber-700' : isPositive ? 'text-emerald-600' : 'text-slate-900'
                    }`}>
                      {isPositive ? '+' : ''}{tx.amount.toLocaleString('fa-IR')} ت
                    </div>
                    <span className={`text-[10px] font-bold block mt-0.5 ${
                      isFailed ? 'text-rose-600' : isPending ? 'text-amber-700' : 'text-emerald-600'
                    }`}>
                      {isFailed ? 'ناموفق' : isPending ? 'در انتظار تأیید' : 'موفق'}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>

      {/* Top-up Modal */}
      {isTopUpModalOpen && (
        <ModalPortal>
          <div className="ui-modal-backdrop animate-in fade-in duration-200">
          <div className="ui-modal-panel max-w-md p-6 sm:p-8 space-y-6 animate-in zoom-in-95 duration-200">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Plus className="w-5 h-5" />
                </div>
                <h3 className="text-base font-black text-slate-900">افزایش موجودی کیف پول</h3>
              </div>
              <button
                onClick={() => setIsTopUpModalOpen(false)}
                className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-700 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleTopUpSubmit} className="space-y-5 text-xs">
              {/* Preset Amounts */}
              <div className="space-y-2">
                <label className="block font-bold text-slate-700">انتخاب مبلغ افزایش اعتبار (تومان)</label>
                <div className="grid grid-cols-2 gap-2.5">
                  {[500000, 1000000, 2000000, 5000000].map(amt => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => {
                        setSelectedAmount(amt);
                        setCustomAmount('');
                      }}
                      className={`p-3 rounded-2xl font-bold font-sans transition border text-center ${
                        selectedAmount === amt && !customAmount
                          ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-xs'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      {amt.toLocaleString('fa-IR')} تومان
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Amount */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">یا وارد کردن مبلغ دلخواه (تومان)</label>
                <input
                  type="text"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  placeholder="مثال: ۷۵۰,۰۰۰"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-sans focus:bg-white focus:border-blue-600 focus:outline-none"
                />
              </div>

              {/* Gateway selection */}
              <div className="space-y-2">
                <label className="block font-bold text-slate-700">درگاه پرداخت بانکی</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedGateway('saman')}
                    className={`p-2.5 rounded-xl border text-center font-bold text-[11px] transition ${
                      selectedGateway === 'saman' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    سامان‌کیش
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedGateway('mellat')}
                    className={`p-2.5 rounded-xl border text-center font-bold text-[11px] transition ${
                      selectedGateway === 'mellat' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    به‌پرداخت ملت
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedGateway('parsian')}
                    className={`p-2.5 rounded-xl border text-center font-bold text-[11px] transition ${
                      selectedGateway === 'parsian' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    پارسیان
                  </button>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsTopUpModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold transition"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition shadow-sm shadow-blue-500/20"
                >
                  انتقال به درگاه پرداخت
                </button>
              </div>
            </form>

          </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
};
