import { createClient } from '@supabase/supabase-js';
import { FundCategory } from '@/types/fund';
import { MarketPriceObservation } from '@/types/stock';
import { calculateFuzzyScore } from '@/lib/utils/search';
import TEFAS_DIRECTORY from './tefas_funds_directory.json';

export function getSupabaseFundsClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !key || supabaseUrl.includes('placeholder')) {
    return null;
  }
  try {
    return createClient(supabaseUrl, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  } catch {
    return null;
  }
}

export interface TefasFundInfo {
  code: string;
  name: string;
  category: FundCategory;
  founder: string;
  price: number | null;
  dailyReturn: number;
  monthlyReturn: number;
  return3m: number;
  return6m: number;
  ytdReturn: number;
  yearlyReturn: number;
  return3y: number;
  return5y: number;
  riskValue: number | null; // 1 to 7
  totalValue: number | null; // AUM in TRY
  investorCount: number | null;
  managementFee: number | null; // % annual
  assetAllocation: {
    category: string;
    percentage: number;
  }[];
  kapLink?: string;
  navDate?: string | null;
  lastSyncAt?: string;
  observation?: MarketPriceObservation | null;
}

export function buildFundObservation(
  price: number | null,
  dailyReturn: unknown,
  navDate: string | null | undefined,
  fetchedAt: string | null | undefined
): MarketPriceObservation | null {
  if (price === null || !Number.isFinite(price) || price <= 0) {
    return null;
  }
  if (typeof fetchedAt !== 'string' || !Number.isFinite(Date.parse(fetchedAt))) {
    return null;
  }
  const change = typeof dailyReturn === 'number' && Number.isFinite(dailyReturn) ? dailyReturn : null;
  return {
    source: 'TEFAS',
    asOf: typeof navDate === 'string' && navDate.trim().length > 0 ? navDate.trim() : null,
    fetchedAt,
    changePercent: change,
  };
}

function readStoredFundPrice(value: unknown, lastSyncAt: unknown): number | null {
  const price = typeof value === 'number' || typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(price) && price > 0 && typeof lastSyncAt === 'string' &&
    Number.isFinite(Date.parse(lastSyncAt)) ? price : null;
}

function mapDatabaseFundRow(row: any): TefasFundInfo {
  const price = readStoredFundPrice(row.price, row.last_sync_at);
  const dailyReturn = Number(row.daily_return || 0);
  const navDate = row.nav_date ?? null;
  return {
    code: row.code,
    name: row.name,
    category: row.category as FundCategory,
    founder: row.founder,
    price,
    dailyReturn,
    monthlyReturn: Number(row.monthly_return || 0),
    return3m: Number(row.return_3m || 0),
    return6m: Number(row.return_6m || 0),
    ytdReturn: Number(row.ytd_return || 0),
    yearlyReturn: Number(row.yearly_return || 0),
    return3y: Number(row.return_3y || 0),
    return5y: Number(row.return_5y || 0),
    riskValue:
      row.risk_value != null && Number(row.risk_value) >= 1 && Number(row.risk_value) <= 7
        ? Number(row.risk_value)
        : null,
    totalValue:
      row.total_value != null && Number(row.total_value) > 0 ? Number(row.total_value) : null,
    investorCount:
      row.investor_count != null && Number(row.investor_count) > 0
        ? Number(row.investor_count)
        : null,
    managementFee:
      row.management_fee != null &&
      Number.isFinite(Number(row.management_fee)) &&
      Number(row.management_fee) >= 0
        ? Number(row.management_fee)
        : null,
    assetAllocation: Array.isArray(row.asset_allocation) ? row.asset_allocation : [],
    kapLink: row.kap_link,
    navDate,
    lastSyncAt: row.last_sync_at,
    observation: buildFundObservation(price, dailyReturn, navDate, row.last_sync_at),
  };
}

/**
 * Base directory of all registered TEFAS funds
 */
export const TEFAS_FUNDS: TefasFundInfo[] = (
  TEFAS_DIRECTORY as { code: string; name: string; founder: string; category: FundCategory }[]
).map((item) => ({
  code: item.code.toUpperCase(),
  name: item.name,
  category: item.category,
  founder: item.founder,
  price: null,
  dailyReturn: 0,
  monthlyReturn: 0,
  return3m: 0,
  return6m: 0,
  ytdReturn: 0,
  yearlyReturn: 0,
  return3y: 0,
  return5y: 0,
  riskValue: null,
  totalValue: null,
  investorCount: null,
  managementFee: null,
  assetAllocation: [],
  kapLink: `https://www.kap.org.tr/tr/fon-bilgileri/genel/${item.code.toLowerCase()}`,
}));

/**
 * Fetch all funds from Supabase DB, with search, category and risk filters
 */
