import { NextResponse } from 'next/server';
import { getStockBySymbolLive } from '@/lib/data/stocks';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol } = await params;
    const stock = await getStockBySymbolLive(symbol);

    if (!stock) {
      return NextResponse.json(
        { success: false, error: 'Hisse bulunamadı' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: stock,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=15',
        },
      }
    );
  } catch (error) {
    console.error('Stock Detail API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Hisse detayı alınamadı' },
      { status: 500 }
    );
  }
}
