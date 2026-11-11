import type { TefasFundInfo } from '@/lib/data/funds';
import {
  resolveFundDetailStates,
  type FundAssetAllocationItem,
  type FundHistoryPoint,
} from '@/lib/market/fundDetailState';

export const MIN_COMPARISON_FUNDS = 2;
export const MAX_COMPARISON_FUNDS = 4;

export interface ComparableFundInput extends TefasFundInfo {
  history?: FundHistoryPoint[] | null;
}

export interface NormalizedSeriesPoint {
  date: string;
  price: number;
  indexedValue: number;
}

export interface CommonDateRangeSummary {
  hasCommonRange: boolean;
  startDate: string | null;
  endDate: string | null;
  pointCount: number;
  missingHistoryCodes: string[];
  reason: string | null;
}

export interface FundComparisonColumn {
  code: string;
  name: string;
  category: string;
  founder: string;
  price: number | null;
  navDate: string | null;
  navDateDisplay: string;
  lastSyncAt: string | null;
  dailyReturn: number | null;
  monthlyReturn: number | null;
  return3m: number | null;
  return6m: number | null;
  ytdReturn: number | null;
  yearlyReturn: number | null;
  commonPeriodReturnPct: number | null;
  riskValue: number | null;
  riskDisplay: string;
  riskAvailable: boolean;
  managementFee: number | null;
  managementFeeDisplay: string;
  managementFeeAvailable: boolean;
  totalValue: number | null;
  totalValueDisplay: string;
  investorCount: number | null;
  investorCountDisplay: string;
  allocationItems: FundAssetAllocationItem[];
  allocationDisplay: string;
  allocationAvailable: boolean;
  normalizedSeries: NormalizedSeriesPoint[];
}

export interface FundComparisonAllocationRow {
  category: string;
  percentagesByCode: Record<string, number | null>;
}

export interface FundComparisonResult {
  readyToCompare: boolean;
  countError: string | null;
  commonDateRange: CommonDateRangeSummary;
  columns: FundComparisonColumn[];
  allocationRows: FundComparisonAllocationRow[];
  summaryLeaders: {
    bestCommonReturnCode: string | null;
    lowestRiskCode: string | null;
    lowestFeeCode: string | null;
  };
}

/**
 * Parses comma-separated or repeated fund codes into 0..4 unique uppercase TEFAS codes.
 */
export function parseComparisonCodesParam(
  raw: string | readonly string[] | null | undefined
): string[] {
  const tokens = Array.isArray(raw)
    ? raw.flatMap((entry) => String(entry).split(','))
    : typeof raw === 'string'
      ? raw.split(',')
      : [];

  const unique: string[] = [];
  const seen = new Set<string>();
  for (const token of tokens) {
    const cleaned = token
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
    if (!cleaned || cleaned.length > 10 || seen.has(cleaned)) continue;
    seen.add(cleaned);
    unique.push(cleaned);
    if (unique.length >= MAX_COMPARISON_FUNDS) break;
  }
  return unique;
}

function normalizeDateKey(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  const parsed = Date.parse(trimmed);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString().slice(0, 10);
}

/**
 * Deduplicates and chronologically sorts positive numeric TEFAS history points.
 */
export function normalizeFundHistorySeries(
  history: readonly FundHistoryPoint[] | null | undefined
): FundHistoryPoint[] {
  if (!Array.isArray(history) || history.length === 0) return [];
  const byDate = new Map<string, number>();
  for (const point of history) {
    if (!point || typeof point.date !== 'string') continue;
    const dateKey = normalizeDateKey(point.date);
    const price = Number(point.price);
    if (!dateKey || !Number.isFinite(price) || price <= 0) continue;
    byDate.set(dateKey, price);
  }
  return Array.from(byDate.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, price]) => ({ date, price }));
}

