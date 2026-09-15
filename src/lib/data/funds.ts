import { FundCategory } from '@/types/fund';
import { calculateFuzzyScore } from '@/lib/utils/search';
import TEFAS_DIRECTORY from './tefas_funds_directory.json';

export interface TefasFundInfo {
  code: string;
  name: string;
  category: FundCategory;
  founder: string;
  price: number;
  dailyReturn: number;
  monthlyReturn: number;
  return3m: number;
  return6m: number;
  ytdReturn: number;
  yearlyReturn: number;
  return3y: number;
  return5y: number;
  riskValue: number; // 1 to 7
  totalValue: number; // AUM in TRY
  investorCount: number;
  managementFee: number; // % annual
  assetAllocation: {
    category: string;
    percentage: number;
  }[];
  kapLink?: string;
}

export const TEFAS_FUNDS: TefasFundInfo[] = [
  // ==========================================
  // 1. HİSSE SENEDİ YOĞUN FONLAR
  // ==========================================
  {
    code: 'THF',
    name: 'TERA PORTFÖY HİSSE SENEDİ (TL) FONU (HİSSE SENEDİ YOĞUN FON)',
    category: 'Hisse Senedi Fonu',
    founder: 'TERA PORTFÖY YÖNETİMİ A.Ş.',
    price: 2.9337,
    dailyReturn: 0.36,
    monthlyReturn: 22.76,
    return3m: 33.19,
    return6m: 52.90,
    ytdReturn: 48.2,
    yearlyReturn: 127.88,
    return3y: 480.0,
    return5y: 1350.0,
    riskValue: 6,
    totalValue: 146580000000,
    investorCount: 200072,
    managementFee: 2.5,
    assetAllocation: [
      { category: 'Hisse Senedi', percentage: 86.48 },
      { category: 'Yatırım Fonları Payları', percentage: 8.4 },
      { category: 'Vadeli İşlemler Nakit Teminatları', percentage: 5.11 },
      { category: 'Finansman Bonosu', percentage: 0.01 },
    ],
    kapLink: 'https://www.kap.org.tr/tr/fon-bilgileri/genel/thf-tera-portfoy-hisse-senedi-tl-fonu-hisse-senedi-yogun-fon',
  },
  {
    code: 'TI2',
    name: 'İş Portföy BIST 100 Dışı Şirketler Hisse Senedi Fonu',
    category: 'Hisse Senedi Fonu',
    founder: 'İş Portföy Yönetimi A.Ş.',
    price: 4.8214,
    dailyReturn: 1.45,
    monthlyReturn: 8.24,
    return3m: 18.6,
    return6m: 34.2,
    ytdReturn: 42.8,
    yearlyReturn: 89.4,
    return3y: 412.5,
    return5y: 1140.0,
    riskValue: 6,
    totalValue: 8450000000,
    investorCount: 42150,
    managementFee: 2.5,
    assetAllocation: [
      { category: 'Hisse Senedi (BIST Dışı)', percentage: 92.5 },
      { category: 'Takasbank Para Piyasası', percentage: 4.5 },
      { category: 'Vadeli Mevduat', percentage: 3.0 },
    ],
  },
  {
    code: 'MAC',
    name: 'Marmara Capital Portföy Hisse Senedi Fonu (Hisse Yoğun)',
    category: 'Hisse Senedi Fonu',
    founder: 'Marmara Capital Portföy Yönetimi A.Ş.',
    price: 38.642,
    dailyReturn: 0.92,
    monthlyReturn: 6.85,
    return3m: 15.2,
    return6m: 29.8,
    ytdReturn: 38.4,
    yearlyReturn: 78.2,
    return3y: 480.1,
    return5y: 1320.0,
    riskValue: 6,
    totalValue: 4120000000,
    investorCount: 28900,
    managementFee: 2.8,
    assetAllocation: [
      { category: 'Hisse Senedi', percentage: 95.0 },
      { category: 'Ters Repo', percentage: 3.2 },
      { category: 'Diğer', percentage: 1.8 },
    ],
  },
  {
    code: 'BIO',
    name: 'İstanbul Portföy BIST Sürdürülebilirlik Hisse Fonu',
    category: 'Hisse Senedi Fonu',
    founder: 'İstanbul Portföy Yönetimi A.Ş.',
    price: 12.145,
    dailyReturn: 1.15,
    monthlyReturn: 7.2,
    return3m: 16.4,
    return6m: 31.5,
    ytdReturn: 41.2,
    yearlyReturn: 82.5,
    return3y: 440.0,
    return5y: 1190.0,
    riskValue: 6,
    totalValue: 3800000000,
    investorCount: 22100,
    managementFee: 2.6,
    assetAllocation: [
      { category: 'Hisse Senedi', percentage: 94.0 },
      { category: 'Ters Repo', percentage: 4.0 },
      { category: 'Para Piyasası', percentage: 2.0 },
    ],
  },
  {
    code: 'TTE',
    name: 'İş Portföy BIST Teknoloji Ağırlıklı Sınırlı Hisse Fonu',
    category: 'Hisse Senedi Fonu',
    founder: 'İş Portföy Yönetimi A.Ş.',
    price: 8.942,
    dailyReturn: 2.15,
    monthlyReturn: 11.4,
    return3m: 28.5,
    return6m: 52.1,
    ytdReturn: 61.2,
    yearlyReturn: 115.4,
    return3y: 620.0,
    return5y: 1840.0,
    riskValue: 7,
    totalValue: 7100000000,
    investorCount: 48900,
    managementFee: 2.7,
    assetAllocation: [
      { category: 'BIST Teknoloji Hisseleri', percentage: 96.0 },
      { category: 'Takasbank Para Piyasası', percentage: 2.5 },
      { category: 'Nakit', percentage: 1.5 },
    ],
  },
  {
    code: 'GMR',
    name: 'Garanti Portföy Hisse Senedi Fonu (Hisse Senedi Yoğun)',
    category: 'Hisse Senedi Fonu',
    founder: 'Garanti Portföy Yönetimi A.Ş.',
    price: 15.62,
    dailyReturn: 0.85,
    monthlyReturn: 5.9,
    return3m: 14.2,
    return6m: 28.0,
    ytdReturn: 37.5,
    yearlyReturn: 74.8,
    return3y: 390.0,
    return5y: 1050.0,
    riskValue: 6,
    totalValue: 6500000000,
    investorCount: 38000,
    managementFee: 2.5,
    assetAllocation: [
      { category: 'Hisse Senedi', percentage: 94.5 },
      { category: 'Para Piyasası', percentage: 5.5 },
    ],
  },
  {
    code: 'YAS',
    name: 'Yapı Kredi Portföy Koç Holding İştirakleri Hisse Fonu',
    category: 'Hisse Senedi Fonu',
    founder: 'Yapı Kredi Portföy Yönetimi A.Ş.',
    price: 6.84,
    dailyReturn: 1.25,
    monthlyReturn: 7.8,
    return3m: 17.5,
    return6m: 32.0,
    ytdReturn: 41.0,
    yearlyReturn: 84.5,
    return3y: 460.0,
    return5y: 1280.0,
    riskValue: 6,
    totalValue: 9200000000,
    investorCount: 56000,
    managementFee: 2.4,
    assetAllocation: [
      { category: 'Koç Grubu Hisseleri', percentage: 96.0 },
      { category: 'Nakit', percentage: 4.0 },
    ],
  },
  {
    code: 'IIH',
    name: 'İstanbul Portföy Üçüncü Hisse Senedi Fonu',
    category: 'Hisse Senedi Fonu',
    founder: 'İstanbul Portföy Yönetimi A.Ş.',
    price: 24.18,
    dailyReturn: 1.62,
    monthlyReturn: 9.4,
    return3m: 21.0,
    return6m: 39.5,
    ytdReturn: 48.0,
    yearlyReturn: 96.0,
    return3y: 540.0,
    return5y: 1490.0,
    riskValue: 7,
    totalValue: 5300000000,
    investorCount: 31000,
    managementFee: 2.8,
    assetAllocation: [
      { category: 'Büyüme Hisseleri', percentage: 95.0 },
      { category: 'Ters Repo', percentage: 5.0 },
    ],
  },
  {
    code: 'NNF',
    name: 'Hedef Portföy Birinci Hisse Senedi Fonu',
    category: 'Hisse Senedi Fonu',
    founder: 'Hedef Portföy Yönetimi A.Ş.',
    price: 11.45,
    dailyReturn: 1.34,
    monthlyReturn: 7.9,
    return3m: 18.0,
    return6m: 33.5,
    ytdReturn: 42.5,
    yearlyReturn: 86.0,
    return3y: 490.0,
    return5y: 1390.0,
    riskValue: 6,
    totalValue: 5600000000,
    investorCount: 34000,
    managementFee: 2.6,
    assetAllocation: [
      { category: 'BIST Hisseleri', percentage: 95.0 },
      { category: 'Para Piyasası', percentage: 5.0 },
    ],
  },
  {
    code: 'TKF',
    name: 'Tacirler Portföy Hisse Senedi Fonu (Hisse Senedi Yoğun)',
    category: 'Hisse Senedi Fonu',
    founder: 'Tacirler Portföy Yönetimi A.Ş.',
    price: 28.94,
    dailyReturn: 1.05,
    monthlyReturn: 6.7,
    return3m: 16.2,
    return6m: 30.8,
    ytdReturn: 39.5,
    yearlyReturn: 81.0,
    return3y: 450.0,
    return5y: 1250.0,
    riskValue: 6,
    totalValue: 4800000000,
    investorCount: 29500,
    managementFee: 2.6,
    assetAllocation: [
      { category: 'BIST Hisseleri', percentage: 93.5 },
      { category: 'Takasbank Para Piyasası', percentage: 6.5 },
    ],
  },
  {
    code: 'HKH',
    name: 'Hedef Portföy Katılım Hisse Senedi Fonu',
    category: 'Hisse Senedi Fonu',
    founder: 'Hedef Portföy Yönetimi A.Ş.',
    price: 8.45,
    dailyReturn: 1.18,
    monthlyReturn: 7.1,
    return3m: 16.8,
    return6m: 31.9,
    ytdReturn: 40.8,
    yearlyReturn: 83.2,
    return3y: 470.0,
    return5y: 1310.0,
    riskValue: 6,
    totalValue: 3200000000,
    investorCount: 21000,
    managementFee: 2.5,
    assetAllocation: [
      { category: 'Katılım Endeksi Hisseleri', percentage: 95.0 },
      { category: 'Katılım Hesabı', percentage: 5.0 },
    ],
  },
  {
    code: 'OPH',
    name: 'Oyak Portföy Birinci Hisse Senedi Fonu',
    category: 'Hisse Senedi Fonu',
    founder: 'Oyak Portföy Yönetimi A.Ş.',
    price: 14.85,
    dailyReturn: 0.95,
    monthlyReturn: 6.2,
    return3m: 15.0,
    return6m: 29.1,
    ytdReturn: 38.0,
    yearlyReturn: 77.5,
    return3y: 420.0,
    return5y: 1180.0,
    riskValue: 6,
    totalValue: 3900000000,
    investorCount: 24500,
    managementFee: 2.4,
    assetAllocation: [
      { category: 'Hisse Senedi', percentage: 94.0 },
      { category: 'Ters Repo', percentage: 6.0 },
    ],
  },
  {
    code: 'KPC',
    name: 'Kuveyt Türk Portföy Katılım Hisse Senedi Fonu',
    category: 'Hisse Senedi Fonu',
    founder: 'Kuveyt Türk Portföy Yönetimi A.Ş.',
    price: 5.92,
    dailyReturn: 1.12,
    monthlyReturn: 6.9,
    return3m: 16.5,
    return6m: 31.2,
    ytdReturn: 40.1,
    yearlyReturn: 82.0,
    return3y: 460.0,
    return5y: 1290.0,
    riskValue: 6,
    totalValue: 4600000000,
    investorCount: 31500,
    managementFee: 2.3,
    assetAllocation: [
      { category: 'Katılım Hisseleri', percentage: 96.0 },
      { category: 'Kira Sertifikaları', percentage: 4.0 },
    ],
  },
  {
    code: 'ICZ',
    name: 'İstanbul Portföy İkinci Hisse Senedi Fonu',
    category: 'Hisse Senedi Fonu',
    founder: 'İstanbul Portföy Yönetimi A.Ş.',
    price: 19.34,
    dailyReturn: 1.42,
    monthlyReturn: 8.5,
    return3m: 19.8,
    return6m: 37.0,
    ytdReturn: 46.0,
    yearlyReturn: 92.5,
    return3y: 510.0,
    return5y: 1420.0,
    riskValue: 7,
    totalValue: 4100000000,
    investorCount: 26000,
    managementFee: 2.7,
    assetAllocation: [
      { category: 'Büyüme Hisseleri', percentage: 94.5 },
      { category: 'Takasbank Para Piyasası', percentage: 5.5 },
    ],
  },
  {
    code: 'IDH',
    name: 'İş Portföy BIST Temettü 25 Endeksi Hisse Fonu',
    category: 'Hisse Senedi Fonu',
    founder: 'İş Portföy Yönetimi A.Ş.',
    price: 7.18,
    dailyReturn: 0.78,
    monthlyReturn: 5.4,
    return3m: 13.5,
    return6m: 26.5,
    ytdReturn: 35.0,
    yearlyReturn: 71.0,
    return3y: 380.0,
    return5y: 1020.0,
    riskValue: 6,
    totalValue: 5100000000,
    investorCount: 33000,
    managementFee: 2.2,
    assetAllocation: [
      { category: 'Temettü 25 Hisseleri', percentage: 96.0 },
      { category: 'Nakit', percentage: 4.0 },
    ],
  },
  {
    code: 'TAU',
    name: 'İş Portföy BIST Banka Endeksi Hisse Fonu',
    category: 'Hisse Senedi Fonu',
    founder: 'İş Portföy Yönetimi A.Ş.',
    price: 16.42,
    dailyReturn: 1.85,
    monthlyReturn: 9.8,
    return3m: 23.4,
    return6m: 44.2,
    ytdReturn: 53.0,
    yearlyReturn: 104.0,
    return3y: 580.0,
    return5y: 1620.0,
    riskValue: 7,
    totalValue: 6800000000,
    investorCount: 41000,
    managementFee: 2.4,
    assetAllocation: [
      { category: 'BIST Banka Hisseleri', percentage: 97.0 },
      { category: 'Takasbank', percentage: 3.0 },
    ],
  },
  {
    code: 'ZST',
    name: 'Ziraat Portföy Sürdürülebilirlik Hisse Senedi Fonu',
    category: 'Hisse Senedi Fonu',
    founder: 'Ziraat Portföy Yönetimi A.Ş.',
    price: 4.15,
    dailyReturn: 0.92,
    monthlyReturn: 6.0,
    return3m: 14.8,
    return6m: 28.5,
    ytdReturn: 37.2,
    yearlyReturn: 75.8,
    return3y: 400.0,
    return5y: 1080.0,
    riskValue: 6,
    totalValue: 3500000000,
    investorCount: 23000,
    managementFee: 2.2,
    assetAllocation: [
      { category: 'Sürdürülebilirlik Hisseleri', percentage: 95.0 },
      { category: 'Mevduat / Nakit', percentage: 5.0 },
    ],
  },
  {
    code: 'AK3',
    name: 'Ak Portföy BIST 30 Endeksi Hisse Senedi Fonu',
    category: 'Hisse Senedi Fonu',
    founder: 'Ak Portföy Yönetimi A.Ş.',
    price: 9.84,
    dailyReturn: 0.88,
    monthlyReturn: 5.8,
    return3m: 14.0,
    return6m: 27.5,
    ytdReturn: 36.5,
    yearlyReturn: 73.0,
    return3y: 395.0,
    return5y: 1060.0,
    riskValue: 6,
    totalValue: 7400000000,
    investorCount: 49000,
    managementFee: 2.0,
    assetAllocation: [
      { category: 'BIST 30 Hisseleri', percentage: 97.0 },
      { category: 'Para Piyasası', percentage: 3.0 },
    ],
  },

  // ==========================================
  // 2. DEĞİŞKEN FONLAR
  // ==========================================
  {
    code: 'TCD',
    name: 'Tacirler Portföy Değişken Fon',
    category: 'Değişken Fon',
    founder: 'Tacirler Portföy Yönetimi A.Ş.',
    price: 18.2541,
    dailyReturn: -0.34,
    monthlyReturn: 4.12,
    return3m: 12.8,
    return6m: 24.5,
    ytdReturn: 35.1,
    yearlyReturn: 71.4,
    return3y: 395.0,
    return5y: 980.2,
    riskValue: 6,
    totalValue: 6200000000,
    investorCount: 35400,
    managementFee: 2.5,
    assetAllocation: [
      { category: 'Hisse Senedi', percentage: 65.4 },
      { category: 'Borçlanma Araçları', percentage: 20.0 },
      { category: 'Para Piyasası', percentage: 14.6 },
    ],
  },
  {
    code: 'NRC',
    name: 'Neo Portföy Birinci Değişken Fon',
    category: 'Değişken Fon',
    founder: 'Neo Portföy Yönetimi A.Ş.',
    price: 3.42,
    dailyReturn: 0.65,
    monthlyReturn: 5.4,
    return3m: 14.0,
    return6m: 27.5,
    ytdReturn: 36.8,
    yearlyReturn: 75.0,
    return3y: 410.0,
    return5y: 1020.0,
    riskValue: 5,
    totalValue: 2800000000,
    investorCount: 16500,
    managementFee: 2.2,
    assetAllocation: [
      { category: 'Hisse', percentage: 55.0 },
      { category: 'Tahvil', percentage: 30.0 },
      { category: 'Eurobond', percentage: 15.0 },
    ],
  },
  {
    code: 'IPB',
    name: 'İstanbul Portföy Birinci Değişken Fon',
    category: 'Değişken Fon',
    founder: 'İstanbul Portföy Yönetimi A.Ş.',
    price: 9.85,
    dailyReturn: 0.78,
    monthlyReturn: 6.1,
    return3m: 15.8,
    return6m: 30.2,
    ytdReturn: 40.0,
    yearlyReturn: 81.0,
    return3y: 430.0,
    return5y: 1150.0,
    riskValue: 6,
    totalValue: 4700000000,
    investorCount: 26000,
    managementFee: 2.5,
    assetAllocation: [
      { category: 'Hisse Senedi', percentage: 70.0 },
      { category: 'Ters Repo', percentage: 20.0 },
      { category: 'Kıymetli Maden', percentage: 10.0 },
    ],
  },
  {
    code: 'GPG',
    name: 'Gri Portföy Birinci Değişken Fon',
    category: 'Değişken Fon',
    founder: 'Gri Portföy Yönetimi A.Ş.',
    price: 4.88,
    dailyReturn: 0.55,
    monthlyReturn: 4.8,
    return3m: 12.5,
    return6m: 24.0,
    ytdReturn: 33.5,
    yearlyReturn: 68.0,
    return3y: 360.0,
    return5y: 910.0,
    riskValue: 5,
    totalValue: 2100000000,
    investorCount: 14000,
    managementFee: 2.0,
    assetAllocation: [
      { category: 'Hisse Senedi', percentage: 50.0 },
      { category: 'Borçlanma Araçları', percentage: 35.0 },
      { category: 'Mevduat', percentage: 15.0 },
    ],
  },
  {
    code: 'MAD',
    name: 'Marmara Capital Portföy Değişken Fon',
    category: 'Değişken Fon',
    founder: 'Marmara Capital Portföy Yönetimi A.Ş.',
    price: 7.62,
    dailyReturn: 0.72,
    monthlyReturn: 5.6,
    return3m: 14.5,
    return6m: 28.0,
    ytdReturn: 37.0,
    yearlyReturn: 76.0,
    return3y: 420.0,
    return5y: 1100.0,
    riskValue: 5,
    totalValue: 3300000000,
    investorCount: 19500,
    managementFee: 2.4,
    assetAllocation: [
      { category: 'Hisse Senedi', percentage: 60.0 },
      { category: 'Eurobond', percentage: 25.0 },
      { category: 'Para Piyasası', percentage: 15.0 },
    ],
  },
  {
    code: 'EID',
    name: 'Egeli Portföy Birinci Değişken Fon',
    category: 'Değişken Fon',
    founder: 'Egeli Portföy Yönetimi A.Ş.',
    price: 2.94,
    dailyReturn: 0.45,
    monthlyReturn: 4.2,
    return3m: 11.2,
    return6m: 22.0,
    ytdReturn: 30.5,
    yearlyReturn: 62.0,
    return3y: 320.0,
    return5y: 820.0,
    riskValue: 4,
    totalValue: 1450000000,
    investorCount: 9200,
    managementFee: 1.9,
    assetAllocation: [
      { category: 'Özel Sektör Tahvili', percentage: 45.0 },
      { category: 'Hisse', percentage: 40.0 },
      { category: 'Repo', percentage: 15.0 },
    ],
  },
  {
    code: 'GO1',
    name: 'Garanti Portföy Birinci Değişken Fon',
    category: 'Değişken Fon',
    founder: 'Garanti Portföy Yönetimi A.Ş.',
    price: 5.48,
    dailyReturn: 0.58,
    monthlyReturn: 4.9,
    return3m: 13.0,
    return6m: 25.0,
    ytdReturn: 34.0,
    yearlyReturn: 69.5,
    return3y: 370.0,
    return5y: 940.0,
    riskValue: 5,
    totalValue: 4900000000,
    investorCount: 28000,
    managementFee: 2.1,
    assetAllocation: [
      { category: 'Hisse Senedi', percentage: 55.0 },
      { category: 'Kamu Tahvili', percentage: 25.0 },
      { category: 'Para Piyasası', percentage: 20.0 },
    ],
  },
  {
    code: 'TDF',
    name: 'Tacirler Portföy Dinamik Değişken Fon',
    category: 'Değişken Fon',
    founder: 'Tacirler Portföy Yönetimi A.Ş.',
    price: 12.35,
    dailyReturn: 0.82,
    monthlyReturn: 6.3,
    return3m: 16.0,
    return6m: 30.5,
    ytdReturn: 40.5,
    yearlyReturn: 82.0,
    return3y: 440.0,
    return5y: 1170.0,
    riskValue: 6,
    totalValue: 3700000000,
    investorCount: 21500,
    managementFee: 2.5,
    assetAllocation: [
      { category: 'Hisse Senedi', percentage: 68.0 },
      { category: 'Yabancı Hisse / ETF', percentage: 18.0 },
      { category: 'Nakit', percentage: 14.0 },
    ],
  },
  {
    code: 'PAL',
    name: 'Pardus Portföy Birinci Değişken Fon',
    category: 'Değişken Fon',
    founder: 'Pardus Portföy Yönetimi A.Ş.',
    price: 3.12,
    dailyReturn: 0.62,
    monthlyReturn: 5.1,
    return3m: 13.4,
    return6m: 26.0,
    ytdReturn: 35.0,
    yearlyReturn: 71.0,
    return3y: 385.0,
    return5y: 980.0,
    riskValue: 5,
    totalValue: 1950000000,
    investorCount: 12800,
    managementFee: 2.0,
    assetAllocation: [
      { category: 'Hisse Senedi', percentage: 52.0 },
      { category: 'Borçlanma Araçları', percentage: 33.0 },
      { category: 'Kıymetli Maden', percentage: 15.0 },
    ],
  },

  // ==========================================
  // 3. FON SEPETİ & YABANCI HİSSELER / TEMATİK
  // ==========================================
  {
    code: 'AFT',
    name: 'Ak Portföy Amerika Yabancı Hisse Senedi Fonu',
    category: 'Fon Sepeti Fonu',
    founder: 'Ak Portföy Yönetimi A.Ş.',
    price: 0.8924,
    dailyReturn: 1.12,
    monthlyReturn: 7.45,
    return3m: 22.1,
    return6m: 41.5,
    ytdReturn: 48.6,
    yearlyReturn: 94.2,
    return3y: 520.4,
    return5y: 1450.0,
    riskValue: 7,
    totalValue: 18400000000,
    investorCount: 88200,
    managementFee: 2.9,
    assetAllocation: [
      { category: 'Yabancı Hisse Senedi (ABD)', percentage: 91.2 },
      { category: 'Yabancı ETF', percentage: 5.8 },
      { category: 'Döviz / Nakit', percentage: 3.0 },
    ],
  },
  {
    code: 'YAY',
    name: 'Yapı Kredi Portföy Yabancı Teknoloji Sektörü Hisse Senedi Fonu',
    category: 'Fon Sepeti Fonu',
    founder: 'Yapı Kredi Portföy Yönetimi A.Ş.',
    price: 1.482,
    dailyReturn: 1.84,
    monthlyReturn: 9.15,
    return3m: 26.4,
    return6m: 48.2,
    ytdReturn: 54.0,
    yearlyReturn: 108.5,
    return3y: 590.2,
    return5y: 1680.0,
    riskValue: 7,
    totalValue: 14200000000,
    investorCount: 64100,
    managementFee: 2.8,
    assetAllocation: [
      { category: 'Yabancı Teknoloji Hisseleri', percentage: 93.0 },
      { category: 'Yabancı Borsa Yatırım Fonu', percentage: 4.5 },
      { category: 'Nakit / Takas', percentage: 2.5 },
    ],
  },
  {
    code: 'AFA',
    name: 'Ak Portföy Amerika Yabancı BIST Dışı Teknoloji Fonu',
    category: 'Fon Sepeti Fonu',
    founder: 'Ak Portföy Yönetimi A.Ş.',
    price: 0.64,
    dailyReturn: 1.45,
    monthlyReturn: 8.1,
    return3m: 23.0,
    return6m: 44.0,
    ytdReturn: 50.0,
    yearlyReturn: 99.0,
    return3y: 540.0,
    return5y: 1520.0,
    riskValue: 7,
    totalValue: 8800000000,
    investorCount: 41000,
    managementFee: 2.8,
    assetAllocation: [
      { category: 'ABD Teknoloji Hisseleri', percentage: 92.0 },
      { category: 'Nakit', percentage: 8.0 },
    ],
  },
  {
    code: 'IJV',
    name: 'İş Portföy Yabancı Teknoloji Fon Sepeti Fonu',
    category: 'Fon Sepeti Fonu',
    founder: 'İş Portföy Yönetimi A.Ş.',
    price: 2.15,
    dailyReturn: 1.75,
    monthlyReturn: 8.9,
    return3m: 25.1,
    return6m: 46.5,
    ytdReturn: 52.0,
    yearlyReturn: 104.0,
    return3y: 570.0,
    return5y: 1610.0,
    riskValue: 7,
    totalValue: 6900000000,
    investorCount: 37000,
    managementFee: 2.7,
    assetAllocation: [
      { category: 'Global Teknoloji', percentage: 94.0 },
      { category: 'Para Piyasası', percentage: 6.0 },
    ],
  },
  {
    code: 'AFV',
    name: 'Ak Portföy Avrupa Yabancı Hisse Senedi Fonu',
    category: 'Fon Sepeti Fonu',
    founder: 'Ak Portföy Yönetimi A.Ş.',
    price: 0.485,
    dailyReturn: 0.75,
    monthlyReturn: 4.8,
    return3m: 14.0,
    return6m: 27.0,
    ytdReturn: 32.5,
    yearlyReturn: 64.0,
    return3y: 330.0,
    return5y: 890.0,
    riskValue: 6,
    totalValue: 4200000000,
    investorCount: 22000,
    managementFee: 2.5,
    assetAllocation: [
      { category: 'Avrupa Hisseleri (STOXX 600)', percentage: 92.0 },
      { category: 'Nakit', percentage: 8.0 },
    ],
  },
  {
    code: 'ART',
    name: 'Ak Portföy Robotik ve Yapay Zeka Teknolojileri Fonu',
    category: 'Fon Sepeti Fonu',
    founder: 'Ak Portföy Yönetimi A.Ş.',
    price: 0.725,
    dailyReturn: 2.05,
    monthlyReturn: 10.2,
    return3m: 27.5,
    return6m: 50.0,
    ytdReturn: 57.0,
    yearlyReturn: 112.0,
    return3y: 610.0,
    return5y: 1750.0,
    riskValue: 7,
    totalValue: 9800000000,
    investorCount: 51000,
    managementFee: 2.9,
    assetAllocation: [
      { category: 'Yapay Zeka ve Çip Hisseleri', percentage: 95.0 },
      { category: 'Nakit', percentage: 5.0 },
    ],
  },
  {
    code: 'AES',
    name: 'Ak Portföy Elektrikli ve Otonom Araç Teknolojileri Fonu',
    category: 'Fon Sepeti Fonu',
    founder: 'Ak Portföy Yönetimi A.Ş.',
    price: 0.54,
    dailyReturn: 1.65,
    monthlyReturn: 8.5,
    return3m: 22.0,
    return6m: 42.0,
    ytdReturn: 48.0,
    yearlyReturn: 95.0,
    return3y: 490.0,
    return5y: 1380.0,
    riskValue: 7,
    totalValue: 5800000000,
    investorCount: 31000,
    managementFee: 2.8,
    assetAllocation: [
      { category: 'Elektrikli Araç & Batarya', percentage: 93.0 },
      { category: 'Nakit', percentage: 7.0 },
    ],
  },
  {
    code: 'CPU',
    name: 'İş Portföy Yarı İletken Teknolojileri Fon Sepeti Fonu',
    category: 'Fon Sepeti Fonu',
    founder: 'İş Portföy Yönetimi A.Ş.',
    price: 1.82,
    dailyReturn: 2.25,
    monthlyReturn: 11.8,
    return3m: 29.0,
    return6m: 53.5,
    ytdReturn: 63.0,
    yearlyReturn: 119.0,
    return3y: 650.0,
    return5y: 1910.0,
    riskValue: 7,
    totalValue: 7900000000,
    investorCount: 44000,
    managementFee: 2.9,
    assetAllocation: [
      { category: 'Semiconductor / Yarı İletken', percentage: 96.0 },
      { category: 'Para Piyasası', percentage: 4.0 },
    ],
  },
  {
    code: 'BUY',
    name: 'BV Portföy Metaverse ve Dijital Yaşam Fonu',
    category: 'Fon Sepeti Fonu',
    founder: 'BV Portföy Yönetimi A.Ş.',
    price: 0.385,
    dailyReturn: 1.55,
    monthlyReturn: 7.8,
    return3m: 21.0,
    return6m: 39.5,
    ytdReturn: 45.0,
    yearlyReturn: 89.0,
    return3y: 460.0,
    return5y: 1290.0,
    riskValue: 7,
    totalValue: 2400000000,
    investorCount: 15000,
    managementFee: 2.7,
    assetAllocation: [
      { category: 'Dijital Oyun & Metaverse', percentage: 91.0 },
      { category: 'Nakit', percentage: 9.0 },
    ],
  },
  {
    code: 'TGE',
    name: 'İş Portföy Emtia Yabancı BYF Fon Sepeti Fonu',
    category: 'Fon Sepeti Fonu',
    founder: 'İş Portföy Yönetimi A.Ş.',
    price: 0.945,
    dailyReturn: 0.65,
    monthlyReturn: 5.2,
    return3m: 15.5,
    return6m: 29.0,
    ytdReturn: 36.5,
    yearlyReturn: 72.0,
    return3y: 370.0,
    return5y: 950.0,
    riskValue: 6,
    totalValue: 3900000000,
    investorCount: 23000,
    managementFee: 2.4,
    assetAllocation: [
      { category: 'Emtia BYF (Petrol, Bakır, Tarım)', percentage: 92.0 },
      { category: 'Para Piyasası', percentage: 8.0 },
    ],
  },
  {
    code: 'AOY',
    name: 'Ak Portföy Petrol Yabancı BYF Fon Sepeti Fonu',
    category: 'Fon Sepeti Fonu',
    founder: 'Ak Portföy Yönetimi A.Ş.',
    price: 0.42,
    dailyReturn: 0.45,
    monthlyReturn: 4.8,
    return3m: 13.8,
    return6m: 26.5,
    ytdReturn: 33.0,
    yearlyReturn: 66.0,
    return3y: 340.0,
    return5y: 880.0,
    riskValue: 6,
    totalValue: 2800000000,
    investorCount: 16500,
    managementFee: 2.5,
    assetAllocation: [
      { category: 'Petrol & Enerji BYF', percentage: 94.0 },
      { category: 'Nakit', percentage: 6.0 },
    ],
  },

  // ==========================================
  // 4. ALTIN & KIYMETLİ MADENLER FONLARI
  // ==========================================
  {
    code: 'TCA',
    name: 'Tacirler Portföy Altın Fonu',
    category: 'Kıymetli Madenler Fonu',
    founder: 'Tacirler Portföy Yönetimi A.Ş.',
    price: 3.1425,
    dailyReturn: 0.45,
    monthlyReturn: 5.2,
    return3m: 14.8,
    return6m: 28.4,
    ytdReturn: 36.2,
    yearlyReturn: 68.4,
    return3y: 310.5,
    return5y: 720.0,
    riskValue: 5,
    totalValue: 5800000000,
    investorCount: 31200,
    managementFee: 1.5,
    assetAllocation: [
      { category: 'Kıymetli Maden (Altın)', percentage: 88.0 },
      { category: 'Altına Dayalı Kira Sertifikası', percentage: 8.5 },
      { category: 'Para Piyasası', percentage: 3.5 },
    ],
  },
  {
    code: 'KZL',
    name: 'Kuveyt Türk Portföy Altın Katılım Fonu',
    category: 'Kıymetli Madenler Fonu',
    founder: 'Kuveyt Türk Portföy Yönetimi A.Ş.',
    price: 2.8941,
    dailyReturn: 0.42,
    monthlyReturn: 5.15,
    return3m: 14.5,
    return6m: 28.1,
    ytdReturn: 35.8,
    yearlyReturn: 67.9,
    return3y: 305.0,
    return5y: 710.0,
    riskValue: 5,
    totalValue: 9200000000,
    investorCount: 52400,
    managementFee: 1.2,
    assetAllocation: [
      { category: 'Kıymetli Maden (Altın)', percentage: 90.0 },
      { category: 'Katılım Hesabı', percentage: 6.0 },
      { category: 'Altın Kira Sertifikası', percentage: 4.0 },
    ],
  },
  {
    code: 'GTA',
    name: 'Garanti Portföy Altın Fonu',
    category: 'Kıymetli Madenler Fonu',
    founder: 'Garanti Portföy Yönetimi A.Ş.',
    price: 0.285,
    dailyReturn: 0.44,
    monthlyReturn: 5.18,
    return3m: 14.6,
    return6m: 28.2,
    ytdReturn: 36.0,
    yearlyReturn: 68.1,
    return3y: 308.0,
    return5y: 715.0,
    riskValue: 5,
    totalValue: 12500000000,
    investorCount: 78000,
    managementFee: 1.4,
    assetAllocation: [
      { category: 'Fiziki Altın / Borsa', percentage: 92.0 },
      { category: 'Takasbank', percentage: 8.0 },
    ],
  },
  {
    code: 'TTA',
    name: 'İş Portföy Altın Fonu',
    category: 'Kıymetli Madenler Fonu',
    founder: 'İş Portföy Yönetimi A.Ş.',
    price: 0.089,
    dailyReturn: 0.43,
    monthlyReturn: 5.16,
    return3m: 14.5,
    return6m: 28.1,
    ytdReturn: 35.9,
    yearlyReturn: 68.0,
    return3y: 307.0,
    return5y: 712.0,
    riskValue: 5,
    totalValue: 14100000000,
    investorCount: 84000,
    managementFee: 1.35,
    assetAllocation: [
      { category: 'Kıymetli Maden (Altın)', percentage: 91.0 },
      { category: 'Para Piyasası', percentage: 9.0 },
    ],
  },
  {
    code: 'OJT',
    name: 'QNB Finansportföy Gümüş Fon Sepeti Fonu',
    category: 'Kıymetli Madenler Fonu',
    founder: 'QNB Portföy Yönetimi A.Ş.',
    price: 1.84,
    dailyReturn: 0.95,
    monthlyReturn: 6.8,
    return3m: 19.5,
    return6m: 36.0,
    ytdReturn: 44.0,
    yearlyReturn: 79.5,
    return3y: 380.0,
    return5y: 890.0,
    riskValue: 6,
    totalValue: 3400000000,
    investorCount: 24000,
    managementFee: 1.8,
    assetAllocation: [
      { category: 'Gümüş & Kıymetli Maden', percentage: 91.0 },
      { category: 'Para Piyasası', percentage: 9.0 },
    ],
  },
  {
    code: 'KGM',
    name: 'Kuveyt Türk Portföy Kıymetli Madenler Katılım Fonu',
    category: 'Kıymetli Madenler Fonu',
    founder: 'Kuveyt Türk Portföy Yönetimi A.Ş.',
    price: 2.15,
    dailyReturn: 0.52,
    monthlyReturn: 5.4,
    return3m: 15.2,
    return6m: 29.5,
    ytdReturn: 37.5,
    yearlyReturn: 70.0,
    return3y: 320.0,
    return5y: 740.0,
    riskValue: 5,
    totalValue: 4200000000,
    investorCount: 27000,
    managementFee: 1.4,
    assetAllocation: [
      { category: 'Altın & Platin & Gümüş', percentage: 89.0 },
      { category: 'Katılım Hesabı', percentage: 11.0 },
    ],
  },

  // ==========================================
  // 5. PARA PİYASASI & LİKİT FONLAR
  // ==========================================
  {
    code: 'TP2',
    name: 'TERA PORTFÖY PARA PİYASASI (TL) FONU',
    category: 'Para Piyasası Fonu',
    founder: 'TERA PORTFÖY YÖNETİMİ A.Ş.',
    price: 2.2408,
    dailyReturn: 0.13,
    monthlyReturn: 4.18,
    return3m: 12.51,
    return6m: 28.25,
    ytdReturn: 39.21,
    yearlyReturn: 60.99,
    return3y: 122.0,
    return5y: 350.0,
    riskValue: 2,
    totalValue: 243001029089,
    investorCount: 168935,
    managementFee: 0.95,
    assetAllocation: [
      { category: 'Takasbank Para Piyasası & Ters Repo', percentage: 75.0 },
      { category: 'Vadeli Mevduat (TL)', percentage: 20.0 },
      { category: 'Finansman Bonosu / Kısa Vadeli Tahvil', percentage: 5.0 },
    ],
    kapLink: 'https://www.kap.org.tr/tr/fon-bilgileri/genel/tp2-tera-portfoy-para-piyasasi-tl-fonu',
  },
  {
    code: 'PPZ',
    name: 'Azimut Portföy Para Piyasası Fonu',
    category: 'Para Piyasası Fonu',
    founder: 'Azimut Portföy Yönetimi A.Ş.',
    price: 6.8421,
    dailyReturn: 0.14,
    monthlyReturn: 4.25,
    return3m: 13.1,
    return6m: 27.5,
    ytdReturn: 38.2,
    yearlyReturn: 58.6,
    return3y: 185.0,
    return5y: 390.0,
    riskValue: 1,
    totalValue: 24500000000,
    investorCount: 112000,
    managementFee: 0.95,
    assetAllocation: [
      { category: 'Ters Repo', percentage: 45.0 },
      { category: 'Takasbank Para Piyasası', percentage: 35.0 },
      { category: 'Vadeli Mevduat', percentage: 20.0 },
    ],
  },
  {
    code: 'ZP6',
    name: 'Ziraat Portföy Kısa Vadeli Borçlanma Araçları Fonu',
    category: 'Para Piyasası Fonu',
    founder: 'Ziraat Portföy Yönetimi A.Ş.',
    price: 2.14,
    dailyReturn: 0.13,
    monthlyReturn: 4.15,
    return3m: 12.8,
    return6m: 26.8,
    ytdReturn: 37.5,
    yearlyReturn: 57.0,
    return3y: 178.0,
    return5y: 370.0,
    riskValue: 1,
    totalValue: 18900000000,
    investorCount: 95000,
    managementFee: 0.85,
    assetAllocation: [
      { category: 'Özel Sektör Tahvili', percentage: 50.0 },
      { category: 'Kamu Borçlanma', percentage: 30.0 },
      { category: 'Mevduat', percentage: 20.0 },
    ],
  },
  {
    code: 'HPT',
    name: 'Hedef Portföy Para Piyasası Fonu',
    category: 'Para Piyasası Fonu',
    founder: 'Hedef Portföy Yönetimi A.Ş.',
    price: 3.82,
    dailyReturn: 0.14,
    monthlyReturn: 4.28,
    return3m: 13.2,
    return6m: 27.8,
    ytdReturn: 38.5,
    yearlyReturn: 59.0,
    return3y: 188.0,
    return5y: 395.0,
    riskValue: 1,
    totalValue: 16200000000,
    investorCount: 78000,
    managementFee: 0.9,
    assetAllocation: [
      { category: 'Takasbank Para Piyasası', percentage: 40.0 },
      { category: 'Ters Repo', percentage: 35.0 },
      { category: 'Mevduat', percentage: 25.0 },
    ],
  },
  {
    code: 'DPT',
    name: 'Deniz Portföy Para Piyasası Fonu',
    category: 'Para Piyasası Fonu',
    founder: 'Deniz Portföy Yönetimi A.Ş.',
    price: 4.25,
    dailyReturn: 0.13,
    monthlyReturn: 4.18,
    return3m: 12.9,
    return6m: 27.0,
    ytdReturn: 37.8,
    yearlyReturn: 57.5,
    return3y: 180.0,
    return5y: 380.0,
    riskValue: 1,
    totalValue: 15400000000,
    investorCount: 82000,
    managementFee: 0.9,
    assetAllocation: [
      { category: 'Ters Repo', percentage: 50.0 },
      { category: 'Takasbank', percentage: 30.0 },
      { category: 'Mevduat', percentage: 20.0 },
    ],
  },
  {
    code: 'KLU',
    name: 'Kuveyt Türk Portföy Kısa Vadeli Kira Sertifikaları Fonu',
    category: 'Para Piyasası Fonu',
    founder: 'Kuveyt Türk Portföy Yönetimi A.Ş.',
    price: 1.95,
    dailyReturn: 0.12,
    monthlyReturn: 3.95,
    return3m: 12.2,
    return6m: 25.5,
    ytdReturn: 35.5,
    yearlyReturn: 54.0,
    return3y: 168.0,
    return5y: 350.0,
    riskValue: 1,
    totalValue: 12800000000,
    investorCount: 68000,
    managementFee: 0.8,
    assetAllocation: [
      { category: 'Kira Sertifikası (Sukuk)', percentage: 70.0 },
      { category: 'Katılım Hesabı', percentage: 30.0 },
    ],
  },

  // ==========================================
  // 6. BORÇLANMA ARAÇLARI & EUROBOND FONLARI
  // ==========================================
  {
    code: 'DBH',
    name: 'Deniz Portföy Eurobond (Döviz) Borçlanma Araçları Fonu',
    category: 'Borçlanma Araçları Fonu',
    founder: 'Deniz Portföy Yönetimi A.Ş.',
    price: 0.74,
    dailyReturn: 0.25,
    monthlyReturn: 3.8,
    return3m: 11.5,
    return6m: 23.0,
    ytdReturn: 32.0,
    yearlyReturn: 61.5,
    return3y: 280.0,
    return5y: 640.0,
    riskValue: 4,
    totalValue: 8900000000,
    investorCount: 42000,
    managementFee: 1.8,
    assetAllocation: [
      { category: 'T.C. Hazine Eurobond', percentage: 85.0 },
      { category: 'Özel Sektör Eurobond', percentage: 12.0 },
      { category: 'Döviz Mevduat', percentage: 3.0 },
    ],
  },
  {
    code: 'ALE',
    name: 'Ak Portföy Eurobond (Döviz) Borçlanma Araçları Fonu',
    category: 'Borçlanma Araçları Fonu',
    founder: 'Ak Portföy Yönetimi A.Ş.',
    price: 0.52,
    dailyReturn: 0.28,
    monthlyReturn: 3.9,
    return3m: 11.8,
    return6m: 23.5,
    ytdReturn: 32.5,
    yearlyReturn: 62.0,
    return3y: 285.0,
    return5y: 650.0,
    riskValue: 4,
    totalValue: 11200000000,
    investorCount: 54000,
    managementFee: 1.75,
    assetAllocation: [
      { category: 'Kamu Eurobond', percentage: 88.0 },
      { category: 'Yabancı Tahvil', percentage: 8.0 },
      { category: 'Nakit', percentage: 4.0 },
    ],
  },
  {
    code: 'YBE',
    name: 'Yapı Kredi Portföy Eurobond Borçlanma Araçları Fonu',
    category: 'Borçlanma Araçları Fonu',
    founder: 'Yapı Kredi Portföy Yönetimi A.Ş.',
    price: 1.15,
    dailyReturn: 0.26,
    monthlyReturn: 3.85,
    return3m: 11.6,
    return6m: 23.2,
    ytdReturn: 32.2,
    yearlyReturn: 61.8,
    return3y: 282.0,
    return5y: 645.0,
    riskValue: 4,
    totalValue: 9800000000,
    investorCount: 47000,
    managementFee: 1.7,
    assetAllocation: [
      { category: 'Eurobond', percentage: 90.0 },
      { category: 'Döviz Likit', percentage: 10.0 },
    ],
  },
  {
    code: 'ZPE',
    name: 'Ziraat Portföy Eurobond (Döviz) Borçlanma Araçları Fonu',
    category: 'Borçlanma Araçları Fonu',
    founder: 'Ziraat Portföy Yönetimi A.Ş.',
    price: 0.38,
    dailyReturn: 0.24,
    monthlyReturn: 3.75,
    return3m: 11.2,
    return6m: 22.8,
    ytdReturn: 31.5,
    yearlyReturn: 60.5,
    return3y: 275.0,
    return5y: 630.0,
    riskValue: 4,
    totalValue: 8400000000,
    investorCount: 39000,
    managementFee: 1.6,
    assetAllocation: [
      { category: 'Hazine Eurobond', percentage: 87.0 },
      { category: 'Döviz Repo', percentage: 13.0 },
    ],
  },
];

