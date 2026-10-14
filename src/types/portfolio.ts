// Portfolio Types

import type { Exchange } from './stock';

export type AssetType = 'stock' | 'fund';
export type TransactionType = 'buy' | 'sell' | 'dividend' | 'split' | 'fee';

export interface Portfolio {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  currency: string;
  isDefault: boolean;
  createdAt: string;
  totalValue?: number;
  totalCost?: number;
  totalPnL?: number;
  totalPnLPercent?: number;
}

export interface Transaction {
  id: string;
  portfolioId: string;
  userId: string;
  symbol: string;
  assetType: AssetType;
  transactionType: TransactionType;
  quantity: number;
  price: number;
  currency?: 'TRY' | 'USD' | string;
  exchangeRate?: number; // USD/TRY exchange rate at transaction time
  commission: number;
  transactionDate: string;
  exchange: Exchange | 'TEFAS' | null;
  notes: string | null;
  createdAt: string;
}

export interface Holding {
  symbol: string;
  assetType: AssetType;
  exchange: Exchange | 'TEFAS' | null;
  currency?: 'TRY' | 'USD' | string;
  originalCurrency?: 'TRY' | 'USD' | string;
  originalPrice?: number; // Native currency price (e.g. $225.40)
  originalAverageCost?: number; // Native currency avg cost (e.g. $225.40)
  totalQuantity: number;
  averageCost: number; // In Portfolio Base Currency (TRY)
  totalCost: number; // In Portfolio Base Currency (TRY)
  currentPrice: number; // In Portfolio Base Currency (TRY)
  currentValue: number; // In Portfolio Base Currency (TRY)
  pnl: number; // In Portfolio Base Currency (TRY)
  pnlPercent: number;
  fxPnL?: number; // In Portfolio Base Currency (TRY): Currency fluctuation impact (FIN-04)
  assetPnL?: number; // In Portfolio Base Currency (TRY): Pure price movement impact (FIN-04)
  dividendsEarned?: number; // Received dividends in TRY (FIN-06)
  feesPaid?: number; // Fees paid in TRY (FIN-06)
  weight: number; // percentage of portfolio
  dailyChangePercent?: number;
  lots?: {
    shares: number;
    costTry: number;
    costNative: number;
    date: string;
    rate?: number;
    priceNative?: number;
  }[];
}

export interface ValuationStatus {
  isComplete: boolean;
  missingFx: boolean;
  missingPrices: string[];
  stalePrices?: string[];
  hasMissingPrices?: boolean;
}

export interface PortfolioSummary {
  totalValue: number;
  totalCost: number;
  totalPnL: number;
  totalPnLPercent: number;
  realizedPnL: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  dailyPnL: number;
  dailyPnLPercent: number;
  fxPnL?: number; // Net portfolio currency impact (FIN-04)
  assetPnL?: number; // Net asset price change impact (FIN-04)
  dividendsTotal?: number; // Total dividend returns (FIN-06)
  feesTotal?: number; // Total standalone fees paid (FIN-06)
  totalVolume: number; // Toplam işlem hacmi (TRY)
  buyVolume: number; // Toplam alış hacmi (TRY)
  sellVolume: number; // Toplam satış hacmi (TRY)
  holdings: Holding[];
  allocation: { label: string; value: number; percentage: number; color: string }[];
  valuationStatus?: ValuationStatus;
}

export interface TransactionFormData {
  symbol: string;
  assetType: AssetType;
  transactionType: TransactionType;
  quantity: number;
  price: number;
  currency?: 'TRY' | 'USD' | string;
  exchangeRate?: number;
  commission: number;
  transactionDate: string;
  exchange: Exchange | 'TEFAS' | null;
  notes: string;
}
