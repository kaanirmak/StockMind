import { Holding, PortfolioSummary, Transaction, ValuationStatus } from '@/types/portfolio';
import { POPULAR_STOCKS } from '@/lib/data/stocks';
import { TEFAS_FUNDS } from '@/lib/data/funds';
import { cleanSymbol, normalizeSymbolKey } from '@/lib/utils/symbol';

export { cleanSymbol, normalizeSymbolKey };

export interface PriceQuote {
  price: number;
  changePercent?: number;
}

export interface AssetPriceResult {
  price: number;
  changePercent: number;
  isLive: boolean;
  isStale: boolean;
  isMissing: boolean;
}

/**
 * Resolves current live USD/TRY exchange rate.
 * Returns null when no live quote is available — never silently falls back to arbitrary constants like 38.5.
 */
export function getLiveUsdTryRate(livePrices?: Record<string, PriceQuote | number>): number | null {
  const quote = livePrices?.['USDTRY'] ?? livePrices?.['USD'] ?? livePrices?.['USDTRY=X'];
  if (quote != null) {
    if (typeof quote === 'number' && quote > 0) return quote;
    if (typeof quote === 'object' && quote.price > 0) return quote.price;
  }
  return null;
}

/**
 * Resolves current asset price.
 * Explicitly indicates whether the price is live, stale (last known transaction price), or missing.
 * Never invents 1.0 or fabricated valuations.
 */
export function getCurrentAssetPrice(
  symbol: string,
  assetType: 'stock' | 'fund',
  livePrices?: Record<string, PriceQuote | number>,
  lastTxPrice?: number
): AssetPriceResult {
  const { symbol: cleanSym, assetType: detectedType } = cleanSymbol(symbol);
  const normKey = normalizeSymbolKey(symbol);
  const rawKey = symbol.toUpperCase().trim();

  // 1. Check live price map
  const quote =
    livePrices?.[normKey] ??
    livePrices?.[cleanSym] ??
    livePrices?.[rawKey] ??
    livePrices?.[`FON:${cleanSym}`] ??
    livePrices?.[`IST:${cleanSym}`];

  if (quote != null) {
    if (typeof quote === 'number' && quote > 0) {
      return { price: quote, changePercent: 0, isLive: true, isStale: false, isMissing: false };
    }
    if (typeof quote === 'object' && quote.price > 0) {
      return {
        price: quote.price,
        changePercent: quote.changePercent || 0,
        isLive: true,
        isStale: false,
        isMissing: false,
      };
    }
  }

  // 2. Fallback to last known transaction price (flagged as stale)
  if (lastTxPrice && lastTxPrice > 0) {
    return { price: lastTxPrice, changePercent: 0, isLive: false, isStale: true, isMissing: false };
  }

  // 3. Fallback to catalog base price if available
  const effectiveType = assetType || detectedType;
  if (effectiveType === 'stock') {
    const stock = POPULAR_STOCKS.find(
      (s) => s.symbol.toUpperCase() === cleanSym || s.symbol.toUpperCase() === normKey
    );
    if (stock && stock.basePrice > 0) {
      return {
        price: stock.basePrice,
        changePercent: stock.changePercent || 0,
        isLive: false,
        isStale: true,
        isMissing: false,
      };
    }
  } else {
    const fund = TEFAS_FUNDS.find((f) => f.code.toUpperCase() === cleanSym);
    if (fund && fund.price > 0) {
      return {
        price: fund.price,
        changePercent: fund.dailyReturn || 0,
        isLive: false,
        isStale: true,
        isMissing: false,
      };
    }
  }

  // 4. Missing price: return 0 with explicit isMissing flag
  return { price: 0, changePercent: 0, isLive: false, isStale: false, isMissing: true };
}

/**
 * Explicit decimal precision policies (FIN-04).
 */
export function roundCurrency(val: number, decimals: number = 2): number {
  if (!Number.isFinite(val)) return 0;
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}

export function roundShares(val: number, isFund: boolean = false): number {
  if (!Number.isFinite(val)) return 0;
  const decimals = isFund ? 6 : 4;
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}

export function roundPrice(val: number, isFund: boolean = false): number {
  if (!Number.isFinite(val)) return 0;
  const decimals = isFund ? 6 : 4;
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}

