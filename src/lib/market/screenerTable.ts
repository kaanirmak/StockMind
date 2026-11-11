import type {
  FundSortKey,
  SortDirection,
  StockSortKey,
} from '@/lib/market/marketFilterPersistence';
import type { FundReturnPeriod } from '@/lib/market/fundFilters';

export type StockColumnId =
  | 'symbol'
  | 'market'
  | 'sector'
  | 'price'
  | 'changePercent'
  | 'volume'
  | 'marketCap'
  | 'peRatio'
  | 'dividendYield';

export type FundColumnId =
  | 'code'
  | 'price'
  | 'dailyReturn'
  | 'monthlyReturn'
  | 'periodReturn'
  | 'riskValue'
  | 'managementFee'
  | 'category';

export interface ScreenerColumnDef<T extends string> {
  id: T;
  label: string;
  locked?: boolean;
  defaultVisible: boolean;
}

export const STOCK_TABLE_COLUMNS: readonly ScreenerColumnDef<StockColumnId>[] = [
  { id: 'symbol', label: 'Sembol / Ad', locked: true, defaultVisible: true },
  { id: 'market', label: 'Piyasa', defaultVisible: true },
  { id: 'sector', label: 'Sektör', defaultVisible: false },
  { id: 'price', label: 'Fiyat', defaultVisible: true },
  { id: 'changePercent', label: 'Günlük Değişim (%)', defaultVisible: true },
  { id: 'volume', label: 'Hacim', defaultVisible: true },
  { id: 'marketCap', label: 'Piyasa Değeri', defaultVisible: true },
  { id: 'peRatio', label: 'F/K Oranı', defaultVisible: false },
  { id: 'dividendYield', label: 'Temettü (%)', defaultVisible: false },
];

export const FUND_TABLE_COLUMNS: readonly ScreenerColumnDef<FundColumnId>[] = [
  { id: 'code', label: 'Fon Kodu / Ad', locked: true, defaultVisible: true },
  { id: 'price', label: 'Birim Fiyat (TRY)', defaultVisible: true },
  { id: 'dailyReturn', label: 'Günlük (%)', defaultVisible: true },
  { id: 'monthlyReturn', label: '1 Aylık (%)', defaultVisible: true },
  { id: 'periodReturn', label: 'Seçili Dönem (%)', defaultVisible: true },
  { id: 'riskValue', label: 'Risk (1-7)', defaultVisible: true },
  { id: 'managementFee', label: 'Yönetim Ücreti (%)', defaultVisible: false },
  { id: 'category', label: 'Kategori / Kurucu', defaultVisible: false },
];

export const SCREENER_TABLE_PREFS_STORAGE_KEY = 'stockmind.piyasalar.tablePrefs.v1';

export interface ScreenerTablePrefs {
  stockColumns: StockColumnId[];
  fundColumns: FundColumnId[];
  stockSortBy?: StockSortKey;
  stockSortOrder?: SortDirection;
  fundSortBy?: FundSortKey;
  fundSortOrder?: SortDirection;
}

export const DEFAULT_STOCK_COLUMNS: StockColumnId[] = STOCK_TABLE_COLUMNS.filter(
  (c) => c.defaultVisible
).map((c) => c.id);

export const DEFAULT_FUND_COLUMNS: FundColumnId[] = FUND_TABLE_COLUMNS.filter(
  (c) => c.defaultVisible
).map((c) => c.id);

const VALID_STOCK_COL_SET = new Set<StockColumnId>(STOCK_TABLE_COLUMNS.map((c) => c.id));
const VALID_FUND_COL_SET = new Set<FundColumnId>(FUND_TABLE_COLUMNS.map((c) => c.id));

function normalizeColumns<T extends string>(
  raw: unknown,
  validSet: Set<T>,
  requiredId: T,
  defaults: readonly T[]
): T[] {
  if (!Array.isArray(raw)) return [...defaults];
  const deduped: T[] = [];
  for (const item of raw) {
    if (typeof item === 'string' && validSet.has(item as T) && !deduped.includes(item as T)) {
      deduped.push(item as T);
    }
  }
  if (!deduped.includes(requiredId)) deduped.unshift(requiredId);
  return deduped.length > 0 ? deduped : [...defaults];
}

export function toggleColumnSelection<T extends string>(
  current: readonly T[],
  colId: T,
  lockedIds: readonly T[],
  orderedCatalog: readonly ScreenerColumnDef<T>[]
): T[] {
  if (lockedIds.includes(colId)) return [...current];
  const exists = current.includes(colId);
  if (exists && current.length <= 1) return [...current];
  const nextSet = new Set(current);
  if (exists) {
    nextSet.delete(colId);
  } else {
    nextSet.add(colId);
  }
  // Keep display order deterministic matching column catalog order
  return orderedCatalog.filter((c) => nextSet.has(c.id)).map((c) => c.id);
}