const FUND_FOUNDER_MAP: Record<string, { founder: string; category: FundCategory }> = {
  THF: { founder: 'Tera Portföy Yönetimi A.Ş.', category: 'Hisse Senedi Fonu' },
  TP: { founder: 'Tera Portföy Yönetimi A.Ş.', category: 'Hisse Senedi Fonu' },
  TE: { founder: 'TEB Portföy Yönetimi A.Ş.', category: 'Hisse Senedi Fonu' },
  TC: { founder: 'Tacirler Portföy Yönetimi A.Ş.', category: 'Değişken Fon' },
  TK: { founder: 'Tacirler Portföy Yönetimi A.Ş.', category: 'Hisse Senedi Fonu' },
  TD: { founder: 'Tacirler Portföy Yönetimi A.Ş.', category: 'Değişken Fon' },
  TI: { founder: 'İş Portföy Yönetimi A.Ş.', category: 'Hisse Senedi Fonu' },
  TT: { founder: 'İş Portföy Yönetimi A.Ş.', category: 'Hisse Senedi Fonu' },
  TA: { founder: 'İş Portföy Yönetimi A.Ş.', category: 'Hisse Senedi Fonu' },
  AK: { founder: 'Ak Portföy Yönetimi A.Ş.', category: 'Hisse Senedi Fonu' },
  AF: { founder: 'Ak Portföy Yönetimi A.Ş.', category: 'Fon Sepeti Fonu' },
  AR: { founder: 'Ak Portföy Yönetimi A.Ş.', category: 'Fon Sepeti Fonu' },
  AE: { founder: 'Ak Portföy Yönetimi A.Ş.', category: 'Fon Sepeti Fonu' },
  AO: { founder: 'Ak Portföy Yönetimi A.Ş.', category: 'Fon Sepeti Fonu' },
  AL: { founder: 'Ak Portföy Yönetimi A.Ş.', category: 'Borçlanma Araçları Fonu' },
  GM: { founder: 'Garanti Portföy Yönetimi A.Ş.', category: 'Hisse Senedi Fonu' },
  GT: { founder: 'Garanti Portföy Yönetimi A.Ş.', category: 'Kıymetli Madenler Fonu' },
  GB: { founder: 'Garanti Portföy Yönetimi A.Ş.', category: 'Borçlanma Araçları Fonu' },
  GO: { founder: 'Garanti Portföy Yönetimi A.Ş.', category: 'Değişken Fon' },
  YA: { founder: 'Yapı Kredi Portföy Yönetimi A.Ş.', category: 'Hisse Senedi Fonu' },
  YB: { founder: 'Yapı Kredi Portföy Yönetimi A.Ş.', category: 'Borçlanma Araçları Fonu' },
  YP: { founder: 'Yapı Kredi Portföy Yönetimi A.Ş.', category: 'Değişken Fon' },
  YZ: { founder: 'Yapı Kredi Portföy Yönetimi A.Ş.', category: 'Fon Sepeti Fonu' },
  ZP: { founder: 'Ziraat Portföy Yönetimi A.Ş.', category: 'Para Piyasası Fonu' },
  ZS: { founder: 'Ziraat Portföy Yönetimi A.Ş.', category: 'Hisse Senedi Fonu' },
  ZB: { founder: 'Ziraat Portföy Yönetimi A.Ş.', category: 'Değişken Fon' },
  KZ: { founder: 'Kuveyt Türk Portföy Yönetimi A.Ş.', category: 'Kıymetli Madenler Fonu' },
  KP: { founder: 'Kuveyt Türk Portföy Yönetimi A.Ş.', category: 'Hisse Senedi Fonu' },
  KL: { founder: 'Kuveyt Türk Portföy Yönetimi A.Ş.', category: 'Para Piyasası Fonu' },
  KG: { founder: 'Kuveyt Türk Portföy Yönetimi A.Ş.', category: 'Kıymetli Madenler Fonu' },
  II: { founder: 'İstanbul Portföy Yönetimi A.Ş.', category: 'Hisse Senedi Fonu' },
  IP: { founder: 'İstanbul Portföy Yönetimi A.Ş.', category: 'Değişken Fon' },
  IC: { founder: 'İstanbul Portföy Yönetimi A.Ş.', category: 'Hisse Senedi Fonu' },
  IK: { founder: 'İstanbul Portföy Yönetimi A.Ş.', category: 'Değişken Fon' },
  NN: { founder: 'Hedef Portföy Yönetimi A.Ş.', category: 'Hisse Senedi Fonu' },
  HK: { founder: 'Hedef Portföy Yönetimi A.Ş.', category: 'Hisse Senedi Fonu' },
  HP: { founder: 'Hedef Portföy Yönetimi A.Ş.', category: 'Para Piyasası Fonu' },
  HY: { founder: 'Hedef Portföy Yönetimi A.Ş.', category: 'Hisse Senedi Fonu' },
  MA: { founder: 'Marmara Capital Portföy Yönetimi A.Ş.', category: 'Hisse Senedi Fonu' },
  DB: { founder: 'Deniz Portföy Yönetimi A.Ş.', category: 'Borçlanma Araçları Fonu' },
  DP: { founder: 'Deniz Portföy Yönetimi A.Ş.', category: 'Para Piyasası Fonu' },
  DA: { founder: 'Deniz Portföy Yönetimi A.Ş.', category: 'Hisse Senedi Fonu' },
  OP: { founder: 'Oyak Portföy Yönetimi A.Ş.', category: 'Hisse Senedi Fonu' },
  OY: { founder: 'Oyak Portföy Yönetimi A.Ş.', category: 'Hisse Senedi Fonu' },
  OJ: { founder: 'QNB Portföy Yönetimi A.Ş.', category: 'Kıymetli Madenler Fonu' },
  OK: { founder: 'QNB Portföy Yönetimi A.Ş.', category: 'Para Piyasası Fonu' },
  PP: { founder: 'Azimut Portföy Yönetimi A.Ş.', category: 'Para Piyasası Fonu' },
  GP: { founder: 'Gri Portföy Yönetimi A.Ş.', category: 'Değişken Fon' },
  NR: { founder: 'Neo Portföy Yönetimi A.Ş.', category: 'Değişken Fon' },
  BU: { founder: 'BV Portföy Yönetimi A.Ş.', category: 'Fon Sepeti Fonu' },
  PA: { founder: 'Pardus Portföy Yönetimi A.Ş.', category: 'Değişken Fon' },
  RP: { founder: 'Re-Pie Portföy Yönetimi A.Ş.', category: 'Değişken Fon' },
  FI: { founder: 'Fiba Portföy Yönetimi A.Ş.', category: 'Para Piyasası Fonu' },
  FY: { founder: 'Fiba Portföy Yönetimi A.Ş.', category: 'Değişken Fon' },
  VK: { founder: 'Vakıf Portföy Yönetimi A.Ş.', category: 'Para Piyasası Fonu' },
  HD: { founder: 'Halk Portföy Yönetimi A.Ş.', category: 'Hisse Senedi Fonu' },
  HL: { founder: 'Halk Portföy Yönetimi A.Ş.', category: 'Para Piyasası Fonu' },

  // Single letter fallback
  T: { founder: 'İş Portföy Yönetimi A.Ş.', category: 'Hisse Senedi Fonu' },
  A: { founder: 'Ak Portföy Yönetimi A.Ş.', category: 'Fon Sepeti Fonu' },
  G: { founder: 'Garanti Portföy Yönetimi A.Ş.', category: 'Hisse Senedi Fonu' },
  Y: { founder: 'Yapı Kredi Portföy Yönetimi A.Ş.', category: 'Hisse Senedi Fonu' },
  Z: { founder: 'Ziraat Portföy Yönetimi A.Ş.', category: 'Para Piyasası Fonu' },
  K: { founder: 'Kuveyt Türk Portföy Yönetimi A.Ş.', category: 'Kıymetli Madenler Fonu' },
  I: { founder: 'İstanbul Portföy Yönetimi A.Ş.', category: 'Hisse Senedi Fonu' },
  H: { founder: 'Hedef Portföy Yönetimi A.Ş.', category: 'Hisse Senedi Fonu' },
  D: { founder: 'Deniz Portföy Yönetimi A.Ş.', category: 'Borçlanma Araçları Fonu' },
  O: { founder: 'Oyak Portföy Yönetimi A.Ş.', category: 'Hisse Senedi Fonu' },
  N: { founder: 'Neo Portföy Yönetimi A.Ş.', category: 'Değişken Fon' },
  M: { founder: 'Marmara Capital Portföy Yönetimi A.Ş.', category: 'Hisse Senedi Fonu' },
  P: { founder: 'Pardus Portföy Yönetimi A.Ş.', category: 'Değişken Fon' },
  B: { founder: 'BV Portföy Yönetimi A.Ş.', category: 'Fon Sepeti Fonu' },
  F: { founder: 'Fiba Portföy Yönetimi A.Ş.', category: 'Para Piyasası Fonu' },
  V: { founder: 'Vakıf Portföy Yönetimi A.Ş.', category: 'Para Piyasası Fonu' },
  R: { founder: 'Re-Pie Portföy Yönetimi A.Ş.', category: 'Değişken Fon' },
  S: { founder: 'Strateji Portföy Yönetimi A.Ş.', category: 'Değişken Fon' },
};

