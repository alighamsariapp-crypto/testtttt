const localizedDigits: Record<string, string> = {
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
  '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
};

export const normalizeIranianMobile = (value: string): string => {
  const latinDigits = value.replace(/[۰-۹٠-٩]/g, (digit) => localizedDigits[digit] || digit);
  const compact = latinDigits.trim().replace(/[\s()-]/g, '');
  const digits = compact.replace(/[^\d+]/g, '');

  if (digits.startsWith('+98')) return `0${digits.slice(3)}`;
  if (digits.startsWith('0098')) return `0${digits.slice(4)}`;
  if (digits.startsWith('98')) return `0${digits.slice(2)}`;
  if (digits.startsWith('9') && digits.length === 10) return `0${digits}`;
  return digits;
};

export const isIranianMobile = (value: string): boolean => /^09\d{9}$/.test(normalizeIranianMobile(value));

export const tryNormalizeIranianMobile = (value: unknown): string | null => {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const str = String(value).trim();
  if (!str) return null;
  const normalized = normalizeIranianMobile(str);
  return /^09\d{9}$/.test(normalized) ? normalized : null;
};

export const redactPhone = (phone: unknown): string => {
  if (!phone) return '***';
  const raw = String(phone);
  const clean = tryNormalizeIranianMobile(raw) || raw.replace(/\D+/g, '');
  if (clean.length < 8) return '***';
  return clean.slice(0, 4) + '****' + clean.slice(-2);
};

