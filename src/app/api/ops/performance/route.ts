import { NextResponse } from 'next/server';
import { apiErrorResponse, ApiError, readJsonObject } from '@/lib/api/security';
import { requireDesktopAdmin } from '@/lib/admin/desktopGuard';
import {
  detectClientPlatform,
  getPlatformPerformanceReport,
  recordPerformanceSample,
} from '@/lib/ops/performanceMonitor';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const origin = request.headers.get('origin');
    const requestOrigin = new URL(request.url).origin;
    if (origin && origin !== requestOrigin && process.env.NODE_ENV !== 'development') {
      throw new ApiError(403, 'Bu kaynaktan performans bildirimi kabul edilmiyor.', 'FORBIDDEN_ORIGIN');
    }

    const body = await readJsonObject(request, 16 * 1024);
    const uaPlatform = detectClientPlatform({
      userAgent: request.headers.get('user-agent'),
      viewportWidth: typeof body.viewportWidth === 'number' ? body.viewportWidth : undefined,
    });

    const recorded = recordPerformanceSample({
      ...body,
      platform: body.platform === 'mobile' || body.platform === 'desktop' ? body.platform : uaPlatform,
    });

    if (!recorded) {
      throw new ApiError(400, 'Geçerli performans metriği bulunamadı.', 'INVALID_PERF_SAMPLE');
    }

    return NextResponse.json(
      {
        success: true,
        recorded: {
          platform: recorded.platform,
          route: recorded.route,
          recordedAt: recorded.recordedAt,
        },
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
        report: getPlatformPerformanceReport(),
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
