import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { analyzeNewsSentiment } from '../../src/lib/news/sentiment.ts';
import { NEWS_FEEDS, feedCategory } from '../../src/lib/news/feeds.ts';
import { rssPlainText } from '../../src/lib/news/rssText.ts';

const output = process.argv[2] || '/tmp/stockmind-news.json';
let previous = { data: [] };
try { previous = JSON.parse(await readFile(output, 'utf8')); } catch { /* First collection. */ }
const results = await Promise.allSettled(NEWS_FEEDS.map(async feed => {
  const response = await fetch(feed.url, {
    signal: AbortSignal.timeout(15000), headers: { Accept: 'application/rss+xml, application/xml' },
  });
  if (!response.ok) throw new Error(`${feed.id}: HTTP ${response.status}`);
  const xml = await response.text();
  if (!/<rss\b/i.test(xml)) throw new Error(`${feed.id}: invalid RSS`);
  const collectedAt = new Date().toISOString();
  const articles = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 30).flatMap(([, item]) => {
    const field = tag => item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`))?.[1] || '';
    const title = rssPlainText(field('title'));
    const url = rssPlainText(field('link'));
    const date = new Date(field('pubDate'));
    if (!title || !/^https?:\/\//.test(url) || !Number.isFinite(date.getTime())) return [];
    const analysis = analyzeNewsSentiment(title, rssPlainText(field('description')));
    return [{ id: createHash('sha256').update(url).digest('hex').slice(0, 20), title,
      summary: rssPlainText(field('description')), source: feed.name, feedId: feed.id,
      url, publishedAt: date.toISOString(), category: feedCategory(feed.id, title, rssPlainText(field('description'))), sentiment: analysis.sentiment, sentimentReason: analysis.reason, collectedAt }];
  });
  if (!articles.length) throw new Error(`${feed.id}: empty RSS`);
  return { feedId: feed.id, articles };
}));
const successful = results.filter(r => r.status === 'fulfilled').map(r => r.value);
for (const r of results) if (r.status === 'rejected') console.error(r.reason.message);
if (!successful.length) throw new Error('All news sources failed; existing snapshot preserved');
const replaced = new Set(successful.map(r => r.feedId));
const data = [...successful.flatMap(r => r.articles), ...previous.data.filter(a => NEWS_FEEDS.some(f => f.id === a.feedId) && !replaced.has(a.feedId))];
await writeFile(output, JSON.stringify({ schemaVersion: 2, data }, null, 2) + '\n');
console.log(`Collected ${successful.length} feeds, ${data.length} articles`);
