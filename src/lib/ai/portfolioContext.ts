import type { PortfolioSummary } from '@/types/portfolio';

export type PortfolioFieldScope = 'allocation_weights' | 'performance_returns' | 'full_financials';
export type PortfolioFieldScopePreference = 'auto' | PortfolioFieldScope;

export interface PortfolioContextFieldInfo {
  key: string;
  label: string;
  scopes: readonly PortfolioFieldScope[];
}

/**
 * Single source of truth describing the portfolio fields shared with AI chat
 * when the user explicitly opts in to attach portfolio context.
 */
export const PORTFOLIO_CONTEXT_FIELDS: readonly PortfolioContextFieldInfo[] = [
  {
    key: 'holdingsIdentity',
    label: 'Varlık sembolü, adı ve varlık türü',
    scopes: ['allocation_weights', 'performance_returns', 'full_financials'],
  },
  {
    key: 'holdingsWeight',
    label: 'Pozisyon ağırlığı (%)',
    scopes: ['allocation_weights', 'performance_returns', 'full_financials'],
  },
  {
    key: 'returnPercentages',
    label: 'Toplam ve günlük getiri oranları (%)',
    scopes: ['performance_returns', 'full_financials'],
  },
  {
    key: 'totalValue',
    label: 'Portföy toplam değeri, maliyeti ve toplam K/Z tutarı',
    scopes: ['full_financials'],
  },
  {
    key: 'dailyProfitLoss',
    label: 'Günlük kâr/zarar tutarı',
    scopes: ['full_financials'],
  },
  {
    key: 'holdingsMetrics',
    label: 'Adet, ortalama maliyet, güncel fiyat ve pozisyon tutarı',
    scopes: ['full_financials'],
  },
] as const;

export const PORTFOLIO_SCOPE_LABELS: Record<PortfolioFieldScope, string> = {
  allocation_weights: 'Yalnız Dağılım & Ağırlık (Tutar ve maliyet gizli)',
  performance_returns: 'Dağılım & Getiri Yüzdeleri (Tam tutar ve maliyet gizli)',
  full_financials: 'Tam Tutarlar & Maliyet Analizi',
};

export interface AIPortfolioHoldingPayload {
  symbol: string;
  name: string;
  assetType: string;
  weight: number;
  shares?: number;
  averageCost?: number;
  currentPrice?: number;
  totalValue?: number;
  profitLoss?: number;
  profitLossPercent?: number;
}

export interface AIPortfolioContextPayload {
  scope?: PortfolioFieldScope;
  totalValue?: number;
  totalCost?: number;
  totalProfitLoss?: number;
  totalProfitLossPercent?: number;
  dailyProfitLoss?: number;
  dailyProfitLossPercent?: number;
  holdings: AIPortfolioHoldingPayload[];
}

