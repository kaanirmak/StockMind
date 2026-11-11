import { MONTE_CARLO_SIMULATIONS } from '@/lib/quant/constants';

export interface ProPlanCapabilityRow {
  id: string;
  feature: string;
  freeScope: string;
  proScope: string;
  dataScope: string;
}

export interface ProSampleOutputPreview {
  badgeLabel: string;
  symbolLabel: string;
  asOfLabel: string;
  modelLabel: string;
  verifiedDataLines: readonly string[];
  assumptionLines: readonly string[];
  committeeSummary: readonly {
    persona: string;
    stance: string;
    rationale: string;
  }[];
  disclaimer: string;
}

export const PRO_PLAN_CAPABILITIES: readonly ProPlanCapabilityRow[] = [
  {
    id: 'ai-models-quota',
    feature: 'AI Asistan Modelleri & Kota',
    freeScope: 'Ücretsiz modeller • 5 soru/saat',
    proScope: 'Tüm katalog modelleri • 20 soru/saat',
    dataScope: 'Kullanıcı seçerse portföy özeti ve doğrulanmış son fiyat verisi eklenir.',
  },
  {
    id: 'investment-committee',
    feature: 'Yatırım Komitesi (4 Perspektif)',
    freeScope: 'Yalnızca örnek çıktı önizlemesi',
    proScope: 'Seçili sembol için çoklu ajan konsensüs raporu',
    dataScope: 'Fiyat sunucudan alınır; eksik finansal oranlar model varsayımı olarak işaretlenir.',
  },
  {
    id: 'quant-tools',
    feature: 'Kantitatif Analiz (DCF, Monte Carlo, Stres)',
    freeScope: 'Temel hesaplama',
    proScope: `${MONTE_CARLO_SIMULATIONS.toLocaleString('tr-TR')} koşulu Monte Carlo, VaR ve stres testleri`,
    dataScope: 'Çıktılar seçili volatilite/horizon ve dönem finansallarına dayanır.',
  },
  {
    id: 'portfolios-alerts',
    feature: 'Portföy & Akıllı Alarm Limitleri',
    freeScope: '1 portföy • 3 aktif fiyat alarmı',
    proScope: 'Sınırsız portföy • Sınırsız alarm + hareket uyarısı',
    dataScope: 'Alarmlar taze kotasyon kontrolü ile çalışır; eski fiyatta tetiklenmez.',
  },
  {
    id: 'daily-bulletin',
    feature: '18:30 Günlük E-posta Bülteni',
    freeScope: 'Kapalı',
    proScope: 'Opt-in kapanış özeti ve varlık eşleşen gelişmeler',
    dataScope: 'Yalnızca doğrulanmış kapanış verileri; kaynağı eksik başlıklar açıkça gizlenir.',
  },
] as const;

export const PRO_DATA_SCOPE_SUMMARY = {
  includedSources: [
    'Sunucu tarafından doğrulanan piyasa kotasyonları (TradingView Scanner / Yahoo Finance / TEFAS)',
    'Açıkça onaylanan portföy pozisyon özeti ve sembol haber eşleşmeleri',
  ],
  exclusionsAndLimits: [
    'StockMind aracı kurum emir iletimi yapmaz; yatırım danışmanlığı değildir.',
    'Canlı fiyat veya finansal tablo erişilemediğinde uydurma rakam üretilmez, eksik alan açıkça işaretlenir.',
  ],
} as const;

export const PRO_SAMPLE_ANALYSIS_PREVIEW: ProSampleOutputPreview = {
  badgeLabel: 'Örnek Çıktı Biçimi (Temsili)',
  symbolLabel: 'ÖRNEK HISSE (DEMO-PRO)',
  asOfLabel: 'Örnek senaryo — canlı piyasa verisi değildir',
  modelLabel: 'Çoklu Ajan Simülasyonu + Doğrulama Çerçevesi',
  verifiedDataLines: [
    'Kotasyon Kaynağı: Sunucudan doğrulanan son fiyat ve gün içi değişim yüzdesi',
    'Finansal Dönem: Varsa son bilanço kalemleri; eksikse "Doğrulanmadı" etiketi',
  ],
  assumptionLines: [
    'Senaryo Ufku: 12 ay baz / iyimser / kötümser varsayım aralığı',
    'Varsayım Etiketi: Model yorumları ile gerçek kaynak verisi birbirinden ayrı gösterilir',
  ],
  committeeSummary: [
    {
      persona: 'Değer Odaklı Perspektif',
      stance: 'Dengeli / İzleme',
      rationale: 'Nakit akışı sürdürülebilirliği ve borçluluk oranı sınırlar içinde görülürse kademeli değerlendirme.',
    },
    {
      persona: 'Risk Odaklı Perspektif',
      stance: 'Temkinli',
      rationale: 'Kur ve faiz duyarlılığı ile bilanço oynaklığı stres senaryosunda izlenmelidir.',
    },
  ],
  disclaimer:
    'Bu önizleme yalnızca StockMind Pro raporlarının yapısını ve veri/varsayım ayrımını göstermek içindir; gerçek varlık tavsiyesi değildir.',
};

