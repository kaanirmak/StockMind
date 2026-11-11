import type { CashMovement, PortfolioSummary, Transaction } from '@/types/portfolio';
import { cleanSymbol, type PriceQuote } from '@/lib/portfolio/calculations';

export type NetInvestedPeriod = '1M' | '3M' | '6M' | '1Y' | 'ALL';
export type PriceHistoryBySymbol = Record<string, Record<string, number>>;

export interface NetInvestedPoint {
  date: string; // YYYY-MM-DD
  portfolioValue: number;
  netInvested: number;
  cumulativeInflows: number;
  cumulativeOutflows: number;
  dailyInflow: number;
  dailyOutflow: number;
  isEstimatedValue: boolean;
}

export interface HistoryCoverageReport {
  isComplete: boolean;
  coveredPointsCount: number;
  estimatedPointsCount: number;
  coveragePercent: number;
  capitalBasisSource: 'cash_ledger' | 'transaction_cost';
  missingSymbols: string[];
  missingFxTransactions: number;
  uncoveredRange: { from: string; to: string } | null;
  summaryText: string;
  details: string[];
}

export interface NetInvestedTimelineResult {
  period: NetInvestedPeriod;
  points: NetInvestedPoint[];
  totalInflows: number;
  totalOutflows: number;
  netInvestedTotal: number;
  latestPortfolioValue: number;
  netGainAmount: number;
  coverage: HistoryCoverageReport;
}

