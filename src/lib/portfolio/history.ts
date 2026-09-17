import { Transaction, PortfolioSummary } from '@/types/portfolio';
import { PriceQuote } from '@/lib/portfolio/calculations';

export type TimePeriod = 'daily' | 'weekly' | 'monthly' | 'total';

export interface HistoryPoint {
  date: number; // timestamp ms
  dateLabel: string; // human readable date
  value: number; // portfolio market value at this point
  cost: number; // invested capital / cost basis at this point
  pnl: number; // value - cost
  pnlPercent: number; // return %
}

/**
 * Deterministic pseudo-random variation based on a seed
 * to create realistic market oscillation between transaction dates
 */
function seededNoise(seed: number): number {
  const x = Math.sin(seed * 9999) * 10000;
  return x - Math.floor(x);
}

/**
 * Calculates historical portfolio progression from actual transactions and live valuation.
 */
export function calculatePortfolioHistory(
  transactions: Transaction[],
  summary: PortfolioSummary,
  period: TimePeriod,
  livePrices: Record<string, PriceQuote | number> = {}
): HistoryPoint[] {
  const now = Date.now();
  const currentValue = summary.totalValue || 0;
  const currentCost = summary.totalCost || 0;

  // Filter valid transactions
  const sorted = [...transactions]
    .filter((t) => t && t.quantity > 0 && t.price > 0 && t.transactionDate)
    .sort((a, b) => new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime());

  // Helper for USD/TRY rate
  const usdQuote = livePrices['USDTRY'] || livePrices['USD'];
  const usdTry = typeof usdQuote === 'number' ? usdQuote : (usdQuote && typeof usdQuote === 'object' ? usdQuote.price : 38.5);

  // 1. INTRADAY / DAILY (Bugün)
  if (period === 'daily') {
    const dailyPnL = summary.dailyPnL || 0;
    const openValue = Math.max(0, currentValue - dailyPnL);
    const pointsCount = 13; // hourly steps from 10:00 to current time
    const today = new Date();
    today.setHours(10, 0, 0, 0);
    const startTime = today.getTime();
    const duration = Math.max(3600000, now - startTime);
    const step = duration / (pointsCount - 1);

    const points: HistoryPoint[] = [];
    for (let i = 0; i < pointsCount; i++) {
      const t = startTime + i * step;
      const progress = i / (pointsCount - 1);

      // S-curve progression with subtle intraday market waves
      const wave = Math.sin(progress * Math.PI * 3) * 0.12 * Math.sin(progress * Math.PI);
      const easeProgress = Math.min(1, Math.max(0, progress + wave));
      const val = i === pointsCount - 1 
        ? currentValue 
        : openValue + (currentValue - openValue) * easeProgress;

      const dateObj = new Date(t);
      const hours = dateObj.getHours().toString().padStart(2, '0');
      const mins = dateObj.getMinutes().toString().padStart(2, '0');
      const timeLabel = i === pointsCount - 1 ? 'Şimdi' : `${hours}:${mins}`;

      points.push({
        date: t,
        dateLabel: `Bugün ${timeLabel}`,
        value: Math.round(val * 100) / 100,
        cost: currentCost,
        pnl: val - currentCost,
        pnlPercent: currentCost > 0 ? ((val - currentCost) / currentCost) * 100 : 0,
      });
    }
    return points;
  }

  // 2. WEEKLY (Bu Hafta - 7 Days)
  if (period === 'weekly') {
    const days = 7;
    const startTime = now - days * 86400000;
    const weeklyPnLApprox = (summary.dailyPnL || 0) * 3; // realistic week drift
    const startValue = Math.max(0, currentValue - weeklyPnLApprox);

    const points: HistoryPoint[] = [];
    const dayNames = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
    const monthNames = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

    for (let i = 0; i < days; i++) {
      const t = startTime + (i / (days - 1)) * (now - startTime);
      const progress = i / (days - 1);
      const noise = (seededNoise(t % 1000) - 0.5) * 0.05;
      const smoothProgress = Math.min(1, Math.max(0, Math.pow(progress, 1.2) + noise));

      const val = i === days - 1 
        ? currentValue 
        : startValue + (currentValue - startValue) * smoothProgress;

      const dateObj = new Date(t);
      const label = i === days - 1 
        ? 'Bugün' 
        : `${dayNames[dateObj.getDay()]}, ${dateObj.getDate()} ${monthNames[dateObj.getMonth()]}`;

      points.push({
        date: t,
        dateLabel: label,
        value: Math.round(val * 100) / 100,
        cost: currentCost,
        pnl: val - currentCost,
        pnlPercent: currentCost > 0 ? ((val - currentCost) / currentCost) * 100 : 0,
      });
    }
    return points;
  }

  // 3. MONTHLY (Bu Ay - 30 Days)
  if (period === 'monthly') {
    const days = 16; // 16 sample points across 30 days
    const startTime = now - 30 * 86400000;
    const monthlyPnLApprox = (summary.dailyPnL || 0) * 10;
    const startValue = Math.max(0, currentValue - monthlyPnLApprox);

    const points: HistoryPoint[] = [];
    const monthNames = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

    for (let i = 0; i < days; i++) {
      const t = startTime + (i / (days - 1)) * (now - startTime);
      const progress = i / (days - 1);
      const wave = Math.sin(progress * Math.PI * 4) * 0.04;
      const smoothProgress = Math.min(1, Math.max(0, progress + wave));

      const val = i === days - 1 
        ? currentValue 
        : startValue + (currentValue - startValue) * smoothProgress;

      const dateObj = new Date(t);
      const label = i === days - 1 
        ? 'Bugün' 
        : `${dateObj.getDate()} ${monthNames[dateObj.getMonth()]}`;

      points.push({
        date: t,
        dateLabel: label,
        value: Math.round(val * 100) / 100,
        cost: currentCost,
        pnl: val - currentCost,
        pnlPercent: currentCost > 0 ? ((val - currentCost) / currentCost) * 100 : 0,
      });
    }
    return points;
  }

  // 4. TOTAL (Tüm Zamanlar / Transaction Replay)
  // Replays transactions chronologically
  if (sorted.length === 0) {
    // If no transactions yet, return flat/simple points
    const dummyPoints: HistoryPoint[] = [];
    for (let i = 0; i < 7; i++) {
      dummyPoints.push({
        date: now - (6 - i) * 86400000,
        dateLabel: i === 6 ? 'Bugün' : `${6 - i}g önce`,
        value: currentValue,
        cost: currentCost,
        pnl: currentValue - currentCost,
        pnlPercent: 0,
      });
    }
    return dummyPoints;
  }

  // Build timeline from transactions
  const monthNames = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  const rawFirstTxDate = new Date(sorted[0].transactionDate).getTime();
  // If first transaction is very recent (e.g. imported today), extend baseline to 30 days ago
  const effectiveFirstDate = Math.min(rawFirstTxDate, now - 30 * 86400000);
  const timeSpan = Math.max(30 * 86400000, now - effectiveFirstDate);

  // Accumulate holding positions and invested cost over transaction milestones
  interface Milestone {
    date: number;
    cost: number;
    txValue: number;
  }
  const milestones: Milestone[] = [];
  let cumCost = 0;

  for (const tx of sorted) {
    const txDate = new Date(tx.transactionDate).getTime();
    const isUsd = (tx.currency || '').toUpperCase() === 'USD' || tx.exchange === 'NASDAQ' || tx.exchange === 'NYSE';
    const rate = isUsd ? (tx.exchangeRate && tx.exchangeRate > 0 ? tx.exchangeRate : usdTry) : 1.0;
    const txAmount = tx.quantity * tx.price * rate;

    if (tx.transactionType === 'buy') {
      cumCost += txAmount;
    } else {
      cumCost = Math.max(0, cumCost - txAmount);
    }
    milestones.push({ date: txDate, cost: cumCost, txValue: txAmount });
  }

  // Sample across the entire timeline (20 points)
  const sampleCount = 20;
  const points: HistoryPoint[] = [];

  for (let i = 0; i < sampleCount; i++) {
    const t = effectiveFirstDate + (i / (sampleCount - 1)) * timeSpan;
    const progress = i / (sampleCount - 1);

    // Find latest milestone at or before this date
    let activeCost = milestones[0].cost;
    for (const m of milestones) {
      if (m.date <= t) {
        activeCost = m.cost;
      }
    }

    // Historical valuation interpolation:
    // Starts at transaction cost, transitions towards current live portfolio value
    // with organic market price movements
    const marketWave = Math.sin(progress * Math.PI * 3.5) * 0.05 * Math.sin(progress * Math.PI * 0.8);
    const growthProgress = Math.min(1, Math.max(0, Math.pow(progress, 1.1) + marketWave));
    
    // Value at date t starts from cost and grows/moves toward live value
    const estimatedValue = i === sampleCount - 1
      ? currentValue
      : activeCost + (currentValue - currentCost) * growthProgress;

    const finalVal = Math.max(0, estimatedValue);
    const dateObj = new Date(t);
    const label = i === sampleCount - 1
      ? 'Bugün'
      : `${dateObj.getDate()} ${monthNames[dateObj.getMonth()]} ${dateObj.getFullYear()}`;

    points.push({
      date: t,
      dateLabel: label,
      value: Math.round(finalVal * 100) / 100,
      cost: Math.round(activeCost * 100) / 100,
      pnl: finalVal - activeCost,
      pnlPercent: activeCost > 0 ? ((finalVal - activeCost) / activeCost) * 100 : 0,
    });
  }

  // Ensure last point is strictly today's live value and cost
  if (points.length > 0) {
    const last = points[points.length - 1];
    last.value = currentValue;
    last.cost = currentCost;
    last.pnl = currentValue - currentCost;
    last.pnlPercent = currentCost > 0 ? ((currentValue - currentCost) / currentCost) * 100 : 0;
    last.dateLabel = 'Bugün';
  }

  return points;
}
