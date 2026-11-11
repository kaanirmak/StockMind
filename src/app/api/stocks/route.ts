import { NextResponse } from 'next/server';
import { getAllStocksLive } from '@/lib/data/stocks';
import { parseSymbolListParam } from '@/lib/market/symbolQuery';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const exchange = searchParams.get('exchange') || undefined;
    const sector = searchParams.get('sector') || undefined;
    const search = searchParams.get('search') || undefined;
    const symbolsParam = searchParams.get('symbols');
    const symbols = symbolsParam ? parseSymbolListParam(symbolsParam) : undefined;

    const stocks = await getAllStocksLive({
      exchange,
      sector,
      search,
      liveOnly: searchParams.get('liveOnly') === 'true',
      symbols: symbols && symbols.length > 0 ? symbols : undefined,
    });

    return NextResponse.json(
      {
        success: true,
        count: stocks.length,
        data: stocks,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
        },
      }
    );
  } catch (error) {
    console.error('Stocks API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Hisse verileri alınamadı' },
      { status: 500 }
    );
  }
}
