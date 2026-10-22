import { NextResponse } from 'next/server';
import { sendTestEmail } from '@/lib/email/service';
import { fetchSpecificSymbolLive } from '@/lib/data/stocks';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return handleDailyReport(request);
}

export async function POST(request: Request) {
  return handleDailyReport(request);
}

const sentReportsCache = new Set<string>();

interface ReportRecipient {
  email: string;
  name?: string;
}

async function loadConfirmedUsers(): Promise<ReportRecipient[]> {
  const admin = createAdminClient();
  const recipients: ReportRecipient[] = [];
  const perPage = 1000;

  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    for (const user of data.users) {
      if (!user.email || !user.email_confirmed_at || user.banned_until) continue;
      // StockMind AI Bülteni is exclusively delivered to Pro accounts
      const isPro = Boolean(
        user.app_metadata?.plan === 'pro' ||
        user.app_metadata?.is_pro === true
      );
      if (!isPro) continue;

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

    const expectedSecret = process.env.CRON_SECRET;

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

    // Scheduled runs target every confirmed, active account. Manual calls may
    // still provide an explicit recipient list for testing or recovery.
    if (recipients.length === 0) recipients = await loadConfirmedUsers();

    if (recipients.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Bülten gönderilecek aktif Pro abone bulunmuyor.',
        recipientsCount: 0,
        successfulCount: 0,
        results: [],
        timestamp: new Date().toISOString(),
      }, { status: 200 });
    }

    const todayStr = new Date().toISOString().split('T')[0];

    // Check overall batch idempotency key if supplied
    if (customIdempotencyKey && sentReportsCache.has(customIdempotencyKey) && !force) {
      return NextResponse.json({
        success: true,
        idempotent: true,
        message: 'Bu rapor toplu anahtarı için bülten zaten işlendi.',
        idempotencyKey: customIdempotencyKey,
      });
    }

    // Fetch live market closing prices for the report once for all recipients
    const [gold, usdtry, btc, thyao, xu100] = await Promise.all([
      fetchSpecificSymbolLive('XAUUSD').catch(() => null),
      fetchSpecificSymbolLive('USDTRY').catch(() => null),
      fetchSpecificSymbolLive('BTCUSD').catch(() => null),
      fetchSpecificSymbolLive('THYAO').catch(() => null),
      fetchSpecificSymbolLive('XU100').catch(() => null),
    ]);

    const results: Array<{ email: string; success: boolean; skipped?: boolean; message?: string }> = [];

    for (const recipient of recipients.slice(0, 50)) {
      const perUserKey = `${todayStr}:${recipient.email.toLowerCase()}`;
      if (sentReportsCache.has(perUserKey) && !force) {
        results.push({ email: recipient.email, success: true, skipped: true, message: 'Bugün için zaten iletildi' });
        continue;
      }

      const sendResult = await sendTestEmail({
        to: recipient.email,
        userName: recipient.name || 'Değerli Yatırımcı',
        subject: `StockMind Günlük Piyasa Kapanış Bülteni (18:30) • ${new Date().toLocaleDateString('tr-TR')}`,
        isDailyReport: true,
        marketData: {
          gold: gold?.price,
          usdtry: usdtry?.price,
          btc: btc?.price,
          thyao: thyao?.price,
          bist100: xu100?.price,
        },
        portfolioSummary: undefined,
      });

      if (sendResult.success) {
        sentReportsCache.add(perUserKey);
      }
      results.push({ email: recipient.email, success: sendResult.success, message: sendResult.message });
    }

    if (customIdempotencyKey) {
      sentReportsCache.add(customIdempotencyKey);
    }

    const successfulCount = results.filter((r) => r.success).length;

    const hasSuccessfulOrSkipped = results.some((r) => r.success || r.skipped);

    return NextResponse.json({
      success: hasSuccessfulOrSkipped,
      timestamp: new Date().toISOString(),
      recipientsCount: recipients.length,
      successfulCount,
      results,
      marketSummary: {
        gold: gold?.price,
        usdtry: usdtry?.price,
        btc: btc?.price,
        thyao: thyao?.price,
        bist100: xu100?.price,
      },
    }, { status: 200 });
  } catch (error: any) {
    console.error('Daily Report Cron Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Günlük bülten gönderilemedi.' },
      { status: 500 }
    );
  }
}
