export type NewsSentiment = 'positive' | 'negative' | 'neutral';
export interface SentimentResult { sentiment: NewsSentiment; reason: string }

// Conservative text classification, not a prediction of an asset's future price.
export function analyzeNewsSentiment(title: string, summary = ''): SentimentResult {
  const normalize = (text: string) => text.toLocaleLowerCase('tr-TR').replace(/ı/g, 'i')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const clauses = new Set(normalize(`${title}. ${summary}`).replace(/[^.!?;\n]*\?/g, '').split(/[.!?;\n]|\b(?:ancak|fakat|ama|but|however)\b/).map(s => s.trim()).filter(Boolean));
  const positive: string[] = [];
  const negative: string[] = [];
  const up = '(?:art\\w*|yuksel\\w*|buyu\\w*|rekor\\w*|rose|ris\\w*|increas\\w*|surge\\w*)';
  const down = '(?:dus\\w*|gerile\\w*|azal\\w*|daral\\w*|fell|fall\\w*|declin\\w*|decreas\\w*)';
  const pair = (entity: string, direction: string, text: string) =>
    new RegExp(`\\b${entity}\\b[^.!?;]{0,65}\\b${direction}\\b`).test(text);
  const profit = '(?:kar|kari|karini|karinda|karlilik|karli|profit|profits|earnings)';
  const market = '(?:borsa|bist|endeks|endeksi|hisse|hisseleri|altin|gold|stocks|shares|equities|index)';
  const costs = '(?:enflasyon|issizlik|maliyet|maliyetler|maliyetleri|inflation|unemployment|costs)';
  for (const clause of clauses) {
    // Questions, forecasts and negated claims do not establish an actual event.
    if (/\b\w*(?:acak|ecek)\b/.test(clause) || /\b(?:degil|olmadi|olmamis|yalanla\w*|beklen\w*|olabilir|tahmin\w*|not|no|denied|may|might|could|expected|forecast\w*)\b/.test(clause)) continue;
    if (pair(profit, up, clause)) positive.push('Şirket kârında artış');
    if (pair(profit, down, clause)) negative.push('Şirket kârında düşüş');
    if (pair(market, up, clause)) positive.push('Varlık veya endeks fiyatında yükseliş');
    if (pair(market, down, clause)) negative.push('Varlık veya endeks fiyatında düşüş');
    if (pair(costs, up, clause)) negative.push('Enflasyon, işsizlik veya maliyet artışı');
    if (pair(costs, down, clause)) positive.push('Enflasyon, işsizlik veya maliyet düşüşü');
    if (/\b(?:zarar acikladi|zarar etti|net zarar|iflas|temerrut|net loss|bankruptcy|defaulted)\b/.test(clause)) negative.push('Zarar veya ödeme güçlüğü');
    if (/\b(?:sozlesme|anlasma|contract|agreement)\b.{0,60}\b(?:imzaladi|imzalandi|signed|secured)\b/.test(clause)) positive.push('İmzalanmış sözleşme veya anlaşma');
  }
  if (positive.length && negative.length) return { sentiment: 'neutral', reason: 'Haberde hem olumlu hem olumsuz gelişmeler var.' };
  if (positive.length) return { sentiment: 'positive', reason: [...new Set(positive)].join('; ') };
  if (negative.length) return { sentiment: 'negative', reason: [...new Set(negative)].join('; ') };
  return { sentiment: 'neutral', reason: 'Metinden net bir yön çıkarılamadı; faiz kararları ve beklentiler tek başına yön belirtmez.' };
}
