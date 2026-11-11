import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { StockMarketInfo } from '@/types/stock';

const memoryVerifiedStore = new Map<string, StockMarketInfo>();

function getQuoteStoreClient(preferWrite: boolean): SupabaseClient | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  const readKey =
    serviceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const key = preferWrite ? serviceKey : readKey;

  if (!supabaseUrl || !key || supabaseUrl.includes('placeholder')) {
    return null;
  }

  try {
    return createClient(supabaseUrl, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  } catch {
    return null;
  }
}

export function isVerifiedMarketQuote(quote: StockMarketInfo | null | undefined): quote is StockMarketInfo {
  if (!quote || !quote.symbol || !quote.observation) return false;
  if (typeof quote.price !== 'number' || !Number.isFinite(quote.price) || quote.price <= 0) return false;
  const fetchedMs = Date.parse(quote.observation.fetchedAt);
  if (!Number.isFinite(fetchedMs)) return false;
  if (quote.observation.asOf !== null && quote.observation.asOf !== undefined) {
    const asOfMs = Date.parse(quote.observation.asOf);
    if (!Number.isFinite(asOfMs)) return false;
  }
  return Boolean(quote.observation.source && quote.observation.source.trim().length > 0);
}

function normalizeSymbolKey(symbol: string): string {
  return symbol.trim().toUpperCase();
}

export async function recordVerifiedQuotes(
  quotes: Array<StockMarketInfo | null | undefined>,
  options?: { supabase?: SupabaseClient | null }
): Promise<number> {
  const verified = quotes.filter(isVerifiedMarketQuote);
  if (verified.length === 0) return 0;

  const deduped = new Map<string, StockMarketInfo>();
  for (const quote of verified) {
    const key = normalizeSymbolKey(quote.symbol);
    const cleanQuote: StockMarketInfo = {
      ...quote,
      symbol: key,
      isLastKnown: false,
    };
    memoryVerifiedStore.set(key, cleanQuote);
    deduped.set(key, cleanQuote);
  }

  const supabase = options?.supabase !== undefined ? options.supabase : getQuoteStoreClient(true);
  if (supabase) {
    try {
      const rows = Array.from(deduped.entries()).map(([sym, quote]) => ({
        symbol: sym,
        quote,
        source: quote.observation!.source,
        observed_at: quote.observation!.asOf,
        fetched_at: quote.observation!.fetchedAt,
        updated_at: new Date().toISOString(),
      }));
      const { error } = await supabase.from('market_quote_cache').upsert(rows, { onConflict: 'symbol' });
      if (error) {
        console.warn('[LastVerifiedStore] Failed to persist market quotes:', error.code || error.message);
      }
    } catch (err) {
      console.warn('[LastVerifiedStore] Unexpected DB persistence error:', err);
    }
  }

  return deduped.size;
}

export async function getLastVerifiedQuotes(
  symbols: string[],
  options?: { supabase?: SupabaseClient | null }
): Promise<Map<string, StockMarketInfo>> {
  const normalized = Array.from(new Set(symbols.map(normalizeSymbolKey).filter(Boolean)));
  const result = new Map<string, StockMarketInfo>();
  const missing: string[] = [];

  for (const sym of normalized) {
    const cached = memoryVerifiedStore.get(sym);
    if (cached && isVerifiedMarketQuote(cached)) {
      result.set(sym, { ...cached, isLastKnown: true });
    } else {
      missing.push(sym);
    }
  }

  if (missing.length > 0) {
    const supabase = options?.supabase !== undefined ? options.supabase : getQuoteStoreClient(false);
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('market_quote_cache')
          .select('symbol, quote')
          .in('symbol', missing);
        if (!error && Array.isArray(data)) {
          for (const row of data) {
            const candidate = (row as { symbol?: string; quote?: StockMarketInfo })?.quote;
            if (isVerifiedMarketQuote(candidate)) {
              const key = normalizeSymbolKey(row.symbol || candidate.symbol);
              memoryVerifiedStore.set(key, { ...candidate, symbol: key, isLastKnown: false });
              result.set(key, { ...candidate, symbol: key, isLastKnown: true });
            }
          }
        }
      } catch (err) {
        console.warn('[LastVerifiedStore] Failed to read cached quotes:', err);
      }
    }
  }

  return result;
}

export async function getLastVerifiedQuote(
  symbol: string,
  options?: { supabase?: SupabaseClient | null }
): Promise<StockMarketInfo | null> {
  const key = normalizeSymbolKey(symbol);
  if (!key) return null;
  const map = await getLastVerifiedQuotes([key], options);
  return map.get(key) ?? null;
}

export function __clearLastVerifiedQuotesForTests() {
  memoryVerifiedStore.clear();
}
