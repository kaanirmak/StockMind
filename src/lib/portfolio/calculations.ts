import { Holding, PortfolioSummary, Transaction } from '@/types/portfolio';
import { POPULAR_STOCKS } from '@/lib/data/stocks';
import { TEFAS_FUNDS } from '@/lib/data/funds';
import { cleanSymbol, normalizeSymbolKey } from '@/lib/utils/symbol';

export { cleanSymbol, normalizeSymbolKey };

export interface PriceQuote {
  price: number;
  changePercent?: number;
}

/**
 * Resolves current live USD/TRY exchange rate
 */
export function getLiveUsdTryRate(livePrices?: Record<string, PriceQuote | number>): number {
  const quote = livePrices?.['USDTRY'] ?? livePrices?.['USD'] ?? livePrices?.['USDTRY=X'];
  if (quote != null) {
    if (typeof quote === 'number' && quote > 0) return quote;
    if (typeof quote === 'object' && quote.price > 0) return quote.price;
  }
  return 38.5; // realistic fallback
}

/**
 * Resolves current asset price prioritizing live price map, then last transaction price, then catalog
 */
export function getCurrentAssetPrice(
  symbol: string,
  assetType: 'stock' | 'fund',
  livePrices?: Record<string, PriceQuote | number>,
  lastTxPrice?: number
): { price: number; changePercent: number } {
  const { symbol: cleanSym, assetType: detectedType } = cleanSymbol(symbol);
  const normKey = normalizeSymbolKey(symbol);
  const rawKey = symbol.toUpperCase().trim();

  // 1. Check live price map with all possible keys (normKey, cleanSym, rawKey)
  const quote =
    livePrices?.[normKey] ??
    livePrices?.[cleanSym] ??
    livePrices?.[rawKey] ??
    livePrices?.[`FON:${cleanSym}`] ??
    livePrices?.[`IST:${cleanSym}`];

  if (quote != null) {
    if (typeof quote === 'number' && quote > 0) {
      return { price: quote, changePercent: 0 };
    }
    if (typeof quote === 'object' && quote.price > 0) {
      return { price: quote.price, changePercent: quote.changePercent || 0 };
    }
  }

  // 2. Fallback to last known transaction price (so portfolio is never distorted)
  if (lastTxPrice && lastTxPrice > 0) {
    return { price: lastTxPrice, changePercent: 0 };
  }

  // 3. Fallback to static catalog if available
  const effectiveType = assetType || detectedType;
  if (effectiveType === 'stock') {
    const stock = POPULAR_STOCKS.find(
      (s) => s.symbol.toUpperCase() === cleanSym || s.symbol.toUpperCase() === normKey
    );
    if (stock && stock.basePrice > 0) {
      return { price: stock.basePrice, changePercent: stock.changePercent || 0 };
    }
  } else {
    const fund = TEFAS_FUNDS.find((f) => f.code.toUpperCase() === cleanSym);
    if (fund && fund.price > 0) {
      return { price: fund.price, changePercent: fund.dailyReturn || 0 };
    }
  }

  return { price: lastTxPrice || 1.0, changePercent: 0 };
}

