import { NextResponse } from 'next/server';
import { getAllStocksLive } from '@/lib/data/stocks';
import { parseSymbolListParam } from '@/lib/market/symbolQuery';
import {
  paginateRecords,
  parsePaginationParams,
  sortStockRecords,
  type MarketSortDirection,
  type StockSortField,
} from '@/lib/market/pagination';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const exchange = searchParams.get('exchange') || undefined;
    const sector = searchParams.get('sector') || undefined;
    const search = searchParams.get('search') || undefined;
    const symbolsParam = searchParams.get('symbols');
    const symbols = symbolsParam ? parseSymbolListParam(symbolsParam) : undefined;
    const sortBy = (searchParams.get('sortBy') as StockSortField | null) || undefined;
    const order: MarketSortDirection = searchParams.get('order') === 'asc' ? 'asc' : 'desc';
    const { page, limit } = parsePaginationParams(searchParams);

    const rawStocks = await getAllStocksLive({
      exchange,
      sector,
      search,
      liveOnly: searchParams.get('liveOnly') === 'true',
      symbols: symbols && symbols.length > 0 ? symbols : undefined,
    });

    const sortedStocks = sortBy ? sortStockRecords(rawStocks, sortBy, order) : rawStocks;
    const paginated = paginateRecords(sortedStocks, page, limit);

    return NextResponse.json(
      {
        success: true,
        count: paginated.items.length,
        total: paginated.total,
        page: paginated.page,
        limit: paginated.limit,
        totalPages: paginated.totalPages,
        hasMore: paginated.hasMore,
        data: paginated.items,
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
