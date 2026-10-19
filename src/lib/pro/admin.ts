import { createClient } from '@/lib/supabase/server';
import { ApiError } from '@/lib/api/security';

/** Only server configuration or administrator-controlled claims grant access. */
export async function requireProAdmin() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new ApiError(401, 'Önce giriş yapın.');
  const user = data.user;
  const adminEmail = (process.env.ADMIN_EMAIL || process.env.SMTP_USER || '').trim().toLowerCase();
  const configuredAdmin = Boolean(adminEmail && user.email_confirmed_at && user.email?.toLowerCase() === adminEmail);
  if (!configuredAdmin && user.app_metadata?.role !== 'admin') {
    throw new ApiError(403, 'Bu bölüm yalnızca yöneticiye açıktır.');
  }
  return user;
}
