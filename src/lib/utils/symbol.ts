import TEFAS_DIRECTORY from '@/lib/data/tefas_funds_directory.json';
import { POPULAR_ALIASES, normalizeText } from '@/lib/utils/search';

const tefasList: any[] = Array.isArray(TEFAS_DIRECTORY)
  ? TEFAS_DIRECTORY
  : (TEFAS_DIRECTORY as any)?.default && Array.isArray((TEFAS_DIRECTORY as any).default)
  ? (TEFAS_DIRECTORY as any).default
  : [];
const TEFAS_SET = new Set(tefasList.map((f) => String(f.code || '').toUpperCase()));

// US and Global ETFs (Traded on NASDAQ / NYSE / CBOE / etc.)
export const US_ETFS = new Set([
  'QQQ', 'TQQQ', 'SQQQ', 'SPY', 'VOO', 'IVV', 'VTI', 'DIA', 'IWM', 'RSP', 'VT',
  'XLK', 'XLE', 'XLF', 'XLV', 'XLI', 'XLY', 'XLP', 'XLU', 'XLB', 'XLRE', 'XLC',
  'SOXX', 'SMH', 'SOXL', 'SOXS', 'VGT', 'ARKK', 'ARKG', 'ARKW', 'BOTZ', 'CIBR',
  'IGV', 'SKYY', 'SCHD', 'JEPI', 'JEPQ', 'VYM', 'HDV', 'DGRO', 'TLT', 'IEF',
  'SHY', 'BND', 'AGG', 'GLD', 'SLV', 'IAU', 'USO', 'UNG', 'BITO', 'IBIT',
  'FBTC', 'ETHE', 'FETH', 'VXUS', 'VEA', 'VWO', 'EEM', 'FXI', 'INDA', 'EWJ',
  'EWG', 'EWZ', 'UPRO', 'SPXU', 'SSO', 'SDS', 'QLD', 'PSQ', 'TNA', 'TZA'
]);

// BIST Borsa Yatırım Fonları (BYF / BIST ETFs)
export const BIST_ETFS = new Set([
  'GLDTR', 'GMSTR', 'ZGOLD', 'USDTR', 'EURTR', 'FNBTR', 'IST30', 'ZPBDL', 'ZPLIB', 'KZLGY', 'SLVTR'
]);

// Popular US Stocks (NASDAQ & NYSE)
export const US_STOCKS = new Set([
  'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'GOOG', 'AMZN', 'META', 'TSLA', 'PLTR', 'AMD',
  'NFLX', 'INTC', 'COIN', 'AVGO', 'CRM', 'ADBE', 'PYPL', 'UBER', 'ABNB', 'DIS',
  'BA', 'JPM', 'V', 'MA', 'WMT', 'PG', 'JNJ', 'XOM', 'CVX', 'KO', 'PEP', 'MCD',
  'NKE', 'LLY', 'UNH', 'COST', 'HD', 'BABA', 'NIO', 'TSM', 'ASML', 'ARM', 'PANW',
  'CRWD', 'SNOW', 'MSTR', 'HOOD', 'SHOP', 'SQ', 'ROKU', 'MARA', 'RIOT', 'CLSK',
  'RIVN', 'LCID', 'SOFI', 'BAC', 'C', 'GS', 'MS', 'QCOM', 'TXN', 'MU', 'LRCX',
  'KLAC', 'AMAT', 'INTU', 'NOW', 'SNPS', 'CDNS', 'MRVL', 'ORCL', 'IBM', 'BRK.B',
  'BRK.A', 'CAT', 'GE', 'DE', 'RTX', 'LMT', 'HON', 'MMM', 'UPS', 'FDX'
]);

export function isEtfSymbol(symbol: string): boolean {
  const s = String(symbol || '')
    .replace(/^(BIST|NASDAQ|NYSE|US|TEFAS|FON|IST):/, '')
    .replace(/\.(IS|E|TI|BIST)$/i, '')
    .toUpperCase()
    .trim();
  return US_ETFS.has(s) || BIST_ETFS.has(s);
}

export function isUsSymbol(symbol: string): boolean {
  const s = String(symbol || '')
    .replace(/^(BIST|NASDAQ|NYSE|US|TEFAS|FON|IST):/, '')
    .replace(/\.(IS|E|TI|BIST)$/i, '')
    .toUpperCase()
    .trim();
  return US_ETFS.has(s) || US_STOCKS.has(s);
}

