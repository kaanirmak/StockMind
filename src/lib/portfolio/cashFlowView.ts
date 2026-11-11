import type { CashMovement, Transaction } from '@/types/portfolio';
import { cleanSymbol, type PriceQuote } from '@/lib/portfolio/calculations';

export type CashFlowEventKind = 'deposit' | 'withdrawal' | 'dividend' | 'fee';
export type CashFlowPeriodFilter = '7D' | '1M' | '3M' | '1Y' | 'ALL';

export interface CashFlowEventItem {
  id: string;
  date: string; // YYYY-MM-DD
  kind: CashFlowEventKind;
  kindLabel: string;
  currency: string;
  amount: number; // positive magnitude in event currency
  signedAmount: number; // + for inflow/dividend, - for withdrawal/fee
  amountTry: number;
  signedAmountTry: number;
  symbol?: string | null;
  description: string;
}

export interface CashFlowSummaryTotals {
  deposits: number;
  withdrawals: number;
  dividends: number;
  fees: number;
  netCashFlow: number;
}

export interface CashFlowViewReport {
  period: CashFlowPeriodFilter;
  currencyFilter: string;
  availableCurrencies: string[];
  events: CashFlowEventItem[];
  totalsInSelectedCurrency: CashFlowSummaryTotals | null;
  totalsTry: CashFlowSummaryTotals;
}

function getUsdTryFallback(prices: Record<string, PriceQuote | number>): number {
  const q = prices['USDTRY'] ?? prices['USD'];
  const v = typeof q === 'number' ? q : q?.price;
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 38.5;
}

function getEurTryFallback(prices: Record<string, PriceQuote | number>): number {
  const q = prices['EURTRY'] ?? prices['EUR'];
  const v = typeof q === 'number' ? q : q?.price;
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 41.5;
}

function resolveTxCurrency(tx: Transaction): string {
  if (tx.currency && tx.currency.trim()) return tx.currency.trim().toUpperCase();
  const cleaned = cleanSymbol(tx.symbol);
  if (
    tx.exchange === 'NASDAQ' ||
    tx.exchange === 'NYSE' ||
    cleaned.exchange === 'NASDAQ' ||
    cleaned.exchange === 'NYSE'
  ) {
    return 'USD';
  }
  return 'TRY';
}

function resolveTryRate(
  currency: string,
  explicitRate: number | undefined,
  prices: Record<string, PriceQuote | number>
): number {
  if (currency === 'TRY') return 1;
  if (typeof explicitRate === 'number' && Number.isFinite(explicitRate) && explicitRate > 0) {
    return explicitRate;
  }
  if (currency === 'USD') return getUsdTryFallback(prices);
  if (currency === 'EUR') return getEurTryFallback(prices);
  return 1;
}

