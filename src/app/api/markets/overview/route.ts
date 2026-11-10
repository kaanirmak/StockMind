import { NextResponse } from 'next/server';
import { fetchAllAlternativeMarkets } from '@/lib/data/stocks';
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
    const markets = await fetchAllAlternativeMarkets();
    const verified = {
      commodity: verifiedQuotes(markets.commodity),
      forex: verifiedQuotes(markets.forex),
      crypto: verifiedQuotes(markets.crypto),
      indices: verifiedQuotes(markets.indices),
    };

    const data = cards.map(({ group, ticker, ...card }): MarketOverviewItem => {
      const quote = verified[group].find(item => item.symbol === ticker);
      return {
        ...card,
        value: quote?.price ?? null,
        change: quote?.observation?.changePercent ?? null,
        observation: quote?.observation ?? null,
        status: quote ? 'available' : 'unavailable',
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
