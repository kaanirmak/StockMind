import { MARKET_CATALOG, normalizeMarketParam, type MarketId } from '@/lib/market/marketSelector';

export const MARKET_FILTER_STORAGE_KEY = 'stockmind.piyasalar.filters.v1';

export type StockSortKey = 'changePercent' | 'price' | 'volume' | 'marketCap';
export type FundSortKey =
  | 'dailyReturn'
  | 'monthlyReturn'
  | 'return3m'
  | 'yearlyReturn'
  | 'return3y'
  | 'return5y'
  | 'price'
  | 'riskValue';
export type SortDirection = 'asc' | 'desc';

export interface PersistedMarketFilterState {
  market: MarketId;
  sector: string;
  category: string;
  search: string;
  watchlistOnly: boolean;
  viewMode: 'table' | 'grid';
  stockSortBy: StockSortKey;
  stockSortOrder: SortDirection;
  fundSortBy: FundSortKey;
  fundSortOrder: SortDirection;
}

export const DEFAULT_MARKET_FILTER_STATE: PersistedMarketFilterState = {
  market: 'ALL',
  sector: 'ALL',
  category: 'ALL',
  search: '',
  watchlistOnly: false,
  viewMode: 'table',
  stockSortBy: 'marketCap',
  stockSortOrder: 'desc',
  fundSortBy: 'yearlyReturn',
  fundSortOrder: 'desc',
};

const VALID_MARKET_IDS = new Set<MarketId>(MARKET_CATALOG.map((m) => m.id));
const VALID_STOCK_SORTS = new Set<StockSortKey>(['changePercent', 'price', 'volume', 'marketCap']);
const VALID_FUND_SORTS = new Set<FundSortKey>([
  'dailyReturn',
  'monthlyReturn',
  'return3m',
  'yearlyReturn',
  'return3y',
  'return5y',
  'price',
  'riskValue',
]);

export interface ParsedMarketUrlState {
  hasExplicitMarket: boolean;
  hasAnyExplicitFilter: boolean;
  values: Partial<PersistedMarketFilterState>;
}

export function parseMarketUrlState(
  params: Pick<URLSearchParams, 'get'>
): ParsedMarketUrlState {
  const values: Partial<PersistedMarketFilterState> = {};

  const rawMarket = params.get('market') || params.get('tab') || params.get('exchange');
  const hasExplicitMarket = Boolean(rawMarket && rawMarket.trim().length > 0);
  if (hasExplicitMarket) {
    values.market = normalizeMarketParam(rawMarket);
  }

  const rawSector = params.get('sector');
  if (rawSector && rawSector.trim().length > 0) {
    values.sector = rawSector.trim();
  }

  const rawCategory = params.get('category');
  if (rawCategory && rawCategory.trim().length > 0) {
    values.category = rawCategory.trim();
  }

  const rawSearch = params.get('q') ?? params.get('search');
  if (rawSearch !== null && rawSearch !== undefined) {
    values.search = rawSearch;
  }

  const rawWatchlist = params.get('watchlist');
  if (rawWatchlist === '1' || rawWatchlist === 'true') {
    values.watchlistOnly = true;
  } else if (rawWatchlist === '0' || rawWatchlist === 'false') {
    values.watchlistOnly = false;
  }

  const rawView = params.get('view');
  if (rawView === 'table' || rawView === 'grid') {
    values.viewMode = rawView;
  }

  const rawSortBy = params.get('sortBy');
  if (rawSortBy && VALID_STOCK_SORTS.has(rawSortBy as StockSortKey)) {
    values.stockSortBy = rawSortBy as StockSortKey;
  }
  if (rawSortBy && VALID_FUND_SORTS.has(rawSortBy as FundSortKey)) {
    values.fundSortBy = rawSortBy as FundSortKey;
  }

  const rawSortOrder = params.get('sortOrder');
  if (rawSortOrder === 'asc' || rawSortOrder === 'desc') {
    values.stockSortOrder = rawSortOrder;
    values.fundSortOrder = rawSortOrder;
  }

  const hasAnyExplicitFilter = Object.keys(values).length > 0;
  return { hasExplicitMarket, hasAnyExplicitFilter, values };
}

