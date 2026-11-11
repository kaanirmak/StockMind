export type UpcomingEventType = 'earnings' | 'ex_dividend' | 'dividend' | 'disclosure';

export interface UpcomingEventItem {
  id: string;
  symbol: string;
  type: UpcomingEventType;
  typeLabel: string;
  title: string;
  eventDate: string; // YYYY-MM-DD (UTC)
  source: string;
  sourceUrl?: string | null;
  verified: boolean;
  details?: string | null;
}

export interface YahooCalendarEventsPayload {
  earnings?: {
    earningsDate?: Array<{ raw?: number; fmt?: string }>;
  };
  exDividendDate?: { raw?: number; fmt?: string };
  dividendDate?: { raw?: number; fmt?: string };
}

export interface ExternalDisclosureInput {
  id?: string;
  title?: string;
  date?: string;
  source?: string;
  sourceUrl?: string | null;
  type?: UpcomingEventType;
  details?: string | null;
  verified?: boolean;
}

export interface UpcomingEventsReport {
  symbol: string;
  status: 'ok' | 'empty' | 'unavailable';
  events: UpcomingEventItem[];
  checkedAt: string;
  notice?: string | null;
}

const EVENT_TYPE_LABELS: Record<UpcomingEventType, string> = {
  earnings: 'Bilanço',
  ex_dividend: 'Temettü Hak Ediş',
  dividend: 'Temettü Ödeme',
  disclosure: 'Resmi Duyuru',
};

const MAX_LOOKAHEAD_DAYS = 365;

export function resolveEquityYahooTicker(symbol: string, exchange?: string | null): string {
  const clean = symbol.trim().toUpperCase();
  if (!clean) return '';
  if (clean.includes('.') || clean.includes('=') || clean.includes('-') || clean.startsWith('^')) {
    return clean;
  }
  const ex = (exchange || '').trim().toUpperCase();
  if (ex === 'BIST') {
    return `${clean}.IS`;
  }
  return clean;
}

export function normalizeEventIsoDate(
  rawValue: number | string | null | undefined
): string | null {
  if (rawValue === null || rawValue === undefined || rawValue === '') return null;

  if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
    const ms = rawValue > 1e12 ? rawValue : rawValue * 1000;
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  }

  const trimmed = String(rawValue).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const parsed = new Date(`${trimmed}T00:00:00.000Z`);
    return Number.isNaN(parsed.getTime()) ? null : trimmed;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function isWithinUpcomingWindow(isoDate: string, nowMs: number): boolean {
  const startOfToday = new Date(nowMs).toISOString().slice(0, 10);
  const maxDate = new Date(nowMs + MAX_LOOKAHEAD_DAYS * 86_400_000).toISOString().slice(0, 10);
  return isoDate >= startOfToday && isoDate <= maxDate;
}

function sanitizeSourceUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed.startsWith('https://') && !trimmed.startsWith('http://')) {
    return null;
  }
  return trimmed;
}

