export interface AndroidReleaseMetadata {
  packageId: string;
  version: string;
  versionCode: number;
  apkFilename: string;
  downloadUrl: string;
  directApkUrl: string;
  previousVersion: string;
  previousVersionCode: number;
  publishedAt: string;
  minAndroidVersion: string;
  releaseNotes: string;
}

export const ANDROID_RELEASE_METADATA: AndroidReleaseMetadata = {
  packageId: 'com.kaanirmak.stockmind',
  version: '1.5.1',
  versionCode: 12,
  apkFilename: 'StockMind.apk',
  downloadUrl: '/api/download/apk',
  directApkUrl: '/StockMind.apk',
  previousVersion: '1.4.1',
  previousVersionCode: 11,
  publishedAt: '2026-11-11',
  minAndroidVersion: '7.0 (Nougat) ve üzeri',
  releaseNotes:
    'Kapalı Android arka plan hisse ve TEFAS fon alarmları doğrudan varlık detay ekranına bağlandı, bildirim izni/kanal teslimat teşhisi ayrıldı ve sürüm 12 (v1.5.1) hazırlandı.',
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
    publishedAt: ANDROID_RELEASE_METADATA.publishedAt,
    minAndroidVersion: ANDROID_RELEASE_METADATA.minAndroidVersion,
    broadcast,
  };
}
