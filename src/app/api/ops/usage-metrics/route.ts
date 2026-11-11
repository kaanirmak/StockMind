import { NextResponse } from 'next/server';
import { requireDesktopAdmin } from '@/lib/admin/desktopGuard';
import { apiErrorResponse, ApiError, readJsonObject } from '@/lib/api/security';
import {
  getUsageMetricsSummary,
  recordServerUsageEvent,
} from '@/lib/analytics/usageMetrics';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const origin = request.headers.get('origin');
    const requestOrigin = new URL(request.url).origin;
    if (origin && origin !== requestOrigin && process.env.NODE_ENV !== 'development') {
      throw new ApiError(403, 'Bu kaynaktan kullanım metriği kabul edilmiyor.', 'FORBIDDEN_ORIGIN');
    }

    const body = await readJsonObject(request, 4 * 1024);
    const recorded = recordServerUsageEvent(body);
    if (!recorded) {
      throw new ApiError(400, 'Geçerli bir kullanım olayı bulunamadı.', 'INVALID_USAGE_EVENT');
    }

    return NextResponse.json(
      {
        success: true,
        recorded,
      },
      { status: 202, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function GET(request: Request) {
  try {
    await requireDesktopAdmin(request);
    return NextResponse.json(
      {
        success: true,
        usageMetrics: getUsageMetricsSummary(),
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
