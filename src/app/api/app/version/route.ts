import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    success: true,
    version: '1.0.2',
    versionCode: 3,
    downloadUrl: '/api/download/apk',
    directApkUrl: '/StockMind.apk',
    releaseNotes: 'Uygulama kapalıyken arka plan hedef fiyat alarmları, BIST seans kapanış bildirimi, portföy widget ve tam ekran UI iyileştirmeleri.',
    publishedAt: '2026-10-10',
    minAndroidVersion: '7.0 (Nougat) ve üzeri',
  });
}
