export type ScopedAssetKind = 'stock' | 'fund';

export interface ScopedQuoteRequest {
  kind: ScopedAssetKind;
  symbols: string[];
  url: string;
}

export function normalizeSymbolToken(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9._:-]/g, '');
}

export function parseSymbolListParam(rawParam?: string | null, limit = 100): string[] {
  if (!rawParam || typeof rawParam !== 'string') return [];
  const seen = new Set<string>();
  const out: string[] = [];

  for (const part of rawParam.split(',')) {
    const token = normalizeSymbolToken(part);
    if (!token || seen.has(token)) continue;
    seen.add(token);
    out.push(token);
    if (out.length >= limit) break;
  }

  return out;
}

export function buildScopedQuotesUrl(
  kind: ScopedAssetKind,
  symbols: readonly string[],
  options?: { liveOnly?: boolean; limit?: number }
): string | null {
  const seen = new Set<string>();
  const normalized: string[] = [];
  const max = options?.limit ?? 100;

  for (const raw of symbols) {
    if (typeof raw !== 'string') continue;
    const token = normalizeSymbolToken(raw);
    if (!token || seen.has(token)) continue;
    seen.add(token);
    normalized.push(token);
    if (normalized.length >= max) break;
  }

  if (normalized.length === 0) return null;
  normalized.sort();

  const params = new URLSearchParams();
  if (kind === 'stock' && options?.liveOnly !== false) {
    params.set('liveOnly', 'true');
  }
  params.set('symbols', normalized.join(','));

  return kind === 'fund'
    ? `/api/funds?${params.toString()}`
    : `/api/stocks?${params.toString()}`;
}

export function buildScopedQuoteRequests(
  items: ReadonlyArray<{ symbol?: string | null; assetType?: string | null }>,
  options?: { liveOnly?: boolean }
): ScopedQuoteRequest[] {
  const stockSymbols: string[] = [];
  const fundSymbols: string[] = [];

  for (const item of items) {
    if (!item?.symbol) continue;
    const token = normalizeSymbolToken(item.symbol);
    if (!token) continue;
    if (item.assetType === 'fund') {
      fundSymbols.push(token);
    } else {
      stockSymbols.push(token);
    }
  }

  const requests: ScopedQuoteRequest[] = [];
  const stockUrl = buildScopedQuotesUrl('stock', stockSymbols, options);
  if (stockUrl) {
    requests.push({
      kind: 'stock',
      symbols: Array.from(new Set(stockSymbols)).sort(),
      url: stockUrl,
    });
  }

  const fundUrl = buildScopedQuotesUrl('fund', fundSymbols, options);
  if (fundUrl) {
    requests.push({
      kind: 'fund',
      symbols: Array.from(new Set(fundSymbols)).sort(),
      url: fundUrl,
    });
  }

  return requests;
}