export function normalizeUpcomingEvents(params: {
  symbol: string;
  yahooCalendar?: YahooCalendarEventsPayload | null;
  verifiedDisclosures?: ExternalDisclosureInput[] | null;
  nowMs?: number;
}): UpcomingEventItem[] {
  const symbol = params.symbol.trim().toUpperCase();
  const nowMs = params.nowMs ?? Date.now();
  const rawItems: UpcomingEventItem[] = [];

  const cal = params.yahooCalendar;
  if (cal) {
    const earningsDates = Array.isArray(cal.earnings?.earningsDate)
      ? cal.earnings.earningsDate
      : [];
    const firstEarningsIso =
      earningsDates.length > 0
        ? normalizeEventIsoDate(earningsDates[0]?.raw ?? earningsDates[0]?.fmt)
        : null;
    const secondEarningsIso =
      earningsDates.length > 1
        ? normalizeEventIsoDate(earningsDates[1]?.raw ?? earningsDates[1]?.fmt)
        : null;

    if (firstEarningsIso && isWithinUpcomingWindow(firstEarningsIso, nowMs)) {
      const rangeDetail =
        secondEarningsIso && secondEarningsIso !== firstEarningsIso
          ? `Tahmini pencere: ${firstEarningsIso} – ${secondEarningsIso}`
          : null;
      rawItems.push({
        id: `${symbol}:earnings:${firstEarningsIso}`,
        symbol,
        type: 'earnings',
        typeLabel: EVENT_TYPE_LABELS.earnings,
        title: `${symbol} Finansal Sonuç / Bilanço Açıklaması`,
        eventDate: firstEarningsIso,
        source: 'Yahoo Finance',
        sourceUrl: null,
        verified: true,
        details: rangeDetail,
      });
    }

    const exDivIso = normalizeEventIsoDate(cal.exDividendDate?.raw ?? cal.exDividendDate?.fmt);
    if (exDivIso && isWithinUpcomingWindow(exDivIso, nowMs)) {
      rawItems.push({
        id: `${symbol}:ex_dividend:${exDivIso}`,
        symbol,
        type: 'ex_dividend',
        typeLabel: EVENT_TYPE_LABELS.ex_dividend,
        title: `${symbol} Temettü Hak Ediş Tarihi (Ex-Dividend)`,
        eventDate: exDivIso,
        source: 'Yahoo Finance',
        sourceUrl: null,
        verified: true,
        details: null,
      });
    }

    const divDateIso = normalizeEventIsoDate(cal.dividendDate?.raw ?? cal.dividendDate?.fmt);
    if (divDateIso && isWithinUpcomingWindow(divDateIso, nowMs)) {
      rawItems.push({
        id: `${symbol}:dividend:${divDateIso}`,
        symbol,
        type: 'dividend',
        typeLabel: EVENT_TYPE_LABELS.dividend,
        title: `${symbol} Temettü Ödeme Tarihi`,
        eventDate: divDateIso,
        source: 'Yahoo Finance',
        sourceUrl: null,
        verified: true,
        details: null,
      });
    }
  }

  for (const item of params.verifiedDisclosures ?? []) {
    if (item.verified !== true) continue;
    const source = (item.source || '').trim();
    const title = (item.title || '').trim();
    const isoDate = normalizeEventIsoDate(item.date);
    if (!source || !title || !isoDate || !isWithinUpcomingWindow(isoDate, nowMs)) {
      continue;
    }
    const type: UpcomingEventType = item.type && EVENT_TYPE_LABELS[item.type] ? item.type : 'disclosure';
    rawItems.push({
      id: item.id || `${symbol}:${type}:${isoDate}:${source}`,
      symbol,
      type,
      typeLabel: EVENT_TYPE_LABELS[type],
      title,
      eventDate: isoDate,
      source,
      sourceUrl: sanitizeSourceUrl(item.sourceUrl),
      verified: true,
      details: item.details ?? null,
    });
  }

  const dedup = new Map<string, UpcomingEventItem>();
  for (const ev of rawItems) {
    const key = `${ev.type}:${ev.eventDate}:${ev.source.toUpperCase()}`;
    if (!dedup.has(key)) {
      dedup.set(key, ev);
    }
  }

  return Array.from(dedup.values()).sort((a, b) => a.eventDate.localeCompare(b.eventDate));
}

export function buildUpcomingEventsReport(params: {
  symbol: string;
  yahooCalendar?: YahooCalendarEventsPayload | null;
  verifiedDisclosures?: ExternalDisclosureInput[] | null;
  providerFailed?: boolean;
  notice?: string | null;
  nowMs?: number;
}): UpcomingEventsReport {
  const nowMs = params.nowMs ?? Date.now();
  const events = normalizeUpcomingEvents(params);
  const symbol = params.symbol.trim().toUpperCase();
  const checkedAt = new Date(nowMs).toISOString();

  if (events.length > 0) {
    return {
      symbol,
      status: 'ok',
      events,
      checkedAt,
      notice: params.notice ?? null,
    };
  }

  if (params.providerFailed) {
    return {
      symbol,
      status: 'unavailable',
      events: [],
      checkedAt,
      notice: params.notice || 'Takvim sağlayıcısından doğrulama alınamadı.',
    };
  }

  return {
    symbol,
    status: 'empty',
    events: [],
    checkedAt,
    notice: params.notice || 'Doğrulanmış yaklaşan bilanço, temettü veya resmi olay bulunamadı.',
  };
}
