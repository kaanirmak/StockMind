// StockMind Live Market & Portfolio Context Engine for AI Assistant
import { getStockBySymbolLive, StockMarketInfo } from '@/lib/data/stocks';

export interface MacroRates {
  usdTry?: { price: number; changePercent: number };
  eurTry?: { price: number; changePercent: number };
  gbpTry?: { price: number; changePercent: number };
  gramAltin?: { price: number; changePercent: number };
  onsAltin?: { price: number; changePercent: number };
  brentPetrol?: { price: number; changePercent: number };
  bist100?: { price: number; changePercent: number };
  timestamp: string;
}

export interface PortfolioContextPayload {
  totalValue?: number;
  totalCost?: number;
  totalProfitLoss?: number;
  totalProfitLossPercent?: number;
  dailyProfitLoss?: number;
  dailyProfitLossPercent?: number;
  holdings?: Array<{
    symbol: string;
    name?: string;
    assetType?: string;
    shares: number;
    averageCost: number;
    currentPrice: number;
    totalValue: number;
    profitLoss?: number;
    profitLossPercent?: number;
    weight?: number;
  }>;
}

// In-memory cache for macro rates (revalidated every 30 seconds)
let macroCache: { data: MacroRates; expiresAt: number } | null = null;

export async function getLiveMacroSnapshot(): Promise<MacroRates> {
  const now = Date.now();
  if (macroCache && macroCache.expiresAt > now) {
    return macroCache.data;
  }

  const [usd, eur, gbp, goldGram, goldOns, oil, bist] = await Promise.all([
    getStockBySymbolLive('USDTRY').catch(() => null),
    getStockBySymbolLive('EURTRY').catch(() => null),
    getStockBySymbolLive('GBPTRY').catch(() => null),
    getStockBySymbolLive('GRAM_ALTIN').catch(() => null),
    getStockBySymbolLive('XAUUSD').catch(() => null),
    getStockBySymbolLive('UKOIL').catch(() => null),
    getStockBySymbolLive('XU100').catch(() => null),
  ]);

  const result: MacroRates = {
    usdTry: usd ? { price: usd.price || 0, changePercent: usd.changePercent || 0 } : undefined,
    eurTry: eur ? { price: eur.price || 0, changePercent: eur.changePercent || 0 } : undefined,
    gbpTry: gbp ? { price: gbp.price || 0, changePercent: gbp.changePercent || 0 } : undefined,
    gramAltin: goldGram ? { price: goldGram.price || 0, changePercent: goldGram.changePercent || 0 } : undefined,
    onsAltin: goldOns ? { price: goldOns.price || 0, changePercent: goldOns.changePercent || 0 } : undefined,
    brentPetrol: oil ? { price: oil.price || 0, changePercent: oil.changePercent || 0 } : undefined,
    bist100: bist ? { price: bist.price || 0, changePercent: bist.changePercent || 0 } : undefined,
    timestamp: new Date().toISOString(),
  };

  macroCache = { data: result, expiresAt: now + 30000 };
  return result;
}

// Company aliases for BIST and popular assets
const COMPANY_ALIASES: Record<string, string> = {
  'türk hava yolları': 'THYAO',
  'havayolları': 'THYAO',
  'thy': 'THYAO',
  'aselsan': 'ASELS',
  'tüpraş': 'TUPRS',
  'tupras': 'TUPRS',
  'ford': 'FROTO',
  'ford otosan': 'FROTO',
  'garanti': 'GARAN',
  'garanti bbva': 'GARAN',
  'akbank': 'AKBNK',
  'yapı kredi': 'YKBNK',
  'yapi kredi': 'YKBNK',
  'iş bankası': 'ISCTR',
  'is bankasi': 'ISCTR',
  'ereğli': 'EREGL',
  'eregli': 'EREGL',
  'şişecam': 'SISE',
  'sisecam': 'SISE',
  'bim': 'BIMAS',
  'bimaş': 'BIMAS',
  'koç holding': 'KCHOL',
  'koc holding': 'KCHOL',
  'sabancı holding': 'SAHOL',
  'sabanci holding': 'SAHOL',
  'pegasus': 'PGSUS',
  'turkcell': 'TCELL',
  'türk telekom': 'TTKOM',
  'telekom': 'TTKOM',
  'sasa': 'SASA',
  'hektas': 'HEKTS',
  'hektaş': 'HEKTS',
  'astor': 'ASTOR',
  'kontrolmatik': 'KONTR',
  'europower': 'EUPWR',
  'koza altın': 'KOZAL',
  'petkim': 'PETKM',
  'tofaş': 'TOASO',
  'tofas': 'TOASO',
  'arçelik': 'ARCLK',
  'arcelik': 'ARCLK',
  'migros': 'MGROS',
  'şok': 'SOKM',
  'sok': 'SOKM',
  'dolar': 'USDTRY',
  'dollar': 'USDTRY',
  'usd': 'USDTRY',
  'euro': 'EURTRY',
  'avro': 'EURTRY',
  'eur': 'EURTRY',
  'sterlin': 'GBPTRY',
  'gbp': 'GBPTRY',
  'altın': 'GRAM_ALTIN',
  'altin': 'GRAM_ALTIN',
  'gram altın': 'GRAM_ALTIN',
  'ons altın': 'XAUUSD',
  'gümüş': 'GRAM_GUMUS',
  'gumus': 'GRAM_GUMUS',
  'petrol': 'UKOIL',
  'brent': 'UKOIL',
  'bist': 'XU100',
  'bist 100': 'XU100',
  'borsa': 'XU100',
  'nvidia': 'NVDA',
  'apple': 'AAPL',
  'tesla': 'TSLA',
  'microsoft': 'MSFT',
  'amazon': 'AMZN',
  'google': 'GOOGL',
};

