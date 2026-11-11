import { NextResponse } from 'next/server';
import { fetchAllAlternativeMarkets } from '@/lib/data/stocks';
import { getLastVerifiedQuotes, recordVerifiedQuotes } from '@/lib/market/lastVerifiedStore';
import type { MarketOverviewItem, StockMarketInfo } from '@/types/stock';

export const dynamic = 'force-dynamic';

const cards = [
  { symbol: 'XU100', name: 'BIST 100', currency: 'TRY', unit: 'points', flag: '🇹🇷', group: 'indices', ticker: 'XU100' },
  { symbol: 'GA', name: 'Gram Altın', currency: 'TRY', flag: '🪙', group: 'commodity', ticker: 'XAUTRYG' },
  { symbol: 'USDTRY', name: 'Dolar / TL', currency: 'TRY', flag: '💵', group: 'forex', ticker: 'USDTRY' },
  { symbol: 'EURTRY', name: 'Euro / TL', currency: 'TRY', flag: '💶', group: 'forex', ticker: 'EURTRY' },
  { symbol: 'BTC', name: 'Bitcoin', currency: 'USDT', flag: '₿', group: 'crypto', ticker: 'BTCUSDT' },
  { symbol: 'SPX', name: 'S&P 500', currency: 'USD', unit: 'points', flag: '🇺🇸', group: 'indices', ticker: 'SPX' },
  { symbol: 'BRENT', name: 'Brent Petrol', currency: 'USD', flag: '🛢️', group: 'commodity', ticker: 'UKOIL' },
] as const;

function verifiedQuotes(quotes: StockMarketInfo[]) {
  return quotes.filter(quote => quote.observation && Number.isFinite(quote.price) && (quote.price ?? 0) > 0);
}

export async function GET() {
  try {
    const markets = await fetchAllAlternativeMarkets().catch(() => null);
    const verified = {
      commodity: verifiedQuotes(markets?.commodity ?? []),
      forex: verifiedQuotes(markets?.forex ?? []),
      crypto: verifiedQuotes(markets?.crypto ?? []),
      indices: verifiedQuotes(markets?.indices ?? []),
    };

    const allVerified = [...verified.commodity, ...verified.forex, ...verified.crypto, ...verified.indices];
    if (allVerified.length > 0) {
      await recordVerifiedQuotes(allVerified);
    }

    const missingTickers = cards
      .filter(({ group, ticker }) => !verified[group].some(item => item.symbol === ticker))
      .map(card => card.ticker);
    const fallbackQuotes =
      missingTickers.length > 0 ? await getLastVerifiedQuotes(missingTickers) : new Map<string, StockMarketInfo>();

    const data = cards.map(({ group, ticker, ...card }): MarketOverviewItem => {
      const liveQuote = verified[group].find(item => item.symbol === ticker);
      if (liveQuote) {
        return {
          ...card,
          value: liveQuote.price ?? null,
          change: liveQuote.observation?.changePercent ?? null,
          observation: liveQuote.observation ?? null,
          status: 'available',
        };
      }

      const lastKnown = fallbackQuotes.get(ticker);
      if (lastKnown) {
        return {
          ...card,
          value: lastKnown.price ?? null,
          change: lastKnown.observation?.changePercent ?? null,
          observation: lastKnown.observation ?? null,
          status: 'last-known',
        };
      }

      return {
        ...card,
        value: null,
        change: null,
        observation: null,
        status: 'unavailable',
      };
    });

    return NextResponse.json({
      success: true,
      data,
      sections: {
        commodity: verified.commodity.slice(0, 6),
        forex: verified.forex.slice(0, 6),
        crypto: verified.crypto.slice(0, 6),
        indices: verified.indices.slice(0, 6),
      },
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=15' },
    });
  } catch (error) {
    console.error('Market Overview API Error:', error);
    return NextResponse.json({ success: false, error: 'Piyasa özeti alınamadı' }, { status: 503 });
  }
}
