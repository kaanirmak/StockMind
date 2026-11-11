export type UsageEventName =
  | 'first_transaction_completed'
  | 'import_completed'
  | 'alert_configured'
  | 'repeat_usage_day';

export type RowCountBucket = '1' | '2-10' | '11-50' | '51+';

export interface SafeUsageMeta {
  assetType?: 'stock' | 'fund';
  transactionType?: 'buy' | 'sell' | 'dividend' | 'split';
  mode?: 'manual' | 'import' | 'replace' | 'append' | 'guest' | 'authenticated';
  alertKind?: 'price' | 'percent_up' | 'percent_down' | 'percent_both';
  fileFormat?: 'xlsx' | 'xls' | 'csv' | 'broker_template';
  rowCountBucket?: RowCountBucket;
  activeDayCount?: number;
  isGuest?: boolean;
}

export interface SanitizedUsageEvent {
  event: UsageEventName;
  meta: SafeUsageMeta;
  occurredAt: string;
}

export interface UsageMetricsSummary {
  totalEvents: number;
  counts: Record<UsageEventName, number>;
  recentEvents: SanitizedUsageEvent[];
  updatedAt: string | null;
}

const VALID_EVENTS = new Set<UsageEventName>([
  'first_transaction_completed',
  'import_completed',
  'alert_configured',
  'repeat_usage_day',
]);

const FORBIDDEN_KEY_PATTERN =
  /amount|tutar|price|fiyat|quantity|adet|lot|total|cost|value|balance|cash|pnl|profit|loss|equity|net|worth|target|base|symbol|email|user|name|note|portfolio/i;

const ACTIVE_DAYS_STORAGE_KEY = 'stockmind_usage_active_days_v1';
const REPEAT_SENT_DAY_KEY = 'stockmind_usage_repeat_sent_day_v1';
const FIRST_TX_RECORDED_KEY = 'stockmind_usage_first_tx_done_v1';
const MAX_STORED_EVENTS = 200;

function getUsageStore(): SanitizedUsageEvent[] {
  const g = globalThis as typeof globalThis & { __stockmindUsageEvents?: SanitizedUsageEvent[] };
  if (!g.__stockmindUsageEvents) {
    g.__stockmindUsageEvents = [];
  }
  return g.__stockmindUsageEvents;
}

export function clearUsageMetrics(): void {
  const store = getUsageStore();
  store.length = 0;
}

export function bucketImportedRowCount(count: number): RowCountBucket {
  if (count <= 1) return '1';
  if (count <= 10) return '2-10';
  if (count <= 50) return '11-50';
  return '51+';
}

/**
 * Strips any financial amounts, portfolio values, asset quantities, target prices, symbols, or PII
 * so analytics payloads never carry private portfolio data.
 */
export function stripPrivateFinancialProps(rawMeta: unknown): SafeUsageMeta {
  if (!rawMeta || typeof rawMeta !== 'object' || Array.isArray(rawMeta)) {
    return {};
  }
  const source = rawMeta as Record<string, unknown>;
  const safe: SafeUsageMeta = {};

  for (const [key, value] of Object.entries(source)) {
    if (FORBIDDEN_KEY_PATTERN.test(key)) continue;

    if (key === 'assetType' && (value === 'stock' || value === 'fund')) {
      safe.assetType = value;
    } else if (
      key === 'transactionType' &&
      (value === 'buy' || value === 'sell' || value === 'dividend' || value === 'split')
    ) {
      safe.transactionType = value;
    } else if (
      key === 'mode' &&
      (value === 'manual' ||
        value === 'import' ||
        value === 'replace' ||
        value === 'append' ||
        value === 'guest' ||
        value === 'authenticated')
    ) {
      safe.mode = value;
    } else if (
      key === 'alertKind' &&
      (value === 'price' || value === 'percent_up' || value === 'percent_down' || value === 'percent_both')
    ) {
      safe.alertKind = value;
    } else if (
      key === 'fileFormat' &&
      (value === 'xlsx' || value === 'xls' || value === 'csv' || value === 'broker_template')
    ) {
      safe.fileFormat = value;
    } else if (
      key === 'rowCountBucket' &&
      (value === '1' || value === '2-10' || value === '11-50' || value === '51+')
    ) {
      safe.rowCountBucket = value;
    } else if (
      key === 'activeDayCount' &&
      typeof value === 'number' &&
      Number.isInteger(value) &&
      value >= 1 &&
      value <= 3650
    ) {
      safe.activeDayCount = value;
    } else if (key === 'isGuest' && typeof value === 'boolean') {
      safe.isGuest = value;
    }
  }

  return safe;
}

