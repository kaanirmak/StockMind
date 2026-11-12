import { NextResponse } from 'next/server';

// Mail scanners and reusable bearer links must not grant or revoke privileges.
// Decisions are made in the authenticated, MFA-protected admin console via POST.
export async function GET() {
  const origin = process.env.NEXT_PUBLIC_APP_URL || 'https://stockmind.kaanrmak7.workers.dev';
  return NextResponse.redirect(new URL('/admin', origin));
}
