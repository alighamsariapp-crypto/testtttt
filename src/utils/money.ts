// Storefront money presentation: server totals remain integer IRR; this helper only renders their explicit currency safely.
export const currencyLabel = (currency?: string | null): string => {
  const normalized = String(currency || 'IRR').trim().toUpperCase();
  if (normalized === 'IRR') return 'ریال';
  if (normalized === 'TOMAN' || String(currency).trim() === 'تومان') return 'تومان';
  return String(currency || 'IRR').trim();
};

export const formatMoney = (amount?: number | null, currency?: string | null): string => {
  const numericAmount = Number(amount);
  const safeAmount = Number.isFinite(numericAmount) ? numericAmount : 0;
  return `${safeAmount.toLocaleString('fa-IR')} ${currencyLabel(currency)}`;
};