interface CostLot {
  shares: number;
  costTry: number;
  costNative: number;
  date: string;
  rate: number;
  priceNative: number;
}

interface InternalPortfolioState {
  holdings: Holding[];
  realizedPnL: number;
  realizedCost: number;
  realizedProceeds: number;
  dividendsTotal: number;
  feesTotal: number;
  valuationStatus: ValuationStatus;
}

/**
 * Core unified portfolio calculation engine.
 * Computes FIFO lots, currency PnL decomposition, corporate actions, and valuation integrity in a single deterministic pass.
 */
function processPortfolioTransactions(
  transactions: Transaction[],
  livePrices?: Record<string, PriceQuote | number>
): InternalPortfolioState {
  const liveUsdTry = getLiveUsdTryRate(livePrices);

  const missingPrices: string[] = [];
  const stalePrices: string[] = [];
  let missingFx = false;
  let totalRealizedPnL = 0;
  let totalRealizedCost = 0;
  let totalRealizedProceeds = 0;
  let totalDividends = 0;
  let totalFees = 0;

  const map = new Map<
    string,
    {
      symbol: string;
      assetType: 'stock' | 'fund';
      exchange: any;
      currency: 'TRY' | 'USD';
      totalShares: number;
      lots: CostLot[];
      buyQuantity: number;
      lastPrice: number;
      dividendsEarned: number;
      feesPaid: number;
    }
  >();

  // Deterministic chronological order:
  // If dates are equal, process corporate actions & trades in canonical order:
  // split (1) -> buy (2) -> dividend (3) -> sell (4) -> fee (5)
  const txOrderRank: Record<string, number> = {
    split: 1,
    buy: 2,
    dividend: 3,
    sell: 4,
    fee: 5,
  };

  const sorted = [...transactions].sort((a, b) => {
    const da = new Date(a.transactionDate).getTime();
    const db = new Date(b.transactionDate).getTime();
    if (da !== db) return da - db;

    const rankA = txOrderRank[a.transactionType] || 2;
    const rankB = txOrderRank[b.transactionType] || 2;
    if (rankA !== rankB) return rankA - rankB;

    if (a.createdAt && b.createdAt) {
      const ca = new Date(a.createdAt).getTime();
      const cb = new Date(b.createdAt).getTime();
      if (ca !== cb) return ca - cb;
    }
    return 0;
  });

  for (const t of sorted) {
    const { symbol: cleanSym, assetType: cleanType, exchange: cleanEx } = cleanSymbol(t.symbol);
    const effectiveType = t.assetType === 'fund' || cleanType === 'fund' ? 'fund' : 'stock';
    const effectiveEx = cleanEx || t.exchange || (effectiveType === 'fund' ? 'TEFAS' : 'BIST');

    const isUsd =
      (t.currency || '').toUpperCase() === 'USD' ||
      effectiveEx === 'NASDAQ' ||
      effectiveEx === 'NYSE';
    const currency: 'TRY' | 'USD' = isUsd ? 'USD' : 'TRY';
    const key = `${effectiveType}_${cleanSym}`;

    const existing = map.get(key) || {
      symbol: cleanSym,
      assetType: effectiveType,
      exchange: effectiveEx,
      currency,
      totalShares: 0,
      lots: [] as CostLot[],
      buyQuantity: 0,
      lastPrice: t.price,
      dividendsEarned: 0,
      feesPaid: 0,
    };

    if (t.price > 0) {
      existing.lastPrice = t.price;
    }

    let txRate = 1.0;
    if (isUsd) {
      if (t.exchangeRate && t.exchangeRate > 0) {
        txRate = t.exchangeRate;
      } else if (liveUsdTry && liveUsdTry > 0) {
        txRate = liveUsdTry;
      } else {
        missingFx = true;
        txRate = 1.0;
      }
    }

    if (t.transactionType === 'buy') {
      const nativeCost = t.quantity * t.price + (t.commission || 0);
      const tryCost = t.quantity * t.price * txRate + (t.commission || 0) * (isUsd ? txRate : 1.0);

      existing.totalShares += t.quantity;
      existing.buyQuantity += t.quantity;
      existing.lots.push({
        shares: t.quantity,
        costTry: tryCost,
        costNative: nativeCost,
        date: t.transactionDate,
        rate: txRate,
        priceNative: t.price,
      });
    } else if (t.transactionType === 'sell') {
      let sellQty = t.quantity;
      const pricePerShareTry = t.price * txRate;
      const commissionTry = (t.commission || 0) * (isUsd ? txRate : 1.0);
      const commissionPerShareTry = sellQty > 0 ? commissionTry / sellQty : 0;

      // Consume lots in FIFO order (oldest first) and calculate realized PnL
      while (sellQty > 0.0000001 && existing.lots.length > 0) {
        const oldest = existing.lots[0];
        if (oldest.shares <= sellQty + 0.0000001) {
          const sharesSold = oldest.shares;
          const lotCostTry = oldest.costTry;
          const lotProceedsTry = sharesSold * pricePerShareTry - sharesSold * commissionPerShareTry;
          const gain = lotProceedsTry - lotCostTry;

          totalRealizedPnL += gain;
          totalRealizedCost += lotCostTry;
          totalRealizedProceeds += lotProceedsTry;

          sellQty -= oldest.shares;
          existing.lots.shift();
        } else {
          const sharesSold = sellQty;
          const ratio = sellQty / oldest.shares;
          const lotCostTry = oldest.costTry * ratio;
          const lotProceedsTry = sharesSold * pricePerShareTry - sharesSold * commissionPerShareTry;
          const gain = lotProceedsTry - lotCostTry;

          totalRealizedPnL += gain;
          totalRealizedCost += lotCostTry;
          totalRealizedProceeds += lotProceedsTry;

          oldest.costTry -= lotCostTry;
          oldest.costNative -= oldest.costNative * ratio;
          oldest.shares -= sellQty;
          sellQty = 0;
        }
      }

      existing.totalShares = Math.max(0, existing.totalShares - t.quantity);
      if (existing.totalShares <= 0.0000001) {
        existing.totalShares = 0;
        existing.lots = [];
      }
    } else if (t.transactionType === 'dividend') {
      // Cash dividend event (FIN-06)
      const divAmount = (t.price || 0) * (t.quantity > 0 ? t.quantity : 1);
      const divTry = divAmount * txRate;
      totalRealizedPnL += divTry;
      totalDividends += divTry;
      existing.dividendsEarned += divTry;
    } else if (t.transactionType === 'fee') {
      // Standalone account or custodial fee (FIN-06)
      const feeAmount = (t.price || 0) * (t.quantity > 0 ? t.quantity : 1) + (t.commission || 0);
      const feeTry = feeAmount * (isUsd ? txRate : 1.0);
      totalRealizedPnL -= feeTry;
      totalFees += feeTry;
      existing.feesPaid += feeTry;
    } else if (t.transactionType === 'split') {
      // Stock split event (FIN-06): quantity is the multiplier (e.g. 2 for 2-for-1 split)
      const splitRatio = t.quantity > 0 ? t.quantity : 1;
      if (splitRatio > 0 && splitRatio !== 1) {
        existing.totalShares *= splitRatio;
        for (const lot of existing.lots) {
          lot.shares *= splitRatio;
          lot.priceNative = lot.priceNative / splitRatio;
          // costTry and costNative remain unchanged
        }
      }
    }

    map.set(key, existing);
  }

  const holdings: Holding[] = [];

  map.forEach((item) => {
    if (item.totalShares > 0.0000001 && item.lots.length > 0) {
      const priceRes = getCurrentAssetPrice(
        item.symbol,
        item.assetType,
        livePrices,
        item.lastPrice
      );

      if (priceRes.isMissing) {
        missingPrices.push(item.symbol);
      }
      if (priceRes.isStale) {
        stalePrices.push(item.symbol);
      }

      const isUsd = item.currency === 'USD';
      if (isUsd && !liveUsdTry) {
        missingFx = true;
      }

      const effectiveUsdRate = liveUsdTry || 1.0;
      const currentPriceNative = priceRes.price;
      const currentPriceTry = isUsd ? currentPriceNative * effectiveUsdRate : currentPriceNative;

      const totalCostTry = item.lots.reduce((acc, l) => acc + l.costTry, 0);
      const totalCostNative = item.lots.reduce((acc, l) => acc + l.costNative, 0);
      const averageCostTry = item.totalShares > 0 ? totalCostTry / item.totalShares : 0;
      const originalAvgCost = item.totalShares > 0 ? totalCostNative / item.totalShares : 0;
      const currentValueTry = item.totalShares * currentPriceTry;
      const pnlTry = currentValueTry - totalCostTry;
      const pnlPercent = totalCostTry > 0 ? (pnlTry / totalCostTry) * 100 : 0;

      // Currency PnL decomposition (FIN-04)
      let fxPnL = 0;
      let assetPnL = pnlTry;
      if (isUsd) {
        assetPnL = item.lots.reduce((acc, l) => acc + l.shares * (currentPriceNative - l.priceNative), 0) * effectiveUsdRate;
        fxPnL = item.lots.reduce((acc, l) => acc + l.shares * l.priceNative * (effectiveUsdRate - l.rate), 0);
      }

      const isFund = item.assetType === 'fund' || item.symbol.length === 3;
      const precision = isFund ? 6 : 4;

      holdings.push({
        symbol: item.symbol,
        assetType: item.assetType,
        exchange: item.exchange,
        currency: 'TRY',
        originalCurrency: item.currency,
        originalPrice: Number(currentPriceNative.toFixed(precision)),
        originalAverageCost: Number(originalAvgCost.toFixed(precision)),
        totalQuantity: roundShares(item.totalShares, isFund),
        averageCost: Number(averageCostTry.toFixed(precision)),
        totalCost: Number(totalCostTry.toFixed(2)),
        currentPrice: Number(currentPriceTry.toFixed(precision)),
        currentValue: Number(currentValueTry.toFixed(2)),
        pnl: Number(pnlTry.toFixed(2)),
        pnlPercent: Number(pnlPercent.toFixed(2)),
        fxPnL: Number(fxPnL.toFixed(2)),
        assetPnL: Number(assetPnL.toFixed(2)),
        dividendsEarned: Number(item.dividendsEarned.toFixed(2)),
        feesPaid: Number(item.feesPaid.toFixed(2)),
        dailyChangePercent: Number(priceRes.changePercent.toFixed(2)),
        weight: 0,
        lots: item.lots.map((l) => ({
          shares: l.shares,
          costTry: l.costTry,
          costNative: l.costNative,
          date: l.date,
          rate: l.rate,
          priceNative: l.priceNative,
        })),
      });
    }
  });

  const totalPortfolioValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);

  holdings.forEach((h) => {
    h.weight = totalPortfolioValue > 0 ? Number(((h.currentValue / totalPortfolioValue) * 100).toFixed(1)) : 0;
  });

  holdings.sort((a, b) => b.currentValue - a.currentValue);

  return {
    holdings,
    realizedPnL: Number(totalRealizedPnL.toFixed(2)),
    realizedCost: Number(totalRealizedCost.toFixed(2)),
    realizedProceeds: Number(totalRealizedProceeds.toFixed(2)),
    dividendsTotal: Number(totalDividends.toFixed(2)),
    feesTotal: Number(totalFees.toFixed(2)),
    valuationStatus: {
      isComplete: !missingFx && missingPrices.length === 0,
      missingFx,
      missingPrices,
      stalePrices,
      hasMissingPrices: missingPrices.length > 0 || missingFx,
    },
  };
}

