import TEFAS_DIRECTORY from '@/lib/data/tefas_funds_directory.json';
import { POPULAR_ALIASES, normalizeText } from '@/lib/utils/search';
import {
  US_ETFS,
  BIST_ETFS,
  INDEX_SYMBOLS,
  isEtfSymbol,
  classifyAssetType,
} from '@/lib/market/assetClassification';

export { US_ETFS, BIST_ETFS, isEtfSymbol };

const tefasList: any[] = Array.isArray(TEFAS_DIRECTORY)
  ? TEFAS_DIRECTORY
  : (TEFAS_DIRECTORY as any)?.default && Array.isArray((TEFAS_DIRECTORY as any).default)
  ? (TEFAS_DIRECTORY as any).default
  : [];
const TEFAS_SET = new Set(tefasList.map((f) => String(f.code || '').toUpperCase()));

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
    .replace(/^(BIST|NASDAQ|NYSE|US|TEFAS|FON|IST|INDEX|IDX|CRYPTO|FOREX|COMMODITY):/, '')
    .replace(/\.(IS|E|TI|BIST)$/i, '')
    .toUpperCase()
    .trim();
  const hasExplicitNonUsExchange =
    item.exchange === 'BIST' || item.exchange === 'TEFAS' || item.exchange === 'INDEX';
  const isEtf = isEtfSymbol(s) && (!hasExplicitNonUsExchange || BIST_ETFS.has(s));
  const isUs =
    (!hasExplicitNonUsExchange && isUsSymbol(s)) ||
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

  const { kind } = classifyAssetType({
    symbol: s,
    assetType: item.assetType,
    exchange: item.exchange,
  });

  if (kind === 'etf') {
    const explicitlyBistEtf = BIST_ETFS.has(s) || item.exchange === 'BIST';
    const isUsEtf = !explicitlyBistEtf;
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

  if (kind === 'fund') {
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

  if (kind === 'index') {
    return {
      typeLabel: 'Endeks',
      badgeLabel: 'Endeks',
      badgeColor: 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300',
      badgeIcon: '📊',
      exchangeLabel: 'Endeks',
      isEtf: false,
      isUs: false,
    };
  }

  if (kind === 'forex') {
    return {
      typeLabel: 'Döviz',
      badgeLabel: 'Döviz',
      badgeColor: 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300',
      badgeIcon: '💱',
      exchangeLabel: 'Döviz',
      isEtf: false,
      isUs: false,
    };
  }

  if (kind === 'crypto') {
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

  if (kind === 'commodity') {
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
  const parsed = parseQualifiedSymbol(sym);
  return {
    symbol: parsed.symbol,
    assetType: parsed.assetType,
    exchange: parsed.exchange,
  };
}

export function parseQualifiedSymbol(
  sym: string,
  explicitExchangeHint?: string | null,
): {
  symbol: string;
  assetType: 'stock' | 'fund';
  exchange: string;
  instrumentId: string;
  hasExplicitExchange: boolean;
} {
  let raw = String(sym || '').replace(/['"“”]/g, '').trim().toUpperCase();
  let assetType: 'stock' | 'fund' = 'stock';
  let exchange = 'BIST';
  let hasExplicitExchange = false;

  if (!raw) {
    return { symbol: '', assetType: 'stock', exchange: 'BIST', instrumentId: '', hasExplicitExchange: false };
  }

  // 1. Detect and unpack Turkish ISIN codes (e.g. TRATHYAO91M5 -> THYAO, TRAASELS91H2 -> ASELS)
  const isinMatch = raw.match(/^TR[AE]([A-Z0-9]{4,5})[0-9A-Z]{3,4}$/i);
  if (isinMatch && isinMatch[1]) {
    raw = isinMatch[1].toUpperCase();
    exchange = 'BIST';
    hasExplicitExchange = true;
  }

  // 2. Strip explicit prefixes (FON:, IST:, BIST:, NYSE:, NASDAQ:, INDEX:, etc.) and lock exchange
  if (raw.startsWith('FON:') || raw.startsWith('MUTF:') || raw.startsWith('TEFAS:')) {
    raw = raw.replace(/^(FON|MUTF|TEFAS):/, '').trim();
    assetType = 'fund';
    exchange = 'TEFAS';
    hasExplicitExchange = true;
  } else if (raw.startsWith('IST:') || raw.startsWith('BIST:') || raw.startsWith('TRA:')) {
    raw = raw.replace(/^(IST|BIST|TRA):/, '').trim();
    assetType = 'stock';
    exchange = 'BIST';
    hasExplicitExchange = true;
  } else if (raw.startsWith('NYSE:')) {
    raw = raw.replace(/^NYSE:/, '').trim();
    assetType = 'stock';
    exchange = 'NYSE';
    hasExplicitExchange = true;
  } else if (raw.startsWith('NASDAQ:')) {
    raw = raw.replace(/^NASDAQ:/, '').trim();
    assetType = 'stock';
    exchange = 'NASDAQ';
    hasExplicitExchange = true;
  } else if (raw.startsWith('US:')) {
    raw = raw.replace(/^US:/, '').trim();
    assetType = 'stock';
    exchange = 'NASDAQ';
    hasExplicitExchange = true;
  } else if (raw.startsWith('INDEX:') || raw.startsWith('IDX:')) {
    raw = raw.replace(/^(INDEX|IDX):/, '').trim();
    assetType = 'stock';
    exchange = 'INDEX';
    hasExplicitExchange = true;
  } else if (raw.startsWith('CRYPTO:')) {
    raw = raw.replace(/^CRYPTO:/, '').trim();
    assetType = 'stock';
    exchange = 'CRYPTO';
    hasExplicitExchange = true;
  } else if (raw.startsWith('FOREX:')) {
    raw = raw.replace(/^FOREX:/, '').trim();
    assetType = 'stock';
    exchange = 'FOREX';
    hasExplicitExchange = true;
  } else if (raw.startsWith('COMMODITY:')) {
    raw = raw.replace(/^COMMODITY:/, '').trim();
    assetType = 'stock';
    exchange = 'COMMODITY';
    hasExplicitExchange = true;
  }

  // 3. Strip trailing suffixes (.IS, .E, .TI, .BIST) and treat BIST suffixes as explicit BIST exchange
  if (/\.(IS|E|BIST)$/i.test(raw)) {
    raw = raw.replace(/\.(IS|E|BIST)$/i, '').trim();
    if (!hasExplicitExchange) {
      assetType = 'stock';
      exchange = 'BIST';
      hasExplicitExchange = true;
    }
  } else {
    raw = raw.replace(/\.TI$/i, '').trim();
  }

  // Apply explicit caller exchange hint only when symbol itself did not carry a prefix/suffix
  const normalizedHint = explicitExchangeHint ? explicitExchangeHint.trim().toUpperCase() : '';
  if (!hasExplicitExchange && normalizedHint) {
    exchange = normalizedHint;
    assetType = normalizedHint === 'TEFAS' ? 'fund' : 'stock';
    hasExplicitExchange = true;
  }

  // 4. Alias checks for commodities and crypto (unless caller locked a stock/fund exchange explicitly)
  if (!hasExplicitExchange || exchange === 'COMMODITY') {
    if (raw === 'ALTIN' || raw === 'ALTIN.S1' || raw === 'ALTINS1' || raw === 'ALTIN_S1') {
      return { symbol: 'ALTIN', assetType: 'stock', exchange: 'BIST', instrumentId: 'BIST:ALTIN', hasExplicitExchange };
    }
    if (
      raw === 'GRAM_ALTIN' ||
      raw === 'GRAM ALTIN' ||
      raw === 'GRAM-ALTIN' ||
      raw === 'GA' ||
      raw === 'XAUTRYG' ||
      raw === 'XAUTRY'
    ) {
      return { symbol: 'XAUTRYG', assetType: 'stock', exchange: 'COMMODITY', instrumentId: 'COMMODITY:XAUTRYG', hasExplicitExchange };
    }
    if (raw === 'CEYREK' || raw === 'CEYREK ALTIN' || raw === 'CEYREK_ALTIN') {
      return { symbol: 'CEYREK_ALTIN', assetType: 'stock', exchange: 'COMMODITY', instrumentId: 'COMMODITY:CEYREK_ALTIN', hasExplicitExchange };
    }
    if (raw === 'YARIM' || raw === 'YARIM ALTIN' || raw === 'YARIM_ALTIN') {
      return { symbol: 'YARIM_ALTIN', assetType: 'stock', exchange: 'COMMODITY', instrumentId: 'COMMODITY:YARIM_ALTIN', hasExplicitExchange };
    }
    if (raw === 'CUMHURIYET' || raw === 'CUMHURIYET ALTINI' || raw === 'CUMHURIYET_ALTINI') {
      return { symbol: 'CUMHURIYET_ALTINI', assetType: 'stock', exchange: 'COMMODITY', instrumentId: 'COMMODITY:CUMHURIYET_ALTINI', hasExplicitExchange };
    }
    if (raw === 'ATA' || raw === 'ATA ALTIN' || raw === 'ATA_ALTIN') {
      return { symbol: 'ATA_ALTIN', assetType: 'stock', exchange: 'COMMODITY', instrumentId: 'COMMODITY:ATA_ALTIN', hasExplicitExchange };
    }
    if (raw === 'BILEZIK22' || raw === '22 AYAR BILEZIK') {
      return { symbol: 'BILEZIK22', assetType: 'stock', exchange: 'COMMODITY', instrumentId: 'COMMODITY:BILEZIK22', hasExplicitExchange };
    }
    if (raw === 'GUMUS' || raw === 'GUMUS.S1' || raw === 'GUMUSS1' || raw === 'GUMUS_S1') {
      return { symbol: 'GUMUS', assetType: 'stock', exchange: 'BIST', instrumentId: 'BIST:GUMUS', hasExplicitExchange };
    }
    if (
      raw === 'GRAM_GUMUS' ||
      raw === 'GRAM GUMUS' ||
      raw === 'GRAM-GUMUS' ||
      raw === 'XAGTRYG' ||
      raw === 'XAGTRY'
    ) {
      return { symbol: 'XAGTRYG', assetType: 'stock', exchange: 'COMMODITY', instrumentId: 'COMMODITY:XAGTRYG', hasExplicitExchange };
    }
  }
  if (!hasExplicitExchange || exchange === 'CRYPTO') {
    if (raw === 'BTC' || raw === 'BITCOIN') {
      return { symbol: 'BTCUSDT', assetType: 'stock', exchange: 'CRYPTO', instrumentId: 'CRYPTO:BTCUSDT', hasExplicitExchange };
    }
    if (raw === 'ETH' || raw === 'ETHEREUM') {
      return { symbol: 'ETHUSDT', assetType: 'stock', exchange: 'CRYPTO', instrumentId: 'CRYPTO:ETHUSDT', hasExplicitExchange };
    }
  }

  // 5. If raw is already an exact ticker key, don't alias-match it
  if (!hasExplicitExchange && !Object.prototype.hasOwnProperty.call(POPULAR_ALIASES, raw)) {
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

  // 6. Infer exchange only when not explicitly specified by caller prefix/suffix/hint
  if (!hasExplicitExchange) {
    if (INDEX_SYMBOLS.has(raw)) {
      assetType = 'stock';
      exchange = 'INDEX';
    } else if (TEFAS_SET.has(raw)) {
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
  }

  return {
    symbol: raw,
    assetType,
    exchange,
    instrumentId: `${exchange}:${raw}`,
    hasExplicitExchange,
  };
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
