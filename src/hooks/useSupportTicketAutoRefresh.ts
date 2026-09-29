import { useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';

const SUPPORT_TICKET_REFRESH_INTERVAL_MS = 12_000;

export const useSupportTicketAutoRefresh = (enabled: boolean) => {
  const { refreshSupportTickets } = useApp();
  const isRefreshing = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const refresh = async () => {
      if (document.visibilityState !== 'visible' || isRefreshing.current) return;

      isRefreshing.current = true;
      try {
        await refreshSupportTickets();
      } finally {
        isRefreshing.current = false;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') void refresh();
    };

    void refresh();
    const intervalId = window.setInterval(() => void refresh(), SUPPORT_TICKET_REFRESH_INTERVAL_MS);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, refreshSupportTickets]);
};
