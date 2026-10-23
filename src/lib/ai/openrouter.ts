import { briefChatInstructions, getAIRuntimePolicy } from './runtimePolicy';

export class OpenRouterError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

// OpenRouter AI Integration

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenRouterChatOptions {
  model?: string;
  temperature?: number;
  apiKey?: string;
  injectedContext?: string;
  signal?: AbortSignal;
  concise?: boolean;
  context?: {
    symbol?: string;
    stockData?: any;
    portfolioData?: any;
  };
}

const DEFAULT_MODEL = 'openrouter/free';



export const FINANCIAL_SYSTEM_PROMPT = `Sen StockMind platformunun yapay zeka destekli kıdemli finansal analisti ve portföy danışmanısın.
Görevlerin:
1. Kullanıcının sorduğu BIST hisseleri, TEFAS fonları, ABD hisseleri (NASDAQ/NYSE), döviz ve emtialar hakkında teknik ve temel analiz sunmak.
2. RSI, MACD, Hareketli Ortalamalar (SMA 20, 50, 200), Bollinger Bantları gibi teknik göstergeleri yorumlamak.
3. Kullanıcının portföy çeşitlendirmesi, risk yönetimi ve ağırlıklı maliyet düşürme stratejilerine profesyonel tavsiyeler vermek.
4. Yanıtlarını düzenli, anlaşılır, madde işaretleri, kalın başlıklar ve gerektiğinde markdown tabloları ile formatlamak.
5. Her zaman Türkçe, profesyonel, güven veren ve tarafsız bir finansal dil kullanmak.
6. Yanıtının sonunda kısa bir "Yatırım Tavsiyesi Değildir (YTD)" uyarısı eklemek.`;


export const FALLBACK_FREE_MODELS = [
  'openrouter/free',
  'recursive/flint-v1.0:free',
  'nvidia/nemotron-3-ultra-550b-a55b:free',
  'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
];

export async function callOpenRouter(
  messages: OpenRouterMessage[],
  options?: OpenRouterChatOptions
): Promise<string> {
  const cleanApiKey = (options?.apiKey || '').trim();
  const apiKey = cleanApiKey || process.env.OPENROUTER_API_KEY?.trim();
  const requestedModel = options?.model || DEFAULT_MODEL;
  const policy = getAIRuntimePolicy();

  if (!apiKey) {
    // Key olmadığında dummy cevap vermek yerine açıkça API_KEY_REQUIRED fırlatıyoruz
    throw new OpenRouterError(401, 'AI_KEY_REQUIRED', 'AI anahtarı tanımlı değil.');
  }

  let effectiveSystemPrompt = options?.injectedContext
    ? `${FINANCIAL_SYSTEM_PROMPT}\n\n${options.injectedContext}`
    : FINANCIAL_SYSTEM_PROMPT;
  if (options?.concise ?? policy.briefByDefault) effectiveSystemPrompt += `\n\n${briefChatInstructions(policy.briefWordTarget)}`;

  const modelsToTry = [requestedModel];
  for (const fb of FALLBACK_FREE_MODELS) {
    if (!modelsToTry.includes(fb)) modelsToTry.push(fb);
  }

  let lastError: unknown = null;

  for (let i = 0; i < modelsToTry.length; i++) {
    const currentModel = modelsToTry[i];
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        signal: options?.signal
          ? AbortSignal.any([options.signal, AbortSignal.timeout(policy.timeoutMs)])
          : AbortSignal.timeout(policy.timeoutMs),
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://stockmind.app',
          'X-Title': 'StockMind Investment Platform',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: currentModel,
          messages: [
            { role: 'system', content: effectiveSystemPrompt },
            ...messages,
          ],
          temperature: options?.temperature ?? 0.7,
          max_tokens: policy.chatMaxTokens,
        }),
      });

      return await readOpenRouterResponse(res);
    } catch (error: any) {
      if (options?.signal?.aborted) throw new OpenRouterError(499, 'AI_CANCELLED', 'AI isteği iptal edildi.');
      lastError = error;
      if (error instanceof OpenRouterError && (error.code === 'AI_PROVIDER_UNAUTHORIZED' || error.code === 'AI_KEY_REQUIRED')) {
        throw error;
      }
      if (i < modelsToTry.length - 1) {
        console.warn(`Model ${currentModel} failed (${error?.message || error}), trying fallback ${modelsToTry[i + 1]}...`);
        continue;
      }
    }
  }

  console.error('OpenRouter call failed');
  if (lastError instanceof OpenRouterError) throw lastError;
  if (lastError && typeof lastError === 'object' && ('name' in lastError) && (lastError.name === 'TimeoutError' || lastError.name === 'AbortError')) {
    throw new OpenRouterError(504, 'AI_TIMEOUT', 'AI isteği zaman aşımına uğradı.');
  }
  throw new OpenRouterError(503, 'AI_PROVIDER_UNAVAILABLE', 'AI sağlayıcısına ulaşılamadı. Lütfen tekrar deneyin.');
}

