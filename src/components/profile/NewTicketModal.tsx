import React, { useEffect, useRef, useState } from 'react';
import { 
  X, 
  Send, 
  Paperclip, 
  UploadCloud, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight,
  Sparkles,
  ChevronDown
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SupportTicket } from '../../types';
import { SESSION_STATE_KEYS, clearSessionState, readSessionState, writeSessionState } from '../../utils/sessionState';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { ModalPortal } from '../common/ModalPortal';

type NewTicketDraft = {
  title: string;
  department: SupportTicket['department'];
  selectedOrderId: string;
  priority: 'low' | 'medium' | 'high';
  message: string;
};

interface NewTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const NewTicketModal: React.FC<NewTicketModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { addSupportTicket, userOrders, showToast } = useApp();
  useBodyScrollLock(isOpen);
  const initialDraft = readSessionState<NewTicketDraft>(SESSION_STATE_KEYS.newTicketDraft, {
    title: '',
    department: 'پشتیبانی فنی',
    selectedOrderId: '',
    priority: 'medium',
    message: '',
  });

  const [title, setTitle] = useState(initialDraft.title);
  const [department, setDepartment] = useState<SupportTicket['department']>(initialDraft.department);
  const [selectedOrderId, setSelectedOrderId] = useState(initialDraft.selectedOrderId);
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>(initialDraft.priority);
  const [message, setMessage] = useState(initialDraft.message);
  const [attachedFiles, setAttachedFiles] = useState<Array<{ name: string; size: string }>>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    writeSessionState<NewTicketDraft>(SESSION_STATE_KEYS.newTicketDraft, {
      title,
      department,
      selectedOrderId,
      priority,
      message,
    });
  }, [department, isOpen, message, priority, selectedOrderId, title]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files).map((file: File) => ({
        name: file.name,
        size: (file.size / (1024 * 1024)).toFixed(1) + ' MB'
      }));
      setAttachedFiles(prev => [...prev, ...newFiles]);
      showToast('فایل با موفقیت پیوست گردید.', 'info');
    }
  };

  const handleRemoveFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      showToast('لطفاً عنوان و متن درخواست خود را وارد کنید.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      let finalTitle = title.trim();
      if (selectedOrderId) {
        finalTitle = `[سفارش ${selectedOrderId}] ${finalTitle}`;
      }

      await addSupportTicket({
        title: finalTitle,
        department,
        priority: priority === 'high' ? 'high' : priority === 'low' ? 'low' : 'medium',
        message: message.trim() + (attachedFiles.length > 0 ? `\n(پیوست‌ها: ${attachedFiles.map(f => f.name).join(', ')})` : '')
      });

      clearSessionState(SESSION_STATE_KEYS.newTicketDraft);
      onClose();
      if (onSuccess) onSuccess();
    } catch {
      // On failure: keep modal open, preserve entered values, do not call onSuccess
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalPortal>
          <div className="ui-modal-backdrop p-0 sm:p-4 animate-in fade-in duration-200">
      
      {/* Backdrop */}
      <button type="button" className="fixed inset-0" onClick={onClose} aria-label="بستن ثبت تیکت" />

      {/* Modal Container (Matches Image 03 & Image 04) */}
      <div className="ui-modal-panel relative z-10 w-full sm:max-w-2xl min-h-[90dvh] sm:min-h-0 sm:rounded-3xl flex flex-col overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
          <div className="space-y-0.5">
            <h2 className="text-base sm:text-lg font-black text-slate-900">ثبت تیکت جدید</h2>
            <p className="text-xs text-slate-500 hidden sm:block">
              لطفاً جزئیات درخواست خود را با دقت وارد کنید تا تیم پشتیبانی در اسرع وقت پاسخگو باشد.
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto max-h-[calc(85vh-130px)] sm:max-h-[75vh]">
          
          {/* Ticket Title */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              موضوع تیکت <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="مثال: مشکل در پرداخت"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none transition"
            />
          </div>

          {/* Department & Order Selection Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Department */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                دسته‌بندی <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value as any)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-900 appearance-none focus:bg-white focus:border-blue-600 focus:outline-none transition"
                >
                  <option value="پشتیبانی فنی">پشتیبانی فنی و شبکه</option>
                  <option value="مالی و فاکتور">مالی و فاکتور</option>
                  <option value="فروش و تمدید">فروش و خدمات</option>
                  <option value="عمومی و پیشنهادات">عمومی و سایر موارد</option>
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Related Order */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                سفارش مربوطه (اختیاری)
              </label>
              <div className="relative">
                <select
                  value={selectedOrderId}
                  onChange={(e) => setSelectedOrderId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-900 appearance-none focus:bg-white focus:border-blue-600 focus:outline-none transition"
                >
                  <option value="">انتخاب سفارش...</option>
                  {userOrders.map(order => (
                    <option key={order.id} value={order.order_number}>
                      {order.order_number} ({((order.total_amount) ?? 0).toLocaleString('fa-IR')} تومان)
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

          </div>

          {/* Priority Toggle Buttons (Matches Image 03 & 04) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              اولویت
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              
              <button
                type="button"
                onClick={() => setPriority('low')}
                className={`py-2.5 rounded-2xl text-xs font-bold transition border ${
                  priority === 'low'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                کم
              </button>

              <button
                type="button"
                onClick={() => setPriority('medium')}
                className={`py-2.5 rounded-2xl text-xs font-bold transition border ${
                  priority === 'medium'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                متوسط
              </button>

              <button
                type="button"
                onClick={() => setPriority('high')}
                className={`py-2.5 rounded-2xl text-xs font-bold transition border ${
                  priority === 'high'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                زیاد
              </button>

            </div>
          </div>

          {/* Message Area */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              متن پیام <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              placeholder="توضیحات کامل مشکل یا درخواست خود را اینجا بنویسید..."
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none transition resize-none leading-relaxed"
            />
          </div>

          {/* Drag & Drop File Upload Zone (Matches Image 03 & 04) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              پیوست فایل
            </label>

            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              className="hidden" 
              multiple 
              accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.zip"
            />

            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  const newFiles = Array.from(e.dataTransfer.files).map((file: File) => ({
                    name: file.name,
                    size: (file.size / (1024 * 1024)).toFixed(1) + ' MB'
                  }));
                  setAttachedFiles(prev => [...prev, ...newFiles]);
                }
              }}
              className={`p-6 border-2 border-dashed rounded-3xl text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 ${
                isDragging ? 'border-blue-600 bg-blue-50/50' : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'
              }`}
            >
              <div className="w-12 h-12 rounded-2xl bg-white text-blue-600 flex items-center justify-center shadow-sm">
                <UploadCloud className="w-6 h-6" />
              </div>
              <p className="text-xs font-bold text-slate-700">
                فایل‌های خود را اینجا رها کنید یا کلیک کنید
              </p>
              <p className="text-[11px] text-slate-400">
                پشتیبانی از JPG, PNG, PDF حداکثر 5 مگابایت
              </p>
            </div>

            {/* Attached files preview chips */}
            {attachedFiles.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {attachedFiles.map((file, idx) => (
                  <div 
                    key={`file-${file.name}-${file.size}-${idx}`} 
                    className="px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-xl text-xs flex items-center gap-2 text-blue-900"
                  >
                    <FileText className="w-3.5 h-3.5 text-blue-600" />
                    <span className="font-medium truncate max-w-[150px]">{file.name}</span>
                    <span className="text-[10px] text-blue-400 font-mono">({file.size})</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveFile(idx);
                      }}
                      className="text-slate-400 hover:text-rose-600 p-0.5 rounded-md"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons (Matches Image 03 & 04) */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-2xl text-xs font-bold transition border border-slate-200"
            >
              انصراف
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-bold transition shadow-md shadow-blue-500/20 flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              <span>{isSubmitting ? 'در حال ارسال...' : 'ثبت و ارسال'}</span>
            </button>
          </div>

        </form>

      </div>

      </div>
    </ModalPortal>
  );
};
