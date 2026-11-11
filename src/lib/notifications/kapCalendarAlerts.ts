import { matchNewsAssetIdentity } from '@/lib/news/symbolMatch';

export interface TrackedAlertAsset {
  symbol: string;
  name?: string | null;
  exchange?: string | null;
  assetType?: 'stock' | 'fund';
}

export type KapCalendarEventType =
  | 'kap_disclosure'
  | 'earnings'
  | 'dividend'
  | 'macro_calendar';

export const KAP_CALENDAR_EVENT_META: Record<
  KapCalendarEventType,
  { label: string; description: string; defaultEnabled: boolean }
> = {
  kap_disclosure: {
    label: 'Resmî KAP & Düzenleyici Açıklamaları',
    description: 'KAP, SEC EDGAR ve SPK kaynaklı özel durum ve faaliyet açıklamaları.',
    defaultEnabled: true,
  },
  earnings: {
    label: 'Bilanço & Finansal Sonuç Takvimi',
    description: 'Takip edilen şirketlerin doğrulanmış bilanço açıklama tarihleri.',
    defaultEnabled: true,
  },
  dividend: {
    label: 'Temettü & Hak Kullanım Takvimi',
    description: 'İlanlı temettü, hak kullanım (ex-dividend) ve genel kurul tarihleri.',
    defaultEnabled: true,
  },
  macro_calendar: {
    label: 'Makroekonomi & Merkez Bankası Takvimi',
    description: 'TCMB, Fed (FOMC), ECB faiz kararları ve resmî enflasyon takvimi.',
    defaultEnabled: false,
  },
};

export interface KapCalendarSubscriptionPrefs {
  enabled: boolean;
  trackedSymbolsOnly: boolean;
  subscriptions: Record<KapCalendarEventType, boolean>;
}

export const DEFAULT_KAP_CALENDAR_PREFS: KapCalendarSubscriptionPrefs = {
  enabled: true,
  trackedSymbolsOnly: true,
  subscriptions: {
    kap_disclosure: KAP_CALENDAR_EVENT_META.kap_disclosure.defaultEnabled,
    earnings: KAP_CALENDAR_EVENT_META.earnings.defaultEnabled,
    dividend: KAP_CALENDAR_EVENT_META.dividend.defaultEnabled,
    macro_calendar: KAP_CALENDAR_EVENT_META.macro_calendar.defaultEnabled,
  },
};

export interface AuthorizedCalendarEventInput {
  id: string;
  eventType: KapCalendarEventType;
  title: string;
  summary?: string;
  sourceName: string;
  sourceUrl?: string;
  publishedAt: string;
  scheduledFor?: string;
  symbol?: string;
  assetType?: 'stock' | 'fund';
}

export interface KapCalendarAlertMatch {
  eventId: string;
  eventType: KapCalendarEventType;
  sourceName: string;
  sourceUrl?: string;
  matchedSymbol: string | null;
  matchedAssetType: 'stock' | 'fund';
  matchReason: string;
  title: string;
  body: string;
  route: string;
  occurredAt: string;
}

export interface KapCalendarEvaluationResult {
  triggered: KapCalendarAlertMatch[];
  rejectedUnauthorized: Array<{ id: string; sourceName: string; reason: string }>;
  skippedDisabledType: Array<{ id: string; eventType: KapCalendarEventType }>;
  skippedUnmatchedAsset: Array<{ id: string; title: string }>;
  skippedDuplicate: Array<{ id: string }>;
  updatedSeenIds: string[];
}

const PREFS_STORAGE_PREFIX = 'stockmind_kap_calendar_prefs';
const SEEN_STORAGE_PREFIX = 'stockmind_kap_calendar_seen';

const AUTHORIZED_DOMAINS = [
  'kap.org.tr',
  'sec.gov',
  'tcmb.gov.tr',
  'ecb.europa.eu',
  'federalreserve.gov',
  'spk.gov.tr',
  'borsaistanbul.com',
  'finance.yahoo.com',
];

