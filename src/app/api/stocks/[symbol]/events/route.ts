import { NextResponse } from 'next/server';
import { getStockBySymbolLive } from '@/lib/data/stocks';
import {
  buildUpcomingEventsReport,
  resolveEquityYahooTicker,
  type YahooCalendarEventsPayload,
} from '@/lib/market/upcomingEvents';

export const dynamic = 'force-dynamic';

const NON_EQUITY_EXCHANGES = new Set(['INDEX', 'COMMODITY', 'FOREX', 'CRYPTO']);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol } = await params;
    const upperSymbol = symbol.trim().toUpperCase();
    const stock = await getStockBySymbolLive(upperSymbol);
    const exchange = stock?.exchange?.toUpperCase() || null;

    if (stock?.isIndex || (exchange && NON_EQUITY_EXCHANGES.has(exchange))) {
      const report = buildUpcomingEventsReport({
        symbol: upperSymbol,
        notice: 'Bu varlık türü için şirket bilanço veya temettü takvimi uygulanmaz.',
      });
      return NextResponse.json({ success: true, ...report });
    }

    const yahooTicker = resolveEquityYahooTicker(upperSymbol, exchange);
    let yahooCalendar: YahooCalendarEventsPayload | null = null;
    let providerFailed = false;

    try {
      const res = await fetch(
        `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(yahooTicker)}?modules=calendarEvents`,
        {
          headers: {
            Accept: 'application/json',
            'User-Agent': 'Mozilla/5.0 StockMind/1.0',
          },
          signal: AbortSignal.timeout(4500),
          next: { revalidate: 3600 },
        }
      );

      if (res.ok) {
        const json = await res.json();
        yahooCalendar = json?.quoteSummary?.result?.[0]?.calendarEvents ?? null;
      } else {
        providerFailed = true;
      }
    } catch {
      providerFailed = true;
    }

    const report = buildUpcomingEventsReport({
      symbol: upperSymbol,
      yahooCalendar,
      providerFailed,
    });

    return NextResponse.json(
      { success: true, ...report },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=600',
        },
      }
    );
  } catch (error) {
    console.error('Stock Events API Error:', error);
    return NextResponse.json(
      {
        success: false,
        status: 'unavailable',
        events: [],
        error: 'Yaklaşan olay takvimi alınamadı.',
      },
      { status: 500 }
    );
  }
}
