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
  totalQuantity: number;
  averageCost: number;
  totalCost: number;
  currentPrice: number;
  currentValue: number;
  pnl: number;
  pnlPercent: number;
  weight: number; // percentage of portfolio
}

export interface PortfolioSummary {
  totalValue: number;
  totalCost: number;
  totalPnL: number;
  totalPnLPercent: number;
  dailyPnL: number;
  dailyPnLPercent: number;
  holdings: Holding[];
  allocation: { label: string; value: number; percentage: number; color: string }[];
}

export interface TransactionFormData {
  symbol: string;
  assetType: AssetType;
  transactionType: TransactionType;
  quantity: number;
  price: number;
  commission: number;
  transactionDate: string;
  exchange: Exchange | 'TEFAS' | null;
  notes: string;
}