const AUTHORIZED_SOURCE_NAMES = [
  'kap',
  'kamuyu aydinlatma platformu',
  'sec edgar',
  'sec',
  'tcmb',
  'federal reserve',
  'fed',
  'ecb',
  'spk',
  'borsa istanbul',
  'yahoo finance calendar',
  'yahoo finance',
];

function getPrefsKey(userId?: string | null): string {
  const id = typeof userId === 'string' && userId.trim() ? userId.trim() : 'guest';
  return `${PREFS_STORAGE_PREFIX}:${id}`;
}

function getSeenKey(userId?: string | null): string {
  const id = typeof userId === 'string' && userId.trim() ? userId.trim() : 'guest';
  return `${SEEN_STORAGE_PREFIX}:${id}`;
}

export function normalizeKapCalendarPrefs(
  raw: Partial<KapCalendarSubscriptionPrefs> | null | undefined,
): KapCalendarSubscriptionPrefs {
  const subs = raw?.subscriptions ?? ({} as Partial<Record<KapCalendarEventType, boolean>>);
  return {
    enabled:
      typeof raw?.enabled === 'boolean'
        ? raw.enabled
        : DEFAULT_KAP_CALENDAR_PREFS.enabled,
    trackedSymbolsOnly:
      typeof raw?.trackedSymbolsOnly === 'boolean'
        ? raw.trackedSymbolsOnly
        : DEFAULT_KAP_CALENDAR_PREFS.trackedSymbolsOnly,
    subscriptions: {
      kap_disclosure:
        typeof subs.kap_disclosure === 'boolean'
          ? subs.kap_disclosure
          : DEFAULT_KAP_CALENDAR_PREFS.subscriptions.kap_disclosure,
      earnings:
        typeof subs.earnings === 'boolean'
          ? subs.earnings
          : DEFAULT_KAP_CALENDAR_PREFS.subscriptions.earnings,
      dividend:
        typeof subs.dividend === 'boolean'
          ? subs.dividend
          : DEFAULT_KAP_CALENDAR_PREFS.subscriptions.dividend,
      macro_calendar:
        typeof subs.macro_calendar === 'boolean'
          ? subs.macro_calendar
          : DEFAULT_KAP_CALENDAR_PREFS.subscriptions.macro_calendar,
    },
  };
}

export function readKapCalendarSubscriptionPrefs(
  userId?: string | null,
  storage?: Pick<Storage, 'getItem'> | null,
): KapCalendarSubscriptionPrefs {
  const store =
    storage !== undefined
      ? storage
      : typeof window !== 'undefined'
        ? window.localStorage
        : null;
  if (!store) return normalizeKapCalendarPrefs(DEFAULT_KAP_CALENDAR_PREFS);
  try {
    const raw = store.getItem(getPrefsKey(userId));
    if (!raw) return normalizeKapCalendarPrefs(DEFAULT_KAP_CALENDAR_PREFS);
    return normalizeKapCalendarPrefs(JSON.parse(raw));
  } catch {
    return normalizeKapCalendarPrefs(DEFAULT_KAP_CALENDAR_PREFS);
  }
}

export function writeKapCalendarSubscriptionPrefs(
  prefs: KapCalendarSubscriptionPrefs,
  userId?: string | null,
  storage?: Pick<Storage, 'setItem'> | null,
): KapCalendarSubscriptionPrefs {
  const normalized = normalizeKapCalendarPrefs(prefs);
  const store =
    storage !== undefined
      ? storage
      : typeof window !== 'undefined'
        ? window.localStorage
        : null;
  if (store) {
    try {
      store.setItem(getPrefsKey(userId), JSON.stringify(normalized));
    } catch {
      /* ignore */
    }
  }
  return normalized;
}

