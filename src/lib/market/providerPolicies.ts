export type DataProviderId =
  | 'tradingview'
  | 'yahoo-finance'
  | 'tefas'
  | 'rss-news'
  | 'kap'
  | 'openrouter';

export interface DataProviderPolicy {
  id: DataProviderId;
  name: string;
  coveredMarkets: string[];
  coveredInstruments: string[];
  delayClass: 'intraday-delayed' | 'end-of-day' | 'feed-periodic' | 'on-demand-ai';
  delayDisclosure: string;
  displayConditions: string;
  redistributionTerms: string;
  attributionLabel: string;
  referenceDocPath: 'docs/veri-saglayici-kosullari.md';
  sourceModules: string[];
}

export const DATA_PROVIDER_POLICY_DOC_PATH = 'docs/veri-saglayici-kosullari.md';

export const KAP_ACCESS_TERMS = {
  providerId: 'kap' as const,
  allowedDomains: ['kap.org.tr'] as const,
  accessMode: 'Resmî KAP API anlaşması veya doğrudan kap.org.tr portal bağlantısı',
  scope: [
    'Özel Durum Açıklamaları (ÖDA)',
    'Periyodik Finansal Tablo ve Faaliyet Raporları',
    'Temettü, Sermaye Artırımı ve Genel Kurul Bildirimleri',
    'TEFAS Fon KAP Bilgilendirme Sayfaları',
  ] as const,
  delayNotice:
    'Resmî KAP portalı/izinli API akışı esas alınır; borsa canlı emir/fiyat verisi değildir ve önbellek gecikmesi içerebilir.',
  displayRules: [
    'Kaynak kimliği (KAP), orijinal bildirim tarihi/saati ve şirket/sembol bilgisi birlikte gösterilir.',
    'Her kayıt doğrudan https://www.kap.org.tr/ belge bağlantısı içerir; yayıncı RSS haberleri asla resmî KAP açıklaması gibi sunulmaz.',
  ] as const,
  redistributionNotice:
    'Resmî bildirim tam metinleri yeniden dağıtılmaz; yalnızca doğrulanmış özet ve orijinal kap.org.tr bağlantısı paylaşılır.',
} as const;

