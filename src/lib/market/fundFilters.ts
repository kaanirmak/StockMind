import type { TefasFundInfo } from '@/lib/data/funds';
import type { FundSortKey, SortDirection } from '@/lib/market/marketFilterPersistence';

export type FundRiskRange = 'ALL' | 'LOW' | 'MEDIUM' | 'HIGH';
export type FundFeeTier = 'ALL' | 'LOW' | 'MID' | 'HIGH';
export type FundReturnPeriod =
  | 'dailyReturn'
  | 'monthlyReturn'
  | 'return3m'
  | 'return6m'
  | 'ytdReturn'
  | 'yearlyReturn'
  | 'return3y'
  | 'return5y';
export type FundReturnThreshold =
  | 'ALL'
  | 'POSITIVE'
  | 'ABOVE_10'
  | 'ABOVE_25'
  | 'ABOVE_50'
  | 'NEGATIVE';

export interface FundFilterCriteria {
  category?: string;
  search?: string;
  riskRange?: FundRiskRange;
  minRisk?: number | null;
  maxRisk?: number | null;
  feeTier?: FundFeeTier;
  maxFee?: number | null;
  returnPeriod?: FundReturnPeriod;
  returnThreshold?: FundReturnThreshold;
  minReturn?: number | null;
  watchlistOnly?: boolean;
  isWatchlisted?: (code: string) => boolean;
}

export const FUND_RISK_RANGE_OPTIONS: readonly { id: FundRiskRange; label: string }[] = [
  { id: 'ALL', label: 'Tüm Riskler' },
  { id: 'LOW', label: 'Düşük Risk (1-2)' },
  { id: 'MEDIUM', label: 'Orta Risk (3-4)' },
  { id: 'HIGH', label: 'Yüksek Risk (5-7)' },
];

export const FUND_FEE_TIER_OPTIONS: readonly { id: FundFeeTier; label: string }[] = [
  { id: 'ALL', label: 'Tüm Ücretler' },
  { id: 'LOW', label: 'Düşük Ücret (≤ %1.0)' },
  { id: 'MID', label: 'Orta Ücret (%1.0 – %2.0)' },
  { id: 'HIGH', label: 'Yüksek Ücret (> %2.0)' },
];

export const FUND_RETURN_PERIOD_OPTIONS: readonly { id: FundReturnPeriod; label: string; shortLabel: string }[] = [
  { id: 'dailyReturn', label: 'Günlük Getiri', shortLabel: 'Günlük' },
  { id: 'monthlyReturn', label: '1 Aylık Getiri', shortLabel: '1 Ay' },
  { id: 'return3m', label: '3 Aylık Getiri', shortLabel: '3 Ay' },
  { id: 'return6m', label: '6 Aylık Getiri', shortLabel: '6 Ay' },
  { id: 'ytdReturn', label: 'Yılbaşı (YTD)', shortLabel: 'YTD' },
  { id: 'yearlyReturn', label: '1 Yıllık Getiri', shortLabel: '1 Yıl' },
  { id: 'return3y', label: '3 Yıllık Getiri', shortLabel: '3 Yıl' },
  { id: 'return5y', label: '5 Yıllık Getiri', shortLabel: '5 Yıl' },
];

export const FUND_RETURN_THRESHOLD_OPTIONS: readonly { id: FundReturnThreshold; label: string }[] = [
  { id: 'ALL', label: 'Tüm Getiriler' },
  { id: 'POSITIVE', label: 'Pozitif (> %0)' },
  { id: 'ABOVE_10', label: '≥ %10 Getiri' },
  { id: 'ABOVE_25', label: '≥ %25 Getiri' },
  { id: 'ABOVE_50', label: '≥ %50 Getiri' },
  { id: 'NEGATIVE', label: 'Negatif (< %0)' },
];

export function resolveRiskBounds(criteria: Pick<FundFilterCriteria, 'riskRange' | 'minRisk' | 'maxRisk'>): {
  min: number | null;
  max: number | null;
} {
  let min = typeof criteria.minRisk === 'number' && Number.isFinite(criteria.minRisk) ? criteria.minRisk : null;
  let max = typeof criteria.maxRisk === 'number' && Number.isFinite(criteria.maxRisk) ? criteria.maxRisk : null;

  if (criteria.riskRange === 'LOW') {
    min = min !== null ? Math.max(min, 1) : 1;
    max = max !== null ? Math.min(max, 2) : 2;
  } else if (criteria.riskRange === 'MEDIUM') {
    min = min !== null ? Math.max(min, 3) : 3;
    max = max !== null ? Math.min(max, 4) : 4;
  } else if (criteria.riskRange === 'HIGH') {
    min = min !== null ? Math.max(min, 5) : 5;
    max = max !== null ? Math.min(max, 7) : 7;
  }

  return { min, max };
}

