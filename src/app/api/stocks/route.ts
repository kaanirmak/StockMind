import { NextResponse } from 'next/server';
import { getAllStocksLive } from '@/lib/data/stocks';

// Revalidate CDN cache every 60 seconds
export const revalidate = 60;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const exchange = searchParams.get('exchange') || undefined;
    const sector = searchParams.get('sector') || undefined;
    const search = searchParams.get('search') || undefined;

    const stocks = await getAllStocksLive({ exchange, sector, search });

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
