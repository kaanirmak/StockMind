import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
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
        const { data: { user } } = await supabase.auth.getUser();
        const avatar = user?.user_metadata?.avatar_url;
        const picture = user?.user_metadata?.picture;
        const needsCleanup =
          (avatar && (avatar.startsWith('data:') || avatar.length > 500)) ||
          (picture && (picture.startsWith('data:') || picture.length > 500));

        if (needsCleanup) {
          // Keep only a safe URL (not base64, <500 chars) or null
          const safeAvatar = avatar && !avatar.startsWith('data:') && avatar.length < 500
            ? avatar : null;
          const safePicture = picture && !picture.startsWith('data:') && picture.length < 500
            ? picture : null;

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

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
}

