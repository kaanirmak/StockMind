import { NextResponse } from 'next/server';
import { fetchRealHistoricalCandles, getStockBySymbolLive } from '@/lib/data/stocks';
export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol } = await params;
    const { searchParams } = new URL(request.url);
    const timeframe = (searchParams.get('timeframe') || '1M') as
      | '1D'
      | '1W'
      | '1M'
      | '3M'
      | '6M'
      | '1Y'
      | '5Y'
      | 'ALL';

    const stock = await getStockBySymbolLive(symbol);
    const candles = await fetchRealHistoricalCandles(symbol, timeframe, stock?.price);

    if (candles.length === 0) {
      return NextResponse.json(
        {
          success: false,
          symbol: symbol.toUpperCase(),
          timeframe,
          count: 0,
          data: [],
          error: 'Tarihsel fiyat verisi sağlayıcıda bulunamadı.',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      symbol: symbol.toUpperCase(),
      timeframe,
      count: candles.length,
      data: candles,
    });
  } catch (error) {
    console.error('Stock History API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Tarihsel veriler alınamadı' },
      { status: 500 }
    );
  }
}
