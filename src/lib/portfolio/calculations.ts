import { Holding, PortfolioSummary, Transaction } from '@/types/portfolio';
import { POPULAR_STOCKS } from '@/lib/data/stocks';
import { TEFAS_FUNDS } from '@/lib/data/funds';

export function getCurrentAssetPrice(symbol: string, assetType: 'stock' | 'fund'): number {
  if (assetType === 'stock') {
    const stock = POPULAR_STOCKS.find((s) => s.symbol.toUpperCase() === symbol.toUpperCase());
    return stock ? stock.basePrice : 100;
  } else {
    const fund = TEFAS_FUNDS.find((f) => f.code.toUpperCase() === symbol.toUpperCase());
    return fund ? fund.price : 5.0;
  }
}

export function calculatePortfolioHoldings(transactions: Transaction[]): Holding[] {
  const map = new Map<
    string,
    {
      symbol: string;
      assetType: 'stock' | 'fund';
      exchange: any;
      totalShares: number;
      totalBuyCost: number;
      buyQuantity: number;
    }
  >();

  // Sort by date ascending to correctly calculate weighted cost
  const sorted = [...transactions].sort(
    (a, b) => new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime()
  );

  for (const t of sorted) {
    const key = `${t.assetType}_${t.symbol.toUpperCase()}`;
    const existing = map.get(key) || {
      symbol: t.symbol.toUpperCase(),
      assetType: t.assetType,
      exchange: t.exchange,
      totalShares: 0,
      totalBuyCost: 0,
      buyQuantity: 0,
    };

    if (t.transactionType === 'buy') {
      existing.totalShares += t.quantity;
      existing.totalBuyCost += t.quantity * t.price + (t.commission || 0);
      existing.buyQuantity += t.quantity;
    } else if (t.transactionType === 'sell') {
      const avgCost = existing.totalShares > 0 ? existing.totalBuyCost / existing.totalShares : 0;
      existing.totalShares = Math.max(0, existing.totalShares - t.quantity);
      existing.totalBuyCost = existing.totalShares * avgCost;
    }

    map.set(key, existing);
  }

  const holdings: Holding[] = [];

  map.forEach((item) => {
    if (item.totalShares > 0) {
      const currentPrice = getCurrentAssetPrice(item.symbol, item.assetType);
      const averageCost = item.totalBuyCost / item.totalShares;
      const totalCost = item.totalBuyCost;
      const currentValue = item.totalShares * currentPrice;
      const pnl = currentValue - totalCost;
      const pnlPercent = totalCost > 0 ? (pnl / totalCost) * 100 : 0;

      holdings.push({
        symbol: item.symbol,
        assetType: item.assetType,
        exchange: item.exchange,
        totalQuantity: item.totalShares,
        averageCost: Number(averageCost.toFixed(4)),
        totalCost: Number(totalCost.toFixed(2)),
        currentPrice: Number(currentPrice.toFixed(4)),
        currentValue: Number(currentValue.toFixed(2)),
        pnl: Number(pnl.toFixed(2)),
        pnlPercent: Number(pnlPercent.toFixed(2)),
        weight: 0, // calculated later
      });
    }
  });

  const totalPortfolioValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);

  holdings.forEach((h) => {
    h.weight = totalPortfolioValue > 0 ? Number(((h.currentValue / totalPortfolioValue) * 100).toFixed(1)) : 0;
  });

  return holdings.sort((a, b) => b.currentValue - a.currentValue);
}

const PALETTE = ['#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#14b8a6', '#f97316'];

export function calculatePortfolioSummary(transactions: Transaction[]): PortfolioSummary {
  const holdings = calculatePortfolioHoldings(transactions);

  const totalValue = holdings.reduce((acc, h) => acc + h.currentValue, 0);
  const totalCost = holdings.reduce((acc, h) => acc + h.totalCost, 0);
  const totalPnL = totalValue - totalCost;
  const totalPnLPercent = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

  // Mock daily PnL calculation based on daily returns
  const dailyPnL = totalValue * 0.0142; // +1.42% daily average
  const dailyPnLPercent = 1.42;

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
    dailyPnLPercent,
    holdings,
    allocation,
  };
}
