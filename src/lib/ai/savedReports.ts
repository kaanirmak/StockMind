import { resolveSessionScopeKey } from '@/lib/auth/sessionBoundary';

export type SavedAnalysisKind = 'ai_chat' | 'investment_committee';

export interface SavedAnalysisReport<TCommittee = unknown> {
  id: string;
  title: string;
  symbol: string;
  kind: SavedAnalysisKind;
  dataDate: string;
  savedAt: string;
  model: string;
  assumptions: string[];
  verifiedSources: string[];
  missingDataNotes: string[];
  summary: string;
  contentMarkdown: string;
  committeeSnapshot?: TCommittee;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const SAVED_REPORTS_KEY_PREFIX = 'stockmind_saved_analysis_reports_v1';
const MAX_SAVED_REPORTS = 80;

export function getSavedReportsStorageKey(userId?: string | null): string {
  return `${SAVED_REPORTS_KEY_PREFIX}_${resolveSessionScopeKey(userId)}`;
}

function defaultStorage(): StorageLike | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  return window.localStorage;
}

export function listSavedAnalysisReports<TCommittee = unknown>(
  storage: StorageLike | null = defaultStorage(),
  userId?: string | null
): SavedAnalysisReport<TCommittee>[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(getSavedReportsStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is SavedAnalysisReport<TCommittee> =>
        Boolean(
          entry &&
            typeof entry === 'object' &&
            typeof entry.id === 'string' &&
            typeof entry.symbol === 'string' &&
            typeof entry.dataDate === 'string' &&
            typeof entry.model === 'string' &&
            Array.isArray(entry.assumptions)
        )
    );
  } catch {
    return [];
  }
}

export function saveAnalysisReport<TCommittee = unknown>(
  input: Omit<SavedAnalysisReport<TCommittee>, 'id' | 'savedAt'> & {
    id?: string;
    savedAt?: string;
  },
  storage: StorageLike | null = defaultStorage(),
  userId?: string | null
): SavedAnalysisReport<TCommittee> {
  const existing = listSavedAnalysisReports<TCommittee>(storage, userId);
  const nowIso = input.savedAt || new Date().toISOString();
  const id =
    input.id?.trim() ||
    `rep-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const record: SavedAnalysisReport<TCommittee> = {
    ...input,
    id,
    savedAt: nowIso,
    symbol: input.symbol.trim().toUpperCase() || 'GENEL',
    assumptions: input.assumptions.map((a) => a.trim()).filter(Boolean),
    verifiedSources: input.verifiedSources.map((s) => s.trim()).filter(Boolean),
    missingDataNotes: input.missingDataNotes.map((m) => m.trim()).filter(Boolean),
  };

  const next = [record, ...existing.filter((item) => item.id !== id)].slice(0, MAX_SAVED_REPORTS);
  if (storage) {
    try {
      storage.setItem(getSavedReportsStorageKey(userId), JSON.stringify(next));
    } catch {
      // Ignore storage quota overflow
    }
  }
  return record;
}

export function getSavedAnalysisReportById<TCommittee = unknown>(
  id: string,
  storage: StorageLike | null = defaultStorage(),
  userId?: string | null
): SavedAnalysisReport<TCommittee> | null {
  const all = listSavedAnalysisReports<TCommittee>(storage, userId);
  return all.find((item) => item.id === id) ?? null;
}

export function deleteSavedAnalysisReport(
  id: string,
  storage: StorageLike | null = defaultStorage(),
  userId?: string | null
): SavedAnalysisReport[] {
  const all = listSavedAnalysisReports(storage, userId);
  const next = all.filter((item) => item.id !== id);
  if (storage) {
    try {
      storage.setItem(getSavedReportsStorageKey(userId), JSON.stringify(next));
    } catch {
      // Ignore storage error
    }
  }
  return next;
}

export function buildSavedReportFromChatMessage(params: {
  message: {
    id: string;
    content: string;
    createdAt: string;
    asOf?: string;
    sourceScope?: 'live_market_data' | 'unverified_general_knowledge';
    provenance?: {
      collectedAt?: string;
      liveSymbols?: string[];
      missingSymbols?: string[];
    };
  };
  symbol?: string;
  model: string;
  assumptions?: string[];
  question?: string;
}): Omit<SavedAnalysisReport, 'id' | 'savedAt'> {
  const verifiedSymbols = params.message.provenance?.liveSymbols ?? [];
  const missingSymbols = params.message.provenance?.missingSymbols ?? [];
  const symbol =
    params.symbol?.trim().toUpperCase() ||
    verifiedSymbols[0] ||
    'GENEL';
  const dataDate =
    params.message.asOf ||
    params.message.provenance?.collectedAt ||
    params.message.createdAt;

  const baseAssumptions = [...(params.assumptions ?? [])];
  if (params.message.sourceScope === 'live_market_data') {
    baseAssumptions.push('Yanıt doğrulanan piyasa/portföy verisiyle beslendi.');
  } else if (params.message.sourceScope === 'unverified_general_knowledge') {
    baseAssumptions.push('Canlı piyasa verisi bağlanmadı; genel model yorumu üretildi.');
  }
  if (baseAssumptions.length === 0) {
    baseAssumptions.push('Oturumdaki seçili model ve sağlanan bağlam parametreleri esas alındı.');
  }

  const summary =
    params.question?.trim() ||
    params.message.content.split('\n').find((line) => line.trim().length > 0)?.slice(0, 140) ||
    `${symbol} AI Analizi`;

  return {
    title: `${symbol} — AI Analiz Raporu`,
    symbol,
    kind: 'ai_chat',
    dataDate,
    model: params.model,
    assumptions: Array.from(new Set(baseAssumptions)),
    verifiedSources: verifiedSymbols,
    missingDataNotes: missingSymbols.map((m) => `Eksik fiyat/veri: ${m}`),
    summary,
    contentMarkdown: params.message.content,
  };
}

export function buildSavedReportFromCommittee<TCommittee extends {
  symbol: string;
  companyName: string;
  consensusVerdict: string;
  consensusScore: number;
  consensusSummary: string;
  generatedAt: string;
  isLiveLLM: boolean;
}>(params: {
  report: TCommittee;
  model?: string;
  assumptions?: string[];
}): Omit<SavedAnalysisReport<TCommittee>, 'id' | 'savedAt'> {
  const { report } = params;
  const assumptions = [
    report.isLiveLLM
      ? 'Sunucudan doğrulanan kotasyon + çoklu AI komite perspektifi kullanıldı.'
      : 'Finansal tablo/LLM canlı bağlamı olmadan örnek komite senaryosu oluşturuldu.',
    ...(params.assumptions ?? []),
  ];

  return {
    title: `${report.symbol} — Yatırım Komitesi (${report.consensusVerdict})`,
    symbol: report.symbol.toUpperCase(),
    kind: 'investment_committee',
    dataDate: report.generatedAt,
    model: params.model || (report.isLiveLLM ? 'Çoklu AI Komite (4 Perspektif)' : 'Simülasyon Şablonu'),
    assumptions,
    verifiedSources: [report.symbol.toUpperCase()],
    missingDataNotes: [],
    summary: report.consensusSummary,
    contentMarkdown: `**${report.symbol} (${report.companyName}) — ${report.consensusVerdict} (${report.consensusScore.toFixed(1)}/10)**\n\n${report.consensusSummary}`,
    committeeSnapshot: report,
  };
}

