export const NEWS_FEEDS = [
  { id: 'trt-economy', name: 'TRT Haber', url: 'https://www.trthaber.com/ekonomi_articles.rss', category: 'MACRO', categories: ['BIST', 'MACRO'] },
  { id: 'ecb-press', name: 'Avrupa Merkez Bankası (ECB)', url: 'https://www.ecb.europa.eu/rss/press.html', category: 'GLOBAL', categories: ['GLOBAL'] },
] as const;

export type NewsFeed = typeof NEWS_FEEDS[number];
export function feedCategory(feedId: string, title: string, summary: string): 'BIST' | 'MACRO' | 'GLOBAL' {
  if (feedId === 'ecb-press') return 'GLOBAL';
  return /\bbist\b|borsa|hisse senedi|halka arz|pay piyasası/i.test(`${title} ${summary}`) ? 'BIST' : 'MACRO';
}