export interface AssetDisplayInfo {
  typeLabel: string;      // 'ETF' | 'Fon' | 'Hisse' | 'Kripto' | 'Emtia'
  badgeLabel: string;     // 'ABD ETF' | 'BIST ETF' | 'TEFAS Fon' | 'ABD Hisse' | 'BIST Hisse'
  badgeColor: string;     // styling classes
  badgeIcon: string;      // emoji icon
  exchangeLabel: string;  // 'NASDAQ' | 'NYSE' | 'Borsa İstanbul' | 'TEFAS'
  isEtf: boolean;
  isUs: boolean;
}

export function getAssetTypeLabel(item: {
  symbol: string;
  assetType?: string;
  exchange?: string | null;
  currency?: string;
  originalCurrency?: string;
}): AssetDisplayInfo {
  const s = String(item.symbol || '')
    .replace(/^(BIST|NASDAQ|NYSE|US|TEFAS|FON|IST):/, '')
    .replace(/\.(IS|E|TI|BIST)$/i, '')
    .toUpperCase()
    .trim();
  const isEtf = isEtfSymbol(s);
  const isUs =
    isUsSymbol(s) ||
    (item.originalCurrency || '').toUpperCase() === 'USD' ||
    (item.currency || '').toUpperCase() === 'USD' ||
    item.exchange === 'NASDAQ' ||
    item.exchange === 'NYSE';

  if (isEtf) {
    const isUsEtf = isUs || !BIST_ETFS.has(s);
    return {
      typeLabel: 'ETF',
      badgeLabel: isUsEtf ? 'ABD ETF' : 'BIST ETF',
      badgeColor: isUsEtf ? 'bg-sky-500/15 border-sky-500/30 text-sky-300' : 'bg-amber-500/15 border-amber-500/30 text-amber-300',
      badgeIcon: '⚡',
      exchangeLabel: isUsEtf ? (item.exchange && item.exchange !== 'BIST' ? item.exchange : 'NASDAQ') : 'Borsa İstanbul (BYF)',
      isEtf: true,
      isUs: isUsEtf,
    };
  }

  if (item.assetType === 'fund' || item.exchange === 'TEFAS' || (s.length === 3 && TEFAS_SET.has(s))) {
    return {
      typeLabel: 'Fon',
      badgeLabel: 'TEFAS Fon',
      badgeColor: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300',
      badgeIcon: '📈',
      exchangeLabel: 'TEFAS',
      isEtf: false,
      isUs: false,
    };
  }

  if (isUs) {
    return {
      typeLabel: 'Hisse',
      badgeLabel: 'ABD Hisse',
      badgeColor: 'bg-blue-500/15 border-blue-500/30 text-blue-300',
      badgeIcon: '🌐',
      exchangeLabel: item.exchange && item.exchange !== 'BIST' ? item.exchange : 'NASDAQ',
      isEtf: false,
      isUs: true,
    };
  }

  if (item.exchange === 'CRYPTO') {
    return {
      typeLabel: 'Kripto',
      badgeLabel: 'Kripto',
      badgeColor: 'bg-orange-500/15 border-orange-500/30 text-orange-300',
      badgeIcon: '🪙',
      exchangeLabel: 'Kripto',
      isEtf: false,
      isUs: false,
    };
  }

  if (item.exchange === 'COMMODITY') {
    return {
      typeLabel: 'Emtia',
      badgeLabel: 'Emtia',
      badgeColor: 'bg-yellow-500/15 border-yellow-500/30 text-yellow-300',
      badgeIcon: '🥇',
      exchangeLabel: 'Emtia',
      isEtf: false,
      isUs: false,
    };
  }

  return {
    typeLabel: 'Hisse',
    badgeLabel: 'BIST Hisse',
    badgeColor: 'bg-violet-500/15 border-violet-500/30 text-violet-300',
    badgeIcon: '📊',
    exchangeLabel: item.exchange && item.exchange !== 'TEFAS' ? item.exchange : 'Borsa İstanbul',
    isEtf: false,
    isUs: false,
  };
}

/**
 * Cleans broker prefixes (FON:, IST:, MUTF:, BIST:, etc.), ISIN codes, suffixes (.IS, .E)
 * and detects asset type & exchange. Also maps company names to tickers.
 */