export function readScreenerTablePrefs(
  storage?: Pick<Storage, 'getItem'> | null
): ScreenerTablePrefs {
  const store =
    storage !== undefined
      ? storage
      : typeof window !== 'undefined'
      ? window.localStorage
      : null;
  if (!store) {
    return {
      stockColumns: [...DEFAULT_STOCK_COLUMNS],
      fundColumns: [...DEFAULT_FUND_COLUMNS],
    };
  }
  try {
    const raw = store.getItem(SCREENER_TABLE_PREFS_STORAGE_KEY);
    if (!raw) {
      return {
        stockColumns: [...DEFAULT_STOCK_COLUMNS],
        fundColumns: [...DEFAULT_FUND_COLUMNS],
      };
    }
    const parsed = JSON.parse(raw) as Partial<ScreenerTablePrefs>;
    return {
      stockColumns: normalizeColumns(parsed.stockColumns, VALID_STOCK_COL_SET, 'symbol', DEFAULT_STOCK_COLUMNS),
      fundColumns: normalizeColumns(parsed.fundColumns, VALID_FUND_COL_SET, 'code', DEFAULT_FUND_COLUMNS),
      stockSortBy: parsed.stockSortBy,
      stockSortOrder: parsed.stockSortOrder === 'asc' ? 'asc' : parsed.stockSortOrder === 'desc' ? 'desc' : undefined,
      fundSortBy: parsed.fundSortBy,
      fundSortOrder: parsed.fundSortOrder === 'asc' ? 'asc' : parsed.fundSortOrder === 'desc' ? 'desc' : undefined,
    };
  } catch {
    return {
      stockColumns: [...DEFAULT_STOCK_COLUMNS],
      fundColumns: [...DEFAULT_FUND_COLUMNS],
    };
  }
}

export function writeScreenerTablePrefs(
  prefs: ScreenerTablePrefs,
  storage?: Pick<Storage, 'setItem'> | null
): ScreenerTablePrefs {
  const normalized: ScreenerTablePrefs = {
    stockColumns: normalizeColumns(prefs.stockColumns, VALID_STOCK_COL_SET, 'symbol', DEFAULT_STOCK_COLUMNS),
    fundColumns: normalizeColumns(prefs.fundColumns, VALID_FUND_COL_SET, 'code', DEFAULT_FUND_COLUMNS),
    stockSortBy: prefs.stockSortBy,
    stockSortOrder: prefs.stockSortOrder,
    fundSortBy: prefs.fundSortBy,
    fundSortOrder: prefs.fundSortOrder,
  };
  const store =
    storage !== undefined
      ? storage
      : typeof window !== 'undefined'
      ? window.localStorage
      : null;
  if (store) {
    try {
      store.setItem(SCREENER_TABLE_PREFS_STORAGE_KEY, JSON.stringify(normalized));
    } catch {
      // Ignore storage quota restrictions cleanly
    }
  }
  return normalized;
}

function sanitizeTextCell(value: string): string {
  const str = String(value ?? '');
  return /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
}

