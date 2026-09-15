import { NextResponse } from 'next/server';

export interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  category: 'BIST' | 'KAP' | 'GLOBAL' | 'MACRO';
  sentiment: 'positive' | 'neutral' | 'negative';
  source: string;
  url: string;
  publishedAt: string;
  relatedSymbols?: string[];
}

// Function to fetch and parse real live RSS financial news
async function fetchLiveNews(query: string, category: 'BIST' | 'KAP' | 'GLOBAL' | 'MACRO'): Promise<NewsArticle[]> {
  try {
    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=tr&gl=TR&ceid=TR:tr`;
    const res = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
      next: { revalidate: 300 }, // cache for 5 mins
    });

    if (!res.ok) return [];

    const xmlText = await res.text();
    const items: NewsArticle[] = [];

    // Parse XML items using regex
    const itemMatches = xmlText.matchAll(/<item>([\s\S]*?)<\/item>/g);

    for (const match of itemMatches) {
      const itemContent = match[1];

      const titleMatch = itemContent.match(/<title>([\s\S]*?)<\/title>/);
      const linkMatch = itemContent.match(/<link>([\s\S]*?)<\/link>/);
      const pubDateMatch = itemContent.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
      const sourceMatch = itemContent.match(/<source[^>]*>([\s\S]*?)<\/source>/);
      const descMatch = itemContent.match(/<description>([\s\S]*?)<\/description>/);

      if (titleMatch) {
        let rawTitle = titleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim();
        let source = sourceMatch ? sourceMatch[1].trim() : 'Finans';

        // Strip source suffix from title if present (e.g. "Haber Başlığı - Bloomberg HT")
        if (rawTitle.includes(' - ')) {
          const parts = rawTitle.split(' - ');
          if (parts.length > 1) {
            source = parts.pop() || source;
            rawTitle = parts.join(' - ');
          }
        }

        // Clean HTML description
        let rawSummary = descMatch ? descMatch[1].replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ').trim() : '';
        if (!rawSummary || rawSummary === rawTitle) {
          rawSummary = `${rawTitle}. Kaynak: ${source}`;
        }

        // Extract related symbols
        const relatedSymbols: string[] = [];
        const symbolsToCheck = ['THYAO', 'ASELS', 'GARAN', 'EREGL', 'KCHOL', 'BIMAS', 'AKBNK', 'SISE', 'TUPRS', 'SAHOL', 'AAPL', 'NVDA', 'MSFT', 'TSLA'];
        symbolsToCheck.forEach((sym) => {
          if (rawTitle.toUpperCase().includes(sym) || rawSummary.toUpperCase().includes(sym)) {
            relatedSymbols.push(sym);
          }
        });

        // Simple sentiment deduction based on Turkish financial keywords
        let sentiment: 'positive' | 'neutral' | 'negative' = 'neutral';
        const lower = (rawTitle + ' ' + rawSummary).toLowerCase();
        if (lower.includes('rekor') || lower.includes('yükseliş') || lower.includes('kazandı') || lower.includes('artış') || lower.includes('büyüme') || lower.includes('kar') || lower.includes('temettü') || lower.includes('anlaşma') || lower.includes('sözleşme')) {
          sentiment = 'positive';
        } else if (lower.includes('düşüş') || lower.includes('zarar') || lower.includes('kayıp') || lower.includes('geriledi') || lower.includes('risk') || lower.includes('tedbir') || lower.includes('ceza') || lower.includes('gözaltı')) {
          sentiment = 'negative';
        }

        items.push({
          id: `news-${Buffer.from(rawTitle).toString('base64').substring(0, 16)}`,
          title: rawTitle,
          summary: rawSummary,
          category,
          sentiment,
          source,
          url: linkMatch ? linkMatch[1] : '#',
          publishedAt: pubDateMatch ? new Date(pubDateMatch[1]).toISOString() : new Date().toISOString(),
          relatedSymbols: relatedSymbols.length > 0 ? relatedSymbols : undefined,
        });
      }

      if (items.length >= 10) break;
    }

    return items;
  } catch (error) {
    console.error('Error fetching live RSS news:', error);
    return [];
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') as 'BIST' | 'KAP' | 'GLOBAL' | 'MACRO' | 'ALL' | null;
    const symbol = searchParams.get('symbol');

    let allNews: NewsArticle[] = [];

    if (category === 'BIST' || !category || category === 'ALL') {
      const bistNews = await fetchLiveNews('Borsa Istanbul OR BIST 100 OR BIST hisse', 'BIST');
      allNews.push(...bistNews);
    }

    if (category === 'KAP' || !category || category === 'ALL') {
      const kapNews = await fetchLiveNews('Kamuyu Aydinlatma Platformu KAP hisse sozlesme bilanco', 'KAP');
      allNews.push(...kapNews);
    }

    if (category === 'GLOBAL' || !category || category === 'ALL') {
      const globalNews = await fetchLiveNews('Wall Street OR Nasdaq OR Fed faiz OR SP500', 'GLOBAL');
      allNews.push(...globalNews);
    }

    if (category === 'MACRO' || !category || category === 'ALL') {
      const macroNews = await fetchLiveNews('Altin fiyati gram altin OR Merkez Bankasi OR Enflasyon', 'MACRO');
      allNews.push(...macroNews);
    }

    // Sort by publication date newest first
    allNews.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

    // Filter by symbol if requested
    if (symbol) {
      allNews = allNews.filter((n) =>
        n.relatedSymbols?.includes(symbol.toUpperCase()) ||
        n.title.toUpperCase().includes(symbol.toUpperCase()) ||
        n.summary.toUpperCase().includes(symbol.toUpperCase())
      );
    }

    // Deduplicate by title
    const seen = new Set<string>();
    const uniqueNews = allNews.filter((n) => {
      if (seen.has(n.title)) return false;
      seen.add(n.title);
      return true;
    });

    return NextResponse.json({
      success: true,
      count: uniqueNews.length,
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
