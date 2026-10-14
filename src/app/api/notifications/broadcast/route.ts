import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { ApiError, apiErrorResponse, optionalText, readJsonObject } from '@/lib/api/security';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from('broadcasts').select('payload').eq('id', 'latest').maybeSingle();
    if (error) throw error;
    return NextResponse.json({ success: true, broadcast: data?.payload ?? null }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const expected = process.env.ADMIN_BROADCAST_KEY?.trim();
    if (!expected) throw new ApiError(503, 'Bildirim yayını yapılandırılmamış.');
    const authHeader = request.headers.get('authorization') || '';
    const supplied = (request.headers.get('x-admin-key') || (authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '')).trim();
    const left = Buffer.from(supplied);
    const right = Buffer.from(expected);
    if (!left.length || left.length !== right.length || !timingSafeEqual(left, right)) throw new ApiError(401, 'Yetkisiz erişim.');
    const body = await readJsonObject(request, 8 * 1024);
    const title = optionalText(body.title, 120) || 'StockMind';
    const message = optionalText(body.message, 2000);
    const route = optionalText(body.route, 200) || '/dashboard';
    if (!message) throw new ApiError(400, 'Bildirim mesajı zorunludur.');
    if (!/^\/(?:dashboard|portfolio|stocks|funds|watchlist|reports|ai-assistant|news|settings|quant-lab|piyasalar|widgets)(?:\/[A-Za-z0-9_.:-]+)*$/.test(route)) {
      throw new ApiError(400, 'Bildirim hedefi geçerli bir uygulama yolu olmalıdır.');
    }
    const broadcast = { id: crypto.randomUUID(), title, message, route, sentAt: new Date().toISOString() };
    const supabase = createAdminClient();
    const { error } = await supabase.from('broadcasts').upsert({ id: 'latest', payload: broadcast });
    if (error) throw error;
    return NextResponse.json({ success: true, message: 'Bildirim kaydedildi; cihazlar sonraki kontrolde alabilir.', broadcast });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