export function sanitizePersistedMarketState(raw: unknown): Partial<PersistedMarketFilterState> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const obj = raw as Record<string, unknown>;
  const out: Partial<PersistedMarketFilterState> = {};

  if (typeof obj.market === 'string' && VALID_MARKET_IDS.has(obj.market as MarketId)) {
    out.market = obj.market as MarketId;
  }
  if (typeof obj.sector === 'string' && obj.sector.trim().length > 0) {
    out.sector = obj.sector.trim();
  }
  if (typeof obj.category === 'string' && obj.category.trim().length > 0) {
    out.category = obj.category.trim();
  }
  if (typeof obj.search === 'string') {
    out.search = obj.search;
  }
  if (typeof obj.watchlistOnly === 'boolean') {
    out.watchlistOnly = obj.watchlistOnly;
  }
  if (obj.viewMode === 'table' || obj.viewMode === 'grid') {
    out.viewMode = obj.viewMode;
  }
  if (typeof obj.stockSortBy === 'string' && VALID_STOCK_SORTS.has(obj.stockSortBy as StockSortKey)) {
    out.stockSortBy = obj.stockSortBy as StockSortKey;
  }
  if (obj.stockSortOrder === 'asc' || obj.stockSortOrder === 'desc') {
    out.stockSortOrder = obj.stockSortOrder;
  }
  if (typeof obj.fundSortBy === 'string' && VALID_FUND_SORTS.has(obj.fundSortBy as FundSortKey)) {
    out.fundSortBy = obj.fundSortBy as FundSortKey;
  }
  if (obj.fundSortOrder === 'asc' || obj.fundSortOrder === 'desc') {
    out.fundSortOrder = obj.fundSortOrder;
  }

  return out;
}

export function resolveMarketStateWithPersistence(
  params: Pick<URLSearchParams, 'get'>,
  storedRaw?: unknown
): PersistedMarketFilterState {
  const url = parseMarketUrlState(params);
  const stored = sanitizePersistedMarketState(storedRaw);

  // Explicit URL sharing wins: if a URL carries explicit market or filters, apply the URL's explicit scope
  // rather than letting stale persisted selections override the shared link.
  if (url.hasExplicitMarket) {
    return {
      ...DEFAULT_MARKET_FILTER_STATE,
      viewMode: url.values.viewMode ?? stored.viewMode ?? DEFAULT_MARKET_FILTER_STATE.viewMode,
      ...url.values,
    };
  }

  if (url.hasAnyExplicitFilter) {
    return {
      ...DEFAULT_MARKET_FILTER_STATE,
      ...stored,
      ...url.values,
    };
  }

  return {
    ...DEFAULT_MARKET_FILTER_STATE,
    ...stored,
  };
}

export function buildMarketSearchParams(state: PersistedMarketFilterState): string {
  const sp = new URLSearchParams();
  sp.set('market', state.market.toLowerCase());

  if (state.market === 'TEFAS') {
    if (state.category && state.category !== 'ALL') sp.set('category', state.category);
    if (state.fundSortBy !== DEFAULT_MARKET_FILTER_STATE.fundSortBy) sp.set('sortBy', state.fundSortBy);
    if (state.fundSortOrder !== DEFAULT_MARKET_FILTER_STATE.fundSortOrder) sp.set('sortOrder', state.fundSortOrder);
  } else if (state.market !== 'ALL') {
    if (state.sector && state.sector !== 'ALL') sp.set('sector', state.sector);
    if (state.stockSortBy !== DEFAULT_MARKET_FILTER_STATE.stockSortBy) sp.set('sortBy', state.stockSortBy);
    if (state.stockSortOrder !== DEFAULT_MARKET_FILTER_STATE.stockSortOrder) sp.set('sortOrder', state.stockSortOrder);
  }

  if (state.search.trim().length > 0) {
    sp.set('q', state.search.trim());
  }
  if (state.watchlistOnly) {
    sp.set('watchlist', '1');
  }
  if (state.viewMode !== 'table') {
    sp.set('view', state.viewMode);
  }

  return sp.toString();
}
