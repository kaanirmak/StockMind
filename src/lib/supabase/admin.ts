import { createClient } from '@supabase/supabase-js';

/** Privileged operations must never silently fall back to an anonymous client. */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || supabaseUrl.includes('placeholder') || !serviceRoleKey?.trim()) {
    throw new Error('Supabase admin yapılandırması eksik.');
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
