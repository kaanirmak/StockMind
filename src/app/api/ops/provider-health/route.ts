import { NextResponse } from 'next/server';
import { requireDesktopAdmin } from '@/lib/admin/desktopGuard';
import { apiErrorResponse, ApiError, readJsonObject } from '@/lib/api/security';
import { createAdminClient } from '@/lib/supabase/admin';
import { summarizeBulletinScheduleTelemetry } from '@/lib/email/scheduleMonitor';
import {
  buildOperationalHealthSummary,
  recordProviderFailure,
  recordProviderSuccess,
} from '@/lib/ops/providerHealth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    await requireDesktopAdmin(request);
    const admin = createAdminClient();
    const bulletinScheduleSummary = await summarizeBulletinScheduleTelemetry(admin).catch(() => null);
    const health = buildOperationalHealthSummary({ bulletinScheduleSummary });
    return NextResponse.json(
      { success: true, health },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const origin = request.headers.get('origin');
    const requestOrigin = new URL(request.url).origin;
    if (origin && origin !== requestOrigin && process.env.NODE_ENV !== 'development') {
      throw new ApiError(403, 'Bu kaynaktan durum bildirimi kabul edilmiyor.', 'FORBIDDEN_ORIGIN');
    }

    const body = await readJsonObject(request, 8 * 1024);
    const channel = body.channel === 'alerts' ? 'alerts' : null;
    if (!channel) {
      throw new ApiError(400, 'Yalnızca alarm durumu bildirimi desteklenir.', 'INVALID_HEALTH_CHANNEL');
    }

    if (body.ok === true) {
      recordProviderSuccess('alerts', 'client-alert-watcher');
    } else {
      recordProviderFailure(
        'alerts',
        typeof body.summary === 'string' ? body.summary : 'Alarm kontrol hatası',
        typeof body.code === 'string' ? body.code : 'ALERT_EVAL_ERROR'
      );
    }

    return NextResponse.json({ success: true }, { status: 202, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
