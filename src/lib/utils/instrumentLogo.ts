import INSTRUMENT_LOGOS_MAP from '@/lib/data/instrument_logos.json';

const LOGOS_DATA: Record<string, string> = INSTRUMENT_LOGOS_MAP as Record<string, string>;

/**
 * Returns the TradingView SVG logo URL for a given instrument symbol, if available.
 */
export function getInstrumentLogoUrl(symbol: string): string | null {
  if (!symbol) return null;

  // Clean symbol: remove exchange prefix or suffix (e.g. BIST:THYAO -> THYAO, THYAO.IS -> THYAO)
  const clean = symbol
    .toUpperCase()
    .replace(/^(BIST|NASDAQ|NYSE|AMEX|BINANCE|CRYPTO):/, '')
    .replace(/\.(IS|TI|US|O|N)$/, '')
    .trim();

  // 1. Direct lookup in our 680+ mapped symbols dictionary
  if (LOGOS_DATA[clean]) {
    const logoid = LOGOS_DATA[clean];
    return `https://s3-symbol-logo.tradingview.com/${logoid}.svg`;
  }

  // 2. TEFAS Fund Founder mapping heuristics
  if (clean.length === 3) {
    // Top Turkish fund managers by prefix
    if (clean.startsWith('TI') || clean.startsWith('TCD') || clean.startsWith('TTE') || clean.startsWith('IHK')) {
      return 'https://s3-symbol-logo.tradingview.com/is-bankasi.svg';
    }
    if (clean.startsWith('GAR') || clean.startsWith('GMR') || clean.startsWith('GTA') || clean.startsWith('GSP')) {
      return 'https://s3-symbol-logo.tradingview.com/garanti.svg';
    }
    if (clean.startsWith('YAY') || clean.startsWith('YAS') || clean.startsWith('YKT')) {
      return 'https://s3-symbol-logo.tradingview.com/yapi-kredi.svg';
    }
    if (clean.startsWith('AFT') || clean.startsWith('AFA') || clean.startsWith('ATE') || clean.startsWith('AK')) {
      return 'https://s3-symbol-logo.tradingview.com/akbank.svg';
    }
    if (clean.startsWith('ZP') || clean.startsWith('ZPE')) {
      return 'https://s3-symbol-logo.tradingview.com/turkiye-cumhuriyeti-ziraat-bankasi.svg';
    }
  }

  return null;
}

/**
 * Curated brand theme colors for known Turkish and global instruments.
 */
