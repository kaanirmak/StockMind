export type MacroRegion = 'ALL' | 'TR' | 'GLOBAL';

export interface MacroEventItem {
  id: string;
  region: 'TR' | 'GLOBAL';
  countryLabel: string;
  title: string;
  scheduledAt: string; // ISO 8601 UTC timestamp
  source: string;
  sourceUrl: string | null;
  importance: 'high' | 'medium';
  previousValue: string | null;
  consensusValue: string | null;
  actualValue: string | null;
  verified: boolean;
}

export interface MacroCalendarReport {
  configured: boolean;
  status: 'ok' | 'empty' | 'unavailable';
  events: MacroEventItem[];
  checkedAt: string;
  notice?: string;
}

function normalizeOptionalMetric(raw: unknown): string | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return String(raw);
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed || trimmed === '-' || trimmed === '—' || trimmed.toLowerCase() === 'n/a') {
      return null;
    }
    return trimmed;
  }
  return null;
}

function normalizeSafeHttpsUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  try {
    const parsed = new URL(raw.trim());
    return parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export function formatMacroMetricValue(value: string | null | undefined): string {
  const normalized = normalizeOptionalMetric(value);
  return normalized ?? 'Mevcut değil';
}

export function parseMacroCalendarPayload(payload: unknown): MacroEventItem[] {
  const rawList: unknown[] = Array.isArray(payload)
    ? payload
    : payload && typeof payload === 'object'
    ? Array.isArray((payload as Record<string, unknown>).events)
      ? ((payload as Record<string, unknown>).events as unknown[])
      : Array.isArray((payload as Record<string, unknown>).data)
      ? ((payload as Record<string, unknown>).data as unknown[])
      : Array.isArray((payload as Record<string, unknown>).items)
      ? ((payload as Record<string, unknown>).items as unknown[])
      : []
    : [];

  const parsed: MacroEventItem[] = [];
  const seen = new Set<string>();

  for (const entry of rawList) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;

    const title = typeof row.title === 'string' ? row.title.trim() : '';
    const source = typeof row.source === 'string' ? row.source.trim() : '';
    const rawTime = row.scheduledAt ?? row.date ?? row.time;
    const timeMs = typeof rawTime === 'string' ? Date.parse(rawTime.trim()) : NaN;
    if (!title || !source || !Number.isFinite(timeMs)) continue;
    if (row.verified === false) continue;

    const scheduledAt = new Date(timeMs).toISOString();
    const rawRegion = typeof row.region === 'string' ? row.region.trim().toUpperCase() : '';
    const region: 'TR' | 'GLOBAL' =
      rawRegion === 'TR' || /\b(?:tcmb|tuik|tüik|türkiye|turkey|tr)\b/i.test(`${row.countryLabel || ''} ${source} ${title}`)
        ? 'TR'
        : 'GLOBAL';

    const countryLabel =
      typeof row.countryLabel === 'string' && row.countryLabel.trim()
        ? row.countryLabel.trim()
        : region === 'TR'
        ? 'Türkiye'
        : 'Küresel';

    const id =
      typeof row.id === 'string' && row.id.trim()
        ? row.id.trim()
        : `${region}:${source}:${scheduledAt}:${title.slice(0, 32)}`;
    if (seen.has(id)) continue;
    seen.add(id);

    parsed.push({
      id,
      region,
      countryLabel,
      title,
      scheduledAt,
      source,
      sourceUrl: normalizeSafeHttpsUrl(row.sourceUrl ?? row.url),
      importance: row.importance === 'medium' ? 'medium' : 'high',
      previousValue: normalizeOptionalMetric(row.previousValue ?? row.previous),
      consensusValue: normalizeOptionalMetric(row.consensusValue ?? row.consensus ?? row.forecast),
      actualValue: normalizeOptionalMetric(row.actualValue ?? row.actual),
      verified: true,
    });
  }

  parsed.sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt));
  return parsed;
}

export function filterMacroCalendarEvents(params: {
  events: readonly MacroEventItem[];
  region?: MacroRegion;
  searchQuery?: string;
}): MacroEventItem[] {
  const region = params.region ?? 'ALL';
  const query = (params.searchQuery || '').trim().toLowerCase();

  return params.events.filter((ev) => {
    if (!ev.verified) return false;
    if (region !== 'ALL' && ev.region !== region) return false;
    if (query) {
      const text = `${ev.title} ${ev.source} ${ev.countryLabel}`.toLowerCase();
      if (!text.includes(query)) return false;
    }
    return true;
  });
}

export async function fetchMacroCalendarEvents(options?: {
  feedUrl?: string | null;
  region?: MacroRegion;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<MacroCalendarReport> {
  const checkedAt = new Date().toISOString();
  const configuredUrl = (options?.feedUrl ?? process.env.MACRO_CALENDAR_FEED_URL ?? '').trim();

  if (!configuredUrl || !/^https?:\/\//i.test(configuredUrl)) {
    return {
      configured: false,
      status: 'empty',
      events: [],
      checkedAt,
      notice:
        'Doğrulanmış makroekonomi takvim akışı henüz bağlı değil; önceki, beklenen veya gerçekleşen değerler kaynak olmadan tahmin edilmez.',
    };
  }

  const fetchFn = options?.fetchImpl ?? fetch;
  try {
    const res = await fetchFn(configuredUrl, {
      headers: { Accept: 'application/json', 'User-Agent': 'StockMind Macro Calendar' },
      signal: AbortSignal.timeout(options?.timeoutMs ?? 8000),
      cache: 'no-store',
    });
    if (!res.ok) {
      return {
        configured: true,
        status: 'unavailable',
        events: [],
        checkedAt,
        notice: `Makroekonomi takvim sağlayıcısı yanıt vermedi (HTTP ${res.status}).`,
      };
    }
    const json = await res.json();
    const events = filterMacroCalendarEvents({
      events: parseMacroCalendarPayload(json),
      region: options?.region ?? 'ALL',
    });
    return {
      configured: true,
      status: events.length > 0 ? 'ok' : 'empty',
      events,
      checkedAt,
      notice:
        events.length === 0
          ? 'Seçili kapsamda doğrulanmış makroekonomi olayı bulunamadı.'
          : undefined,
    };
  } catch {
    return {
      configured: true,
      status: 'unavailable',
      events: [],
      checkedAt,
      notice: 'Makroekonomi takvim akışı alınamadı.',
    };
  }
}