export function getAllFunds(filter?: {
  category?: string;
  search?: string;
  minRisk?: number;
  maxRisk?: number;
}): TefasFundInfo[] {
  // Merge curated funds and full TEFAS directory (1051 funds)
  const codeMap = new Map<string, TefasFundInfo>();

  for (const f of TEFAS_FUNDS) {
    codeMap.set(f.code.toUpperCase(), f);
  }

  // Add all funds from TEFAS directory if not already loaded with curated details
  for (const dirEntry of (TEFAS_DIRECTORY as { code: string; name: string; founder: string; category: FundCategory }[])) {
    const sym = dirEntry.code.toUpperCase();
    if (!codeMap.has(sym)) {
      const f = getFundByCode(sym);
      if (f) codeMap.set(sym, f);
    }
  }

  let list = Array.from(codeMap.values());

  if (filter?.search && filter.search.trim().length > 0) {
    const q = filter.search.trim();
    const scoredList: { fund: TefasFundInfo; score: number }[] = [];

    for (const fund of list) {
      if (filter.category && filter.category !== 'ALL' && fund.category !== filter.category) {
        continue;
      }
      if (filter.minRisk && fund.riskValue < filter.minRisk) continue;
      if (filter.maxRisk && fund.riskValue > filter.maxRisk) continue;

      const score = calculateFuzzyScore(q, fund.code, fund.name, [fund.founder, fund.category]);
      if (score > 0) {
        scoredList.push({ fund, score });
      }
    }

    scoredList.sort((a, b) => b.score - a.score);
    return scoredList.map((item) => item.fund);
  }

  return list.filter((fund) => {
    if (filter?.category && filter.category !== 'ALL' && fund.category !== filter.category) {
      return false;
    }
    if (filter?.minRisk && fund.riskValue < filter.minRisk) return false;
    if (filter?.maxRisk && fund.riskValue > filter.maxRisk) return false;
    return true;
  });
}

