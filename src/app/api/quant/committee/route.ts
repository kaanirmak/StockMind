import { NextResponse } from 'next/server';
import { runInvestmentCommittee } from '@/lib/ai/investment-committee';
import { getStockBySymbolLive } from '@/lib/data/stocks';
import { hasProAccess } from '@/lib/ai/modelCatalog';
import { ApiError, apiErrorResponse, authorizeAction, optionalText, readJsonObject } from '@/lib/api/security';

export async function POST(request: Request) {
  try {
    const access = await authorizeAction(request, 'ai_committee');
    if (access.response) return access.response;
    if (!hasProAccess(access.user.app_metadata)) {
      throw new ApiError(403, 'Yatırım Komitesi analizi yalnızca StockMind Pro hesaplara açıktır.', 'PRO_REQUIRED');
    }
    const body = await readJsonObject(request, 8 * 1024);
    const symbol = optionalText(body.symbol, 40)?.toUpperCase();
    if (!symbol || !/^[A-Z0-9_.:=^/-]+$/.test(symbol)) throw new ApiError(400, 'Geçerli bir sembol zorunludur.');
    const apiKey = optionalText(body.apiKey, 512) || process.env.OPENROUTER_API_KEY?.trim();
    if (!apiKey) throw new ApiError(401, 'AI anahtarı tanımlanmalıdır.');
    // Never trust a caller-supplied quote for the committee's market context.
    const liveQuote = await getStockBySymbolLive(symbol);
    if (!liveQuote || !Number.isFinite(liveQuote.price) || liveQuote.price <= 0) throw new ApiError(503, 'Bu varlık için piyasa verisi alınamadı.');
    const report = await runInvestmentCommittee(symbol, liveQuote, apiKey);
    return NextResponse.json({ success: true, report });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