function safeFinite(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

const FULL_FINANCIAL_PATTERNS: readonly RegExp[] = [
  /\bmaliyet/i,
  /\badet\b/i,
  /\blot\b/i,
  /\bhisse say/i,
  /\btutar/i,
  /\bbakiye\b/i,
  /\bnakit\b/i,
  /\bbütçe|\bbutce/i,
  /\bkaç\s+(?:tl|lira|dolar|usd|adet|lot|para)/i,
  /\bne\s+kadar\s+(?:al|sat|ekle|tutar|eder|kazan|kayb|zarar|kar|kâr|yatır|yatir)/i,
  /\btoplam\s+(?:değer|deger|para|maliyet)/i,
  /\bbaşabaş|\bbasabas|\bbreak[-\s]?even/i,
  /\bvergi\b|\bstopaj\b|\bkomisyon\b/i,
  /\bdengele|\brebalance/i,
  /\bortalama\s+düşür|\bortalama\s+dusur|\bekleme\s+yap/i,
];

const PERFORMANCE_RETURN_PATTERNS: readonly RegExp[] = [
  /\bgetiri/i,
  /\bperformans/i,
  /\bk[aâ]r\b|\bzarar\b|\bpnl\b/i,
  /\byüzde\s+kaç|\byuzde\s+kac/i,
  /\bkazand[ıi]r|\bkaybettir/i,
  /\bgünlük\b|\bgunluk\b/i,
  /\bkıyas|\bkiyas|\benflasyon|\bbist\s*100/i,
];

/**
 * Selects the minimum portfolio field scope needed to answer the user's question.
 * Exact TL/USD amounts and unit cost basis are reserved for questions that actually require them.
 */
export function classifyPortfolioQuestionScope(
  question?: string,
  preference: PortfolioFieldScopePreference = 'auto'
): PortfolioFieldScope {
  if (preference !== 'auto') return preference;
  const text = typeof question === 'string' ? question.trim() : '';
  if (!text) return 'full_financials';

  const normalized = text.toLocaleLowerCase('tr-TR');
  if (FULL_FINANCIAL_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return 'full_financials';
  }
  if (PERFORMANCE_RETURN_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return 'performance_returns';
  }
  return 'allocation_weights';
}

export function getPortfolioFieldsForScope(scope: PortfolioFieldScope): readonly PortfolioContextFieldInfo[] {
  return PORTFOLIO_CONTEXT_FIELDS.filter((field) => field.scopes.includes(scope));
}

export interface BuildPortfolioContextOptions {
  prompt?: string;
  scope?: PortfolioFieldScopePreference;
}

/**
 * Builds the sanitized AI portfolio context ONLY when `includePortfolio` is explicitly true.
 * Minimizes exported fields according to question intent so exact balances and unit costs
 * are shared only when the question actually requires financial/cost calculations.
 */
export function buildPortfolioContextPayload(
  summary: PortfolioSummary | null | undefined,
  includePortfolio: boolean,
  options?: string | BuildPortfolioContextOptions
): AIPortfolioContextPayload | undefined {
  if (!includePortfolio || !summary) return undefined;
  const holdings = Array.isArray(summary.holdings) ? summary.holdings : [];
  if (!(summary.totalValue > 0 || holdings.length > 0)) return undefined;

  const resolvedOptions: BuildPortfolioContextOptions =
    typeof options === 'string' ? { prompt: options } : options ?? {};

  const scope: PortfolioFieldScope =
    resolvedOptions.prompt === undefined && (!resolvedOptions.scope || resolvedOptions.scope === 'auto')
      ? 'full_financials'
      : classifyPortfolioQuestionScope(resolvedOptions.prompt, resolvedOptions.scope ?? 'auto');

  const trimmedHoldings = holdings.slice(0, 100);

  if (scope === 'allocation_weights') {
    return {
      scope,
      holdings: trimmedHoldings.map((h) => ({
        symbol: h.symbol,
        name: (h as { name?: string }).name || h.symbol,
        assetType: h.assetType || 'HISSE',
        weight: safeFinite(h.weight),
      })),
    };
  }

  if (scope === 'performance_returns') {
    return {
      scope,
      totalProfitLossPercent: safeFinite(summary.totalPnLPercent),
      dailyProfitLossPercent: safeFinite(summary.dailyPnLPercent),
      holdings: trimmedHoldings.map((h) => ({
        symbol: h.symbol,
        name: (h as { name?: string }).name || h.symbol,
        assetType: h.assetType || 'HISSE',
        weight: safeFinite(h.weight),
        profitLossPercent: safeFinite(h.pnlPercent),
      })),
    };
  }

  return {
    scope: 'full_financials',
    totalValue: safeFinite(summary.totalValue),
    totalCost: safeFinite(summary.totalCost),
    totalProfitLoss: safeFinite(summary.totalPnL),
    totalProfitLossPercent: safeFinite(summary.totalPnLPercent),
    dailyProfitLoss: safeFinite(summary.dailyPnL),
    dailyProfitLossPercent: safeFinite(summary.dailyPnLPercent),
    holdings: trimmedHoldings.map((h) => ({
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
