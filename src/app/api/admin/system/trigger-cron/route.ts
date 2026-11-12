import { NextResponse } from 'next/server';
import { recordApplicationLog } from '@/lib/ops/applicationLogs';
import { requireDesktopAdmin } from '@/lib/admin/desktopGuard';
import { ApiError, apiErrorResponse, readJsonObject } from '@/lib/api/security';
import { syncTefasFundsToDatabase } from '@/lib/cron/syncTefasFunds';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    await requireDesktopAdmin(request);
    const body = await readJsonObject(request, 8 * 1024);
    const job = String(body.job || '').trim();
    await recordApplicationLog({ level: 'info', area: 'admin', event: 'job_requested', message: 'Yönetici arka plan görevi istedi.', context: { job } });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://stockmind.kaanrmak7.workers.dev';
    const cronSecret = process.env.CRON_SECRET?.trim();
    if (!cronSecret) {
      throw new ApiError(500, 'CRON_SECRET sunucu ortamında yapılandırılmamış.');
    }

    switch (job) {
      case 'sync-funds': {
        const limit = body.limit ? Number(body.limit) : 25;
        const code = body.code ? String(body.code).toUpperCase() : undefined;
        console.log(`[Admin] Triggering TEFAS sync (code=${code || 'top'}, limit=${limit})...`);

        const result = await syncTefasFundsToDatabase({ code, limit });
        return NextResponse.json({
          success: true,
          job: 'sync-funds',
          result,
          message: `TEFAS fon senkronizasyonu tamamlandı. (${result.successCount} başarılı, ${result.errorCount} hata, süre: ${result.durationMs}ms)`,
        });
      }

      case 'daily-report': {
        const { runDailyBulletin } = await import('@/lib/email/runDailyBulletin');
        const targetEmail = body.email ? String(body.email).trim() : undefined;
        const allowForce = body.force === true;
        console.log(`[Admin] Triggering Daily Report cron...`);

        const response = await runDailyBulletin(new Request(`${baseUrl}/api/cron/daily-report`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${cronSecret}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(
            targetEmail
              ? { email: targetEmail, force: allowForce }
              : { force: allowForce }
          ),
        }));

        const reportData = await response.json().catch(() => null);
        const complete = response.ok && reportData?.success === true;
        const reason = reportData?.error || reportData?.message ||
          (reportData?.results?.find((r: { success?: boolean; message?: string }) => !r.success)?.message) ||
          `Bülten servisi HTTP ${response.status} yanıtı verdi.`;
        await recordApplicationLog({ level: complete ? 'info' : 'error', area: 'admin', event: 'job_finished',
          message: complete ? 'Bülten görevi tamamlandı.' : reason, context: { job, httpStatus: response.status } });
        return NextResponse.json({
          success: complete,
          ...(complete ? {} : { error: reason }),
          job: 'daily-report',
          httpStatus: response.status,
          result: reportData,
          message: complete
            ? (reportData?.message || `${reportData?.newlySentCount ?? 0} yeni gönderim; ${reportData?.skippedDuplicatesCount ?? 0} önceki gönderim atlandı.`)
            : `Günlük bülten servisi yanıtı: HTTP ${response.status}`,
        }, { status: complete ? 200 : response.status >= 400 ? response.status : 502 });
      }

      case 'purge-sessions': {
        console.log(`[Admin] Triggering session purge cron...`);
        const response = await fetch(`${baseUrl}/api/cron/purge-bloated-sessions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${cronSecret}`,
            'Content-Type': 'application/json',
          },
        });

        const purgeData = await response.json().catch(() => null);
        return NextResponse.json({
          success: response.ok,
          job: 'purge-sessions',
          httpStatus: response.status,
          result: purgeData,
          message: purgeData?.message || 'Şişkin oturum ve metadata temizliği tamamlandı.',
        });
      }

      default:
        throw new ApiError(400, `Bilinmeyen cron görevi: ${job}`);
    }
  } catch (error) {
    return apiErrorResponse(error);
  }
}
