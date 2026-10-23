import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyProActionToken } from '@/lib/pro/tokens';
import { sendProApprovedUserEmail } from '@/lib/email/service';
import { escapeHtml } from '@/lib/utils/html';

export const dynamic = 'force-dynamic';

function renderHtml(title: string, message: string, isSuccess: boolean, userEmail?: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://stockmind.kaanrmak7.workers.dev';
  const safeTitle = escapeHtml(title);
  const safeEmail = userEmail ? escapeHtml(userEmail) : '';

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle} • StockMind Yönetim</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background: #060913;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #f1f5f9;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .card {
      background: linear-gradient(135deg, #0d1527 0%, #111a33 100%);
      border: 1px solid ${isSuccess ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'};
      border-radius: 24px;
      padding: 40px;
      max-width: 480px;
      width: 90%;
      text-align: center;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
    }
    .icon {
      font-size: 54px;
      margin-bottom: 16px;
    }
    h1 {
      font-size: 22px;
      font-weight: 800;
      margin: 0 0 12px;
      color: #ffffff;
    }
    p {
      font-size: 14px;
      line-height: 1.6;
      color: #94a3b8;
      margin: 0 0 24px;
    }
    .badge {
      display: inline-block;
      padding: 6px 16px;
      background: ${isSuccess ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)'};
      color: ${isSuccess ? '#34d399' : '#f87171'};
      border: 1px solid ${isSuccess ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'};
      border-radius: 100px;
      font-size: 13px;
      font-weight: 700;
      margin-bottom: 20px;
    }
    .btn {
      display: inline-block;
      background: linear-gradient(135deg, #6366f1, #4f46e5);
      color: #ffffff;
      text-decoration: none;
      padding: 12px 28px;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 700;
      transition: opacity 0.2s;
    }
    .btn:hover {
      opacity: 0.9;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${isSuccess ? '🎉' : '⚠️'}</div>
    <div class="badge">${isSuccess ? 'PRO ONAYLANDI' : 'İŞLEM BAŞARISIZ'}</div>
    <h1>${safeTitle}</h1>
    <p>${message}</p>
    ${safeEmail ? `<p style="font-family: monospace; font-size: 12px; color: #64748b;">Kullanıcı: ${safeEmail}</p>` : ''}
    <a href="${baseUrl}/dashboard" class="btn">StockMind Paneline Git</a>
  </div>
</body>
</html>`;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || '';
    const token = searchParams.get('token') || '';

    const verification = verifyProActionToken(token);
    if (!verification.valid || verification.action !== 'approve' || verification.userId !== userId) {
      const errorMsg = verification.error || 'Geçersiz veya süresi dolmuş onay bağlantısı.';
      return new NextResponse(renderHtml('Onay Başarısız', escapeHtml(errorMsg), false), {
        status: 400,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    const admin = createAdminClient();

    // 1. Fetch user to confirm existence and current email
    const { data: userData, error: userError } = await admin.auth.admin.getUserById(userId);
    if (userError || !userData?.user) {
      return new NextResponse(renderHtml('Kullanıcı Bulunamadı', 'Belirtilen kullanıcı sistemde bulunamadı.', false), {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    const targetUser = userData.user;
    const targetEmail = targetUser.email || verification.email || '';
    const targetName =
      targetUser.user_metadata?.full_name ||
      targetUser.user_metadata?.name ||
      targetEmail.split('@')[0] ||
      'Değerli Yatırımcı';

    // SEC-02: Ensure request is actually in pending state (prevents replay or resurrected privileges)
    if (targetUser.user_metadata?.pro_request_status !== 'pending') {
      return new NextResponse(
        renderHtml(
          'İşlem Gerçekleştirilemedi',
          'Bu Pro hesap talebi daha önce sonuçlandırılmış veya beklemede değil.',
          false,
          targetEmail
        ),
        {
          status: 400,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        }
      );
    }

    // 2. Grant Pro entitlements in app_metadata (canonical source of truth)
    const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
      app_metadata: {
        ...targetUser.app_metadata,
        plan: 'pro',
        is_pro: true,
      },
      user_metadata: {
        ...targetUser.user_metadata,
        plan: 'pro',
        is_pro: true,
        pro_request_status: 'approved',
        pro_approved_at: new Date().toISOString(),
      },
    });

    if (updateError) {
      throw updateError;
    }

    // 3. Update profiles table if it exists
    try {
      await admin.from('profiles').update({ is_pro: true, plan: 'pro' }).eq('id', userId);
    } catch {
      // profiles table might not have is_pro column, app_metadata is primary
    }

    // 4. Send congratulations email to the approved user
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://stockmind.kaanrmak7.workers.dev';
    await sendProApprovedUserEmail({
      to: targetEmail,
      userName: targetName,
      appUrl: baseUrl,
    }).catch((emailErr) => console.warn('Could not send pro approval user email:', emailErr));

    return new NextResponse(
      renderHtml(
        'Pro Hesap Başarıyla Onaylandı!',
        `<strong>${escapeHtml(targetEmail)}</strong> kullanıcısının hesabı StockMind Pro'ya yükseltildi ve kullanıcıya tebrik e-postası iletildi.`,
        true,
        targetEmail
      ),
      {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }
    );
  } catch (error: any) {
    console.error('Pro approval endpoint error:', error);
    return new NextResponse(
      renderHtml('Sistem Hatası', escapeHtml(error?.message || 'İşlem gerçekleştirilirken bir hata oluştu.'), false),
      {
        status: 500,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }
    );
  }
}

