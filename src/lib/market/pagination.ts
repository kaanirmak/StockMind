export const MARKET_PAGE_SIZE = 30;

export type StockSortField = 'changePercent' | 'price' | 'volume' | 'marketCap' | 'symbol';
export type MarketSortDirection = 'asc' | 'desc';

export interface PaginationResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

export function parsePaginationParams(searchParams: { get(name: string): string | null }): {
  page: number;
  limit?: number;
} {
  const rawPageParam = searchParams.get('page');
  const rawPage = Number(rawPageParam);
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
  const rawLimitParam = searchParams.get('limit');
  if (rawLimitParam == null || rawLimitParam === '') {
    if (rawPageParam != null && rawPageParam !== '') {
      return { page, limit: MARKET_PAGE_SIZE };
    }
    return { page };
  }
  const rawLimit = Number(rawLimitParam);
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(200, Math.floor(rawLimit))
      : MARKET_PAGE_SIZE;
  return { page, limit };
}

export function paginateRecords<T>(
  items: readonly T[],
  pageInput: number = 1,
  limitInput?: number
): PaginationResult<T> {
  const total = items.length;
  const effectiveLimit =
    limitInput && Number.isFinite(limitInput) && limitInput > 0
      ? Math.floor(limitInput)
      : Math.max(1, total);
  const totalPages = Math.max(1, Math.ceil(total / effectiveLimit));
  const safePage = Math.min(Math.max(1, Math.floor(pageInput || 1)), totalPages);
  const start = (safePage - 1) * effectiveLimit;
  const sliced = limitInput && limitInput > 0 ? items.slice(start, start + effectiveLimit) : [...items];

  return {
    items: sliced,
    total,
    page: safePage,
    limit: limitInput && limitInput > 0 ? effectiveLimit : total,
    totalPages,
    hasMore: safePage < totalPages,
  };
}

export function normalizeStockSortMetric(
  item: {
    symbol?: string;
    price?: number | null;
    changePercent?: number | null;
    volume?: number | null;
    marketCap?: number | null;
    currency?: string | null;
  },
  key: StockSortField
): number | string {
  if (key === 'symbol') {
    return String(item.symbol || '').toUpperCase();
  }
  if (key === 'marketCap') {
    const cap = Number(item.marketCap) || 0;
    if (cap <= 0) return 0;
    const curr = String(item.currency || 'USD').toUpperCase();
    if (curr === 'TRY') return cap / 49.25;
    if (curr === 'EUR') return cap * 1.09;
    if (curr === 'GBP') return cap * 1.3;
    if (curr === 'JPY') return cap / 152;
    if (curr === 'HKD') return cap / 7.78;
    if (curr === 'AUD') return cap * 0.65;
    if (curr === 'BRL') return cap * 0.17;
    if (curr === 'KRW') return cap / 1400;
    if (curr === 'CHF') return cap * 1.12;
    if (curr === 'CAD') return cap * 0.72;
    return cap;
  }
  if (key === 'price') {
    const p = Number(item.price) || 0;
    if (p <= 0) return 0;
    const curr = String(item.currency || 'USD').toUpperCase();
    if (curr === 'TRY') return p / 49.25;
    if (curr === 'EUR') return p * 1.09;
    if (curr === 'GBP') return p * 1.3;
    if (curr === 'JPY') return p / 152;
    return p;
  }
  return Number(item[key]) || 0;
}

export function sortStockRecords<
  T extends {
    symbol?: string;
    price?: number | null;
    changePercent?: number | null;
    volume?: number | null;
    marketCap?: number | null;
    currency?: string | null;
  }
>(items: readonly T[], sortBy: StockSortField = 'marketCap', order: MarketSortDirection = 'desc'): T[] {
  return [...items].sort((a, b) => {
    const valA = normalizeStockSortMetric(a, sortBy);
    const valB = normalizeStockSortMetric(b, sortBy);

    if (typeof valA === 'string' && typeof valB === 'string') {
      const cmp = valA.localeCompare(valB);
      return order === 'asc' ? cmp : -cmp;
    }

    const numA = Number(valA) || 0;
    const numB = Number(valB) || 0;

    if (sortBy === 'marketCap' || sortBy === 'volume') {
      if (numA <= 0 && numB > 0) return 1;
      if (numB <= 0 && numA > 0) return -1;
    }

    if (numB !== numA) {
      return order === 'desc' ? numB - numA : numA - numB;
    }

    const secA = Number(normalizeStockSortMetric(a, 'volume')) || Number(a.price) || 0;
    const secB = Number(normalizeStockSortMetric(b, 'volume')) || Number(b.price) || 0;
    return secB - secA;
  });
}
