import { NextResponse } from 'next/server';
import { AVAILABLE_MODELS, callOpenRouter, type OpenRouterMessage } from '@/lib/ai/openrouter';
import { buildLiveAIContext, type PortfolioContextPayload } from '@/lib/ai/market-context';
import { ApiError, apiErrorResponse, authorizeAction, isRecord, optionalText, readJsonObject } from '@/lib/api/security';

function parsePortfolio(value: unknown): PortfolioContextPayload | undefined {
  if (value === undefined || value === null) return undefined;
  if (!isRecord(value)) throw new ApiError(400, 'Geçersiz portföy bilgisi.');
  const result: PortfolioContextPayload = {};
  const numericFields = ['totalValue', 'totalCost', 'totalProfitLoss', 'totalProfitLossPercent', 'dailyProfitLoss', 'dailyProfitLossPercent'] as const;
  for (const field of numericFields) {
    if (value[field] !== undefined) {
      if (typeof value[field] !== 'number' || !Number.isFinite(value[field])) throw new ApiError(400, 'Geçersiz portföy tutarı.');
      result[field] = value[field];
    }
  }
  if (value.holdings !== undefined) {
    if (!Array.isArray(value.holdings) || value.holdings.length > 100) throw new ApiError(400, 'En fazla 100 varlık gönderilebilir.');
    result.holdings = value.holdings.map((holding) => {
      if (!isRecord(holding) || typeof holding.symbol !== 'string' || !/^[A-Za-z0-9_.:=^/-]{1,40}$/.test(holding.symbol)) {
        throw new ApiError(400, 'Geçersiz varlık.');
      }
      const numbers: Record<string, number> = {};
      for (const field of ['shares', 'averageCost', 'currentPrice', 'totalValue', 'profitLoss', 'profitLossPercent', 'weight']) {
        const amount = holding[field];
        if (amount !== undefined && (typeof amount !== 'number' || !Number.isFinite(amount))) throw new ApiError(400, 'Geçersiz varlık tutarı.');
        if (typeof amount === 'number') numbers[field] = amount;
      }
      for (const field of ['shares', 'averageCost', 'currentPrice', 'totalValue']) {
        if (numbers[field] === undefined || numbers[field] < 0) throw new ApiError(400, 'Eksik veya negatif varlık tutarı.');
      }
      return {
        symbol: holding.symbol,
        name: optionalText(holding.name, 160),
        assetType: optionalText(holding.assetType, 20),
        shares: numbers.shares, averageCost: numbers.averageCost,
        currentPrice: numbers.currentPrice, totalValue: numbers.totalValue,
        profitLoss: numbers.profitLoss, profitLossPercent: numbers.profitLossPercent, weight: numbers.weight,
      };
    });
  }
  return result;
}

export async function POST(request: Request) {
  try {
    const access = await authorizeAction(request, 'ai_chat');
    if (access.response) return access.response;
    const body = await readJsonObject(request);
    if (!Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > 40) {
      throw new ApiError(400, '1–40 mesaj gönderilmelidir.');
    }
    const messages: OpenRouterMessage[] = body.messages.map((message) => {
      if (!isRecord(message) || (message.role !== 'user' && message.role !== 'assistant') ||
          typeof message.content !== 'string' || !message.content.trim() || message.content.length > 8000) {
        throw new ApiError(400, 'Geçersiz mesaj rolü veya içeriği.');
      }
      return { role: message.role, content: message.content };
    });
    if (messages.reduce((sum, message) => sum + message.content.length, 0) > 32000 || messages.at(-1)?.role !== 'user') {
      throw new ApiError(400, 'Mesajlar çok uzun veya son mesaj kullanıcıya ait değil.');
    }
    const model = optionalText(body.model, 120) || 'openrouter/free';
    if (!AVAILABLE_MODELS.some((entry) => entry.id === model)) throw new ApiError(400, 'Desteklenmeyen model.');
    const apiKey = optionalText(body.apiKey, 512);
    if (!apiKey && !process.env.OPENROUTER_API_KEY?.trim()) throw new ApiError(401, 'AI anahtarı tanımlanmalıdır.');
    const effectivePortfolio = body.portfolioContext ?? (isRecord(body.context) ? body.context.portfolio : undefined);
    const portfolio = parsePortfolio(effectivePortfolio);
    let liveContext = '';
    try {
      liveContext = await buildLiveAIContext(messages.at(-1)!.content, portfolio);
    } catch {
      liveContext = 'Piyasa verisi alınamadı. Güncel fiyat veya teknik gösterge varmış gibi yorum yapma.';
    }
    if (portfolio) liveContext += '\nPortföy bilgileri kullanıcı tarafından gönderilmiştir; doğrulanmış hesap kaydı değildir.';
    const content = await callOpenRouter(messages, { model, apiKey, injectedContext: liveContext });
    const hasLiveContext = !liveContext.startsWith('Piyasa verisi alınamadı') && Boolean(liveContext);
    const sourceScope = hasLiveContext ? 'live_market_data' : 'unverified_general_knowledge';
    const asOf = new Date().toISOString();
    return NextResponse.json({
      success: true,
      message: {
        role: 'assistant',
        content,
        createdAt: asOf,
        sourceScope,
        asOf,
      },
      hasLiveContext,
      sourceScope,
      asOf,
      disclaimer: 'StockMind AI yatırım tavsiyesi vermez. Piyasa verileri ve analizler bilgilendirme amaçlıdır.',
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
