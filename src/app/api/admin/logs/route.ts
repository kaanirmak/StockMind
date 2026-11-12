import { NextResponse } from 'next/server';
import { requireDesktopAdmin } from '@/lib/admin/desktopGuard';
import { createAdminClient } from '@/lib/supabase/admin';
import { ApiError, apiErrorResponse } from '@/lib/api/security';
import { redactLogValue } from '@/lib/ops/applicationLogs';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    await requireDesktopAdmin(request);
    const params = new URL(request.url).searchParams;
    const level = params.get('level');
    const area = params.get('area');
    const before = params.get('before');
    if (level && !['info', 'warn', 'error'].includes(level)) throw new ApiError(400, 'Geçersiz log seviyesi.');
    if (area && !['email', 'bulletin', 'admin', 'api'].includes(area)) throw new ApiError(400, 'Geçersiz log alanı.');
    if (before && (!/^\d+$/.test(before) || before.length > 20)) throw new ApiError(400, 'Geçersiz sayfalama.');
    let query = createAdminClient().from('application_logs')
      .select('id, created_at, level, area, event, message, request_id, context')
      .order('id', { ascending: false }).limit(51);
    if (level) query = query.eq('level', level);
    if (area) query = query.eq('area', area);
    if (before) query = query.lt('id', before);
    const { data, error } = await query;
    if (error) throw new ApiError(503, 'Kalıcı uygulama logları okunamadı. Log migration’ını ve sunucu erişimini kontrol edin.', 'LOGS_UNAVAILABLE');
    const rows = Array.isArray(data) ? data : [];
    const items = rows.slice(0, 50).map(row => ({ ...row, message: redactLogValue(row.message), context: redactLogValue(row.context) }));
    return NextResponse.json({ success: true, items, next: rows.length > 50 ? String(items.at(-1)?.id) : null },
      { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiErrorResponse(error); }
}
