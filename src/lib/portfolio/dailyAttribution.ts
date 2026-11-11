import type { AssetType } from '@/types/portfolio';

export interface RawDailyAttributionInputItem {
  symbol: string;
  assetType: AssetType;
  rawGainTry: number;
  openingBaseTry: number;
  currentValueTry: number;
  assetDailyReturnPercent: number;
}

export interface DailyAssetAttributionItem {
  symbol: string;
  assetType: AssetType;
  contributionTry: number;
  contributionPercentPoints: number;
  assetDailyReturnPercent: number;
  openingBaseTry: number;
  currentValueTry: number;
}

export interface DailyAttributionReport {
  dailyBaseTry: number;
  totalDailyPnL: number;
  totalDailyReturnPercent: number;
  totalContributionTry: number;
  totalContributionPercentPoints: number;
  reconciled: boolean;
  reconciliationDiffTry: number;
  reconciliationDiffPercentPoints: number;
  positiveContributors: DailyAssetAttributionItem[];
  negativeContributors: DailyAssetAttributionItem[];
  allContributors: DailyAssetAttributionItem[];
}

/**
 * Builds a daily asset attribution breakdown whose TRY and percentage-point sums
 * reconcile directly against the portfolio's total daily result.
 */
export function buildDailyAttributionReport(input: {
  items: ReadonlyArray<RawDailyAttributionInputItem>;
  dailyBaseTry: number;
  totalDailyPnL: number;
  totalDailyReturnPercent: number;
}): DailyAttributionReport {
  const base = Number.isFinite(input.dailyBaseTry) && input.dailyBaseTry > 0 ? input.dailyBaseTry : 0;

  let rawGainSum = 0;
  let rawPctPointSum = 0;

  const allContributors: DailyAssetAttributionItem[] = input.items
    .map((item) => {
      const rawGain = Number.isFinite(item.rawGainTry) ? item.rawGainTry : 0;
      const rawPctPts = base > 0 ? (rawGain / base) * 100 : 0;
      rawGainSum += rawGain;
      rawPctPointSum += rawPctPts;

      return {
        symbol: item.symbol,
        assetType: item.assetType,
        contributionTry: Number(rawGain.toFixed(2)),
        contributionPercentPoints: Number(rawPctPts.toFixed(2)),
        assetDailyReturnPercent: Number.isFinite(item.assetDailyReturnPercent)
          ? Number(item.assetDailyReturnPercent.toFixed(2))
          : 0,
        openingBaseTry: Number((item.openingBaseTry || 0).toFixed(2)),
        currentValueTry: Number((item.currentValueTry || 0).toFixed(2)),
      };
    })
    .sort((a, b) => Math.abs(b.contributionTry) - Math.abs(a.contributionTry));

  const positiveContributors = allContributors
    .filter((item) => item.contributionTry > 0)
    .sort((a, b) => b.contributionTry - a.contributionTry);

  const negativeContributors = allContributors
    .filter((item) => item.contributionTry < 0)
    .sort((a, b) => a.contributionTry - b.contributionTry);

  const totalContributionTry = Number(rawGainSum.toFixed(2));
  const totalContributionPercentPoints = Number(rawPctPointSum.toFixed(2));
  const totalDailyPnL = Number((input.totalDailyPnL || 0).toFixed(2));
  const totalDailyReturnPercent = Number((input.totalDailyReturnPercent || 0).toFixed(2));

  const reconciliationDiffTry = Number(Math.abs(totalContributionTry - totalDailyPnL).toFixed(2));
  const reconciliationDiffPercentPoints = Number(
    Math.abs(totalContributionPercentPoints - totalDailyReturnPercent).toFixed(2)
  );

  return {
    dailyBaseTry: Number(base.toFixed(2)),
    totalDailyPnL,
    totalDailyReturnPercent,
    totalContributionTry,
    totalContributionPercentPoints,
    reconciled: reconciliationDiffTry <= 0.02 && reconciliationDiffPercentPoints <= 0.02,
    reconciliationDiffTry,
    reconciliationDiffPercentPoints,
    positiveContributors,
    negativeContributors,
    allContributors,
  };
}

/**
 * Formats percentage points explicitly (e.g. "+1,25 puan", "-0,40 puan", "0,00 puan").
 */
export function formatContributionPoints(points: number): string {
  const safe = Number.isFinite(points) ? (Math.abs(points) < 0.005 ? 0 : points) : 0;
  const sign = safe > 0 ? '+' : safe < 0 ? '-' : '';
  const absFormatted = Math.abs(safe).toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${sign}${absFormatted} puan`;
}
