import type { SortDirection, StockSortKey } from '@/lib/market/marketFilterPersistence';

export type StockPeBand = 'ALL' | 'UNDER_10' | 'UNDER_15' | 'UNDER_25' | 'POSITIVE_ONLY';
export type StockDividendTier = 'ALL' | 'ANY' | 'ABOVE_2' | 'ABOVE_4' | 'ABOVE_6';
export type StockMarketCapTier = 'ALL' | 'LARGE_50B' | 'MID_10B' | 'SMALL_UNDER_10B';
export type StockPriceChangeFilter = 'ALL' | 'POSITIVE' | 'UP_2' | 'NEGATIVE' | 'DOWN_2';

export interface StockScreenerCriteria {
  sector: string;
  peBand: StockPeBand;
  dividendTier: StockDividendTier;
  marketCapTier: StockMarketCapTier;
  priceChange: StockPriceChangeFilter;
  minPrice?: number | null;
  maxPrice?: number | null;
}

export interface SavedBistScreener {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  criteria: StockScreenerCriteria;
  sortBy: StockSortKey;
  sortOrder: SortDirection;
}

export const BIST_SCREENER_STORAGE_KEY = 'stockmind.bist.screeners.v1';

export const DEFAULT_STOCK_SCREENER_CRITERIA: StockScreenerCriteria = {
  sector: 'ALL',
  peBand: 'ALL',
  dividendTier: 'ALL',
  marketCapTier: 'ALL',
  priceChange: 'ALL',
  minPrice: null,
  maxPrice: null,
};

export const STOCK_PE_BAND_OPTIONS: readonly { id: StockPeBand; label: string }[] = [
  { id: 'ALL', label: 'Tüm F/K' },
  { id: 'UNDER_10', label: 'F/K ≤ 10' },
  { id: 'UNDER_15', label: 'F/K ≤ 15' },
  { id: 'UNDER_25', label: 'F/K ≤ 25' },
  { id: 'POSITIVE_ONLY', label: 'Kârlı (F/K > 0)' },
];

export const STOCK_DIVIDEND_TIER_OPTIONS: readonly { id: StockDividendTier; label: string }[] = [
  { id: 'ALL', label: 'Tüm Temettüler' },
  { id: 'ANY', label: 'Temettü Ödeyen (> %0)' },
  { id: 'ABOVE_2', label: 'Temettü ≥ %2' },
  { id: 'ABOVE_4', label: 'Temettü ≥ %4' },
  { id: 'ABOVE_6', label: 'Temettü ≥ %6' },
];

export const STOCK_MCAP_TIER_OPTIONS: readonly { id: StockMarketCapTier; label: string }[] = [
  { id: 'ALL', label: 'Tüm Piyasa Değerleri' },
  { id: 'LARGE_50B', label: 'Büyük (≥ 50 Mr ₺)' },
  { id: 'MID_10B', label: 'Orta/Büyük (≥ 10 Mr ₺)' },
  { id: 'SMALL_UNDER_10B', label: 'Küçük (< 10 Mr ₺)' },
];

export const STOCK_PRICE_CHANGE_OPTIONS: readonly { id: StockPriceChangeFilter; label: string }[] = [
  { id: 'ALL', label: 'Tüm Günlük Değişim' },
  { id: 'POSITIVE', label: 'Yükselenler (> %0)' },
  { id: 'UP_2', label: 'Güçlü Artış (≥ +%2)' },
  { id: 'NEGATIVE', label: 'Düşenler (< %0)' },
  { id: 'DOWN_2', label: 'Sert Düşüş (≤ -%2)' },
];

export interface ScreenableStockRecord {
  symbol: string;
  sector?: string;
  price?: number | null;
  changePercent?: number | null;
  marketCap?: number | null;
  volume?: number | null;
  peRatio?: number | null;
  dividendYield?: number | null;
}

export function hasActiveStockScreenerFilter(criteria: StockScreenerCriteria): boolean {
  return (
    criteria.peBand !== 'ALL' ||
    criteria.dividendTier !== 'ALL' ||
    criteria.marketCapTier !== 'ALL' ||
    criteria.priceChange !== 'ALL' ||
    (typeof criteria.minPrice === 'number' && Number.isFinite(criteria.minPrice)) ||
    (typeof criteria.maxPrice === 'number' && Number.isFinite(criteria.maxPrice))
  );
}