export function detectSymbolsInText(text: string): string[] {
  const lower = text.toLowerCase();
  const detected = new Set<string>();

  // 1. Check alias phrases
  for (const [phrase, sym] of Object.entries(COMPANY_ALIASES)) {
    if (lower.includes(phrase)) {
      detected.add(sym);
    }
  }

  // 2. Extract potential uppercase/alphanumeric tickers (3 to 6 chars)
  const words = text.split(/[\s,?.!;:"'()\[\]{}]+/);
  for (const w of words) {
    const clean = w.trim().toUpperCase();
    if (/^[A-Z0-9]{3,6}$/.test(clean)) {
      detected.add(clean);
    }
  }

  return Array.from(detected).slice(0, 6); // Max 6 symbols to keep prompt concise
}

export async function buildLiveAIContext(
  userPrompt: string,
  portfolioPayload?: PortfolioContextPayload
): Promise<string> {
  const macro = await getLiveMacroSnapshot();
  const detectedSymbols = detectSymbolsInText(userPrompt);

  // Fetch live quotes for detected symbols in parallel
  const stockQuotes: Record<string, StockMarketInfo | null> = {};
  if (detectedSymbols.length > 0) {
    await Promise.all(
      detectedSymbols.map(async (sym) => {
        try {
          const q = await getStockBySymbolLive(sym);
          if (q) stockQuotes[sym] = q;
        } catch (_) {}
      })
    );
  }

  // Build Context Markdown
  const lines: string[] = [];
  lines.push('### ⚡ STOCKMIND UYGULAMA CANLI PİYASA & PORTFÖY ENTEGRASYONU');
  lines.push(`Sistem Zamanı: ${new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })} (TSİ)`);
  lines.push('');

  // 1. Macro Section
  lines.push('**[CANLI PİYASA GÖSTERGELERİ (StockMind Canlı Veri Motoru)]:**');
  if (macro.usdTry) {
    lines.push(`- USD/TRY (Amerikan Doları): ₺${macro.usdTry.price.toFixed(4)} (Günlük Değişim: %${macro.usdTry.changePercent > 0 ? '+' : ''}${macro.usdTry.changePercent.toFixed(2)})`);
  }
  if (macro.eurTry) {
    lines.push(`- EUR/TRY (Euro): ₺${macro.eurTry.price.toFixed(4)} (Günlük Değişim: %${macro.eurTry.changePercent > 0 ? '+' : ''}${macro.eurTry.changePercent.toFixed(2)})`);
  }
  if (macro.gbpTry) {
    lines.push(`- GBP/TRY (İngiliz Sterlini): ₺${macro.gbpTry.price.toFixed(4)} (Günlük Değişim: %${macro.gbpTry.changePercent > 0 ? '+' : ''}${macro.gbpTry.changePercent.toFixed(2)})`);
  }
  if (macro.gramAltin) {
    lines.push(`- Gram Altın (TL): ₺${macro.gramAltin.price.toFixed(2)} (Günlük Değişim: %${macro.gramAltin.changePercent > 0 ? '+' : ''}${macro.gramAltin.changePercent.toFixed(2)})`);
  }
  if (macro.onsAltin) {
    lines.push(`- Ons Altın ($ / XAUUSD): $${macro.onsAltin.price.toFixed(2)} (Günlük Değişim: %${macro.onsAltin.changePercent > 0 ? '+' : ''}${macro.onsAltin.changePercent.toFixed(2)})`);
  }
  if (macro.bist100) {
    lines.push(`- Borsa İstanbul 100 Endeksi (BIST 100): ${macro.bist100.price.toFixed(2)} Puan (Günlük Değişim: %${macro.bist100.changePercent > 0 ? '+' : ''}${macro.bist100.changePercent.toFixed(2)})`);
  }
  if (macro.brentPetrol) {
    lines.push(`- Brent Petrol ($): $${macro.brentPetrol.price.toFixed(2)}`);
  }

  // 2. Specific Stocks / Funds Detected in Prompt
  const validQuotes = Object.values(stockQuotes).filter(Boolean) as StockMarketInfo[];
  if (validQuotes.length > 0) {
    lines.push('');
    lines.push('**[KULLANICININ SORDUĞU VARLIKLARIN ANLIK PİYASA VERİLERİ]:**');
    validQuotes.forEach((q) => {
      const peStr = q.peRatio ? `, F/K: ${q.peRatio}` : '';
      const highStr = q.high ? `, Gün İçi Yüksek: ₺${q.high}` : '';
      const lowStr = q.low ? `, Gün İçi Düşük: ₺${q.low}` : '';
      lines.push(
        `- **${q.symbol} (${q.name})**: Fiyat: ${q.currency === 'USD' ? '$' : '₺'}${q.price?.toFixed(2)} | Değişim: %${(q.changePercent || 0) > 0 ? '+' : ''}${(q.changePercent || 0).toFixed(2)}${peStr}${highStr}${lowStr} (Sektör: ${q.sector})`
      );
    });
  }

  // 3. User's Portfolio Context
  if (portfolioPayload && (portfolioPayload.totalValue || (portfolioPayload.holdings && portfolioPayload.holdings.length > 0))) {
    lines.push('');
    lines.push('**[KULLANICININ STOCKMIND PORTFÖY VERİLERİ (GÜNCEL)]:**');
    lines.push(`- Toplam Portföy Değeri: ₺${(portfolioPayload.totalValue || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`);
    lines.push(`- Toplam Maliyet: ₺${(portfolioPayload.totalCost || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`);
    const plSign = (portfolioPayload.totalProfitLoss || 0) >= 0 ? '+' : '';
    lines.push(
      `- Toplam Kâr/Zarar: ${plSign}₺${(portfolioPayload.totalProfitLoss || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} (%${plSign}${(portfolioPayload.totalProfitLossPercent || 0).toFixed(2)})`
    );
    if (portfolioPayload.dailyProfitLoss !== undefined) {
      const dSign = portfolioPayload.dailyProfitLoss >= 0 ? '+' : '';
      lines.push(`- Günlük Kâr/Zarar: ${dSign}₺${portfolioPayload.dailyProfitLoss.toFixed(2)} (%${dSign}${(portfolioPayload.dailyProfitLossPercent || 0).toFixed(2)})`);
    }

    if (portfolioPayload.holdings && portfolioPayload.holdings.length > 0) {
      lines.push('Varlıklar (Pozisyonlar):');
      portfolioPayload.holdings.forEach((h) => {
        const hSign = (h.profitLossPercent || 0) >= 0 ? '+' : '';
        lines.push(
          `  * ${h.symbol} (${h.name || h.symbol}): ${h.shares} Adet | Ort. Maliyet: ₺${h.averageCost.toFixed(2)} | Güncel Fiyat: ₺${h.currentPrice.toFixed(2)} | Toplam Değer: ₺${h.totalValue.toLocaleString('tr-TR')} | Kâr/Zarar: ${hSign}%${(h.profitLossPercent || 0).toFixed(2)} | Ağırlık: %${(h.weight || 0).toFixed(1)}`
        );
      });
    }
  }

  // 4. Strict Directive to NEVER say "I don't have real-time access"
  lines.push('');
  lines.push('**[ÖNEMLİ VE KESİN DİREKTİF]:**');
  lines.push('1. Yukarıdaki tüm döviz, altın, borsa endeksi, hisse ve portföy verileri StockMind platformunun anlık canlı sisteminden doğrudan çekilmiştir.');
  lines.push('2. Kullanıcı piyasa fiyatlarını (Dolar, Euro, Altın, BIST endeksi, hisse senetleri veya fonlar) veya kendi portföyünü sorduğunda:');
  lines.push('   - ASLA "gerçek zamanlı piyasa verilerine erişimim yoktur" DEME!');
  lines.push('   - ASLA "bilgim güncel değildir" veya "canlı verileri göremiyorum" DEME!');
  lines.push('   - Doğrudan yukarıdaki anlık canlı StockMind verilerini kullanarak kullanıcıya kesin, net, doğru ve profesyonel yanıt ver.');
  lines.push('3. Örneğin kullanıcı "dolar kaç tl" diye sorduğunda, yukarıda listelenen güncel USD/TRY kurunu (₺' + (macro.usdTry?.price.toFixed(4) || '48.78') + ') doğrudan vererek günlük değişimini açıkla.');
  lines.push('4. Kullanıcı "portföyüm nasıl" dediğinde, yukarıdaki gerçek portföy rakamlarını, en kârlı ve zarardaki varlıklarını analiz ederek tavsiye sun.');

  return lines.join('\n');
}
