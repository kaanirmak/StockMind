import { NextResponse } from 'next/server';
import { requireDesktopAdmin } from '@/lib/admin/desktopGuard';
import { ApiError, apiErrorResponse, readJsonObject } from '@/lib/api/security';
import { syncTefasFundsToDatabase } from '@/lib/cron/syncTefasFunds';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    await requireDesktopAdmin(request);
    const body = await readJsonObject(request, 8 * 1024);
    const job = String(body.job || '').trim();

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://stockmind.kaanrmak7.workers.dev';
    const cronSecret = process.env.CRON_SECRET || 'stockmind_cron_secret_2026_secure';

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
        const targetEmail = body.email ? String(body.email).trim() : undefined;
        console.log(`[Admin] Triggering Daily Report cron...`);

        const response = await fetch(`${baseUrl}/api/cron/daily-report`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${cronSecret}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(targetEmail ? { email: targetEmail, force: true } : { force: true }),
        });

        const reportData = await response.json().catch(() => null);
        return NextResponse.json({
          success: response.ok,
          job: 'daily-report',
          httpStatus: response.status,
          result: reportData,
          message: response.ok
            ? 'Günlük piyasa bülteni dağıtımı tetiklendi ve başarıyla tamamlandı.'
            : `Günlük bülten servisi yanıtı: HTTP ${response.status}`,
        });
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
