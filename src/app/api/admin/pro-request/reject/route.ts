import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyProActionToken } from '@/lib/pro/tokens';
import { escapeHtml } from '@/lib/utils/html';

export const dynamic = 'force-dynamic';

function renderHtml(title: string, message: string, isSuccess: boolean) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://stockmind.kaanrmak7.workers.dev';
  const safeTitle = escapeHtml(title);

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
      border: 1px solid rgba(239, 68, 68, 0.4);
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
      background: rgba(239, 68, 68, 0.15);
      color: #f87171;
      border: 1px solid rgba(239, 68, 68, 0.3);
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
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${isSuccess ? '❌' : '⚠️'}</div>
    <div class="badge">${isSuccess ? 'TALEP REDDEDİLDİ' : 'HATA'}</div>
    <h1>${safeTitle}</h1>
    <p>${message}</p>
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
    if (!verification.valid || verification.action !== 'reject' || verification.userId !== userId) {
      const errorMsg = verification.error || 'Geçersiz veya süresi dolmuş bağlantı.';
      return new NextResponse(renderHtml('İşlem Başarısız', escapeHtml(errorMsg), false), {
        status: 400,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    const admin = createAdminClient();
    const { data: userData, error: userError } = await admin.auth.admin.getUserById(userId);
    if (userError || !userData?.user) {
      return new NextResponse(renderHtml('Kullanıcı Bulunamadı', 'Kullanıcı sistemde bulunamadı.', false), {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    const targetUser = userData.user;

    // SEC-02: Ensure request is actually pending
    if (targetUser.user_metadata?.pro_request_status !== 'pending') {
      return new NextResponse(
        renderHtml('İşlem Gerçekleştirilemedi', 'Bu talep daha önce sonuçlandırılmış veya beklemede değil.', false),
        {
          status: 400,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        }
      );
    }

    await admin.auth.admin.updateUserById(userId, {
      user_metadata: {
        ...targetUser.user_metadata,
        pro_request_status: 'rejected',
        pro_rejected_at: new Date().toISOString(),
      },
    });

    return new NextResponse(
      renderHtml(
        'Talep Reddedildi',
        `<strong>${escapeHtml(targetUser.email || '')}</strong> kullanıcısının Pro hesap talebi kayıtlarda reddedildi olarak işaretlendi.`,
        true
      ),
      {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }
    );
  } catch (error: any) {
    return new NextResponse(
      renderHtml('Sistem Hatası', escapeHtml(error?.message || 'İşlem gerçekleştirilemedi.'), false),
      {
        status: 500,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }
    );
  }
}