export function readSeenKapCalendarIds(
  userId?: string | null,
  storage?: Pick<Storage, 'getItem'> | null,
): string[] {
  const store =
    storage !== undefined
      ? storage
      : typeof window !== 'undefined'
        ? window.localStorage
        : null;
  if (!store) return [];
  try {
    const raw = store.getItem(getSeenKey(userId));
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === 'string' && x.length > 0).slice(-200)
      : [];
  } catch {
    return [];
  }
}

export function writeSeenKapCalendarIds(
  ids: readonly string[],
  userId?: string | null,
  storage?: Pick<Storage, 'setItem'> | null,
): void {
  const store =
    storage !== undefined
      ? storage
      : typeof window !== 'undefined'
        ? window.localStorage
        : null;
  if (!store) return;
  try {
    store.setItem(getSeenKey(userId), JSON.stringify(Array.from(new Set(ids)).slice(-200)));
  } catch {
    /* ignore */
  }
}

function normalizeAsciiText(input: string): string {
  return input
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/Ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/Ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/Ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/Ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/Ç/g, 'c')
    .toLowerCase()
    .trim();
}

export function isAuthorizedCalendarSource(input: {
  eventType: KapCalendarEventType;
  sourceName: string;
  sourceUrl?: string;
}): { authorized: boolean; reason?: string } {
  const nameNorm = normalizeAsciiText(input.sourceName || '');
  const hasTrustedName = AUTHORIZED_SOURCE_NAMES.some(
    (allowed) => nameNorm === allowed || nameNorm.includes(allowed),
  );

  let hasTrustedUrl = false;
  if (input.sourceUrl && typeof input.sourceUrl === 'string') {
    const trimmed = input.sourceUrl.trim();
    if (typeof URL === 'function') {
      try {
        const parsed = new URL(trimmed);
        if (parsed.protocol === 'https:') {
          const host = parsed.hostname.toLowerCase();
          hasTrustedUrl = AUTHORIZED_DOMAINS.some(
            (domain) => host === domain || host.endsWith(`.${domain}`),
          );
        }
      } catch {
        hasTrustedUrl = false;
      }
    } else if (trimmed.startsWith('https://')) {
      const lower = trimmed.toLowerCase();
      hasTrustedUrl = AUTHORIZED_DOMAINS.some((domain) => lower.includes(domain));
    }
  }

  // Official KAP & macro central bank alerts require either a verified source URL domain
  // OR an exact institutional source (for feed items without direct link) AND never general blogs
  if (input.sourceUrl && !hasTrustedUrl) {
    return {
      authorized: false,
      reason: 'untrusted-source-domain',
    };
  }
  if (!hasTrustedName && !hasTrustedUrl) {
    return {
      authorized: false,
      reason: 'unverified-source-identity',
    };
  }
  if (input.eventType === 'kap_disclosure') {
    const isRegulator =
      nameNorm.includes('kap') ||
      nameNorm.includes('kamuyu') ||
      nameNorm.includes('sec') ||
      nameNorm.includes('spk') ||
      nameNorm.includes('borsa istanbul') ||
      Boolean(input.sourceUrl && /kap\.org\.tr|sec\.gov|spk\.gov\.tr/i.test(input.sourceUrl));
    if (!isRegulator) {
      return {
        authorized: false,
        reason: 'not-official-disclosure-source',
      };
    }
  }

  return { authorized: true };
}

