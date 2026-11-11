import type { Holding } from '@/types/portfolio';
import { buildHoldingHref } from './homePriority';

export type HeatmapMetricType = 'daily' | 'total';
export type HeatmapViewMode = 'treemap' | 'list';

export const HEATMAP_DEFAULT_EXPANDED = false;

export interface HeatmapAssetRow {
  holding: Holding;
  symbol: string;
  assetType: Holding['assetType'];
  href: string;
  currentValue: number;
  weightPercent: number;
  metricValue: number;
}

export interface HeatmapCompactSummary {
  assetCount: number;
  positiveCount: number;
  negativeCount: number;
  flatCount: number;
  topHolding: HeatmapAssetRow | null;
  strongestGainer: HeatmapAssetRow | null;
  strongestLoser: HeatmapAssetRow | null;
}

type LivePriceEntry = number | { price?: number; changePercent?: number } | undefined;

export function resolveHoldingDailyChangePercent(
  holding: Holding,
  livePrices: Record<string, LivePriceEntry>,
): number {
  if (typeof holding.dailyChangePercent === 'number' && Number.isFinite(holding.dailyChangePercent)) {
    return holding.dailyChangePercent;
  }
  const quote = livePrices[holding.symbol] || livePrices[holding.symbol.toUpperCase()];
  if (quote && typeof quote === 'object' && typeof quote.changePercent === 'number' && Number.isFinite(quote.changePercent)) {
    return quote.changePercent;
  }
  return 0;
}

export function buildHeatmapRows(
  holdings: readonly Holding[],
  livePrices: Record<string, LivePriceEntry>,
  metric: HeatmapMetricType,
): HeatmapAssetRow[] {
  const positiveHoldings = holdings.filter((h) => h.currentValue > 0);
  if (positiveHoldings.length === 0) return [];

  const totalValue = positiveHoldings.reduce((acc, h) => acc + h.currentValue, 0);

  return positiveHoldings
    .map((holding) => {
      const dailyPct = resolveHoldingDailyChangePercent(holding, livePrices);
      const metricValue = metric === 'daily' ? dailyPct : holding.pnlPercent;
      const weightPercent = totalValue > 0 ? (holding.currentValue / totalValue) * 100 : 0;

      return {
        holding,
        symbol: holding.symbol,
        assetType: holding.assetType,
        href: buildHoldingHref(holding),
        currentValue: holding.currentValue,
        weightPercent,
        metricValue: Number.isFinite(metricValue) ? metricValue : 0,
      };
    })
    .sort((a, b) => b.currentValue - a.currentValue);
}

export function buildHeatmapCompactSummary(rows: readonly HeatmapAssetRow[]): HeatmapCompactSummary {
  if (rows.length === 0) {
    return {
      assetCount: 0,
      positiveCount: 0,
      negativeCount: 0,
      flatCount: 0,
      topHolding: null,
      strongestGainer: null,
      strongestLoser: null,
    };
  }

  let positiveCount = 0;
  let negativeCount = 0;
  let flatCount = 0;
  let strongestGainer: HeatmapAssetRow | null = null;
  let strongestLoser: HeatmapAssetRow | null = null;

  for (const row of rows) {
    if (row.metricValue > 0.005) positiveCount += 1;
    else if (row.metricValue < -0.005) negativeCount += 1;
    else flatCount += 1;

    if (!strongestGainer || row.metricValue > strongestGainer.metricValue) {
      strongestGainer = row;
    }
    if (!strongestLoser || row.metricValue < strongestLoser.metricValue) {
      strongestLoser = row;
    }
  }

  return {
    assetCount: rows.length,
    positiveCount,
    negativeCount,
    flatCount,
    topHolding: rows[0] ?? null,
    strongestGainer: strongestGainer && strongestGainer.metricValue > 0 ? strongestGainer : null,
    strongestLoser: strongestLoser && strongestLoser.metricValue < 0 ? strongestLoser : null,
  };
}
