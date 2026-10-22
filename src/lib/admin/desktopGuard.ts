import { requireProAdmin } from '@/lib/pro/admin';
import { ApiError } from '@/lib/api/security';

export function isMobileUserAgent(ua: string = ''): boolean {
  if (!ua) return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|Silk/i.test(ua);
}

export function isMobileRequest(request: Request): boolean {
  const ua = request.headers.get('user-agent') || '';
  const secChUaMobile = request.headers.get('sec-ch-ua-mobile');
  if (secChUaMobile === '?1') return true;
  return isMobileUserAgent(ua);
}

/**
 * Validates that the request comes from an authenticated administrator
 * AND is running on an authorized desktop workstation (not mobile/tablet).
 */
export async function requireDesktopAdmin(request: Request) {
  if (isMobileRequest(request)) {
    throw new ApiError(
      403,
      'Güvenlik Protokolü Engeli: Yönetici Konsolu mobil ve tablet cihazlara kapalıdır. Yalnızca yetkili masaüstü iş istasyonundan işlem yapabilirsiniz.'
    );
  }

  return await requireProAdmin();
}
