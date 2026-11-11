export type WidgetShareKind = 'portfolio' | 'heatmap';
export type WidgetShareMode = 'demo' | 'personal';
export type WidgetEmbedTheme = 'dark' | 'light' | 'transparent';

export interface WidgetSharePolicyInput {
  widget: WidgetShareKind;
  theme: WidgetEmbedTheme;
  shareMode: WidgetShareMode;
  personalConsent: boolean;
  hideAmounts: boolean;
  origin: string;
}

export interface WidgetShareDescriptor {
  effectiveMode: WidgetShareMode;
  requiresConsentConfirmation: boolean;
  canExport: boolean;
  url: string;
  headline: string;
  boundaryNote: string;
  sharedFields: string[];
  neverShared: string[];
}

export function buildWidgetShareDescriptor(input: WidgetSharePolicyInput): WidgetShareDescriptor {
  const requiresConsentConfirmation = input.shareMode === 'personal' && !input.personalConsent;
  const effectiveMode: WidgetShareMode =
    input.shareMode === 'personal' && input.personalConsent ? 'personal' : 'demo';

  const widgetPath = input.widget === 'portfolio' ? '/widgets/portfolio' : '/widgets/heatmap';
  const queryParams = new URLSearchParams();
  if (input.theme !== 'dark') queryParams.set('theme', input.theme);
  queryParams.set('mode', effectiveMode);
  if (effectiveMode === 'personal' && input.hideAmounts) {
    queryParams.set('privacy', '1');
  }

  const baseOrigin = input.origin ? input.origin.replace(/\/$/, '') : '';
  const query = queryParams.toString();
  const url = `${baseOrigin}${widgetPath}${query ? `?${query}` : ''}`;

  const sharedFields: string[] =
    effectiveMode === 'demo'
      ? [
          'Temsili örnek portföy / örnek varlık ağırlıkları',
          'Tema görünümü (' + input.theme + ')',
        ]
      : input.widget === 'portfolio'
      ? input.hideAmounts
        ? [
            'Yüzdesel getiri oranları (% değişim)',
            'Parasal tutarlar gizlenir (₺•••• / $••••)',
            'Yalnızca oturum açmış kendi tarayıcınızda çalışır',
          ]
        : [
            'Toplam portföy değeri ve toplam/yatırılan maliyet tutarları',
            'Günlük ve toplam kâr/zarar tutar ve yüzdeleri',
            'Yalnızca oturum açmış kendi tarayıcınızda çalışır',
          ]
      : [
          'Portföyünüzdeki varlık sembolleri ve pazar etiketleri',
          'Ağırlık (%) ve getiri (%) oranları (parasal tutar gösterilmez)',
          'Yalnızca oturum açmış kendi tarayıcınızda çalışır',
        ];

  const neverShared = [
    'Veriler herkese açık anonim bir paylaşım linkine yüklenmez',
    'Oturumunuz yoksa harici ziyaretçiler yalnızca örnek veri görür',
    'API anahtarları, hesap bilgileri ve işlem geçmişi paylaşılmaz',
  ];

  const headline =
    effectiveMode === 'demo'
      ? 'Güvenli Mod: Örnek Veri Paylaşılır'
      : 'Kişisel Değerler Seçili (Tarayıcı Oturumuna Bağlı)';

  const boundaryNote =
    effectiveMode === 'demo'
      ? 'Varsayılan gömme kodu hiçbir kişisel portföy verisini içermez; herkese açık sayfalarda güvenle kullanılabilir.'
      : 'Bu bağlantı yalnızca sizin aktif StockMind oturumunuzun bulunduğu tarayıcıda kişisel değerleri gösterir; başka kişiler kendi tarayıcılarında yalnızca örnek veri görür.';

  return {
    effectiveMode,
    requiresConsentConfirmation,
    canExport: !requiresConsentConfirmation,
    url,
    headline,
    boundaryNote,
    sharedFields,
    neverShared,
  };
}

export function isWidgetPrivacyQuery(searchParams: { get(name: string): string | null }): boolean {
  const privacy = searchParams.get('privacy');
  return privacy === '1' || privacy === 'true';
}