function periodCutoffDate(
  period: NetInvestedPeriod,
  today: string,
  earliestEventDate: string
): string {
  if (period === 'ALL') return earliestEventDate;
  const days =
    period === '1M' ? 30 : period === '3M' ? 90 : period === '6M' ? 180 : 365;
  const cutoff = new Date(`${today}T12:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - days);
  const iso = cutoff.toISOString().slice(0, 10);
  return iso > earliestEventDate ? iso : earliestEventDate;
}

function resolveTryAmount(
  amount: number,
  currency: string | undefined,
  exchangeRate: number | undefined,
  usdTryFallback: number
): { tryAmount: number; missingFx: boolean } {
  const cur = (currency || 'TRY').toUpperCase();
  if (cur === 'TRY') return { tryAmount: amount, missingFx: false };
  if (typeof exchangeRate === 'number' && Number.isFinite(exchangeRate) && exchangeRate > 0) {
    return { tryAmount: amount * exchangeRate, missingFx: false };
  }
  return { tryAmount: amount * usdTryFallback, missingFx: true };
}

/**
 * Builds chronological portfolio market-value vs. net invested capital timeline with separate
 * cash inflows/outflows and an explicit scope disclosure for missing historical data.
 */
export function buildNetInvestedTimeline(input: {
  transactions: readonly Transaction[];
  cashMovements: readonly CashMovement[];
  summary: PortfolioSummary;
  livePrices?: Record<string, PriceQuote | number>;
  historyBySymbol?: PriceHistoryBySymbol;
  period: NetInvestedPeriod;
  today?: string;
}): NetInvestedTimelineResult {
  const today =
    input.today ||
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date());
  const prices = input.livePrices ?? {};
  const usdQuote = prices['USDTRY'] || prices['USD'];
  const usdTryFallback =
    typeof usdQuote === 'number' && Number.isFinite(usdQuote) && usdQuote > 0
      ? usdQuote
      : usdQuote && typeof usdQuote === 'object' && usdQuote.price > 0
        ? usdQuote.price
        : 38.5;

  const validTx = input.transactions
    .filter((t) => t && t.transactionDate && t.quantity > 0 && t.price >= 0)
    .map((t) => ({
      ...t,
      date: t.transactionDate.slice(0, 10),
    }))
    .filter((t) => t.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date));

  const validCash = input.cashMovements
    .filter((m) => m && m.movementDate && m.amount > 0)
    .map((m) => ({
      ...m,
      date: m.movementDate.slice(0, 10),
    }))
    .filter((m) => m.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date));

  const hasCashLedger = validCash.length > 0;
  const capitalBasisSource: 'cash_ledger' | 'transaction_cost' = hasCashLedger
    ? 'cash_ledger'
    : 'transaction_cost';

  const allEventDates = [
    ...validTx.map((t) => t.date),
    ...validCash.map((m) => m.date),
  ].sort();

  const earliestDate = allEventDates[0] ?? today;
  const startDate = periodCutoffDate(input.period, today, earliestDate);

  // Build sorted sampling dates inside [startDate, today]
  const dateSet = new Set<string>([startDate, today]);
  for (const d of allEventDates) {
    if (d >= startDate && d <= today) dateSet.add(d);
  }
  const historyMap = input.historyBySymbol ?? {};
  for (const symbolSeries of Object.values(historyMap)) {
    for (const d of Object.keys(symbolSeries)) {
      if (d >= startDate && d <= today) dateSet.add(d);
    }
  }

  // Ensure at least ~8 smooth intermediate ticks when sparsely spaced
  const startMs = Date.parse(`${startDate}T12:00:00Z`);
  const endMs = Date.parse(`${today}T12:00:00Z`);
  const spanDays = Math.max(1, Math.round((endMs - startMs) / 86_400_000));
  const stepDays = Math.max(1, Math.floor(spanDays / 12));
  if (spanDays >= 2) {
    for (let offset = stepDays; offset < spanDays; offset += stepDays) {
      const d = new Date(startMs + offset * 86_400_000).toISOString().slice(0, 10);
      if (d > startDate && d < today) dateSet.add(d);
    }
  }

  const timelineDates = Array.from(dateSet).sort();

  // Compute cumulative inflows/outflows per date + missing FX count
  const dailyInflowByDate = new Map<string, number>();
  const dailyOutflowByDate = new Map<string, number>();
  let missingFxTransactions = 0;

  if (hasCashLedger) {
    for (const m of validCash) {
      const fx = resolveTryAmount(m.amount, m.currency, m.exchangeRate, usdTryFallback);
      if (fx.missingFx && (m.currency || 'TRY').toUpperCase() !== 'TRY') {
        missingFxTransactions++;
      }
      if (m.movementType === 'deposit') {
        dailyInflowByDate.set(m.date, (dailyInflowByDate.get(m.date) ?? 0) + fx.tryAmount);
      } else {
        dailyOutflowByDate.set(m.date, (dailyOutflowByDate.get(m.date) ?? 0) + fx.tryAmount);
      }
    }
  } else {
    for (const tx of validTx) {
      if (tx.transactionType !== 'buy' && tx.transactionType !== 'sell') continue;
      const cleaned = cleanSymbol(tx.symbol);
      const isUsd =
        (tx.currency || '').toUpperCase() === 'USD' ||
        tx.exchange === 'NASDAQ' ||
        tx.exchange === 'NYSE' ||
        cleaned.exchange === 'NASDAQ' ||
        cleaned.exchange === 'NYSE';
      const gross = tx.quantity * tx.price + (tx.commission || 0);
      const fx = resolveTryAmount(gross, isUsd ? 'USD' : 'TRY', tx.exchangeRate, usdTryFallback);
      if (fx.missingFx) missingFxTransactions++;
      if (tx.transactionType === 'buy') {
        dailyInflowByDate.set(tx.date, (dailyInflowByDate.get(tx.date) ?? 0) + fx.tryAmount);
      } else {
        dailyOutflowByDate.set(tx.date, (dailyOutflowByDate.get(tx.date) ?? 0) + fx.tryAmount);
      }
    }
  }

  const missingSymbolSet = new Set<string>(
    input.summary.valuationStatus?.missingPrices ?? []
  );
  if (input.summary.valuationStatus?.missingFx) {
    missingSymbolSet.add('USDTRY');
  }

  // Track cumulative inflows/outflows prior to startDate
  let cumulativeInflows = 0;
  let cumulativeOutflows = 0;
  for (const [d, amt] of dailyInflowByDate.entries()) {
    if (d < startDate) cumulativeInflows += amt;
  }
  for (const [d, amt] of dailyOutflowByDate.entries()) {
    if (d < startDate) cumulativeOutflows += amt;
  }

  // Track holdings replay across timeline dates so value reflects historical positions when closes exist
  const totalSummaryValue = Math.max(0, input.summary.totalValue || 0);
  const totalSummaryCost = Math.max(0, input.summary.totalCost || 0);

  const points: NetInvestedPoint[] = [];
  let coveredPointsCount = 0;
  let estimatedPointsCount = 0;
  let uncoveredStart: string | null = null;
  let uncoveredEnd: string | null = null;

  for (let i = 0; i < timelineDates.length; i++) {
    const d = timelineDates[i];
    const dailyInflow = dailyInflowByDate.get(d) ?? 0;
    const dailyOutflow = dailyOutflowByDate.get(d) ?? 0;
    cumulativeInflows += dailyInflow;
    cumulativeOutflows += dailyOutflow;
    const netInvested = cumulativeInflows - cumulativeOutflows;

    // Replay shares held as of date d
    const qtyBySym = new Map<string, { qty: number; isUsd: boolean }>();
    for (const tx of validTx) {
      if (tx.date > d) break;
      const sym = cleanSymbol(tx.symbol).symbol || tx.symbol.toUpperCase();
      const isUsd =
        (tx.currency || '').toUpperCase() === 'USD' ||
        tx.exchange === 'NASDAQ' ||
        tx.exchange === 'NYSE';
      const entry = qtyBySym.get(sym) ?? { qty: 0, isUsd };
      if (tx.transactionType === 'buy') entry.qty += tx.quantity;
      else if (tx.transactionType === 'sell') entry.qty = Math.max(0, entry.qty - tx.quantity);
      else if (tx.transactionType === 'split' && tx.price > 0) entry.qty *= tx.price;
      qtyBySym.set(sym, entry);
    }

    let isEstimatedValue = true;
    let portfolioValue = 0;

    if (d === today) {
      portfolioValue = totalSummaryValue;
      isEstimatedValue = Boolean(input.summary.valuationStatus?.isPartialValuation);
    } else {
      const heldEntries = Array.from(qtyBySym.entries()).filter(([, info]) => info.qty > 0.000001);
      if (heldEntries.length === 0) {
        portfolioValue = Math.max(0, netInvested);
        isEstimatedValue = false;
      } else {
        let allHaveHistoricalClose = true;
        let marketSumTry = 0;
        for (const [sym, info] of heldEntries) {
          const symSeries = historyMap[sym];
          const closePrice = symSeries?.[d];
          if (typeof closePrice === 'number' && Number.isFinite(closePrice) && closePrice > 0) {
            const fxRate = info.isUsd ? (historyMap['USDTRY']?.[d] ?? usdTryFallback) : 1;
            if (info.isUsd && !historyMap['USDTRY']?.[d]) {
              allHaveHistoricalClose = false;
              missingSymbolSet.add('USDTRY');
            }
            marketSumTry += info.qty * closePrice * fxRate;
          } else {
            allHaveHistoricalClose = false;
            missingSymbolSet.add(sym);
          }
        }

        if (allHaveHistoricalClose) {
          portfolioValue = marketSumTry;
          isEstimatedValue = false;
        } else {
          // Interpolate monotonically between net invested cost and current PnL delta
          const progress = timelineDates.length > 1 ? i / (timelineDates.length - 1) : 1;
          const totalDelta = totalSummaryValue - (totalSummaryCost || netInvested);
          portfolioValue = Math.max(0, netInvested + totalDelta * Math.pow(progress, 1.05));
          isEstimatedValue = true;
        }
      }
    }

    if (isEstimatedValue) {
      estimatedPointsCount++;
      if (!uncoveredStart) uncoveredStart = d;
      uncoveredEnd = d;
    } else {
      coveredPointsCount++;
    }

    points.push({
      date: d,
      portfolioValue: Number(portfolioValue.toFixed(2)),
      netInvested: Number(netInvested.toFixed(2)),
      cumulativeInflows: Number(cumulativeInflows.toFixed(2)),
      cumulativeOutflows: Number(cumulativeOutflows.toFixed(2)),
      dailyInflow: Number(dailyInflow.toFixed(2)),
      dailyOutflow: Number(dailyOutflow.toFixed(2)),
      isEstimatedValue,
    });
  }

  const totalPoints = points.length || 1;
  const coveragePercent = Math.round((coveredPointsCount / totalPoints) * 100);
  const missingSymbols = Array.from(missingSymbolSet).sort();

  const details: string[] = [];
  if (estimatedPointsCount > 0) {
    details.push(
      `${estimatedPointsCount}/${points.length} nokta (${uncoveredStart} – ${uncoveredEnd}) tam günlük kapanış geçmişi bulunmadığı için tahmini değerleme eğrisi ile dolduruldu.`
    );
  }
  if (!hasCashLedger) {
    details.push(
      'Nakit defterinde para giriş/çıkış kaydı olmadığından net yatırılan tutar alış/satış işlemlerinden türetildi.'
    );
  }
  if (missingSymbols.length > 0) {
    details.push(`Tarihçesi veya güncel fiyatı eksik kalemler: ${missingSymbols.join(', ')}.`);
  }
  if (missingFxTransactions > 0) {
    details.push(
      `${missingFxTransactions} döviz işleminde tarihsel kur girilmediği için güncel USD/TRY kuru kullanıldı.`
    );
  }

  const isComplete = estimatedPointsCount === 0 && missingSymbols.length === 0 && missingFxTransactions === 0;
  const summaryText = isComplete
    ? 'Seçili dönemdeki tüm noktalar doğrulanmış kapanış ve nakit hareketi verisiyle kapsandı (%100).'
    : `Tarihçe kapsamı: %${coveragePercent} doğrulanmış (${coveredPointsCount}/${points.length} nokta). Eksik tarihçe ayrıntıları aşağıda belirtilmiştir.`;

  const lastPoint = points[points.length - 1];
  const latestPortfolioValue = lastPoint ? lastPoint.portfolioValue : totalSummaryValue;
  const netInvestedTotal = lastPoint ? lastPoint.netInvested : 0;

  return {
    period: input.period,
    points,
    totalInflows: Number(cumulativeInflows.toFixed(2)),
    totalOutflows: Number(cumulativeOutflows.toFixed(2)),
    netInvestedTotal: Number(netInvestedTotal.toFixed(2)),
    latestPortfolioValue: Number(latestPortfolioValue.toFixed(2)),
    netGainAmount: Number((latestPortfolioValue - netInvestedTotal).toFixed(2)),
    coverage: {
      isComplete,
      coveredPointsCount,
      estimatedPointsCount,
      coveragePercent,
      capitalBasisSource,
      missingSymbols,
      missingFxTransactions,
      uncoveredRange: uncoveredStart && uncoveredEnd ? { from: uncoveredStart, to: uncoveredEnd } : null,
      summaryText,
      details,
    },
  };
}
