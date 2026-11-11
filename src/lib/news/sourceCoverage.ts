import type { NewsFeed } from '@/lib/news/feeds';

export type NewsSourceStatus = 'live' | 'snapshot' | 'stale_fallback' | 'failed';

export interface NewsSourceCoverageItem {
  feedId: string;
  sourceName: string;
  categories: string[];
  status: NewsSourceStatus;
  lastSuccessAt: string | null;
  articleCount: number;
  errorReason: string | null;
}

export interface NewsCoverageSummary {
  totalSources: number;
  healthySources: number;
  failedSources: number;
  sources: NewsSourceCoverageItem[];
}

export function classifyNewsFeedError(err: unknown): string {
  const obj = err && typeof err === 'object' ? (err as { name?: unknown; message?: unknown }) : null;
  const name = typeof obj?.name === 'string' ? obj.name : '';
  const msg = typeof obj?.message === 'string' ? obj.message : typeof err === 'string' ? err : '';

  if (name === 'TimeoutError' || name === 'AbortError' || /timeout|timed out|abort/i.test(msg)) {
    return 'Kaynak zaman aşımına uğradı';
  }
  const httpMatch = msg.match(/HTTP\s+(\d{3})/i);
  if (httpMatch) {
    return `HTTP ${httpMatch[1]} hatası`;
  }
  if (/did not return RSS/i.test(msg)) {
    return 'Geçerli RSS akışı döndürmedi';
  }
  if (/contained no valid articles/i.test(msg)) {
    return 'Akışta geçerli haber bulunamadı';
  }
  if (/fetch failed|network|econn|enotfound/i.test(msg)) {
    return 'Ağ bağlantı hatası';
  }
  return msg.trim() || 'Kaynak yanıt vermedi';
}

export function buildNewsSourceCoverageReport(params: {
  feeds: readonly NewsFeed[];
  freshFeedIds: ReadonlySet<string>;
  liveResultsByFeedId: ReadonlyMap<string, { ok: boolean; count?: number; errorReason?: string }>;
  snapshotArticlesByFeedId: ReadonlyMap<string, { count: number; latestCollectedAt: string | null }>;
  nowIso?: string;
}): NewsCoverageSummary {
  const nowIso = params.nowIso || new Date().toISOString();
  const sources: NewsSourceCoverageItem[] = [];

  for (const feed of params.feeds) {
    const categories = [...feed.categories];
    const snapInfo = params.snapshotArticlesByFeedId.get(feed.id);

    if (params.freshFeedIds.has(feed.id)) {
      sources.push({
        feedId: feed.id,
        sourceName: feed.name,
        categories,
        status: 'snapshot',
        lastSuccessAt: snapInfo?.latestCollectedAt ?? null,
        articleCount: snapInfo?.count ?? 0,
        errorReason: null,
      });
      continue;
    }

    const liveRes = params.liveResultsByFeedId.get(feed.id);
    if (liveRes?.ok) {
      sources.push({
        feedId: feed.id,
        sourceName: feed.name,
        categories,
        status: 'live',
        lastSuccessAt: nowIso,
        articleCount: liveRes.count ?? 0,
        errorReason: null,
      });
      continue;
    }

    const errorReason = liveRes?.errorReason || 'Kaynak yanıt vermedi';
    if (snapInfo && snapInfo.count > 0) {
      sources.push({
        feedId: feed.id,
        sourceName: feed.name,
        categories,
        status: 'stale_fallback',
        lastSuccessAt: snapInfo.latestCollectedAt,
        articleCount: snapInfo.count,
        errorReason,
      });
      continue;
    }

    sources.push({
      feedId: feed.id,
      sourceName: feed.name,
      categories,
      status: 'failed',
      lastSuccessAt: null,
      articleCount: 0,
      errorReason,
    });
  }

  const healthySources = sources.filter(
    (s) => s.status === 'live' || s.status === 'snapshot' || s.status === 'stale_fallback'
  ).length;
  const failedSources = sources.length - healthySources;

  return {
    totalSources: sources.length,
    healthySources,
    failedSources,
    sources,
  };
}
