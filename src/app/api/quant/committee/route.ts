import { NextResponse } from 'next/server';
import { runInvestmentCommittee } from '@/lib/ai/investment-committee';
import { getStockBySymbolLive } from '@/lib/data/stocks';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { symbol, apiKey, quote } = body;

    if (!symbol || typeof symbol !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Hisse veya Fon sembolü zorunludur' },
        { status: 400 }
      );
    }

    const cleanSymbol = symbol.trim().toUpperCase();
    const liveQuote = quote || (await getStockBySymbolLive(cleanSymbol).catch(() => null));
    const effectiveApiKey = apiKey?.trim() || process.env.OPENROUTER_API_KEY?.trim();
    const report = await runInvestmentCommittee(cleanSymbol, liveQuote, effectiveApiKey);

    return NextResponse.json({
      success: true,
      report,
    });
  } catch (error: any) {
    console.error('Quant Committee API Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Komite simülasyonu çalıştırılırken bir hata oluştu',
      },
      { status: 500 }
    );
  }
}
