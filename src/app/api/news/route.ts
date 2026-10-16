import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { rssPlainText } from '@/lib/news/rssText';
import { fetchNewsSnapshot } from '@/lib/news/snapshot';
import { analyzeNewsSentiment } from '@/lib/news/sentiment';
import { NEWS_FEEDS, feedCategory, type NewsFeed } from '@/lib/news/feeds';

export const dynamic = 'force-dynamic';

export interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  category: 'BIST' | 'KAP' | 'GLOBAL' | 'MACRO' | 'PORTFOLIO';
  sentiment: 'positive' | 'neutral' | 'negative';
  source: string;
  url: string;
  publishedAt: string;
  relatedSymbols?: string[];
  feedId?: string;
  sentimentReason?: string;
}

const DEFAULT_SYMBOLS_TO_TRACK = [
  'THYAO', 'ASELS', 'GARAN', 'EREGL', 'KCHOL', 'BIMAS', 'AKBNK', 'SISE',
  'TUPRS', 'SAHOL', 'FROTO', 'YKBNK', 'ISCTR', 'TCELL', 'PETKM', 'KONTR',
  'ASTOR', 'SASA', 'HEKTS', 'ENKAI', 'ARCLK', 'PGSUS', 'TOASO', 'MGROS',
  'AAPL', 'NVDA', 'MSFT', 'TSLA', 'AMZN', 'GOOGL', 'META'
];

