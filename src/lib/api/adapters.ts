import { UnifiedPriceQuote, QuoteStatus, Exchange } from '@/types/stock';
import { normalizeInstrumentId, cleanSymbol } from '@/lib/utils/symbol';

export interface RawMarketQuote {
  symbol: string;
  name?: string;
  price?: number;
  previousClose?: number;
  change?: number;
  changePercent?: number;
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
  currency?: string;
  exchange?: string;
  timestamp?: string;
}

/**
 * Transforms provider quotes into standard UnifiedPriceQuote contract (DATA-06, DATA-07).
 * Sets explicit quote status ('live' | 'delayed' | 'closed' | 'stale' | 'unavailable').
 */
export function toUnifiedPriceQuote(
  raw: RawMarketQuote,
  source: string = 'market_data',
  statusOverride?: QuoteStatus
): UnifiedPriceQuote {
  const cleaned = cleanSymbol(raw.symbol || '');
  const bareSymbol = cleaned.symbol || (raw.symbol || '').toUpperCase().trim();
  const rawExchange = raw.exchange || cleaned.exchange || (cleaned.assetType === 'fund' ? 'TEFAS' : 'BIST');
  const exchange = rawExchange.toUpperCase() as Exchange | 'TEFAS';
  const instrumentId = normalizeInstrumentId(bareSymbol, exchange);

  const price = typeof raw.price === 'number' && Number.isFinite(raw.price) && raw.price > 0 ? raw.price : 0;
  const now = new Date().toISOString();
  const asOf = raw.timestamp || now;

  let status: QuoteStatus = statusOverride || 'live';
  if (price <= 0) {
    status = 'unavailable';
  }

  const isUsd = (raw.currency || '').toUpperCase() === 'USD' || exchange === 'NASDAQ' || exchange === 'NYSE';
  const currency: 'TRY' | 'USD' | 'EUR' = isUsd ? 'USD' : (raw.currency as any) || 'TRY';

  return {
    instrumentId,
    symbol: bareSymbol,
    exchange,
    currency,
    price,
    previousClose: raw.previousClose,
    change: raw.change,
    changePercent: raw.changePercent,
    open: raw.open,
    high: raw.high,
    low: raw.low,
    volume: raw.volume,
    asOf,
    fetchedAt: now,
    source,
    status,
    isStale: status === 'stale',
  };
}
