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

export function buildVerifiedQuoteStorageKey(symbol: string, exchange?: string | null): string {
  const cleanSym = symbol.trim().toUpperCase();
  if (!cleanSym) return '';
  if (cleanSym.includes(':')) return cleanSym;
  const cleanExchange = exchange ? exchange.trim().toUpperCase() : '';
  return cleanExchange ? `${cleanExchange}:${cleanSym}` : cleanSym;
}

export async function recordVerifiedQuotes(
  quotes: Array<StockMarketInfo | null | undefined>,
  options?: { supabase?: SupabaseClient | null }
): Promise<number> {
  const verified = quotes.filter(isVerifiedMarketQuote);
  if (verified.length === 0) return 0;

  const deduped = new Map<string, StockMarketInfo>();
  const seenBareExchanges = new Map<string, string>();
  for (const quote of verified) {
    const bareSym = normalizeSymbolKey(quote.symbol);
    const qualifiedKey = buildVerifiedQuoteStorageKey(bareSym, quote.exchange);
    const exUpper = String(quote.exchange || '').toUpperCase();
    const cleanQuote: StockMarketInfo = {
      ...quote,
      symbol: bareSym,
      isLastKnown: false,
    };
    memoryVerifiedStore.set(qualifiedKey, cleanQuote);
    deduped.set(qualifiedKey, cleanQuote);

    // Keep bare symbol key in sync for overview/single-exchange callers unless conflicting exchange observed
    if (qualifiedKey !== bareSym) {
      const priorExchange = seenBareExchanges.get(bareSym);
      const existingBare = memoryVerifiedStore.get(bareSym);
      if (priorExchange && priorExchange !== exUpper) {
        deduped.delete(bareSym);
      } else if (!existingBare || String(existingBare.exchange || '').toUpperCase() === exUpper) {
        seenBareExchanges.set(bareSym, exUpper);
        memoryVerifiedStore.set(bareSym, cleanQuote);
        deduped.set(bareSym, cleanQuote);
      }
    }
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
  options?: { supabase?: SupabaseClient | null; exchange?: string | null }
): Promise<Map<string, StockMarketInfo>> {
  const requestedExchange = options?.exchange ? options.exchange.trim().toUpperCase() : '';
  const normalized = Array.from(
    new Set(
      symbols
        .map((s) => (requestedExchange ? buildVerifiedQuoteStorageKey(s, requestedExchange) : normalizeSymbolKey(s)))
        .filter(Boolean),
    ),
  );
  const result = new Map<string, StockMarketInfo>();
  const missing: string[] = [];

  for (const lookupKey of normalized) {
    const bareSym = lookupKey.includes(':') ? lookupKey.split(':')[1] : lookupKey;
    const cached = memoryVerifiedStore.get(lookupKey) ?? (lookupKey.includes(':') ? undefined : memoryVerifiedStore.get(bareSym));
    if (
      cached &&
      isVerifiedMarketQuote(cached) &&
      (!requestedExchange || String(cached.exchange || '').toUpperCase() === requestedExchange)
    ) {
      result.set(bareSym, { ...cached, isLastKnown: true });
      result.set(lookupKey, { ...cached, isLastKnown: true });
    } else {
      missing.push(lookupKey);
    }
  }

  if (missing.length > 0) {
    const supabase = options?.supabase !== undefined ? options.supabase : getQuoteStoreClient(false);
    if (supabase) {
      try {
        const bareCandidates = Array.from(
          new Set(missing.flatMap((k) => (k.includes(':') ? [k, k.split(':')[1]] : [k]))),
        );
        const { data, error } = await supabase
          .from('market_quote_cache')
          .select('symbol, quote')
          .in('symbol', bareCandidates);
        if (!error && Array.isArray(data)) {
          for (const row of data) {
            const candidate = (row as { symbol?: string; quote?: StockMarketInfo })?.quote;
            if (!isVerifiedMarketQuote(candidate)) continue;
            if (requestedExchange && String(candidate.exchange || '').toUpperCase() !== requestedExchange) {
              continue;
            }
            const rawKey = normalizeSymbolKey(row.symbol || candidate.symbol);
            const bareKey = rawKey.includes(':') ? rawKey.split(':')[1] : rawKey;
            const qualifiedKey = buildVerifiedQuoteStorageKey(bareKey, candidate.exchange);
            const cleanCandidate = { ...candidate, symbol: bareKey, isLastKnown: false };
            memoryVerifiedStore.set(qualifiedKey, cleanCandidate);
            result.set(qualifiedKey, { ...cleanCandidate, isLastKnown: true });
            result.set(bareKey, { ...cleanCandidate, isLastKnown: true });
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
  options?: { supabase?: SupabaseClient | null; exchange?: string | null }
): Promise<StockMarketInfo | null> {
  const lookupKey = options?.exchange
    ? buildVerifiedQuoteStorageKey(symbol, options.exchange)
    : normalizeSymbolKey(symbol);
  if (!lookupKey) return null;
  const map = await getLastVerifiedQuotes([lookupKey], options);
  const bareKey = lookupKey.includes(':') ? lookupKey.split(':')[1] : lookupKey;
  return map.get(lookupKey) ?? (options?.exchange ? null : map.get(bareKey) ?? null);
}

export function __clearLastVerifiedQuotesForTests() {
  memoryVerifiedStore.clear();
}
