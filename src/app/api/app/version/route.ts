import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

declare global {
  var __stockmind_latest_broadcast: any;
}

export async function GET() {
  let broadcast = globalThis.__stockmind_latest_broadcast || null;

  if (!broadcast) {
    try {
      const supabase = createAdminClient();
      const { data } = await supabase
        .from('funds')
        .select('asset_allocation')
        .eq('code', 'SYS_BROADCAST')
        .single();

      if (data?.asset_allocation) {
        broadcast = data.asset_allocation;
        globalThis.__stockmind_latest_broadcast = broadcast;
      }
    } catch (_) {}
  }

  return NextResponse.json({
    success: true,
    version: '1.0.4',
    versionCode: 5,
    downloadUrl: '/api/download/apk',
    directApkUrl: '/StockMind.apk',
    releaseNotes: 'Arka plan pil optimizasyonu muafiyeti, kapalıyken kesintisiz fiyat alarmı ve telefon yeniden başlatma (BootReceiver) desteği.',
    publishedAt: '2026-10-10',
    minAndroidVersion: '7.0 (Nougat) ve üzeri',
    broadcast,
  });
}
