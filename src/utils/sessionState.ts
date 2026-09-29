export const SESSION_STATE_KEYS = {
  checkoutStep: 'noovinnet.resume.checkout-step.v1',
  checkoutSelectedAddress: 'noovinnet.resume.checkout-selected-address.v1',
  checkoutPaymentMethod: 'noovinnet.resume.checkout-payment-method.v1',
  profileSubTab: 'noovinnet.resume.profile-sub-tab.v1',
  adminSubTab: 'noovinnet.resume.admin-sub-tab.v1',
  legacyCheckoutDraft: 'noovinnet.draft.legacy-checkout.v1',
  addressDraftPrefix: 'noovinnet.draft.address.v1',
  addressModalResume: 'noovinnet.resume.address-modal.v1',
  supportResume: 'noovinnet.resume.support.v1',
  newTicketDraft: 'noovinnet.draft.new-ticket.v1',
} as const;

export const readSessionState = <T>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') return fallback;

  try {
    const rawValue = window.sessionStorage.getItem(key);
    return rawValue ? (JSON.parse(rawValue) as T) : fallback;
  } catch {
    return fallback;
  }
};

export const writeSessionState = <T>(key: string, value: T): void => {
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Session storage is an optional convenience. A blocked browser must not break checkout.
  }
};

export const clearSessionState = (key: string): void => {
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // See writeSessionState: restore behavior must never block the active flow.
  }
};

export const clearSessionStateByPrefix = (prefix: string): void => {
  if (typeof window === 'undefined') return;

  try {
    const keysToRemove = Array.from({ length: window.sessionStorage.length }, (_, index) => window.sessionStorage.key(index))
      .filter((key): key is string => Boolean(key && key.startsWith(prefix)));
    keysToRemove.forEach((key) => window.sessionStorage.removeItem(key));
  } catch {
    // See writeSessionState: restore behavior must never block the active flow.
  }
};
