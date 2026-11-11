import type { MarketPriceObservation } from '@/types/stock';
import type { PriceAlertType } from '@/store/useWatchlistStore';
import { classifyPriceStatus, type PriceStatusInfo, type PriceStatusKind } from '@/lib/market/priceStatus';

export type AlertDeferralReason =
  | 'ok'
  | 'missing-quote'
  | 'invalid-price'
  | 'missing-source'
  | 'missing-timestamp'
  | 'last-known-fallback'
  | 'stale-price';

export interface AlertPriceQuote {
  price?: number | null;
  observation?: MarketPriceObservation | null;
  exchange?: string | null;
  isLastKnown?: boolean;
  assetType?: 'stock' | 'fund';
  source?: string | null;
  lastSyncAt?: string | null;
  navDate?: string | null;
}

export interface AlertFreshnessResult {
  eligible: boolean;
  reason: AlertDeferralReason;
  status: PriceStatusKind;
  description: string;
  source: string | null;
  observedAt: string | null;
  statusInfo: PriceStatusInfo;
}

export interface DeferredAlertRecord {
  symbol: string;
  assetType: 'stock' | 'fund';
  alertType: PriceAlertType;
  targetPrice?: number;
  alertPercent?: number;
  reason: Exclude<AlertDeferralReason, 'ok'>;
  description: string;
  status: PriceStatusKind;
  source: string | null;
  observedAt: string | null;
  deferredAt: string;
}

const DEFERRED_ALERTS_KEY = 'stockmind_deferred_alerts';
const MAX_DEFERRED_RECORDS = 50;
const DISALLOWED_SOURCES = new Set(['fallback', 'placeholder', 'mock', 'seed', 'unknown']);

function normalizeQuoteObservation(quote: AlertPriceQuote): MarketPriceObservation | null {
  if (quote.observation) {
    return quote.observation;
  }
  const hasTimestamp = Boolean(quote.lastSyncAt || quote.navDate);
  const source = quote.source || (quote.assetType === 'fund' ? 'TEFAS' : null);
  if (source && hasTimestamp) {
    return {
      source,
      asOf: quote.navDate ?? null,
      fetchedAt: quote.lastSyncAt || '',
      changePercent: null,
    };
  }
  return null;
}

/**
 * Evaluates whether a market quote passes source and freshness checks before firing a price alert.
 * Missing, unverified-source, last-known fallback, or stale quotes defer the alert with an explicit reason.
 */
export function evaluateAlertPriceFreshness(
  quote: AlertPriceQuote | null | undefined,
  now: Date = new Date()
): AlertFreshnessResult {
  if (!quote) {
    const statusInfo = classifyPriceStatus({ price: null, observation: null, now });
    return {
      eligible: false,
      reason: 'missing-quote',
      status: 'missing',
      description: 'Sağlayıcıdan aktif fiyat verisi alınamadı; alarm ertelendi.',
      source: null,
      observedAt: null,
      statusInfo,
    };
  }

  const observation = normalizeQuoteObservation(quote);
  const exchange = quote.exchange || (quote.assetType === 'fund' ? 'TEFAS' : undefined);
  const statusInfo = classifyPriceStatus({
    price: quote.price,
    observation,
    exchange,
    isLastKnown: quote.isLastKnown,
    now,
  });

  if (typeof quote.price !== 'number' || !Number.isFinite(quote.price) || quote.price <= 0) {
    return {
      eligible: false,
      reason: 'invalid-price',
      status: 'missing',
      description: 'Geçerli pozitif fiyat bulunamadı; alarm ertelendi.',
      source: statusInfo.source,
      observedAt: statusInfo.observedAt,
      statusInfo,
    };
  }

  const source = observation?.source?.trim() || null;
  if (!source || DISALLOWED_SOURCES.has(source.toLowerCase())) {
    return {
      eligible: false,
      reason: 'missing-source',
      status: statusInfo.status,
      description: 'Fiyat kaynağı doğrulanamadığı için alarm ertelendi.',
      source,
      observedAt: statusInfo.observedAt,
      statusInfo,
    };
  }

  if (!observation?.asOf && !observation?.fetchedAt) {
    return {
      eligible: false,
      reason: 'missing-timestamp',
      status: statusInfo.status,
      description: 'Fiyat gözlem zamanı eksik olduğu için alarm ertelendi.',
      source,
      observedAt: null,
      statusInfo,
    };
  }

  if (quote.isLastKnown) {
    return {
      eligible: false,
      reason: 'last-known-fallback',
      status: 'stale',
      description: 'Yalnızca son doğrulanan önbellek fiyatı bulunduğu için alarm ertelendi.',
      source,
      observedAt: statusInfo.observedAt,
      statusInfo,
    };
  }

  if (statusInfo.status === 'missing') {
    return {
      eligible: false,
      reason: 'invalid-price',
      status: statusInfo.status,
      description: statusInfo.description,
      source,
      observedAt: statusInfo.observedAt,
      statusInfo,
    };
  }

  if (statusInfo.status === 'stale') {
    return {
      eligible: false,
      reason: 'stale-price',
      status: 'stale',
      description: `${statusInfo.description} Alarm taze veri gelene kadar ertelendi.`,
      source,
      observedAt: statusInfo.observedAt,
      statusInfo,
    };
  }

  return {
    eligible: true,
    reason: 'ok',
    status: statusInfo.status,
    description: statusInfo.description,
    source,
    observedAt: statusInfo.observedAt,
    statusInfo,
  };
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

export function loadDeferredAlerts(storage?: Storage): DeferredAlertRecord[] {
  const store = resolveStorage(storage);
  if (!store) return [];
  try {
    const raw = store.getItem(DEFERRED_ALERTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function recordDeferredAlert(
  record: DeferredAlertRecord,
  storage?: Storage
): DeferredAlertRecord[] {
  const existing = loadDeferredAlerts(storage).filter(
    (entry) =>
      !(entry.symbol.toUpperCase() === record.symbol.toUpperCase() && entry.assetType === record.assetType)
  );
  const next = [record, ...existing].slice(0, MAX_DEFERRED_RECORDS);
  const store = resolveStorage(storage);
  if (store) {
    try {
      store.setItem(DEFERRED_ALERTS_KEY, JSON.stringify(next));
    } catch {
      /* ignore quota errors */
    }
  }
  return next;
}

export function clearDeferredAlert(
  symbol: string,
  assetType: 'stock' | 'fund',
  storage?: Storage
): DeferredAlertRecord[] {
  const existing = loadDeferredAlerts(storage);
  const sym = symbol.toUpperCase();
  const next = existing.filter(
    (entry) => !(entry.symbol.toUpperCase() === sym && entry.assetType === assetType)
  );
  if (next.length !== existing.length) {
    const store = resolveStorage(storage);
    if (store) {
      try {
        store.setItem(DEFERRED_ALERTS_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
    }
  }
  return next;
}
