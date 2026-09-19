import { Transaction, PortfolioSummary } from '@/types/portfolio';

export interface HistoricalHoldingSnapshot {
  symbol: string;
  assetType: 'stock' | 'fund';
  quantity: number;
  averageCost: number;
  totalCost: number;
  todayTransactions?: {
    type: 'buy' | 'sell';
    quantity: number;
    price: number;
  }[];
}

export interface DayPnLRecord {
  date: string; // YYYY-MM-DD
  timestamp: number;
  dayOfWeek: number; // 0 = Mon, ..., 6 = Sun (ISO-like)
  dayName: string;
  isWeekend: boolean;
  isFuture: boolean;
  isToday: boolean;
  hasRealData: boolean; // True only if real market price history, live store, or snapshot exists
  pnl: number; // in TRY
  pnlPercent: number; // e.g. +1.25 or -0.80
  portfolioValue: number;
  portfolioCost: number;
  transactionsCount: number;
  transactionsSymbols: string[];
  level: number; // -4 to +4 (4 is highest profit, -4 is highest loss, 0 is neutral)
  holdingsAtDate: HistoricalHoldingSnapshot[];
}

export interface HeatmapStats {
  totalTradingDays: number;
  profitableDays: number;
  lossDays: number;
  neutralDays: number;
  winRate: number; // percentage, e.g. 64.2
  currentStreak: {
    type: 'win' | 'loss' | 'neutral';
    count: number;
  };
  longestWinStreak: number;
  longestLossStreak: number;
  bestDay: {
    date: string;
    pnl: number;
    pnlPercent: number;
  } | null;
  worstDay: {
    date: string;
    pnl: number;
    pnlPercent: number;
  } | null;
  totalPeriodPnL: number;
  totalPeriodPnLPercent: number;
  averageDailyPnL: number;
}

export interface HeatmapData {
  days: DayPnLRecord[];
  weeks: DayPnLRecord[][]; // 53 weeks x 7 days
  monthHeaders: { name: string; weekIndex: number }[];
  stats: HeatmapStats;
}

/**
 * Format Date to YYYY-MM-DD
 */
export function formatISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const TR_MONTHS_SHORT = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const TR_DAYS_SHORT = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

/**
 * Generate 100% REAL Daily PnL Heatmap
 * - Strictly NO random or simulated data.
 * - Uses live portfolio data for today.
 * - Uses real historical closing price maps (from BIST / TEFAS APIs) when available.
 * - Uses real recorded daily closing snapshots from localStorage.
 * - Replays actual transaction history to determine held assets per day.
 */