/** OpenRouter may return an error body even with HTTP 200. Never treat it as an answer. */
export async function readOpenRouterResponse(response: Response): Promise<string> {
  let data;
  try {
    data = await response.json();
  } catch (error) {
    if (error && typeof error === 'object' && 'name' in error && (error.name === 'AbortError' || error.name === 'TimeoutError')) throw error;
    if (response.ok) throw new OpenRouterError(502, 'AI_INVALID_RESPONSE', 'AI servisinden geçerli yanıt alınamadı.');
  }
  if (!response.ok || data?.error) {
    const code = response.ok ? Number(data.error.code) : response.status;
    if (code === 401) throw new OpenRouterError(401, 'AI_PROVIDER_UNAUTHORIZED', 'OpenRouter anahtarı reddedildi.');
    if (code === 403) throw new OpenRouterError(403, 'AI_PROVIDER_FORBIDDEN', 'Sağlayıcı bu isteğe izin vermiyor. Model veya gizlilik ayarlarınızı kontrol edin.');
    if (code === 402) throw new OpenRouterError(402, 'AI_CREDITS_REQUIRED', 'OpenRouter kredisi yetersiz.');
    if (code === 429) throw new OpenRouterError(429, 'AI_RATE_LIMITED', 'AI servisinin istek sınırına ulaşıldı.');
    if (code === 408 || code === 504) throw new OpenRouterError(504, 'AI_TIMEOUT', 'AI isteği zaman aşımına uğradı.');
    throw new OpenRouterError(503, 'AI_PROVIDER_UNAVAILABLE', 'AI sağlayıcısı şu anda yanıt veremiyor.');
  }
  let content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    if (typeof data?.choices?.[0]?.text === 'string' && data.choices[0].text.trim()) {
      content = data.choices[0].text.trim();
    }
  }
  if (typeof content !== 'string' || !content.trim()) {
    const reasoning = data?.choices?.[0]?.message?.reasoning;
    if (typeof reasoning === 'string' && reasoning.trim()) {
      const trimmed = reasoning.trim();
      const jsonStart = trimmed.lastIndexOf('{');
      if (jsonStart !== -1) {
        const potentialJson = trimmed.slice(jsonStart);
        try {
          JSON.parse(potentialJson);
          content = potentialJson;
        } catch (_) {}
      }
    }
  }
  if (typeof content !== 'string' || !content.trim()) {
    throw new OpenRouterError(502, 'AI_INVALID_RESPONSE', 'Model boş yanıt verdi. Başka bir model seçin veya tekrar deneyin.');
  }
  if (content.trim().startsWith('User Safety:')) {
    throw new OpenRouterError(502, 'AI_INVALID_RESPONSE', 'Model bir sohbet yanıtı yerine güvenlik sınıflandırması döndürdü.');
  }
  return content.trim();
}
