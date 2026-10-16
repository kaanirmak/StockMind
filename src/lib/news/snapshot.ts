import { NEWS_FEEDS } from './feeds';
import type { NewsArticle } from '@/app/api/news/route';

export type CollectedArticle = NewsArticle & { collectedAt: string };
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

// The snapshot contains only general feeds. No portfolio queries are sent to its host.
export function readNewsSnapshot(value: unknown, now = Date.now()): CollectedArticle[] {
  if (!value || typeof value !== 'object' || !('data' in value) || !Array.isArray(value.data)) return [];
  return value.data.filter((article): article is CollectedArticle => {
    if (!article || typeof article !== 'object') return false;
    const a = article as Record<string, unknown>;
    const collected = typeof a.collectedAt === 'string' ? Date.parse(a.collectedAt) : NaN;
    return NEWS_FEEDS.some(feed => feed.id === a.feedId && feed.name === a.source) && Number.isFinite(collected) && collected <= now + 60_000 && now - collected < MAX_AGE_MS &&
      ['BIST', 'KAP', 'GLOBAL', 'MACRO'].includes(String(a.category)) &&
      ['id', 'title', 'summary', 'source', 'url', 'publishedAt'].every(key => typeof a[key] === 'string') &&
      /^https?:\/\//.test(String(a.url)) && Number.isFinite(Date.parse(String(a.publishedAt))) &&
      ['positive', 'negative', 'neutral'].includes(String(a.sentiment));
  });
}

export async function fetchNewsSnapshot(): Promise<CollectedArticle[]> {
  try {
    const response = await fetch('https://raw.githubusercontent.com/kaanirmak/StockMind/news-data/news.json', {
      cache: 'no-store', signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return [];
    return readNewsSnapshot(await response.json());
  } catch (error) {
    console.error(JSON.stringify({ event: 'news_snapshot_failed', error: error instanceof Error ? error.name : 'UnknownError' }));
    return [];
  }
}
