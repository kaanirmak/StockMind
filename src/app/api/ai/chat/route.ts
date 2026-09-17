import { NextResponse } from 'next/server';
import { callOpenRouter, OpenRouterMessage } from '@/lib/ai/openrouter';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { messages, model, apiKey, context } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { success: false, error: 'Mesaj listesi zorunludur' },
        { status: 400 }
      );
    }

    const aiResponse = await callOpenRouter(messages as OpenRouterMessage[], {
      model,
      apiKey,
      context,
    });

    return NextResponse.json({
      success: true,
      message: {
        role: 'assistant',
        content: aiResponse,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('AI Chat API Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'AI yanıtı alınamadı' },
      { status: 500 }
    );
  }
}
