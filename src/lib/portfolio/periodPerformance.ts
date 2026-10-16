import type { Transaction } from '@/types/portfolio';
import { calculatePortfolioHoldings, calculatePortfolioSummary, cleanSymbol, type PriceQuote } from '@/lib/portfolio/calculations';

export type PerformancePeriod = 'daily' | 'weekly' | 'monthly' | 'total';
export type PriceHistoryMap = Record<string, Record<string, number>>;
export interface PeriodPerformance { pnl: number; pnlPercent: number; available: boolean; missing: string[] }
export const PERIOD_LABELS: Record<PerformancePeriod, string> = { daily: 'Bugün', weekly: 'Bu Hafta', monthly: 'Bu Ay', total: 'Toplam' };
export function istanbulDate(date: Date | string): string {
  if (typeof date === 'string' && !date.includes('T')) return date.slice(0, 10);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date(date));
}
export function periodStart(period: 'weekly' | 'monthly', now = new Date()): string {
  const today = istanbulDate(now);
  if (period === 'monthly') return `${today.slice(0, 7)}-01`;
  const date = new Date(`${today}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  return date.toISOString().slice(0, 10);
}
export function calculatePeriodPerformance(transactions: Transaction[], prices: Record<string, PriceQuote | number>, history: PriceHistoryMap, period: PerformancePeriod, now = new Date()): PeriodPerformance {
  const today = istanbulDate(now);
  const effective = transactions.filter(t => istanbulDate(t.transactionDate) <= today);
  const current = calculatePortfolioSummary(effective, prices);
  const missing = [...(current.valuationStatus?.missingPrices || []), ...(current.valuationStatus?.stalePrices || [])];
  if (current.valuationStatus?.missingFx) missing.push('USDTRY');
  if (period === 'daily' || period === 'total') return {
    pnl: period === 'daily' ? current.dailyPnL : current.totalPnL,
    pnlPercent: period === 'daily' ? current.dailyPnLPercent : current.totalPnLPercent,
    available: missing.length === 0, missing,
  };
  const start = periodStart(period, now);
  const priorTransactions = effective.filter(t => istanbulDate(t.transactionDate) < start);
  const opening = calculatePortfolioHoldings(priorTransactions, prices);
  // A historical baseline cannot validate a stale current fund NAV.
  for (const h of current.holdings.filter(h => h.assetType === 'fund')) {
    const latest = Object.keys(history[h.symbol] || {}).filter(d => d <= today).sort().pop();
    if (!latest || Date.parse(today) - Date.parse(latest) > 7 * 86400000) missing.push(`${h.symbol} (güncel fiyat)`);
  }
  const baselinePrices: Record<string, PriceQuote> = {};
  const closeBefore = (symbol: string) => {
    const rows = history[symbol] || {};
    const date = Object.keys(rows).filter(d => d < start && rows[d] > 0 && Number.isFinite(rows[d])).sort().pop();
    if (!date || (Date.parse(start) - Date.parse(date)) > 10 * 86400000) { missing.push(symbol); return 0; }
    return rows[date];
  };
  for (const h of opening) baselinePrices[h.symbol] = { price: closeBefore(h.symbol), changePercent: 0 };
  if (opening.some(h => h.originalCurrency === 'USD')) baselinePrices.USDTRY = { price: closeBefore('USDTRY'), changePercent: 0 };
  const periodTrades = effective.filter(t => istanbulDate(t.transactionDate) >= start);
  for (const t of periodTrades) {
    if (t.transactionType === 'split') missing.push('Bölünme düzeltilmiş dönem fiyatı');
    const exchange = cleanSymbol(t.symbol).exchange;
    if ((t.currency === 'USD' || t.exchange === 'NASDAQ' || t.exchange === 'NYSE' || exchange === 'NASDAQ' || exchange === 'NYSE') && !(t.exchangeRate && t.exchangeRate > 0)) missing.push('İşlem kuru');
  }
  if (missing.length) return { pnl: 0, pnlPercent: 0, available: false, missing: [...new Set(missing)] };
  const baseline = calculatePortfolioSummary(priorTransactions, baselinePrices);
  const pnl = current.totalPnL - baseline.totalPnL;
  const newCapital = periodTrades.filter(t => t.transactionType === 'buy').reduce((sum, t) => sum + (t.quantity * t.price + (t.commission || 0)) * (t.currency === 'USD' || t.exchange === 'NASDAQ' || t.exchange === 'NYSE' || ['NASDAQ', 'NYSE'].includes(cleanSymbol(t.symbol).exchange || '') ? t.exchangeRate || 1 : 1), 0);
  const base = baseline.totalValue > 0 ? baseline.totalValue : newCapital;
  return { pnl: Number(pnl.toFixed(2)), pnlPercent: base > 0 ? pnl / base * 100 : 0, available: true, missing: [] };
}
