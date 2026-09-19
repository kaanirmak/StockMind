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
  context?: {
    symbol?: string;
    stockData?: any;
    portfolioData?: any;
  };
}

const DEFAULT_MODEL = 'openrouter/free';

export const AVAILABLE_MODELS = [
  { id: 'openrouter/free', name: 'OpenRouter Free (Otomatik Ücretsiz Model)', provider: 'OpenRouter' },
  { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3 (Yüksek Akıl & Hız - Önerilen)', provider: 'DeepSeek' },
  { id: 'google/gemini-2.5-flash', name: 'Google Gemini 2.5 Flash (Ultra Hızlı)', provider: 'Google' },
  { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Meta Llama 3.3 70B (Çok Yönlü Analiz)', provider: 'Meta' },
  { id: 'openai/gpt-4o-mini', name: 'OpenAI GPT-4o Mini (Akıllı Finans)', provider: 'OpenAI' },
  { id: 'qwen/qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B (Derin Piyasa Analizi)', provider: 'Alibaba' },
];

export const FINANCIAL_SYSTEM_PROMPT = `Sen StockMind platformunun yapay zeka destekli kıdemli finansal analisti ve portföy danışmanısın.
Görevlerin:
1. Kullanıcının sorduğu BIST hisseleri, TEFAS fonları, ABD hisseleri (NASDAQ/NYSE), döviz ve emtialar hakkında teknik ve temel analiz sunmak.
2. RSI, MACD, Hareketli Ortalamalar (SMA 20, 50, 200), Bollinger Bantları gibi teknik göstergeleri yorumlamak.
3. Kullanıcının portföy çeşitlendirmesi, risk yönetimi ve ağırlıklı maliyet düşürme stratejilerine profesyonel tavsiyeler vermek.
4. Yanıtlarını düzenli, anlaşılır, madde işaretleri, kalın başlıklar ve gerektiğinde markdown tabloları ile formatlamak.
5. Her zaman Türkçe, profesyonel, güven veren ve tarafsız bir finansal dil kullanmak.
6. Yanıtının sonunda kısa bir "Yatırım Tavsiyesi Değildir (YTD)" uyarısı eklemek.`;

export async function callOpenRouter(
  messages: OpenRouterMessage[],
  options?: OpenRouterChatOptions
): Promise<string> {
  const cleanApiKey = (options?.apiKey || '').trim();
  const apiKey = cleanApiKey || process.env.OPENROUTER_API_KEY;
  const model = options?.model || DEFAULT_MODEL;

  if (!apiKey) {
    // Key olmadığında dummy cevap vermek yerine açıkça API_KEY_REQUIRED fırlatıyoruz
    throw new Error('API_KEY_REQUIRED');
  }

  const effectiveSystemPrompt = options?.injectedContext
    ? `${FINANCIAL_SYSTEM_PROMPT}\n\n${options.injectedContext}`
    : FINANCIAL_SYSTEM_PROMPT;

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://stockmind.app',
        'X-Title': 'StockMind Investment Platform',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: effectiveSystemPrompt },
          ...messages,
        ],
        temperature: options?.temperature ?? 0.7,
        max_tokens: 1500,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.warn('OpenRouter API error response:', res.status, errorText);

      let parsedMsg = errorText;
      try {
        const json = JSON.parse(errorText);
        if (json?.error?.message) {
          parsedMsg = json.error.message;
        }
      } catch (_) {}

      if (res.status === 401 || res.status === 403) {
        throw new Error('Geçersiz veya yetkisiz OpenRouter API anahtarı. Lütfen anahtarınızı ve bakiyenizi kontrol edin.');
      }

      throw new Error(`OpenRouter (${res.status}): ${parsedMsg}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || 'Üzgünüm, analiz yanıtı oluşturulamadı.';
  } catch (error: any) {
    console.error('OpenRouter call error:', error);
    throw error;
  }
}

/**
 * High-quality fallback analysis engine for instantaneous responses and offline testing
 */
export function generateSimulatedAIResponse(userPrompt: string, context?: any): string {
  const lower = userPrompt.toLowerCase();

  if (lower.includes('portföy') || lower.includes('portfolio') || lower.includes('analiz et')) {
    return `### 📊 Portföyünüzün Kapsamlı AI Analiz Raporu

Portföy dağılımınız ve varlıklarınız detaylı olarak incelenmiştir:

#### 1. Varlık Dağılımı ve Çeşitlendirme
* **Hisse / Fon Oranı:** Dengeli bir büyüme ve risk yönetimi dağılımı görülüyor. BIST 100 hisseleri (THYAO, ASELS, TUPRS) temel nakit akışı ve temettü potansiyeli sağlarken, TEFAS teknoloji fonları (TI2, YAY) küresel büyüme potansiyeli sunuyor.
* **Sektörel Dağılım:** Havacılık, Savunma ve Küresel Teknoloji sektörleri ağırlıkta.

#### 2. Risk & Getiri Değerlendirmesi
* **Risk Seviyesi:** Orta - Yüksek (Büyüme odaklı portföy yapısı).
* **Güçlü Yönler:** Yüksek getiri potansiyeli olan tematik teknoloji fonları ve savunma sanayi sözleşmeleriyle desteklenen hisseler.
* **Geliştirilebilecek Alanlar:** Para piyasası fonu (örn: PPZ) veya altın katılım fonu (örn: KZL) gibi koruyucu varlıklarla volatiliteyi %10-15 seviyesinde dengeleyebilirsiniz.

#### 3. AI Önerileri & Strateji
1. **Kademeli Alım:** Düşüşlerde maliyet düşürmek için likit fonlarda belirli bir nakit rezervi tutun.
2. **Kâr Realizasyonu:** Hedef fiyata ulaşan varlıklarda kısmi kar realizasyonu yaparak kârı koruyucu fonlara yönlendirebilirsiniz.

*Bu analiz yapay zeka tarafından simüle edilmiştir. Yatırım Tavsiyesi Değildir (YTD).*`;
  }

  if (lower.includes('thyao') || lower.includes('türk hava')) {
    return `### ✈️ Türk Hava Yolları (THYAO) — Teknik ve Temel AI Değerlendirmesi

#### 📈 Teknik Gösterge Analizi
* **Trend:** Orta ve uzun vadeli yükselen kanal trendi devam ediyor.
* **RSI (14):** 58.4 — Nötr / Pozitif bölgede, henüz aşırı alım bölgesine girmemiş.
* **MACD:** Sinyal çizgisinin üzerinde, pozitif histogram oluşturuyor (Boğa momentumu).
* **Hareketli Ortalamalar:** 20 günlük SMA (₺304.50) ve 50 günlük SMA (₺292.00) üzerinde işlem görüyor.

#### 🎯 Destek & Direnç Seviyeleri
* **Direnç Seviyeleri:** ₺325.00 / ₺340.00
* **Destek Seviyeleri:** ₺305.00 / ₺292.50

#### 💡 Genel Sinyal: **GÜÇLÜ AL / TUT (STRONG BUY)**
Yolcu doluluk oranları, kargo gelirlerindeki artış ve filo genişlemesi orta vadeli hedefleri destekliyor.

*Yatırım Tavsiyesi Değildir (YTD).*`;
  }

  if (lower.includes('fon') || lower.includes('tefas')) {
    return `### 🏦 TEFAS Fonları AI Sepet & Getiri Tavsiyesi

Mevcut piyasa koşullarında yüksek reel getiri sağlamak için önerilen 3 ayaklı fon sepeti:

1. **Yabancı Teknoloji Sepeti (YAY / AFT):**
   * Yapay zeka ve çip devlerine (NVIDIA, Microsoft, Apple) doğrudan yatırım sağlar.
   * Yıllık getiri: +%108.5

2. **BIST 100 Dışı Büyüme Hisseleri (TI2 / MAC):**
   * Güçlü bilançoya sahip orta ölçekli sanayi ve teknoloji şirketlerini içerir.
   * Yıllık getiri: +%89.4

3. **Altın & Değer Saklama (KZL / TCA):**
   * Jeopolitik risklere ve enflasyona karşı portföyü korur.
   * Yıllık getiri: +%67.9

*Yatırım Tavsiyesi Değildir (YTD).*`;
  }

  return `### 🤖 StockMind AI Finansal Analizi

Sorunuz incelendi: **"${userPrompt}"**

#### 📌 Temel Değerlendirmeler:
* **Piyasa Trendi:** BIST 100 endeksi pozitif momentumunu korumakta olup, seçici hisse bazlı hareketler öne çıkmaktadır.
* **Teknik Görünüm:** Öncü endekslerde RSI ve MACD göstergeleri sağlıklı bir konsolidasyon sürecine işaret ediyor.
* **Risk Yönetimi:** Varlık sepetinizde hisse, TEFAS fonu ve emtia dengesini %50 Hisse / %35 Fon / %15 Koruyucu Varlık (Altın/Nakit) olarak yapılandırmanız önerilir.

Başka bir hisse sembolü (örn: ASELS, GARAN, NVDA) veya TEFAS fonu hakkında detaylı teknik analiz için sorabilirsiniz!

*Yatırım Tavsiyesi Değildir (YTD).*`;
}
