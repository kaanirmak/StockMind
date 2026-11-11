import type { PortfolioSummary } from '@/types/portfolio';

export interface PortfolioContextFieldInfo {
  key: string;
  label: string;
}

/**
 * Single source of truth describing the portfolio fields shared with AI chat
 * when the user explicitly opts in to attach portfolio context.
 */
export const PORTFOLIO_CONTEXT_FIELDS: readonly PortfolioContextFieldInfo[] = [
  { key: 'totalValue', label: 'Portföy toplam değeri, maliyeti ve toplam K/Z' },
  { key: 'dailyProfitLoss', label: 'Günlük kâr/zarar tutarı ve yüzdesi' },
  { key: 'holdingsIdentity', label: 'Varlık sembolü, adı ve varlık türü' },
  { key: 'holdingsMetrics', label: 'Adet, ortalama maliyet, güncel fiyat, pozisyon değeri, K/Z ve ağırlık' },
] as const;

export interface AIPortfolioHoldingPayload {
  symbol: string;
  name: string;
  assetType: string;
  shares: number;
  averageCost: number;
  currentPrice: number;
  totalValue: number;
  profitLoss: number;
  profitLossPercent: number;
  weight: number;
}

export interface AIPortfolioContextPayload {
  totalValue: number;
  totalCost: number;
  totalProfitLoss: number;
  totalProfitLossPercent: number;
  dailyProfitLoss: number;
  dailyProfitLossPercent: number;
  holdings: AIPortfolioHoldingPayload[];
}

function safeFinite(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/**
 * Builds the sanitized AI portfolio context ONLY when `includePortfolio` is explicitly true.
 * Returns `undefined` for general queries so portfolio details leave the browser only by opt-in.
 */
export function buildPortfolioContextPayload(
  summary: PortfolioSummary | null | undefined,
  includePortfolio: boolean
): AIPortfolioContextPayload | undefined {
  if (!includePortfolio || !summary) return undefined;
  const holdings = Array.isArray(summary.holdings) ? summary.holdings : [];
  if (!(summary.totalValue > 0 || holdings.length > 0)) return undefined;

  return {
    totalValue: safeFinite(summary.totalValue),
    totalCost: safeFinite(summary.totalCost),
    totalProfitLoss: safeFinite(summary.totalPnL),
    totalProfitLossPercent: safeFinite(summary.totalPnLPercent),
    dailyProfitLoss: safeFinite(summary.dailyPnL),
    dailyProfitLossPercent: safeFinite(summary.dailyPnLPercent),
    holdings: holdings.slice(0, 100).map((h) => ({
      symbol: h.symbol,
      name: (h as { name?: string }).name || h.symbol,
      assetType: h.assetType || 'HISSE',
      shares: Math.max(0, safeFinite(h.totalQuantity)),
      averageCost: Math.max(0, safeFinite(h.averageCost)),
      currentPrice: Math.max(0, safeFinite(h.currentPrice)),
      totalValue: Math.max(0, safeFinite(h.currentValue)),
      profitLoss: safeFinite(h.pnl),
      profitLossPercent: safeFinite(h.pnlPercent),
      weight: safeFinite(h.weight),
    })),
  };
}