function cutoffIsoDate(period: CashFlowPeriodFilter, today: string): string | null {
  if (period === 'ALL') return null;
  const days =
    period === '7D' ? 7 : period === '1M' ? 30 : period === '3M' ? 90 : 365;
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/**
 * Aggregates and filters portfolio cash inflows, outflows, dividends, and fees/commissions
 * by date period, currency, and optional flow kind.
 */
export function buildCashFlowViewReport(input: {
  transactions: readonly Transaction[];
  cashMovements: readonly CashMovement[];
  period?: CashFlowPeriodFilter;
  currencyFilter?: string;
  kinds?: readonly CashFlowEventKind[];
  startDate?: string | null;
  endDate?: string | null;
  livePrices?: Record<string, PriceQuote | number>;
  today?: string;
}): CashFlowViewReport {
  const today =
    input.today ||
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date());
  const period: CashFlowPeriodFilter = input.period ?? 'ALL';
  const currencyFilter = (input.currencyFilter || 'ALL').trim().toUpperCase();
  const allowedKinds =
    input.kinds && input.kinds.length > 0 ? new Set(input.kinds) : null;
  const prices = input.livePrices ?? {};

  const allEvents: CashFlowEventItem[] = [];
  const currencySet = new Set<string>();

  for (const m of input.cashMovements) {
    if (!m || !m.movementDate || m.amount <= 0) continue;
    const date = m.movementDate.slice(0, 10);
    if (date > today) continue;
    const currency = (m.currency || 'TRY').trim().toUpperCase();
    currencySet.add(currency);

    const rate = resolveTryRate(currency, m.exchangeRate, prices);
    const amount = Number(m.amount);
    const amountTry = Number((amount * rate).toFixed(2));
    const isDeposit = m.movementType === 'deposit';

    allEvents.push({
      id: `cash:${m.id}`,
      date,
      kind: isDeposit ? 'deposit' : 'withdrawal',
      kindLabel: isDeposit ? 'Para Girişi' : 'Para Çıkışı',
      currency,
      amount: Number(amount.toFixed(2)),
      signedAmount: Number((isDeposit ? amount : -amount).toFixed(2)),
      amountTry,
      signedAmountTry: Number((isDeposit ? amountTry : -amountTry).toFixed(2)),
      symbol: null,
      description: m.notes?.trim() || (isDeposit ? 'Hesaba nakit yatırma' : 'Hesaptan nakit çekme'),
    });
  }

  for (const tx of input.transactions) {
    if (!tx || !tx.transactionDate) continue;
    const date = tx.transactionDate.slice(0, 10);
    if (date > today) continue;
    const currency = resolveTxCurrency(tx);
    currencySet.add(currency);
    const rate = resolveTryRate(currency, tx.exchangeRate, prices);
    const sym = cleanSymbol(tx.symbol).symbol || tx.symbol.toUpperCase();
    const qty = Number(tx.quantity) > 0 ? Number(tx.quantity) : 1;
    const commission = Math.max(0, Number(tx.commission) || 0);

    if (tx.transactionType === 'dividend') {
      const gross = Math.max(0, Number(tx.price) || 0) * qty;
      if (gross > 0) {
        const amountTry = Number((gross * rate).toFixed(2));
        allEvents.push({
          id: `div:${tx.id}`,
          date,
          kind: 'dividend',
          kindLabel: 'Temettü',
          currency,
          amount: Number(gross.toFixed(2)),
          signedAmount: Number(gross.toFixed(2)),
          amountTry,
          signedAmountTry: amountTry,
          symbol: sym,
          description: tx.notes?.trim() || `${sym} temettü ödemesi`,
        });
      }
      if (commission > 0) {
        const feeTry = Number((commission * rate).toFixed(2));
        allEvents.push({
          id: `div-fee:${tx.id}`,
          date,
          kind: 'fee',
          kindLabel: 'Ücret / Komisyon',
          currency,
          amount: Number(commission.toFixed(2)),
          signedAmount: Number((-commission).toFixed(2)),
          amountTry: feeTry,
          signedAmountTry: Number((-feeTry).toFixed(2)),
          symbol: sym,
          description: `${sym} temettü kesintisi / komisyonu`,
        });
      }
      continue;
    }

    if (tx.transactionType === 'fee') {
      const feeBase = Math.max(0, Number(tx.price) || 0) * qty + commission;
      if (feeBase > 0) {
        const feeTry = Number((feeBase * rate).toFixed(2));
        allEvents.push({
          id: `fee:${tx.id}`,
          date,
          kind: 'fee',
          kindLabel: 'Ücret / Komisyon',
          currency,
          amount: Number(feeBase.toFixed(2)),
          signedAmount: Number((-feeBase).toFixed(2)),
          amountTry: feeTry,
          signedAmountTry: Number((-feeTry).toFixed(2)),
          symbol: sym !== 'FEE' ? sym : null,
          description: tx.notes?.trim() || 'Platform / saklama / hesap ücreti',
        });
      }
      continue;
    }

    if ((tx.transactionType === 'buy' || tx.transactionType === 'sell') && commission > 0) {
      const feeTry = Number((commission * rate).toFixed(2));
      allEvents.push({
        id: `tx-comm:${tx.id}`,
        date,
        kind: 'fee',
        kindLabel: 'Ücret / Komisyon',
        currency,
        amount: Number(commission.toFixed(2)),
        signedAmount: Number((-commission).toFixed(2)),
        amountTry: feeTry,
        signedAmountTry: Number((-feeTry).toFixed(2)),
        symbol: sym,
        description: `${sym} ${tx.transactionType === 'buy' ? 'alış' : 'satış'} işlem komisyonu`,
      });
    }
  }

  const effectiveStart = input.startDate?.trim() || cutoffIsoDate(period, today);
  const effectiveEnd = input.endDate?.trim() || today;

  const filtered = allEvents
    .filter((ev) => {
      if (effectiveStart && ev.date < effectiveStart) return false;
      if (effectiveEnd && ev.date > effectiveEnd) return false;
      if (currencyFilter !== 'ALL' && ev.currency !== currencyFilter) return false;
      if (allowedKinds && !allowedKinds.has(ev.kind)) return false;
      return true;
    })
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));

  const accumulate = (native: boolean): CashFlowSummaryTotals => {
    let deposits = 0;
    let withdrawals = 0;
    let dividends = 0;
    let fees = 0;
    for (const ev of filtered) {
      const v = native ? ev.amount : ev.amountTry;
      if (ev.kind === 'deposit') deposits += v;
      else if (ev.kind === 'withdrawal') withdrawals += v;
      else if (ev.kind === 'dividend') dividends += v;
      else if (ev.kind === 'fee') fees += v;
    }
    const netCashFlow = deposits + dividends - withdrawals - fees;
    return {
      deposits: Number(deposits.toFixed(2)),
      withdrawals: Number(withdrawals.toFixed(2)),
      dividends: Number(dividends.toFixed(2)),
      fees: Number(fees.toFixed(2)),
      netCashFlow: Number(netCashFlow.toFixed(2)),
    };
  };

  return {
    period,
    currencyFilter,
    availableCurrencies: Array.from(currencySet).sort(),
    events: filtered,
    totalsInSelectedCurrency: currencyFilter !== 'ALL' ? accumulate(true) : null,
    totalsTry: accumulate(false),
  };
}
