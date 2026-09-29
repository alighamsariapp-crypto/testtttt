import React, { useState } from 'react';
import { 
  Users, 
  Search, 
  ShieldCheck, 
  ShieldAlert, 
  Wallet, 
  Edit3, 
  CheckCircle2, 
  XCircle, 
  UserCheck, 
  UserX, 
  Phone, 
  Mail, 
  Calendar,
  X,
  Sparkles,
  DollarSign
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { UserProfile } from '../../types';
import { UserIdentityBadge } from '../common/UserIdentityBadge';

export const AdminUsersTab: React.FC = () => {
  const { allUsers, updateUserRole, updateUserStatus, adjustUserWallet } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Form states for modal
  const [newRole, setNewRole] = useState<UserProfile['role']>('customer');
  const [newStatus, setNewStatus] = useState<'active' | 'suspended'>('active');
  const [walletAdjustment, setWalletAdjustment] = useState<number>(0);
  const [walletNote, setWalletNote] = useState<string>('شارژ دستی توسط مدیر سیستم');

  const filteredUsers = allUsers.filter(u => {
    const s = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm.trim() ||
      u.name.toLowerCase().includes(s) ||
      u.email.toLowerCase().includes(s) ||
      u.phone?.includes(s);

    const matchesRole = roleFilter === 'all' || u.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  const handleOpenEdit = (user: UserProfile) => {
    setSelectedUser(user);
    setNewRole(user.role);
    setNewStatus(user.status || 'active');
    setWalletAdjustment(0);
    setIsEditModalOpen(true);
  };

  const handleSaveUser = async () => {
    if (!selectedUser) return;

    try {
      if (newRole !== selectedUser.role || newStatus !== selectedUser.status) {
        await updateUserRole(selectedUser.id, newRole, newStatus);
      }
      if (walletAdjustment !== 0) {
        await adjustUserWallet(selectedUser.id, Math.round(walletAdjustment * 10), walletNote);
      }
      setIsEditModalOpen(false);
    } catch {
      // عملیات context پیام خطای مناسب را نمایش می‌دهد و فرم برای اصلاح باز می‌ماند.
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300" dir="rtl">
      
      {/* Top Header Card */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-slate-700/80 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
              مدیریت کاربران، سطوح دسترسی و کیف پول
            </h1>
            <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              {allUsers.length} حساب کاربری
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            تعیین نقش‌های مدیر ارشد / کارشناس فنی، مسدودسازی حساب و افزایش یا کسر اعتبار کیف پول.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-4 border border-slate-200 dark:border-slate-700/80 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          
          <div className="sm:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="admin-users-search"
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="جستجو در نام کاربر، ایمیل، یا شماره موبایل..."
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pr-10 pl-4 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition"
            />
          </div>

          <div>
            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
            >
              <option value="all">همه سطوح دسترسی</option>
              <option value="admin">مدیران ارشد (Admin)</option>
              <option value="staff">کارشناسان فنی (Staff)</option>
              <option value="customer">مشتریان عادی (Customer)</option>
            </select>
          </div>

        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 dark:bg-slate-850/60 border-b border-slate-200 dark:border-slate-700 text-slate-500 font-bold">
              <tr>
                <th className="py-3.5 px-4">مشخصات کاربر</th>
                <th className="py-3.5 px-3">شماره تماس</th>
                <th className="py-3.5 px-3 text-center">سطح دسترسی (Role)</th>
                <th className="py-3.5 px-3">موجودی کیف پول</th>
                <th className="py-3.5 px-3 text-center">وضعیت حساب</th>
                <th className="py-3.5 px-3">تاریخ عضویت</th>
                <th className="py-3.5 px-4 text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {filteredUsers.map(user => {
                const roleBadges: Record<string, { label: string; bg: string }> = {
                  admin: { label: 'مدیر ارشد', bg: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-300' },
                  staff: { label: 'کارشناس فنی', bg: 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-300' },
                  customer: { label: 'مشتری', bg: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-300' }
                };

                return (
                  <tr key={user.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-750/50 transition group">
                    
                    {/* Avatar & Name */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <UserIdentityBadge
                          name={user.name}
                          className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 ring-2 ring-blue-500/20 shrink-0"
                          iconClassName="w-4 h-4"
                        />
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                            {user.name}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono" dir="ltr">
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Phone */}
                    <td className="py-3 px-3 font-mono text-slate-700 dark:text-slate-300" dir="ltr">
                      {user.phone || '---'}
                    </td>

                    {/* Role */}
                    <td className="py-3 px-3 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${roleBadges[user.role]?.bg || 'bg-slate-100 text-slate-600'}`}>
                        {roleBadges[user.role]?.label || user.role}
                      </span>
                    </td>

                    {/* Wallet Balance */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        <Wallet className="w-3.5 h-3.5" />
                        <span>{(user.wallet_balance || 0).toLocaleString('fa-IR')} تومان</span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-3 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        user.status !== 'suspended' 
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' 
                          : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                      }`}>
                        {user.status !== 'suspended' ? 'فعال' : 'مسدود'}
                      </span>
                    </td>

                    {/* Join Date */}
                    <td className="py-3 px-3 text-slate-400 font-mono text-[11px]">
                      {user.join_date || '۱۴۰۲/۰۶/۱۰'}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleOpenEdit(user)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 hover:bg-blue-100 font-bold transition"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>مدیریت کاربر</span>
                      </button>
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit User & Wallet Modal */}
      {isEditModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-md w-full p-6 space-y-5 border border-slate-200 dark:border-slate-700 shadow-2xl animate-in zoom-in-95 duration-200">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2.5">
                <UserIdentityBadge
                  name={selectedUser.name}
                  className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 ring-2 ring-blue-500/20"
                  iconClassName="w-4 h-4"
                />
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {selectedUser.name}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono" dir="ltr">
                    {selectedUser.email}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Role Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                نقش و سطح دسترسی کاربر:
              </label>
              <select
                value={newRole}
                onChange={e => setNewRole(e.target.value as UserProfile['role'])}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              >
                <option value="customer">مشتری عادی (Customer)</option>
                <option value="staff">کارشناس فنی و پشتیبانی (Staff)</option>
                <option value="admin">مدیر کل سیستم (Admin)</option>
              </select>
            </div>

            {/* Status Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                وضعیت حساب کاربری:
              </label>
              <select
                value={newStatus}
                onChange={e => setNewStatus(e.target.value as 'active' | 'suspended')}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              >
                <option value="active">فعال و مجاز به خرید</option>
                <option value="suspended">مسدود شده (محدودیت دسترسی)</option>
              </select>
            </div>

            {/* Wallet Adjustment Section */}
            <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1">
                  <Wallet className="w-4 h-4 text-emerald-600" />
                  موجودی فعلی کیف پول:
                </span>
                <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                  {(selectedUser.wallet_balance || 0).toLocaleString('fa-IR')} تومان
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  تغییر اعتبار ریالی (تومان - برای کسر عدد منفی وارد کنید):
                </label>
                <input
                  type="number"
                  step="50000"
                  value={walletAdjustment || ''}
                  onChange={e => setWalletAdjustment(Number(e.target.value))}
                  placeholder="مثال: 500000 یا -200000"
                  className="w-full bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-bold transition"
              >
                انصراف
              </button>
              <button
                id="save-user-edit-btn"
                type="button"
                onClick={() => void handleSaveUser()}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-lg shadow-blue-600/20"
              >
                ذخیره تغییرات کاربر
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
