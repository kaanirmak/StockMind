import { NextResponse } from 'next/server';
import { callOpenRouter, OpenRouterMessage } from '@/lib/ai/openrouter';
import { buildLiveAIContext } from '@/lib/ai/market-context';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { messages, model, apiKey, context, portfolioContext } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { success: false, error: 'Mesaj listesi zorunludur' },
        { status: 400 }
      );
    }

    // Find latest user prompt to extract symbols and build tailored market context
    const lastUserMessage =
      [...messages].reverse().find((m: any) => m.role === 'user')?.content || '';

    // Build real-time context from our application (Forex, Commodities, BIST 100, Stocks, User Portfolio)
    const effectivePortfolio = portfolioContext || context?.portfolio;
    let liveContext = '';
    try {
      liveContext = await buildLiveAIContext(lastUserMessage, effectivePortfolio);
    } catch (e) {
      console.warn('Error constructing live market context for AI:', e);
    }

    const aiResponse = await callOpenRouter(messages as OpenRouterMessage[], {
      model,
      apiKey,
      injectedContext: liveContext,
      context,
    });

    return NextResponse.json({
      success: true,
      message: {
        role: 'assistant',
        content: aiResponse,
        createdAt: new Date().toISOString(),
      },
      hasLiveContext: !!liveContext,
    });
  } catch (error: any) {
    console.error('AI Chat API Error:', error);
    const isKeyRequired = error.message === 'API_KEY_REQUIRED';
    return NextResponse.json(
      {
        success: false,
        requiresApiKey: isKeyRequired,
        error: isKeyRequired
          ? 'StockMind AI canlı analiz motorunu kullanabilmek için lütfen bir OpenRouter API anahtarı tanımlayın.'
          : error.message || 'AI yanıtı alınamadı',
      },
      { status: isKeyRequired ? 401 : 500 }
    );
  }
}
