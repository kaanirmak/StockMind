import { formatCurrency, formatSignedCurrency } from '@/lib/utils/format';

export const PRIVACY_STORAGE_KEY = 'stockmind_privacy_mode';
export const PRIVACY_EVENT = 'stockmind:privacy';
export const PRIVACY_MASK = '••••••';

export function readPrivacyMode(
  storage?: Pick<Storage, 'getItem'> | null
): boolean {
  const store = storage !== undefined
    ? storage
    : typeof window !== 'undefined'
    ? window.localStorage
    : null;
  if (!store) return false;
  try {
    return store.getItem(PRIVACY_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function writePrivacyMode(
  enabled: boolean,
  storage?: Pick<Storage, 'setItem'> | null,
  eventTarget?: Pick<Window, 'dispatchEvent'> | null
): boolean {
  const next = Boolean(enabled);
  const store = storage !== undefined
    ? storage
    : typeof window !== 'undefined'
    ? window.localStorage
    : null;
  if (store) {
    try {
      store.setItem(PRIVACY_STORAGE_KEY, String(next));
    } catch {
      // Ignore storage quota / private mode failures
    }
  }

  const target = eventTarget !== undefined
    ? eventTarget
    : typeof window !== 'undefined'
    ? window
    : null;
  if (target) {
    try {
      const ev = typeof CustomEvent !== 'undefined'
        ? new CustomEvent(PRIVACY_EVENT, { detail: { enabled: next } })
        : ({ type: PRIVACY_EVENT, detail: { enabled: next } } as unknown as Event);
      target.dispatchEvent(ev);
    } catch {
      // Ignore synthetic dispatch failures
    }
  }
  return next;
}

export function maskDisplayValue(
  visibleValue: string,
  isPrivacyMode: boolean,
  mask: string = PRIVACY_MASK
): string {
  return isPrivacyMode ? mask : visibleValue;
}

export function maskCurrencyValue(
  amount: number,
  currency: 'TRY' | 'USD' | 'EUR' = 'TRY',
  isPrivacyMode: boolean,
  options?: { signed?: boolean; decimals?: number }
): string {
  const symbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '₺';
  if (isPrivacyMode) {
    return `${symbol}••••`;
  }
  if (options?.signed) {
    return formatSignedCurrency(amount, currency);
  }
  return formatCurrency(amount, currency);
}
