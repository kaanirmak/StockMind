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
  THYAO: { bg: 'bg-[var(--palette-colorc8102e)]', text: 'text-white', border: 'border-[var(--palette-colorc8102e)]/40' },
  GARAN: { bg: 'bg-[var(--palette-color00824b)]', text: 'text-white', border: 'border-[var(--palette-color00824b)]/40' },
  AKBNK: { bg: 'bg-[var(--palette-colore30613)]', text: 'text-white', border: 'border-[var(--palette-colore30613)]/40' },
  ISCTR: { bg: 'bg-[var(--palette-color002d72)]', text: 'text-white', border: 'border-[var(--palette-color002d72)]/40' },
  KCHOL: { bg: 'bg-[var(--palette-color9e1b32)]', text: 'text-white', border: 'border-[var(--palette-color9e1b32)]/40' },
  SAHOL: { bg: 'bg-[var(--palette-color002b49)]', text: 'text-white', border: 'border-[var(--palette-color002b49)]/40' },
  ASELS: { bg: 'bg-[var(--palette-color002855)]', text: 'text-[var(--palette-colorf1c40f)]', border: 'border-[var(--palette-colorf1c40f)]/40' },
  EREGL: { bg: 'bg-[var(--palette-colore57200)]', text: 'text-white', border: 'border-[var(--palette-colore57200)]/40' },
  TUPRS: { bg: 'bg-[var(--palette-color003a70)]', text: 'text-white', border: 'border-[var(--palette-color003a70)]/40' },
  BIMAS: { bg: 'bg-[var(--palette-colord71920)]', text: 'text-white', border: 'border-[var(--palette-colord71920)]/40' },
  SISE: { bg: 'bg-[var(--palette-color0072ce)]', text: 'text-white', border: 'border-[var(--palette-color0072ce)]/40' },
  FROTO: { bg: 'bg-[var(--palette-color002c6c)]', text: 'text-white', border: 'border-[var(--palette-color002c6c)]/40' },
  TOASO: { bg: 'bg-[var(--palette-colorc8102e)]', text: 'text-white', border: 'border-[var(--palette-colorc8102e)]/40' },
  PGSUS: { bg: 'bg-[var(--palette-colorffcd00)]', text: 'text-[var(--palette-color1c1c1e)]', border: 'border-[var(--palette-colorffcd00)]/40' },
  TCELL: { bg: 'bg-[var(--palette-color003882)]', text: 'text-[var(--palette-colorffb612)]', border: 'border-[var(--palette-colorffb612)]/40' },
  TTKOM: { bg: 'bg-[var(--palette-color003366)]', text: 'text-white', border: 'border-[var(--palette-color003366)]/40' },
  SASA: { bg: 'bg-[var(--palette-color008080)]', text: 'text-white', border: 'border-[var(--palette-color008080)]/40' },
  KONTR: { bg: 'bg-[var(--palette-color1e824c)]', text: 'text-white', border: 'border-[var(--palette-color1e824c)]/40' },
  ASTOR: { bg: 'bg-[var(--palette-colore65100)]', text: 'text-white', border: 'border-[var(--palette-colore65100)]/40' },
  PETKM: { bg: 'bg-[var(--palette-color0d47a1)]', text: 'text-white', border: 'border-[var(--palette-color0d47a1)]/40' },
  MGROS: { bg: 'bg-[var(--palette-colorff6f00)]', text: 'text-white', border: 'border-[var(--palette-colorff6f00)]/40' },
  ENKAI: { bg: 'bg-[var(--palette-color004d40)]', text: 'text-white', border: 'border-[var(--palette-color004d40)]/40' },
  YKBNK: { bg: 'bg-[var(--palette-color0033a0)]', text: 'text-white', border: 'border-[var(--palette-color0033a0)]/40' },
  VAKBN: { bg: 'bg-[var(--palette-colord32f2f)]', text: 'text-white', border: 'border-[var(--palette-colord32f2f)]/40' },
  HALKB: { bg: 'bg-[var(--palette-color1565c0)]', text: 'text-white', border: 'border-[var(--palette-color1565c0)]/40' },
  ALARK: { bg: 'bg-[var(--palette-color37474f)]', text: 'text-white', border: 'border-[var(--palette-color37474f)]/40' },
  KOZAL: { bg: 'bg-[var(--palette-colorf9a825)]', text: 'text-[var(--palette-color1c1c1e)]', border: 'border-[var(--palette-colorf9a825)]/40' },
  AAPL: { bg: 'bg-[var(--palette-color1c1c1e)]', text: 'text-white', border: 'border-white/20' },
  MSFT: { bg: 'bg-[var(--palette-color0078d4)]', text: 'text-white', border: 'border-[var(--palette-color0078d4)]/40' },
  NVDA: { bg: 'bg-[var(--palette-color76b900)]', text: 'text-white', border: 'border-[var(--palette-color76b900)]/40' },
  TSLA: { bg: 'bg-[var(--palette-colore82127)]', text: 'text-white', border: 'border-[var(--palette-colore82127)]/40' },
  AMZN: { bg: 'bg-[var(--palette-color232f3e)]', text: 'text-[var(--palette-colorff9900)]', border: 'border-[var(--palette-colorff9900)]/40' },
  GOOGL: { bg: 'bg-[var(--palette-color4285f4)]', text: 'text-white', border: 'border-[var(--palette-color4285f4)]/40' },
  META: { bg: 'bg-[var(--palette-color0668e1)]', text: 'text-white', border: 'border-[var(--palette-color0668e1)]/40' },
  BTC: { bg: 'bg-[var(--palette-colorf7931a)]', text: 'text-white', border: 'border-[var(--palette-colorf7931a)]/40' },
  ETH: { bg: 'bg-[var(--palette-color627eea)]', text: 'text-white', border: 'border-[var(--palette-color627eea)]/40' },
  SOL: { bg: 'bg-[var(--palette-color14f195)]', text: 'text-black', border: 'border-[var(--palette-color14f195)]/40' },
  XU100: { bg: 'bg-[var(--palette-colore30613)]', text: 'text-white', border: 'border-[var(--palette-colore30613)]/50' },
  XU030: { bg: 'bg-[var(--palette-colorb71c1c)]', text: 'text-white', border: 'border-[var(--palette-colorb71c1c)]/50' },
  XBANK: { bg: 'bg-[var(--palette-color0d47a1)]', text: 'text-white', border: 'border-[var(--palette-color0d47a1)]/50' },
  XUSIN: { bg: 'bg-[var(--palette-color1565c0)]', text: 'text-white', border: 'border-[var(--palette-color1565c0)]/50' },
  XHOLD: { bg: 'bg-[var(--palette-color4a148c)]', text: 'text-white', border: 'border-[var(--palette-color4a148c)]/50' },
  XUTEK: { bg: 'bg-[var(--palette-color00838f)]', text: 'text-white', border: 'border-[var(--palette-color00838f)]/50' },
  XULAS: { bg: 'bg-[var(--palette-colorc2185b)]', text: 'text-white', border: 'border-[var(--palette-colorc2185b)]/50' },
  SPX: { bg: 'bg-[var(--palette-color1e3a8a)]', text: 'text-white', border: 'border-[var(--palette-color1e3a8a)]/50' },
  NDX: { bg: 'bg-[var(--palette-color0284c7)]', text: 'text-white', border: 'border-[var(--palette-color0284c7)]/50' },
  DJI: { bg: 'bg-[var(--palette-color0f172a)]', text: 'text-white', border: 'border-white/30' },
  DAX: { bg: 'bg-[var(--palette-colord97706)]', text: 'text-white', border: 'border-[var(--palette-colord97706)]/50' },
  FTSE: { bg: 'bg-[var(--palette-color1e1b4b)]', text: 'text-white', border: 'border-indigo-400/50' },
  N225: { bg: 'bg-[var(--palette-color991b1b)]', text: 'text-white', border: 'border-red-400/50' },
  VIX: { bg: 'bg-[var(--palette-color7f1d1d)]', text: 'text-red-200', border: 'border-red-500/50' },
  DXY: { bg: 'bg-[var(--palette-color065f46)]', text: 'text-emerald-200', border: 'border-emerald-500/50' },
  XAUTRYG: { bg: 'bg-[var(--palette-colord97706)]', text: 'text-white', border: 'border-[var(--palette-colord97706)]/50' },
  CEYREK_ALTIN: { bg: 'bg-[var(--palette-colorb45309)]', text: 'text-white', border: 'border-[var(--palette-colorb45309)]/50' },
  YARIM_ALTIN: { bg: 'bg-[var(--palette-colorb45309)]', text: 'text-white', border: 'border-[var(--palette-colorb45309)]/50' },
  CUMHURIYET_ALTINI: { bg: 'bg-[var(--palette-color92400e)]', text: 'text-white', border: 'border-[var(--palette-color92400e)]/50' },
  ATA_ALTIN: { bg: 'bg-[var(--palette-color78350f)]', text: 'text-white', border: 'border-[var(--palette-color78350f)]/50' },
  BILEZIK22: { bg: 'bg-[var(--palette-warning)]', text: 'text-black', border: 'border-[var(--palette-warning)]/50' },
  XAUUSD: { bg: 'bg-[var(--palette-warning)]', text: 'text-black', border: 'border-[var(--palette-warning)]/50' },
  SILVER: { bg: 'bg-[var(--palette-color94a3b8)]', text: 'text-slate-900', border: 'border-slate-400/50' },
  XAGTRYG: { bg: 'bg-[var(--palette-color64748b)]', text: 'text-white', border: 'border-[var(--palette-color64748b)]/50' },
  UKOIL: { bg: 'bg-[var(--palette-color1e293b)]', text: 'text-amber-400', border: 'border-amber-400/40' },
  USOIL: { bg: 'bg-[var(--palette-color0f172a)]', text: 'text-amber-500', border: 'border-amber-500/40' },
  NATGAS: { bg: 'bg-[var(--palette-color0284c7)]', text: 'text-white', border: 'border-[var(--palette-color0284c7)]/50' },
  COPPER: { bg: 'bg-[var(--palette-colorb45309)]', text: 'text-white', border: 'border-[var(--palette-colorb45309)]/50' },
  PLATINUM: { bg: 'bg-[var(--palette-color475569)]', text: 'text-white', border: 'border-slate-400/50' },
  PALLADIUM: { bg: 'bg-[var(--palette-color334155)]', text: 'text-white', border: 'border-slate-500/50' },
  USDTRY: { bg: 'bg-[var(--palette-color065f46)]', text: 'text-emerald-100', border: 'border-emerald-500/40' },
  EURTRY: { bg: 'bg-[var(--palette-color1e40af)]', text: 'text-blue-100', border: 'border-blue-500/40' },
  GBPTRY: { bg: 'bg-[var(--palette-color581c87)]', text: 'text-purple-100', border: 'border-purple-500/40' },
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