export function evaluateKapCalendarAlerts(input: {
  prefs: KapCalendarSubscriptionPrefs;
  events: readonly AuthorizedCalendarEventInput[];
  trackedAssets: readonly TrackedAlertAsset[];
  seenIds?: readonly string[];
}): KapCalendarEvaluationResult {
  const prefs = normalizeKapCalendarPrefs(input.prefs);
  const seenSet = new Set(input.seenIds ?? []);
  const triggered: KapCalendarAlertMatch[] = [];
  const rejectedUnauthorized: Array<{ id: string; sourceName: string; reason: string }> = [];
  const skippedDisabledType: Array<{ id: string; eventType: KapCalendarEventType }> = [];
  const skippedUnmatchedAsset: Array<{ id: string; title: string }> = [];
  const skippedDuplicate: Array<{ id: string }> = [];

  for (const ev of input.events) {
    const auth = isAuthorizedCalendarSource({
      eventType: ev.eventType,
      sourceName: ev.sourceName,
      sourceUrl: ev.sourceUrl,
    });
    if (!auth.authorized) {
      rejectedUnauthorized.push({
        id: ev.id,
        sourceName: ev.sourceName,
        reason: auth.reason || 'unauthorized-source',
      });
      continue;
    }

    if (!prefs.enabled || !prefs.subscriptions[ev.eventType]) {
      skippedDisabledType.push({ id: ev.id, eventType: ev.eventType });
      continue;
    }

    if (seenSet.has(ev.id)) {
      skippedDuplicate.push({ id: ev.id });
      continue;
    }

    let matchedAsset: TrackedAlertAsset | null = null;
    let matchReason = '';

    if (ev.symbol) {
      const targetUpper = ev.symbol.toUpperCase();
      const targetBase = targetUpper.replace(/\.IS$/i, '');
      matchedAsset =
        input.trackedAssets.find((asset) => {
          const symUpper = asset.symbol.toUpperCase();
          return symUpper === targetUpper || symUpper.replace(/\.IS$/i, '') === targetBase;
        }) ?? null;
      if (matchedAsset) {
        matchReason = `${matchedAsset.symbol} doğrudan olay sembolü eşleşmesi`;
      }
    }

    if (!matchedAsset && ev.eventType !== 'macro_calendar') {
      const text = `${ev.title} ${ev.summary || ''}`;
      for (const candidate of input.trackedAssets) {
        const res = matchNewsAssetIdentity(text, candidate, { source: ev.sourceName });
        if (res.matched) {
          matchedAsset = candidate;
          matchReason = `${candidate.symbol} (${res.matchedBy || 'kimlik'}) varlık eşleşmesi`;
          break;
        }
      }
    }

    if (ev.eventType !== 'macro_calendar') {
      if (prefs.trackedSymbolsOnly && !matchedAsset) {
        skippedUnmatchedAsset.push({ id: ev.id, title: ev.title });
        continue;
      }
    }

    const resolvedSymbol = matchedAsset?.symbol ?? (ev.symbol ? ev.symbol.toUpperCase() : null);
    const resolvedAssetType = matchedAsset?.assetType ?? ev.assetType ?? 'stock';
    const route = resolvedSymbol
      ? resolvedAssetType === 'fund'
        ? `/funds/${encodeURIComponent(resolvedSymbol)}`
        : `/stocks/${encodeURIComponent(resolvedSymbol)}`
      : '/news';

    const typeMeta = KAP_CALENDAR_EVENT_META[ev.eventType];
    const prefix = resolvedSymbol ? `${resolvedSymbol} · ${typeMeta.label}` : typeMeta.label;
    triggered.push({
      eventId: ev.id,
      eventType: ev.eventType,
      sourceName: ev.sourceName,
      sourceUrl: ev.sourceUrl,
      matchedSymbol: resolvedSymbol,
      matchedAssetType: resolvedAssetType,
      matchReason:
        matchReason ||
        (ev.eventType === 'macro_calendar'
          ? 'Makroekonomi takvimi aboneliği'
          : 'Yetkili kaynak olayı'),
      title: prefix,
      body: `${ev.title} (${ev.sourceName})`,
      route,
      occurredAt: ev.scheduledFor || ev.publishedAt,
    });
    seenSet.add(ev.id);
  }

  return {
    triggered,
    rejectedUnauthorized,
    skippedDisabledType,
    skippedUnmatchedAsset,
    skippedDuplicate,
    updatedSeenIds: Array.from(seenSet).slice(-200),
  };
}
