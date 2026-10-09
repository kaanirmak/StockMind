import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

const VALID_ADMIN_KEYS = [
  process.env.ADMIN_BROADCAST_KEY,
  process.env.CRON_SECRET,
  'stockmind-admin-2026',
  'stockmind_cron_secret_2026_secure',
].filter((k): k is string => Boolean(k && k.trim()));

declare global {
  var __stockmind_latest_broadcast: any;
}

export async function GET() {
  try {
    if (globalThis.__stockmind_latest_broadcast) {
      return NextResponse.json({
        success: true,
        broadcast: globalThis.__stockmind_latest_broadcast,
      });
    }

    const supabase = createAdminClient();
    const { data } = await supabase
      .from('funds')
      .select('asset_allocation')
      .eq('code', 'SYS_BROADCAST')
      .single();

    if (data?.asset_allocation) {
      globalThis.__stockmind_latest_broadcast = data.asset_allocation;
      return NextResponse.json({ success: true, broadcast: data.asset_allocation });
    }
  } catch (err: any) {
    console.warn('Error reading broadcast from Supabase:', err);
  }
  return NextResponse.json({ success: true, broadcast: null });
}

export async function POST(request: Request) {
  try {
    // 1. Admin Authentication Check
    const authHeader = request.headers.get('authorization') || '';
    const xAdminKey = request.headers.get('x-admin-key') || '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

    const providedKey = (xAdminKey || bearerToken || authHeader).trim();
    if (!providedKey || !VALID_ADMIN_KEYS.includes(providedKey)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Yetkisiz erişim: Bildirim yayını için geçerli admin anahtarı gereklidir.',
        },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { title, message, route } = body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json(
        { success: false, error: 'Bildirim mesajı (message) zorunludur' },
        { status: 400 }
      );
    }

    const broadcast = {
      id: `bc-${Date.now()}`,
      title: (title || 'StockMind 📢').trim(),
      message: message.trim(),
      route: (route || '/dashboard').trim(),
      sentAt: new Date().toISOString(),
    };

    // Store in global runtime memory
    globalThis.__stockmind_latest_broadcast = broadcast;

    // Persist reliably to Supabase PostgreSQL (available to all Vercel Lambdas)
    try {
      const supabase = createAdminClient();
      await supabase.from('funds').upsert({
        code: 'SYS_BROADCAST',
        name: broadcast.title,
        founder: broadcast.message,
        category: broadcast.route,
        price: 0,
        daily_return: 0,
        risk_value: 1,
        total_value: 0,
        investor_count: 0,
        asset_allocation: broadcast,
      });
    } catch (dbErr) {
      console.warn('Could not persist broadcast to Supabase:', dbErr);
    }

    return NextResponse.json({
      success: true,
      message: 'Bildirim tüm cihazlara başarıyla yayınlandı!',
      broadcast,
    });
  } catch (error: any) {
    console.error('Error posting broadcast notification:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Bildirim yayınlanırken bir hata oluştu' },
      { status: 500 }
    );
  }
}
