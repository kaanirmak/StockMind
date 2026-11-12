import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { classifyAuthCallbackFailure } from '@/lib/auth/authMessages';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const searchParams = requestUrl.searchParams;

  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const urlError = searchParams.get('error');
  const urlErrorCode = searchParams.get('error_code');
  const urlErrorDescription = searchParams.get('error_description');
  let next = searchParams.get('next') ?? (type === 'recovery' ? '/reset-password' : '/dashboard');
  if (type === 'recovery' && next === '/dashboard') {
    next = '/reset-password';
  }
  // Resolve paths against a configured origin; forwarded headers are untrusted.
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.NODE_ENV === 'production'
      ? 'https://stockmind.kaanrmak7.workers.dev'
      : requestUrl.origin);
  const appOrigin = new URL(configuredUrl).origin;
  try {
    const destination = new URL(next, appOrigin);
    if (!next.startsWith('/') || /[\\\r\n\0]/.test(next) || destination.origin !== appOrigin) {
      next = '/dashboard';
    }
  } catch {
    next = '/dashboard';
  }

  const supabase = await createClient();
  let authSuccess = false;
  let callbackError: { message?: string | null; code?: string | null } | null = null;

  // 1. PKCE Code Exchange (used by OAuth and PKCE email links)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      authSuccess = true;
    } else {
      callbackError = { message: error.message, code: error.code };
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
      callbackError = { message: error.message, code: error.code };
      console.error('Auth callback verifyOtp error:', error.message);
    }
  }

  if (authSuccess) {
    // ─── BLOAT GUARD ─────────────────────────────────────────────
    // OAuth providers (Google, GitHub) can inject a large avatar_url
    // (sometimes base64-encoded) into user_metadata. Supabase encodes
    // user_metadata into the JWT, which @supabase/ssr stores as cookies.
    // If the avatar is base64, cookies swell to 30-80 KB and Edge proxies
    // return 494/431 REQUEST_HEADER_TOO_LARGE on every subsequent request.
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

  // Return the user to an explicit auth status message (e.g., expired recovery/verification link vs general error)
  const failure = classifyAuthCallbackFailure({
    error: urlError,
    errorCode: urlErrorCode ?? callbackError?.code,
    errorMessage: urlErrorDescription ?? callbackError?.message,
    type,
    next,
    hasTokenOrCode: Boolean(code || (tokenHash && type)),
  });

  return NextResponse.redirect(`${appOrigin}${failure.redirectPath}`);
}
