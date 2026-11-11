export interface NewsAnalysisContext {
  title: string;
  summary: string;
  source: string;
  publishedAt?: string;
  url?: string;
  relatedSymbols?: string[];
}

function cleanSnippet(value: unknown, maxLen: number): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLen);
}

/**
 * Builds an AI assistant link preloaded with verified article metadata (title, summary, source)
 * and an explicit portfolio context choice (off by default unless explicitly opted in).
 */
export function buildNewsAnalysisHref(
  article: {
    title: string;
    summary?: string;
    source: string;
    publishedAt?: string;
    url?: string;
    relatedSymbols?: string[];
  },
  includePortfolio = false
): string {
  const params = new URLSearchParams();
  params.set('mode', 'news');
  params.set('newsTitle', cleanSnippet(article.title, 260));
  if (article.summary) {
    params.set('newsSummary', cleanSnippet(article.summary, 700));
  }
  params.set('newsSource', cleanSnippet(article.source || 'Bilinmeyen Kaynak', 100));
  if (article.publishedAt) {
    params.set('newsPublishedAt', cleanSnippet(article.publishedAt, 64));
  }
  if (article.relatedSymbols && article.relatedSymbols.length > 0) {
    params.set('newsSymbols', article.relatedSymbols.slice(0, 6).join(','));
  }
  params.set('includePortfolio', includePortfolio ? '1' : '0');
  return `/ai-assistant?${params.toString()}`;
}

export function parseNewsAnalysisSearchParams(params: {
  get(key: string): string | null;
}): { news: NewsAnalysisContext; includePortfolio: boolean } | null {
  if (params.get('mode') !== 'news') return null;
  const title = cleanSnippet(params.get('newsTitle'), 260);
  const source = cleanSnippet(params.get('newsSource'), 100);
  if (!title || !source) return null;

  const symbolsRaw = params.get('newsSymbols') || '';
  const relatedSymbols = symbolsRaw
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter((s) => /^[A-Z0-9._:=^-]{1,20}$/.test(s))
    .slice(0, 6);

  const includeParam = params.get('includePortfolio');
  return {
    news: {
      title,
      summary: cleanSnippet(params.get('newsSummary'), 700),
      source,
      publishedAt: cleanSnippet(params.get('newsPublishedAt'), 64) || undefined,
      relatedSymbols: relatedSymbols.length > 0 ? relatedSymbols : undefined,
    },
    includePortfolio: includeParam === '1' || includeParam === 'true',
  };
}

/**
 * Validates incoming structured news context payload from the client on `/api/ai/chat`.
 */
export function sanitizeNewsContextPayload(raw: unknown): NewsAnalysisContext | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const record = raw as Record<string, unknown>;
  const title = cleanSnippet(record.title, 300);
  const source = cleanSnippet(record.source, 120);
  if (!title || !source) return undefined;

  const summary = cleanSnippet(record.summary, 1500);
  const publishedAt = cleanSnippet(record.publishedAt, 64) || undefined;
  const url =
    typeof record.url === 'string' && /^https?:\/\//i.test(record.url.trim())
      ? record.url.trim().slice(0, 400)
      : undefined;
  const relatedSymbols = Array.isArray(record.relatedSymbols)
    ? record.relatedSymbols
        .filter((s): s is string => typeof s === 'string' && /^[A-Za-z0-9._:=^-]{1,20}$/.test(s.trim()))
        .map((s) => s.trim().toUpperCase())
        .slice(0, 6)
    : undefined;

  return {
    title,
    summary,
    source,
    publishedAt,
    url,
    relatedSymbols: relatedSymbols && relatedSymbols.length > 0 ? relatedSymbols : undefined,
  };
}

export function buildDefaultNewsQuestion(news: NewsAnalysisContext, includePortfolio: boolean): string {
  const scopePart = includePortfolio
    ? 'Seçili portföy bağlamımı dikkate alarak olası pozisyon etkisini, riskleri ve belirsizlikleri açıkla.'
    : 'Genel piyasa açısından olası etkilerini, dayanaklarını ve belirsizliklerini açıkla.';
  return `"${news.title}" başlıklı (${news.source}) haberi analiz et. ${scopePart}`;
}

export function formatNewsContextForAI(news: NewsAnalysisContext): string {
  const lines: string[] = [];
  lines.push('**[SEÇİLİ HABER BAĞLAMI (KAYNAKLI ANALİZ)]:**');
  lines.push(`- Kaynak: ${news.source}`);
  lines.push(`- Başlık: ${news.title}`);
  if (news.publishedAt) {
    lines.push(`- Yayın Zamanı: ${news.publishedAt}`);
  }
  if (news.relatedSymbols && news.relatedSymbols.length > 0) {
    lines.push(`- Haberle İlişkili Semboller: ${news.relatedSymbols.join(', ')}`);
  }
  lines.push(`- Haber Özeti: ${news.summary || '(Özet paylaşılmadı; yalnızca başlık ve kaynak bilgisi mevcut.)'}`);
  lines.push('- Kural: Yorumunda haber kaynağını ve başlığını açıkça referans al; haberde yer almayan sayıları uydurma.');
  return lines.join('\n');
}
