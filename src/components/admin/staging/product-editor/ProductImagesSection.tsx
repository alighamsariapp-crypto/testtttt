import React, { useRef, useState, useCallback } from 'react';
import {
  Upload,
  Trash2,
  CheckCircle2,
  AlertCircle,
  RotateCw,
  Plus,
  Loader2,
  X,
  FileImage,
  ExternalLink,
} from 'lucide-react';
import type { ProductFormState } from './types';
import { api } from '../../../../services/api';

interface Props {
  form: ProductFormState;
  liveMode: boolean;
  updateForm: <K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) => void;
  setErrorMessage: (msg: string) => void;
}

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

interface UploadState {
  status: UploadStatus;
  fileName?: string;
  fileSize?: string;
  error?: string;
  lastFailedFile?: File | null;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'image/avif'];

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} بایت`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} کیلوبایت`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} مگابایت`;
};

export const ProductImagesSection: React.FC<Props> = ({
  form,
  liveMode,
  updateForm,
  setErrorMessage,
}) => {
  const [uploadState, setUploadState] = useState<UploadState>({ status: 'idle' });
  const [isDragging, setIsDragging] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [urlInputError, setUrlInputError] = useState('');
  const [newlyAddedUrl, setNewlyAddedUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type) && !file.type.startsWith('image/')) {
      return 'فرمت فایل انتخاب‌شده معتبر نیست. لطفاً یکی از فرمت‌های JPG، PNG، WEBP یا GIF را بارگذاری کنید.';
    }
    if (file.size > MAX_FILE_SIZE) {
      return `حجم فایل (${formatFileSize(file.size)}) بیش از سقف مجاز ۵ مگابایت است. لطفاً فایل کم‌حجم‌تری انتخاب کنید.`;
    }
    return null;
  };

  const processUpload = useCallback(async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setUploadState({
        status: 'error',
        error: validationError,
        lastFailedFile: file,
      });
      setErrorMessage(validationError);
      return;
    }

    setUploadState({
      status: 'uploading',
      fileName: file.name,
      fileSize: formatFileSize(file.size),
      error: undefined,
      lastFailedFile: null,
    });
    setErrorMessage('');

    try {
      let finalUrl = '';

      if (liveMode) {
        finalUrl = await api.uploadAdminProductImage(file);
        if (!finalUrl) {
          throw new Error('آدرس تصویر از سوی سرور بازگردانده نشد.');
        }
      } else {
        finalUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === 'string') {
              resolve(reader.result);
            } else {
              reject(new Error('خطا در پردازش داده تصویر در مرورگر.'));
            }
          };
          reader.onerror = () => reject(new Error('خواندن فایل تصویری با شکست روبه‌رو شد.'));
          reader.readAsDataURL(file);
        });
      }

      const newGallery = [...form.gallery, finalUrl];
      updateForm('gallery', newGallery);
      if (!form.image) {
        updateForm('image', finalUrl);
      }

      setNewlyAddedUrl(finalUrl);
      setUploadState({
        status: 'success',
        fileName: file.name,
        fileSize: formatFileSize(file.size),
        lastFailedFile: null,
      });

      // Reset auto-dismiss timer for success state
      setTimeout(() => {
        setUploadState((prev) => (prev.status === 'success' ? { status: 'idle' } : prev));
      }, 4000);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'بارگذاری فایل با خطا روبه‌رو شد.';
      setUploadState({
        status: 'error',
        fileName: file.name,
        fileSize: formatFileSize(file.size),
        error: errorMsg,
        lastFailedFile: file,
      });
      setErrorMessage(errorMsg);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [form.gallery, form.image, liveMode, setErrorMessage, updateForm]);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !files.length) return;
    void processUpload(files[0]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (uploadState.status !== 'uploading') {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (uploadState.status === 'uploading') return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      void processUpload(files[0]);
    }
  };

  const handleRetry = () => {
    if (uploadState.lastFailedFile) {
      void processUpload(uploadState.lastFailedFile);
    }
  };

  const handleDismissError = () => {
    setUploadState({ status: 'idle' });
    setErrorMessage('');
  };

  const handleAddImageUrl = () => {
    const trimmed = imageUrlInput.trim();
    if (!trimmed) {
      setUrlInputError('لطفاً نشانی اینترنتی معتبر تصویر را وارد کنید.');
      return;
    }
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.startsWith('/')) {
      setUrlInputError('آدرس تصویر باید با https:// یا http:// آغاز شود.');
      return;
    }

    setUrlInputError('');
    const newGallery = [...form.gallery, trimmed];
    updateForm('gallery', newGallery);
    if (!form.image) {
      updateForm('image', trimmed);
    }
    setNewlyAddedUrl(trimmed);
    setImageUrlInput('');
  };

  const handleSetCover = (imgUrl: string) => {
    updateForm('image', imgUrl);
    const filtered = form.gallery.filter((g) => g !== imgUrl);
    updateForm('gallery', [imgUrl, ...filtered]);
  };

  const handleRemoveImage = (imgUrl: string) => {
    const newGallery = form.gallery.filter((g) => g !== imgUrl);
    updateForm('gallery', newGallery);
    if (form.image === imgUrl) {
      updateForm('image', newGallery[0] || '');
    }
    if (newlyAddedUrl === imgUrl) {
      setNewlyAddedUrl(null);
    }
  };

  const isUploading = uploadState.status === 'uploading';

  return (
    <div className="product-panel-body">
      {/* 1. کادر آپلود حرفه‌ای و ورودی لینک اینترنتی */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
        {/* دراپ‌زون فایل با وضعیت‌های Idle, Dragging, Uploading */}
        <div
          className={`product-dropzone ${isDragging ? 'dragging' : ''} ${isUploading ? 'disabled' : ''}`}
          onClick={() => !isUploading && fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{ minHeight: '120px' }}
        >
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
            onChange={handleFileInputChange}
            disabled={isUploading}
          />

          {isUploading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', width: '100%', padding: '0 8px' }}>
              <Loader2 size={26} color="#2563eb" className="animate-spin" />
              <b>در حال ارسال و پردازش فایل تصویری...</b>
              {uploadState.fileName && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#475569' }}>
                  <FileImage size={14} />
                  <span style={{ direction: 'ltr', fontWeight: 600 }}>{uploadState.fileName}</span>
                  <span>({uploadState.fileSize})</span>
                </div>
              )}
              {/* نوار پالسی واقعی بدون لودینگ ساختگی */}
              <div className="pulse-loader" style={{ maxWidth: '240px', marginTop: '4px' }} />
            </div>
          ) : (
            <>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  background: isDragging ? '#2563eb' : '#eff6ff',
                  color: isDragging ? '#ffffff' : '#2563eb',
                  display: 'grid',
                  placeItems: 'center',
                  transition: 'all 0.15s ease',
                }}
              >
                <Upload size={22} />
              </div>
              <b>{isDragging ? 'تصویر را اینجا رها کنید...' : 'انتخاب یا رها کردن تصویر از دستگاه'}</b>
              <small>پشتیبانی از JPG، PNG، WEBP (حداکثر حجم مجاز: ۵ مگابایت)</small>
            </>
          )}
        </div>

        {/* ورودی درج مستقیم نشانی تصویر */}
        <div
          style={{
            border: '1px dashed #cbd5e1',
            borderRadius: '10px',
            padding: '16px',
            background: '#f8fafc',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: '10px',
          }}
        >
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <ExternalLink size={14} color="#64748b" />
            یا درج لینک مستقیم تصویر:
          </span>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <input
              type="url"
              className="admin-input"
              style={{ direction: 'ltr', flex: '1 1 200px', minHeight: '40px' }}
              placeholder="https://example.com/image.webp"
              value={imageUrlInput}
              disabled={isUploading}
              onChange={(e) => {
                setImageUrlInput(e.target.value);
                if (urlInputError) setUrlInputError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddImageUrl();
                }
              }}
            />
            <button
              type="button"
              onClick={handleAddImageUrl}
              disabled={isUploading || !imageUrlInput.trim()}
              style={{
                background: isUploading || !imageUrlInput.trim() ? '#94a3b8' : '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '0 16px',
                minHeight: '40px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: isUploading || !imageUrlInput.trim() ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Plus size={16} />
              افزودن
            </button>
          </div>
          {urlInputError && (
            <span style={{ color: '#dc2626', fontSize: '11px', fontWeight: 600 }}>{urlInputError}</span>
          )}
        </div>
      </div>

      {/* ۲. بنرهای بازخورد ماشین وضعیت (Success / Error) */}
      {uploadState.status === 'success' && (
        <div className="upload-banner success">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={18} color="#16a34a" />
            <span>
              تصویر <b>{uploadState.fileName}</b> با موفقیت بارگذاری و به گالری کالا افزوده شد.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setUploadState({ status: 'idle' })}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#15803d', padding: '4px' }}
            title="بستن پیام"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {uploadState.status === 'error' && (
        <div className="upload-banner error">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
            <AlertCircle size={18} color="#dc2626" style={{ flexShrink: 0 }} />
            <span style={{ fontWeight: 600 }}>{uploadState.error}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {uploadState.lastFailedFile && (
              <button
                type="button"
                onClick={handleRetry}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <RotateCw size={13} />
                تلاش مجدد
              </button>
            )}
            <button
              type="button"
              onClick={handleDismissError}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#991b1b', padding: '4px' }}
              title="نادیده گرفتن"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ۳. گالری تصاویر ثبت‌شده */}
      <div style={{ marginTop: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '4px' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>
            تصاویر کالا ({form.gallery.length.toLocaleString('fa-IR')} تصویر)
          </span>
          {form.gallery.length > 0 && (
            <small style={{ color: '#64748b', fontSize: '11px' }}>
              نخستین تصویر از راست، به عنوان تصویر پیش‌فرض (کاور) به مشتری نمایش داده می‌شود.
            </small>
          )}
        </div>

        {form.gallery.length === 0 ? (
          <div
            style={{
              padding: '36px 16px',
              textAlign: 'center',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              background: '#ffffff',
              color: '#94a3b8',
              fontSize: '12px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <FileImage size={32} color="#cbd5e1" />
            <span>هنوز تصویری برای این کالا اضافه نشده است.</span>
            <small style={{ color: '#64748b' }}>حداقل یک تصویر برای نمایش بهتر محصول در فروشگاه ثبت کنید.</small>
          </div>
        ) : (
          <div className="gallery-grid">
            {form.gallery.map((imgUrl, idx) => {
              const isCover = form.image === imgUrl || (idx === 0 && !form.image);
              const isNewlyAdded = newlyAddedUrl === imgUrl;

              return (
                <div key={`${imgUrl}-${idx}`} className={`gallery-card ${isCover ? 'cover' : ''}`}>
                  {isCover && <span className="cover-badge">تصویر اصلی</span>}
                  {!isCover && isNewlyAdded && (
                    <span
                      style={{
                        position: 'absolute',
                        top: '6px',
                        left: '6px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: '#16a34a',
                        color: '#ffffff',
                        fontSize: '9px',
                        fontWeight: 800,
                        zIndex: 2,
                      }}
                    >
                      جدید
                    </span>
                  )}
                  <img
                    src={imgUrl}
                    alt={`تصویر کالا ${idx + 1}`}
                    loading="lazy"
                    onError={(e) => {
                      // Fallback broken image gracefully
                      (e.target as HTMLImageElement).src =
                        'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?auto=format&fit=crop&w=600&q=80';
                    }}
                  />
                  <div className="gallery-card-controls">
                    {!isCover && (
                      <button
                        type="button"
                        onClick={() => handleSetCover(imgUrl)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px',
                        }}
                      >
                        <CheckCircle2 size={12} />
                        تصویر اصلی
                      </button>
                    )}
                    <button
                      type="button"
                      className="remove-image"
                      onClick={() => handleRemoveImage(imgUrl)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                      }}
                    >
                      <Trash2 size={12} />
                      حذف
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