export async function getFundsFromDatabase(filter?: {
  category?: string;
  search?: string;
  minRisk?: number;
  maxRisk?: number;
  sortBy?: string;
  order?: 'asc' | 'desc';
  limit?: number;
}): Promise<TefasFundInfo[]> {
  try {
    const supabase = getSupabaseFundsClient();
    if (!supabase) return [];

    let query = supabase.from('funds').select('*').neq('code', 'SYS_BROADCAST');

  if (filter?.category && filter.category !== 'ALL') {
    query = query.eq('category', filter.category);
  }

  if (filter?.minRisk) {
    query = query.gte('risk_value', filter.minRisk);
  }

  if (filter?.maxRisk) {
    query = query.lte('risk_value', filter.maxRisk);
  }

  if (filter?.sortBy) {
    query = query.order(filter.sortBy, { ascending: filter.order === 'asc' });
  } else {
    query = query.order('total_value', { ascending: false });
  }

  if (filter?.limit && filter.limit > 0) {
    query = query.limit(filter.limit);
  }

  const { data, error } = await query;

  if (error || !data || data.length === 0) {
    return [];
  }

  let mapped: TefasFundInfo[] = data.map(mapDatabaseFundRow);

  if (filter?.search && filter.search.trim().length > 0) {
    const q = filter.search.trim();
    const scoredList: { fund: TefasFundInfo; score: number }[] = [];

    for (const fund of mapped) {
      const score = calculateFuzzyScore(q, fund.code, fund.name, [fund.founder, fund.category]);
      if (score > 0) {
        scoredList.push({ fund, score });
      }
    }

    scoredList.sort((a, b) => b.score - a.score);
    return scoredList.map((item) => item.fund);
  }

  return mapped;
  } catch (err) {
    console.error('getFundsFromDatabase error:', err);
    return [];
  }
}

/**
 * Fetch single fund detail from database with price history
 */
export async function getFundByCodeFromDatabase(code: string): Promise<TefasFundInfo | null> {
  try {
    const sym = code.toUpperCase().trim();
    const supabase = getSupabaseFundsClient();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('funds')
      .select('*')
      .eq('code', sym)
      .maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapDatabaseFundRow(data);
  } catch (err) {
    console.error('getFundByCodeFromDatabase error:', err);
    return null;
  }
}

/**
 * Synchronous in-memory lookup from directory (fallback when offline / indexing)
 */
export function getFundByCode(code: string): TefasFundInfo | null {
  const sym = code.toUpperCase().trim();
  const dirEntry = (TEFAS_DIRECTORY as { code: string; name: string; founder: string; category: FundCategory }[]).find(
    (f) => f.code === sym
  );

  if (!dirEntry) return null;

  return {
    code: sym,
    name: dirEntry.name,
    category: dirEntry.category,
    founder: dirEntry.founder,
    price: null,
    dailyReturn: 0,
    monthlyReturn: 0,
    return3m: 0,
    return6m: 0,
    ytdReturn: 0,
    yearlyReturn: 0,
    return3y: 0,
    return5y: 0,
    riskValue: null,
    totalValue: null,
    investorCount: null,
    managementFee: null,
    assetAllocation: [],
    kapLink: `https://www.kap.org.tr/tr/fon-bilgileri/genel/${sym.toLowerCase()}`,
  };
}

export function getAllFunds(filter?: {
  category?: string;
  search?: string;
  minRisk?: number;
  maxRisk?: number;
}): TefasFundInfo[] {
  let list = TEFAS_FUNDS;

  if (filter?.search && filter.search.trim().length > 0) {
    const q = filter.search.trim();
    const scoredList: { fund: TefasFundInfo; score: number }[] = [];

    for (const fund of list) {
      if (filter.category && filter.category !== 'ALL' && fund.category !== filter.category) continue;
      if (filter.minRisk && (fund.riskValue == null || fund.riskValue < filter.minRisk)) continue;
      if (filter.maxRisk && (fund.riskValue == null || fund.riskValue > filter.maxRisk)) continue;

      const score = calculateFuzzyScore(q, fund.code, fund.name, [fund.founder, fund.category]);
      if (score > 0) {
        scoredList.push({ fund, score });
      }
    }

    scoredList.sort((a, b) => b.score - a.score);
    return scoredList.map((item) => item.fund);
  }

  return list.filter((fund) => {
    if (filter?.category && filter.category !== 'ALL' && fund.category !== filter.category) return false;
    if (filter?.minRisk && (fund.riskValue == null || fund.riskValue < filter.minRisk)) return false;
    if (filter?.maxRisk && (fund.riskValue == null || fund.riskValue > filter.maxRisk)) return false;
    return true;
  });
}

/**
 * Live TEFAS fund detail fetcher
 */
export async function fetchTefasLiveFundDetail(code: string): Promise<TefasFundInfo | null> {
  const { fetchTefasLiveDetail } = await import('@/lib/api/tefas');
  const live = await fetchTefasLiveDetail(code);
  return live || getFundByCode(code);
}

/**
 * @deprecated Removed synthetic history generation per DATA-01 / FIN-07.
 * Real history must come from TEFAS or database snapshots, never fabricated via sine-waves.
 */
export function generateFundHistory(_code: string, _days: number = 90, _basePrice?: number): { date: string; price: number }[] {
  return [];
}

