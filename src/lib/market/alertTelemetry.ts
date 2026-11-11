import { inferAssetAlertCurrency, type AlertCurrencyCode } from './alertForm';

export interface AlertRuleTelemetry {
  symbol: string;
  assetType: 'stock' | 'fund';
  lastCheckedAt?: string;
  observedPrice?: number | null;
  currency?: AlertCurrencyCode;
  priceStatus?: 'live' | 'deferred' | 'unavailable';
  deferralDescription?: string;
  lastTriggeredAt?: string;
  lastTriggeredPrice?: number;
  lastTriggeredTitle?: string;
}

export type AlertTelemetryMap = Record<string, AlertRuleTelemetry>;

export const ALERT_TELEMETRY_UPDATED_EVENT = 'stockmind:alert-telemetry-updated';

export function buildAlertTelemetryKey(assetType: 'stock' | 'fund', symbol: string): string {
  return `${assetType}:${symbol.trim().toUpperCase()}`;
}

export function getAlertTelemetryStorageKey(userId?: string | null): string {
  if (userId && userId !== 'guest') {
    return `stockmind_alert_telemetry_user_${userId}`;
  }
  return 'stockmind_alert_telemetry_guest';
}

function resolveStorage(storage?: Storage): Storage | null {
  if (storage) return storage;
  if (typeof window !== 'undefined') {
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  }
  return null;
}

export function loadAlertTelemetryMap(
  userId?: string | null,
  storage?: Storage,
): AlertTelemetryMap {
  const store = resolveStorage(storage);
  if (!store) return {};
  try {
    const raw = store.getItem(getAlertTelemetryStorageKey(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as AlertTelemetryMap;
  } catch {
    return {};
  }
}

function saveAlertTelemetryMap(
  userId: string | null | undefined,
  map: AlertTelemetryMap,
  storage?: Storage,
): AlertTelemetryMap {
  const store = resolveStorage(storage);
  if (store) {
    try {
      store.setItem(getAlertTelemetryStorageKey(userId), JSON.stringify(map));
    } catch {
      // Ignore quota errors
    }
  }
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    try {
      window.dispatchEvent(new CustomEvent(ALERT_TELEMETRY_UPDATED_EVENT));
    } catch {
      // Ignore dispatch errors in non-DOM test environments
    }
  }
  return map;
}

export function recordAlertCheck(
  params: {
    userId?: string | null;
    symbol: string;
    assetType: 'stock' | 'fund';
    checkedAt: string;
    observedPrice: number | null;
    currency?: AlertCurrencyCode;
    priceStatus: 'live' | 'deferred' | 'unavailable';
    deferralDescription?: string;
    exchange?: string;
  },
  storage?: Storage,
): AlertTelemetryMap {
  const sym = params.symbol.trim().toUpperCase();
  const key = buildAlertTelemetryKey(params.assetType, sym);
  const current = loadAlertTelemetryMap(params.userId, storage);
  const existing = current[key];

  const validObserved =
    typeof params.observedPrice === 'number' && Number.isFinite(params.observedPrice) && params.observedPrice > 0
      ? params.observedPrice
      : null;

  const updatedEntry: AlertRuleTelemetry = {
    ...existing,
    symbol: sym,
    assetType: params.assetType,
    lastCheckedAt: params.checkedAt,
    observedPrice: validObserved,
    currency:
      params.currency ||
      existing?.currency ||
      inferAssetAlertCurrency({
        exchange: params.exchange,
        assetType: params.assetType,
        symbol: sym,
      }),
    priceStatus: params.priceStatus,
    ...(params.deferralDescription
      ? { deferralDescription: params.deferralDescription }
      : { deferralDescription: undefined }),
  };

  return saveAlertTelemetryMap(params.userId, { ...current, [key]: updatedEntry }, storage);
}

export function recordAlertTrigger(
  params: {
    userId?: string | null;
    symbol: string;
    assetType: 'stock' | 'fund';
    triggeredAt: string;
    triggeredPrice: number;
    triggeredTitle?: string;
    currency?: AlertCurrencyCode;
    exchange?: string;
  },
  storage?: Storage,
): AlertTelemetryMap {
  const sym = params.symbol.trim().toUpperCase();
  const key = buildAlertTelemetryKey(params.assetType, sym);
  const current = loadAlertTelemetryMap(params.userId, storage);
  const existing = current[key];

  const updatedEntry: AlertRuleTelemetry = {
    ...existing,
    symbol: sym,
    assetType: params.assetType,
    lastCheckedAt: params.triggeredAt,
    observedPrice: params.triggeredPrice,
    currency:
      params.currency ||
      existing?.currency ||
      inferAssetAlertCurrency({
        exchange: params.exchange,
        assetType: params.assetType,
        symbol: sym,
      }),
    priceStatus: 'live',
    deferralDescription: undefined,
    lastTriggeredAt: params.triggeredAt,
    lastTriggeredPrice: params.triggeredPrice,
    ...(params.triggeredTitle ? { lastTriggeredTitle: params.triggeredTitle } : {}),
  };

  return saveAlertTelemetryMap(params.userId, { ...current, [key]: updatedEntry }, storage);
}

export function clearAlertTelemetry(
  params: { userId?: string | null; symbol: string; assetType: 'stock' | 'fund' },
  storage?: Storage,
): AlertTelemetryMap {
  const key = buildAlertTelemetryKey(params.assetType, params.symbol);
  const current = loadAlertTelemetryMap(params.userId, storage);
  if (!(key in current)) return current;
  const next = { ...current };
  delete next[key];
  return saveAlertTelemetryMap(params.userId, next, storage);
}