export function cleanSymbol(sym: string): { symbol: string; assetType: 'stock' | 'fund'; exchange: string } {
  let raw = String(sym || '').replace(/['"“”]/g, '').trim().toUpperCase();
  let assetType: 'stock' | 'fund' = 'stock';
  let exchange = 'BIST';

  if (!raw) {
    return { symbol: '', assetType: 'stock', exchange: 'BIST' };
  }

  // 1. Detect and unpack Turkish ISIN codes (e.g. TRATHYAO91M5 -> THYAO, TRAASELS91H2 -> ASELS)
  const isinMatch = raw.match(/^TR[AE]([A-Z0-9]{4,5})[0-9A-Z]{3,4}$/i);
  if (isinMatch && isinMatch[1]) {
    raw = isinMatch[1].toUpperCase();
  }

  // 2. Strip prefixes (FON:, IST:, BIST:, NASDAQ:, etc.)
  if (raw.startsWith('FON:') || raw.startsWith('MUTF:') || raw.startsWith('TEFAS:')) {
    raw = raw.replace(/^(FON|MUTF|TEFAS):/, '').trim();
    assetType = 'fund';
    exchange = 'TEFAS';
  } else if (raw.startsWith('IST:') || raw.startsWith('BIST:') || raw.startsWith('TRA:')) {
    raw = raw.replace(/^(IST|BIST|TRA):/, '').trim();
    assetType = 'stock';
    exchange = 'BIST';
  } else if (raw.startsWith('NASDAQ:') || raw.startsWith('NYSE:') || raw.startsWith('US:')) {
    raw = raw.replace(/^(NASDAQ|NYSE|US):/, '').trim();
    assetType = 'stock';
    exchange = 'NASDAQ';
  }

  // 3. Strip trailing suffixes (.IS, .E, .TI, .BIST)
  // Note: .E is the official Borsa Istanbul equity suffix (e.g. THYAO.E, GARAN.E)
  raw = raw.replace(/\.(IS|E|TI|BIST)$/i, '').trim();

  // 4. Alias checks for commodities and certificates
  if (raw === 'ALTIN' || raw === 'ALTIN.S1' || raw === 'ALTINS1' || raw === 'ALTIN_S1') {
    return { symbol: 'ALTIN', assetType: 'stock', exchange: 'BIST' };
  }
  if (
    raw === 'GRAM_ALTIN' ||
    raw === 'GRAM ALTIN' ||
    raw === 'GRAM-ALTIN' ||
    raw === 'GA' ||
    raw === 'XAUTRYG' ||
    raw === 'XAUTRY'
  ) {
    return { symbol: 'XAUTRYG', assetType: 'stock', exchange: 'COMMODITY' };
  }
  if (raw === 'CEYREK' || raw === 'CEYREK ALTIN' || raw === 'CEYREK_ALTIN') {
    return { symbol: 'CEYREK_ALTIN', assetType: 'stock', exchange: 'COMMODITY' };
  }
  if (raw === 'YARIM' || raw === 'YARIM ALTIN' || raw === 'YARIM_ALTIN') {
    return { symbol: 'YARIM_ALTIN', assetType: 'stock', exchange: 'COMMODITY' };
  }
  if (raw === 'CUMHURIYET' || raw === 'CUMHURIYET ALTINI' || raw === 'CUMHURIYET_ALTINI') {
    return { symbol: 'CUMHURIYET_ALTINI', assetType: 'stock', exchange: 'COMMODITY' };
  }
  if (raw === 'ATA' || raw === 'ATA ALTIN' || raw === 'ATA_ALTIN') {
    return { symbol: 'ATA_ALTIN', assetType: 'stock', exchange: 'COMMODITY' };
  }
  if (raw === 'BILEZIK22' || raw === '22 AYAR BILEZIK') {
    return { symbol: 'BILEZIK22', assetType: 'stock', exchange: 'COMMODITY' };
  }
  if (raw === 'GUMUS' || raw === 'GUMUS.S1' || raw === 'GUMUSS1' || raw === 'GUMUS_S1') {
    return { symbol: 'GUMUS', assetType: 'stock', exchange: 'BIST' };
  }
  if (
    raw === 'GRAM_GUMUS' ||
    raw === 'GRAM GUMUS' ||
    raw === 'GRAM-GUMUS' ||
    raw === 'XAGTRYG' ||
    raw === 'XAGTRY'
  ) {
    return { symbol: 'XAGTRYG', assetType: 'stock', exchange: 'COMMODITY' };
  }
  if (raw === 'BTC' || raw === 'BITCOIN') {
    return { symbol: 'BTCUSDT', assetType: 'stock', exchange: 'CRYPTO' };
  }
  if (raw === 'ETH' || raw === 'ETHEREUM') {
    return { symbol: 'ETHUSDT', assetType: 'stock', exchange: 'CRYPTO' };
  }

  // 5. If raw is already an exact ticker key, don't alias-match it
  if (!Object.prototype.hasOwnProperty.call(POPULAR_ALIASES, raw)) {
    // If raw looks like a full company name rather than a ticker (contains space or > 5 chars)
    // Attempt to resolve via POPULAR_ALIASES
    if (raw.includes(' ') || raw.length > 5) {
      const norm = normalizeText(raw);
      for (const [ticker, aliases] of Object.entries(POPULAR_ALIASES)) {
        if (aliases.some((a) => {
          const normA = normalizeText(a);
          return norm === normA || (raw.includes(' ') && norm.includes(normA));
        })) {
          raw = ticker;
          break;
        }
      }
    }
  }

  // 6. Check if symbol is in TEFAS directory, US ETFs, BIST ETFs, or US Stocks
  if (TEFAS_SET.has(raw)) {
    assetType = 'fund';
    exchange = 'TEFAS';
  } else if (US_ETFS.has(raw)) {
    assetType = 'stock';
    exchange = 'NASDAQ';
  } else if (BIST_ETFS.has(raw)) {
    assetType = 'stock';
    exchange = 'BIST';
  } else if (US_STOCKS.has(raw)) {
    assetType = 'stock';
    exchange = (raw === 'BRK.B' || raw === 'JPM' || raw === 'V' || raw === 'WMT' || raw === 'KO' || raw === 'DIS') ? 'NYSE' : 'NASDAQ';
  }

  return { symbol: raw, assetType, exchange };
}

/**
 * Normalizes symbol lookup key (handles aliases like GRAM_ALTIN, ALTIN, XAUTRYG)
 */
export function normalizeSymbolKey(sym: string): string {
  const { symbol } = cleanSymbol(sym);
  if (symbol === 'GRAM_ALTIN') return 'XAUTRYG';
  if (symbol === 'GRAM_GUMUS') return 'XAGTRYG';
  return symbol;
}

/**
 * Normalizes an instrument identity into a standardized `EXCHANGE:SYMBOL` identifier (DATA-07).
 * Examples:
 *  'THYAO' -> 'BIST:THYAO'
 *  'TI2'   -> 'TEFAS:TI2'
 *  'AAPL' (NASDAQ) -> 'NASDAQ:AAPL'
 *  'BTC'   -> 'CRYPTO:BTCUSDT'
 */
export function normalizeInstrumentId(rawSymbol: string, fallbackExchange?: string): string {
  if (!rawSymbol) return '';
  const trimmed = rawSymbol.trim();
  if (trimmed.includes(':')) {
    const [ex, sym] = trimmed.split(':');
    const cleaned = cleanSymbol(sym);
    const resolvedEx = (ex || fallbackExchange || cleaned.exchange || 'BIST').toUpperCase();
    return `${resolvedEx}:${cleaned.symbol}`;
  }

  const cleaned = cleanSymbol(trimmed);
  if (!cleaned.symbol) return '';
  const effExchange = (fallbackExchange || cleaned.exchange || 'BIST').toUpperCase();
  return `${effExchange}:${cleaned.symbol}`;
}

/**
 * Parses an instrument identifier back into its exchange and ticker symbol components.
 */
export function parseInstrumentId(instrumentId: string): { exchange: string; symbol: string } {
  if (!instrumentId) return { exchange: 'BIST', symbol: '' };
  const parts = instrumentId.split(':');
  if (parts.length >= 2) {
    return {
      exchange: parts[0].toUpperCase().trim(),
      symbol: parts.slice(1).join(':').toUpperCase().trim(),
    };
  }
  const cleaned = cleanSymbol(instrumentId);
  return { exchange: cleaned.exchange, symbol: cleaned.symbol };
}
