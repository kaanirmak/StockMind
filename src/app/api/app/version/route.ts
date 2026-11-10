import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import pkg from '../../../../../package.json';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  let broadcast = null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('broadcasts')
      .select('payload')
      .eq('id', 'latest')
      .maybeSingle();
    if (error) throw error;
    const age = Date.now() - Date.parse(data?.payload?.sentAt ?? '');
    if (age >= 0 && age < 2 * 60 * 60 * 1000) broadcast = data?.payload;
  } catch (error) {
    console.warn('App version broadcast lookup failed', error);
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

