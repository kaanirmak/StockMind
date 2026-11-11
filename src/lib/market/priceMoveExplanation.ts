import { matchNewsAssetIdentity } from '@/lib/news/symbolMatch';
import { classifyNewsCardKind } from '@/lib/news/cardClassification';

export interface PriceMoveQuoteInput {
  price?: number | null;
  previousClose?: number | null;
  change?: number | null;
  changePercent?: number | null;
  source?: string | null;
  asOf?: string | null;
  exchange?: string | null;
}

export interface PriceMoveNewsInput {
  id: string;
  title: string;
  summary?: string;
  source: string;
  url?: string | null;
  publishedAt: string;
  category?: string | null;
  relatedSymbols?: string[];
}

export interface PriceMoveEventInput {
  id: string;
  symbol: string;
  title: string;
  eventDate: string;
  source: string;
  sourceUrl?: string | null;
  type?: string;
  verified?: boolean;
}

export interface PriceMoveDriver {
  id: string;
  title: string;
  source: string;
  url: string | null;
  publishedAt: string;
  kind: 'official_disclosure' | 'news' | 'calendar_event';
  matchType: string;
}

export interface PriceMoveExplanation {
  symbol: string;
  intradayMove: {
    currentPrice: number | null;
    previousClose: number | null;
    change: number | null;
    changePercent: number | null;
    direction: 'up' | 'down' | 'flat' | 'unavailable';
    priceSource: string;
    asOf: string | null;
  };
  drivers: PriceMoveDriver[];
  causalityStatus: 'correlated_events' | 'uncertain_no_recent_events' | 'unavailable_price';
  headline: string;
  explanationText: string;
  causalityNotice: string;
}

