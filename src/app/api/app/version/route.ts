import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';

declare global {
  var __stockmind_latest_broadcast: any;
}

const TMP_BROADCAST_FILE = path.join(os.tmpdir(), 'stockmind_latest_broadcast.json');

export async function GET() {
  let broadcast = globalThis.__stockmind_latest_broadcast || null;

  if (!broadcast) {
    try {
      if (fs.existsSync(TMP_BROADCAST_FILE)) {
        broadcast = JSON.parse(fs.readFileSync(TMP_BROADCAST_FILE, 'utf-8'));
        globalThis.__stockmind_latest_broadcast = broadcast;
      } else {
        const fallbackPublic = path.join(process.cwd(), 'public', 'latest_broadcast.json');
        if (fs.existsSync(fallbackPublic)) {
          broadcast = JSON.parse(fs.readFileSync(fallbackPublic, 'utf-8'));
        }
      }
    } catch (_) {}
  }

  return NextResponse.json({
    success: true,
    version: '1.0.2',
    versionCode: 3,
    downloadUrl: '/api/download/apk',
    directApkUrl: '/StockMind.apk',
    releaseNotes: 'Uygulama kapalıyken arka plan hedef fiyat alarmları, BIST seans kapanış bildirimi, portföy widget ve tam ekran UI iyileştirmeleri.',
    publishedAt: '2026-10-10',
    minAndroidVersion: '7.0 (Nougat) ve üzeri',
    broadcast,
  });
}
