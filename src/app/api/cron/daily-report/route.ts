import { NextResponse } from 'next/server';
import { sendTestEmail } from '@/lib/email/service';
import { getBulletinMarketData } from '@/lib/email/marketData';
import {
  enqueueBulletinRecipients,
  claimBulletinDelivery,
  recordDeliveryOutcome,
  shouldSkipDuplicateDelivery,
  summarizeDeliveryQueue,
} from '@/lib/email/deliveryQueue';
import { createAdminClient } from '@/lib/supabase/admin';
import { isUserEligibleForScheduledBulletin } from '@/lib/email/subscriptionStatus';
import {
  buildPersonalizedBulletinSection,
  resolvePersonalizedBulletinPrefs,
  type PersonalizedBulletinPrefs,
} from '@/lib/email/personalizedBulletin';
import { fetchNewsSnapshot } from '@/lib/news/snapshot';
import {
  computeScheduledBulletinTime,
  recordBulletinRunFinish,
  recordBulletinRunStart,
} from '@/lib/email/scheduleMonitor';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return handleDailyReport(request);
}

export async function POST(request: Request) {
  return handleDailyReport(request);
}

const BULLETIN_BATCH_SIZE = 25;

const sentReportsCache = new Set<string>();

interface ReportRecipient {
  id?: string;
  email: string;
  name?: string;
  personalizedPrefs?: PersonalizedBulletinPrefs;
}

function deduplicateRecipients(recipients: ReportRecipient[]): ReportRecipient[] {
  const seen = new Set<string>();
  const unique: ReportRecipient[] = [];
  for (const r of recipients) {
    const email = r.email.trim();
    const key = email.toLowerCase();
    if (!email || !email.includes('@') || seen.has(key)) continue;
    seen.add(key);
    unique.push({ ...r, email });
  }
  return unique;
}

function chunkRecipients<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function loadConfirmedUsers(): Promise<ReportRecipient[]> {
  const admin = createAdminClient();
  const recipients: ReportRecipient[] = [];
  const perPage = 1000;

  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    for (const user of data.users) {
      if (!isUserEligibleForScheduledBulletin(user)) continue;

      recipients.push({
        id: user.id,
        email: user.email!.trim(),
        name: user.user_metadata?.full_name || user.user_metadata?.name || undefined,
        personalizedPrefs: resolvePersonalizedBulletinPrefs(
          (user.user_metadata ?? {}) as Record<string, unknown>,
        ),
      });
    }

    if (data.users.length < perPage) break;
  }

  return recipients;
}

