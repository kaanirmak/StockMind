import type { CashMovement, Transaction } from '@/types/portfolio';
import {
  calculatePortfolioHoldings,
  calculatePortfolioSummary,
  cleanSymbol,
  getLiveUsdTryRate,
  type PriceQuote,
} from '@/lib/portfolio/calculations';
import { calculateCashLedger } from '@/lib/portfolio/cash';
import {
  istanbulDate,
  periodStart,
  type PerformancePeriod,
  type PriceHistoryMap,
} from '@/lib/portfolio/periodPerformance';

export interface PeriodBreakdown {
  period: PerformancePeriod;
  startDate: string | null;
  endDate: string;
  realizedTradePnL: number;
  unrealizedPnL: number;
  dividendsTotal: number;
  depositsTotal: number;
  withdrawalsTotal: number;
  netCashEvents: number;
  tradeCommissionsTotal: number;
  standaloneFeesTotal: number;
  feesAndCommissionsTotal: number;
  fxImpact: number;
  assetPricePnL: number;
  available: boolean;
  missing: string[];
}

function isUsdTx(tx: Transaction): boolean {
  const cleanEx = cleanSymbol(tx.symbol).exchange;
  return (
    (tx.currency || '').toUpperCase() === 'USD' ||
    tx.exchange === 'NASDAQ' ||
    tx.exchange === 'NYSE' ||
    cleanEx === 'NASDAQ' ||
    cleanEx === 'NYSE'
  );
}

function getTxRate(tx: Transaction, fallbackUsdTry: number): number {
  if (!isUsdTx(tx)) return 1;
  return tx.exchangeRate && tx.exchangeRate > 0 ? tx.exchangeRate : fallbackUsdTry || 1;
}

function getCumRealizedTradePnL(summary: {
  realizedPnL: number;
  dividendsTotal?: number;
  feesTotal?: number;
}): number {
  return summary.realizedPnL - (summary.dividendsTotal || 0) + (summary.feesTotal || 0);
}

/**
 * Separates realized trade profits, open-position valuation change, cash events
 * (dividends & cash deposits/withdrawals), commissions/fees, and FX impact for the same selected period.
 */
