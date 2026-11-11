import { NextResponse } from 'next/server';
import { sendTestEmail } from '@/lib/email/service';
import { getBulletinMarketData } from '@/lib/email/marketData';
import {
  enqueueBulletinRecipients,
  hasAcceptedDeliveryForDay,
  recordDeliveryOutcome,
  shouldSkipDuplicateDelivery,
  summarizeDeliveryQueue,
} from '@/lib/email/deliveryQueue';
import { createAdminClient } from '@/lib/supabase/admin';
import { isUserEligibleForScheduledBulletin } from '@/lib/email/subscriptionStatus';

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
  email: string;
  name?: string;
}

function deduplicateRecipients(recipients: ReportRecipient[]): ReportRecipient[] {
  const seen = new Set<string>();
  const unique: ReportRecipient[] = [];
  for (const r of recipients) {
    const email = r.email.trim();
    const key = email.toLowerCase();
    if (!email || !email.includes('@') || seen.has(key)) continue;
    seen.add(key);
    unique.push({ email, name: r.name });
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
        email: user.email!.trim(),
        name: user.user_metadata?.full_name || user.user_metadata?.name || undefined,
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

    let recipients: ReportRecipient[] = [];
    let customIdempotencyKey = idempotencyHeader;
    let force = false;

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
      } catch (_) {}
    }

    // Scheduled runs target confirmed Pro accounts with the bulletin enabled. Manual calls may
    // still provide an explicit recipient list for testing or recovery.
    if (recipients.length === 0) recipients = await loadConfirmedUsers();
    recipients = deduplicateRecipients(recipients);

    if (recipients.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Bülten gönderilecek aktif Pro abone bulunmuyor.',
        recipientsCount: 0,
        successfulCount: 0,
        batchesProcessed: 0,
        batchSize: BULLETIN_BATCH_SIZE,
        results: [],
        timestamp: new Date().toISOString(),
      }, { status: 200 });
    }

    const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' });

    // Check overall batch idempotency key if supplied
    if (customIdempotencyKey && sentReportsCache.has(customIdempotencyKey) && !force) {
      return NextResponse.json({
        success: true,
        idempotent: true,
        message: 'Bu rapor toplu anahtarı için bülten zaten işlendi.',
        idempotencyKey: customIdempotencyKey,
      });
    }

    const admin = createAdminClient();
    const marketData = await getBulletinMarketData();
    const subjectDate = new Date().toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' });
    const subject = `StockMind Günlük Piyasa Kapanış Bülteni (18:30) • ${subjectDate}`;

    const enqueueState = await enqueueBulletinRecipients(admin, todayStr, recipients, {
      jobType: 'daily_bulletin',
    });

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
        const alreadyAcceptedInDb =
          !force &&
          (existingQueueRow?.status === 'accepted' ||
            (await hasAcceptedDeliveryForDay(admin, todayStr, normalizedEmail, 'daily_bulletin')));

        if (shouldSkipDuplicateDelivery(alreadyAcceptedInDb ? { status: 'accepted' } : existingQueueRow, sentReportsCache.has(perUserKey), force)) {
          sentReportsCache.add(perUserKey);
          results.push({
            email: recipient.email,
            success: true,
            skipped: true,
            duplicatePrevented: true,
            status: 'accepted',
            message: 'Bugün için zaten iletildi (çift gönderim engellendi)',
            batchIndex,
          });
          continue;
        }

        const sendResult = await sendTestEmail({
          to: recipient.email,
          userName: recipient.name || 'Değerli Yatırımcı',
          subject,
          isDailyReport: true,
          marketData,
        });

        const updatedRecord = await recordDeliveryOutcome(admin, {
          bulletinDate: todayStr,
          recipientEmail: recipient.email,
          recipientName: recipient.name,
          jobType: 'daily_bulletin',
          previousAttemptCount: existingQueueRow?.attempt_count ?? 0,
          maxAttempts: existingQueueRow?.max_attempts,
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

    return NextResponse.json({
      success: complete,
      timestamp: new Date().toISOString(),
      recipientsCount: recipients.length,
      successfulCount,
      newlySentCount,
      skippedDuplicatesCount,
      batchesProcessed: batches.length,
      batchSize: BULLETIN_BATCH_SIZE,
      queueSummary,
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
