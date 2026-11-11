import { NextResponse } from 'next/server';
import { sendTestEmail } from '@/lib/email/service';
import { getBulletinMarketData } from '@/lib/email/marketData';
import { hasProAccess } from '@/lib/ai/modelCatalog';
import { createAdminClient } from '@/lib/supabase/admin';

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
      if (!user.email || !user.email_confirmed_at ||
          (user.banned_until && Date.parse(user.banned_until) > Date.now()) ||
          !hasProAccess(user.app_metadata) || user.user_metadata?.daily_report_enabled === false) continue;

      recipients.push({
        email: user.email.trim(),
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

    const marketData = await getBulletinMarketData();
    const subjectDate = new Date().toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' });
    const subject = `StockMind Günlük Piyasa Kapanış Bülteni (18:30) • ${subjectDate}`;

    const results: Array<{ email: string; success: boolean; skipped?: boolean; message?: string; batchIndex?: number }> = [];
    const batches = chunkRecipients(recipients, BULLETIN_BATCH_SIZE);

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
      const batch = batches[batchIndex];
      for (const recipient of batch) {
        const perUserKey = `${todayStr}:${recipient.email.toLowerCase()}`;
        if (sentReportsCache.has(perUserKey) && !force) {
          results.push({ email: recipient.email, success: true, skipped: true, message: 'Bugün için zaten iletildi', batchIndex });
          continue;
        }

        const sendResult = await sendTestEmail({
          to: recipient.email,
          userName: recipient.name || 'Değerli Yatırımcı',
          subject,
          isDailyReport: true,
          marketData,
        });

        if (sendResult.success) {
          sentReportsCache.add(perUserKey);
        }
        results.push({ email: recipient.email, success: sendResult.success, message: sendResult.message, batchIndex });
      }
    }

    const successfulCount = results.filter((r) => r.success).length;
    const complete = successfulCount === recipients.length;
    if (customIdempotencyKey && complete) sentReportsCache.add(customIdempotencyKey);

    return NextResponse.json({
      success: complete,
      timestamp: new Date().toISOString(),
      recipientsCount: recipients.length,
      successfulCount,
      batchesProcessed: batches.length,
      batchSize: BULLETIN_BATCH_SIZE,
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
