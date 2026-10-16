export const NEWS_FEEDS = [
  { id: 'trt-economy', name: 'TRT Haber', url: 'https://www.trthaber.com/ekonomi_articles.rss', category: 'MACRO', categories: ['BIST', 'MACRO'] },
  { id: 'ecb-press', name: 'Avrupa Merkez Bankası (ECB)', url: 'https://www.ecb.europa.eu/rss/press.html', category: 'GLOBAL', categories: ['GLOBAL'] },
  { id: 'investing-bist', name: 'Investing.com', url: 'https://tr.investing.com/rss/news_1067.rss', category: 'BIST', categories: ['BIST'] },
  { id: 'investing-companies', name: 'Investing.com', url: 'https://tr.investing.com/rss/news_356.rss', category: 'GLOBAL', categories: ['BIST', 'GLOBAL'] },
  { id: 'investing-markets', name: 'Investing.com', url: 'https://tr.investing.com/rss/news_25.rss', category: 'GLOBAL', categories: ['BIST', 'GLOBAL'] },
] as const;

export type NewsFeed = typeof NEWS_FEEDS[number];
export function feedCategory(feedId: string, title: string, summary: string): 'BIST' | 'MACRO' | 'GLOBAL' {
  if (feedId === 'ecb-press') return 'GLOBAL';
  if (feedId === 'investing-bist') return 'BIST';
  if (feedId.startsWith('investing-')) return /\bbist\b|borsa istanbul/i.test(`${title} ${summary}`) ? 'BIST' : 'GLOBAL';
  return /\bbist\b|borsa|hisse senedi|halka arz|pay piyasası/i.test(`${title} ${summary}`) ? 'BIST' : 'MACRO';
}
