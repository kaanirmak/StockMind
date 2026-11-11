export interface PrivacyHelpSection {
  id: 'market_sources' | 'ai_data_sharing' | 'widget_sharing' | 'account_preferences';
  title: string;
  summary: string;
  bullets: string[];
  actionHref: string;
  actionLabel: string;
}

export const DATA_AND_PRIVACY_SECTIONS: readonly PrivacyHelpSection[] = [
  {
    id: 'market_sources',
    title: 'Piyasa Verisinin Kaynağı ve Güncellik İlkeleri',
    summary:
      'Her fiyat, fon değeri ve haber kaydı; sağlayıcı adı, gözlem zamanı ve alınma zamanı ile sunulur.',
    bullets: [
      'BIST, ABD hisseleri, döviz ve emtia kotasyonları Yahoo Finance uç noktalarından sunucu aracılığıyla doğrulanır; güncel, gecikmeli, son kapanış, eski veya eksik olarak ayrılır.',
      'TEFAS fonları katalogdan bağımsız eşitleme ve resmi NAV tarihine göre listelenir; fiyatı gelmeyen fonlar için 1,00 gibi yer tutucular kullanılmaz.',
      'Resmî KAP özel durum açıklamaları yalnızca kap.org.tr bağlantılarıyla gösterilir; medya haberleriyle karıştırılmaz.',
      'Sağlayıcı kesintisinde son doğrulanmış fiyat zaman damgasıyla korunur ya da veri yok durumu açıkça bildirilir.',
    ],
    actionHref: '/piyasalar',
    actionLabel: 'Piyasalara Git',
  },
  {
    id: 'ai_data_sharing',
    title: 'AI Asistan ve Yatırım Komitesine Giden Veri',
    summary:
      'Yapay zeka özelliklerine yalnızca analiz için gereken asgari ve sunucu tarafından doğrulanmış bağlam gönderilir.',
    bullets: [
      'İstemci tarafından gönderilen ham fiyatlara doğrudan güvenilmez; sembol için son fiyat sunucu piyasa servisinden doğrulanır.',
      'AI Asistanda ve Yatırım Komitesinde sembol, piyasa durumu ve kullanıcının aktif sorusu işlenir; eksik veri durumunda model boşluğu gizlemez.',
      'Kendi OpenRouter API anahtarınızı girdiğinizde istekler doğrudan tercih ettiğiniz model kotanız üzerinden yürütülür.',
      'Hesap değişimi veya misafir oturumu kapanışı sonrası önceki oturumun AI sohbeti ve kayıtlı raporları temizlenir.',
    ],
    actionHref: '/ai-assistant',
    actionLabel: 'AI Asistana Git',
  },
  {
    id: 'widget_sharing',
    title: 'Widget Paylaşımı ve Gizlilik Sınırları',
    summary:
      'Harici gömme ve widget önizlemelerinde varsayılan olarak örnek veri kullanılır; kişisel portföy bilgileri açık seçime tabidir.',
    bullets: [
      'Demo widget üzerinde belirgin biçimde "Örnek Veri" etiketi gösterilir.',
      'Kişisel widget bağlantısı üretmeden önce hangi portföy alanlarının paylaşılacağı açıkça seçilir; tutar gizleme açıkken parasal tutarlar maskelenir.',
      'Widget bağlantıları salt okunur görünüm sunar; işlem veya hesap ayarlarını değiştiremez.',
    ],
    actionHref: '/widgets',
    actionLabel: "Widget'lara Git",
  },
  {
    id: 'account_preferences',
    title: 'Hesap Tercihleri, Bildirimler ve Bülten Kontrolü',
    summary:
      'Tutar gizleme, günlük bülten aboneliği, bildirim kanalları ve oturum verileri kullanıcı kontrolündedir.',
    bullets: [
      'Tutar gizleme etkinleştirildiğinde ana ekran, portföy, ısı haritası, raporlar ve widget önizlemelerindeki parasal değerler gizlenir.',
      'Günlük Gmail bülteni yalnızca onaylı e-posta adresinize ve abonelik açıkken gönderilir; kişiselleştirme açıldığında yalnız izin verilen özetler eklenir.',
      'Android ve Web Push bildirimleri izin durumuna ve cihaz kaydına göre yönetilir; istediğiniz an duraklatılabilir veya cihazdan kaldırılabilir.',
    ],
    actionHref: '/settings',
    actionLabel: 'Hesap Ayarlarını Aç',
  },
] as const;

export function getPrivacyHelpSectionById(id: PrivacyHelpSection['id']): PrivacyHelpSection {
  const found = DATA_AND_PRIVACY_SECTIONS.find((section) => section.id === id);
  if (!found) {
    throw new Error(`Unknown privacy help section: ${id}`);
  }
  return found;
}