export function sanitizeUsageEventPayload(raw: unknown): SanitizedUsageEvent | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const event = record.event as UsageEventName;
  if (!VALID_EVENTS.has(event)) return null;

  return {
    event,
    meta: stripPrivateFinancialProps(record.meta),
    occurredAt:
      typeof record.occurredAt === 'string' && Number.isFinite(Date.parse(record.occurredAt))
        ? new Date(record.occurredAt).toISOString()
        : new Date().toISOString(),
  };
}

export function recordServerUsageEvent(raw: unknown): SanitizedUsageEvent | null {
  const clean = sanitizeUsageEventPayload(raw);
  if (!clean) return null;
  const store = getUsageStore();
  store.push(clean);
  if (store.length > MAX_STORED_EVENTS) {
    store.splice(0, store.length - MAX_STORED_EVENTS);
  }
  return clean;
}

export function getUsageMetricsSummary(): UsageMetricsSummary {
  const store = getUsageStore();
  const counts: Record<UsageEventName, number> = {
    first_transaction_completed: 0,
    import_completed: 0,
    alert_configured: 0,
    repeat_usage_day: 0,
  };

  for (const item of store) {
    counts[item.event] += 1;
  }

  return {
    totalEvents: store.length,
    counts,
    recentEvents: store.slice(-20).map((e) => ({ ...e, meta: { ...e.meta } })),
    updatedAt: store.length > 0 ? store[store.length - 1].occurredAt : null,
  };
}

export function trackUsageEvent(
  event: UsageEventName,
  rawMeta?: Record<string, unknown>,
  now: Date = new Date()
): SanitizedUsageEvent | null {
  const clean = sanitizeUsageEventPayload({
    event,
    meta: rawMeta,
    occurredAt: now.toISOString(),
  });
  if (!clean) return null;

  // Deduplicate first transaction completion per browser profile
  if (event === 'first_transaction_completed' && typeof window !== 'undefined') {
    try {
      if (window.localStorage.getItem(FIRST_TX_RECORDED_KEY) === '1') {
        return null;
      }
      window.localStorage.setItem(FIRST_TX_RECORDED_KEY, '1');
    } catch {
      // Ignore storage access failures
    }
  }

  recordServerUsageEvent(clean);

  if (typeof window !== 'undefined') {
    const body = JSON.stringify(clean);
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        navigator.sendBeacon('/api/ops/usage-metrics', new Blob([body], { type: 'application/json' }));
        return clean;
      }
    } catch {
      // Fall back to keepalive fetch
    }
    if (typeof fetch === 'function') {
      void fetch('/api/ops/usage-metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  }

  return clean;
}

/**
 * Tracks distinct Istanbul calendar days of app usage locally and fires `repeat_usage_day`
 * once per new return day starting from day 2.
 */
export function trackRepeatActiveDay(now: Date = new Date()): SanitizedUsageEvent | null {
  if (typeof window === 'undefined') return null;
  try {
    const dayKey = now.toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });
    const raw = window.localStorage.getItem(ACTIVE_DAYS_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    const days = new Set<string>(Array.isArray(parsed) ? parsed.filter((d): d is string => typeof d === 'string') : []);
    days.add(dayKey);

    const bounded = Array.from(days).sort().slice(-90);
    window.localStorage.setItem(ACTIVE_DAYS_STORAGE_KEY, JSON.stringify(bounded));

    if (bounded.length < 2) return null;
    if (window.localStorage.getItem(REPEAT_SENT_DAY_KEY) === dayKey) return null;

    window.localStorage.setItem(REPEAT_SENT_DAY_KEY, dayKey);
    return trackUsageEvent('repeat_usage_day', { activeDayCount: bounded.length }, now);
  } catch {
    return null;
  }
}
