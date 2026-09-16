import TEFAS_DIRECTORY from '@/lib/data/tefas_funds_directory.json';

const TEFAS_SET = new Set((TEFAS_DIRECTORY as { code: string }[]).map((f) => f.code.toUpperCase()));

/**
 * Cleans broker prefixes (FON:, IST:, MUTF:, BIST:, etc.) and detects asset type & exchange
 */
export function cleanSymbol(sym: string): { symbol: string; assetType: 'stock' | 'fund'; exchange: string } {
  let raw = String(sym || '').toUpperCase().trim();
  let assetType: 'stock' | 'fund' = 'stock';
  let exchange = 'BIST';

  // Strip prefixes
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

  // Strip trailing suffixes (.IS, .E, .TI)
  raw = raw.replace(/\.(IS|E|TI)$/, '').trim();

  // Alias checks for commodities
  if (
    raw === 'GRAM_ALTIN' ||
    raw === 'GRAM ALTIN' ||
    raw === 'ALTIN' ||
    raw === 'GA' ||
    raw === 'XAUTRYG' ||
    raw === 'XAUTRY'
  ) {
    return { symbol: 'GRAM_ALTIN', assetType: 'stock', exchange: 'BIST' };
  }
  if (
    raw === 'GRAM_GUMUS' ||
    raw === 'GRAM GUMUS' ||
    raw === 'GUMUS' ||
    raw === 'XAGTRYG' ||
    raw === 'XAGTRY'
  ) {
    return { symbol: 'GRAM_GUMUS', assetType: 'stock', exchange: 'BIST' };
  }

  // Check if symbol is in TEFAS directory or follows 3-letter uppercase fund pattern
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
