// Portfolio & P&L Calculation Utilities

import type { Transaction, Holding, PortfolioSummary } from '@/types';

/**
 * Calculate weighted average cost for a symbol from a list of transactions
 */
export function calculateAverageCost(transactions: Transaction[]): number {
  interface CostLot {
    quantity: number;
    price: number;
    commission: number;
  }

  const sorted = [...transactions].sort((a, b) => {
    const timeDiff = new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime();
    if (timeDiff !== 0) return timeDiff;
    if (a.transactionType === 'sell' && b.transactionType === 'buy') return -1;
    if (a.transactionType === 'buy' && b.transactionType === 'sell') return 1;
    return 0;
  });

  const lots: CostLot[] = [];

  for (const tx of sorted) {
    if (tx.transactionType === 'buy') {
      lots.push({
        quantity: tx.quantity,
        price: tx.price,
        commission: tx.commission || 0,
      });
    } else if (tx.transactionType === 'sell') {
      let remainingSell = tx.quantity;
      while (remainingSell > 0 && lots.length > 0) {
        if (lots[0].quantity <= remainingSell + 0.000001) {
          remainingSell -= lots[0].quantity;
          lots.shift();
        } else {
          const ratio = remainingSell / lots[0].quantity;
          lots[0].quantity -= remainingSell;
          lots[0].commission -= lots[0].commission * ratio;
          remainingSell = 0;
        }
      }
    }
  }

  const remainingQty = lots.reduce((sum, l) => sum + l.quantity, 0);
  const remainingCost = lots.reduce((sum, l) => sum + (l.quantity * l.price + l.commission), 0);
  return remainingQty > 0 ? remainingCost / remainingQty : 0;
}

/**
 * Calculate current holdings from transactions
 */
export function calculateHoldings(
  transactions: Transaction[],
  currentPrices: Map<string, number>
): Holding[] {
  const symbolMap = new Map<string, Transaction[]>();

  for (const tx of transactions) {
    const key = `${tx.symbol}:${tx.exchange}`;
    if (!symbolMap.has(key)) {
      symbolMap.set(key, []);
    }
    symbolMap.get(key)!.push(tx);
  }

  const holdings: Holding[] = [];
  let totalPortfolioValue = 0;

  // First pass: calculate values
  for (const [key, txs] of symbolMap) {
    const [symbol, exchange] = key.split(':');
    let totalQuantity = 0;

    for (const tx of txs) {
      if (tx.transactionType === 'buy') {
        totalQuantity += tx.quantity;
      } else {
        totalQuantity -= tx.quantity;
      }
    }

    if (totalQuantity <= 0) continue;

    const averageCost = calculateAverageCost(txs);
    const currentPrice = currentPrices.get(symbol) ?? averageCost;
    const totalCost = totalQuantity * averageCost;
    const currentValue = totalQuantity * currentPrice;
    const pnl = currentValue - totalCost;
    const pnlPercent = totalCost > 0 ? (pnl / totalCost) * 100 : 0;

    holdings.push({
      symbol,
      assetType: txs[0].assetType,
      exchange: (exchange === 'null' ? null : exchange) as Holding['exchange'],
      totalQuantity,
      averageCost,
      totalCost,
      currentPrice,
      currentValue,
      pnl,
      pnlPercent,
      weight: 0, // Will be calculated in second pass
    });

    totalPortfolioValue += currentValue;
  }

  // Second pass: calculate weights
  for (const holding of holdings) {
    holding.weight =
      totalPortfolioValue > 0
        ? (holding.currentValue / totalPortfolioValue) * 100
        : 0;
  }

  return holdings.sort((a, b) => b.currentValue - a.currentValue);
}

/**
 * Calculate portfolio summary from holdings
 */
export function calculatePortfolioSummary(
  holdings: Holding[]
): Omit<PortfolioSummary, 'dailyPnL' | 'dailyPnLPercent' | 'allocation'> {
  const totalValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);
  const totalCost = holdings.reduce((sum, h) => sum + h.totalCost, 0);
  const totalPnL = totalValue - totalCost;
  const totalPnLPercent = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

  return {
    totalValue,
    totalCost,
    totalPnL,
    totalPnLPercent,
    totalVolume: totalCost,
    buyVolume: totalCost,
    sellVolume: 0,
    holdings,
  };
}

/**
 * Generate allocation data for pie charts
 */
const ALLOCATION_COLORS = [
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e', '#f97316', '#eab308',
  '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
];

export function generateAllocation(
  holdings: Holding[]
): PortfolioSummary['allocation'] {
  return holdings.map((h, i) => ({
    label: h.symbol,
    value: h.currentValue,
    percentage: h.weight,
    color: ALLOCATION_COLORS[i % ALLOCATION_COLORS.length],
  }));
}
