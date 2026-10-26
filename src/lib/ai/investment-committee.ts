import { OpenRouterError, readOpenRouterResponse } from './openrouter';
import { palette } from '@/theme/palette';
import { getModelCatalog, selectStructuredModel } from './modelCatalog';
import { getAIRuntimePolicy } from './runtimePolicy';
// StockMind Yatırım Komitesi - Çoklu AI Ajan Simülasyonu Motoru

export interface CommitteeAgent {
  id: 'buffett' | 'lynch' | 'simons' | 'burry';
  name: string;
  role: string;
  avatar: string;
  color: string;
  accentBg: string;
  focus: string;
  verdict: 'AL' | 'GÜÇLÜ AL' | 'TUT' | 'SAT' | 'TEMKİNLİ';
  score: number; // 0 - 10
  speech: string;
  keyArguments: string[];
}

export interface CommitteeReport {
  symbol: string;
  companyName: string;
  consensusVerdict: 'GÜÇLÜ AL' | 'AL' | 'TUT / DENGELİ' | 'DİKKATLİ / SAT';
  consensusScore: number; // 0 - 10
  consensusSummary: string;
  agents: CommitteeAgent[];
  generatedAt: string;
  isLiveLLM: boolean;
}

export const COMMITTEE_AGENTS_CONFIG = [
  {
    id: 'buffett' as const,
    name: 'Warren Buffett',
    role: 'Değer & Hendek (Moat) Ajanı',
    avatar: '👴🏻',
    color: palette.info,
    accentBg: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
    focus: 'Ekonomik Hendek, Serbest Nakit Akışı, F/K, Sermaye Kârlılığı (ROE)',
  },
  {
    id: 'lynch' as const,
    name: 'Peter Lynch',
    role: 'Büyüme & Trend Ajanı',
    avatar: '📈',
    color: palette.success,
    accentBg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    focus: 'Büyüme Potansiyeli, PEG Oranı, Müşteri Sadakati, 10-Bagger Potansiyeli',
  },
  {
    id: 'simons' as const,
    name: 'Jim Simons (Quant)',
    role: 'Algoritmik & Matematiksel Ajan',
    avatar: '📐',
    color: palette.primaryDark,
    accentBg: 'bg-violet-500/10 border-violet-500/30 text-violet-400',
    focus: 'Momentum, RSI/MACD, Volatilite, İstatistiksel Sapma & Olasılık',
  },
  {
    id: 'burry' as const,
    name: 'Michael Burry',
    role: 'Risk Yöneticisi (Ayı Senaryosu)',
    avatar: '🐻',
    color: palette.colorf43f5e,
    accentBg: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
    focus: 'Makro Kriz Riskleri, Borç Vadesi, Kur Riski, Aşırı Değerleme İpuçları',
  },
];

export async function runInvestmentCommittee(
  symbol: string,
  stockQuote?: any,
  apiKey?: string
): Promise<CommitteeReport> {
  const sym = symbol.toUpperCase().trim();
  const effectiveKey = apiKey?.trim() || (typeof process !== 'undefined' ? process.env.OPENROUTER_API_KEY?.trim() : undefined);

  if (!effectiveKey) throw new Error('API_KEY_REQUIRED');
  return callLiveCommitteeAPI(sym, stockQuote, effectiveKey);
}

