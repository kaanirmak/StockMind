export interface LandingStatItem {
  value: string;
  label: string;
}

export interface LandingFeatureItem {
  icon: string;
  title: string;
  desc: string;
}

export const PRODUCT_SCOPE = {
  supportedLanguages: ['Türkçe'] as const,
  badgeText: 'BIST • NYSE • NASDAQ • TEFAS • Emtia • Kripto',
  heroSubtitle:
    'StockMind ile BIST ve ABD hisselerini, 1.000+ TEFAS fonunu, döviz ve emtiaları veri tazeliği etiketiyle tek panelde takip edin. Portföy muhasebesi, teknik göstergeler ve AI yorumlarıyla karar sürecinizi destekleyin.',
  delayNotice:
    'Fiyat verileri ücretsiz piyasa sağlayıcılarından alınır; borsa hisselerinde ~15 dk gecikmeli/gün içi durum etiketiyle, TEFAS fonlarında günlük kapanış fiyatıyla gösterilir.',
  stats: [
    { value: '6', label: 'Pazar & Sınıf' },
    { value: '1.000+', label: 'Hisse & TEFAS Fonu' },
    { value: '6', label: 'Teknik Gösterge' },
    { value: 'Türkçe', label: 'Arayüz Dili' },
  ] satisfies readonly LandingStatItem[],
  features: [
    {
      icon: '📊',
      title: 'Şeffaf Piyasa Verisi',
      desc: 'BIST, NYSE, NASDAQ, döviz, emtia ve kripto fiyatlarını Güncel, Gecikmeli veya Son Kapanış tazelik etiketiyle izleyin.',
    },
    {
      icon: '📈',
      title: '6 Teknik Gösterge & Quant',
      desc: 'SMA, EMA, RSI, MACD, Bollinger Bantları ve StochRSI göstergeleri; Quant Lab ile DCF, Piotroski ve stres testleri.',
    },
    {
      icon: '💼',
      title: 'Portföy & Nakit Takibi',
      desc: 'Alım/satım kayıtları, ortalama maliyet, nakit dengesi ve günlük/dönemsel performans takibi.',
    },
    {
      icon: '🏦',
      title: '1.000+ TEFAS Fonu',
      desc: 'TEFAS yatırım ve emeklilik fonlarını filtreleyin, performanslarını inceleyin ve portföyünüze ekleyin.',
    },
    {
      icon: '🤖',
      title: 'AI Asistan & Model Seçimi',
      desc: 'Portföy ve piyasa bağlamına dayalı AI destekli bilgilendirme ve yorumlar alın (yatırım tavsiyesi değildir).',
    },
    {
      icon: '🇹🇷',
      title: 'Türkçe Arayüz, Alarm & Widget',
      desc: 'Tamamen Türkçe deneyim; fiyat alarmları, KAP/haber akışı, gömülebilir örnek widget ve Android APK erişimi.',
    },
  ] satisfies readonly LandingFeatureItem[],
} as const;
