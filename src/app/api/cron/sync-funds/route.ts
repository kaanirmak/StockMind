import { NextResponse } from 'next/server';
import { syncTefasFundsToDatabase } from '@/lib/cron/syncTefasFunds';

export const maxDuration = 300; // Allow 5 minutes on Vercel Pro/Enterprise or standard node

export async function GET(request: Request) {
  return handleSync(request);
}

export async function POST(request: Request) {
  return handleSync(request);
}

async function handleSync(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const authHeader = request.headers.get('authorization') || '';
    const cronSecretHeader = request.headers.get('x-cron-secret') || '';
    const secretQuery = searchParams.get('secret') || '';

    const expectedSecret = process.env.CRON_SECRET;

    // Security Check: CRON_SECRET is strictly mandatory
    const isAuthorized =
      Boolean(expectedSecret) &&
      (authHeader === `Bearer ${expectedSecret}` ||
        cronSecretHeader === expectedSecret ||
        secretQuery === expectedSecret);

    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Valid CRON_SECRET is required' },
        { status: 401 }
      );
    }

    const code = searchParams.get('code') || undefined;
    const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined;
    const includeHistory = searchParams.get('includeHistory') === 'true';

    console.log(`[Cron:sync-funds] Starting daily TEFAS sync at 18:30 (code=${code || 'all'}, limit=${limit || 'all'})...`);

    const result = await syncTefasFundsToDatabase({
      code,
      limit,
      includeHistory,
    });

    console.log(
      `[Cron:sync-funds] Completed in ${result.durationMs}ms. Success: ${result.successCount}, Errors: ${result.errorCount}`
    );

    return NextResponse.json({
      success: result.success,
      timestamp: result.timestamp,
      durationMs: result.durationMs,
      totalProcessed: result.totalProcessed,
      successCount: result.successCount,
      errorCount: result.errorCount,
      errors: result.errors.slice(0, 10), // Limit returned errors in response
      syncedCodes: result.syncedCodes.slice(0, 50),
    });
  } catch (error: any) {
    console.error('[Cron:sync-funds] Fatal Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'TEFAS fon senkronizasyonu başarısız oldu.' },
      { status: 500 }
    );
  }
}
