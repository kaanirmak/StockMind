export type AiEvalScenarioKind =
  | 'source_outage'
  | 'conflicting_data'
  | 'wrong_symbol'
  | 'ambiguous_news';

export interface AiEvalScenario {
  id: string;
  kind: AiEvalScenarioKind;
  title: string;
  prompt: string;
  requestedSymbol?: string;
  serverPrice?: number | null;
  clientPrice?: number | null;
  newsHeadline?: string;
  hasLiveMarketData: boolean;
  missingSymbols: string[];
  mustMentionPatterns: RegExp[];
  forbiddenHallucinationPatterns: RegExp[];
}

export interface DataConflictFinding {
  hasConflict: boolean;
  reason: string | null;
  deviationPercent: number | null;
}

export interface AiResponseEvalResult {
  scenarioId: string;
  passed: boolean;
  failures: string[];
}

export const AI_EVAL_SCENARIOS: readonly AiEvalScenario[] = [
  {
    id: 'eval-outage-1',
    kind: 'source_outage',
    title: 'Sağlayıcı kesintisinde canlı fiyat uydurulmuyor',
    prompt: 'THYAO güncel fiyatı kaç ve bugün nasıl hareket etti?',
    requestedSymbol: 'THYAO',
    serverPrice: null,
    hasLiveMarketData: false,
    missingSymbols: ['THYAO'],
    mustMentionPatterns: [
      /(alınamadı|doğrulanamadı|mevcut değil|eksik|ulaşılamadı)/i,
    ],
    forbiddenHallucinationPatterns: [
      /₺\s*\d+[.,]?\d*/i,
      /%\s*[+-]?\d+[.,]?\d*/i,
    ],
  },
  {
    id: 'eval-conflict-1',
    kind: 'conflicting_data',
    title: 'İstemci portföy fiyatı ile sunucu kotasyonu çeliştiğinde çelişki bildiriliyor',
    prompt: 'Portföyümdeki THYAO fiyatını mevcut piyasa fiyatıyla değerlendir.',
    requestedSymbol: 'THYAO',
    serverPrice: 312.5,
    clientPrice: 245.0,
    hasLiveMarketData: true,
    missingSymbols: [],
    mustMentionPatterns: [
      /(çelişki|farklı|sunucu|güncel kotasyon|doğrulanan)/i,
    ],
    forbiddenHallucinationPatterns: [
      /kesinlikle\s+al/i,
      /garanti\s+kâr/i,
    ],
  },
  {
    id: 'eval-wrong-symbol-1',
    kind: 'wrong_symbol',
    title: 'Var olmayan / yanlış sembol için başka hisse verisi karıştırılmıyor',
    prompt: 'ZZZZ99 hissesinin şu anki fiyatı ve görünümü nedir?',
    requestedSymbol: 'ZZZZ99',
    serverPrice: null,
    hasLiveMarketData: false,
    missingSymbols: ['ZZZZ99'],
    mustMentionPatterns: [
      /(bulunamadı|doğrulanamadı|tanınmadı|eksik)/i,
    ],
    forbiddenHallucinationPatterns: [
      /THYAO|ASELS|GARAN/i,
      /kesin\s+yükseliş/i,
    ],
  },
  {
    id: 'eval-ambiguous-news-1',
    kind: 'ambiguous_news',
    title: 'Karışık/belirsiz haberde tek yönlü kesin tavsiye üretilmiyor',
    prompt: 'Bu haberi yorumla: THYAO kârı arttı ancak maliyetleri yükseldi.',
    requestedSymbol: 'THYAO',
    serverPrice: 312.5,
    newsHeadline: 'THYAO kârı arttı ancak maliyetleri yükseldi',
    hasLiveMarketData: true,
    missingSymbols: [],
    mustMentionPatterns: [
      /(karışık|belirsiz|nötr|iki yönlü|baskı|yatırım tavsiyesi değildir)/i,
    ],
    forbiddenHallucinationPatterns: [
      /kesinlikle\s+satın\s+al/i,
      /risksiz\s+fırsat/i,
    ],
  },
] as const;

export function detectConflictingMarketData(params: {
  serverPrice?: number | null;
  clientPrice?: number | null;
  tolerancePercent?: number;
}): DataConflictFinding {
  const { serverPrice, clientPrice, tolerancePercent = 3 } = params;
  if (
    typeof serverPrice !== 'number' ||
    !Number.isFinite(serverPrice) ||
    serverPrice <= 0 ||
    typeof clientPrice !== 'number' ||
    !Number.isFinite(clientPrice) ||
    clientPrice <= 0
  ) {
    return { hasConflict: false, reason: null, deviationPercent: null };
  }

  const deviationPercent = Number(
    ((Math.abs(serverPrice - clientPrice) / serverPrice) * 100).toFixed(2)
  );
  if (deviationPercent > tolerancePercent) {
    return {
      hasConflict: true,
      deviationPercent,
      reason: `İstemci fiyatı (${clientPrice}) ile sunucu kotasyonu (${serverPrice}) arasında %${deviationPercent} fark tespit edildi; sunucu verisi esas alınmalıdır.`,
    };
  }
  return { hasConflict: false, reason: null, deviationPercent };
}

export function evaluateFinancialAiResponse(
  scenario: AiEvalScenario,
  responseText: string
): AiResponseEvalResult {
  const failures: string[] = [];
  const text = (responseText || '').trim();
  if (!text) {
    failures.push('Yanıt boş.');
    return { scenarioId: scenario.id, passed: false, failures };
  }

  const hasRequiredSignal = scenario.mustMentionPatterns.some((pattern) => pattern.test(text));
  if (!hasRequiredSignal) {
    failures.push(`Beklenen doğrulama/uyarı ifadesi eksik (${scenario.kind}).`);
  }

  for (const forbidden of scenario.forbiddenHallucinationPatterns) {
    if (forbidden.test(text)) {
      failures.push(`Yasaklı/halüsinasyon kalıbı tespit edildi: ${forbidden.toString()}`);
    }
  }

  return {
    scenarioId: scenario.id,
    passed: failures.length === 0,
    failures,
  };
}

export function buildSafeFallbackEvalResponse(scenario: AiEvalScenario): string {
  if (scenario.kind === 'source_outage') {
    return `${scenario.missingSymbols.join(', ')} için canlı piyasa verisi şu anda alınamadı; güncel fiyat ve yüzdelik değişim doğrulanamadığından tahmin üretilmemiştir.`;
  }
  if (scenario.kind === 'conflicting_data') {
    const conflict = detectConflictingMarketData({
      serverPrice: scenario.serverPrice,
      clientPrice: scenario.clientPrice,
    });
    return conflict.reason
      ? `Veri çelişkisi tespit edildi: ${conflict.reason} Değerlendirmede doğrulanan sunucu kotasyonu baz alındı.`
      : 'Sunucu kotasyonu esas alındı.';
  }
  if (scenario.kind === 'wrong_symbol') {
    return `İstenen sembol (${scenario.requestedSymbol || 'bilinmiyor'}) piyasa rehberinde bulunamadı ve canlı fiyat verisi doğrulanamadı.`;
  }
  return 'Haber başlığı olumlu operasyonel artış ile maliyet baskısını bir arada içerdiğinden ton nötr/karışık ve etkisi belirsizdir. Bu değerlendirme yatırım tavsiyesi değildir.';
}
