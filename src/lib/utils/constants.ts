// Application Constants

export const APP_NAME = 'StockMind';
export const APP_DESCRIPTION = 'Akıllı Borsa & Fon Takip Platformu';

// Supported exchanges
export const EXCHANGES = {
  BIST: { label: 'Borsa İstanbul', suffix: 'IS', currency: 'TRY', flag: '🇹🇷' },
  NYSE: { label: 'New York Stock Exchange', suffix: '', currency: 'USD', flag: '🇺🇸' },
  NASDAQ: { label: 'NASDAQ', suffix: '', currency: 'USD', flag: '🇺🇸' },
} as const;

// Market indices
export const MARKET_INDICES = [
  { symbol: 'XU100', name: 'BIST 100', exchange: 'BIST' as const },
  { symbol: 'XU030', name: 'BIST 30', exchange: 'BIST' as const },
  { symbol: 'SPX', name: 'S&P 500', exchange: 'NYSE' as const },
  { symbol: 'NDX', name: 'NASDAQ 100', exchange: 'NASDAQ' as const },
] as const;

// Time intervals for charts
export const TIME_INTERVALS = [
  { label: '1G', value: '1D' as const, days: 1 },
  { label: '1H', value: '1W' as const, days: 7 },
  { label: '1A', value: '1M' as const, days: 30 },
  { label: '3A', value: '3M' as const, days: 90 },
  { label: '6A', value: '6M' as const, days: 180 },
  { label: '1Y', value: '1Y' as const, days: 365 },
  { label: '5Y', value: '5Y' as const, days: 1825 },
  { label: 'Tümü', value: 'MAX' as const, days: 0 },
] as const;

// Technical indicators
export const TECHNICAL_INDICATORS = [
  { key: 'RSI', label: 'RSI', defaultParams: { period: 14 } },
  { key: 'MACD', label: 'MACD', defaultParams: { fast: 12, slow: 26, signal: 9 } },
  { key: 'BOLLINGER', label: 'Bollinger Bands', defaultParams: { period: 20, stdDev: 2 } },
  { key: 'SMA', label: 'SMA', defaultParams: { period: 50 } },
  { key: 'EMA', label: 'EMA', defaultParams: { period: 20 } },
  { key: 'STOCHASTIC_RSI', label: 'Stochastic RSI', defaultParams: { period: 14 } },
] as const;

// Risk levels for funds
export const RISK_LEVELS = {
  1: { label: 'Çok Düşük', color: '#22c55e' },
  2: { label: 'Düşük', color: '#84cc16' },
  3: { label: 'Düşük-Orta', color: '#eab308' },
  4: { label: 'Orta', color: '#f97316' },
  5: { label: 'Orta-Yüksek', color: '#ef4444' },
  6: { label: 'Yüksek', color: '#dc2626' },
  7: { label: 'Çok Yüksek', color: '#991b1b' },
} as const;

// Navigation items
export const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', labelEn: 'Dashboard', icon: 'LayoutDashboard' },
  { href: '/portfolio', label: 'Portföy', labelEn: 'Portfolio', icon: 'Briefcase' },
  { href: '/stocks', label: 'Hisseler', labelEn: 'Stocks', icon: 'TrendingUp' },
  { href: '/funds', label: 'Fonlar', labelEn: 'Funds', icon: 'PiggyBank' },
  { href: '/watchlist', label: 'Takip Listesi', labelEn: 'Watchlist', icon: 'Star' },
  { href: '/reports', label: 'Raporlar', labelEn: 'Reports', icon: 'BarChart3' },
  { href: '/ai-assistant', label: 'AI Asistan', labelEn: 'AI Assistant', icon: 'Bot' },
  { href: '/news', label: 'Haberler', labelEn: 'News', icon: 'Newspaper' },
] as const;