export const DATA_PROVIDER_POLICIES: readonly DataProviderPolicy[] = [
  {
    id: 'tradingview',
    name: 'TradingView Scanner',
    coveredMarkets: ['BIST', 'NASDAQ', 'NYSE', 'CRYPTO', 'FOREX', 'COMMODITY'],
    coveredInstruments: [
      'BIST pay senetleri ve borsa yatırım fonları (BYF)',
      'ABD hisseleri ve ETF ürünleri',
      'Kripto para pariteleri',
      'Döviz kurları ve CFD emtia göstergeleri',
    ],
    delayClass: 'intraday-delayed',
    delayDisclosure:
      'Seans içi kısa gecikmeli veya son kapanış kotasyonu sağlar; resmî BIST/NASDAQ doğrudan canlı borsa lisansı yerine bilgi amaçlı gösterimdir.',
    displayConditions:
      'Her fiyat yanında kaynak adı (TradingView), veri gözlem zamanı (asOf), seans durumu ve tazelik etiketi açıkça gösterilir.',
    redistributionTerms:
      'Ham piyasa verilerinin harici API, toplu aktarım veya üçüncü taraflara yeniden dağıtımı ve satışı yasaktır; yalnızca StockMind arayüzünde görüntülenir.',
    attributionLabel: 'Veri: TradingView (gecikmeli / bilgi amaçlı)',
    referenceDocPath: DATA_PROVIDER_POLICY_DOC_PATH,
    sourceModules: ['src/lib/data/stocks.ts', 'src/lib/market/priceStatus.ts'],
  },
  {
    id: 'yahoo-finance',
    name: 'Yahoo Finance',
    coveredMarkets: ['BIST', 'NASDAQ', 'NYSE', 'INDEX', 'FOREX', 'COMMODITY'],
    coveredInstruments: [
      'Piyasa endeksleri (XU100, SPX, NDX)',
      'Tarihsel OHLCV mum serileri (1s, 1g, 1h)',
      'Yedek döviz ve emtia kotasyonları',
    ],
    delayClass: 'intraday-delayed',
    delayDisclosure:
      'Borsa kurallarına bağlı olarak genellikle 15–20 dakika gecikmeli veri veya önceki kapanış / tarihsel bar verisi sunar.',
    displayConditions:
      'Tarihsel grafiklerde kullanılan aralık, kısmi/güncel bar kapsamı ve kaynak etiketi (Yahoo Finance) kullanıcıya açıkça bildirilir.',
    redistributionTerms:
      'Yalnızca uygulama içi görselleştirme ve tarihsel analiz için kullanılır; veriler üçüncü taraflara yeniden dağıtılamaz.',
    attributionLabel: 'Veri: Yahoo Finance (15-20 dk gecikmeli / tarihsel)',
    referenceDocPath: DATA_PROVIDER_POLICY_DOC_PATH,
    sourceModules: ['src/lib/data/stocks.ts', 'src/lib/market/chartDataCoverage.ts'],
  },
  {
    id: 'tefas',
    name: 'TEFAS / Takasbank',
    coveredMarkets: ['TEFAS'],
    coveredInstruments: [
      'Türkiye yatırım fonları (TL/pay birim fiyatı)',
      'Fon portföy varlık dağılımı ve risk değeri',
      'Yönetim ücreti ve dönemsel getiri oranları',
    ],
    delayClass: 'end-of-day',
    delayDisclosure:
      'Gün sonu resmî değerleme (NAV) esasıyla yayınlanır; resmî tatil ve hafta sonlarında son iş günü fiyatı geçerlidir.',
    displayConditions:
      'Fon fiyatlarında TL/pay birimi, değerleme tarihi (asOf) ve resmî KAP fon bağlantısı açıkça gösterilir; eksik alanlar sıfırlanmaz.',
    redistributionTerms:
      'Kamuya açık resmî fon verileri kaynak atfı ile ve içerik değiştirilmeden sunulur; ücretli ticari veri akışı olarak yeniden satılamaz.',
    attributionLabel: 'Veri: TEFAS (gün sonu resmî değer)',
    referenceDocPath: DATA_PROVIDER_POLICY_DOC_PATH,
    sourceModules: ['src/lib/api/tefas.ts', 'src/lib/data/funds.ts'],
  },
  {
    id: 'rss-news',
    name: 'Yayıncı RSS & Resmî Bildirim Bağlantıları',
    coveredMarkets: ['BIST', 'MACRO', 'GLOBAL'],
    coveredInstruments: [
      'TRT Haber Ekonomi, Investing.com TR, ECB Press RSS akışları',
      'KAP şirket genel bilgi bağlantıları',
    ],
    delayClass: 'feed-periodic',
    delayDisclosure:
      'Yayıncı RSS akışlarının yayınlanma ve önbellek yenileme periyoduna bağlı olarak güncellenir.',
    displayConditions:
      'Her haberde yayıncı adı ve yayın zamanı gösterilir; yayıncı haberleri asla resmî KAP özel durum açıklaması gibi sunulmaz.',
    redistributionTerms:
      'Yalnızca başlık, kısa özet ve orijinal kaynağa dış bağlantı verilir; tam metin kopyalanmaz ve yeniden dağıtılmaz.',
    attributionLabel: 'Haber: İlgili yayıncı RSS kaynağı & orijinal bağlantı',
    referenceDocPath: DATA_PROVIDER_POLICY_DOC_PATH,
    sourceModules: ['src/lib/news/feeds.ts', 'src/lib/news/snapshot.ts'],
  },
  {
    id: 'kap',
    name: 'Kamuyu Aydınlatma Platformu (KAP)',
    coveredMarkets: ['BIST', 'TEFAS'],
    coveredInstruments: [
      'Özel Durum Açıklamaları (ÖDA)',
      'Periyodik Finansal Tablo ve Faaliyet Raporları',
      'Temettü, Sermaye Artırımı ve Genel Kurul Bildirimleri',
      'TEFAS Yatırım Fonları KAP Sayfaları',
    ],
    delayClass: 'feed-periodic',
    delayDisclosure:
      'Resmî KAP API anlaşması veya doğrudan kap.org.tr bildirim bağlantısı üzerinden sunulur; canlı borsa veri dağıtım kapsamı dışındadır ve kısa önbellek gecikmesi içerebilir.',
    displayConditions:
      'Her bildirimde kaynak kimliği (KAP), orijinal yayın saati, ilgili şirket/sembol ve doğrudan https://www.kap.org.tr/ belge bağlantısı gösterilir; yayıncı RSS haberleri asla KAP bildirimi olarak etiketlenmez.',
    redistributionTerms:
      'Tam bildirim metinleri veya ek PDF dosyaları StockMind sunucularında yeniden dağıtılmaz; yalnızca doğrulanmış bildirim özeti ve resmî kap.org.tr bağlantısı verilir.',
    attributionLabel: 'Resmî Bildirim: Kamuyu Aydınlatma Platformu (KAP)',
    referenceDocPath: DATA_PROVIDER_POLICY_DOC_PATH,
    sourceModules: ['src/app/api/news/route.ts', 'src/lib/notifications/kapCalendarAlerts.ts'],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter AI Gateway',
    coveredMarkets: ['AI-COMMENTARY'],
    coveredInstruments: [
      'Yalnızca metin tabanlı piyasa ve portföy yorumlama oturumları',
      'Yatırım Komitesi (Pro) çoklu bakış açısı analiz özeti',
    ],
    delayClass: 'on-demand-ai',
    delayDisclosure:
      'Kullanıcı isteği anında çalışır; canlı fiyat veya finansal veri sağlayıcısı değildir.',
    displayConditions:
      'Yanıtlar yalnızca uygulamada doğrulanmış verilere dayanır; eksik fiyat durumunda uydurma rakam üretilmez ve yatırım tavsiyesi değildir uyarısı uygulanır.',
    redistributionTerms:
      'Model çıktıları kullanıcı hesabına özel tekil oturum çıktısıdır; seçili model sağlayıcıların kullanım koşullarına tabidir.',
    attributionLabel: 'Yorum: OpenRouter AI (canlı fiyat kaynağı değildir)',
    referenceDocPath: DATA_PROVIDER_POLICY_DOC_PATH,
    sourceModules: ['src/lib/ai/openrouter.ts', 'src/lib/ai/modelCatalog.ts'],
  },
] as const;

