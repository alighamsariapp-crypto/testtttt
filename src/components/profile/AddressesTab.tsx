import React, { useState } from 'react';
import { 
  MapPin, 
  Plus, 
  Home, 
  Building2, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  Phone, 
  Mail, 
  X, 
  AlertCircle
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { UserAddress } from '../../types';
import { iranProvinces } from '../../services/mockData';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { ModalPortal } from '../common/ModalPortal';

export const AddressesTab: React.FC = () => {
  const { addresses, addAddress, updateAddress, deleteAddress, showToast } = useApp();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<number | null>(null);
  const [addressPendingDeletion, setAddressPendingDeletion] = useState<UserAddress | null>(null);
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  useBodyScrollLock(isModalOpen);

  // Form State
  const [formData, setFormData] = useState<{
    title: string;
    recipient_name: string;
    phone: string;
    province: string;
    city: string;
    postal_code: string;
    address_line: string;
    is_default: boolean;
  }>({
    title: '',
    recipient_name: '',
    phone: '',
    province: '',
    city: '',
    postal_code: '',
    address_line: '',
    is_default: false,
  });

  const availableCities = iranProvinces.find(p => p.name === formData.province)?.cities || ['تهران'];

  const openAddModal = () => {
    setEditingAddressId(null);
    setFormData({
      title: '',
      recipient_name: '',
      phone: '',
      province: '',
      city: '',
      postal_code: '',
      address_line: '',
      is_default: addresses.length === 0,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (addr: UserAddress) => {
    setEditingAddressId(addr.id);
    setFormData({
      title: addr.title,
      recipient_name: addr.recipient_name,
      phone: addr.phone,
      province: addr.province,
      city: addr.city,
      postal_code: addr.postal_code,
      address_line: addr.address_line,
      is_default: !!addr.is_default,
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.address_line.trim()) {
      showToast('لطفاً نشانی پستی دقیق را وارد فرمایید.', 'error');
      return;
    }
    if (!formData.recipient_name.trim()) {
      showToast('لطفاً نام گیرنده را وارد فرمایید.', 'error');
      return;
    }

    setIsSavingAddress(true);
    try {
      if (editingAddressId) {
        await updateAddress(editingAddressId, formData);
        showToast('آدرس با موفقیت ویرایش شد.', 'success');
      } else {
        await addAddress(formData);
        showToast('آدرس جدید با موفقیت ذخیره شد.', 'success');
      }
      setIsModalOpen(false);
    } catch {
      // The central address action shows a Persian toast; keep the modal open for correction/retry.
    } finally {
      setIsSavingAddress(false);
    }
  };

  const handleSetDefault = async (id: number) => {
    try {
      await Promise.all(addresses.map((address) => updateAddress(address.id, { is_default: address.id === id })));
      showToast('آدرس پیش‌فرض تغییر یافت.', 'success');
    } catch {
      // The central address action shows a Persian toast.
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Title and Add Button */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-black text-slate-900">آدرس‌های من</h1>
            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-600 text-xs font-bold font-sans">
              {addresses.length} آدرس ثبت شده
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">مدیریت آدرس‌های منتخب جهت ارسال سریع سفارش‌های کالا و خدمات</p>
        </div>

        <button
          onClick={openAddModal}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-bold transition shadow-sm shadow-blue-500/20 flex items-center justify-center gap-1.5 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>ثبت آدرس جدید</span>
        </button>
      </div>

      {/* Grid of Addresses */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        
        {addresses.length === 0 && (
          <div className="md:col-span-2 rounded-3xl border border-slate-200 bg-slate-50/70 px-6 py-8 text-center">
            <div className="w-11 h-11 mx-auto rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <MapPin className="w-5 h-5" />
            </div>
            <h2 className="mt-3 text-sm font-bold text-slate-800">هنوز آدرسی ثبت نشده است</h2>
            <p className="mt-1 text-xs text-slate-500">برای ثبت نخستین آدرس تحویل، از دکمهٔ «ثبت آدرس جدید» در بالای صفحه استفاده کنید.</p>
          </div>
        )}

        {/* Existing Addresses */}
        {addresses.map((address) => (
          <div
            key={address.id}
            className={`bg-white rounded-3xl p-6 border transition-all duration-200 shadow-sm flex flex-col justify-between space-y-4 ${
              address.is_default ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-100 hover:border-slate-200'
            }`}
          >
            {/* Card Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  {address.title === 'خانه' ? (
                    <Home className="w-4 h-4" />
                  ) : (
                    <Building2 className="w-4 h-4" />
                  )}
                </div>
                <h3 className="text-sm font-bold text-slate-900">{address.title}</h3>
              </div>

              {address.is_default ? (
                <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>آدرس پیش‌فرض</span>
                </span>
              ) : (
                <button
                  onClick={() => handleSetDefault(address.id)}
                  className="text-[11px] font-bold text-slate-400 hover:text-blue-600 transition"
                >
                  تنظیم به عنوان پیش‌فرض
                </button>
              )}
            </div>

            {/* Address Details */}
            <div className="space-y-2 text-xs">
              <p className="text-slate-700 leading-relaxed font-medium">
                {address.address_line}
              </p>

              <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-slate-500 text-[11px]">
                <div className="flex items-center gap-1.5 truncate">
                  <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="font-mono">{address.phone}</span>
                </div>
                <div className="flex items-center gap-1.5 truncate">
                  <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="font-mono">کد پستی: {address.postal_code || '---'}</span>
                </div>
                <div className="col-span-2 text-slate-600 font-bold">
                  تحویل‌گیرنده: {address.recipient_name}
                </div>
              </div>
            </div>

            {/* Card Actions */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 text-xs">
              <button
                onClick={() => openEditModal(address)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold transition flex items-center gap-1"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>ویرایش</span>
              </button>

              <button
                type="button"
                onClick={() => setAddressPendingDeletion(address)}
                className="px-3 py-1.5 rounded-xl border border-rose-200 hover:bg-rose-50 text-rose-600 font-bold transition flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>حذف</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog
        isOpen={Boolean(addressPendingDeletion)}
        title="حذف آدرس"
        description={addressPendingDeletion ? `آدرس «${addressPendingDeletion.title}» از فهرست آدرس‌های تحویل حذف می‌شود. این عمل قابل بازگشت نیست.` : ''}
        confirmLabel="حذف آدرس"
        onCancel={() => setAddressPendingDeletion(null)}
        onConfirm={() => {
          if (!addressPendingDeletion) return;
          deleteAddress(addressPendingDeletion.id);
          setAddressPendingDeletion(null);
        }}
      />

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <ModalPortal>
          <div className="ui-modal-backdrop animate-in fade-in duration-200">
          <div className="ui-modal-panel max-w-lg w-full p-6 sm:p-8 space-y-6 animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-base font-black text-slate-900">
                {editingAddressId ? 'ویرایش آدرس پستی' : 'ثبت آدرس تحویل جدید'}
              </h3>
              <button
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSavingAddress}
                  className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-700 transition disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSave} className="space-y-4 text-xs">
              {/* Title / Label */}
              <div>
                <label className="block text-slate-700 font-bold mb-1.5">عنوان آدرس (مثال: خانه، دفتر کار)</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  required
                  placeholder="مثلا: خانه، محل کار، شرکت"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none"
                />
              </div>

              {/* Recipient Name & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1.5">نام و نام خانوادگی تحویل‌گیرنده</label>
                  <input
                    type="text"
                    value={formData.recipient_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, recipient_name: e.target.value }))}
                    required
                    placeholder="مثال: علی احمدی"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1.5">شماره موبایل تحویل‌گیرنده</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    required
                    placeholder="09xxxxxxxxx"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none font-mono"
                  />
                </div>
              </div>

              {/* Province & City */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1.5">استان</label>
                  <select
                    value={formData.province}
                    onChange={(e) => {
                      const newProv = e.target.value;
                      const cities = iranProvinces.find(p => p.name === newProv)?.cities || [];
                      setFormData(prev => ({ ...prev, province: newProv, city: cities[0] || '' }));
                    }}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none"
                  >
                    {iranProvinces.map(p => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1.5">شهر</label>
                  <select
                    value={formData.city}
                    onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none"
                  >
                    {availableCities.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Postal Code */}
              <div>
                <label className="block text-slate-700 font-bold mb-1.5">کد پستی (۱۰ رقمی)</label>
                <input
                  type="text"
                  maxLength={10}
                  value={formData.postal_code}
                  onChange={(e) => setFormData(prev => ({ ...prev, postal_code: e.target.value }))}
                  placeholder="مثال: 1234567890"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none font-mono"
                />
              </div>

              {/* Full Address */}
              <div>
                <label className="block text-slate-700 font-bold mb-1.5">نشانی پستی دقیق (خیابان، کوچه، پلاک، واحد)</label>
                <textarea
                  rows={3}
                  value={formData.address_line}
                  onChange={(e) => setFormData(prev => ({ ...prev, address_line: e.target.value }))}
                  required
                  placeholder="تهران، خیابان ولیعصر، نرسیده به میدان ونک، پلاک ..."
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none resize-none leading-relaxed"
                />
              </div>

              {/* Set as Default Checkbox */}
              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={formData.is_default}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_default: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 rounded-lg focus:ring-blue-500"
                />
                <span className="text-slate-700 font-bold">تنظیم این آدرس به عنوان آدرس پیش‌فرض تحویل</span>
              </label>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSavingAddress}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold transition disabled:opacity-50"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={isSavingAddress}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition shadow-sm shadow-blue-500/20 disabled:cursor-wait disabled:opacity-70"
                >
                  {isSavingAddress ? 'در حال ذخیره…' : editingAddressId ? 'ذخیره تغییرات' : 'ثبت آدرس'}
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
