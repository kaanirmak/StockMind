import type { CashLedger, CashMovement, PortfolioSummary, Transaction } from '@/types/portfolio';
import type { PriceQuote } from './calculations';
import { palette } from '@/theme/palette';

export function calculateCashLedger(transactions: Transaction[], movements: CashMovement[], prices: Record<string, PriceQuote | number>, today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date())): CashLedger {
  const balances = new Map<string, number>();
  const dailyFlows = new Map<string, Map<string, number>>();
  const opening = new Map<string, number>();
  const intradayFlows = new Map<string, { amount: number; rate: number }[]>();
  let netContributions = 0;
  let todayNetFlows = 0;
  const add = (currency: string, amount: number, date: string, rate?: number) => {
    balances.set(currency, (balances.get(currency) || 0) + amount);
    const dateKey = date.slice(0, 10);
    const days = dailyFlows.get(currency) || new Map<string, number>();
    days.set(dateKey, (days.get(dateKey) || 0) + amount); dailyFlows.set(currency, days);
    if (date.slice(0, 10) < today) opening.set(currency, (opening.get(currency) || 0) + amount);
    else if (currency !== 'TRY' && rate && rate > 0) intradayFlows.set(currency, [...(intradayFlows.get(currency) || []), { amount, rate }]);
  };
  for (const movement of movements) {
    if (movement.movementDate.slice(0, 10) > today) continue;
    const signed = movement.amount * (movement.movementType === 'deposit' ? 1 : -1);
    add(movement.currency, signed, movement.movementDate, movement.exchangeRate);
    netContributions += signed * movement.exchangeRate;
    if (movement.movementDate.slice(0, 10) === today) todayNetFlows += signed * movement.exchangeRate;
  }
  for (const tx of transactions) {
    if (tx.transactionDate.slice(0, 10) > today) continue;
    const currency = tx.currency || (tx.exchange === 'NASDAQ' || tx.exchange === 'NYSE' ? 'USD' : 'TRY');
    const gross = tx.quantity * tx.price;
    const commission = tx.commission || 0;
    let amount = 0;
    if (tx.transactionType === 'buy') amount = -gross - commission;
    else if (tx.transactionType === 'sell') amount = gross - commission;
    else if (tx.transactionType === 'dividend') amount = tx.price * (tx.quantity > 0 ? tx.quantity : 1) - commission;
    else if (tx.transactionType === 'fee') amount = -(tx.price * (tx.quantity > 0 ? tx.quantity : 1) + commission);
    add(currency, amount, tx.transactionDate, tx.exchangeRate);
  }
  const missingRates: string[] = [];
  let dailyFxPnL = 0;
  const rows = [...balances].map(([currency, amount]) => {
    const quote = prices[`${currency}TRY`] || prices[currency] || prices[`${currency}TRY=X`];
    const rate = currency === 'TRY' ? 1 : typeof quote === 'number' ? quote : quote?.price;
    if (!rate || !Number.isFinite(rate) || rate <= 0) {
      if (Math.abs(amount) > 0.000001) missingRates.push(currency);
      return { currency, amount, value: Math.abs(amount) <= 0.000001 ? 0 : null };
    }
    if (currency !== 'TRY' && typeof quote === 'object' && quote.changePercent !== undefined && quote.changePercent > -100) {
      const previousRate = rate / (1 + quote.changePercent / 100);
      dailyFxPnL += (opening.get(currency) || 0) * (rate - previousRate);
    }
    dailyFxPnL += (intradayFlows.get(currency) || []).reduce((sum, flow) => sum + flow.amount * (rate - flow.rate), 0);
    return { currency, amount, value: amount * rate };
  });
  const historicalDeficit = [...dailyFlows.values()].some((days) => { let balance = 0; return [...days].sort(([a], [b]) => a.localeCompare(b)).some(([, flow]) => { balance += flow; return balance < -0.000001; }); });
  return { historicalDeficit, configured: movements.some((movement) => movement.movementDate.slice(0, 10) <= today), balances: rows, totalValue: rows.reduce((sum, row) => sum + (row.value ?? 0), 0), netContributions, missingRates, hasDeficit: rows.some((row) => row.amount < -0.000001), dailyFxPnL, todayNetFlows };
}

export function includeCashInSummary(summary: PortfolioSummary, cash: CashLedger): PortfolioSummary {
  if (!cash.configured) return { ...summary, cash };
  const totalValue = summary.totalValue + cash.totalValue;
  const totalPnL = totalValue - cash.netContributions;
  const dailyPnL = summary.dailyPnL + cash.dailyFxPnL;
  const previousEquity = totalValue - dailyPnL - cash.todayNetFlows;
  const dailyBase = previousEquity > 0 ? previousEquity : Math.max(cash.todayNetFlows, 0);
  const allocation = [...summary.allocation, ...cash.balances.filter((row) => (row.value ?? 0) > 0).map((row) => ({ label: `Nakit ${row.currency}`, value: row.value!, percentage: 0, color: palette.info }))];
  const positiveValue = allocation.reduce((sum, row) => sum + Math.max(row.value, 0), 0);
  return { ...summary, cash, totalValue, totalCost: cash.netContributions, totalPnL, totalPnLPercent: cash.netContributions > 0 ? totalPnL / cash.netContributions * 100 : 0, dailyPnL, dailyPnLPercent: dailyBase > 0 ? dailyPnL / dailyBase * 100 : 0,
    holdings: summary.holdings.map((h) => ({ ...h, weight: positiveValue > 0 ? h.currentValue / positiveValue * 100 : 0 })),
    allocation: allocation.map((row) => ({ ...row, percentage: positiveValue > 0 ? row.value / positiveValue * 100 : 0 })),
    valuationStatus: { ...summary.valuationStatus, isComplete: summary.valuationStatus?.isComplete !== false && cash.missingRates.length === 0, missingFx: Boolean(summary.valuationStatus?.missingFx || cash.missingRates.length), missingPrices: summary.valuationStatus?.missingPrices || [] },
  };
}
