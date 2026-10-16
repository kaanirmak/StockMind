import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { rssPlainText } from '@/lib/news/rssText';

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
}

const DEFAULT_SYMBOLS_TO_TRACK = [
  'THYAO', 'ASELS', 'GARAN', 'EREGL', 'KCHOL', 'BIMAS', 'AKBNK', 'SISE',
  'TUPRS', 'SAHOL', 'FROTO', 'YKBNK', 'ISCTR', 'TCELL', 'PETKM', 'KONTR',
  'ASTOR', 'SASA', 'HEKTS', 'ENKAI', 'ARCLK', 'PGSUS', 'TOASO', 'MGROS',
  'AAPL', 'NVDA', 'MSFT', 'TSLA', 'AMZN', 'GOOGL', 'META'
];

// Function to fetch and parse real live RSS financial news
async function fetchLiveNews(
  query: string,
  category: 'BIST' | 'KAP' | 'GLOBAL' | 'MACRO' | 'PORTFOLIO',
  extraSymbolsToCheck: string[] = []
): Promise<NewsArticle[]> {
  try {
    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=tr&gl=TR&ceid=TR:tr`;
    const res = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 180 }, // cache for 3 mins
    });

    if (!res.ok) throw new Error(`RSS upstream HTTP ${res.status}`);

    const xmlText = await res.text();
    if (!/<rss\b/i.test(xmlText)) throw new Error('News upstream did not return RSS');
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
      const sourceMatch = itemContent.match(/<source[^>]*>([\s\S]*?)<\/source>/);
      const descMatch = itemContent.match(/<description>([\s\S]*?)<\/description>/);

      if (titleMatch) {
        let rawTitle = rssPlainText(titleMatch[1]);
        let source = sourceMatch ? rssPlainText(sourceMatch[1]) : 'Finans';

        // Strip source suffix from title if present (e.g. "Haber Başlığı - Bloomberg HT")
        if (rawTitle.includes(' - ')) {
          const parts = rawTitle.split(' - ');
          if (parts.length > 1) {
            source = parts.pop() || source;
            rawTitle = parts.join(' - ');
          }
        }

        // Clean HTML description
        let rawSummary = descMatch ? rssPlainText(descMatch[1]) : '';
        if (!rawSummary || rawSummary === rawTitle) {
          rawSummary = `${rawTitle}. Kaynak: ${source}`;
        }

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

        // Simple sentiment deduction based on Turkish financial keywords
        let sentiment: 'positive' | 'neutral' | 'negative' = 'neutral';
        const lower = (rawTitle + ' ' + rawSummary).toLowerCase();
        if (
          lower.includes('rekor') ||
          lower.includes('yükseliş') ||
          lower.includes('kazandı') ||
          lower.includes('artış') ||
          lower.includes('büyüme') ||
          lower.includes('kar') ||
          lower.includes('temettü') ||
          lower.includes('anlaşma') ||
          lower.includes('sözleşme') ||
          lower.includes('zirve') ||
          lower.includes('alım') ||
          lower.includes('hedef yükseltti')
        ) {
          sentiment = 'positive';
        } else if (
          lower.includes('düşüş') ||
          lower.includes('zarar') ||
          lower.includes('kayıp') ||
          lower.includes('geriledi') ||
          lower.includes('risk') ||
          lower.includes('tedbir') ||
          lower.includes('ceza') ||
          lower.includes('gözaltı') ||
          lower.includes('satış baskısı') ||
          lower.includes('çöküş') ||
          lower.includes('taban')
        ) {
          sentiment = 'negative';
        }

        const articleLink = linkMatch ? linkMatch[1] : '#';
        const pubDateStr = pubDateMatch ? new Date(pubDateMatch[1]).toISOString() : new Date().toISOString();

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
          sentiment,
          source,
          url: articleLink,
          publishedAt: pubDateStr,
          relatedSymbols: relatedSymbolsSet.size > 0 ? Array.from(relatedSymbolsSet) : undefined,
        });
      }

      if (items.length >= 15) break;
    }

    return items;
  } catch (error) {
    console.error('Error fetching live RSS news:', error);
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

    let allNews: NewsArticle[] = [];

    type Feed = { query: string; category: NewsArticle['category']; matchPortfolio?: boolean };
    const feeds: Feed[] = [];
    if (category === 'PORTFOLIO' && portfolioSymbols.length > 0) {
      for (let i = 0; i < Math.min(portfolioSymbols.length, 20); i += 5) {
        feeds.push({ query: `(${portfolioSymbols.slice(i, i + 5).join(' OR ')}) hisse OR KAP OR borsa OR fon`, category: 'PORTFOLIO' });
      }
      feeds.push(
        { query: 'Borsa Istanbul OR BIST 100 OR BIST hisse', category: 'PORTFOLIO', matchPortfolio: true },
        { query: 'Kamuyu Aydinlatma Platformu KAP hisse sozlesme', category: 'PORTFOLIO', matchPortfolio: true },
      );
    } else {
      const generalFeeds: Feed[] = [
        { query: 'Borsa Istanbul OR BIST 100 OR BIST hisse', category: 'BIST' },
        { query: 'Kamuyu Aydinlatma Platformu KAP hisse sozlesme bilanco', category: 'KAP' },
        { query: 'Wall Street OR Nasdaq OR Fed faiz OR SP500', category: 'GLOBAL' },
        { query: 'Altin fiyati gram altin OR Merkez Bankasi OR Enflasyon', category: 'MACRO' },
      ];
      feeds.push(...generalFeeds.filter(feed => !category || category === 'ALL' || category === feed.category));
      if (symbol) feeds.push({ query: `"${symbol.replace('_', ' ').trim()}" OR "${symbol}" (hisse OR piyasa OR ekonomi OR borsa OR altin OR fon)`, category: 'BIST' });
    }

    // A slow or unavailable source must not serialize/block all the other feeds.
    const results = await Promise.allSettled(feeds.map(async feed => {
      const articles = await fetchLiveNews(feed.query, feed.category, portfolioSymbols);
      return feed.matchPortfolio ? articles.filter(article => {
        const text = `${article.title} ${article.summary}`.toUpperCase();
        return portfolioSymbols.some(sym => text.includes(sym) || article.relatedSymbols?.includes(sym));
      }) : articles;
    }));
    const failedFeeds = results.filter(result => result.status === 'rejected').length;
    if (feeds.length > 0 && failedFeeds === feeds.length) {
      return NextResponse.json({ success: false, error: 'Haber kaynaklarına şu anda ulaşılamıyor. Lütfen tekrar deneyin.', data: [] }, { status: 503 });
    }
    allNews = results.flatMap(result => result.status === 'fulfilled' ? result.value : []);

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
      if (matched.length > 0) {
        allNews = matched;
      }
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
      partial: failedFeeds > 0,
      warning: failedFeeds > 0 ? 'Bazı haber kaynakları yanıt vermedi; ulaşılabilen haberler gösteriliyor.' : undefined,
      data: uniqueNews,
    });
  } catch (error) {
    console.error('Live News API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Canlı haberler alınamadı' },
      { status: 500 }
    );
  }
}
