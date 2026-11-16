import type { CashMovement, PortfolioSummary, Transaction } from '@/types/portfolio';
import { cleanSymbol, type PriceQuote } from '@/lib/portfolio/calculations';

export type NetInvestedPeriod = '1M' | '3M' | '6M' | '1Y' | 'ALL';
export type PriceHistoryBySymbol = Record<string, Record<string, number>>;
export type AlternativeBenchmarkId = 'bist100' | 'gold' | 'interest' | 'usd';

export const DEFAULT_ANNUAL_DEPOSIT_INTEREST_RATE = 0.48; // %48 yıllık TL mevduat referansı

export interface AlternativeBenchmarkSummary {
  id: AlternativeBenchmarkId;
  label: string;
  currentValue: number;
  returnAmount: number;
  returnPercent: number;
  diffVsPortfolio: number; // latestPortfolioValue - currentValue
  available: boolean;
}

export interface NetInvestedPoint {
  date: string; // YYYY-MM-DD
  portfolioValue: number;
  netInvested: number;
  cumulativeInflows: number;
  cumulativeOutflows: number;
  dailyInflow: number;
  dailyOutflow: number;
  isEstimatedValue: boolean;
  bist100Value?: number;
  goldValue?: number;
  interestValue?: number;
  usdValue?: number;
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
  annualInterestRate: number;
  benchmarks: AlternativeBenchmarkSummary[];
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

function extractLiveQuotePrice(quote: PriceQuote | number | undefined): number | null {
  if (typeof quote === 'number' && Number.isFinite(quote) && quote > 0) return quote;
  if (quote && typeof quote === 'object' && typeof quote.price === 'number' && Number.isFinite(quote.price) && quote.price > 0) {
    return quote.price;
  }
  return null;
}

interface SortedSeries {
  dates: string[];
  values: Map<string, number>;
}

function buildSortedSeries(raw?: Record<string, number>): SortedSeries {
  const values = new Map<string, number>();
  if (raw) {
    for (const [d, v] of Object.entries(raw)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(d) && typeof v === 'number' && Number.isFinite(v) && v > 0) {
        values.set(d, v);
      }
    }
  }
  const dates = Array.from(values.keys()).sort();
  return { dates, values };
}

function resolveCloseOnOrBefore(
  series: SortedSeries,
  date: string,
  allowLeadToleranceDays = 10
): number | null {
  if (series.dates.length === 0) return null;
  const exact = series.values.get(date);
  if (exact !== undefined) return exact;

  // Binary / reverse scan for latest trading day <= date
  for (let i = series.dates.length - 1; i >= 0; i--) {
    if (series.dates[i] <= date) {
      return series.values.get(series.dates[i]) ?? null;
    }
  }

  // If date lands slightly before first candle (weekend/holiday boundary), use first close
  const firstDate = series.dates[0];
  const diffDays = Math.round(
    (Date.parse(`${firstDate}T12:00:00Z`) - Date.parse(`${date}T12:00:00Z`)) / 86_400_000
  );
  if (diffDays >= 0 && diffDays <= allowLeadToleranceDays) {
    return series.values.get(firstDate) ?? null;
  }
  return null;
}

function daysBetween(fromDate: string, toDate: string): number {
  const fromMs = Date.parse(`${fromDate}T12:00:00Z`);
  const toMs = Date.parse(`${toDate}T12:00:00Z`);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs <= fromMs) return 0;
  return Math.round((toMs - fromMs) / 86_400_000);
}

/**
 * Builds chronological portfolio market-value vs. net invested capital timeline with separate
 * cash inflows/outflows, alternative benchmark simulations (BIST 100, Gold, Deposit Interest, USD),
 * and an explicit scope disclosure for missing historical data.
 */
