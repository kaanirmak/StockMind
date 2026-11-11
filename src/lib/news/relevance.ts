import { mentionsNewsSymbol, normalizeNewsText } from './symbolMatch';

const events: { label: string; pattern: RegExp }[] = [
  { label: 'Faiz kararı', pattern: /\b(?:faiz karari|faizi sabit tuttu|politika faizini|rate decision|policy rate)\b/ },
  { label: 'Enflasyon verisi', pattern: /\b(?:enflasyon(?:u|un)? (?:aciklandi|verisi|rakamlari)|tufe|cpi report|inflation data)\b/ },
  { label: 'Şirket bilançosu', pattern: /\b(?:bilancosunu acikladi|finansal sonuclar|ceyrek kari|earnings report|quarterly results)\b/ },
  { label: 'Temettü veya sermaye işlemi', pattern: /\b(?:temettu|sermaye artirimi|pay geri alim|dividend|share buyback)\b/ },
  { label: 'Şirket işlemi veya sözleşme', pattern: /\b(?:sozlesme imzaladi|yeni is iliskisi|satin alma anlasmasi|merger agreement|contract award)\b/ },
  { label: 'Kredi notu kararı', pattern: /\b(?:kredi notunu|not gorunumunu|rating downgrade|rating upgrade)\b/ },
];

export function rankNews<T extends { title: string; summary: string; publishedAt: string }>(
  articles: readonly T[],
  portfolioSymbols: readonly string[],
  importantFirst: boolean,
  now = Date.now(),
) {
  return articles.map(article => {
    const date = Date.parse(article.publishedAt);
    const recent = date <= now && now - date <= 48 * 60 * 60 * 1000;
    const matchedSymbols = portfolioSymbols.filter(symbol => mentionsNewsSymbol(`${article.title} ${article.summary}`, symbol));
    const title = normalizeNewsText(article.title);
    const event = events.find(({ pattern }) => pattern.test(title))?.label;
    const priority = importantFirst && recent ? (matchedSymbols.length > 0 ? 2 : 0) + (event ? 1 : 0) : 0;
    return { article, matchedSymbols, event, date, priority };
  }).sort((a, b) => b.priority - a.priority || b.date - a.date);
}
