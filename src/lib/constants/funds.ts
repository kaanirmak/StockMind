export interface PopularFundItem {
  code: string;
  name: string;
  category: string;
  founder: string;
}

/**
 * Pure client-safe popular TEFAS funds catalog.
 * Zero database or server dependencies.
 */
export const POPULAR_FUNDS: PopularFundItem[] = [
  { code: 'TI2', name: "İŞ PORTFÖY İŞ'TİRİKLERİ ENDEKSİ HİSSE SENEDİ FONU", category: 'Hisse Senedi Fonu', founder: 'İŞ PORTFÖY YÖNETİMİ A.Ş.' },
  { code: 'TTE', name: 'İŞ PORTFÖY BIST TEKNOLOJİ AĞIRLIKLI SINIRLAMALI ENDEKSİ HİSSE SENEDİ FONU', category: 'Hisse Senedi Fonu', founder: 'İŞ PORTFÖY YÖNETİMİ A.Ş.' },
  { code: 'MAC', name: 'MARMARA CAPITAL PORTFÖY HİSSE SENEDİ FONU', category: 'Hisse Senedi Fonu', founder: 'MARMARA CAPITAL PORTFÖY' },
  { code: 'AFT', name: 'AK PORTFÖY YENİ TEKNOLOJİLER YABANCI HİSSE SENEDİ FONU', category: 'Hisse Senedi Fonu', founder: 'AK PORTFÖY YÖNETİMİ A.Ş.' },
  { code: 'YAY', name: 'YAPI KREDİ PORTFÖY YABANCI TEKNOLOJİ SEKTÖRÜ HİSSE SENEDİ FONU', category: 'Hisse Senedi Fonu', founder: 'YAPI KREDİ PORTFÖY' },
  { code: 'KUB', name: 'KUVEYT TÜRK PORTFÖY ALTIN KATILIM FONU', category: 'Kıymetli Madenler Fonu', founder: 'KT PORTFÖY YÖNETİMİ A.Ş.' },
  { code: 'KZL', name: 'KUVEYT TÜRK PORTFÖY KIRA SERTİFİKALARI KATILIM FONU', category: 'Kira Sertifikaları Fonu', founder: 'KT PORTFÖY YÖNETİMİ A.Ş.' },
  { code: 'GTA', name: 'GARANTİ PORTFÖY ALTIN FONU', category: 'Kıymetli Madenler Fonu', founder: 'GARANTİ PORTFÖY YÖNETİMİ A.Ş.' },
  { code: 'TUA', name: 'İŞ PORTFÖY PARA PİYASASI FONU', category: 'Para Piyasası Fonu', founder: 'İŞ PORTFÖY YÖNETİMİ A.Ş.' },
  { code: 'PPZ', name: 'AZİMUT PORTFÖY PARA PİYASASI FONU', category: 'Para Piyasası Fonu', founder: 'AZİMUT PORTFÖY YÖNETİMİ A.Ş.' },
  { code: 'NRC', name: 'NEO PORTFÖY BİRİNCİ DEĞİŞKEN FON', category: 'Değişken Fon', founder: 'NEO PORTFÖY YÖNETİMİ A.Ş.' },
  { code: 'ZPE', name: 'ZİRAAT PORTFÖY KATILIM HİSSE SENEDİ FONU', category: 'Hisse Senedi Fonu', founder: 'ZİRAAT PORTFÖY YÖNETİMİ A.Ş.' },
];
