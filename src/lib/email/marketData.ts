import { fetchSpecificSymbolLive } from '@/lib/data/stocks';

export type BulletinMarketKey = 'bist100' | 'thyao' | 'usdtry' | 'gold' | 'btc' | 'gramAltin';

export interface BulletinObservationMeta {
  observedAt: string | null;
  source: string | null;
}

export interface BulletinMarketDataPayload {
  gold?: number;
  goldChange?: number;
  gramAltin?: number;
  usdtry?: number;
  btc?: number;
  brent?: number;
  bist100?: number;
  thyao?: number;
  observedAt?: string | null;
  fetchedAt?: string;
  observations?: Partial<Record<BulletinMarketKey, BulletinObservationMeta>>;
  missingFields?: string[];
}

const BULLETIN_TRACKED_SYMBOLS: ReadonlyArray<{
  key: Exclude<BulletinMarketKey, 'gramAltin'>;
  symbol: string;
  label: string;
}> = [
  { key: 'bist100', symbol: 'XU100', label: 'BIST 100 (XU100)' },
  { key: 'thyao', symbol: 'THYAO', label: 'Türk Hava Yolları (THYAO)' },
  { key: 'usdtry', symbol: 'USDTRY', label: 'Dolar / TL (USD/TRY)' },
  { key: 'gold', symbol: 'XAUUSD', label: 'Ons Altın (XAU/USD)' },
  { key: 'btc', symbol: 'BTCUSD', label: 'Bitcoin (BTC/USD)' },
];

export async function getBulletinMarketData(): Promise<BulletinMarketDataPayload> {
  const fetchedAt = new Date().toISOString();
  const payload: BulletinMarketDataPayload = {
    fetchedAt,
    observedAt: null,
    observations: {},
    missingFields: [],
  };

  let latestObservedMs = 0;

  await Promise.all(
    BULLETIN_TRACKED_SYMBOLS.map(async ({ key, symbol, label }) => {
      const quote = await fetchSpecificSymbolLive(symbol).catch(() => null);
      const validPrice =
        quote && typeof quote.price === 'number' && Number.isFinite(quote.price) && quote.price > 0
          ? quote.price
          : undefined;

      const obsTime = quote?.observation?.asOf ?? quote?.observation?.fetchedAt ?? null;
      const obsSource = quote?.observation?.source ?? null;

      payload.observations![key] = {
        observedAt: obsTime,
        source: obsSource,
      };

      if (validPrice !== undefined) {
        payload[key] = validPrice;
        if (obsTime) {
          const parsedMs = Date.parse(obsTime);
          if (Number.isFinite(parsedMs) && parsedMs > latestObservedMs) {
            latestObservedMs = parsedMs;
          }
        }
      } else {
        payload.missingFields!.push(label);
      }
    })
  );

  // Derived gram gold also carries explicit conservative observation time or missing disclosure
  if (payload.gold !== undefined && payload.usdtry !== undefined) {
    const goldTime = payload.observations?.gold?.observedAt ?? null;
    const usdTime = payload.observations?.usdtry?.observedAt ?? null;
    const goldMs = goldTime ? Date.parse(goldTime) : NaN;
    const usdMs = usdTime ? Date.parse(usdTime) : NaN;
    const olderIso =
      Number.isFinite(goldMs) && Number.isFinite(usdMs)
        ? goldMs <= usdMs
          ? goldTime
          : usdTime
        : goldTime || usdTime || null;
    payload.observations!.gramAltin = {
      observedAt: olderIso,
      source: 'XAUUSD + USDTRY',
    };
  } else {
    payload.missingFields!.push('Gram Altın (hesaplanan)');
  }

  payload.observedAt = latestObservedMs > 0 ? new Date(latestObservedMs).toISOString() : null;
  return payload;
}
