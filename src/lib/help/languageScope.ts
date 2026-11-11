export interface SupportedLanguageEntry {
  code: 'tr';
  nativeName: string;
  locale: 'tr-TR';
  status: 'supported';
  coverage: string;
  notes: string;
}

export const SUPPORTED_LANGUAGES: readonly SupportedLanguageEntry[] = [
  {
    code: 'tr',
    nativeName: 'Türkçe',
    locale: 'tr-TR',
    status: 'supported',
    coverage: 'Tam kapsam (%100 arayüz, BIST, TEFAS, ABD hisseleri, alarmlar, bülten ve AI analizleri)',
    notes:
      'Uluslararası borsa sembolleri (NASDAQ/NYSE), finansal kısaltmalar (FCF, WACC, ROE) ve KAP doküman başlıkları özgün uluslararası/resmî adlarıyla korunur.',
  },
] as const;

export const LANGUAGE_SCOPE_DECISION = {
  primaryLocale: 'tr-TR',
  supportedCodes: ['tr'] as const,
  englishUiSupported: false,
  decisionSummary:
    'StockMind şu aşamada yalnızca Türkçe (tr) arayüz diliyle tek dil kapsamında sunulmaktadır. İngilizce arayüz vaadi veya yarım çeviri yerine tüm temel akışların eksiksiz Türkçe kalitesi hedeflenmektedir.',
  settingsLinkHref: '/settings',
  helpRouteHref: '/help',
} as const;

export function getSupportedLanguageCodes(): string[] {
  return SUPPORTED_LANGUAGES.map((lang) => lang.code);
}
