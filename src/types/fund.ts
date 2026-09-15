// Fund (TEFAS) Types

export type FundCategory =
  | 'Hisse Senedi Fonu'
  | 'Değişken Fon'
  | 'Fon Sepeti Fonu'
  | 'Kıymetli Madenler Fonu'
  | 'Para Piyasası Fonu'
  | 'Borçlanma Araçları Fonu'
  | 'Katılım Fonu'
  | 'Serbest Fon'
  | string;

export type FundType =
  | 'equity'       // Hisse Senedi Fonu
  | 'bond'         // Tahvil/Bono Fonu
  | 'money_market' // Para Piyasası Fonu
  | 'balanced'     // Dengeli/Karma Fon
  | 'gold'         // Altın Fonu
  | 'index'        // Endeks Fonu
  | 'etf'          // Borsa Yatırım Fonu
  | 'other';

export type RiskLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface Fund {
  code: string;
  name: string;
  category: FundCategory;
  type?: FundType;
  price: number;
  dailyReturn: number;
  weeklyReturn?: number;
  monthlyReturn: number;
  threeMonthReturn?: number;
  sixMonthReturn?: number;
  yearlyReturn: number;
  totalAssets?: number;
  riskLevel?: RiskLevel;
  managementCompany?: string;
  date?: string;
}

export interface FundDetail extends Fund {
  founder: string;
  return3m: number;
  return6m: number;
  ytdReturn: number;
  return3y: number;
  return5y: number;
  riskValue: number;
  totalValue: number;
  investorCount: number;
  managementFee: number;
  assetAllocation: {
    category: string;
    percentage: number;
  }[];
}

export interface FundPrice {
  date: string;
  price: number;
}

export interface FundHistory {
  date: string;
  price: number;
}

export interface FundQuote {
  code: string;
  price: number;
  dailyReturn: number;
  date: string;
}

export interface FundSearchResult {
  code: string;
  name: string;
  category: string;
  type: FundType;
}

export interface FundComparison {
  funds: Fund[];
  metric: 'price' | 'dailyReturn' | 'monthlyReturn' | 'yearlyReturn';
}

export interface FundAllocation {
  category: string;
  percentage: number;
  value: number;
}
