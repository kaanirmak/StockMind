import { normalizeNewsText } from './symbolMatch';

export type NewsCardKind = 'news' | 'official_disclosure' | 'calendar_event';

export interface NewsCardKindMeta {
  kind: NewsCardKind;
  label: string;
  badgeVariant: 'default' | 'info' | 'warning';
}

export interface NewsToneAndImpact {
  toneLabel: 'Olumlu' | 'Olumsuz' | 'Nötr';
  toneSummary: string;
  impactScopeLabel: string;
  impactNote: string;
}

const OFFICIAL_SOURCE_RE =
  /\b(?:kap|kamuyu aydinlatma platformu|tcmb|ecb|european central bank|federal reserve|fed|spk|bddk|sec edgar)\b/;

const OFFICIAL_TEXT_RE =
  /\b(?:ozel durum aciklamasi|kap bildirimi|resmi aciklama|resmi duyuru|basin aciklamasi|fomc statement|form 8-k|form 10-k|form 10-q|governing council decision)\b/;

const CALENDAR_TEXT_RE =
  /\b(?:ekonomik takvim|bilanco tarihi|temettu tarihi|genel kurul tarihi|faiz karari tarihi|tarihinde aciklanacak|aciklanmasi bekleniyor|yarin aciklanacak|bu hafta aciklanacak|gelecek hafta aciklanacak|toplantisi yapilacak|ex-dividend|earnings date|earnings calendar|scheduled for|upcoming meeting)\b/;

export function classifyNewsCardKind(article: {
  title: string;
  summary?: string;
  source?: string | null;
  category?: string | null;
}): NewsCardKindMeta {
  const category = (article.category || '').trim().toUpperCase();
  const normalizedSource = normalizeNewsText(article.source || '');
  const normalizedText = normalizeNewsText(`${article.title} ${article.summary || ''}`);

  if (
    category === 'KAP' ||
    OFFICIAL_SOURCE_RE.test(normalizedSource) ||
    OFFICIAL_TEXT_RE.test(normalizedText)
  ) {
    return {
      kind: 'official_disclosure',
      label: 'Resmî Açıklama',
      badgeVariant: 'info',
    };
  }

  if (category === 'CALENDAR' || CALENDAR_TEXT_RE.test(normalizedText)) {
    return {
      kind: 'calendar_event',
      label: 'Takvim Olayı',
      badgeVariant: 'warning',
    };
  }

  return {
    kind: 'news',
    label: 'Haber',
    badgeVariant: 'default',
  };
}

export function buildNewsToneAndImpact(params: {
  sentiment?: 'positive' | 'negative' | 'neutral' | string;
  sentimentReason?: string;
  matchedSymbols: readonly string[];
  event?: string;
  cardKind: NewsCardKind;
}): NewsToneAndImpact {
  const toneLabel: 'Olumlu' | 'Olumsuz' | 'Nötr' =
    params.sentiment === 'positive'
      ? 'Olumlu'
      : params.sentiment === 'negative'
      ? 'Olumsuz'
      : 'Nötr';

  const toneSummary =
    params.sentimentReason?.trim() ||
    (toneLabel === 'Olumlu'
      ? 'Başlık/özet dili olumlu finansal ifadeler içeriyor.'
      : toneLabel === 'Olumsuz'
      ? 'Başlık/özet dili risk veya baskı ifadeleri içeriyor.'
      : 'Başlık/özet dili dengeli veya yalnızca bilgi aktarıyor.');

  if (params.matchedSymbols.length > 0) {
    const symbols = params.matchedSymbols.join(', ');
    if (params.cardKind === 'official_disclosure') {
      return {
        toneLabel,
        toneSummary,
        impactScopeLabel: `Doğrudan varlık bildirimi (${symbols})`,
        impactNote: `Resmî açıklamanın ${symbols} üzerindeki etkisi haber tonuyla sınırlı değildir; bilanço detayları, nakit akışı ve beklenti sapması ayrıca incelenmelidir.`,
      };
    }
    if (params.cardKind === 'calendar_event') {
      return {
        toneLabel,
        toneSummary,
        impactScopeLabel: `Takvim volatilitesi adayı (${symbols})`,
        impactNote: `Planlanan takvim olayı öncesinde ${symbols} için piyasa beklentisinden sapma yönüne göre iki yönlü fiyatlama oluşabilir.`,
      };
    }
    if (params.event === 'Temettü veya sermaye işlemi') {
      return {
        toneLabel,
        toneSummary,
        impactScopeLabel: `Sermaye / temettü etkisi (${symbols})`,
        impactNote: `${symbols} için nakit temettü veya sermaye işlemi pay sayısı ve nakit getirisi dengesini değiştirebilir; haber tonundan ayrı değerlendirilmelidir.`,
      };
    }
    return {
      toneLabel,
      toneSummary,
      impactScopeLabel: `Doğrudan portföy teması (${symbols})`,
      impactNote: `Haber dili "${toneLabel}" olsa da ${symbols} fiyatlaması gelişmenin daha önce beklentiye girip girmediğine ve şirket marjlarına bağlıdır.`,
    };
  }

  if (params.event === 'Faiz kararı' || params.event === 'Enflasyon verisi') {
    return {
      toneLabel,
      toneSummary,
      impactScopeLabel: 'Makro / sektör aktarım etkisi',
      impactNote:
        'Faiz ve enflasyon verileri portföydeki finans, borçlu sanayi ve değerleme duyarlı varlıkları farklı yönlerde etkileyebilir.',
    };
  }

  if (params.cardKind === 'calendar_event') {
    return {
      toneLabel,
      toneSummary,
      impactScopeLabel: 'Yaklaşan takvim olayı',
      impactNote:
        'Henüz gerçekleşmemiş bir takvim olayıdır; portföy etkisi açıklanacak verinin piyasa konsensüsüyle farkına bağlı olur.',
    };
  }

  return {
    toneLabel,
    toneSummary,
    impactScopeLabel: 'Doğrudan portföy eşleşmesi yok',
    impactNote:
      'Portföy varlıklarınızla doğrudan eşleşmedi; yalnızca genel piyasa ve sektör arka planı olarak sunulmaktadır.',
  };
}
