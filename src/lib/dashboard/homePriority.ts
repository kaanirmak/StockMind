import { Holding } from '@/types/portfolio';
import { rankNews } from '@/lib/news/relevance';

export const DASHBOARD_MOBILE_SECTION_ORDER = [
  'portfolio-summary',
  'daily-contributors-and-event',
  'portfolio-heatmap',
  'market-overview',
  'activity-grid',
  'widgets-promo',
] as const;

export interface DailyContributorItem {
  symbol: string;
  assetType: Holding['assetType'];
  dailyPnL: number;
  dailyChangePercent: number;
  currentValue: number;
  weight: number;
  href: string;
}

export interface DashboardEventArticle {
  id: string;
  title: string;
  summary: string;
  source: string;
  publishedAt: string;
  url: string;
  relatedSymbols?: string[];
}

export interface TopImportantEventResult {
  article: DashboardEventArticle;
  event: string | undefined;
  matchedSymbols: string[];
  priority: number;
}

export function buildHoldingHref(holding: Pick<Holding, 'symbol' | 'assetType'>): string {
  return holding.assetType === 'fund'
    ? `/funds/${encodeURIComponent(holding.symbol)}`
    : `/stocks/${encodeURIComponent(holding.symbol)}`;
}

export function computeHoldingDailyPnL(holding: Holding): number {
  if (holding.priceMissing) return 0;
  if (typeof holding.dailyPnL === 'number' && Number.isFinite(holding.dailyPnL)) {
    return Number(holding.dailyPnL.toFixed(2));
  }
  const changePct = holding.dailyReturnPercent ?? holding.dailyChangePercent;
  if (typeof changePct === 'number' && Number.isFinite(changePct) && holding.currentValue > 0 && changePct !== -100) {
    const prevValue = holding.currentValue / (1 + changePct / 100);
    return Number((holding.currentValue - prevValue).toFixed(2));
  }
  return 0;
}

/**
 * Extract top daily portfolio contributors ranked by absolute TRY impact so
 * mobile users immediately see what drove today's P&L.
 */
export function extractDailyContributors(
  holdings: readonly Holding[],
  limit = 4,
): DailyContributorItem[] {
  return holdings
    .filter((holding) => !holding.priceMissing && holding.totalQuantity > 0)
    .map((holding) => {
      const dailyPnL = computeHoldingDailyPnL(holding);
      const changePct = holding.dailyReturnPercent ?? holding.dailyChangePercent ?? 0;
      return {
        symbol: holding.symbol,
        assetType: holding.assetType,
        dailyPnL,
        dailyChangePercent: Number.isFinite(changePct) ? Number(changePct.toFixed(2)) : 0,
        currentValue: Number.isFinite(holding.currentValue) ? holding.currentValue : 0,
        weight: Number.isFinite(holding.weight) ? holding.weight : 0,
        href: buildHoldingHref(holding),
      };
    })
    .sort((a, b) => Math.abs(b.dailyPnL) - Math.abs(a.dailyPnL) || Math.abs(b.dailyChangePercent) - Math.abs(a.dailyChangePercent))
    .slice(0, Math.max(0, limit));
}

export function selectTopImportantEvent<T extends DashboardEventArticle>(
  articles: readonly T[],
  portfolioSymbols: readonly string[],
  now = Date.now(),
): TopImportantEventResult | null {
  if (!articles.length) return null;
  const ranked = rankNews(articles, portfolioSymbols, true, now);
  const top = ranked[0];
  if (!top) return null;
  return {
    article: top.article,
    event: top.event,
    matchedSymbols: top.matchedSymbols,
    priority: top.priority,
  };
}
