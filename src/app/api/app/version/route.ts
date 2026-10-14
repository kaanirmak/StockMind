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
    version: '1.1.0',
    versionCode: 6,
    downloadUrl: '/api/download/apk',
    directApkUrl: '/StockMind.apk',
    releaseNotes: 'OLED Pitch Black (#000000) teması, TradingView Lightweight Çizgi/Mum grafikleri, iOS Safari PWA kurulum rehberi, Windows 11 & Mac widget entegrasyonu, AI Asistan sohbet geçmişi (Chat History) ve 8 saniyelik canlı parıltılı (flash) veri akışı.',
    publishedAt: '2026-10-14',
    minAndroidVersion: '7.0 (Nougat) ve üzeri',
    broadcast,
  });
}
