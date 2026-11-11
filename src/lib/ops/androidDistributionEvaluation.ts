export type AndroidDistributionChannelId = 'direct_apk' | 'google_play_store';

export interface AndroidChannelComparison {
  id: AndroidDistributionChannelId;
  name: string;
  artifactFormat: 'APK' | 'AAB';
  storeRequirements: string[];
  signingKeyManagement: string;
  updateDelivery: string;
  supportAndMaintenanceCost: string;
  reviewTurnaround: string;
  estimatedFixedFee: string;
  recommendedRole: string;
}

export interface AndroidStoreReadinessInput {
  applicationId: string;
  minSdk: number;
  targetSdk: number;
  versionCode: number;
  hasReleaseKeystore: boolean;
  hasPrivacyPolicyUrl: boolean;
  hasFinancialDisclaimer: boolean;
  closedTestTestersCount?: number;
}

export interface AndroidStoreReadinessResult {
  readyForProductionSubmission: boolean;
  artifactCommand: string;
  checks: Array<{
    id: string;
    label: string;
    passed: boolean;
    detail: string;
  }>;
  blockers: string[];
}

export const STOCKMIND_ANDROID_BASELINE = {
  applicationId: 'com.kaanirmak.stockmind',
  minSdk: 24,
  targetSdk: 34,
  versionCode: 12,
  versionName: '1.5.1',
} as const;

export const ANDROID_DISTRIBUTION_CHANNELS: readonly AndroidChannelComparison[] = [
  {
    id: 'direct_apk',
    name: 'Doğrudan İmzalı APK Dağıtımı (`/api/download/apk`)',
    artifactFormat: 'APK',
    storeRequirements: [
      'Mağaza incelemesi veya Google Play Console hesabı gerekmez.',
      'Kullanıcı cihazında "Bilinmeyen Uygulamaları Yükle" izni gerekir.',
      'Sunucu üzerinden SHA-256 sağlama toplamı ve sürüm notu sunulur.',
    ],
    signingKeyManagement:
      'İmza anahtarı (`KEYSTORE_PATH`) tamamen geliştirici kontrolündedir; şifreli yedeğin kaybedilmesi halinde mevcut kullanıcılar güncelleme yükleyemez (kaldırıp yeniden kurmaları gerekir).',
    updateDelivery:
      'Uygulama `/api/app/version` ile sürüm kontrolü yapar; kullanıcı yeni APK dosyasını indirip manuel onaylayarak günceller.',
    supportAndMaintenanceCost:
      'Doğrudan kurulum sırasında Play Protect uyarısı ve Android izin adımları nedeniyle kullanıcı başına destek maliyeti yüksektir; buna karşılık mağaza inceleme maliyeti sıfırdır.',
    reviewTurnaround: 'Anlık (0 gün — build ve CDN/Worker yayımı ile anında dağıtım).',
    estimatedFixedFee: '$0',
    recommendedRole: 'Hızlı dahili test, beta kullanıcıları ve acil yama doğrulaması',
  },
  {
    id: 'google_play_store',
    name: 'Resmî Google Play Store Dağıtımı (AAB + Play App Signing)',
    artifactFormat: 'AAB',
    storeRequirements: [
      'Google Play Developer hesabı ve kurumsal/kimlik doğrulaması ($25 tek seferlik kayıt ücreti).',
      'Bireysel geliştirici hesapları için en az 12 test kullanıcısı ile 14 gün kapalı test zorunluluğu.',
      'Play hedef API gereksinimi (targetSdk >= 34), veri güvenliği formu, gizlilik politikası URL’si ve yatırım tavsiyesi olmayan finansal araç beyanı.',
      'Release paketinin `.apk` yerine imzalı `.aab` (`./gradlew bundleRelease`) olarak üretilmesi.',
    ],
    signingKeyManagement:
      'Play App Signing önerilir: dağıtım anahtarını Google yönetir, geliştirici yalnızca Upload Key tutar; Upload Key kaybedilirse Play Console desteği üzerinden güvenli sıfırlama yapılabilir.',
    updateDelivery:
      'Kademeli yayım (%5 -> %20 -> %100), otomatik arka plan güncellemeleri ve cihaza özgü küçültülmüş AAB indirmeleri dahildir.',
    supportAndMaintenanceCost:
      'Her sürümde 1–7 günlük mağaza incelemesi ve yıllık hedef SDK / Data Safety uyumu eforu gerekir; ancak son kullanıcı kurulum güveni artar ve APK yan yükleme destek yükü düşer.',
    reviewTurnaround: '1–7 gün (ilk yayımda kimlik + kapalı test süresi eklenir).',
    estimatedFixedFee: '$25 tek seferlik Play Console ücreti',
    recommendedRole: 'Genel son kullanıcı dağıtımı ve Play Protect güven uyumu',
  },
];

export function evaluateAndroidStoreReadiness(
  input: AndroidStoreReadinessInput,
): AndroidStoreReadinessResult {
  const testersCount = input.closedTestTestersCount ?? 0;
  const checks = [
    {
      id: 'target_sdk',
      label: 'Hedef Android API Düzeyi (targetSdk >= 34)',
      passed: input.targetSdk >= 34,
      detail: `Mevcut targetSdk=${input.targetSdk}`,
    },
    {
      id: 'application_id',
      label: 'Benzersiz Paket Kimliği (applicationId)',
      passed: input.applicationId.includes('.') && input.applicationId.length >= 6,
      detail: input.applicationId,
    },
    {
      id: 'release_keystore',
      label: 'Üretim İmza Deposu (Upload / Release Keystore)',
      passed: input.hasReleaseKeystore,
      detail: input.hasReleaseKeystore ? 'KEYSTORE yapılandırması tanımlı' : 'Release keystore eksik',
    },
    {
      id: 'privacy_policy',
      label: 'Herkese Açık Gizlilik Politikası URL’si',
      passed: input.hasPrivacyPolicyUrl,
      detail: input.hasPrivacyPolicyUrl ? 'Hazır' : 'Play Console Veri Güvenliği için gerekli',
    },
    {
      id: 'financial_disclaimer',
      label: 'Finansal Bilgilendirme / Yatırım Tavsiyesi Değildir Beyanı',
      passed: input.hasFinancialDisclaimer,
      detail: input.hasFinancialDisclaimer ? 'Mevcut' : 'Mağaza incelemesi için açık beyan gerekli',
    },
    {
      id: 'closed_testing',
      label: 'Kapalı Test Havuzu (12 test kullanıcısı / 14 gün)',
      passed: testersCount >= 12,
      detail: `${testersCount}/12 test kullanıcısı`,
    },
  ];

  const blockers = checks.filter((c) => !c.passed).map((c) => `${c.label}: ${c.detail}`);
  return {
    readyForProductionSubmission: blockers.length === 0,
    artifactCommand: 'cd android && ./gradlew bundleRelease',
    checks,
    blockers,
  };
}