// Function to fetch and parse real live RSS financial news
async function fetchLiveNews(
  feed: NewsFeed,
  extraSymbolsToCheck: string[] = []
): Promise<NewsArticle[]> {
  const started = Date.now();
  let stage = 'headers';
  let status: number | undefined;
  let contentType: string | null = null;
  try {
    const rssUrl = feed.url;
    const res = await fetch(rssUrl, {
      headers: {
        Accept: 'application/rss+xml, application/xml',
      },
      signal: AbortSignal.timeout(8000),
      cache: 'no-store', // Isolate upstream access from the OpenNext incremental cache.
    });

    status = res.status;
    contentType = res.headers?.get('content-type') || null;
    stage = 'body';
    if (!res.ok) throw new Error(`RSS upstream HTTP ${res.status}`);

    const xmlText = await res.text();
    if (!/<rss\b/i.test(xmlText)) throw new Error('News upstream did not return RSS');
    stage = 'parse';
    const items: NewsArticle[] = [];

    // Parse XML items using regex
    const itemMatches = xmlText.matchAll(/<item>([\s\S]*?)<\/item>/g);

    let idx = 0;
    for (const match of itemMatches) {
      idx++;
      const itemContent = match[1];

      const titleMatch = itemContent.match(/<title>([\s\S]*?)<\/title>/);
      const linkMatch = itemContent.match(/<link>([\s\S]*?)<\/link>/);
      const pubDateMatch = itemContent.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
      const descMatch = itemContent.match(/<description>([\s\S]*?)<\/description>/);

      if (titleMatch) {
        const rawTitle = rssPlainText(titleMatch[1]);
        const source = feed.name;

        // Clean HTML description
        let rawSummary = descMatch ? rssPlainText(descMatch[1]) : '';
        if (!rawSummary || rawSummary === rawTitle) {
          rawSummary = `${rawTitle}. Kaynak: ${source}`;
        }

        const category = feedCategory(feed.id, rawTitle, rawSummary);

        // Extract related symbols
        const relatedSymbolsSet = new Set<string>();
        const allSymbolsToCheck = Array.from(new Set([...DEFAULT_SYMBOLS_TO_TRACK, ...extraSymbolsToCheck]));

        const upperText = `${rawTitle} ${rawSummary}`.toUpperCase();

        for (const sym of allSymbolsToCheck) {
          if (!sym) continue;
          const cleanSym = sym.toUpperCase().trim();
          // Regex check for whole word symbol or symbol mentions
          const regex = new RegExp(`(^|[^A-Z0-9])${cleanSym}([^A-Z0-9]|$)`, 'i');
          if (regex.test(upperText) || upperText.includes(`$${cleanSym}`) || upperText.includes(`#${cleanSym}`)) {
            relatedSymbolsSet.add(cleanSym);
          }
        }

        const { sentiment, reason: sentimentReason } = analyzeNewsSentiment(rawTitle, rawSummary);

        const articleLink = linkMatch ? rssPlainText(linkMatch[1]) : '';
        const date = new Date(pubDateMatch?.[1] || '');
        if (!/^https?:\/\//.test(articleLink) || !Number.isFinite(date.getTime())) continue;
        const pubDateStr = date.toISOString();

        // Generate SHA-256 unique ID based on full title, link and category
        const uniqueHash = crypto
          .createHash('sha256')
          .update(`${rawTitle}_${articleLink}_${pubDateStr}_${category}_${idx}`)
          .digest('hex')
          .substring(0, 20);

        items.push({
          id: `news-${uniqueHash}`,
          title: rawTitle,
          summary: rawSummary,
          category,
          feedId: feed.id,
          sentiment,
          sentimentReason,
          source,
          url: articleLink,
          publishedAt: pubDateStr,
          relatedSymbols: relatedSymbolsSet.size > 0 ? Array.from(relatedSymbolsSet) : undefined,
        });
      }

      if (items.length >= 15) break;
    }

    if (!items.length) throw new Error('RSS contained no valid articles');
    return items;
  } catch (error) {
    console.error(JSON.stringify({ event: 'news_upstream_failed', provider: feed.id, stage, status, contentType, durationMs: Date.now() - started, error: error instanceof Error ? error.name : 'UnknownError' }));
    throw error;
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') as 'BIST' | 'KAP' | 'GLOBAL' | 'MACRO' | 'PORTFOLIO' | 'ALL' | null;
    const symbol = searchParams.get('symbol');
    const symbolsParam = searchParams.get('symbols'); // Comma-separated list of symbols (e.g. from user's portfolio)

    const portfolioSymbols = symbolsParam
      ? symbolsParam.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean)
      : [];

    if (category === 'KAP') {
      return NextResponse.json({ success: true, count: 0, data: [], warning: 'Resmî KAP bildirim kaynağı henüz bağlı değil.' });
    }
    if (category === 'PORTFOLIO' && portfolioSymbols.length === 0) {
      return NextResponse.json({ success: true, count: 0, data: [] });
    }
    const feeds = NEWS_FEEDS.filter(feed => !category || category === 'ALL' || category === 'PORTFOLIO' ||
      (feed.categories as readonly string[]).includes(category));
    const relevant = (article: NewsArticle) => {
      if (category === 'PORTFOLIO') {
        const text = `${article.title} ${article.summary}`.toUpperCase();
        return portfolioSymbols.some(sym => text.includes(sym));
      }
      return !category || category === 'ALL' || article.category === category;
    };
    const snapshot = await fetchNewsSnapshot();
    const snapshotFresh = feeds.length > 0 && feeds.every(feed => snapshot.some(article =>
      article.feedId === feed.id && Date.now() - Date.parse(article.collectedAt) < 30 * 60 * 1000));
    const results = snapshotFresh ? [] : await Promise.allSettled(feeds.map(feed => fetchLiveNews(feed, portfolioSymbols)));
    const failedFeeds = results.filter(result => result.status === 'rejected').length;
    const failedIds = new Set(feeds.filter((_, index) => results[index]?.status === 'rejected').map(feed => feed.id));
    const fallback = snapshot.filter(article => snapshotFresh || failedIds.has(article.feedId as NewsFeed['id']));
    if (feeds.length > 0 && failedFeeds === feeds.length && fallback.length === 0) {
      return NextResponse.json({ success: false, error: 'Haber kaynaklarına şu anda ulaşılamıyor. Lütfen tekrar deneyin.', data: [] }, { status: 503 });
    }
    let allNews = [...results.flatMap(result => result.status === 'fulfilled' ? result.value : []), ...fallback].filter(relevant);
    const stale = !snapshotFresh && fallback.length > 0;
    const snapshotForCategory = fallback.filter(relevant);

    // Sort by publication date newest first
    allNews.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

    // Filter by single symbol if explicitly requested
    if (symbol) {
      const symUpper = symbol.toUpperCase();
      const symClean = symbol.replace('_', ' ').toUpperCase();
      const matched = allNews.filter(
        (n) =>
          n.relatedSymbols?.includes(symUpper) ||
          n.title.toUpperCase().includes(symUpper) ||
          n.title.toUpperCase().includes(symClean) ||
          n.summary.toUpperCase().includes(symUpper) ||
          n.summary.toUpperCase().includes(symClean)
      );
      allNews = matched;
    }

    // Deduplicate by normalized title and unique id
    const seenTitles = new Set<string>();
    const seenIds = new Set<string>();

    const uniqueNews = allNews.filter((n) => {
      if (seenIds.has(n.id)) return false;
      const normTitle = n.title.toLowerCase().replace(/[^a-z0-9ğüşıöç]/g, '').trim();
      if (seenTitles.has(normTitle)) return false;
      seenTitles.add(normTitle);
      seenIds.add(n.id);
      return true;
    });

    return NextResponse.json({
      success: true,
      count: uniqueNews.length,
      stale,
      collectedAt: snapshotForCategory.length ? snapshotForCategory.map(a => a.collectedAt).sort()[0] : undefined,
      partial: failedFeeds > 0,
      warning: stale ? 'Canlı kaynaklara ulaşılamadı; son başarılı haberler gösteriliyor.' : failedFeeds > 0 ? 'Bazı haber kaynakları yanıt vermedi; ulaşılabilen haberler gösteriliyor.' : undefined,
      data: uniqueNews.map(article => {
        const analysis = analyzeNewsSentiment(article.title, article.summary);
        return { ...article, sentiment: analysis.sentiment, sentimentReason: analysis.reason };
      }),
    });
  } catch (error) {
    console.error('Live News API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Canlı haberler alınamadı' },
      { status: 500 }
    );
  }
}