export function getPortfolioDailyActivity(
  portfolioId: string,
  summary: PortfolioSummary,
  transactions: Transaction[],
  timeframe: '1Y' | '6M' | 'YTD' = '1Y',
  priceHistoryMap: Record<string, Record<string, number>> = {}
): HeatmapData {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = formatISODate(today);

  // 1. Determine date range
  let startDate = new Date(today);
  if (timeframe === '1Y') {
    startDate.setDate(today.getDate() - 364); // ~52 weeks
  } else if (timeframe === '6M') {
    startDate.setDate(today.getDate() - 182); // ~26 weeks
  } else {
    // YTD
    startDate = new Date(today.getFullYear(), 0, 1);
  }

  // Adjust startDate to Monday so columns align cleanly (Mon = 0, Sun = 6)
  const startDayOfWeek = (startDate.getDay() + 6) % 7;
  startDate.setDate(startDate.getDate() - startDayOfWeek);

  // 2. Load stored real daily snapshots from localStorage
  const storageKey = `stockmind_daily_snapshots_${portfolioId}`;
  let savedSnapshots: Record<string, { pnl: number; pnlPercent: number; value: number }> = {};
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) savedSnapshots = JSON.parse(raw);
    } catch {
      // ignore
    }

    // Automatically persist today's real live snapshot
    if (summary && summary.totalValue > 0) {
      savedSnapshots[todayStr] = {
        pnl: summary.dailyPnL || 0,
        pnlPercent: summary.dailyPnLPercent || 0,
        value: summary.totalValue,
      };
      try {
        localStorage.setItem(storageKey, JSON.stringify(savedSnapshots));
      } catch {
        // ignore storage quota error
      }
    }
  }

  // 3. Map transactions by date
  const txByDate: Record<string, { count: number; symbols: string[]; transactions: Transaction[] }> = {};
  for (const tx of transactions) {
    if (!tx.transactionDate) continue;
    const dStr = tx.transactionDate.split('T')[0];
    if (!txByDate[dStr]) {
      txByDate[dStr] = { count: 0, symbols: [], transactions: [] };
    }
    txByDate[dStr].count += 1;
    txByDate[dStr].transactions.push(tx);
    if (tx.symbol && !txByDate[dStr].symbols.includes(tx.symbol)) {
      txByDate[dStr].symbols.push(tx.symbol);
    }
  }

  // Sort transactions chronologically for accurate position replay
  const sortedTransactions = [...transactions]
    .filter((t) => t && t.transactionDate && t.quantity > 0)
    .sort((a, b) => new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime());

  // 4. Precompute timeline dates to find previous trading days
  const dateList: string[] = [];
  const tempCur = new Date(startDate);
  while (tempCur <= today || (tempCur.getDay() !== 1 && dateList.length % 7 !== 0)) {
    dateList.push(formatISODate(tempCur));
    tempCur.setDate(tempCur.getDate() + 1);
  }

  // Helper to find previous trading day (skipping weekends)
  const getPreviousTradingDate = (idx: number): string | null => {
    for (let i = idx - 1; i >= 0; i--) {
      const d = new Date(dateList[i]);
      const dow = (d.getDay() + 6) % 7;
      if (dow !== 5 && dow !== 6) {
        return dateList[i];
      }
    }
    return null;
  };

  // 5. Generate day by day timeline
  const days: DayPnLRecord[] = [];
  const currentVal = summary.totalValue || 0;
  const currentCost = summary.totalCost || 0;

  for (let idx = 0; idx < dateList.length; idx++) {
    const dStr = dateList[idx];
    const curDate = new Date(dStr);
    const dayOfWeek = (curDate.getDay() + 6) % 7; // Mon=0, ..., Sun=6
    const isWeekend = dayOfWeek === 5 || dayOfWeek === 6; // Sat or Sun
    const isFuture = curDate.getTime() > today.getTime();
    const isToday = dStr === todayStr;

    let pnl = 0;
    let pnlPercent = 0;
    let val = currentVal;
    let hasRealData = false;

    // 5.1 Reconstruct holdings held on this date from real transactions
    let holdingsAtDate: HistoricalHoldingSnapshot[] = [];

    if (isToday) {
      holdingsAtDate = (summary.holdings || []).map((h) => ({
        symbol: h.symbol,
        assetType: h.assetType,
        quantity: h.totalQuantity,
        averageCost: h.averageCost,
        totalCost: h.totalCost,
        todayTransactions: txByDate[dStr]?.transactions
          .filter((tx) => tx.symbol === h.symbol)
          .map((tx) => ({ type: tx.transactionType, quantity: tx.quantity, price: tx.price })),
      }));
    } else {
      const txsUntilToday = sortedTransactions.filter((tx) => tx.transactionDate.split('T')[0] <= dStr);
      if (txsUntilToday.length > 0) {
        const map: Record<string, HistoricalHoldingSnapshot> = {};
        for (const tx of txsUntilToday) {
          if (!map[tx.symbol]) {
            map[tx.symbol] = {
              symbol: tx.symbol,
              assetType: tx.assetType || 'stock',
              quantity: 0,
              averageCost: 0,
              totalCost: 0,
              todayTransactions: [],
            };
          }
          const item = map[tx.symbol];
          const isTxToday = tx.transactionDate.split('T')[0] === dStr;
          if (isTxToday) {
            if (!item.todayTransactions) item.todayTransactions = [];
            item.todayTransactions.push({
              type: tx.transactionType,
              quantity: tx.quantity,
              price: tx.price,
            });
          }

          if (tx.transactionType === 'buy') {
            const addedCost = tx.quantity * tx.price;
            item.totalCost += addedCost;
            item.quantity += tx.quantity;
            item.averageCost = item.quantity > 0 ? item.totalCost / item.quantity : 0;
          } else {
            item.quantity = Math.max(0, item.quantity - tx.quantity);
            item.totalCost = item.quantity * item.averageCost;
          }
        }
        holdingsAtDate = Object.values(map).filter((h) => h.quantity > 0);
      } else if (summary.holdings && summary.holdings.length > 0 && sortedTransactions.length === 0) {
        // If holdings exist in store but transactions table is not backfilled
        holdingsAtDate = summary.holdings.map((h) => ({
          symbol: h.symbol,
          assetType: h.assetType,
          quantity: h.totalQuantity,
          averageCost: h.averageCost,
          totalCost: h.totalCost,
        }));
      }
    }

    // 5.2 Calculate 100% REAL Daily PnL
    if (isFuture || isWeekend) {
      // Market closed or future date
      pnl = 0;
      pnlPercent = 0;
      hasRealData = false;
    } else if (isToday) {
      // Live current portfolio data
      pnl = summary.dailyPnL || 0;
      pnlPercent = summary.dailyPnLPercent || 0;
      val = currentVal;
      hasRealData = true;
    } else if (savedSnapshots[dStr]) {
      // Real recorded daily snapshot from database/localStorage
      pnl = savedSnapshots[dStr].pnl;
      pnlPercent = savedSnapshots[dStr].pnlPercent;
      val = savedSnapshots[dStr].value || currentVal;
      hasRealData = true;
    } else {
      // Calculate from real historical price quotes of held assets
      const prevTradingDate = getPreviousTradingDate(idx);
      let dayPnlSum = 0;
      let dayPrevValSum = 0;
      let dayValSum = 0;
      let validAssetCount = 0;

      if (prevTradingDate && holdingsAtDate.length > 0) {
        for (const h of holdingsAtDate) {
          const symPrices = priceHistoryMap[h.symbol] || priceHistoryMap[h.symbol.toUpperCase()];
          if (symPrices) {
            const pToday = symPrices[dStr];
            const pPrev = symPrices[prevTradingDate];
            if (pToday != null && pPrev != null && pPrev > 0) {
              const diff = pToday - pPrev;
              dayPnlSum += h.quantity * diff;
              dayPrevValSum += h.quantity * pPrev;
              dayValSum += h.quantity * pToday;
              validAssetCount++;
            }
          }
        }
      }

      if (validAssetCount > 0 && dayPrevValSum > 0) {
        // 100% Real PnL calculated from official historical closing prices
        pnl = Number(dayPnlSum.toFixed(2));
        pnlPercent = Number(((dayPnlSum / dayPrevValSum) * 100).toFixed(2));
        val = Number(dayValSum.toFixed(2));
        hasRealData = true;
      } else {
        // NO fake/random data. If no historical price or snapshot exists:
        pnl = 0;
        pnlPercent = 0;
        hasRealData = false;
      }
    }

    // Determine visual intensity level (-4 to +4) strictly based on REAL data
    let level = 0;
    if (hasRealData && !isWeekend && !isFuture) {
      if (pnlPercent >= 3.0) level = 4;
      else if (pnlPercent >= 1.5) level = 3;
      else if (pnlPercent >= 0.5) level = 2;
      else if (pnlPercent > 0.02) level = 1;
      else if (pnlPercent <= -3.0) level = -4;
      else if (pnlPercent <= -1.5) level = -3;
      else if (pnlPercent <= -0.5) level = -2;
      else if (pnlPercent < -0.02) level = -1;
      else level = 0;
    }

    days.push({
      date: dStr,
      timestamp: curDate.getTime(),
      dayOfWeek,
      dayName: TR_DAYS_SHORT[dayOfWeek],
      isWeekend,
      isFuture,
      isToday,
      hasRealData,
      pnl,
      pnlPercent,
      portfolioValue: val,
      portfolioCost: currentCost,
      transactionsCount: txByDate[dStr]?.count || 0,
      transactionsSymbols: txByDate[dStr]?.symbols || [],
      level,
      holdingsAtDate,
    });
  }

  // 6. Structure into 7-row columns (weeks)
  const weeks: DayPnLRecord[][] = [];
  let currentWeek: DayPnLRecord[] = [];

  for (let i = 0; i < days.length; i++) {
    currentWeek.push(days[i]);
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }
  if (currentWeek.length > 0) {
    weeks.push(currentWeek);
  }

  // 7. Calculate month headers with column indices
  const monthHeaders: { name: string; weekIndex: number }[] = [];
  let lastMonth = -1;

  weeks.forEach((week, wIdx) => {
    const firstDay = week.find((d) => new Date(d.date).getDate() <= 7);
    if (firstDay) {
      const m = new Date(firstDay.date).getMonth();
      if (m !== lastMonth) {
        monthHeaders.push({
          name: TR_MONTHS_SHORT[m],
          weekIndex: wIdx,
        });
        lastMonth = m;
      }
    }
  });

  // 8. Calculate statistics strictly over days with REAL data
  let profitableDays = 0;
  let lossDays = 0;
  let neutralDays = 0;
  let totalPeriodPnL = 0;
  let bestDay: DayPnLRecord | null = null;
  let worstDay: DayPnLRecord | null = null;

  // Active trading days with verified real data
  const realDays = days.filter((d) => !d.isWeekend && !d.isFuture && d.hasRealData);

  for (const d of realDays) {
    totalPeriodPnL += d.pnl;
    if (d.pnl > 0.01) {
      profitableDays++;
      if (!bestDay || d.pnl > bestDay.pnl) bestDay = d;
    } else if (d.pnl < -0.01) {
      lossDays++;
      if (!worstDay || d.pnl < worstDay.pnl) worstDay = d;
    } else {
      neutralDays++;
    }
  }

  const totalTradingDays = realDays.length;
  const winRate = totalTradingDays > 0 ? Number(((profitableDays / totalTradingDays) * 100).toFixed(1)) : 0;

  // Calculate real streaks
  let currentStreakCount = 0;
  let currentStreakType: 'win' | 'loss' | 'neutral' = 'neutral';
  let longestWinStreak = 0;
  let longestLossStreak = 0;

  let runningWin = 0;
  let runningLoss = 0;

  for (let i = 0; i < realDays.length; i++) {
    const d = realDays[i];
    if (d.pnl > 0.01) {
      runningWin++;
      runningLoss = 0;
      if (runningWin > longestWinStreak) longestWinStreak = runningWin;
    } else if (d.pnl < -0.01) {
      runningLoss++;
      runningWin = 0;
      if (runningLoss > longestLossStreak) longestLossStreak = runningLoss;
    } else {
      runningWin = 0;
      runningLoss = 0;
    }
  }

  // Determine current streak from real days ending at today
  if (realDays.length > 0) {
    const lastDay = realDays[realDays.length - 1];
    if (lastDay.pnl > 0.01) {
      currentStreakType = 'win';
      for (let i = realDays.length - 1; i >= 0; i--) {
        if (realDays[i].pnl > 0.01) currentStreakCount++;
        else break;
      }
    } else if (lastDay.pnl < -0.01) {
      currentStreakType = 'loss';
      for (let i = realDays.length - 1; i >= 0; i--) {
        if (realDays[i].pnl < -0.01) currentStreakCount++;
        else break;
      }
    } else {
      currentStreakType = 'neutral';
      currentStreakCount = 1;
    }
  }

  const averageDailyPnL = totalTradingDays > 0 ? Number((totalPeriodPnL / totalTradingDays).toFixed(2)) : 0;
  const totalPeriodPnLPercent = currentCost > 0 ? Number(((totalPeriodPnL / currentCost) * 100).toFixed(2)) : 0;

  return {
    days,
    weeks,
    monthHeaders,
    stats: {
      totalTradingDays,
      profitableDays,
      lossDays,
      neutralDays,
      winRate,
      currentStreak: {
        type: currentStreakType,
        count: currentStreakCount,
      },
      longestWinStreak,
      longestLossStreak,
      bestDay: bestDay ? { date: bestDay.date, pnl: bestDay.pnl, pnlPercent: bestDay.pnlPercent } : null,
      worstDay: worstDay ? { date: worstDay.date, pnl: worstDay.pnl, pnlPercent: worstDay.pnlPercent } : null,
      totalPeriodPnL,
      totalPeriodPnLPercent,
      averageDailyPnL,
    },
  };
}
