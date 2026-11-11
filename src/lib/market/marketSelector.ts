export type MarketId =
  | 'ALL'
  | 'BIST'
  | 'TEFAS'
  | 'ABD'
  | 'COMMODITY'
  | 'CRYPTO'
  | 'FOREX'
  | 'INDEX'
  | 'NASDAQ'
  | 'NYSE';

export interface MarketCatalogOption {
  id: MarketId;
  label: string;
  shortLabel: string;
  icon: string;
  name: string;
  mobilePrimary?: boolean;
}

export const MARKET_CATALOG: readonly MarketCatalogOption[] = [
  { id: 'BIST', label: 'BIST', shortLabel: 'BIST', icon: '🇹🇷', name: 'Borsa İstanbul', mobilePrimary: true },
  { id: 'TEFAS', label: 'TEFAS', shortLabel: 'TEFAS', icon: '📊', name: 'Yatırım Fonları', mobilePrimary: true },
  { id: 'ABD', label: 'ABD', shortLabel: 'ABD', icon: '🇺🇸', name: 'ABD Borsaları (NASDAQ & NYSE)', mobilePrimary: true },
  { id: 'ALL', label: 'Tüm Piyasalar', shortLabel: 'Tümü', icon: '🌟', name: 'Canlı Finans Özeti', mobilePrimary: true },
  { id: 'COMMODITY', label: 'Emtia & Altın', shortLabel: 'Emtia', icon: '🪙', name: 'Kıymetli Madenler' },
  { id: 'CRYPTO', label: 'Kripto', shortLabel: 'Kripto', icon: '₿', name: 'Kripto Paralar' },
  { id: 'FOREX', label: 'Döviz', shortLabel: 'Döviz', icon: '💱', name: 'Döviz Kurları' },
  { id: 'INDEX', label: 'Endeksler', shortLabel: 'Endeks', icon: '🌍', name: 'Küresel Endeksler' },
  { id: 'NASDAQ', label: 'NASDAQ', shortLabel: 'NASDAQ', icon: '🇺🇸', name: 'NASDAQ' },
  { id: 'NYSE', label: 'NYSE', shortLabel: 'NYSE', icon: '🏛️', name: 'NYSE' },
] as const;

export const MOBILE_PRIMARY_MARKETS: readonly MarketCatalogOption[] = MARKET_CATALOG.filter(
  (m) => m.mobilePrimary === true
);

export function normalizeMarketParam(rawParam?: string | null): MarketId {
  const upper = (rawParam || 'ALL').trim().toUpperCase();
  if (!upper || upper === 'ALL' || upper === 'OZET' || upper === 'TUMU') return 'ALL';
  if (upper === 'BIST') return 'BIST';
  if (upper === 'FUNDS' || upper === 'TEFAS') return 'TEFAS';
  if (upper === 'ABD' || upper === 'US' || upper === 'USA') return 'ABD';
  if (upper === 'COMMODITY' || upper === 'EMTIA' || upper === 'ALTIN') return 'COMMODITY';
  if (upper === 'CRYPTO' || upper === 'KRIPTO') return 'CRYPTO';
  if (upper === 'FOREX' || upper === 'DOVIZ' || upper === 'FX') return 'FOREX';
  if (upper === 'INDEX' || upper === 'ENDEKS') return 'INDEX';
  if (upper === 'NASDAQ') return 'NASDAQ';
  if (upper === 'NYSE') return 'NYSE';
  return 'BIST';
}

export function matchesMarketExchangeFilter(
  stockExchange?: string | null,
  requestedExchange?: string | null
): boolean {
  const req = (requestedExchange || '').trim().toUpperCase();
  if (!req || req === 'ALL') return true;

  const ex = (stockExchange || '').trim().toUpperCase();
  if (req === 'ABD' || req === 'US' || req === 'USA') {
    return ex === 'NASDAQ' || ex === 'NYSE';
  }
  return ex === req;
}
