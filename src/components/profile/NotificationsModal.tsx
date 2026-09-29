import React, { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  X,
  CheckCheck,
  Package,
  Headphones,
  Wallet,
  ShieldAlert,
  Inbox,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { ModalPortal } from '../common/ModalPortal';
import {
  buildCustomerNotifications,
  CustomerNotification,
  readNotificationReadIds,
  writeNotificationReadIds,
} from '../../utils/notificationCenter';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const getNotificationIcon = (type: CustomerNotification['type']) => {
  const iconClassName = 'h-5 w-5';
  const wrapperClassName = 'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl';

  switch (type) {
    case 'order':
      return <span className={`${wrapperClassName} bg-blue-50 text-blue-600`}><Package className={iconClassName} /></span>;
    case 'support':
      return <span className={`${wrapperClassName} bg-indigo-50 text-indigo-600`}><Headphones className={iconClassName} /></span>;
    case 'wallet':
      return <span className={`${wrapperClassName} bg-emerald-50 text-emerald-600`}><Wallet className={iconClassName} /></span>;
    case 'security':
      return <span className={`${wrapperClassName} bg-purple-50 text-purple-600`}><ShieldAlert className={iconClassName} /></span>;
  }
};

export const NotificationsModal: React.FC<NotificationsModalProps> = ({ isOpen, onClose }) => {
  const {
    user,
    userOrders,
    supportTickets,
    walletTransactions,
    activeSessions,
    openProfileTab,
    showToast,
  } = useApp();
  const [readIds, setReadIds] = useState<string[]>([]);
  useBodyScrollLock(isOpen);

  const notifications = useMemo(() => buildCustomerNotifications({
    orders: userOrders,
    tickets: supportTickets,
    walletTransactions,
    sessions: activeSessions,
  }), [activeSessions, supportTickets, userOrders, walletTransactions]);

  useEffect(() => {
    if (!user) {
      setReadIds([]);
      return;
    }
    setReadIds(readNotificationReadIds(user.id));
  }, [user]);

  if (!isOpen) return null;

  const unreadNotifications = notifications.filter((notification) => !readIds.includes(notification.id));
  // Read notifications are intentionally not kept in the inbox. Their source events remain intact;
  // only the local inbox presentation is cleared for this account.
  const visibleNotifications = unreadNotifications;

  const persistReadIds = (nextIds: string[]) => {
    setReadIds(nextIds);
    if (user) writeNotificationReadIds(user.id, nextIds);
    window.dispatchEvent(new Event('noovinnet:notification-read-change'));
  };

  const handleMarkAllRead = () => {
    if (unreadNotifications.length === 0) return;
    persistReadIds(Array.from(new Set([...readIds, ...unreadNotifications.map((notification) => notification.id)])));
    showToast('همهٔ اعلان‌ها خوانده شدند و از فهرست پاک شدند.', 'success');
  };

  const handleItemClick = (notification: CustomerNotification) => {
    const wasUnread = !readIds.includes(notification.id);
    if (wasUnread) {
      persistReadIds([...readIds, notification.id]);
      showToast('پیام خوانده شد.', 'success');
    }
    onClose();
    openProfileTab(notification.actionTab);
  };

  return (
    <ModalPortal>
          <div className="ui-modal-backdrop p-0 sm:p-4 animate-in fade-in duration-200">
      <button type="button" className="fixed inset-0" onClick={onClose} aria-label="بستن اعلان‌ها" />
      <section className="ui-modal-panel relative z-10 flex h-[85dvh] w-full flex-col overflow-hidden rounded-t-3xl sm:h-[650px] sm:max-w-md sm:rounded-3xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-200" aria-label="اعلان‌های حساب کاربری">
        <header className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
          <div className="flex items-center gap-3">
            <button type="button" onClick={onClose} className="rounded-xl p-1.5 text-slate-500 transition hover:bg-slate-100" aria-label="بستن اعلان‌ها">
              <X className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-slate-900">اعلان‌ها</h2>
              {unreadNotifications.length > 0 && <span className="h-2 w-2 rounded-full bg-blue-600" aria-label={`${unreadNotifications.length} اعلان خوانده‌نشده`} />}
            </div>
          </div>
          {unreadNotifications.length > 0 && (
            <button type="button" onClick={handleMarkAllRead} className="flex items-center gap-1 rounded-xl p-2 text-xs font-bold text-slate-500 transition hover:bg-blue-50 hover:text-blue-600" title="خواندن و پاک‌کردن همهٔ اعلان‌ها">
              <CheckCheck className="h-4 w-4 text-blue-600" />
              <span className="hidden sm:inline">خواندن و پاک‌کردن همه</span>
            </button>
          )}
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {visibleNotifications.length === 0 ? (
            <div className="flex min-h-56 flex-col items-center justify-center px-6 text-center">
              <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-slate-100 text-slate-400"><Inbox className="h-7 w-7" /></span>
              <h3 className="text-sm font-extrabold text-slate-800">فهرست اعلان‌ها خالی است</h3>
              <p className="mt-2 text-xs leading-6 text-slate-500">اعلان‌های خوانده‌شده از این فهرست پاک شده‌اند. وقتی رویداد جدیدی در سفارش، تیکت، تراکنش یا نشست حساب ثبت شود، اینجا نمایش داده می‌شود.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {visibleNotifications.map((notification) => {
                const isRead = readIds.includes(notification.id);
                return (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => handleItemClick(notification)}
                    className={`relative flex w-full items-start gap-3.5 overflow-hidden rounded-2xl border p-4 text-right transition ${isRead ? 'border-slate-100 bg-white hover:border-slate-200' : 'border-blue-100 bg-blue-50/40 hover:border-blue-200'}`}
                  >
                    {!isRead && <span className="absolute bottom-0 right-0 top-0 w-1 bg-blue-600" />}
                    {getNotificationIcon(notification.type)}
                    <span className="min-w-0 flex-1 space-y-1">
                      <span className="flex items-center justify-between gap-3">
                        <strong className="truncate text-xs text-slate-900">{notification.title}</strong>
                        <span className="flex shrink-0 items-center gap-1.5 text-[10px] font-medium text-slate-400">
                          <span>{notification.time}</span>
                          <span className={isRead ? 'text-emerald-600' : 'text-blue-600'}>{isRead ? 'خوانده شد' : 'جدید'}</span>
                        </span>
                      </span>
                      <span className="block text-xs leading-relaxed text-slate-600">{notification.message}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>
      </div>
    </ModalPortal>
  );
};
