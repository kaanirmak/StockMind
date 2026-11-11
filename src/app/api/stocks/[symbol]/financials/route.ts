import { NextResponse } from 'next/server';
import { getStockBySymbolLive } from '@/lib/data/stocks';
import {
  buildFinancialStatementsReport,
  type YahooFinancialStatementsPayload,
} from '@/lib/market/financialStatements';
import { resolveEquityYahooTicker } from '@/lib/market/upcomingEvents';

export const dynamic = 'force-dynamic';

const NON_EQUITY_EXCHANGES = new Set(['INDEX', 'COMMODITY', 'FOREX', 'CRYPTO']);

const STATEMENT_MODULES = [
  'incomeStatementHistory',
  'incomeStatementHistoryQuarterly',
  'balanceSheetHistory',
  'balanceSheetHistoryQuarterly',
  'cashflowStatementHistory',
  'cashflowStatementHistoryQuarterly',
  'financialData',
  'price',
].join(',');

async function fetchYahooFinancialStatements(yahooTicker: string): Promise<{
  payload: YahooFinancialStatementsPayload | null;
  failed: boolean;
}> {
  const hosts = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];
  for (const host of hosts) {
    try {
      const res = await fetch(
        `https://${host}/v10/finance/quoteSummary/${encodeURIComponent(yahooTicker)}?modules=${STATEMENT_MODULES}`,
        {
          headers: {
            Accept: 'application/json',
            'User-Agent': 'Mozilla/5.0 StockMind/1.0',
          },
          signal: AbortSignal.timeout(6000),
          next: { revalidate: 3600 },
        }
      );

      if (!res.ok) continue;
      const json = await res.json();
      const result = json?.quoteSummary?.result?.[0];
      if (!result || typeof result !== 'object') {
        return { payload: null, failed: false };
      }

      const payload: YahooFinancialStatementsPayload = {
        financialCurrency:
          typeof result?.financialData?.financialCurrency === 'string'
            ? result.financialData.financialCurrency
            : null,
        priceCurrency:
          typeof result?.price?.currency === 'string' ? result.price.currency : null,
        incomeStatementHistory: result.incomeStatementHistory,
        incomeStatementHistoryQuarterly: result.incomeStatementHistoryQuarterly,
        balanceSheetHistory: result.balanceSheetHistory,
        balanceSheetHistoryQuarterly: result.balanceSheetHistoryQuarterly,
        cashflowStatementHistory: result.cashflowStatementHistory,
        cashflowStatementHistoryQuarterly: result.cashflowStatementHistoryQuarterly,
      };
      return { payload, failed: false };
    } catch {
      // Retry next Yahoo host
    }
  }

  return { payload: null, failed: true };
}

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
      const report = buildFinancialStatementsReport({
        symbol: upperSymbol,
        exchange,
        notice: 'Bu varlık türü için şirket bilanço ve gelir tablosu sunulmaz.',
      });
      return NextResponse.json({ success: true, ...report });
    }

    const yahooTicker = resolveEquityYahooTicker(upperSymbol, exchange);
    const { payload, failed } = await fetchYahooFinancialStatements(yahooTicker);

    const report = buildFinancialStatementsReport({
      symbol: upperSymbol,
      exchange,
      payload,
      providerFailed: failed,
    });

    return NextResponse.json(
      { success: true, ...report },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=900',
        },
      }
    );
  } catch (error) {
    console.error('Stock Financials API Error:', error);
    return NextResponse.json(
      {
        success: false,
        status: 'unavailable',
        error: 'Finansal tablolar şu anda alınamadı.',
      },
      { status: 500 }
    );
  }
}
