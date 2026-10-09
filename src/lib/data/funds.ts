import { FundCategory } from '@/types/fund';
import { calculateFuzzyScore } from '@/lib/utils/search';
import TEFAS_DIRECTORY from './tefas_funds_directory.json';
import { createAdminClient } from '@/lib/supabase/admin';

export interface TefasFundInfo {
  code: string;
  name: string;
  category: FundCategory;
  founder: string;
  price: number;
  dailyReturn: number;
  monthlyReturn: number;
  return3m: number;
  return6m: number;
  ytdReturn: number;
  yearlyReturn: number;
  return3y: number;
  return5y: number;
  riskValue: number; // 1 to 7
  totalValue: number; // AUM in TRY
  investorCount: number;
  managementFee: number; // % annual
  assetAllocation: {
    category: string;
    percentage: number;
  }[];
  kapLink?: string;
  lastSyncAt?: string;
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
  price: 1.0,
  dailyReturn: 0,
  monthlyReturn: 0,
  return3m: 0,
  return6m: 0,
  ytdReturn: 0,
  yearlyReturn: 0,
  return3y: 0,
  return5y: 0,
  riskValue:
    item.category === 'Para Piyasası Fonu'
      ? 1
      : item.category === 'Borçlanma Araçları Fonu'
      ? 3
      : item.category === 'Hisse Senedi Fonu'
      ? 6
      : item.category === 'Fon Sepeti Fonu'
      ? 7
      : 5,
  totalValue: 0,
  investorCount: 0,
  managementFee: 2.0,
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
  const supabase = createAdminClient();
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

  let mapped: TefasFundInfo[] = data.map((row: any) => ({
    code: row.code,
    name: row.name,
    category: row.category as FundCategory,
    founder: row.founder,
    price: Number(row.price),
    dailyReturn: Number(row.daily_return || 0),
    monthlyReturn: Number(row.monthly_return || 0),
    return3m: Number(row.return_3m || 0),
    return6m: Number(row.return_6m || 0),
    ytdReturn: Number(row.ytd_return || 0),
    yearlyReturn: Number(row.yearly_return || 0),
    return3y: Number(row.return_3y || 0),
    return5y: Number(row.return_5y || 0),
    riskValue: Number(row.risk_value || 5),
    totalValue: Number(row.total_value || 0),
    investorCount: Number(row.investor_count || 0),
    managementFee: Number(row.management_fee || 2),
    assetAllocation: row.asset_allocation || [],
    kapLink: row.kap_link,
    lastSyncAt: row.last_sync_at,
  }));

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
}

/**
 * Fetch single fund detail from database with price history
 */
export async function getFundByCodeFromDatabase(code: string): Promise<TefasFundInfo | null> {
  const sym = code.toUpperCase().trim();
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('funds')
    .select('*')
    .eq('code', sym)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    code: data.code,
    name: data.name,
    category: data.category as FundCategory,
    founder: data.founder,
    price: Number(data.price),
    dailyReturn: Number(data.daily_return || 0),
    monthlyReturn: Number(data.monthly_return || 0),
    return3m: Number(data.return_3m || 0),
    return6m: Number(data.return_6m || 0),
    ytdReturn: Number(data.ytd_return || 0),
    yearlyReturn: Number(data.yearly_return || 0),
    return3y: Number(data.return_3y || 0),
    return5y: Number(data.return_5y || 0),
    riskValue: Number(data.risk_value || 5),
    totalValue: Number(data.total_value || 0),
    investorCount: Number(data.investor_count || 0),
    managementFee: Number(data.management_fee || 2),
    assetAllocation: data.asset_allocation || [],
    kapLink: data.kap_link,
    lastSyncAt: data.last_sync_at,
  };
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
    price: 1.0,
    dailyReturn: 0,
    monthlyReturn: 0,
    return3m: 0,
    return6m: 0,
    ytdReturn: 0,
    yearlyReturn: 0,
    return3y: 0,
    return5y: 0,
    riskValue:
      dirEntry.category === 'Para Piyasası Fonu'
        ? 1
        : dirEntry.category === 'Borçlanma Araçları Fonu'
        ? 3
        : dirEntry.category === 'Hisse Senedi Fonu'
        ? 6
        : dirEntry.category === 'Fon Sepeti Fonu'
        ? 7
        : 5,
    totalValue: 0,
    investorCount: 0,
    managementFee: 2.0,
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
      if (filter.minRisk && fund.riskValue < filter.minRisk) continue;
      if (filter.maxRisk && fund.riskValue > filter.maxRisk) continue;

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
    if (filter?.minRisk && fund.riskValue < filter.minRisk) return false;
    if (filter?.maxRisk && fund.riskValue > filter.maxRisk) return false;
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

export function generateFundHistory(code: string, days: number = 90, basePrice?: number) {
  const fund = getFundByCode(code);
  const endPrice = basePrice || (fund ? fund.price : 1.0);
  const history = [];
  const now = new Date();

  let price = endPrice * 0.92;

  for (let i = days; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);

    if (d.getDay() === 0 || d.getDay() === 6) continue;

    const dateStr = d.toISOString().split('T')[0];
    const change = Math.sin(i * 0.2 + (fund?.riskValue || 5)) * 0.005 + 0.001;
    price = price * (1 + change);

    history.push({
      date: dateStr,
      price: Number(price.toFixed(4)),
    });
  }

  if (history.length > 0) {
    history[history.length - 1].price = Number(endPrice.toFixed(4));
  }

  return history;
}
