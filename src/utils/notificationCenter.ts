import { ActiveSession, SupportTicket, UserOrder, WalletTransaction } from '../types';

export type CustomerNotificationType = 'order' | 'support' | 'wallet' | 'security';

export interface CustomerNotification {
  id: string;
  title: string;
  message: string;
  time: string;
  type: CustomerNotificationType;
  actionTab: 'orders' | 'support' | 'wallet' | 'security';
}

const PAYMENT_COMPLETE_STATUSES = new Set(['paid', 'successful', 'completed']);

const buildOrderNotification = (order: UserOrder): CustomerNotification => ({
  id: `order:${order.id}:${order.status}`,
  title: `وضعیت سفارش ${order.order_number}`,
  message: order.status_label || 'وضعیت سفارش شما به‌روزرسانی شده است.',
  time: order.date,
  type: 'order',
  actionTab: 'orders',
});

const buildSupportNotification = (ticket: SupportTicket): CustomerNotification | null => {
  const hasSupportReply = ticket.messages?.some((message) => message.sender === 'support');
  if (!hasSupportReply && ticket.status !== 'answered') return null;

  return {
    id: `ticket:${ticket.id}:${ticket.status}:${ticket.last_update}`,
    title: `پاسخ پشتیبانی به تیکت ${ticket.ticket_number}`,
    message: ticket.status_label || ticket.title,
    time: ticket.last_update,
    type: 'support',
    actionTab: 'support',
  };
};

const buildWalletNotification = (transaction: WalletTransaction): CustomerNotification | null => {
  if (!PAYMENT_COMPLETE_STATUSES.has(transaction.status)) return null;

  return {
    id: `wallet:${transaction.id}:${transaction.status}`,
    title: transaction.type === 'refund' ? 'بازگشت وجه کیف پول' : 'تراکنش کیف پول',
    message: transaction.description || 'تراکنش کیف پول شما با موفقیت ثبت شد.',
    time: transaction.date,
    type: 'wallet',
    actionTab: 'wallet',
  };
};

const buildSessionNotification = (session: ActiveSession): CustomerNotification | null => {
  if (session.is_current) return null;

  return {
    id: `session:${session.id}:${session.last_active}`,
    title: 'نشست فعال دیگر',
    message: `${session.browser || 'مرورگر'} روی ${session.device || 'دستگاه'}${session.location ? ` در ${session.location}` : ''} فعال است.`,
    time: session.last_active,
    type: 'security',
    actionTab: 'security',
  };
};

export const buildCustomerNotifications = ({
  orders,
  tickets,
  walletTransactions,
  sessions,
}: {
  orders: UserOrder[];
  tickets: SupportTicket[];
  walletTransactions: WalletTransaction[];
  sessions: ActiveSession[];
}): CustomerNotification[] => {
  const notifications = [
    ...orders.map(buildOrderNotification),
    ...tickets.map(buildSupportNotification).filter((item): item is CustomerNotification => item !== null),
    ...walletTransactions.map(buildWalletNotification).filter((item): item is CustomerNotification => item !== null),
    ...sessions.map(buildSessionNotification).filter((item): item is CustomerNotification => item !== null),
  ];

  return notifications.slice(0, 20);
};

export const notificationReadStorageKey = (userId: number | string) => `noovinnet_notification_reads:${userId}`;

export const readNotificationReadIds = (userId: number | string): string[] => {
  try {
    const raw = window.localStorage.getItem(notificationReadStorageKey(userId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
};

export const writeNotificationReadIds = (userId: number | string, ids: string[]) => {
  try {
    window.localStorage.setItem(notificationReadStorageKey(userId), JSON.stringify(ids.slice(-100)));
  } catch {
    // A full or unavailable localStorage must not block account navigation.
  }
};