async function callLiveCommitteeAPI(symbol: string, stockQuote: any, apiKey: string): Promise<CommitteeReport> {
  const policy = getAIRuntimePolicy();
  const selectedModel = selectStructuredModel(await getModelCatalog(), policy.committeeModel);
  const priceStr = stockQuote?.price ? `₺${stockQuote.price}` : 'Piyasa Fiyatı';
  const changeStr = stockQuote?.changePercent != null ? `%${stockQuote.changePercent.toFixed(2)}` : '';
  const companyName = stockQuote?.name || `${symbol} Ortaklığı`;
  const sector = stockQuote?.sector || 'Sermaye Piyasası / Borsa';

  const prompt = `Sen StockMind Quant Lab'ın 4 kişilik uzman yatırım komitesisin.
Aşağıda belirtilen şirketi derinlemesine, gerçek finansal ve sektörel gerçeklerine göre analiz et.

İNCELENEN VARLIK:
- Sembol: ${symbol}
- Şirket / Varlık Adı: ${companyName}
- Güncel Fiyat: ${priceStr} ${changeStr ? `(Günlük Değişim: ${changeStr})` : ''}
- Sektör / Faaliyet Alanı: ${sector}

KOMİTE ÜYELERİ & ROL DAĞILIMI:
1. Warren Buffett (Değer & Ekonomik Hendek - Moat):
   Bu şirketin (${symbol} - ${companyName}) gerçek iş modeline, marka gücüne, serbest nakit akımına, fiyatlama gücüne ve sermaye kârlılığına (ROE) odaklan. Fiyatın içsel değere göre ucuz olup olmadığını söyle.
2. Peter Lynch (Büyüme & Tüketici Talebi):
   Şirketin pazar payı artışına, ürünlerine, mağaza/üretim kapasitesi genişlemesine, müşteri sadakatine ve PEG oranına (F/K / Büyüme) odaklan. 10-bagger potansiyelini değerlendir.
3. Jim Simons (Quant & Algoritmik Momentum):
   Fiyat hareketlerine, 20/50/200 günlük hareketli ortalamalara, RSI/MACD sinyallerine, volatiliteye ve istatistiksel trend kırılım olasılıklarına odaklan.
4. Michael Burry (Risk Yöneticisi & Ayı Tezi):
   Şirketin borçluluğuna, döviz pozisyonuna, yüksek faiz ve enflasyon baskısına, marj erozyonu risklerine ve sektördeki kriz senaryolarına acımasızca odaklan.

KRİTİK TALİMATLAR:
- ASLA her şirkete uyabilecek ezbere, jenerik laflar söyleme. ${companyName} (${symbol}) şirketinin bizzat faaliyet gösterdiği sektöre, rakiplerine ve dinamiklerine doğrudan atıf yap.
- Her üyenin konuşması ("speech") en az 2-3 cümlelik akıcı, entelektüel ve o yatırımcının felsefesini yansıtan bir Türkçe ile yazılsın.
- Çıktıyı SADECE aşağıdaki JSON şemasında, başka hiçbir metin olmadan saf JSON olarak döndür:

{
  "consensusVerdict": "GÜÇLÜ AL" | "AL" | "TUT / DENGELİ" | "DİKKATLİ / SAT",
  "consensusScore": 8.4,
  "consensusSummary": "Komitenin şirket hakkındaki ortak sentezi ve net özeti...",
  "agents": [
    {
      "id": "buffett",
      "verdict": "GÜÇLÜ AL" | "AL" | "TUT" | "TEMKİNLİ" | "SAT",
      "score": 8.8,
      "speech": "Warren Buffett olarak analizim...",
      "keyArguments": ["Argüman 1", "Argüman 2", "Argüman 3"]
    },
    {
      "id": "lynch",
      "verdict": "GÜÇLÜ AL" | "AL" | "TUT" | "TEMKİNLİ" | "SAT",
      "score": 8.2,
      "speech": "Peter Lynch olarak analizim...",
      "keyArguments": ["Argüman 1", "Argüman 2"]
    },
    {
      "id": "simons",
      "verdict": "GÜÇLÜ AL" | "AL" | "TUT" | "TEMKİNLİ" | "SAT",
      "score": 7.8,
      "speech": "Jim Simons olarak analizim...",
      "keyArguments": ["Argüman 1", "Argüman 2"]
    },
    {
      "id": "burry",
      "verdict": "TEMKİNLİ" | "SAT" | "TUT" | "AL",
      "score": 6.2,
      "speech": "Michael Burry olarak risk analizim...",
      "keyArguments": ["Risk 1", "Risk 2", "Risk 3"]
    }
  ]
}`;

  const candidateModels: string[] = [selectedModel.id];
  const fallbacks = ['openrouter/free', 'recursive/flint-v1.0:free'];
  for (const fb of fallbacks) {
    if (!candidateModels.includes(fb)) candidateModels.push(fb);
  }

  let lastError: unknown = null;

  for (let i = 0; i < candidateModels.length; i++) {
    const currentModelId = candidateModels[i];
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        signal: AbortSignal.timeout(policy.timeoutMs),
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://stockmind.app',
          'X-Title': 'StockMind Quant Lab',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: currentModelId,
          messages: [{ role: 'user', content: prompt }],
          ...(selectedModel.supportedParameters?.includes('temperature') ? { temperature: 0.5 } : {}),
          max_tokens: Math.max(policy.committeeMaxTokens, 3500),
          response_format: selectedModel.id === currentModelId && selectedModel.supportedParameters?.includes('structured_outputs')
            ? { type: 'json_schema', json_schema: { name: 'committee_report', strict: true, schema: COMMITTEE_RESPONSE_SCHEMA } }
            : { type: 'json_object' },
        }),
      });

      const rawText = await readOpenRouterResponse(res);
      const parsed = parseCommitteeResponse(rawText);

      const agents: CommitteeAgent[] = COMMITTEE_AGENTS_CONFIG.map((cfg) => {
        const fromLlm = parsed.agents.find((a: any) => a.id === cfg.id)!;
        return {
          ...cfg,
          verdict: fromLlm.verdict,
          score: fromLlm.score,
          speech: fromLlm.speech,
          keyArguments: fromLlm.keyArguments,
        };
      });

      return {
        symbol,
        companyName: stockQuote?.name || symbol,
        consensusVerdict: parsed.consensusVerdict,
        consensusScore: parsed.consensusScore,
        consensusSummary: parsed.consensusSummary,
        agents,
        generatedAt: new Date().toISOString(),
        isLiveLLM: true,
      };
    } catch (err: any) {
      lastError = err;
      if (err instanceof OpenRouterError && (
        err.code === 'AI_PROVIDER_UNAUTHORIZED' ||
        err.code === 'AI_KEY_REQUIRED' ||
        err.code === 'AI_DAILY_FREE_LIMIT_REACHED' ||
        err.code === 'AI_CREDITS_REQUIRED'
      )) {
        throw err;
      }
      if (i < candidateModels.length - 1) {
        console.warn(`Committee model ${currentModelId} failed (${err?.message || err}), trying fallback ${candidateModels[i + 1]}...`);
        continue;
      }
    }
  }

  if (lastError instanceof OpenRouterError) throw lastError;
  throw lastError instanceof Error ? lastError : new Error('Komite analizi alınamadı. Lütfen tekrar deneyin.');
}

