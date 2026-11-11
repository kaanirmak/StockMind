import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildAppVersionPayload } from '@/lib/app/releaseMetadata';

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
    buildAppVersionPayload(broadcast),
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    }
  );
}

