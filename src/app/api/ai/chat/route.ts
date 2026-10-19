import { AUTO_MODEL, getModelCatalog, hasProAccess } from '@/lib/ai/modelCatalog';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { callOpenRouter, OpenRouterError, type OpenRouterMessage } from '@/lib/ai/openrouter';
import { buildLiveAIContext, type PortfolioContextPayload } from '@/lib/ai/market-context';
import { ApiError, apiErrorResponse, authorizeAction, isRecord, optionalText, readJsonObject } from '@/lib/api/security';
import {
  getHourlyChatQuota,
  checkAndConsumeHourlyChatQuota,
  refundHourlyChatQuota,
  type HourlyQuotaStatus,
} from '@/lib/ai/hourlyQuota';

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
  const quotaRequestId = crypto.randomUUID();
  let quotaConsumed = false;
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
    const entry = model === AUTO_MODEL.id ? AUTO_MODEL : (await getModelCatalog()).find(entry => entry.id === model);
    if (!entry) throw new ApiError(400, 'Model artık listede bulunmuyor. Başka bir model seçin.');
    const isPro = hasProAccess(access.user.app_metadata);
    if (!entry.free && !isPro) throw new ApiError(403, 'Bu model yalnızca Pro hesaplara açıktır.', 'PRO_REQUIRED');
    const apiKey = optionalText(body.apiKey, 512);
    if (!apiKey && !process.env.OPENROUTER_API_KEY?.trim()) throw new ApiError(401, 'AI anahtarı tanımlanmalıdır.', 'AI_KEY_REQUIRED');

    // Enforce hourly question quota (20/hour for Pro, 5/hour for Standard) when using platform AI
    let quotaStatus: HourlyQuotaStatus | undefined = undefined;
    if (!apiKey) {
      quotaStatus = await checkAndConsumeHourlyChatQuota(quotaRequestId);
      if (!quotaStatus.allowed) {
        return NextResponse.json(
          {
            success: false,
            code: 'HOURLY_QUOTA_EXCEEDED',
            error: isPro
              ? `Pro soru kotanıza ulaştınız (${quotaStatus.limit} soru). Kota yenilendiğinde tekrar deneyin.`
              : `Ücretsiz soru kotanıza ulaştınız (${quotaStatus.limit} soru). Kota yenilendiğinde tekrar deneyin veya Pro hesaba yükseltin.`,
            quota: quotaStatus,
          },
          {
            status: 429,
            headers: {
              'Retry-After': String(quotaStatus.retryAfter),
              'X-RateLimit-Limit': String(quotaStatus.limit),
              'X-RateLimit-Remaining': String(quotaStatus.remaining),
            },
          }
        );
      }
      quotaConsumed = true;
    }

    const effectivePortfolio = body.portfolioContext ?? (isRecord(body.context) ? body.context.portfolio : undefined);
    const portfolio = parsePortfolio(effectivePortfolio);
    let liveContext = '';
    try {
      liveContext = await buildLiveAIContext(messages.at(-1)!.content, portfolio);
    } catch {
      liveContext = 'Piyasa verisi alınamadı. Güncel fiyat veya teknik gösterge varmış gibi yorum yapma.';
    }
    if (portfolio) liveContext += '\nPortföy bilgileri kullanıcı tarafından gönderilmiştir; doğrulanmış hesap kaydı değildir.';

    // Ensure messages sent to OpenRouter start with user role (strip leading assistant greetings if any)
    let providerMessages = [...messages];
    while (providerMessages.length > 0 && providerMessages[0].role !== 'user') {
      providerMessages.shift();
    }
    if (providerMessages.length === 0) {
      providerMessages = messages;
    }

    if (request.signal.aborted) throw new OpenRouterError(499, 'AI_CANCELLED', 'AI isteği iptal edildi.');
    const content = await callOpenRouter(providerMessages, { model, apiKey, injectedContext: liveContext, signal: request.signal });
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
      quota: quotaStatus
        ? {
            limit: quotaStatus.limit,
            remaining: quotaStatus.remaining,
            used: quotaStatus.used,
            isPro,
          }
        : undefined,
      disclaimer: 'StockMind AI yatırım tavsiyesi vermez. Piyasa verileri ve analizler bilgilendirme amaçlıdır.',
    });
  } catch (error) {
    let refundedQuota: HourlyQuotaStatus | undefined;
    if (quotaConsumed) {
      try {
        refundedQuota = await refundHourlyChatQuota(quotaRequestId);
      } catch { console.warn('AI quota refund failed.'); }
    }
    if (error instanceof OpenRouterError) return NextResponse.json({ success: false, code: error.code, error: error.message, quota: refundedQuota }, { status: error.status });
    return apiErrorResponse(error);
  }
}

// Session-only readiness check: no provider call, portfolio payload or quota consumption.
export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return NextResponse.json({ success: false, code: 'AUTH_REQUIRED', error: 'Oturumunuz doğrulanamadı. Tekrar giriş yapın.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
    const isPro = hasProAccess(data.user.app_metadata);
    const quota = await getHourlyChatQuota();
    return NextResponse.json({
      success: true,
      serverKeyConfigured: Boolean(process.env.OPENROUTER_API_KEY?.trim()),
      quota: {
        limit: quota.limit,
        remaining: quota.remaining,
        used: quota.used,
        resetInSeconds: quota.retryAfter,
        isPro,
      },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ success: false, error: 'AI bağlantı durumu kontrol edilemedi.' }, { status: 503 }); }
}
