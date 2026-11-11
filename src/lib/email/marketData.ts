import { fetchSpecificSymbolLive } from '@/lib/data/stocks';

export async function getBulletinMarketData() {
  const symbols = {
    gold: 'XAUUSD',
    usdtry: 'USDTRY',
    btc: 'BTCUSD',
    thyao: 'THYAO',
    bist100: 'XU100',
  };
  const quotes = await Promise.all(Object.entries(symbols).map(async ([key, symbol]) => {
    const quote = await fetchSpecificSymbolLive(symbol).catch(() => null);
    return [key, quote?.price] as const;
  }));
  return Object.fromEntries(quotes);
}
