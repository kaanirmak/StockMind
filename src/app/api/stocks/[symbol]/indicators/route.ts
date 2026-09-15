import { NextResponse } from 'next/server';
import { fetchRealHistoricalCandles, getStockTechnicalAnalysis, getStockBySymbolLive } from '@/lib/data/stocks';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol } = await params;
    const { searchParams } = new URL(request.url);
    const timeframe = (searchParams.get('timeframe') || '1Y') as
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
    const analysis = getStockTechnicalAnalysis(symbol, candles);

    return NextResponse.json({
      success: true,
      data: analysis,
    });
  } catch (error) {
    console.error('Stock Indicators API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Teknik göstergeler hesaplanamadı' },
      { status: 500 }
    );
  }
}