const CURATED_BRAND_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  THYAO: { bg: 'bg-[#C8102E]', text: 'text-white', border: 'border-[#C8102E]/40' },
  GARAN: { bg: 'bg-[#00824B]', text: 'text-white', border: 'border-[#00824B]/40' },
  AKBNK: { bg: 'bg-[#E30613]', text: 'text-white', border: 'border-[#E30613]/40' },
  ISCTR: { bg: 'bg-[#002D72]', text: 'text-white', border: 'border-[#002D72]/40' },
  KCHOL: { bg: 'bg-[#9E1B32]', text: 'text-white', border: 'border-[#9E1B32]/40' },
  SAHOL: { bg: 'bg-[#002B49]', text: 'text-white', border: 'border-[#002B49]/40' },
  ASELS: { bg: 'bg-[#002855]', text: 'text-[#F1C40F]', border: 'border-[#F1C40F]/40' },
  EREGL: { bg: 'bg-[#E57200]', text: 'text-white', border: 'border-[#E57200]/40' },
  TUPRS: { bg: 'bg-[#003A70]', text: 'text-white', border: 'border-[#003A70]/40' },
  BIMAS: { bg: 'bg-[#D71920]', text: 'text-white', border: 'border-[#D71920]/40' },
  SISE: { bg: 'bg-[#0072CE]', text: 'text-white', border: 'border-[#0072CE]/40' },
  FROTO: { bg: 'bg-[#002C6C]', text: 'text-white', border: 'border-[#002C6C]/40' },
  TOASO: { bg: 'bg-[#C8102E]', text: 'text-white', border: 'border-[#C8102E]/40' },
  PGSUS: { bg: 'bg-[#FFCD00]', text: 'text-[#1C1C1E]', border: 'border-[#FFCD00]/40' },
  TCELL: { bg: 'bg-[#003882]', text: 'text-[#FFB612]', border: 'border-[#FFB612]/40' },
  TTKOM: { bg: 'bg-[#003366]', text: 'text-white', border: 'border-[#003366]/40' },
  SASA: { bg: 'bg-[#008080]', text: 'text-white', border: 'border-[#008080]/40' },
  KONTR: { bg: 'bg-[#1E824C]', text: 'text-white', border: 'border-[#1E824C]/40' },
  ASTOR: { bg: 'bg-[#E65100]', text: 'text-white', border: 'border-[#E65100]/40' },
  PETKM: { bg: 'bg-[#0D47A1]', text: 'text-white', border: 'border-[#0D47A1]/40' },
  MGROS: { bg: 'bg-[#FF6F00]', text: 'text-white', border: 'border-[#FF6F00]/40' },
  ENKAI: { bg: 'bg-[#004D40]', text: 'text-white', border: 'border-[#004D40]/40' },
  YKBNK: { bg: 'bg-[#0033A0]', text: 'text-white', border: 'border-[#0033A0]/40' },
  VAKBN: { bg: 'bg-[#D32F2F]', text: 'text-white', border: 'border-[#D32F2F]/40' },
  HALKB: { bg: 'bg-[#1565C0]', text: 'text-white', border: 'border-[#1565C0]/40' },
  ALARK: { bg: 'bg-[#37474F]', text: 'text-white', border: 'border-[#37474F]/40' },
  KOZAL: { bg: 'bg-[#F9A825]', text: 'text-[#1C1C1E]', border: 'border-[#F9A825]/40' },
  AAPL: { bg: 'bg-[#1C1C1E]', text: 'text-white', border: 'border-white/20' },
  MSFT: { bg: 'bg-[#0078D4]', text: 'text-white', border: 'border-[#0078D4]/40' },
  NVDA: { bg: 'bg-[#76B900]', text: 'text-white', border: 'border-[#76B900]/40' },
  TSLA: { bg: 'bg-[#E82127]', text: 'text-white', border: 'border-[#E82127]/40' },
  AMZN: { bg: 'bg-[#232F3E]', text: 'text-[#FF9900]', border: 'border-[#FF9900]/40' },
  GOOGL: { bg: 'bg-[#4285F4]', text: 'text-white', border: 'border-[#4285F4]/40' },
  META: { bg: 'bg-[#0668E1]', text: 'text-white', border: 'border-[#0668E1]/40' },
  BTC: { bg: 'bg-[#F7931A]', text: 'text-white', border: 'border-[#F7931A]/40' },
  ETH: { bg: 'bg-[#627EEA]', text: 'text-white', border: 'border-[#627EEA]/40' },
};

/**
 * Returns brand styling for an instrument or a harmonized deterministic gradient.
 */
export function getInstrumentBrandStyle(symbol: string): { bg: string; text: string; border: string } {
  if (!symbol) {
    return { bg: 'bg-accent/20', text: 'text-accent', border: 'border-accent/30' };
  }

  const clean = symbol.toUpperCase().replace(/^(BIST|NASDAQ|NYSE):/, '').trim();
  if (CURATED_BRAND_COLORS[clean]) {
    return CURATED_BRAND_COLORS[clean];
  }

  // Deterministic palette based on string hash
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = clean.charCodeAt(i) + ((hash << 5) - hash);
  }
  const palettes = [
    { bg: 'bg-gradient-to-br from-indigo-600 to-purple-700', text: 'text-white', border: 'border-indigo-500/40' },
    { bg: 'bg-gradient-to-br from-emerald-600 to-teal-700', text: 'text-white', border: 'border-emerald-500/40' },
    { bg: 'bg-gradient-to-br from-blue-600 to-cyan-700', text: 'text-white', border: 'border-blue-500/40' },
    { bg: 'bg-gradient-to-br from-violet-600 to-fuchsia-700', text: 'text-white', border: 'border-violet-500/40' },
    { bg: 'bg-gradient-to-br from-rose-600 to-pink-700', text: 'text-white', border: 'border-rose-500/40' },
    { bg: 'bg-gradient-to-br from-amber-600 to-orange-700', text: 'text-white', border: 'border-amber-500/40' },
    { bg: 'bg-gradient-to-br from-cyan-600 to-sky-700', text: 'text-white', border: 'border-cyan-500/40' },
  ];

  const index = Math.abs(hash) % palettes.length;
  return palettes[index];
}
