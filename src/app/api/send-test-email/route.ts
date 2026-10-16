import { NextResponse } from 'next/server';
import { sendTestEmail } from '@/lib/email/service';
import { ApiError, apiErrorResponse, authorizeAction, optionalText, readJsonObject } from '@/lib/api/security';
import { hasProAccess } from '@/lib/ai/modelCatalog';

export async function POST(request: Request) {
  try {
    const access = await authorizeAction(request, 'test_email');
    if (access.response) return access.response;
    const user = access.user;
    if (!user.email || !user.email_confirmed_at) throw new ApiError(403, 'Önce hesabınızın e-posta adresini doğrulayın.');
    const body = await readJsonObject(request, 8 * 1024);
    const recipient = optionalText(body.to, 320);
    if (recipient && recipient.toLowerCase() !== user.email.toLowerCase()) {
      throw new ApiError(403, 'Test e-postası yalnız hesabınızın doğrulanmış adresine gönderilebilir.');
    }
    if (body.customSmtp !== undefined && body.customSmtp !== null) {
      throw new ApiError(400, 'SMTP ayarları sunucuda yönetilir; istek üzerinden değiştirilemez.');
    }
    const isDaily = Boolean(body.isDailyReport);
    if (isDaily && !hasProAccess(user.app_metadata)) {
      throw new ApiError(403, '18:30 Günlük StockMind AI Bülteni Pro üyelik gerektirir.', 'PRO_REQUIRED');
    }
    const result = await sendTestEmail({ to: user.email, userName: 'StockMind Kullanıcısı', isDailyReport: isDaily });
    if (!result.success) throw new ApiError(503, result.message || 'E-posta gönderilemedi. Lütfen daha sonra tekrar deneyin.');
    return NextResponse.json({
      success: true,
      message: isDaily
        ? '18:30 bülteni doğrulanmış e-posta adresinize gönderildi.'
        : (result.message || 'Test e-postası doğrulanmış adresinize gönderildi.'),
      previewUrl: result.previewUrl,
      method: result.method,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
