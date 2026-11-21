export interface AndroidReleaseMetadata {
  packageId: string;
  version: string;
  versionCode: number;
  apkFilename: string;
  downloadUrl: string;
  directApkUrl: string;
  previousVersion: string;
  previousVersionCode: number;
  previousSha256: string;
  publishedAt: string;
  minAndroidVersion: string;
  releaseNotes: string;
  rollbackSteps: string[];
}

export const ANDROID_RELEASE_METADATA: AndroidReleaseMetadata = {
  packageId: 'com.kaanirmak.stockmind',
  version: '2.2.0',
  versionCode: 22,
  apkFilename: 'StockMind.apk',
  downloadUrl: '/api/download/apk',
  directApkUrl: '/StockMind.apk',
  previousVersion: '2.1.0',
  previousVersionCode: 21,
  previousSha256: '3a59818d4a9d586ac5c1e27a3cd01cbec8f062efa04e49304b9ed15a311f38bc',
  publishedAt: '2026-11-22',
  minAndroidVersion: '7.0 (Nougat) ve üzeri',
  releaseNotes:
    'StockMind 2.2: açık başlayan portföy ısı haritası, otomatik kayan Piyasa Nabzı karuseli, borsa bazlı En Çok Değişenler, Piyasalar sonsuz kaydırma, kompakt portföy üst çubuğu, işlem modalı içinde Excel yükleme, yeni /activity takvim sayfası ve Next.js 16.4.6 güvenlik güncellemeleri.',
  rollbackSteps: [
    'Son kararlı imzalı StockMind.apk dosyasını (v1.4.1, versionCode 11) public/StockMind.apk konumuna geri yükle ve SHA-256 özetini (72677be35a633c22b6d77de19156a1f31e916e319de082c7997293772e12d39f) doğrula.',
    'src/lib/app/releaseMetadata.ts ve package.json sürüm bilgisini önceki kararlı sürüme döndür ve Cloudflare Worker dağıtımını yeniden yayınla.',
    'Not: Android üzerinde versionCode düşürülemeyeceği için etkilenen cihazda yeni düzeltme derlemesini (+1 versionCode) bir sonraki sürüm olarak yayınla.',
  ],
};

export function buildAppVersionPayload(broadcast: unknown = null) {
  return {
    success: true,
    packageId: ANDROID_RELEASE_METADATA.packageId,
    version: ANDROID_RELEASE_METADATA.version,
    versionCode: ANDROID_RELEASE_METADATA.versionCode,
    downloadUrl: ANDROID_RELEASE_METADATA.downloadUrl,
    directApkUrl: ANDROID_RELEASE_METADATA.directApkUrl,
    releaseNotes: ANDROID_RELEASE_METADATA.releaseNotes,
    previousVersion: ANDROID_RELEASE_METADATA.previousVersion,
    previousVersionCode: ANDROID_RELEASE_METADATA.previousVersionCode,
    previousSha256: ANDROID_RELEASE_METADATA.previousSha256,
    rollbackSteps: ANDROID_RELEASE_METADATA.rollbackSteps,
    publishedAt: ANDROID_RELEASE_METADATA.publishedAt,
    minAndroidVersion: ANDROID_RELEASE_METADATA.minAndroidVersion,
    broadcast,
  };
}
