import TEFAS_DIRECTORY from '@/lib/data/tefas_funds_directory.json';
import { POPULAR_ALIASES, normalizeText } from '@/lib/utils/search';

const TEFAS_SET = new Set((TEFAS_DIRECTORY as { code: string }[]).map((f) => f.code.toUpperCase()));

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
  if (Object.prototype.hasOwnProperty.call(POPULAR_ALIASES, raw)) {
    return { symbol: raw, assetType, exchange };
  }

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

  // 6. Check if symbol is in TEFAS directory or follows fund patterns
  if (TEFAS_SET.has(raw)) {
    assetType = 'fund';
    exchange = 'TEFAS';
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
