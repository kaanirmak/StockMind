import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import pkg from '../../../../../package.json';

declare global {
  var __stockmind_latest_broadcast: any;
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

  return NextResponse.json(
    {
      success: true,
      version: pkg.version,
      versionCode: 11,
      downloadUrl: '/api/download/apk',
      directApkUrl: '/StockMind.apk',
      releaseNotes: 'CI/CD düzeltmeleri: Supabase GitHub entegrasyonu ve Cloudflare deploy akışı iyileştirildi.',
      publishedAt: '2026-10-15',
      minAndroidVersion: '7.0 (Nougat) ve üzeri',
      broadcast,
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    }
  );
}