const AGENT_VERDICTS = ['AL', 'GÜÇLÜ AL', 'TUT', 'SAT', 'TEMKİNLİ'];
const CONSENSUS_VERDICTS = ['GÜÇLÜ AL', 'AL', 'TUT / DENGELİ', 'DİKKATLİ / SAT'];
const COMMITTEE_RESPONSE_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['consensusVerdict', 'consensusScore', 'consensusSummary', 'agents'],
  properties: {
    consensusVerdict: { type: 'string', enum: CONSENSUS_VERDICTS },
    consensusScore: { type: 'number', minimum: 0, maximum: 10 },
    consensusSummary: { type: 'string' },
    agents: { type: 'array', items: {
      type: 'object', additionalProperties: false,
      required: ['id', 'verdict', 'score', 'speech', 'keyArguments'],
      properties: {
        id: { type: 'string', enum: COMMITTEE_AGENTS_CONFIG.map(agent => agent.id) },
        verdict: { type: 'string', enum: AGENT_VERDICTS },
        score: { type: 'number', minimum: 0, maximum: 10 },
        speech: { type: 'string' }, keyArguments: { type: 'array', items: { type: 'string' } },
      },
    } },
  },
};

/** Validate provider output without extracting JSON with regex or inventing missing analysis. */
export function parseCommitteeResponse(rawText: string): Pick<CommitteeReport, 'consensusVerdict' | 'consensusScore' | 'consensusSummary'> & { agents: Array<Pick<CommitteeAgent, 'id' | 'verdict' | 'score' | 'speech' | 'keyArguments'>> } {
  const parsed = JSON.parse(rawText);
  const score = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 10;
  const text = (value: unknown) => typeof value === 'string' && value.trim().length > 0;
  if (!parsed || !CONSENSUS_VERDICTS.includes(parsed.consensusVerdict) || !score(parsed.consensusScore) || !text(parsed.consensusSummary) ||
      !Array.isArray(parsed.agents) || parsed.agents.length !== COMMITTEE_AGENTS_CONFIG.length ||
      !COMMITTEE_AGENTS_CONFIG.every(config => parsed.agents.filter((agent: any) => agent?.id === config.id).length === 1) ||
      !parsed.agents.every((agent: any) => AGENT_VERDICTS.includes(agent.verdict) && score(agent.score) && text(agent.speech) &&
        Array.isArray(agent.keyArguments) && agent.keyArguments.length > 0 && agent.keyArguments.every(text))) {
    throw new Error('Komite modeli eksik veya geçersiz analiz döndürdü. Tekrar deneyin.');
  }
  return parsed;
}
