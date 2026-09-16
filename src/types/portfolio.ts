// Portfolio Types

import type { Exchange } from './stock';

export type AssetType = 'stock' | 'fund';
export type TransactionType = 'buy' | 'sell';

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
  weight: number; // percentage of portfolio
  dailyChangePercent?: number;
}

export interface PortfolioSummary {
  totalValue: number;
  totalCost: number;
  totalPnL: number;
  totalPnLPercent: number;
  dailyPnL: number;
  dailyPnLPercent: number;
  totalVolume: number; // Toplam işlem hacmi (TRY)
  buyVolume: number; // Toplam alış hacmi (TRY)
  sellVolume: number; // Toplam satış hacmi (TRY)
  holdings: Holding[];
  allocation: { label: string; value: number; percentage: number; color: string }[];
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
