// StockMind Live Market & Portfolio Context Engine for AI Assistant
import { getAllStocksLive, getStockBySymbolLive, StockMarketInfo } from '@/lib/data/stocks';

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

/** Resolve names and symbols from the current market directory, with no company alias list. */
export function detectSymbolsInText(text: string, directory: Array<{ symbol: string; name: string }> = []): string[] {
  const segmenter = new Intl.Segmenter('tr', { granularity: 'word' });
  const words = (value: string) => Array.from(segmenter.segment(value.toLocaleLowerCase('tr-TR')))
    .filter(part => part.isWordLike).map(part => part.segment);
  const query = words(text);
  const aliases = new Map<string, Set<string>>();
  const add = (tokens: string[], symbol: string) => {
    const key = JSON.stringify(tokens);
    const symbols = aliases.get(key) || new Set<string>();
    symbols.add(symbol);
    aliases.set(key, symbols);
  };
  for (const asset of directory) {
    add(words(asset.symbol), asset.symbol);
    const name = words(asset.name);
    for (let length = 1; length <= name.length; length++) add(name.slice(0, length), asset.symbol);
  }
  const detected = new Set<string>();
  for (const [key, symbols] of aliases) {
    if (symbols.size !== 1) continue; // Ambiguous company prefixes never become a guessed quote.
    const tokens: string[] = JSON.parse(key);
    if (tokens.length && query.some((_, start) => tokens.every((token, index) => token === query[start + index]))) {
      detected.add(symbols.values().next().value!);
    }
  }
  return Array.from(detected).slice(0, 6);
}

export async function buildLiveAIContext(
  userPrompt: string,
  portfolioPayload?: PortfolioContextPayload
): Promise<string> {
  const [macro, directory] = await Promise.all([
    getLiveMacroSnapshot(),
    Promise.resolve().then(() => getAllStocksLive()).catch(() => []),
  ]);
  const detectedSymbols = detectSymbolsInText(userPrompt, directory);

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

  lines.push('');
  lines.push('**[VERİ KULLANIM KURALLARI]:**');
  lines.push('Yalnızca yukarıda açıkça verilen fiyat ve göstergeleri kullan. Eksik verileri tahmin etme.');
  lines.push('Portföy bilgileri kullanıcı tarafından gönderilmiştir; doğrulanmış hesap kaydı değildir.');
  lines.push('Fiyatların alındığı zamanı belirt; alınamayan veya eksik verileri açıkça söyle.');
  if (!Object.values(stockQuotes).some(Boolean) && !Object.entries(macro).some(([key, value]) => key !== 'timestamp' && value)) {
    lines.unshift('Piyasa verisi alınamadı. Güncel fiyat veya teknik gösterge varmış gibi yorum yapma.');
  }

  return lines.join('\n');
}
