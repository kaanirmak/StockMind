import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createProActionToken } from '@/lib/pro/tokens';
import { sendProRequestAdminEmail } from '@/lib/email/service';
import { hasProAccess } from '@/lib/ai/modelCatalog';
import { ApiError, apiErrorResponse, optionalText, readJsonObject } from '@/lib/api/security';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new ApiError(401, 'Pro hesap talebi için önce hesabınıza giriş yapmalısınız.');
    }

    if (hasProAccess(user.app_metadata)) {
      return NextResponse.json({
        success: true,
        alreadyPro: true,
        message: 'Hesabınız zaten StockMind Pro yetkisine sahiptir.',
      });
    }

    const currentStatus = user.user_metadata?.pro_request_status;
    const requestedAt = user.user_metadata?.pro_request_notified_at;

    // If requested within last 2 hours and still pending, prevent spamming admin
    if (currentStatus === 'pending' && requestedAt) {
      const elapsedHours = (Date.now() - new Date(requestedAt).getTime()) / (1000 * 60 * 60);
      if (elapsedHours < 2) {
        return NextResponse.json({
          success: true,
          pending: true,
          message: 'Pro hesap talebiniz daha önce alındı ve yönetici onayında bekliyor.',
        });
      }
    }

    let note = '';
    try {
      const body = await readJsonObject(request, 8 * 1024);
      note = optionalText(body.note, 500) || '';
    } catch {
      // Body optional
    }

    const userName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split('@')[0] ||
      'StockMind Kullanıcısı';
    const userEmail = user.email || '';

    // Generate secure 30-day tokens
    const approveToken = createProActionToken(user.id, userEmail, 'approve', 30);
    const rejectToken = createProActionToken(user.id, userEmail, 'reject', 30);

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://stockmind.kaanrmak7.workers.dev';
    const approveUrl = `${baseUrl}/api/admin/pro-request/approve?userId=${encodeURIComponent(user.id)}&token=${encodeURIComponent(approveToken)}`;
    const rejectUrl = `${baseUrl}/api/admin/pro-request/reject?userId=${encodeURIComponent(user.id)}&token=${encodeURIComponent(rejectToken)}`;

    // Update user metadata to mark pending
    try {
      const admin = createAdminClient();
      const { error } = await admin.auth.admin.updateUserById(user.id, {
        user_metadata: {
          ...user.user_metadata,
          pro_request_status: 'pending',
          pro_requested_at: new Date().toISOString(),
          pro_request_note: note,
        },
      });
      if (error) throw error;
    } catch (updateErr) {
      console.warn('Could not record pending state via admin client, falling back to auth client:', updateErr);
      const { error } = await supabase.auth.updateUser({
        data: {
          pro_request_status: 'pending',
          pro_requested_at: new Date().toISOString(),
          pro_request_note: note,
        },
      });
      if (error) throw error;
    }

    // Determine admin recipient
    const adminEmail = (
      process.env.ADMIN_EMAIL ||
      process.env.SMTP_USER ||
      'kaanrmak7@gmail.com'
    ).trim();

    // If the requesting user is the system administrator, grant Pro immediately
    if (userEmail.toLowerCase() === adminEmail.toLowerCase()) {
      try {
        const admin = createAdminClient();
        await admin.auth.admin.updateUserById(user.id, {
          app_metadata: { ...user.app_metadata, plan: 'pro', is_pro: true },
          user_metadata: {
            ...user.user_metadata,
            plan: 'pro',
            is_pro: true,
            pro_request_status: 'approved',
            pro_approved_at: new Date().toISOString(),
          },
        });
        try {
          await admin.from('profiles').update({ is_pro: true, plan: 'pro' }).eq('id', user.id);
        } catch {
          // profiles table is secondary
        }
        return NextResponse.json({
          success: true,
          alreadyPro: false,
          approved: true,
          message: 'Yönetici hesabınız için StockMind Pro yetkileri başarıyla aktif edildi! 🎉',
        });
      } catch (autoErr) {
        console.warn('Auto-approval for admin account encountered an issue:', autoErr);
      }
    }

    // Dispatch email to admin
    const emailResult = await sendProRequestAdminEmail({
      adminEmail,
      userName,
      userEmail,
      userId: user.id,
      requestNote: note,
      approveUrl,
      rejectUrl,
    });

    if (emailResult.success) {
      const { error } = await supabase.auth.updateUser({
        data: { pro_request_notified_at: new Date().toISOString() },
      });
      if (error) console.warn('Pro notification timestamp could not be recorded.');
    }

    return NextResponse.json({
      success: true,
      message: emailResult.success
        ? 'Pro hesap talebiniz kaydedildi ve yöneticiye e-posta gönderildi. Onay durumunuzu Ayarlar bölümünden takip edebilirsiniz.'
        : 'Pro hesap talebiniz kaydedildi; ancak yöneticiye e-posta gönderilemedi. Talebiniz yönetici panelinde onay bekliyor.',
      emailSent: emailResult.success,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
