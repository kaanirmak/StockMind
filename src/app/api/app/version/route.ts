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
        const sentTime = new Date(data.asset_allocation.sentAt || 0).getTime();
        // Only broadcast if sent within the last 2 hours to prevent stale alert spam
        if (Date.now() - sentTime < 2 * 60 * 60 * 1000) {
          broadcast = data.asset_allocation;
          globalThis.__stockmind_latest_broadcast = broadcast;
        } else {
          broadcast = null;
        }
      }
    } catch (_) {}
  }

  return NextResponse.json({
    success: true,
    version: '1.3.0',
    versionCode: 9,
    downloadUrl: '/api/download/apk',
    directApkUrl: '/StockMind.apk',
    releaseNotes: 'Mobil arayüz, kaydırma deneyimi, Piyasa Nabzı, Portföy ve takip listesi yenilendi. Takip listeleri artık hesapla senkronize çalışır.',
    publishedAt: '2026-10-15',
    minAndroidVersion: '7.0 (Nougat) ve üzeri',
    broadcast,
  });
}
