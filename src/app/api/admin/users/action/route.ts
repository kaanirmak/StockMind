import { NextResponse } from 'next/server';
import { requireDesktopAdmin } from '@/lib/admin/desktopGuard';
import { createAdminClient } from '@/lib/supabase/admin';
import { ApiError, apiErrorResponse, readJsonObject } from '@/lib/api/security';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    await requireDesktopAdmin(request);
    const body = await readJsonObject(request, 8 * 1024);

    const userId = String(body.userId || '').trim();
    const action = String(body.action || '').trim();

    if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) {
      throw new ApiError(400, 'Geçersiz kullanıcı ID.');
    }

    const admin = createAdminClient();
    const { data: userData, error: getUserError } = await admin.auth.admin.getUserById(userId);

    if (getUserError || !userData?.user) {
      throw new ApiError(404, 'Kullanıcı bulunamadı.');
    }

    const targetUser = userData.user;

    switch (action) {
      case 'ban': {
        const banUntil = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
        const { error } = await admin.auth.admin.updateUserById(userId, {
          ban_duration: '8760h',
        });
        if (error) throw error;
        return NextResponse.json({
          success: true,
          message: `${targetUser.email} kullanıcısı 1 yıl süreyle askıya alındı.`,
        });
      }

      case 'unban': {
        const { error } = await admin.auth.admin.updateUserById(userId, {
          ban_duration: 'none',
        });
        if (error) throw error;
        return NextResponse.json({
          success: true,
          message: `${targetUser.email} kullanıcısının askı durumu kaldırıldı.`,
        });
      }

      case 'reset_password': {
        if (!targetUser.email) {
          throw new ApiError(400, 'Kullanıcının e-posta adresi bulunmuyor.');
        }
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://stockmind.kaanrmak7.workers.dev';
        const { error } = await admin.auth.resetPasswordForEmail(targetUser.email, {
          redirectTo: `${baseUrl}/auth/callback?next=/reset-password`,
        });
        if (error) throw error;
        return NextResponse.json({
          success: true,
          message: `${targetUser.email} adresine şifre sıfırlama bağlantısı gönderildi.`,
        });
      }

      case 'purge_metadata': {
        const meta = targetUser.user_metadata || {};
        const safeAvatar =
          meta.avatar_url && !meta.avatar_url.startsWith('data:') && meta.avatar_url.length < 500
            ? meta.avatar_url
            : null;
        const safePicture =
          meta.picture && !meta.picture.startsWith('data:') && meta.picture.length < 500
            ? meta.picture
            : null;

        const { error } = await admin.auth.admin.updateUserById(userId, {
          user_metadata: {
            ...meta,
            avatar_url: safeAvatar ?? safePicture,
            picture: safePicture,
          },
        });
        if (error) throw error;
        return NextResponse.json({
          success: true,
          message: `${targetUser.email} kullanıcısının şişkin metadata verisi temizlendi.`,
        });
      }

      default:
        throw new ApiError(400, `Desteklenmeyen işlem: ${action}`);
    }
  } catch (error) {
    return apiErrorResponse(error);
  }
}