const EVENT_LOOKBACK_MS = 72 * 60 * 60 * 1000;
const CALENDAR_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export function buildPriceMoveExplanation(params: {
  symbol: string;
  quote?: PriceMoveQuoteInput | null;
  articles?: readonly PriceMoveNewsInput[];
  events?: readonly PriceMoveEventInput[];
  nowMs?: number;
}): PriceMoveExplanation {
  const symbol = params.symbol.trim().toUpperCase();
  const nowMs = params.nowMs ?? Date.now();
  const q = params.quote ?? null;

  const currentPrice =
    typeof q?.price === 'number' && Number.isFinite(q.price) && q.price > 0 ? q.price : null;
  const previousClose =
    typeof q?.previousClose === 'number' && Number.isFinite(q.previousClose) && q.previousClose > 0
      ? q.previousClose
      : null;
  const change =
    typeof q?.change === 'number' && Number.isFinite(q.change)
      ? q.change
      : currentPrice !== null && previousClose !== null
      ? Number((currentPrice - previousClose).toFixed(4))
      : null;
  const changePercent =
    typeof q?.changePercent === 'number' && Number.isFinite(q.changePercent)
      ? q.changePercent
      : currentPrice !== null && previousClose !== null && previousClose > 0
      ? Number((((currentPrice - previousClose) / previousClose) * 100).toFixed(2))
      : null;

  const direction: 'up' | 'down' | 'flat' | 'unavailable' =
    changePercent === null
      ? 'unavailable'
      : changePercent > 0.05
      ? 'up'
      : changePercent < -0.05
      ? 'down'
      : 'flat';

  const priceSource = (q?.source || '').trim() || 'Piyasa Verisi';
  const asOf = q?.asOf ?? null;

  const drivers: PriceMoveDriver[] = [];
  const seenKeys = new Set<string>();

  for (const article of params.articles ?? []) {
    const pubMs = Date.parse(article.publishedAt);
    if (!Number.isFinite(pubMs) || nowMs - pubMs > EVENT_LOOKBACK_MS) continue;
    if (!article.source?.trim() || !article.title?.trim()) continue;

    const text = `${article.title} ${article.summary || ''}`;
    const identityMatch = matchNewsAssetIdentity(
      text,
      { symbol, exchange: q?.exchange ?? undefined },
      { category: article.category ?? undefined, source: article.source }
    );
    const explicitRelated = Array.isArray(article.relatedSymbols)
      ? article.relatedSymbols.some(
          (rs) => rs.toUpperCase().replace(/\.[A-Z0-9]+$/, '') === symbol.replace(/\.[A-Z0-9]+$/, '')
        )
      : false;
    if (!identityMatch.matched && !explicitRelated) continue;

    const kindMeta = classifyNewsCardKind({
      title: article.title,
      summary: article.summary,
      source: article.source,
      category: article.category ?? undefined,
    });
    const dedupKey = `news:${article.title.trim().toLowerCase()}`;
    if (seenKeys.has(dedupKey)) continue;
    seenKeys.add(dedupKey);

    drivers.push({
      id: article.id,
      title: article.title.trim(),
      source: article.source.trim(),
      url: article.url && /^https?:\/\//i.test(article.url) ? article.url : null,
      publishedAt: new Date(pubMs).toISOString(),
      kind: kindMeta.kind,
      matchType:
        kindMeta.kind === 'official_disclosure'
          ? 'Resmî Bildirim / KAP'
          : identityMatch.matched
          ? 'Doğrudan Varlık Haberi'
          : 'İlişkili Piyasa Başlığı',
    });
  }

  for (const ev of params.events ?? []) {
    if (ev.verified === false) continue;
    const evMs = Date.parse(`${ev.eventDate}T12:00:00Z`);
    if (!Number.isFinite(evMs) || Math.abs(nowMs - evMs) > CALENDAR_WINDOW_MS) continue;
    if (!ev.source?.trim() || !ev.title?.trim()) continue;
    const dedupKey = `event:${ev.title.trim().toLowerCase()}`;
    if (seenKeys.has(dedupKey)) continue;
    seenKeys.add(dedupKey);

    drivers.push({
      id: ev.id,
      title: ev.title.trim(),
      source: ev.source.trim(),
      url: ev.sourceUrl && /^https?:\/\//i.test(ev.sourceUrl) ? ev.sourceUrl : null,
      publishedAt: new Date(evMs).toISOString(),
      kind: 'calendar_event',
      matchType: 'Bilanço / Temettü Takvimi',
    });
  }

  drivers.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));

  if (changePercent === null) {
    return {
      symbol,
      intradayMove: {
        currentPrice,
        previousClose,
        change,
        changePercent,
        direction,
        priceSource,
        asOf,
      },
      drivers: drivers.slice(0, 5),
      causalityStatus: 'unavailable_price',
      headline: `${symbol} gün içi hareketi şu anda doğrulanamadı`,
      explanationText:
        'Canlı veya gün içi yüzdelik değişim sağlayıcıdan doğrulanamadığı için fiyat hareketi nedeni tahmin edilmedi.',
      causalityNotice:
        'Fiyat verisi eksik olduğunda olası hareket nedeni uydurulmaz; yalnızca doğrulanmış kaynaklı olaylar listelenir.',
    };
  }

  const pctStr = `${changePercent > 0 ? '+' : ''}${changePercent.toFixed(2)}%`;
  const moveVerb =
    direction === 'up'
      ? 'yükseldi'
      : direction === 'down'
      ? 'geriledi'
      : 'yatay seyretti';

  if (drivers.length > 0) {
    return {
      symbol,
      intradayMove: {
        currentPrice,
        previousClose,
        change,
        changePercent,
        direction,
        priceSource,
        asOf,
      },
      drivers: drivers.slice(0, 5),
      causalityStatus: 'correlated_events',
      headline: `${symbol} gün içi ${pctStr} ${moveVerb} — ${drivers.length} zaman uyumlu olay bulundu`,
      explanationText: `${symbol} varlığı ${priceSource} verisine göre gün içinde ${pctStr} hareket etti. Son 72 saat / yakın takvim penceresinde varlıkla eşleşen kaynaklı başlıklar aşağıda listelenmektedir.`,
      causalityNotice:
        'Zaman uyumu kesin nedensellik anlamına gelmez: listelenen haber veya bildirimler fiyat hareketinin tek nedeni olmayabilir; genel piyasa akışı ve emir derinliği de etkili olabilir.',
    };
  }

  return {
    symbol,
    intradayMove: {
      currentPrice,
      previousClose,
      change,
      changePercent,
      direction,
      priceSource,
      asOf,
    },
    drivers: [],
    causalityStatus: 'uncertain_no_recent_events',
    headline: `${symbol} gün içi ${pctStr} ${moveVerb} — nedensellik belirsiz`,
    explanationText: `${symbol} varlığı ${priceSource} verisine göre gün içinde ${pctStr} hareket etti; ancak son 72 saatte bağlı haber veya resmî açıklama kaynaklarında varlığa özel doğrulanmış yeni bir olay tespit edilmedi.`,
    causalityNotice:
      'Nedensellik belirsiz: Belirli bir şirket haberi veya KAP açıklaması bulunmadığında hareket genel sektör akışı, endeks oynaklığı veya teknik likidite kaynaklı olabilir; uydurma neden üretilmemiştir.',
  };
}