function escapeCsvCell(value: string | number, isText = false): string {
  const raw = isText ? sanitizeTextCell(String(value)) : String(value);
  if (/[",\r\n]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

function csvRow(cells: Array<{ value: string | number; text?: boolean }>): string {
  return cells.map((cell) => escapeCsvCell(cell.value, Boolean(cell.text))).join(',');
}

export interface ExportableStockRow {
  symbol: string;
  name?: string;
  exchange?: string;
  currency?: string;
  sector?: string;
  price?: number | null;
  changePercent?: number | null;
  volume?: number | null;
  marketCap?: number | null;
  peRatio?: number | null;
  dividendYield?: number | null;
}

export function buildStockScreenerCsv(input: {
  stocks: readonly ExportableStockRow[];
  columns: readonly StockColumnId[];
  market: string;
  filterSummary: string;
  sortBy: string;
  sortOrder: SortDirection;
  now?: Date;
}): string {
  const activeColumns = STOCK_TABLE_COLUMNS.filter((c) => input.columns.includes(c.id));
  const exportedAt = (input.now ?? new Date()).toISOString().slice(0, 10);

  const lines: string[] = [
    csvRow([{ value: 'Tarayıcı Türü', text: true }, { value: `Hisse / Piyasa (${input.market})`, text: true }]),
    csvRow([{ value: 'Aktif Filtreler', text: true }, { value: input.filterSummary || 'Yok', text: true }]),
    csvRow([{ value: 'Sıralama', text: true }, { value: `${input.sortBy} (${input.sortOrder})`, text: true }]),
    csvRow([{ value: 'Kayıt Sayısı', text: true }, { value: input.stocks.length }]),
    csvRow([{ value: 'Tarih', text: true }, { value: exportedAt, text: true }]),
    '',
    csvRow(activeColumns.map((col) => ({ value: col.label, text: true }))),
  ];

  for (const s of input.stocks) {
    lines.push(
      csvRow(
        activeColumns.map((col) => {
          switch (col.id) {
            case 'symbol':
              return { value: s.name ? `${s.symbol} (${s.name})` : s.symbol, text: true };
            case 'market':
              return { value: `${s.exchange || ''} (${s.currency || 'TRY'})`.trim(), text: true };
            case 'sector':
              return { value: s.sector || '', text: true };
            case 'price':
              return { value: typeof s.price === 'number' && Number.isFinite(s.price) ? s.price.toFixed(4) : '' };
            case 'changePercent':
              return { value: typeof s.changePercent === 'number' && Number.isFinite(s.changePercent) ? s.changePercent.toFixed(2) : '' };
            case 'volume':
              return { value: typeof s.volume === 'number' && Number.isFinite(s.volume) ? Math.round(s.volume) : '' };
            case 'marketCap':
              return { value: typeof s.marketCap === 'number' && Number.isFinite(s.marketCap) ? Math.round(s.marketCap) : '' };
            case 'peRatio':
              return { value: typeof s.peRatio === 'number' && Number.isFinite(s.peRatio) ? s.peRatio.toFixed(2) : '' };
            case 'dividendYield':
              return { value: typeof s.dividendYield === 'number' && Number.isFinite(s.dividendYield) ? s.dividendYield.toFixed(2) : '' };
          }
        })
      )
    );
  }

  return `\uFEFF${lines.join('\n')}\n`;
}

export interface ExportableFundRow {
  code: string;
  name?: string;
  category?: string;
  founder?: string;
  price?: number | null;
  dailyReturn?: number | null;
  monthlyReturn?: number | null;
  return3m?: number | null;
  return6m?: number | null;
  ytdReturn?: number | null;
  yearlyReturn?: number | null;
  return3y?: number | null;
  return5y?: number | null;
  riskValue?: number | null;
  managementFee?: number | null;
}

export function buildFundScreenerCsv(input: {
  funds: readonly ExportableFundRow[];
  columns: readonly FundColumnId[];
  returnPeriod: FundReturnPeriod;
  returnPeriodLabel: string;
  filterSummary: string;
  sortBy: string;
  sortOrder: SortDirection;
  now?: Date;
}): string {
  const activeColumns = FUND_TABLE_COLUMNS.filter((c) => input.columns.includes(c.id));
  const exportedAt = (input.now ?? new Date()).toISOString().slice(0, 10);

  const lines: string[] = [
    csvRow([{ value: 'Tarayıcı Türü', text: true }, { value: 'TEFAS Yatırım Fonları', text: true }]),
    csvRow([{ value: 'Aktif Filtreler', text: true }, { value: input.filterSummary || 'Yok', text: true }]),
    csvRow([{ value: 'Sıralama', text: true }, { value: `${input.sortBy} (${input.sortOrder})`, text: true }]),
    csvRow([{ value: 'Kayıt Sayısı', text: true }, { value: input.funds.length }]),
    csvRow([{ value: 'Tarih', text: true }, { value: exportedAt, text: true }]),
    '',
    csvRow(
      activeColumns.map((col) => ({
        value: col.id === 'periodReturn' ? `${input.returnPeriodLabel} (%)` : col.label,
        text: true,
      }))
    ),
  ];

  for (const f of input.funds) {
    lines.push(
      csvRow(
        activeColumns.map((col) => {
          switch (col.id) {
            case 'code':
              return { value: f.name ? `${f.code} (${f.name})` : f.code, text: true };
            case 'price':
              return { value: typeof f.price === 'number' && Number.isFinite(f.price) ? f.price.toFixed(4) : '' };
            case 'dailyReturn':
              return { value: typeof f.dailyReturn === 'number' && Number.isFinite(f.dailyReturn) ? f.dailyReturn.toFixed(2) : '' };
            case 'monthlyReturn':
              return { value: typeof f.monthlyReturn === 'number' && Number.isFinite(f.monthlyReturn) ? f.monthlyReturn.toFixed(2) : '' };
            case 'periodReturn': {
              const periodMap: Record<FundReturnPeriod, number | null | undefined> = {
                dailyReturn: f.dailyReturn,
                monthlyReturn: f.monthlyReturn,
                return3m: f.return3m,
                return6m: f.return6m,
                ytdReturn: f.ytdReturn,
                yearlyReturn: f.yearlyReturn,
                return3y: f.return3y,
                return5y: f.return5y,
              };
              const raw = periodMap[input.returnPeriod];
              return { value: typeof raw === 'number' && Number.isFinite(raw) ? raw.toFixed(2) : '' };
            }
            case 'riskValue':
              return { value: typeof f.riskValue === 'number' && Number.isFinite(f.riskValue) ? f.riskValue : '' };
            case 'managementFee':
              return { value: typeof f.managementFee === 'number' && Number.isFinite(f.managementFee) ? f.managementFee.toFixed(2) : '' };
            case 'category':
              return { value: [f.category, f.founder].filter(Boolean).join(' · '), text: true };
          }
        })
      )
    );
  }

  return `\uFEFF${lines.join('\n')}\n`;
}