export function filterStocksByScreener<T extends ScreenableStockRecord>(
  stocks: readonly T[],
  criteria: StockScreenerCriteria
): T[] {
  return stocks.filter((stock) => {
    if (criteria.sector && criteria.sector !== 'ALL') {
      if ((stock.sector || '').trim() !== criteria.sector.trim()) return false;
    }

    if (criteria.peBand !== 'ALL') {
      const pe = stock.peRatio;
      if (typeof pe !== 'number' || !Number.isFinite(pe) || pe <= 0) return false;
      if (criteria.peBand === 'UNDER_10' && pe > 10) return false;
      if (criteria.peBand === 'UNDER_15' && pe > 15) return false;
      if (criteria.peBand === 'UNDER_25' && pe > 25) return false;
    }

    if (criteria.dividendTier !== 'ALL') {
      const div = stock.dividendYield;
      if (typeof div !== 'number' || !Number.isFinite(div) || div <= 0) return false;
      if (criteria.dividendTier === 'ABOVE_2' && div < 2) return false;
      if (criteria.dividendTier === 'ABOVE_4' && div < 4) return false;
      if (criteria.dividendTier === 'ABOVE_6' && div < 6) return false;
    }

    if (criteria.marketCapTier !== 'ALL') {
      const mcap = stock.marketCap;
      if (typeof mcap !== 'number' || !Number.isFinite(mcap) || mcap <= 0) return false;
      if (criteria.marketCapTier === 'LARGE_50B' && mcap < 50_000_000_000) return false;
      if (criteria.marketCapTier === 'MID_10B' && mcap < 10_000_000_000) return false;
      if (criteria.marketCapTier === 'SMALL_UNDER_10B' && mcap >= 10_000_000_000) return false;
    }

    if (criteria.priceChange !== 'ALL') {
      const ch = stock.changePercent;
      if (typeof ch !== 'number' || !Number.isFinite(ch)) return false;
      if (criteria.priceChange === 'POSITIVE' && ch <= 0) return false;
      if (criteria.priceChange === 'UP_2' && ch < 2) return false;
      if (criteria.priceChange === 'NEGATIVE' && ch >= 0) return false;
      if (criteria.priceChange === 'DOWN_2' && ch > -2) return false;
    }

    if (typeof criteria.minPrice === 'number' && Number.isFinite(criteria.minPrice)) {
      if (typeof stock.price !== 'number' || stock.price < criteria.minPrice) return false;
    }
    if (typeof criteria.maxPrice === 'number' && Number.isFinite(criteria.maxPrice)) {
      if (typeof stock.price !== 'number' || stock.price > criteria.maxPrice) return false;
    }

    return true;
  });
}

function normalizeCriteria(raw: unknown): StockScreenerCriteria {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_STOCK_SCREENER_CRITERIA };
  const obj = raw as Partial<StockScreenerCriteria>;
  const validPe = new Set<StockPeBand>(['ALL', 'UNDER_10', 'UNDER_15', 'UNDER_25', 'POSITIVE_ONLY']);
  const validDiv = new Set<StockDividendTier>(['ALL', 'ANY', 'ABOVE_2', 'ABOVE_4', 'ABOVE_6']);
  const validMcap = new Set<StockMarketCapTier>(['ALL', 'LARGE_50B', 'MID_10B', 'SMALL_UNDER_10B']);
  const validPriceChange = new Set<StockPriceChangeFilter>(['ALL', 'POSITIVE', 'UP_2', 'NEGATIVE', 'DOWN_2']);

  return {
    sector: typeof obj.sector === 'string' && obj.sector.trim() ? obj.sector.trim() : 'ALL',
    peBand: validPe.has(obj.peBand as StockPeBand) ? (obj.peBand as StockPeBand) : 'ALL',
    dividendTier: validDiv.has(obj.dividendTier as StockDividendTier)
      ? (obj.dividendTier as StockDividendTier)
      : 'ALL',
    marketCapTier: validMcap.has(obj.marketCapTier as StockMarketCapTier)
      ? (obj.marketCapTier as StockMarketCapTier)
      : 'ALL',
    priceChange: validPriceChange.has(obj.priceChange as StockPriceChangeFilter)
      ? (obj.priceChange as StockPriceChangeFilter)
      : 'ALL',
    minPrice: typeof obj.minPrice === 'number' && Number.isFinite(obj.minPrice) && obj.minPrice >= 0 ? obj.minPrice : null,
    maxPrice: typeof obj.maxPrice === 'number' && Number.isFinite(obj.maxPrice) && obj.maxPrice >= 0 ? obj.maxPrice : null,
  };
}

