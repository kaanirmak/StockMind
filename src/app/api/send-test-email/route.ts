import { NextResponse } from 'next/server';
import { sendTestEmail } from '@/lib/email/service';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { to, userName, subject, portfolioSummary, customSmtp } = body;

    if (!to) {
      return NextResponse.json(
        { success: false, error: 'Alıcı e-posta adresi belirtilmelidir.' },
        { status: 400 }
      );
    }

    const result = await sendTestEmail({
      to,
      userName: userName || 'Kaan Irmak',
      subject,
      portfolioSummary,
      customSmtp,
    });

    if (!result.success && (result as any).requiresSmtpConfig) {
      return NextResponse.json(
        {
          success: false,
          requiresSmtpConfig: true,
          error: (result as any).message || 'Özel SMTP gönderici bilgileri zorunludur.',
        },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Send Test Email API Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'E-posta gönderilemedi.' },
      { status: 500 }
    );
  }
}