async function handleDailyReport(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') || '';
    const cronSecretHeader = request.headers.get('x-cron-secret') || '';
    const idempotencyHeader = request.headers.get('x-idempotency-key') || '';

    const expectedSecret = process.env.CRON_SECRET?.trim();

    // Security Check: CRON_SECRET is strictly mandatory via headers only (never via URL query)
    const isAuthorized =
      Boolean(expectedSecret) &&
      (authHeader === `Bearer ${expectedSecret}` ||
        cronSecretHeader === expectedSecret);

    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Valid CRON_SECRET header is required' },
        { status: 401 }
      );
    }

    const startedAt = new Date();
    const todayStr = startedAt.toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' });
    let scheduledFor = computeScheduledBulletinTime(todayStr);

    let recipients: ReportRecipient[] = [];
    let customIdempotencyKey = idempotencyHeader;
    let force = false;
    let triggerSource = 'cron';

    if (request.method === 'POST') {
      try {
        const body = await request.json();
        if (Array.isArray(body.recipients)) {
          recipients = body.recipients
            .filter((r: unknown) => r && typeof (r as any).email === 'string')
            .map((r: any) => ({ email: r.email.trim(), name: typeof r.name === 'string' ? r.name.trim() : undefined }));
        } else if (typeof body.email === 'string') {
          recipients = [{ email: body.email.trim(), name: typeof body.name === 'string' ? body.name.trim() : undefined }];
        }
        if (typeof body.idempotencyKey === 'string') customIdempotencyKey = body.idempotencyKey.trim();
        if (Boolean(body.force)) force = true;
        if (typeof body.scheduledFor === 'string') {
          const parsedSched = new Date(body.scheduledFor);
          if (Number.isFinite(parsedSched.getTime())) scheduledFor = parsedSched;
        }
        if (typeof body.triggerSource === 'string' && body.triggerSource.trim()) {
          triggerSource = body.triggerSource.trim();
        }
      } catch (_) {}
    }

    const admin = createAdminClient();

    // Scheduled runs target confirmed Pro accounts with the bulletin enabled. Manual calls may
    // still provide an explicit recipient list for testing or recovery.
    if (recipients.length === 0) recipients = await loadConfirmedUsers();
    recipients = deduplicateRecipients(recipients);

    if (recipients.length === 0) {
      const telemetry = await recordBulletinRunFinish(admin, {
        runId: null,
        bulletinDate: todayStr,
        scheduledFor,
        startedAt,
        finishedAt: new Date(),
        status: 'no_recipients',
        recipientsCount: 0,
        successfulCount: 0,
        triggerSource,
      });
      return NextResponse.json({
        success: true,
        message: 'Bülten gönderilecek aktif Pro abone bulunmuyor.',
        recipientsCount: 0,
        successfulCount: 0,
        batchesProcessed: 0,
        batchSize: BULLETIN_BATCH_SIZE,
        results: [],
        telemetry,
        timestamp: new Date().toISOString(),
      }, { status: 200 });
    }

    // Check overall batch idempotency key if supplied
    if (customIdempotencyKey && sentReportsCache.has(customIdempotencyKey) && !force) {
      return NextResponse.json({
        success: true,
        idempotent: true,
        message: 'Bu rapor toplu anahtarı için bülten zaten işlendi.',
        idempotencyKey: customIdempotencyKey,
      });
    }

    const runId = await recordBulletinRunStart(admin, {
      bulletinDate: todayStr,
      scheduledFor,
      startedAt,
      triggerSource,
      recipientsCount: recipients.length,
    });
    const marketData = await getBulletinMarketData();
    const hasPersonalizedSubscribers = recipients.some((r) => r.personalizedPrefs?.enabled);
    const sharedNewsEvents = hasPersonalizedSubscribers
      ? await fetchNewsSnapshot().catch(() => [])
      : [];
    const subjectDate = new Date().toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' });
    const subject = `StockMind Günlük Piyasa Kapanış Bülteni (18:30) • ${subjectDate}`;

    const enqueueState = await enqueueBulletinRecipients(admin, todayStr, recipients, {
      jobType: 'daily_bulletin',
    });

    if (!enqueueState.persisted) {
      return NextResponse.json({ success: false, error: 'Kalıcı bülten kuyruğu kullanılamıyor; gönderim başlatılmadı.' }, { status: 503 });
    }

    const results: Array<{
      email: string;
      success: boolean;
      skipped?: boolean;
      duplicatePrevented?: boolean;
      status?: string;
      message?: string;
      batchIndex?: number;
    }> = [];
    const batches = chunkRecipients(recipients, BULLETIN_BATCH_SIZE);

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
      const batch = batches[batchIndex];
      for (const recipient of batch) {
        const normalizedEmail = recipient.email.toLowerCase();
        const perUserKey = `${todayStr}:${normalizedEmail}`;
        const existingQueueRow = enqueueState.existingByEmail.get(normalizedEmail);
        if (shouldSkipDuplicateDelivery(existingQueueRow, sentReportsCache.has(perUserKey), force)) {
          results.push({ email: recipient.email, success: true, skipped: true, duplicatePrevented: true, status: 'accepted', batchIndex });
          continue;
        }
        const claimToken = crypto.randomUUID();
        const claimed = await claimBulletinDelivery(admin, todayStr, normalizedEmail, claimToken, force);
        if (!claimed) {
          // An in-flight or delayed delivery is not a completed delivery.
          results.push({ email: recipient.email, success: false, skipped: true, status: 'pending', message: 'Başka bir çalışan işliyor veya yeniden deneme zamanı bekleniyor.', batchIndex });
          continue;
        }

        let personalizedPortfolio = null;
        if (recipient.personalizedPrefs?.enabled && recipient.id) {
          try {
            const { data: txRows } = await admin
              .from('transactions')
              .select('symbol, asset_type')
              .eq('user_id', recipient.id);
            const symbolSet = new Set<string>();
            if (Array.isArray(txRows)) {
              for (const row of txRows) {
                if (typeof row?.symbol === 'string' && row.symbol.trim()) {
                  symbolSet.add(row.symbol.trim().toUpperCase());
                }
              }
            }
            const userAssets = Array.from(symbolSet).map((symbol) => ({ symbol }));
            personalizedPortfolio = buildPersonalizedBulletinSection({
              prefs: recipient.personalizedPrefs,
              assets: userAssets,
              events: sharedNewsEvents.map((art) => ({
                title: art.title,
                summary: art.summary,
                source: art.source,
                publishedAt: art.publishedAt,
              })),
            });
          } catch {
            personalizedPortfolio = null;
          }
        }

        const sendResult = await sendTestEmail({
          to: recipient.email,
          userName: recipient.name || 'Değerli Yatırımcı',
          subject,
          isDailyReport: true,
          marketData,
          personalizedPortfolio,
        });

        const updatedRecord = await recordDeliveryOutcome(admin, {
          bulletinDate: todayStr,
          recipientEmail: recipient.email,
          recipientName: recipient.name,
          jobType: 'daily_bulletin',
          previousAttemptCount: claimed.attempt_count,
          claimToken,
          maxAttempts: claimed.max_attempts,
          success: sendResult.success,
          senderAddress: sendResult.senderAddress,
          method: sendResult.method,
          messageId: sendResult.messageId,
          errorMessage: sendResult.message,
        });

        if (sendResult.success) {
          sentReportsCache.add(perUserKey);
        }
        results.push({
          email: recipient.email,
          success: sendResult.success,
          status: updatedRecord?.status || (sendResult.success ? 'accepted' : 'retry_scheduled'),
          message: sendResult.message,
          batchIndex,
        });
      }
    }

    const successfulCount = results.filter((r) => r.success).length;
    const skippedDuplicatesCount = results.filter((r) => r.duplicatePrevented).length;
    const newlySentCount = results.filter((r) => r.success && !r.skipped).length;
    const complete = successfulCount === recipients.length;
    if (customIdempotencyKey && complete) sentReportsCache.add(customIdempotencyKey);

    const queueSummary = await summarizeDeliveryQueue(admin, todayStr);
    const finishedAt = new Date();
    const runStatus = complete ? 'completed' : successfulCount > 0 ? 'partial' : 'failed';
    const telemetry = await recordBulletinRunFinish(admin, {
      runId,
      bulletinDate: todayStr,
      scheduledFor,
      startedAt,
      finishedAt,
      status: runStatus,
      recipientsCount: recipients.length,
      successfulCount,
      triggerSource,
    });

    return NextResponse.json({
      success: complete,
      timestamp: finishedAt.toISOString(),
      recipientsCount: recipients.length,
      successfulCount,
      newlySentCount,
      skippedDuplicatesCount,
      batchesProcessed: batches.length,
      batchSize: BULLETIN_BATCH_SIZE,
      queueSummary,
      telemetry,
      results,
      marketSummary: marketData,
    }, { status: complete ? 200 : successfulCount > 0 ? 207 : 503 });
  } catch (error: any) {
    console.error('Daily Report Cron Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Günlük bülten gönderilemedi.' },
      { status: 500 }
    );
  }
}