export function readSavedBistScreeners(
  storage?: Pick<Storage, 'getItem'> | null
): SavedBistScreener[] {
  const store =
    storage !== undefined
      ? storage
      : typeof window !== 'undefined'
      ? window.localStorage
      : null;
  if (!store) return [];

  try {
    const raw = store.getItem(BIST_SCREENER_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const validSorts = new Set<StockSortKey>(['changePercent', 'price', 'volume', 'marketCap']);

    return parsed
      .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
      .map((item) => ({
        id: typeof item.id === 'string' && item.id.trim() ? item.id.trim() : `scr-${Date.now()}`,
        name: typeof item.name === 'string' && item.name.trim() ? item.name.trim().slice(0, 60) : 'Kayıtlı Tarayıcı',
        createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
        updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : new Date().toISOString(),
        criteria: normalizeCriteria(item.criteria),
        sortBy: validSorts.has(item.sortBy as StockSortKey) ? (item.sortBy as StockSortKey) : 'marketCap',
        sortOrder: item.sortOrder === 'asc' ? ('asc' as const) : ('desc' as const),
      }));
  } catch {
    return [];
  }
}

export function writeSavedBistScreeners(
  presets: readonly SavedBistScreener[],
  storage?: Pick<Storage, 'setItem'> | null
): SavedBistScreener[] {
  const cleaned = presets.slice(0, 25);
  const store =
    storage !== undefined
      ? storage
      : typeof window !== 'undefined'
      ? window.localStorage
      : null;
  if (store) {
    try {
      store.setItem(BIST_SCREENER_STORAGE_KEY, JSON.stringify(cleaned));
    } catch {
      // Ignore quota / private browsing storage restrictions cleanly
    }
  }
  return cleaned;
}

export function saveBistScreenerPreset(
  input: {
    name: string;
    criteria: StockScreenerCriteria;
    sortBy: StockSortKey;
    sortOrder: SortDirection;
    id?: string;
    now?: Date;
  },
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null
): { ok: true; saved: SavedBistScreener; presets: SavedBistScreener[] } | { ok: false; error: string } {
  const trimmedName = (input.name || '').trim().slice(0, 60);
  if (!trimmedName) {
    return { ok: false, error: 'Tarayıcı için bir ad girin.' };
  }

  const nowIso = (input.now ?? new Date()).toISOString();
  const existing = readSavedBistScreeners(storage);
  const matchIdx = input.id
    ? existing.findIndex((p) => p.id === input.id)
    : existing.findIndex((p) => p.name.toLowerCase() === trimmedName.toLowerCase());

  const entry: SavedBistScreener = {
    id: matchIdx >= 0 ? existing[matchIdx].id : input.id || `bist-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: trimmedName,
    createdAt: matchIdx >= 0 ? existing[matchIdx].createdAt : nowIso,
    updatedAt: nowIso,
    criteria: normalizeCriteria(input.criteria),
    sortBy: input.sortBy,
    sortOrder: input.sortOrder,
  };

  const next =
    matchIdx >= 0
      ? existing.map((item, idx) => (idx === matchIdx ? entry : item))
      : [entry, ...existing];

  const written = writeSavedBistScreeners(next, storage);
  return { ok: true, saved: entry, presets: written };
}

export function deleteBistScreenerPreset(
  id: string,
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null
): SavedBistScreener[] {
  const existing = readSavedBistScreeners(storage);
  const next = existing.filter((p) => p.id !== id);
  return writeSavedBistScreeners(next, storage);
}
