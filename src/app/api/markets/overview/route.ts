import { NextResponse } from 'next/server';
import { fetchAllAlternativeMarkets, fetchSpecificSymbolLive } from '@/lib/data/stocks';

export const revalidate = 30;

export async function GET() {
  try {
    const [altMarkets, bist100] = await Promise.all([
      fetchAllAlternativeMarkets(),
      fetchSpecificSymbolLive('XU100').catch(() => null),
    ]);

    const gramAltin = altMarkets.commodity.find((c) => c.symbol === 'XAUTRYG');
    const usdTry = altMarkets.forex.find((f) => f.symbol === 'USDTRY');
    const eurTry = altMarkets.forex.find((f) => f.symbol === 'EURTRY');
    const btc = altMarkets.crypto.find((c) => c.symbol === 'BTCUSDT');
    const spx = altMarkets.indices.find((i) => i.symbol === 'SPX');
    const brent = altMarkets.commodity.find((c) => c.symbol === 'UKOIL');

    const topIndices = [
      {
        symbol: 'XU100',
        name: 'BIST 100',
        value: bist100?.price || 10540,
        change: bist100?.changePercent || 0,
        currency: 'TRY',
        flag: '🇹🇷',
      },
      {
        symbol: 'GA',
        name: 'Gram Altın',
        value: gramAltin?.price || 6645,
        change: gramAltin?.changePercent || 0,
        currency: 'TRY',
        flag: '🪙',
      },
      {
        symbol: 'USDTRY',
        name: 'Dolar / TL',
        value: usdTry?.price || 49.25,
        change: usdTry?.changePercent || 0,
        currency: 'TRY',
        flag: '💵',
      },
      {
        symbol: 'EURTRY',
        name: 'Euro / TL',
        value: eurTry?.price || 55.15,
        change: eurTry?.changePercent || 0,
        currency: 'TRY',
        flag: '💶',
      },
      {
        symbol: 'BTC',
        name: 'Bitcoin',
        value: btc?.price || 83000,
        change: btc?.changePercent || 0,
        currency: 'USD',
        flag: '₿',
      },
      {
        symbol: 'SPX',
        name: 'S&P 500',
        value: spx?.price || 5820,
        change: spx?.changePercent || 0,
        currency: 'USD',
        flag: '🇺🇸',
      },
      {
        symbol: 'BRENT',
        name: 'Brent Petrol',
        value: brent?.price || 92,
        change: brent?.changePercent || 0,
        currency: 'USD',
        flag: '🛢️',
      },
    ];

    return NextResponse.json(
      {
        success: true,
        data: topIndices,
        sections: {
          commodity: altMarkets.commodity.slice(0, 5),
          forex: altMarkets.forex.slice(0, 5),
          crypto: altMarkets.crypto.slice(0, 5),
          indices: altMarkets.indices.slice(0, 5),
        },
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=15',
        },
      }
    );
  } catch (error) {
    console.error('Market Overview API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Piyasa özeti alınamadı' },
      { status: 500 }
    );
  }
}
