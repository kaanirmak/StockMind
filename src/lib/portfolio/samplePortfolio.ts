import type { CashMovement, Portfolio, PortfolioSummary, Transaction } from '@/types/portfolio';
import { calculatePortfolioSummary, type PriceQuote } from './calculations';
import { calculateCashLedger, includeCashInSummary } from './cash';

export const SAMPLE_PORTFOLIO_ID = 'sample-preview';
export const SAMPLE_USER_ID = 'sample-preview';

export const SAMPLE_PORTFOLIO: Portfolio = {
  id: SAMPLE_PORTFOLIO_ID,
  userId: SAMPLE_USER_ID,
  name: 'Örnek Karma Portföy',
  description: 'BIST, ABD hisseleri ve TEFAS fonlarından oluşan tanıtım portföyü',
  currency: 'TRY',
  isDefault: true,
  createdAt: '2026-01-05T09:00:00.000Z',
};

export const SAMPLE_TRANSACTIONS: Transaction[] = [
  {
    id: 'sample-tx-1',
    portfolioId: SAMPLE_PORTFOLIO_ID,
    userId: SAMPLE_USER_ID,
    symbol: 'THYAO',
    assetType: 'stock',
    transactionType: 'buy',
    quantity: 120,
    price: 278.5,
    currency: 'TRY',
    commission: 45,
    transactionDate: '2026-01-12',
    exchange: 'BIST',
    notes: 'Örnek BIST havacılık pozisyonu',
    createdAt: '2026-01-12T10:30:00.000Z',
  },
  {
    id: 'sample-tx-2',
    portfolioId: SAMPLE_PORTFOLIO_ID,
    userId: SAMPLE_USER_ID,
    symbol: 'TUPRS',
    assetType: 'stock',
    transactionType: 'buy',
    quantity: 180,
    price: 162.0,
    currency: 'TRY',
    commission: 38,
    transactionDate: '2026-02-03',
    exchange: 'BIST',
    notes: 'Örnek enerji ve rafineri pozisyonu',
    createdAt: '2026-02-03T11:15:00.000Z',
  },
  {
    id: 'sample-tx-3',
    portfolioId: SAMPLE_PORTFOLIO_ID,
    userId: SAMPLE_USER_ID,
    symbol: 'AAPL',
    assetType: 'stock',
    transactionType: 'buy',
    quantity: 8,
    price: 215.0,
    currency: 'USD',
    exchangeRate: 35.4,
    commission: 2.5,
    transactionDate: '2026-02-18',
    exchange: 'NASDAQ',
    notes: 'Örnek ABD teknoloji pozisyonu',
    createdAt: '2026-02-18T17:45:00.000Z',
  },
  {
    id: 'sample-tx-4',
    portfolioId: SAMPLE_PORTFOLIO_ID,
    userId: SAMPLE_USER_ID,
    symbol: 'TI2',
    assetType: 'fund',
    transactionType: 'buy',
    quantity: 4500,
    price: 7.42,
    currency: 'TRY',
    commission: 0,
    transactionDate: '2026-03-04',
    exchange: 'TEFAS',
    notes: 'Örnek TEFAS hisse yoğun fon pozisyonu',
    createdAt: '2026-03-04T09:20:00.000Z',
  },
];

export const SAMPLE_CASH_MOVEMENTS: CashMovement[] = [
  {
    id: 'sample-cash-1',
    portfolioId: SAMPLE_PORTFOLIO_ID,
    userId: SAMPLE_USER_ID,
    movementType: 'deposit',
    amount: 180000,
    currency: 'TRY',
    exchangeRate: 1,
    movementDate: '2026-01-10',
    notes: 'Örnek başlangıç nakit yatırma',
    createdAt: '2026-01-10T09:00:00.000Z',
  },
];

export const SAMPLE_PRICES: Record<string, PriceQuote> = {
  THYAO: { price: 312.0, changePercent: 2.35 },
  TUPRS: { price: 171.5, changePercent: -0.85 },
  AAPL: { price: 229.4, changePercent: 1.42 },
  TI2: { price: 8.15, changePercent: 1.12 },
  USDTRY: { price: 36.2, changePercent: 0.18 },
};

export function getSamplePortfolioSnapshot(
  livePrices?: Record<string, PriceQuote>,
): {
  portfolio: Portfolio;
  transactions: Transaction[];
  cashMovements: CashMovement[];
  prices: Record<string, PriceQuote>;
  summary: PortfolioSummary;
} {
  const mergedPrices: Record<string, PriceQuote> = {
    ...SAMPLE_PRICES,
    ...(livePrices || {}),
  };
  const baseSummary = calculatePortfolioSummary(SAMPLE_TRANSACTIONS, mergedPrices);
  const cashLedger = calculateCashLedger(
    SAMPLE_TRANSACTIONS,
    SAMPLE_CASH_MOVEMENTS,
    mergedPrices,
  );
  const summary = includeCashInSummary(baseSummary, cashLedger);

  return {
    portfolio: SAMPLE_PORTFOLIO,
    transactions: SAMPLE_TRANSACTIONS,
    cashMovements: SAMPLE_CASH_MOVEMENTS,
    prices: mergedPrices,
    summary,
  };
}