export function getFundPeriodReturn(fund: TefasFundInfo, period: FundReturnPeriod): number | null {
  if (fund.price === null || !Number.isFinite(fund.price) || fund.price <= 0) {
    return null;
  }
  const value = fund[period];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function matchesFundReturnFilter(
  value: number | null,
  threshold: FundReturnThreshold | undefined,
  minReturn?: number | null
): boolean {
  const hasMin = typeof minReturn === 'number' && Number.isFinite(minReturn);
  const hasThreshold = Boolean(threshold && threshold !== 'ALL');
  if (!hasMin && !hasThreshold) return true;
  if (value === null) return false;

  if (hasMin && value < (minReturn as number)) {
    return false;
  }

  switch (threshold) {
    case 'POSITIVE':
      return value > 0;
    case 'ABOVE_10':
      return value >= 10;
    case 'ABOVE_25':
      return value >= 25;
    case 'ABOVE_50':
      return value >= 50;
    case 'NEGATIVE':
      return value < 0;
    case 'ALL':
    default:
      return true;
  }
}

export function matchesFundFeeFilter(
  managementFee: number | null | undefined,
  feeTier: FundFeeTier | undefined,
  maxFee?: number | null
): boolean {
  const hasMax = typeof maxFee === 'number' && Number.isFinite(maxFee);
  const hasTier = Boolean(feeTier && feeTier !== 'ALL');
  if (!hasMax && !hasTier) return true;
  if (typeof managementFee !== 'number' || !Number.isFinite(managementFee) || managementFee < 0) {
    return false;
  }

  if (hasMax && managementFee > (maxFee as number)) {
    return false;
  }

  switch (feeTier) {
    case 'LOW':
      return managementFee <= 1.0;
    case 'MID':
      return managementFee > 1.0 && managementFee <= 2.0;
    case 'HIGH':
      return managementFee > 2.0;
    case 'ALL':
    default:
      return true;
  }
}

export function filterFundsCombinatorially(
  funds: readonly TefasFundInfo[],
  criteria: FundFilterCriteria
): TefasFundInfo[] {
  const category = criteria.category?.trim();
  const query = criteria.search?.trim().toLocaleLowerCase('tr-TR') || '';
  const { min: minRisk, max: maxRisk } = resolveRiskBounds(criteria);
  const period: FundReturnPeriod = criteria.returnPeriod ?? 'yearlyReturn';

  return funds.filter((fund) => {
    if (criteria.watchlistOnly && criteria.isWatchlisted && !criteria.isWatchlisted(fund.code)) {
      return false;
    }

    if (category && category !== 'ALL' && fund.category !== category) {
      return false;
    }

    if (query.length > 0) {
      const codeMatch = fund.code.toLocaleLowerCase('tr-TR').includes(query);
      const nameMatch = fund.name.toLocaleLowerCase('tr-TR').includes(query);
      const founderMatch = (fund.founder || '').toLocaleLowerCase('tr-TR').includes(query);
      if (!codeMatch && !nameMatch && !founderMatch) {
        return false;
      }
    }

    if (minRisk !== null || maxRisk !== null) {
      if (typeof fund.riskValue !== 'number' || !Number.isFinite(fund.riskValue)) {
        return false;
      }
      if (minRisk !== null && fund.riskValue < minRisk) return false;
      if (maxRisk !== null && fund.riskValue > maxRisk) return false;
    }

    if (!matchesFundFeeFilter(fund.managementFee, criteria.feeTier, criteria.maxFee)) {
      return false;
    }

    const periodValue = getFundPeriodReturn(fund, period);
    if (!matchesFundReturnFilter(periodValue, criteria.returnThreshold, criteria.minReturn)) {
      return false;
    }

    return true;
  });
}

export function sortFundsByField(
  funds: readonly TefasFundInfo[],
  sortBy: FundSortKey | FundReturnPeriod,
  order: SortDirection
): TefasFundInfo[] {
  return [...funds].sort((a, b) => {
    const rawA = a[sortBy as keyof TefasFundInfo];
    const rawB = b[sortBy as keyof TefasFundInfo];
    const numA = typeof rawA === 'number' && Number.isFinite(rawA) ? rawA : null;
    const numB = typeof rawB === 'number' && Number.isFinite(rawB) ? rawB : null;

    if (numA === null && numB === null) return 0;
    if (numA === null) return 1;
    if (numB === null) return -1;

    return order === 'desc' ? numB - numA : numA - numB;
  });
}

export function countActiveFundFilters(criteria: FundFilterCriteria): number {
  let count = 0;
  if (criteria.category && criteria.category !== 'ALL') count += 1;
  if (criteria.riskRange && criteria.riskRange !== 'ALL') count += 1;
  if (criteria.feeTier && criteria.feeTier !== 'ALL') count += 1;
  if (criteria.returnThreshold && criteria.returnThreshold !== 'ALL') count += 1;
  if (criteria.search && criteria.search.trim().length > 0) count += 1;
  if (criteria.watchlistOnly) count += 1;
  return count;
}
