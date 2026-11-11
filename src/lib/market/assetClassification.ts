export type AssetKind =
  | 'stock'
  | 'etf'
  | 'fund'
  | 'index'
  | 'forex'
  | 'commodity'
  | 'crypto';

export type AssetKindLabel =
  | 'Hisse'
  | 'ETF'
  | 'Fon'
  | 'Endeks'
  | 'Döviz'
  | 'Emtia'
  | 'Kripto';

// US and Global ETFs (Traded on NASDAQ / NYSE / CBOE / etc.)
export const US_ETFS = new Set([
  'QQQ', 'TQQQ', 'SQQQ', 'SPY', 'VOO', 'IVV', 'VTI', 'DIA', 'IWM', 'RSP', 'VT',
  'XLK', 'XLE', 'XLF', 'XLV', 'XLI', 'XLY', 'XLP', 'XLU', 'XLB', 'XLRE', 'XLC',
  'SOXX', 'SMH', 'SOXL', 'SOXS', 'VGT', 'ARKK', 'ARKG', 'ARKW', 'BOTZ', 'CIBR',
  'IGV', 'SKYY', 'SCHD', 'JEPI', 'JEPQ', 'VYM', 'HDV', 'DGRO', 'TLT', 'IEF',
  'SHY', 'BND', 'AGG', 'GLD', 'SLV', 'IAU', 'USO', 'UNG', 'BITO', 'IBIT',
  'FBTC', 'ETHE', 'FETH', 'VXUS', 'VEA', 'VWO', 'EEM', 'FXI', 'INDA', 'EWJ',
  'EWG', 'EWZ', 'UPRO', 'SPXU', 'SSO', 'SDS', 'QLD', 'PSQ', 'TNA', 'TZA',
]);

// BIST Borsa Yatırım Fonları (BYF / BIST ETFs)
export const BIST_ETFS = new Set([
  'GLDTR', 'GMSTR', 'ZGOLD', 'USDTR', 'EURTR', 'FNBTR', 'IST30', 'ZPBDL', 'ZPLIB', 'KZLGY', 'SLVTR',
]);

export const INDEX_SYMBOLS = new Set([
  'XU100', 'XU030', 'XU050', 'XBANK', 'XUSIN', 'XUHIZ', 'XHOLD', 'XKMYA', 'XULAS',
  'XUTEK', 'XELKT', 'XGIDA', 'XTCRT', 'XGMYO', 'XBLSM', 'XMADN', 'XSGRT', 'XTRZM',
  'SPX', 'NDX', 'DJI', 'RUT', 'DXY', 'VIX', 'DAX', 'FTSE', 'CAC40', 'STOXX50',
  'N225', 'HSI', 'KOSPI', 'AORD', 'BVSP',
]);

export const GRAM_GOLD_SYMBOLS = new Set([
  'GA', 'XAUTRY', 'XAUTRYG', 'GRAM_ALTIN', 'GRAM ALTIN', 'ALTIN',
]);

export function normalizeCleanAssetSymbol(symbol?: string | null): string {
  return String(symbol || '')
    .replace(/^(BIST|NASDAQ|NYSE|US|TEFAS|FON|IST):/i, '')
    .replace(/\.(IS|E|TI|BIST)$/i, '')
    .toUpperCase()
    .trim();
}

export function isEtfSymbol(symbol?: string | null): boolean {
  const s = normalizeCleanAssetSymbol(symbol);
  return US_ETFS.has(s) || BIST_ETFS.has(s);
}

export function isIndexSymbol(symbol?: string | null): boolean {
  const s = normalizeCleanAssetSymbol(symbol);
  return INDEX_SYMBOLS.has(s);
}

export function isGramGoldSymbol(symbol?: string | null): boolean {
  const s = String(symbol || '').trim().toUpperCase();
  return GRAM_GOLD_SYMBOLS.has(s);
}