export function calculatePortfolioHoldings(
  transactions: Transaction[],
  livePrices?: Record<string, PriceQuote | number>
): Holding[] {
  return processPortfolioTransactions(transactions, livePrices).holdings;
}

const PALETTE = ['#10b981', '#6366f1', '#8b5cf6', '#f59e0b', '#3b82f6', '#ec4899', '#14b8a6', '#f97316'];

export function calculatePortfolioSummary(
  transactions: Transaction[],
  livePrices?: Record<string, PriceQuote | number>
): PortfolioSummary {
  const liveUsdTry = getLiveUsdTryRate(livePrices);
  const { holdings, realizedPnL, dividendsTotal, feesTotal, valuationStatus } = processPortfolioTransactions(transactions, livePrices);

  const totalValue = holdings.reduce((acc, h) => acc + h.currentValue, 0);
  const totalCost = holdings.reduce((acc, h) => acc + h.totalCost, 0);
  const unrealizedPnL = totalValue - totalCost;
  const unrealizedPnLPercent = totalCost > 0 ? (unrealizedPnL / totalCost) * 100 : 0;

  // Total PnL is the sum of realized profit on closed positions/dividends + unrealized profit on open positions
  const totalPnL = unrealizedPnL + realizedPnL;
  const totalPnLPercent = totalCost > 0 ? (totalPnL / totalCost) * 100 : (realizedPnL !== 0 ? 100 : 0);

  // FX and Asset PnL decomposition
  const totalFxPnL = holdings.reduce((sum, h) => sum + (h.fxPnL || 0), 0);
  const totalAssetPnL = holdings.reduce((sum, h) => sum + (h.assetPnL || 0), 0);

  // Daily PnL mathematically derived from previous close:
  // For each holding: P_prev = P_current / (1 + change/100)
  // Gain = Value_current - Value_prev
  const dailyPnL = holdings.reduce((sum, h) => {
    const change = h.dailyChangePercent || 0;
    if (change !== 0 && 1 + change / 100 > 0) {
      const prevValue = h.currentValue / (1 + change / 100);
      return sum + (h.currentValue - prevValue);
    }
    return sum;
  }, 0);

  const prevTotalValue = totalValue - dailyPnL;
  const dailyPnLPercent = prevTotalValue > 0 ? (dailyPnL / prevTotalValue) * 100 : 0;

  // Turnover metrics
  const effectiveUsdRate = liveUsdTry || 1.0;
  const buyVolume = transactions
    .filter((t) => t.transactionType === 'buy')
    .reduce((sum, t) => {
      const isUsd = (t.currency || '').toUpperCase() === 'USD' || t.exchange === 'NASDAQ' || t.exchange === 'NYSE';
      const rate = isUsd ? (t.exchangeRate && t.exchangeRate > 0 ? t.exchangeRate : effectiveUsdRate) : 1.0;
      return sum + t.quantity * t.price * rate + (t.commission || 0) * (isUsd ? rate : 1.0);
    }, 0);

  const sellVolume = transactions
    .filter((t) => t.transactionType === 'sell')
    .reduce((sum, t) => {
      const isUsd = (t.currency || '').toUpperCase() === 'USD' || t.exchange === 'NASDAQ' || t.exchange === 'NYSE';
      const rate = isUsd ? (t.exchangeRate && t.exchangeRate > 0 ? t.exchangeRate : effectiveUsdRate) : 1.0;
      return sum + t.quantity * t.price * rate - (t.commission || 0) * (isUsd ? rate : 1.0);
    }, 0);

  const totalVolume = buyVolume + sellVolume;

  const allocation = holdings.map((h, i) => ({
    label: h.symbol,
    value: h.currentValue,
    percentage: h.weight,
    color: PALETTE[i % PALETTE.length],
  }));

  return {
    totalValue: Number(totalValue.toFixed(2)),
    totalCost: Number(totalCost.toFixed(2)),
    unrealizedPnL: Number(unrealizedPnL.toFixed(2)),
    unrealizedPnLPercent: Number(unrealizedPnLPercent.toFixed(2)),
    realizedPnL: Number(realizedPnL.toFixed(2)),
    totalPnL: Number(totalPnL.toFixed(2)),
    totalPnLPercent: Number(totalPnLPercent.toFixed(2)),
    fxPnL: Number(totalFxPnL.toFixed(2)),
    assetPnL: Number(totalAssetPnL.toFixed(2)),
    dividendsTotal: Number(dividendsTotal.toFixed(2)),
    feesTotal: Number(feesTotal.toFixed(2)),
    dailyPnL: Number(dailyPnL.toFixed(2)),
    dailyPnLPercent: Number(dailyPnLPercent.toFixed(2)),
    totalVolume: Number(totalVolume.toFixed(2)),
    buyVolume: Number(buyVolume.toFixed(2)),
    sellVolume: Number(sellVolume.toFixed(2)),
    holdings,
    allocation,
    valuationStatus,
  };
}
