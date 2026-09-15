// Stock & Market Types

export type Exchange = 'BIST' | 'NYSE' | 'NASDAQ';

export interface StockQuote {
  symbol: string;
  exchange: Exchange;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  marketCap: number;
  previousClose: number;
  timestamp: string;
}

export interface StockDetail extends StockQuote {
  sector: string;
  currency: 'TRY' | 'USD';
  peRatio?: number;
  dividendYield?: number;
  high52w: number;
  low52w: number;
}

export interface Stock {
  symbol: string;
  name: string;
  exchange: Exchange;
  currency: 'TRY' | 'USD';
  sector: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number;
}

export interface OHLCV {
  time: string; // ISO date string (YYYY-MM-DD)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type TimeInterval =
  | '1D'
  | '1W'
  | '1M'
  | '3M'
  | '6M'
  | '1Y'
  | '5Y'
  | 'MAX';

export interface StockSearchResult {
  symbol: string;
  name: string;
  exchange: Exchange;
  type: string;
}

export interface MarketIndex {
  symbol: string;
  name: string;
  value: number;
  change: number;
  changePercent: number;
}

export type TechnicalIndicatorType =
  | 'RSI'
  | 'MACD'
  | 'BOLLINGER'
  | 'SMA'
  | 'EMA'
  | 'STOCHASTIC_RSI';

export interface TechnicalIndicator {
  type: TechnicalIndicatorType;
  values: { time: string; value: number; [key: string]: string | number }[];
  params: Record<string, number>;
}