export function calculatePeriodBreakdown(input: {
  transactions: Transaction[];
  cashMovements?: CashMovement[];
  prices: Record<string, PriceQuote | number>;
  history?: PriceHistoryMap;
  period: PerformancePeriod;
  now?: Date;
}): PeriodBreakdown {
  const now = input.now || new Date();
  const today = istanbulDate(now);
  const startDate =
    input.period === 'total'
      ? null
      : input.period === 'daily'
      ? today
      : periodStart(input.period, now);

  const effectiveTx = input.transactions.filter(
    (t) => istanbulDate(t.transactionDate) <= today
  );
  const effectiveMovements = (input.cashMovements || []).filter(
    (m) => istanbulDate(m.movementDate) <= today
  );

  const inPeriod = (dateStr: string) =>
    !startDate ? true : istanbulDate(dateStr) >= startDate;

  const liveUsdTry = getLiveUsdTryRate(input.prices) || 1;
  const periodTx = effectiveTx.filter((t) => inPeriod(t.transactionDate));
  const periodMovements = effectiveMovements.filter((m) => inPeriod(m.movementDate));

  let dividendsTotal = 0;
  let tradeCommissionsTotal = 0;
  let standaloneFeesTotal = 0;

  for (const tx of periodTx) {
    const rate = getTxRate(tx, liveUsdTry);
    const isUsd = isUsdTx(tx);
    const commTry = (tx.commission || 0) * (isUsd ? rate : 1);

    if (tx.transactionType === 'dividend') {
      dividendsTotal += (tx.price || 0) * (tx.quantity > 0 ? tx.quantity : 1) * rate;
      tradeCommissionsTotal += commTry;
    } else if (tx.transactionType === 'fee') {
      const feeBase = (tx.price || 0) * (tx.quantity > 0 ? tx.quantity : 1) + (tx.commission || 0);
      standaloneFeesTotal += feeBase * (isUsd ? rate : 1);
    } else if (tx.transactionType === 'buy' || tx.transactionType === 'sell') {
      tradeCommissionsTotal += commTry;
    }
  }

  let depositsTotal = 0;
  let withdrawalsTotal = 0;
  for (const mov of periodMovements) {
    const movRate =
      mov.currency === 'TRY'
        ? 1
        : mov.exchangeRate && mov.exchangeRate > 0
        ? mov.exchangeRate
        : liveUsdTry;
    const amountTry = (mov.amount || 0) * movRate;
    if (mov.movementType === 'deposit') {
      depositsTotal += amountTry;
    } else if (mov.movementType === 'withdrawal') {
      withdrawalsTotal += amountTry;
    }
  }

  const netCashEvents = dividendsTotal + depositsTotal - withdrawalsTotal;
  const feesAndCommissionsTotal = tradeCommissionsTotal + standaloneFeesTotal;

  const current = calculatePortfolioSummary(effectiveTx, input.prices);
  const missing = [
    ...(current.valuationStatus?.missingPrices || []),
    ...(current.valuationStatus?.stalePrices || []),
  ];
  if (current.valuationStatus?.missingFx) missing.push('USDTRY');

  const round2 = (v: number) => Number((Number.isFinite(v) ? v : 0).toFixed(2));

  if (input.period === 'total') {
    const realizedTradePnL = getCumRealizedTradePnL(current);
    const fxImpact = current.fxPnL || 0;
    const assetPricePnL = current.unrealizedPnL - fxImpact;

    return {
      period: input.period,
      startDate,
      endDate: today,
      realizedTradePnL: round2(realizedTradePnL),
      unrealizedPnL: round2(current.unrealizedPnL),
      dividendsTotal: round2(dividendsTotal),
      depositsTotal: round2(depositsTotal),
      withdrawalsTotal: round2(withdrawalsTotal),
      netCashEvents: round2(netCashEvents),
      tradeCommissionsTotal: round2(tradeCommissionsTotal),
      standaloneFeesTotal: round2(standaloneFeesTotal),
      feesAndCommissionsTotal: round2(feesAndCommissionsTotal),
      fxImpact: round2(fxImpact),
      assetPricePnL: round2(assetPricePnL),
      available: missing.length === 0,
      missing: [...new Set(missing)],
    };
  }

  const priorTx = effectiveTx.filter((t) => istanbulDate(t.transactionDate) < startDate!);
  const priorAtCurrent = calculatePortfolioSummary(priorTx, input.prices);
  const realizedTradePnL = getCumRealizedTradePnL(current) - getCumRealizedTradePnL(priorAtCurrent);

  if (input.period === 'daily') {
    const opening = calculatePortfolioHoldings(priorTx, input.prices);
    const fxQuote = input.prices.USDTRY ?? input.prices.USD ?? input.prices['USDTRY=X'];
    const fxChange =
      typeof fxQuote === 'object' && Number.isFinite(fxQuote.changePercent)
        ? fxQuote.changePercent || 0
        : 0;
    const prevUsdRate = fxChange > -100 ? liveUsdTry / (1 + fxChange / 100) : liveUsdTry;

    const priorClosePrices: Record<string, PriceQuote> = {};
    for (const h of opening) {
      const q = input.prices[h.symbol];
      const livePrice = typeof q === 'number' ? q : q?.price || h.originalPrice || h.currentPrice;
      const pct = typeof q === 'object' && Number.isFinite(q.changePercent) ? q.changePercent || 0 : 0;
      const prevNative = pct > -100 ? livePrice / (1 + pct / 100) : livePrice;
      priorClosePrices[h.symbol] = { price: prevNative, changePercent: 0 };
    }
    if (opening.some((h) => h.originalCurrency === 'USD')) {
      priorClosePrices.USDTRY = { price: prevUsdRate, changePercent: 0 };
    }

    const baseline = calculatePortfolioSummary(priorTx, priorClosePrices);
    const cashLedger =
      effectiveMovements.length > 0
        ? calculateCashLedger(effectiveTx, effectiveMovements, input.prices, today)
        : null;
    const fxImpact =
      (current.fxPnL || 0) - (baseline.fxPnL || 0) + (cashLedger?.dailyFxPnL || 0);
    const unrealizedPnL = current.unrealizedPnL - baseline.unrealizedPnL;
    const assetPricePnL = unrealizedPnL - ((current.fxPnL || 0) - (baseline.fxPnL || 0));

    return {
      period: input.period,
      startDate,
      endDate: today,
      realizedTradePnL: round2(realizedTradePnL),
      unrealizedPnL: round2(unrealizedPnL),
      dividendsTotal: round2(dividendsTotal),
      depositsTotal: round2(depositsTotal),
      withdrawalsTotal: round2(withdrawalsTotal),
      netCashEvents: round2(netCashEvents),
      tradeCommissionsTotal: round2(tradeCommissionsTotal),
      standaloneFeesTotal: round2(standaloneFeesTotal),
      feesAndCommissionsTotal: round2(feesAndCommissionsTotal),
      fxImpact: round2(fxImpact),
      assetPricePnL: round2(assetPricePnL),
      available: missing.length === 0,
      missing: [...new Set(missing)],
    };
  }

  // Weekly / Monthly period: match baseline logic with periodPerformance
  const history = input.history || {};
  const opening = calculatePortfolioHoldings(priorTx, input.prices);
  for (const h of current.holdings.filter((h) => h.assetType === 'fund')) {
    const latest = Object.keys(history[h.symbol] || {})
      .filter((d) => d <= today)
      .sort()
      .pop();
    if (!latest || Date.parse(today) - Date.parse(latest) > 7 * 86400000) {
      missing.push(`${h.symbol} (güncel fiyat)`);
    }
  }

  const baselinePrices: Record<string, PriceQuote> = {};
  const closeBefore = (symbol: string) => {
    const rows = history[symbol] || {};
    const date = Object.keys(rows)
      .filter((d) => d < startDate! && rows[d] > 0 && Number.isFinite(rows[d]))
      .sort()
      .pop();
    if (!date || Date.parse(startDate!) - Date.parse(date) > 10 * 86400000) {
      missing.push(symbol);
      return 0;
    }
    return rows[date];
  };

  for (const h of opening) {
    baselinePrices[h.symbol] = { price: closeBefore(h.symbol), changePercent: 0 };
  }
  if (opening.some((h) => h.originalCurrency === 'USD')) {
    baselinePrices.USDTRY = { price: closeBefore('USDTRY'), changePercent: 0 };
  }

  for (const t of periodTx) {
    if (t.transactionType === 'split') missing.push('Bölünme düzeltilmiş dönem fiyatı');
    if (isUsdTx(t) && !(t.exchangeRate && t.exchangeRate > 0)) missing.push('İşlem kuru');
  }

  const uniqueMissing = [...new Set(missing)];
  if (uniqueMissing.length > 0) {
    return {
      period: input.period,
      startDate,
      endDate: today,
      realizedTradePnL: round2(realizedTradePnL),
      unrealizedPnL: 0,
      dividendsTotal: round2(dividendsTotal),
      depositsTotal: round2(depositsTotal),
      withdrawalsTotal: round2(withdrawalsTotal),
      netCashEvents: round2(netCashEvents),
      tradeCommissionsTotal: round2(tradeCommissionsTotal),
      standaloneFeesTotal: round2(standaloneFeesTotal),
      feesAndCommissionsTotal: round2(feesAndCommissionsTotal),
      fxImpact: 0,
      assetPricePnL: 0,
      available: false,
      missing: uniqueMissing,
    };
  }

  const baseline = calculatePortfolioSummary(priorTx, baselinePrices);
  const fxImpact = (current.fxPnL || 0) - (baseline.fxPnL || 0);
  const unrealizedPnL = current.unrealizedPnL - baseline.unrealizedPnL;
  const assetPricePnL = unrealizedPnL - fxImpact;

  return {
    period: input.period,
    startDate,
    endDate: today,
    realizedTradePnL: round2(realizedTradePnL),
    unrealizedPnL: round2(unrealizedPnL),
    dividendsTotal: round2(dividendsTotal),
    depositsTotal: round2(depositsTotal),
    withdrawalsTotal: round2(withdrawalsTotal),
    netCashEvents: round2(netCashEvents),
    tradeCommissionsTotal: round2(tradeCommissionsTotal),
    standaloneFeesTotal: round2(standaloneFeesTotal),
    feesAndCommissionsTotal: round2(feesAndCommissionsTotal),
    fxImpact: round2(fxImpact),
    assetPricePnL: round2(assetPricePnL),
    available: true,
    missing: [],
  };
}