export function classifyAssetType(input: {
  symbol?: string | null;
  code?: string | null;
  exchange?: string | null;
  assetType?: string | null;
  kind?: string | null;
  isIndex?: boolean;
}): { kind: AssetKind; label: AssetKindLabel } {
  const s = normalizeCleanAssetSymbol(input.symbol || input.code);
  const rawType = (input.assetType || '').trim().toLowerCase();
  const rawKind = (input.kind || '').trim().toLowerCase();
  const rawExchange = (input.exchange || '').trim().toUpperCase();

  if (
    input.isIndex ||
    rawExchange === 'INDEX' ||
    rawType === 'index' ||
    rawKind === 'endeks' ||
    isIndexSymbol(s)
  ) {
    return { kind: 'index', label: 'Endeks' };
  }

  if (rawExchange === 'CRYPTO' || rawType === 'crypto' || rawKind === 'kripto') {
    return { kind: 'crypto', label: 'Kripto' };
  }

  if (
    rawExchange === 'COMMODITY' ||
    rawType === 'commodity' ||
    rawKind === 'emtia' ||
    isGramGoldSymbol(s)
  ) {
    return { kind: 'commodity', label: 'Emtia' };
  }

  if (rawExchange === 'FOREX' || rawType === 'forex' || rawKind === 'döviz' || rawKind === 'doviz') {
    return { kind: 'forex', label: 'Döviz' };
  }

  if (rawType === 'etf' || rawKind === 'etf' || isEtfSymbol(s)) {
    return { kind: 'etf', label: 'ETF' };
  }

  if (rawType === 'fund' || rawKind === 'fon' || rawExchange === 'TEFAS') {
    return { kind: 'fund', label: 'Fon' };
  }

  return { kind: 'stock', label: 'Hisse' };
}

export function resolveAssetDisplayUnit(input: {
  symbol?: string | null;
  exchange?: string | null;
  currency?: string | null;
  unit?: string | null;
  isIndex?: boolean;
}): string {
  const rawUnit = (input.unit || '').trim();
  const lowerUnit = rawUnit.toLowerCase();
  if (
    input.isIndex ||
    (input.exchange || '').toUpperCase() === 'INDEX' ||
    isIndexSymbol(input.symbol) ||
    lowerUnit === 'points' ||
    lowerUnit === 'puan'
  ) {
    return 'puan';
  }

  if (
    isGramGoldSymbol(input.symbol) ||
    lowerUnit === 'tl/gram' ||
    lowerUnit === 'tl / gram'
  ) {
    return 'TL/gram';
  }

  if (rawUnit) return rawUnit;

  const currency = (input.currency || '').trim().toUpperCase();
  if (currency === 'TRY') return 'TL';
  if (currency === 'USD') return 'USD';
  if (currency === 'EUR') return 'EUR';
  if (currency === 'USDT') return 'USDT';
  return currency || 'TL';
}

export function formatAssetUnitPrice(input: {
  value: number;
  symbol?: string | null;
  exchange?: string | null;
  currency?: string | null;
  unit?: string | null;
  isIndex?: boolean;
}): string {
  const unit = resolveAssetDisplayUnit(input);
  const abs = Math.abs(input.value);
  const isForex = (input.exchange || '').toUpperCase() === 'FOREX';
  const decimals = abs > 0 && abs < 0.001 ? 6 : abs > 0 && abs < 1 ? 4 : isForex ? 4 : 2;
  const formattedNumber = input.value.toLocaleString('tr-TR', {
    minimumFractionDigits: Math.min(2, decimals),
    maximumFractionDigits: decimals,
  });

  if (unit === 'puan') {
    return `${formattedNumber} puan`;
  }
  if (unit === 'TL/gram') {
    return `${formattedNumber} TL/gram`;
  }
  const currency = (input.currency || 'TRY').trim().toUpperCase();
  if (currency === 'USDT') {
    return `${formattedNumber} USDT`;
  }
  const prefix = currency === 'TRY' ? '₺' : currency === 'EUR' ? '€' : '$';
  return `${prefix}${formattedNumber}`;
}
