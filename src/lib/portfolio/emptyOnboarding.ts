export type EmptyPortfolioActionId = 'first_trade' | 'excel_import' | 'sample_portfolio';

export interface EmptyPortfolioActionSpec {
  id: EmptyPortfolioActionId;
  title: string;
  description: string;
  ctaLabel: string;
}

export const EMPTY_PORTFOLIO_ACTIONS: readonly EmptyPortfolioActionSpec[] = [
  {
    id: 'first_trade',
    title: 'İlk İşlem Kaydı',
    description: 'BIST, ABD borsası, TEFAS fonu veya nakit girişi ekleyin.',
    ctaLabel: 'İlk İşlemi Kaydet',
  },
  {
    id: 'excel_import',
    title: 'Excel / CSV Yükle',
    description: 'Aracı kurum ekstrenizi veya şablon dosyanızı tek adımda içe aktarın.',
    ctaLabel: 'Dosya Seç & Yükle',
  },
  {
    id: 'sample_portfolio',
    title: 'Örnek Portföyü İncele',
    description: 'Kendi kayıtlarınıza dokunmadan hazır BIST, ABD hisse ve fon portföyünü gezin.',
    ctaLabel: 'Örnek Portföyü Aç',
  },
] as const;

export function shouldShowEmptyOnboarding(params: {
  loading: boolean;
  holdingsCount: number;
  transactionsCount: number;
  hasCash: boolean;
}): boolean {
  if (params.loading) return false;
  return params.holdingsCount === 0 && params.transactionsCount === 0 && !params.hasCash;
}
