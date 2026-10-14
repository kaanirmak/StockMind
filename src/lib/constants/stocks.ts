import { StockMarketInfo } from '@/types/stock';

/**
 * Pure client-safe static stock catalog & baseline directory.
 * Independent of Node.js server dependencies or server-only cache APIs.
 */
export const POPULAR_STOCKS: StockMarketInfo[] = [
  { symbol: 'THYAO', name: 'Türk Hava Yolları A.O.', exchange: 'BIST', currency: 'TRY', sector: 'Ulaştırma & Havacılık', basePrice: 285.25, marketCap: 407790000000, high52w: 355.5, low52w: 215.4 },
  { symbol: 'ASELS', name: 'Aselsan Elektronik Sanayi', exchange: 'BIST', currency: 'TRY', sector: 'Elektronik & Teknoloji', basePrice: 377.0, marketCap: 1698600000000, high52w: 450.0, low52w: 142.1 },
  { symbol: 'GARAN', name: 'Türkiye Garanti Bankası', exchange: 'BIST', currency: 'TRY', sector: 'Bankacılık & Finans', basePrice: 127.8, marketCap: 562380000000, high52w: 169.7, low52w: 58.6 },
  { symbol: 'EREGL', name: 'Ereğli Demir Çelik', exchange: 'BIST', currency: 'TRY', sector: 'Madencilik & Demir Çelik', basePrice: 38.26, marketCap: 133910000000, high52w: 59.8, low52w: 36.2 },
  { symbol: 'KCHOL', name: 'Koç Holding A.Ş.', exchange: 'BIST', currency: 'TRY', sector: 'Enerji & Petrol', basePrice: 218.8, marketCap: 571845000000, high52w: 270.75, low52w: 136.5 },
  { symbol: 'TUPRS', name: 'Tüpraş Rafinerileri', exchange: 'BIST', currency: 'TRY', sector: 'Enerji & Petrol', basePrice: 412.5, marketCap: 801065000000, high52w: 423.0, low52w: 128.0 },
  { symbol: 'SISE', name: 'Şişecam', exchange: 'BIST', currency: 'TRY', sector: 'Sanayi & İnşaat', basePrice: 42.4, marketCap: 128883000000, high52w: 57.45, low52w: 39.8 },
  { symbol: 'BIMAS', name: 'BİM Mağazalar', exchange: 'BIST', currency: 'TRY', sector: 'Perakende Ticaret', basePrice: 498.0, marketCap: 302385000000, high52w: 540.0, low52w: 290.0 },
  { symbol: 'AKBNK', name: 'Akbank T.A.Ş.', exchange: 'BIST', currency: 'TRY', sector: 'Bankacılık & Finans', basePrice: 62.15, marketCap: 323180000000, high52w: 68.5, low52w: 29.4 },
  { symbol: 'KONTR', name: 'Kontrolmatik Teknoloji', exchange: 'BIST', currency: 'TRY', sector: 'Elektronik & Teknoloji', basePrice: 3.35, marketCap: 4524000000, high52w: 56.12, low52w: 0.23 },
  { symbol: 'ASTOR', name: 'Astor Enerji A.Ş.', exchange: 'BIST', currency: 'TRY', sector: 'Enerji & Altyapı', basePrice: 272.25, marketCap: 94500000000, high52w: 290.0, low52w: 75.0 },
  { symbol: 'REEDR', name: 'Reeder Teknoloji', exchange: 'BIST', currency: 'TRY', sector: 'Elektronik & Teknoloji', basePrice: 5.35, marketCap: 28400000000, high52w: 78.0, low52w: 4.8 },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', exchange: 'NASDAQ', currency: 'USD', sector: 'Elektronik & Teknoloji', basePrice: 211.95, marketCap: 5108000000000, high52w: 220.0, low52w: 85.2 },
  { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ', currency: 'USD', sector: 'Elektronik & Teknoloji', basePrice: 330.5, marketCap: 4823000000000, high52w: 345.0, low52w: 164.0 },
  { symbol: 'MSFT', name: 'Microsoft Corporation', exchange: 'NASDAQ', currency: 'USD', sector: 'Bilişim & Yazılım', basePrice: 498.78, marketCap: 3703000000000, high52w: 510.0, low52w: 380.0 },
  { symbol: 'PLTR', name: 'Palantir Technologies', exchange: 'NASDAQ', currency: 'USD', sector: 'Bilişim & Yazılım', basePrice: 174.21, marketCap: 418600000000, high52w: 180.0, low52w: 22.5 },
  { symbol: 'TSLA', name: 'Tesla, Inc.', exchange: 'NASDAQ', currency: 'USD', sector: 'Ulaştırma & Havacılık', basePrice: 357.6, marketCap: 1412000000000, high52w: 380.0, low52w: 138.8 },
  { symbol: 'BRK.B', name: 'Berkshire Hathaway Inc.', exchange: 'NYSE', currency: 'USD', sector: 'Bankacılık & Finans', basePrice: 462.5, marketCap: 1012000000000, high52w: 485.0, low52w: 360.0 },
  { symbol: 'JPM', name: 'JPMorgan Chase & Co.', exchange: 'NYSE', currency: 'USD', sector: 'Bankacılık & Finans', basePrice: 228.4, marketCap: 648000000000, high52w: 240.0, low52w: 145.0 },
  { symbol: 'WMT', name: 'Walmart Inc.', exchange: 'NYSE', currency: 'USD', sector: 'Perakende Ticaret', basePrice: 85.3, marketCap: 686000000000, high52w: 88.0, low52w: 52.0 },
  { symbol: 'V', name: 'Visa Inc.', exchange: 'NYSE', currency: 'USD', sector: 'Bankacılık & Finans', basePrice: 295.6, marketCap: 595000000000, high52w: 305.0, low52w: 230.0 },
  { symbol: 'KO', name: 'The Coca-Cola Company', exchange: 'NYSE', currency: 'USD', sector: 'Gıda & İçecek', basePrice: 68.2, marketCap: 293000000000, high52w: 73.0, low52w: 55.0 },
  { symbol: 'DIS', name: 'The Walt Disney Company', exchange: 'NYSE', currency: 'USD', sector: 'Eğlence & Medya', basePrice: 112.4, marketCap: 205000000000, high52w: 123.0, low52w: 88.0 },
];