function formatNavDateLabel(navDate: string | null | undefined): string {
  if (!navDate || !navDate.trim()) return 'Değerleme tarihi bilinmiyor';
  const parsed = Date.parse(navDate);
  if (!Number.isFinite(parsed)) return navDate.trim();
  return new Date(parsed).toLocaleDateString('tr-TR', {
    timeZone: 'UTC',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Computes aligned common-date-range returns, risk, fee, asset allocation, and valuation date
 * columns for 2 to 4 TEFAS funds.
 */
export function buildFundComparisonMatrix(
  funds: readonly ComparableFundInput[]
): FundComparisonResult {
  const deduplicated: ComparableFundInput[] = [];
  const seen = new Set<string>();
  for (const fund of funds) {
    const code = (fund.code || '').trim().toUpperCase();
    if (!code || seen.has(code)) continue;
    seen.add(code);
    deduplicated.push({ ...fund, code });
    if (deduplicated.length >= MAX_COMPARISON_FUNDS) break;
  }

  let countError: string | null = null;
  if (deduplicated.length < MIN_COMPARISON_FUNDS) {
    countError = `Karşılaştırma için en az ${MIN_COMPARISON_FUNDS} fon seçilmelidir.`;
  } else if (funds.length > MAX_COMPARISON_FUNDS) {
    countError = `Aynı anda en fazla ${MAX_COMPARISON_FUNDS} fon karşılaştırılabilir.`;
  }

  const normalizedByCode = new Map<string, FundHistoryPoint[]>();
  const missingHistoryCodes: string[] = [];

  for (const fund of deduplicated) {
    const series = normalizeFundHistorySeries(fund.history);
    normalizedByCode.set(fund.code, series);
    if (series.length < 2) {
      missingHistoryCodes.push(fund.code);
    }
  }

  let commonDateRange: CommonDateRangeSummary = {
    hasCommonRange: false,
    startDate: null,
    endDate: null,
    pointCount: 0,
    missingHistoryCodes,
    reason: null,
  };

  if (deduplicated.length >= MIN_COMPARISON_FUNDS && missingHistoryCodes.length === 0) {
    const firstDates = deduplicated.map((f) => normalizedByCode.get(f.code)![0].date);
    const lastDates = deduplicated.map((f) => {
      const s = normalizedByCode.get(f.code)!;
      return s[s.length - 1].date;
    });
    const startDate = firstDates.reduce((a, b) => (a > b ? a : b));
    const endDate = lastDates.reduce((a, b) => (a < b ? a : b));

    if (startDate >= endDate) {
      commonDateRange = {
        hasCommonRange: false,
        startDate: null,
        endDate: null,
        pointCount: 0,
        missingHistoryCodes: [],
        reason: 'Seçilen fonların fiyat geçmişleri ortak bir tarih aralığında kesişmiyor.',
      };
    } else {
      const slices = new Map<string, FundHistoryPoint[]>();
      const sparseCodes: string[] = [];
      for (const fund of deduplicated) {
        const sliced = (normalizedByCode.get(fund.code) ?? []).filter(
          (p) => p.date >= startDate && p.date <= endDate
        );
        slices.set(fund.code, sliced);
        if (sliced.length < 2) sparseCodes.push(fund.code);
      }

      if (sparseCodes.length > 0) {
        commonDateRange = {
          hasCommonRange: false,
          startDate,
          endDate,
          pointCount: 0,
          missingHistoryCodes: sparseCodes,
          reason: `Ortak tarih aralığında (${startDate} – ${endDate}) ${sparseCodes.join(', ')} için yeterli veri noktası yok.`,
        };
      } else {
        const allDates = new Set<string>();
        for (const sliced of slices.values()) {
          for (const pt of sliced) allDates.add(pt.date);
        }
        commonDateRange = {
          hasCommonRange: true,
          startDate,
          endDate,
          pointCount: allDates.size,
          missingHistoryCodes: [],
          reason: null,
        };
      }
    }
  } else if (deduplicated.length >= MIN_COMPARISON_FUNDS && missingHistoryCodes.length > 0) {
    commonDateRange = {
      hasCommonRange: false,
      startDate: null,
      endDate: null,
      pointCount: 0,
      missingHistoryCodes,
      reason: `${missingHistoryCodes.join(', ')} için ortak dönem getirisi hesaplanacak yeterli fiyat geçmişi bulunamadı.`,
    };
  }

  const columns: FundComparisonColumn[] = deduplicated.map((fund) => {
    const detail = resolveFundDetailStates(fund);
    const fullSeries = normalizedByCode.get(fund.code) ?? [];
    let normalizedSeries: NormalizedSeriesPoint[] = [];
    let commonPeriodReturnPct: number | null = null;

    if (commonDateRange.hasCommonRange && commonDateRange.startDate && commonDateRange.endDate) {
      const sliced = fullSeries.filter(
        (p) => p.date >= commonDateRange.startDate! && p.date <= commonDateRange.endDate!
      );
      if (sliced.length >= 2) {
        const basePrice = sliced[0].price;
        const lastPrice = sliced[sliced.length - 1].price;
        normalizedSeries = sliced.map((p) => ({
          date: p.date,
          price: p.price,
          indexedValue: Number(((p.price / basePrice) * 100).toFixed(2)),
        }));
        commonPeriodReturnPct = Number((((lastPrice - basePrice) / basePrice) * 100).toFixed(2));
      }
    }

    const hasPrice = typeof fund.price === 'number' && Number.isFinite(fund.price) && fund.price > 0;

    return {
      code: fund.code,
      name: fund.name,
      category: fund.category,
      founder: fund.founder,
      price: hasPrice ? fund.price : null,
      navDate: typeof fund.navDate === 'string' && fund.navDate.trim() ? fund.navDate.trim() : null,
      navDateDisplay: formatNavDateLabel(fund.navDate),
      lastSyncAt: typeof fund.lastSyncAt === 'string' ? fund.lastSyncAt : null,
      dailyReturn: hasPrice ? finiteOrNull(fund.dailyReturn) : null,
      monthlyReturn: hasPrice ? finiteOrNull(fund.monthlyReturn) : null,
      return3m: hasPrice ? finiteOrNull(fund.return3m) : null,
      return6m: hasPrice ? finiteOrNull(fund.return6m) : null,
      ytdReturn: hasPrice ? finiteOrNull(fund.ytdReturn) : null,
      yearlyReturn: hasPrice ? finiteOrNull(fund.yearlyReturn) : null,
      commonPeriodReturnPct,
      riskValue: detail.risk.value,
      riskDisplay: detail.risk.displayText,
      riskAvailable: detail.risk.available,
      managementFee:
        detail.managementFee.available && typeof fund.managementFee === 'number'
          ? fund.managementFee
          : null,
      managementFeeDisplay: detail.managementFee.displayText,
      managementFeeAvailable: detail.managementFee.available,
      totalValue: typeof fund.totalValue === 'number' && Number.isFinite(fund.totalValue) ? fund.totalValue : null,
      totalValueDisplay: detail.totalValue.displayText,
      investorCount:
        typeof fund.investorCount === 'number' && Number.isFinite(fund.investorCount) ? fund.investorCount : null,
      investorCountDisplay: detail.investorCount.displayText,
      allocationItems: detail.assetAllocation.items,
      allocationDisplay: detail.assetAllocation.displayText,
      allocationAvailable: detail.assetAllocation.available,
      normalizedSeries,
    };
  });

  // Build unified row-aligned asset allocation table
  const allocationCategoryWeights = new Map<string, number>();
  for (const col of columns) {
    for (const item of col.allocationItems) {
      const prevMax = allocationCategoryWeights.get(item.category) ?? 0;
      if (item.percentage > prevMax) {
        allocationCategoryWeights.set(item.category, item.percentage);
      }
    }
  }

  const allocationRows: FundComparisonAllocationRow[] = Array.from(allocationCategoryWeights.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'tr-TR'))
    .map(([category]) => {
      const percentagesByCode: Record<string, number | null> = {};
      for (const col of columns) {
        const match = col.allocationItems.find((item) => item.category === category);
        percentagesByCode[col.code] = match ? match.percentage : null;
      }
      return { category, percentagesByCode };
    });

  let bestCommonReturnCode: string | null = null;
  let bestCommonReturnVal = -Infinity;
  let lowestRiskCode: string | null = null;
  let lowestRiskVal = Infinity;
  let lowestFeeCode: string | null = null;
  let lowestFeeVal = Infinity;

  for (const col of columns) {
    if (col.commonPeriodReturnPct !== null && col.commonPeriodReturnPct > bestCommonReturnVal) {
      bestCommonReturnVal = col.commonPeriodReturnPct;
      bestCommonReturnCode = col.code;
    }
    if (col.riskValue !== null && col.riskValue < lowestRiskVal) {
      lowestRiskVal = col.riskValue;
      lowestRiskCode = col.code;
    }
    if (col.managementFee !== null && col.managementFee < lowestFeeVal) {
      lowestFeeVal = col.managementFee;
      lowestFeeCode = col.code;
    }
  }

  return {
    readyToCompare: deduplicated.length >= MIN_COMPARISON_FUNDS && deduplicated.length <= MAX_COMPARISON_FUNDS,
    countError,
    commonDateRange,
    columns,
    allocationRows,
    summaryLeaders: {
      bestCommonReturnCode,
      lowestRiskCode,
      lowestFeeCode,
    },
  };
}

export type SimilarFundMatchType =
  | 'same_category_and_risk'
  | 'same_category'
  | 'similar_risk';

export interface SimilarFundRecommendation {
  code: string;
  name: string;
  category: string;
  founder: string;
  price: number | null;
  dailyReturn: number | null;
  yearlyReturn: number | null;
  riskValue: number | null;
  managementFee: number | null;
  matchType: SimilarFundMatchType;
  matchReasons: string[];
  matchReasonText: string;
  score: number;
}

function isValidRisk(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 1 && value <= 7;
}

/**
 * Recommends comparable TEFAS funds matched by identical category and/or similar risk level (±1),
 * returning an explicit human-readable reason for every match.
 */
export function findSimilarFunds(
  target: Pick<TefasFundInfo, 'code' | 'category' | 'riskValue' | 'founder'>,
  candidates: readonly TefasFundInfo[],
  options?: { limit?: number; excludeCodes?: readonly string[] }
): SimilarFundRecommendation[] {
  const limit = Math.max(1, Math.min(20, options?.limit ?? 6));
  const targetCode = (target.code || '').trim().toUpperCase();
  const excluded = new Set<string>([targetCode, 'SYS_BROADCAST']);
  for (const extra of options?.excludeCodes ?? []) {
    const cleaned = extra.trim().toUpperCase();
    if (cleaned) excluded.add(cleaned);
  }

  const targetCategory = (target.category || '').trim();
  const targetCategoryLower = targetCategory.toLocaleLowerCase('tr-TR');
  const targetRisk = isValidRisk(target.riskValue) ? Math.round(target.riskValue) : null;

  const scored: SimilarFundRecommendation[] = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    const code = (candidate.code || '').trim().toUpperCase();
    if (!code || excluded.has(code) || seen.has(code)) continue;
    seen.add(code);

    const candCategory = (candidate.category || '').trim();
    const sameCategory =
      Boolean(targetCategoryLower) &&
      candCategory.toLocaleLowerCase('tr-TR') === targetCategoryLower;

    const candRisk = isValidRisk(candidate.riskValue) ? Math.round(candidate.riskValue) : null;
    const riskDiff =
      targetRisk !== null && candRisk !== null ? Math.abs(candRisk - targetRisk) : null;
    const similarRisk = riskDiff !== null && riskDiff <= 1;

    if (!sameCategory && !similarRisk) continue;

    const matchReasons: string[] = [];
    let score = 0;

    if (sameCategory) {
      matchReasons.push(`Aynı kategori (${candCategory})`);
      score += 40;
    }

    if (similarRisk && candRisk !== null) {
      if (riskDiff === 0) {
        matchReasons.push(`Aynı risk düzeyi (${candRisk}/7)`);
        score += 35;
      } else {
        matchReasons.push(`Benzer risk düzeyi (${candRisk}/7, ±1 fark)`);
        score += 20;
      }
    }

    if (typeof candidate.price === 'number' && Number.isFinite(candidate.price) && candidate.price > 0) {
      score += 8;
    }
    if (typeof candidate.totalValue === 'number' && Number.isFinite(candidate.totalValue) && candidate.totalValue > 0) {
      score += 5;
    }

    const matchType: SimilarFundMatchType =
      sameCategory && similarRisk
        ? 'same_category_and_risk'
        : sameCategory
          ? 'same_category'
          : 'similar_risk';

    scored.push({
      code,
      name: candidate.name,
      category: candCategory || 'Diğer',
      founder: candidate.founder,
      price: typeof candidate.price === 'number' && Number.isFinite(candidate.price) ? candidate.price : null,
      dailyReturn:
        candidate.price != null && typeof candidate.dailyReturn === 'number' && Number.isFinite(candidate.dailyReturn)
          ? candidate.dailyReturn
          : null,
      yearlyReturn:
        candidate.price != null && typeof candidate.yearlyReturn === 'number' && Number.isFinite(candidate.yearlyReturn)
          ? candidate.yearlyReturn
          : null,
      riskValue: candRisk,
      managementFee:
        typeof candidate.managementFee === 'number' && Number.isFinite(candidate.managementFee)
          ? candidate.managementFee
          : null,
      matchType,
      matchReasons,
      matchReasonText: matchReasons.join(' • '),
      score,
    });
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.code.localeCompare(b.code, 'tr-TR');
  });

  return scored.slice(0, limit);
}