export function listProviderPolicies(): readonly DataProviderPolicy[] {
  return DATA_PROVIDER_POLICIES;
}

export function getProviderPolicy(sourceOrId: string | null | undefined): DataProviderPolicy | null {
  const normalized = (sourceOrId || '').trim().toLowerCase();
  if (!normalized) return null;

  if (normalized === 'tradingview' || normalized.includes('tradingview') || normalized.includes('scanner')) {
    return DATA_PROVIDER_POLICIES.find((p) => p.id === 'tradingview') ?? null;
  }
  if (normalized === 'yahoo-finance' || normalized.includes('yahoo')) {
    return DATA_PROVIDER_POLICIES.find((p) => p.id === 'yahoo-finance') ?? null;
  }
  if (normalized === 'tefas' || normalized.includes('tefas') || normalized.includes('takasbank')) {
    return DATA_PROVIDER_POLICIES.find((p) => p.id === 'tefas') ?? null;
  }
  if (
    normalized === 'kap' ||
    normalized.includes('kap.org.tr') ||
    normalized.includes('kamuyu aydınlatma') ||
    normalized.includes('kamuyu aydinlatma')
  ) {
    return DATA_PROVIDER_POLICIES.find((p) => p.id === 'kap') ?? null;
  }
  if (
    normalized === 'rss-news' ||
    normalized.includes('rss') ||
    normalized.includes('trt') ||
    normalized.includes('investing') ||
    normalized.includes('ecb')
  ) {
    return DATA_PROVIDER_POLICIES.find((p) => p.id === 'rss-news') ?? null;
  }
  if (normalized === 'openrouter' || normalized.includes('openrouter')) {
    return DATA_PROVIDER_POLICIES.find((p) => p.id === 'openrouter') ?? null;
  }
  return null;
}

export function getProviderComplianceSummary(sourceOrId: string | null | undefined): string {
  const policy = getProviderPolicy(sourceOrId);
  if (!policy) {
    return 'Kaynak bilgisi doğrulanamadığında veri eksik olarak işaretlenir ve tahmin üretilmez.';
  }
  return `${policy.attributionLabel} — ${policy.delayDisclosure} ${policy.redistributionTerms}`;
}
