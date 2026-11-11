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
  scope?: 'allocation_weights' | 'performance_returns' | 'full_financials';
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
    shares?: number;
    averageCost?: number;
    currentPrice?: number;
    totalValue?: number;
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

export interface AIContextProvenance {
  hasLiveMarketData: boolean;
  macroAvailableCount: number;
  macroTotalCount: number;
  missingMacroIndicators: string[];
  queriedSymbols: string[];
  resolvedSymbols: Array<{
    symbol: string;
    source: string;
    observedAt: string | null;
    price: number | null;
    currency: string;
  }>;
  missingSymbols: string[];
  portfolioScope: 'allocation_weights' | 'performance_returns' | 'full_financials' | 'none';
  dataSources: string[];
  observedAt: string | null;
  modelCommentaryNote: string;
  missingSummary: string | null;
}

export interface LiveAIContextBundle {
  promptContext: string;
  provenance: AIContextProvenance;
}

export async function buildLiveAIContextWithMetadata(
  userPrompt: string,
  portfolioPayload?: PortfolioContextPayload
): Promise<LiveAIContextBundle> {
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

  const macroEntries: Array<[string, { price: number; changePercent: number } | undefined]> = [
    ['USD/TRY', macro.usdTry],
    ['EUR/TRY', macro.eurTry],
    ['GBP/TRY', macro.gbpTry],
    ['Gram Altın', macro.gramAltin],
    ['Ons Altın', macro.onsAltin],
    ['BIST 100', macro.bist100],
    ['Brent Petrol', macro.brentPetrol],
  ];
  const macroAvailableCount = macroEntries.filter(([, val]) => Boolean(val)).length;
  const missingMacroIndicators = macroEntries.filter(([, val]) => !val).map(([label]) => label);
  const missingSymbols = detectedSymbols.filter((sym) => !stockQuotes[sym]);

  // Build Context Markdown
  const lines: string[] = [];
  lines.push('### ⚡ STOCKMIND UYGULAMA CANLI PİYASA & PORTFÖY ENTEGRASYONU');
  lines.push(`Sistem Zamanı: ${new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })} (TSİ)`);
  lines.push(`Veri Gözlem Zamanı: ${new Date(macro.timestamp).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })} (TSİ)`);
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

  if (missingMacroIndicators.length > 0 || missingSymbols.length > 0) {
    lines.push('');
    lines.push('**[EKSİK / ALINAMAYAN VERİLER]:**');
    if (missingSymbols.length > 0) {
      lines.push(`- Şu sembollerin canlı verisi alınamadı: ${missingSymbols.join(', ')}`);
    }
    if (missingMacroIndicators.length > 0) {
      lines.push(`- Alınamayan makro göstergeler: ${missingMacroIndicators.join(', ')}`);
    }
  }

  // 3. User's Portfolio Context (minimized by question scope per AIP-02)
  if (portfolioPayload && (portfolioPayload.totalValue !== undefined || (portfolioPayload.holdings && portfolioPayload.holdings.length > 0))) {
    const scopeLabel =
      portfolioPayload.scope === 'allocation_weights'
        ? 'Yalnız varlık dağılımı ve ağırlıklar (tam tutarlar ve maliyetler gizlilik amacıyla gönderilmedi)'
        : portfolioPayload.scope === 'performance_returns'
          ? 'Varlık dağılımı ve yüzde getiriler (tam TL/USD tutarları ve maliyetler gönderilmedi)'
          : 'Tam tutarlar ve maliyet analizi';

    lines.push('');
    lines.push('**[KULLANICININ STOCKMIND PORTFÖY VERİLERİ (GÜNCEL)]:**');
    lines.push(`- Paylaşım Kapsamı: ${scopeLabel}`);

    if (typeof portfolioPayload.totalValue === 'number') {
      lines.push(`- Toplam Portföy Değeri: ₺${portfolioPayload.totalValue.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`);
    }
    if (typeof portfolioPayload.totalCost === 'number') {
      lines.push(`- Toplam Maliyet: ₺${portfolioPayload.totalCost.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`);
    }
    if (typeof portfolioPayload.totalProfitLoss === 'number' || typeof portfolioPayload.totalProfitLossPercent === 'number') {
      const plPct = portfolioPayload.totalProfitLossPercent ?? 0;
      const plSign = (portfolioPayload.totalProfitLoss ?? plPct) >= 0 ? '+' : '';
      if (typeof portfolioPayload.totalProfitLoss === 'number') {
        lines.push(
          `- Toplam Kâr/Zarar: ${plSign}₺${portfolioPayload.totalProfitLoss.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} (%${plSign}${plPct.toFixed(2)})`
        );
      } else {
        lines.push(`- Toplam Getiri Oranı: %${plSign}${plPct.toFixed(2)}`);
      }
    }
    if (typeof portfolioPayload.dailyProfitLoss === 'number' || typeof portfolioPayload.dailyProfitLossPercent === 'number') {
      const dPct = portfolioPayload.dailyProfitLossPercent ?? 0;
      const dSign = (portfolioPayload.dailyProfitLoss ?? dPct) >= 0 ? '+' : '';
      if (typeof portfolioPayload.dailyProfitLoss === 'number') {
        lines.push(`- Günlük Kâr/Zarar: ${dSign}₺${portfolioPayload.dailyProfitLoss.toFixed(2)} (%${dSign}${dPct.toFixed(2)})`);
      } else {
        lines.push(`- Günlük Getiri Oranı: %${dSign}${dPct.toFixed(2)}`);
      }
    }

    if (portfolioPayload.holdings && portfolioPayload.holdings.length > 0) {
      lines.push('Varlıklar (Pozisyonlar):');
      portfolioPayload.holdings.forEach((h) => {
        const parts: string[] = [];
        if (h.assetType) parts.push(`Tür: ${h.assetType}`);
        if (typeof h.weight === 'number') parts.push(`Ağırlık: %${h.weight.toFixed(1)}`);
        if (typeof h.shares === 'number') parts.push(`${h.shares} Adet`);
        if (typeof h.averageCost === 'number') parts.push(`Ort. Maliyet: ₺${h.averageCost.toFixed(2)}`);
        if (typeof h.currentPrice === 'number') parts.push(`Güncel Fiyat: ₺${h.currentPrice.toFixed(2)}`);
        if (typeof h.totalValue === 'number') parts.push(`Toplam Değer: ₺${h.totalValue.toLocaleString('tr-TR')}`);
        if (typeof h.profitLossPercent === 'number') {
          const hSign = h.profitLossPercent >= 0 ? '+' : '';
          parts.push(`Kâr/Zarar: ${hSign}%${h.profitLossPercent.toFixed(2)}`);
        }
        lines.push(`  * ${h.symbol} (${h.name || h.symbol}): ${parts.join(' | ')}`);
      });
    }
  }

  lines.push('');
  lines.push('**[VERİ KULLANIM KURALLARI]:**');
  lines.push('Yalnızca yukarıda açıkça verilen fiyat ve göstergeleri kullan. Eksik verileri tahmin etme.');
  lines.push('Sağlayıcıdan gelen sayısal veriler ile genel model yorumunu birbirinden ayır.');
  lines.push('Portföy bilgileri kullanıcı tarafından gönderilmiştir; doğrulanmış hesap kaydı değildir.');
  lines.push('Fiyatların alındığı zamanı belirt; alınamayan veya eksik verileri açıkça söyle.');
  const hasLiveMarketData =
    validQuotes.length > 0 || macroAvailableCount > 0;
  if (!hasLiveMarketData) {
    lines.unshift('Piyasa verisi alınamadı. Güncel fiyat veya teknik gösterge varmış gibi yorum yapma.');
  }

  const dataSources: string[] = [];
  if (macroAvailableCount > 0) {
    dataSources.push(`StockMind Piyasa Motoru (Makro ${macroAvailableCount}/${macroEntries.length})`);
  }
  if (validQuotes.length > 0) {
    dataSources.push(`Varlık Fiyat Sağlayıcısı (${validQuotes.map((q) => q.symbol).join(', ')})`);
  }
  if (portfolioPayload && (portfolioPayload.totalValue !== undefined || (portfolioPayload.holdings && portfolioPayload.holdings.length > 0))) {
    const scopeText =
      portfolioPayload.scope === 'allocation_weights'
        ? 'Dağılım & Ağırlık'
        : portfolioPayload.scope === 'performance_returns'
          ? 'Getiri Oranları'
          : 'Tam Portföy';
    dataSources.push(`Kullanıcı Portföyü (${scopeText})`);
  }

  const missingParts: string[] = [];
  if (!hasLiveMarketData) {
    missingParts.push('Canlı piyasa verisi sağlayıcısına ulaşılamadı');
  } else if (missingMacroIndicators.length > 0) {
    missingParts.push(`Makro eksik: ${missingMacroIndicators.join(', ')}`);
  }
  if (missingSymbols.length > 0) {
    missingParts.push(`Sembol verisi alınamadı: ${missingSymbols.join(', ')}`);
  }

  const provenance: AIContextProvenance = {
    hasLiveMarketData,
    macroAvailableCount,
    macroTotalCount: macroEntries.length,
    missingMacroIndicators,
    queriedSymbols: detectedSymbols,
    resolvedSymbols: validQuotes.map((q) => ({
      symbol: q.symbol,
      source: 'StockMind Piyasa Motoru',
      observedAt: macro.timestamp,
      price: typeof q.price === 'number' ? q.price : null,
      currency: q.currency || 'TRY',
    })),
    missingSymbols,
    portfolioScope:
      portfolioPayload && (portfolioPayload.totalValue !== undefined || (portfolioPayload.holdings && portfolioPayload.holdings.length > 0))
        ? portfolioPayload.scope || 'full_financials'
        : 'none',
    dataSources,
    observedAt: hasLiveMarketData ? macro.timestamp : null,
    modelCommentaryNote:
      'Model değerlendirmeleri ve öngörüler genel yapay zekâ yorumudur; sağlayıcı verisinden ayrı okunmalıdır.',
    missingSummary: missingParts.length > 0 ? missingParts.join(' • ') : null,
  };

  return {
    promptContext: lines.join('\n'),
    provenance,
  };
}

export async function buildLiveAIContext(
  userPrompt: string,
  portfolioPayload?: PortfolioContextPayload
): Promise<string> {
  const result = await buildLiveAIContextWithMetadata(userPrompt, portfolioPayload);
  return result.promptContext;
}
