// Stock & Market Types

export type Exchange = 'BIST' | 'NYSE' | 'NASDAQ' | 'CRYPTO' | 'COMMODITY' | 'FOREX' | 'INDEX';

export type QuoteStatus = 'live' | 'delayed' | 'closed' | 'stale' | 'unavailable';

export interface UnifiedPriceQuote {
  instrumentId: string; // Standardized ID: e.g. 'BIST:THYAO', 'TEFAS:TI2', 'NASDAQ:AAPL'
  symbol: string;       // Bare ticker, e.g. 'THYAO'
  exchange: Exchange | 'TEFAS';
  currency: 'TRY' | 'USD' | 'EUR';
  price: number;
  previousClose?: number;
  change?: number;
  changePercent?: number;
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
  asOf: string;          // ISO 8601 market time
  fetchedAt: string;     // ISO 8601 timestamp when query was executed
  source: string;        // 'bist', 'tefas', 'yahoo', 'binance', etc.
  status: QuoteStatus;
  isStale?: boolean;
}

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
  currency: 'TRY' | 'USD' | 'EUR';
  peRatio?: number;
  dividendYield?: number;
  high52w: number;
  low52w: number;
}

export interface Stock {
  symbol: string;
  name: string;
  exchange: Exchange;
  currency: 'TRY' | 'USD' | 'EUR';
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

export interface StockMarketInfo {
  symbol: string;
  name: string;
  exchange: 'BIST' | 'NASDAQ' | 'NYSE' | 'CRYPTO' | 'COMMODITY' | 'FOREX' | 'INDEX';
  currency: string;
  sector: string;
  subCategory?: string;
  unit?: string;
  isIndex?: boolean;
  basePrice: number;
  price?: number;
  change?: number;
  changePercent?: number;
  high?: number;
  low?: number;
  open?: number;
  close?: number;
  previousClose?: number;
  volume?: number;
  marketCap?: number;
  peRatio?: number;
  dividendYield?: number;
  high52w?: number;
  low52w?: number;
  timestamp?: string;
}