export function buildNetInvestedTimeline(input: {
  transactions: readonly Transaction[];
  cashMovements: readonly CashMovement[];
  summary: PortfolioSummary;
  livePrices?: Record<string, PriceQuote | number>;
  historyBySymbol?: PriceHistoryBySymbol;
  period: NetInvestedPeriod;
  today?: string;
  annualInterestRate?: number;
}): NetInvestedTimelineResult {
  const today =
    input.today ||
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date());
  const annualInterestRate =
    typeof input.annualInterestRate === 'number' && input.annualInterestRate >= 0
      ? input.annualInterestRate
      : DEFAULT_ANNUAL_DEPOSIT_INTEREST_RATE;

  const prices = input.livePrices ?? {};
  const usdQuote = prices['USDTRY'] || prices['USD'];
  const liveUsdTry = extractLiveQuotePrice(usdQuote);
  const usdTryFallback = liveUsdTry ?? 38.5;

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

  const historyMap = input.historyBySymbol ?? {};
  const sortedSeriesMap = new Map<string, SortedSeries>();
  for (const [sym, series] of Object.entries(historyMap)) {
    sortedSeriesMap.set(sym, buildSortedSeries(series));
  }

  // Determine whether real historical daily closes were supplied for held portfolio assets
  const portfolioSymbolsInTx = new Set<string>();
  for (const tx of validTx) {
    const sym = cleanSymbol(tx.symbol).symbol || tx.symbol.toUpperCase();
    if (sym) portfolioSymbolsInTx.add(sym);
  }
  const relevantHistoryDateSet = new Set<string>();
  const dateSourceKeys =
    portfolioSymbolsInTx.size > 0
      ? Array.from(portfolioSymbolsInTx)
      : Object.keys(historyMap);
  for (const sym of dateSourceKeys) {
    const symSeries = historyMap[sym];
    if (!symSeries) continue;
    for (const d of Object.keys(symSeries)) {
      if (d >= startDate && d <= today) relevantHistoryDateSet.add(d);
    }
  }

  const startMs = Date.parse(`${startDate}T12:00:00Z`);
  const endMs = Date.parse(`${today}T12:00:00Z`);
  const spanDays = Math.max(1, Math.round((endMs - startMs) / 86_400_000));
  const hasDenseHistory =
    relevantHistoryDateSet.size >= 5 || (spanDays <= 7 && relevantHistoryDateSet.size >= 1);

  // Build sorted sampling dates inside [startDate, today]
  const dateSet = new Set<string>([startDate, today]);
  for (const d of allEventDates) {
    if (d >= startDate && d <= today) dateSet.add(d);
  }
  const benchmarkKeys = new Set(['XU100', 'BIST100', 'XAUTRYG', 'GRAM_ALTIN', 'GC=F', 'XAUUSD', 'ALTIN', 'USDTRY']);
  for (const [sym, symbolSeries] of Object.entries(historyMap)) {
    // When portfolio has dense history, sample portfolio dates + benchmark dates inside [startDate, today]
    if (!hasDenseHistory || !benchmarkKeys.has(sym) || relevantHistoryDateSet.size === 0) {
      for (const d of Object.keys(symbolSeries)) {
        if (d >= startDate && d <= today) dateSet.add(d);
      }
    }
  }

  // Only inject synthetic calendar ticks when real daily closes are absent/sparse
  if (!hasDenseHistory && spanDays >= 2) {
    const stepDays = Math.max(1, Math.floor(spanDays / 12));
    for (let offset = stepDays; offset < spanDays; offset += stepDays) {
      const d = new Date(startMs + offset * 86_400_000).toISOString().slice(0, 10);
      if (d > startDate && d < today) dateSet.add(d);
    }
  }

  const timelineDates = Array.from(dateSet).sort();

  // Compute daily inflows/outflows per date + missing FX count
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

  // Simulate alternative benchmarks across ALL cash flow + timeline dates from earliestDate -> today
  const bistSeries = sortedSeriesMap.get('XU100') ?? sortedSeriesMap.get('BIST100') ?? buildSortedSeries();
  const usdSeries = sortedSeriesMap.get('USDTRY') ?? buildSortedSeries();
  const goldTryDirectSeries =
    sortedSeriesMap.get('XAUTRYG') ??
    sortedSeriesMap.get('GRAM_ALTIN') ??
    sortedSeriesMap.get('GAUTRY');
  const goldUsdSeries =
    sortedSeriesMap.get('GC=F') ??
    sortedSeriesMap.get('XAUUSD') ??
    sortedSeriesMap.get('ALTIN') ??
    buildSortedSeries();

  const resolveBistPrice = (d: string): number | null => {
    const hist = resolveCloseOnOrBefore(bistSeries, d, 3650);
    if (hist !== null) return hist;
    if (d === today) return extractLiveQuotePrice(prices['XU100'] ?? prices['BIST100']);
    return null;
  };

  const resolveUsdPrice = (d: string): number | null => {
    const hist = resolveCloseOnOrBefore(usdSeries, d, 3650);
    if (hist !== null) return hist;
    if (d === today) return liveUsdTry;
    return null;
  };

  const resolveGoldTryPrice = (d: string): number | null => {
    if (goldTryDirectSeries && goldTryDirectSeries.dates.length > 0) {
      const direct = resolveCloseOnOrBefore(goldTryDirectSeries, d, 3650);
      if (direct !== null) return direct;
    }
    const ozUsd = resolveCloseOnOrBefore(goldUsdSeries, d, 3650);
    if (ozUsd !== null) {
      const fx = resolveUsdPrice(d) ?? usdTryFallback;
      return ozUsd * fx;
    }
    if (d === today) {
      return extractLiveQuotePrice(prices['XAUTRYG'] ?? prices['GRAM_ALTIN']);
    }
    return null;
  };

  const hasBistHistory = bistSeries.dates.length >= 2;
  const hasUsdHistory = usdSeries.dates.length >= 2;
  const hasGoldHistory =
    (goldTryDirectSeries ? goldTryDirectSeries.dates.length >= 2 : false) ||
    goldUsdSeries.dates.length >= 2;

  const simDateSet = new Set<string>([...allEventDates, ...timelineDates]);
  const allSimDates = Array.from(simDateSet)
    .filter((d) => d <= today)
    .sort();

  let bistUnits = 0;
  let goldUnits = 0;
  let usdUnits = 0;
  let interestBalance = 0;
  let prevSimDate: string | null = null;

  const simByDate = new Map<
    string,
    { bist100Value?: number; goldValue?: number; interestValue: number; usdValue?: number }
  >();

  for (const d of allSimDates) {
    const deltaDays = prevSimDate ? daysBetween(prevSimDate, d) : 0;
    if (deltaDays > 0 && interestBalance > 0) {
      interestBalance = interestBalance * Math.pow(1 + annualInterestRate, deltaDays / 365);
    }

    const inflow = dailyInflowByDate.get(d) ?? 0;
    const outflow = dailyOutflowByDate.get(d) ?? 0;
    interestBalance = Math.max(0, interestBalance + inflow - outflow);

    let bist100Value: number | undefined;
    if (hasBistHistory) {
      const bp = resolveBistPrice(d);
      if (bp && bp > 0) {
        if (inflow > 0) bistUnits += inflow / bp;
        if (outflow > 0) bistUnits = Math.max(0, bistUnits - outflow / bp);
        bist100Value = Number((bistUnits * bp).toFixed(2));
      }
    }

    let goldValue: number | undefined;
    if (hasGoldHistory) {
      const gp = resolveGoldTryPrice(d);
      if (gp && gp > 0) {
        if (inflow > 0) goldUnits += inflow / gp;
        if (outflow > 0) goldUnits = Math.max(0, goldUnits - outflow / gp);
        goldValue = Number((goldUnits * gp).toFixed(2));
      }
    }

    let usdValue: number | undefined;
    if (hasUsdHistory) {
      const up = resolveUsdPrice(d);
      if (up && up > 0) {
        if (inflow > 0) usdUnits += inflow / up;
        if (outflow > 0) usdUnits = Math.max(0, usdUnits - outflow / up);
        usdValue = Number((usdUnits * up).toFixed(2));
      }
    }

    simByDate.set(d, {
      bist100Value,
      goldValue,
      interestValue: Number(interestBalance.toFixed(2)),
      usdValue,
    });
    prevSimDate = d;
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
          const sortedSymSeries = sortedSeriesMap.get(sym);
          const exactClose = historyMap[sym]?.[d];
          const closePrice =
            typeof exactClose === 'number' && Number.isFinite(exactClose) && exactClose > 0
              ? exactClose
              : hasDenseHistory && sortedSymSeries
                ? resolveCloseOnOrBefore(sortedSymSeries, d)
                : null;

          if (closePrice !== null && Number.isFinite(closePrice) && closePrice > 0) {
            let fxRate = 1;
            if (info.isUsd) {
              const exactFx = historyMap['USDTRY']?.[d];
              const resolvedFx =
                typeof exactFx === 'number' && Number.isFinite(exactFx) && exactFx > 0
                  ? exactFx
                  : hasDenseHistory
                    ? resolveCloseOnOrBefore(usdSeries, d)
                    : null;
              if (resolvedFx !== null && resolvedFx > 0) {
                fxRate = resolvedFx;
              } else {
                fxRate = usdTryFallback;
                allHaveHistoricalClose = false;
                missingSymbolSet.add('USDTRY');
              }
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

    const simPt = simByDate.get(d);
    points.push({
      date: d,
      portfolioValue: Number(portfolioValue.toFixed(2)),
      netInvested: Number(netInvested.toFixed(2)),
      cumulativeInflows: Number(cumulativeInflows.toFixed(2)),
      cumulativeOutflows: Number(cumulativeOutflows.toFixed(2)),
      dailyInflow: Number(dailyInflow.toFixed(2)),
      dailyOutflow: Number(dailyOutflow.toFixed(2)),
      isEstimatedValue,
      bist100Value: simPt?.bist100Value,
      goldValue: simPt?.goldValue,
      interestValue: simPt?.interestValue,
      usdValue: simPt?.usdValue,
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

  const makeBenchmarkSummary = (
    id: AlternativeBenchmarkId,
    label: string,
    available: boolean,
    value: number | undefined
  ): AlternativeBenchmarkSummary => {
    const currentValue = available && typeof value === 'number' && Number.isFinite(value) ? Number(value.toFixed(2)) : 0;
    const returnAmount = available ? Number((currentValue - netInvestedTotal).toFixed(2)) : 0;
    const returnPercent =
      available && netInvestedTotal > 0
        ? Number(((returnAmount / netInvestedTotal) * 100).toFixed(2))
        : 0;
    const diffVsPortfolio = available
      ? Number((latestPortfolioValue - currentValue).toFixed(2))
      : 0;
    return {
      id,
      label,
      currentValue,
      returnAmount,
      returnPercent,
      diffVsPortfolio,
      available,
    };
  };

  const lastSim = simByDate.get(lastPoint?.date ?? today);
  const benchmarks: AlternativeBenchmarkSummary[] = [
    makeBenchmarkSummary('bist100', 'BIST 100', hasBistHistory, lastSim?.bist100Value),
    makeBenchmarkSummary('gold', 'Altın (TL)', hasGoldHistory, lastSim?.goldValue),
    makeBenchmarkSummary(
      'interest',
      `Mevduat Faizi (%${Math.round(annualInterestRate * 100)})`,
      true,
      lastSim?.interestValue
    ),
    makeBenchmarkSummary('usd', 'Dolar (USD/TRY)', hasUsdHistory, lastSim?.usdValue),
  ];

  return {
    period: input.period,
    points,
    totalInflows: Number(cumulativeInflows.toFixed(2)),
    totalOutflows: Number(cumulativeOutflows.toFixed(2)),
    netInvestedTotal: Number(netInvestedTotal.toFixed(2)),
    latestPortfolioValue: Number(latestPortfolioValue.toFixed(2)),
    netGainAmount: Number((latestPortfolioValue - netInvestedTotal).toFixed(2)),
    annualInterestRate,
    benchmarks,
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
