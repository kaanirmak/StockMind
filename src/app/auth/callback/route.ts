import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { EmailOtpType } from '@supabase/supabase-js';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const searchParams = requestUrl.searchParams;

  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = searchParams.get('next') ?? '/dashboard';

  // Determine real external origin (handles Vercel / reverse proxy headers)
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
  let appOrigin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : requestUrl.origin;

  // Guard against internal/localhost origins in production environments
  if (appOrigin.includes('localhost') && process.env.NODE_ENV === 'production') {
    appOrigin = process.env.NEXT_PUBLIC_APP_URL || 'https://stockmind-finora.vercel.app';
  }

  // Ensure no trailing slash on origin
  appOrigin = appOrigin.replace(/\/$/, '');

  const supabase = await createClient();
  let authSuccess = false;

  // 1. PKCE Code Exchange (used by OAuth and PKCE email links)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      authSuccess = true;
    } else {
      console.error('Auth callback exchangeCodeForSession error:', error.message);
    }
  }
  // 2. Token Hash Verification (used by email confirmation links with token_hash)
  else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    if (!error) {
      authSuccess = true;
    } else {
      console.error('Auth callback verifyOtp error:', error.message);
    }
  }

  if (authSuccess) {
    // ─── BLOAT GUARD ─────────────────────────────────────────────
    // OAuth providers (Google, GitHub) can inject a large avatar_url
    // (sometimes base64-encoded) into user_metadata. Supabase encodes
    // user_metadata into the JWT, which @supabase/ssr stores as cookies.
    // If the avatar is base64, cookies swell to 30-80 KB and Vercel
    // returns 494 REQUEST_HEADER_TOO_LARGE on every subsequent request.
    //
    // Fix: strip the avatar immediately after session exchange, BEFORE
    // the first redirect sets the oversized cookie.
    // ──────────────────────────────────────────────────────────────
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const avatar = user?.user_metadata?.avatar_url;
      const picture = user?.user_metadata?.picture;
      const needsCleanup =
        (avatar && (avatar.startsWith('data:') || avatar.length > 500)) ||
        (picture && (picture.startsWith('data:') || picture.length > 500));

      if (needsCleanup) {
        const safeAvatar =
          avatar && !avatar.startsWith('data:') && avatar.length < 500 ? avatar : null;
        const safePicture =
          picture && !picture.startsWith('data:') && picture.length < 500 ? picture : null;

        await supabase.auth.updateUser({
          data: {
            avatar_url: safeAvatar ?? safePicture,
            picture: safePicture,
          },
        });
      }
    } catch (cleanupErr) {
      console.warn('Auth callback: failed to clean bloated metadata:', cleanupErr);
    }

    return NextResponse.redirect(`${appOrigin}${next}`);
  }

  // Return the user to login with error indicator
  return NextResponse.redirect(`${appOrigin}/login?error=auth_callback_error`);
}
