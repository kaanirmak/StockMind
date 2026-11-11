import {
  matchNewsAssetIdentity,
  normalizeNewsText,
  type NewsAssetIdentity,
  type NewsAssetMatchResult,
} from './symbolMatch';

export interface NewsMatchDetail {
  symbol: string;
  exchange?: string;
  matchedBy: Exclude<NewsAssetMatchResult['matchedBy'], null>;
  matchedTerm?: string;
  reasonText: string;
}

export interface RankedNewsArticle<T> {
  article: T;
  matchedSymbols: string[];
  matchDetails: NewsMatchDetail[];
  event?: string;
  eventTypeLabel: string;
  date: number;
  priority: number;
  connectionSummary: string | null;
}

const events: { label: string; pattern: RegExp }[] = [
  { label: 'Faiz kararı', pattern: /\b(?:faiz karari|faizi sabit tuttu|politika faizini|rate decision|policy rate)\b/ },
  { label: 'Enflasyon verisi', pattern: /\b(?:enflasyon(?:u|un)? (?:aciklandi|verisi|rakamlari)|tufe|cpi report|inflation data)\b/ },
  { label: 'Şirket bilançosu', pattern: /\b(?:bilancosunu acikladi|finansal sonuclar|ceyrek kari|earnings report|quarterly results)\b/ },
  { label: 'Temettü veya sermaye işlemi', pattern: /\b(?:temettu|sermaye artirimi|pay geri alim|dividend|share buyback)\b/ },
  { label: 'Şirket işlemi veya sözleşme', pattern: /\b(?:sozlesme imzaladi|yeni is iliskisi|satin alma anlasmasi|merger agreement|contract award)\b/ },
  { label: 'Kredi notu kararı', pattern: /\b(?:kredi notunu|not gorunumunu|rating downgrade|rating upgrade)\b/ },
];

export function formatNewsMatchReason(result: Pick<NewsAssetMatchResult, 'symbol' | 'exchange' | 'matchedBy' | 'matchedTerm'>): string {
  switch (result.matchedBy) {
    case 'exchange_ticker':
      return `Borsa kodu (${result.matchedTerm || (result.exchange ? `${result.exchange}:${result.symbol}` : result.symbol)}) geçti`;
    case 'cashtag':
      return `Sembol etiketi (${result.matchedTerm || `$${result.symbol}`}) geçti`;
    case 'company_alias':
      return `Şirket adı (${result.matchedTerm || result.symbol}) metinde geçti`;
    case 'ticker':
    default:
      return `Varlık kodu (${result.matchedTerm || result.symbol}) başlık veya özette geçti`;
  }
}

export function rankNews<
  T extends {
    title: string;
    summary: string;
    publishedAt: string;
    category?: string | null;
    source?: string | null;
  },
>(
  articles: readonly T[],
  portfolioIdentities: readonly (NewsAssetIdentity | string)[],
  importantFirst: boolean,
  now = Date.now(),
): RankedNewsArticle<T>[] {
  return articles.map(article => {
    const date = Date.parse(article.publishedAt);
    const recent = date <= now && now - date <= 48 * 60 * 60 * 1000;
    const text = `${article.title} ${article.summary}`;
    const matchDetails: NewsMatchDetail[] = [];
    const seenSymbols = new Set<string>();

    for (const identity of portfolioIdentities) {
      const result = matchNewsAssetIdentity(text, identity, {
        category: article.category,
        source: article.source,
      });
      if (!result.matched || !result.matchedBy || seenSymbols.has(result.symbol)) {
        continue;
      }
      seenSymbols.add(result.symbol);
      matchDetails.push({
        symbol: result.symbol,
        ...(result.exchange ? { exchange: result.exchange } : {}),
        matchedBy: result.matchedBy,
        ...(result.matchedTerm ? { matchedTerm: result.matchedTerm } : {}),
        reasonText: formatNewsMatchReason(result),
      });
    }

    const matchedSymbols = matchDetails.map(detail => detail.symbol);
    const title = normalizeNewsText(article.title);
    const summary = normalizeNewsText(article.summary);
    const event =
      events.find(({ pattern }) => pattern.test(title))?.label ??
      events.find(({ pattern }) => pattern.test(summary))?.label;
    const eventTypeLabel =
      event ?? (article.category === 'KAP' ? 'KAP bildirimi' : 'Şirket / piyasa haberi');
    const priority = importantFirst && recent ? (matchedSymbols.length > 0 ? 2 : 0) + (event ? 1 : 0) : 0;

    const connectionSummary =
      matchDetails.length > 0
        ? `Portföy varlığı: ${matchDetails.map(d => (d.exchange ? `${d.symbol} (${d.exchange})` : d.symbol)).join(', ')} • ${matchDetails[0].reasonText} • Olay: ${eventTypeLabel}`
        : null;

    return {
      article,
      matchedSymbols,
      matchDetails,
      event,
      eventTypeLabel,
      date,
      priority,
      connectionSummary,
    };
  }).sort((a, b) => b.priority - a.priority || b.date - a.date);
}
