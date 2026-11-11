import { KAP_ACCESS_TERMS } from '@/lib/market/providerPolicies';

export interface KapDisclosureItem {
  id: string;
  sourceId: string;
  disclosureId: string;
  companyName: string;
  symbol: string;
  disclosureType: string;
  title: string;
  summary: string;
  publishedAt: string;
  documentUrl: string;
  source: 'Kamuyu Aydınlatma Platformu (KAP)';
}

export interface KapFeedResult {
  configured: boolean;
  items: KapDisclosureItem[];
  warning?: string;
}

export function isOfficialKapDocumentUrl(rawUrl: string | null | undefined): boolean {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    return KAP_ACCESS_TERMS.allowedDomains.some(
      (domain) => host === domain || host.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

function normalizeSymbolCode(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const cleaned = raw.trim().toUpperCase().replace(/\.IS$/, '');
  return /^[A-Z0-9]{2,12}$/.test(cleaned) ? cleaned : '';
}

function normalizeIsoTimestamp(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const parsed = Date.parse(raw.trim());
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}

export function parseKapDisclosuresPayload(payload: unknown): KapDisclosureItem[] {
  const rawList: unknown[] = Array.isArray(payload)
    ? payload
    : payload && typeof payload === 'object'
    ? Array.isArray((payload as Record<string, unknown>).items)
      ? ((payload as Record<string, unknown>).items as unknown[])
      : Array.isArray((payload as Record<string, unknown>).data)
      ? ((payload as Record<string, unknown>).data as unknown[])
      : Array.isArray((payload as Record<string, unknown>).disclosures)
      ? ((payload as Record<string, unknown>).disclosures as unknown[])
      : []
    : [];

  const parsed: KapDisclosureItem[] = [];
  const seenIds = new Set<string>();

  for (const entry of rawList) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;

    const documentUrl =
      typeof row.documentUrl === 'string'
        ? row.documentUrl.trim()
        : typeof row.url === 'string'
        ? row.url.trim()
        : '';
    if (!isOfficialKapDocumentUrl(documentUrl)) continue;

    const title = typeof row.title === 'string' ? row.title.trim() : '';
    const companyName =
      typeof row.companyName === 'string'
        ? row.companyName.trim()
        : typeof row.company === 'string'
        ? row.company.trim()
        : '';
    const symbol = normalizeSymbolCode(row.symbol ?? row.stockCode);
    const publishedAt = normalizeIsoTimestamp(row.publishedAt ?? row.publishDate ?? row.date);
    if (!title || !companyName || !publishedAt) continue;

    const disclosureIdRaw =
      typeof row.disclosureId === 'string' || typeof row.disclosureId === 'number'
        ? String(row.disclosureId).trim()
        : typeof row.id === 'string' || typeof row.id === 'number'
        ? String(row.id).trim()
        : '';
    const disclosureId =
      disclosureIdRaw ||
      documentUrl.split('/').filter(Boolean).pop() ||
      `${symbol || 'KAP'}-${Date.parse(publishedAt)}`;
    const sourceId =
      typeof row.sourceId === 'string' && row.sourceId.trim()
        ? row.sourceId.trim()
        : `KAP-${disclosureId}`;
    const id = `kap-${disclosureId}`;
    if (seenIds.has(id)) continue;
    seenIds.add(id);

    const disclosureType =
      typeof row.disclosureType === 'string' && row.disclosureType.trim()
        ? row.disclosureType.trim()
        : 'Özel Durum Açıklaması';
    const summary =
      typeof row.summary === 'string' && row.summary.trim()
        ? row.summary.trim()
        : `${companyName}${symbol ? ` (${symbol})` : ''} — ${disclosureType}`;

    parsed.push({
      id,
      sourceId,
      disclosureId,
      companyName,
      symbol,
      disclosureType,
      title,
      summary,
      publishedAt,
      documentUrl,
      source: 'Kamuyu Aydınlatma Platformu (KAP)',
    });
  }

  parsed.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  return parsed;
}

export function toKapNewsArticle(item: KapDisclosureItem) {
  return {
    id: item.id,
    title: item.title,
    summary: item.summary,
    category: 'KAP' as const,
    sentiment: 'neutral' as const,
    source: item.source,
    url: item.documentUrl,
    publishedAt: item.publishedAt,
    relatedSymbols: item.symbol ? [`${item.symbol}.IS`] : [],
    sourceId: item.sourceId,
    disclosureId: item.disclosureId,
    companyName: item.companyName,
    symbol: item.symbol,
    disclosureType: item.disclosureType,
  };
}

export async function fetchOfficialKapDisclosures(options?: {
  feedUrl?: string | null;
  symbol?: string | null;
  symbols?: readonly string[];
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<KapFeedResult> {
  const configuredUrl = (options?.feedUrl ?? process.env.KAP_FEED_URL ?? '').trim();
  if (!configuredUrl || !/^https?:\/\//i.test(configuredUrl)) {
    return {
      configured: false,
      items: [],
      warning:
        'Resmî KAP bildirim kaynağı henüz bağlı değil; yalnızca doğrulanmış kap.org.tr bildirimleri gösterilir.',
    };
  }

  const fetchFn = options?.fetchImpl ?? fetch;
  const timeoutMs = options?.timeoutMs ?? 8000;

  try {
    const res = await fetchFn(configuredUrl, {
      headers: { Accept: 'application/json', 'User-Agent': 'StockMind KAP Feed Reader' },
      signal: AbortSignal.timeout(timeoutMs),
      cache: 'no-store',
    });
    if (!res.ok) {
      return {
        configured: true,
        items: [],
        warning: `Resmî KAP kaynağı yanıt vermedi (HTTP ${res.status}).`,
      };
    }
    const json = await res.json();
    let items = parseKapDisclosuresPayload(json);

    const requestedSymbol = normalizeSymbolCode(options?.symbol);
    const requestedSet = new Set(
      (options?.symbols ?? []).map(normalizeSymbolCode).filter(Boolean)
    );
    if (requestedSymbol) {
      items = items.filter((item) => item.symbol === requestedSymbol);
    } else if (requestedSet.size > 0) {
      items = items.filter((item) => item.symbol && requestedSet.has(item.symbol));
    }

    return {
      configured: true,
      items,
    };
  } catch {
    return {
      configured: true,
      items: [],
      warning: 'Resmî KAP akışı alınamadı; lütfen daha sonra tekrar deneyin.',
    };
  }
}

