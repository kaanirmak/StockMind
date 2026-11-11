import type { NewsArticle } from '@/app/api/news/route';

export const NEWS_CLIENT_SNAPSHOT_KEY = 'stockmind.news.last_good.v1';
export const NEWS_SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_ARTICLES_PER_CATEGORY = 60;

export interface StoredNewsCategorySnapshot {
  category: string;
  savedAt: string;
  articles: NewsArticle[];
}

export type StoredNewsSnapshotMap = Record<string, StoredNewsCategorySnapshot>;

function isValidArticle(item: unknown): item is NewsArticle {
  if (!item || typeof item !== 'object') return false;
  const obj = item as Partial<NewsArticle>;
  return (
    typeof obj.id === 'string' &&
    obj.id.length > 0 &&
    typeof obj.title === 'string' &&
    obj.title.trim().length > 0 &&
    typeof obj.url === 'string' &&
    /^https?:\/\//.test(obj.url) &&
    typeof obj.publishedAt === 'string' &&
    !Number.isNaN(Date.parse(obj.publishedAt))
  );
}

export function sanitizeNewsSnapshotMap(
  raw: unknown,
  nowMs: number = Date.now()
): StoredNewsSnapshotMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const map: StoredNewsSnapshotMap = {};

  for (const [cat, entry] of Object.entries(raw as Record<string, unknown>)) {
    if (!entry || typeof entry !== 'object') continue;
    const obj = entry as Partial<StoredNewsCategorySnapshot>;
    if (typeof obj.savedAt !== 'string' || !Array.isArray(obj.articles)) continue;
    const savedMs = Date.parse(obj.savedAt);
    if (!Number.isFinite(savedMs) || nowMs - savedMs > NEWS_SNAPSHOT_MAX_AGE_MS || savedMs > nowMs + 60_000) {
      continue;
    }
    const validArticles = obj.articles.filter(isValidArticle).slice(0, MAX_ARTICLES_PER_CATEGORY);
    if (validArticles.length > 0) {
      map[cat] = {
        category: cat,
        savedAt: obj.savedAt,
        articles: validArticles,
      };
    }
  }

  return map;
}

export function upsertNewsCategorySnapshot(
  existingRaw: unknown,
  category: string,
  articles: NewsArticle[],
  savedAt: string = new Date().toISOString(),
  nowMs: number = Date.now()
): StoredNewsSnapshotMap {
  const map = sanitizeNewsSnapshotMap(existingRaw, nowMs);
  const validArticles = articles.filter(isValidArticle).slice(0, MAX_ARTICLES_PER_CATEGORY);
  if (validArticles.length === 0) return map;

  map[category] = {
    category,
    savedAt,
    articles: validArticles,
  };
  return map;
}

export function getNewsCategorySnapshot(
  storedRaw: unknown,
  category: string,
  nowMs: number = Date.now()
): StoredNewsCategorySnapshot | null {
  const map = sanitizeNewsSnapshotMap(storedRaw, nowMs);
  return map[category] ?? null;
}
