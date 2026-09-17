import { NextResponse } from 'next/server';
import { sendTestEmail } from '@/lib/email/service';
import { fetchSpecificSymbolLive } from '@/lib/data/stocks';

export async function GET(request: Request) {
  return handleDailyReport(request);
}

export async function POST(request: Request) {
  return handleDailyReport(request);
}

async function handleDailyReport(request: Request) {
  try {
    let targetEmail = '';
    let targetName = '';
    let customSmtp: any = undefined;

    if (request.method === 'POST') {
      try {
        const body = await request.json();
        targetEmail = body.email;
        targetName = body.name;
        customSmtp = body.customSmtp;
      } catch (_) {}
    }

    if (!targetEmail) {
      const { searchParams } = new URL(request.url);
      targetEmail = searchParams.get('email') || process.env.SMTP_USER || 'support@stockmind.app';
      targetName = searchParams.get('name') || 'Kaan Irmak';
    }

    // Fetch live market closing prices for the report
    const [gold, usdtry, btc, thyao, xu100] = await Promise.all([
      fetchSpecificSymbolLive('XAUUSD').catch(() => null),
      fetchSpecificSymbolLive('USDTRY').catch(() => null),
      fetchSpecificSymbolLive('BTCUSD').catch(() => null),
      fetchSpecificSymbolLive('THYAO').catch(() => null),
      fetchSpecificSymbolLive('XU100').catch(() => null),
    ]);

    const result = await sendTestEmail({
      to: targetEmail,
      userName: targetName,
      subject: `StockMind Günlük Piyasa Kapanış Bülteni (18:30) • ${new Date().toLocaleDateString('tr-TR')}`,
      isDailyReport: true,
      marketData: {
        gold: gold?.price,
        usdtry: usdtry?.price,
        btc: btc?.price,
        thyao: thyao?.price,
        bist100: xu100?.price,
      },
      portfolioSummary: {
        totalValue: 184500,
        totalPnL: 8420,
        totalPnLPercent: 4.78,
      },
      customSmtp,
    });

    return NextResponse.json({
      success: result.success,
      timestamp: new Date().toISOString(),
      recipient: targetEmail,
      marketSummary: {
        gold: gold?.price,
        usdtry: usdtry?.price,
        btc: btc?.price,
        thyao: thyao?.price,
      },
      emailResult: result,
      error: !result.success ? result.message : undefined,
    }, { status: result.success ? 200 : 400 });
  } catch (error: any) {
    console.error('Daily Report Cron Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Günlük bülten gönderilemedi.' },
      { status: 500 }
    );
  }
}
