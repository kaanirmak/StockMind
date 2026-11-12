import { NextResponse } from 'next/server';
import { requireProAdmin } from '@/lib/pro/admin';
import { createClient } from '@/lib/supabase/server';
import { apiErrorResponse } from '@/lib/api/security';

/** Bootstrap the MFA screen without exposing any administrative data. */
export async function GET() {
  try {
    const user = await requireProAdmin(false);
    const client = await createClient();
    const { data, error } = await client.auth.getClaims();
    return NextResponse.json({
      email: user.email,
      mfaVerified: !error && data?.claims?.sub === user.id && data.claims.aal === 'aal2',
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