/**
 * Get fund by code with accurate name, founder, and category
 */
export function getFundByCode(code: string): TefasFundInfo | null {
  const sym = code.toUpperCase().trim();
  const existing = TEFAS_FUNDS.find((f) => f.code === sym);
  if (existing) return existing;

  // Check in TEFAS directory (all 1051 official TEFAS funds)
  const dirEntry = (TEFAS_DIRECTORY as { code: string; name: string; founder: string; category: FundCategory }[]).find(
    (f) => f.code === sym
  );

  // If not a registered TEFAS fund in the directory or curated list, return null (DO NOT FABRICATE FAKE FUNDS!)
  if (!dirEntry) {
    return null;
  }

  const fundName = dirEntry.name;
  const founder = dirEntry.founder;
  const category = dirEntry.category;

  // Category-tailored realistic baseline price & returns
  let basePrice = 5.0;
  let dailyReturn = 0.5;
  let monthlyReturn = 4.5;
  let riskValue = 5;

  if (category === 'Para Piyasası Fonu') {
    basePrice = 2.25;
    dailyReturn = 0.13;
    monthlyReturn = 4.15;
    riskValue = 1;
  } else if (category === 'Borçlanma Araçları Fonu') {
    basePrice = 1.15;
    dailyReturn = 0.25;
    monthlyReturn = 3.8;
    riskValue = 3;
  } else if (category === 'Kıymetli Madenler Fonu' || category === 'Altın Fonu') {
    basePrice = 2.85;
    dailyReturn = 0.45;
    monthlyReturn = 5.2;
    riskValue = 5;
  } else if (category === 'Hisse Senedi Fonu') {
    basePrice = 12.5;
    dailyReturn = 0.85;
    monthlyReturn = 6.5;
    riskValue = 6;
  } else if (category === 'Fon Sepeti Fonu') {
    basePrice = 1.45;
    dailyReturn = 1.1;
    monthlyReturn = 7.5;
    riskValue = 7;
  } else if (category === 'Katılım Fonu') {
    basePrice = 3.2;
    dailyReturn = 0.55;
    monthlyReturn = 5.0;
    riskValue = 5;
  }

  const return3m = Number((monthlyReturn * 2.8).toFixed(1));
  const return6m = Number((monthlyReturn * 5.2).toFixed(1));
  const ytdReturn = Number((monthlyReturn * 6.5).toFixed(1));
  const yearlyReturn = Number((monthlyReturn * 11.5).toFixed(1));
  const return3y = Number((yearlyReturn * 3.5).toFixed(0));
  const return5y = Number((yearlyReturn * 8.0).toFixed(0));

  const totalValue = 2500000000;
  const investorCount = 15000;
  const managementFee = category === 'Para Piyasası Fonu' ? 0.95 : category === 'Borçlanma Araçları Fonu' ? 1.5 : 2.5;

  // Category-specific asset allocation
  let assetAllocation = [
    { category: 'Hisse Senedi / Menkul Kıymet', percentage: 50.0 },
    { category: 'Borçlanma Araçları / Tahvil', percentage: 35.0 },
    { category: 'Para Piyasası & Nakit', percentage: 15.0 },
  ];

  if (category === 'Para Piyasası Fonu') {
    assetAllocation = [
      { category: 'Takasbank Para Piyasası & Ters Repo', percentage: 75.0 },
      { category: 'Vadeli Mevduat (TL)', percentage: 20.0 },
      { category: 'Finansman Bonosu / Kısa Vadeli Tahvil', percentage: 5.0 },
    ];
  } else if (category === 'Kıymetli Madenler Fonu' || category === 'Altın Fonu') {
    assetAllocation = [
      { category: 'Kıymetli Madenler (Altın & Gümüş)', percentage: 88.5 },
      { category: 'Kıymetli Maden Katılma / BYF', percentage: 8.0 },
      { category: 'Takasbank & Nakit', percentage: 3.5 },
    ];
  } else if (category === 'Borçlanma Araçları Fonu') {
    assetAllocation = [
      { category: 'Devlet İç Borçlanma Senetleri (DİBS)', percentage: 62.0 },
      { category: 'Özel Sektör Borçlanma Araçları', percentage: 28.0 },
      { category: 'Ters Repo & Nakit', percentage: 10.0 },
    ];
  } else if (category === 'Hisse Senedi Fonu') {
    assetAllocation = [
      { category: 'BIST Hisse Senetleri', percentage: 88.0 },
      { category: 'Takasbank Para Piyasası / Ters Repo', percentage: 8.0 },
      { category: 'VİOP & Nakit Teminatı', percentage: 4.0 },
    ];
  } else if (category === 'Fon Sepeti Fonu') {
    assetAllocation = [
      { category: 'Yabancı Borsa Yatırım Fonları (ETF)', percentage: 72.0 },
      { category: 'Yabancı Hisse Senetleri', percentage: 20.0 },
      { category: 'Döviz & Likit', percentage: 8.0 },
    ];
  } else if (category === 'Katılım Fonu') {
    assetAllocation = [
      { category: 'Katılım Endeksi Hisseleri & Kira Sertifikaları (Sukuk)', percentage: 85.0 },
      { category: 'Katılma Hesabı (TL/Döviz)', percentage: 12.0 },
      { category: 'Altın & Kıymetli Maden', percentage: 3.0 },
    ];
  }

  return {
    code: sym,
    name: fundName,
    category,
    founder,
    price: basePrice,
    dailyReturn,
    monthlyReturn,
    return3m,
    return6m,
    ytdReturn,
    yearlyReturn,
    return3y,
    return5y,
    riskValue,
    totalValue,
    investorCount,
    managementFee,
    assetAllocation,
    kapLink: `https://www.kap.org.tr/tr/fon-bilgileri/genel/${sym.toLowerCase()}`,
  };
}

/**
 * Live TEFAS fund detail fetcher
 */
export async function fetchTefasLiveFundDetail(code: string): Promise<TefasFundInfo | null> {
  const { fetchTefasLiveDetail } = await import('@/lib/api/tefas');
  const live = await fetchTefasLiveDetail(code);
  return live || getFundByCode(code);
}

export function generateFundHistory(code: string, days: number = 90, basePrice?: number) {
  const fund = getFundByCode(code);
  if (!fund) return [];
  const endPrice = basePrice || fund.price;
  const history = [];
  const now = new Date();

  let price = endPrice * 0.85;

  for (let i = days; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);

    if (d.getDay() === 0 || d.getDay() === 6) continue;

    const dateStr = d.toISOString().split('T')[0];
    const change = Math.sin(i * 0.2 + fund.riskValue) * 0.008 + 0.002;
    price = price * (1 + change);

    history.push({
      date: dateStr,
      price: Number(price.toFixed(4)),
    });
  }

  // Anchor the last item to endPrice
  if (history.length > 0) {
    history[history.length - 1].price = Number(endPrice.toFixed(4));
  }

  return history;
}