export function calculatePortfolioHoldings(
  transactions: Transaction[],
  livePrices?: Record<string, PriceQuote | number>
): Holding[] {
  const liveUsdTry = getLiveUsdTryRate(livePrices);

  const map = new Map<
    string,
    {
      symbol: string;
      assetType: 'stock' | 'fund';
      exchange: any;
      currency: 'TRY' | 'USD';
      totalShares: number;
      totalBuyCostTry: number;
      totalBuyCostNative: number;
      buyQuantity: number;
      lastPrice: number;
    }
  >();

  // Sort by date ascending to correctly calculate weighted cost
  // Critical: On the same calendar day, BUY transactions must always be processed before SELL
  // so that intraday positions (e.g. day trades, IPO sales) properly reduce shares to zero.
  const sorted = [...transactions].sort((a, b) => {
    const da = new Date(a.transactionDate).getTime();
    const db = new Date(b.transactionDate).getTime();
    if (da !== db) return da - db;
    if (a.transactionType === 'buy' && b.transactionType === 'sell') return -1;
    if (a.transactionType === 'sell' && b.transactionType === 'buy') return 1;
    if (a.createdAt && b.createdAt) {
      const ca = new Date(a.createdAt).getTime();
      const cb = new Date(b.createdAt).getTime();
      if (ca !== cb) return ca - cb;
    }
    return 0;
  });

  for (const t of sorted) {
    const { symbol: cleanSym, assetType: cleanType, exchange: cleanEx } = cleanSymbol(t.symbol);
    const effectiveType = (t.assetType === 'fund' || cleanType === 'fund') ? 'fund' : 'stock';
    const effectiveEx = cleanEx || t.exchange || (effectiveType === 'fund' ? 'TEFAS' : 'BIST');
    
    // Detect if transaction is USD
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
      totalBuyCostTry: 0,
      totalBuyCostNative: 0,
      buyQuantity: 0,
      lastPrice: t.price,
    };

    existing.lastPrice = t.price;

    const txRate = isUsd ? (t.exchangeRate && t.exchangeRate > 0 ? t.exchangeRate : liveUsdTry) : 1.0;
    const nativeCost = t.quantity * t.price + (t.commission || 0);
    const tryCost = (t.quantity * t.price * txRate) + ((t.commission || 0) * (isUsd ? txRate : 1.0));

    if (t.transactionType === 'buy') {
      existing.totalShares += t.quantity;
      existing.totalBuyCostTry += tryCost;
      existing.totalBuyCostNative += nativeCost;
      existing.buyQuantity += t.quantity;
    } else if (t.transactionType === 'sell') {
      const avgTryCost = existing.totalShares > 0 ? existing.totalBuyCostTry / existing.totalShares : 0;
      const avgNativeCost = existing.totalShares > 0 ? existing.totalBuyCostNative / existing.totalShares : 0;
      existing.totalShares = Math.max(0, existing.totalShares - t.quantity);
      existing.totalBuyCostTry = existing.totalShares * avgTryCost;
      existing.totalBuyCostNative = existing.totalShares * avgNativeCost;
    }

    map.set(key, existing);
  }

  const holdings: Holding[] = [];

  map.forEach((item) => {
    if (item.totalShares > 0) {
      const { price: currentPriceNative, changePercent: dailyChangePercent } = getCurrentAssetPrice(
        item.symbol,
        item.assetType,
        livePrices,
        item.lastPrice
      );

      const isUsd = item.currency === 'USD';
      const currentPriceTry = isUsd ? currentPriceNative * liveUsdTry : currentPriceNative;
      const averageCostTry = item.totalShares > 0 ? item.totalBuyCostTry / item.totalShares : 0;
      const originalAvgCost = item.totalShares > 0 ? item.totalBuyCostNative / item.totalShares : 0;
      const totalCostTry = item.totalBuyCostTry;
      const currentValueTry = item.totalShares * currentPriceTry;
      const pnlTry = currentValueTry - totalCostTry;
      const pnlPercent = totalCostTry > 0 ? (pnlTry / totalCostTry) * 100 : 0;

      const isFund = item.assetType === 'fund' || item.symbol.length === 3;
      const precision = isFund ? 6 : 4;

      holdings.push({
        symbol: item.symbol,
        assetType: item.assetType,
        exchange: item.exchange,
        currency: 'TRY', // Base currency for unified calculations
        originalCurrency: item.currency,
        originalPrice: Number(currentPriceNative.toFixed(precision)),
        originalAverageCost: Number(originalAvgCost.toFixed(precision)),
        totalQuantity: item.totalShares,
        averageCost: Number(averageCostTry.toFixed(precision)),
        totalCost: Number(totalCostTry.toFixed(2)),
        currentPrice: Number(currentPriceTry.toFixed(precision)),
        currentValue: Number(currentValueTry.toFixed(2)),
        pnl: Number(pnlTry.toFixed(2)),
        pnlPercent: Number(pnlPercent.toFixed(2)),
        dailyChangePercent: Number(dailyChangePercent.toFixed(2)),
        weight: 0,
      });
    }
  });

  const totalPortfolioValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);

  holdings.forEach((h) => {
    h.weight = totalPortfolioValue > 0 ? Number(((h.currentValue / totalPortfolioValue) * 100).toFixed(1)) : 0;
  });

  return holdings.sort((a, b) => b.currentValue - a.currentValue);
}

const PALETTE = ['#10b981', '#6366f1', '#8b5cf6', '#f59e0b', '#3b82f6', '#ec4899', '#14b8a6', '#f97316'];

export function calculatePortfolioSummary(
  transactions: Transaction[],
  livePrices?: Record<string, PriceQuote | number>
): PortfolioSummary {
  const liveUsdTry = getLiveUsdTryRate(livePrices);
  const holdings = calculatePortfolioHoldings(transactions, livePrices);

  const totalValue = holdings.reduce((acc, h) => acc + h.currentValue, 0);
  const totalCost = holdings.reduce((acc, h) => acc + h.totalCost, 0);
  const totalPnL = totalValue - totalCost;
  const totalPnLPercent = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

  // Real daily PnL calculation based on daily holding changes
  const dailyPnL = holdings.reduce((sum, h) => {
    const change = h.dailyChangePercent || 0;
    return sum + (h.currentValue * change) / 100;
  }, 0);
  const dailyPnLPercent = totalValue > 0 ? (dailyPnL / totalValue) * 100 : 0;

  // Total Turnover / Volume metrics across all transactions converted to TRY
  const buyVolume = transactions
    .filter((t) => t.transactionType === 'buy')
    .reduce((sum, t) => {
      const isUsd = (t.currency || '').toUpperCase() === 'USD' || t.exchange === 'NASDAQ' || t.exchange === 'NYSE';
      const rate = isUsd ? (t.exchangeRate && t.exchangeRate > 0 ? t.exchangeRate : liveUsdTry) : 1.0;
      return sum + (t.quantity * t.price * rate) + ((t.commission || 0) * (isUsd ? rate : 1.0));
    }, 0);

  const sellVolume = transactions
    .filter((t) => t.transactionType === 'sell')
    .reduce((sum, t) => {
      const isUsd = (t.currency || '').toUpperCase() === 'USD' || t.exchange === 'NASDAQ' || t.exchange === 'NYSE';
      const rate = isUsd ? (t.exchangeRate && t.exchangeRate > 0 ? t.exchangeRate : liveUsdTry) : 1.0;
      return sum + (t.quantity * t.price * rate) - ((t.commission || 0) * (isUsd ? rate : 1.0));
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
    totalPnL: Number(totalPnL.toFixed(2)),
    totalPnLPercent: Number(totalPnLPercent.toFixed(2)),
    dailyPnL: Number(dailyPnL.toFixed(2)),
    dailyPnLPercent: Number(dailyPnLPercent.toFixed(2)),
    totalVolume: Number(totalVolume.toFixed(2)),
    buyVolume: Number(buyVolume.toFixed(2)),
    sellVolume: Number(sellVolume.toFixed(2)),
    holdings,
    allocation,
  };
}
