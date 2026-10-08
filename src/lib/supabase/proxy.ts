import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Maximum total cookie size (bytes) before we consider headers dangerously large.
 * Vercel Edge enforces ~16 KB; we use 14 KB as a safe threshold.
 */
const MAX_COOKIE_BYTES = 14 * 1024;

/**
 * Detect if a cookie belongs to the Supabase auth token family.
 * @supabase/ssr splits large JWTs into chunked cookies:
 *   sb-<project-ref>-auth-token, sb-<project-ref>-auth-token.0, .1, …
 */
function isSupabaseAuthCookie(name: string): boolean {
  return /^sb-.+-auth-token/.test(name);
}

/**
 * Calculate the total byte size of all cookies on the request.
 * Uses `name=value` pairs joined by '; ' which mirrors the Cookie header.
 */
function getCookieHeaderSize(request: NextRequest): number {
  const allCookies = request.cookies.getAll();
  // Cookie header format: "name1=value1; name2=value2"
  const headerValue = allCookies
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');
  // Use TextEncoder to get accurate byte length (handles multi-byte chars)
  return new TextEncoder().encode(headerValue).length;
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  // If Supabase is not configured or uses placeholder values, pass through gracefully
  if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('placeholder')) {
    return supabaseResponse;
  }

  // ─── COOKIE SIZE GUARD ───────────────────────────────────────────────
  // When user_metadata contains a base64 avatar, the JWT (and therefore
  // the Supabase auth cookies) can swell to 30-80 KB, exceeding Vercel
  // Edge's ~16 KB header limit and causing 494 REQUEST_HEADER_TOO_LARGE.
  //
  // We detect this BEFORE creating the Supabase client so we never even
  // attempt to send oversized headers upstream. The fix:
  //   1. Delete every Supabase auth cookie from the response.
  //   2. Redirect to /login?reason=session_too_large so the user
  //      re-authenticates with a fresh (clean) session.
  // ─────────────────────────────────────────────────────────────────────
  const cookieSize = getCookieHeaderSize(request);
  if (cookieSize > MAX_COOKIE_BYTES) {
    console.warn(
      `[middleware] Cookie header too large (${cookieSize} bytes > ${MAX_COOKIE_BYTES}). ` +
        'Clearing Supabase auth cookies to prevent 494.'
    );

    // If we're already heading to /login, just strip the cookies and pass through
    // to prevent an infinite redirect loop.
    const isLoginPage = request.nextUrl.pathname.startsWith('/login');

    const url = request.nextUrl.clone();
    if (!isLoginPage) {
      url.pathname = '/login';
      url.searchParams.set('reason', 'session_too_large');
    }

    const response = isLoginPage
      ? NextResponse.next({ request })
      : NextResponse.redirect(url);

    // Expire every Supabase auth cookie
    for (const cookie of request.cookies.getAll()) {
      if (isSupabaseAuthCookie(cookie.name)) {
        response.cookies.set(cookie.name, '', {
          path: '/',
          maxAge: 0,
        });
      }
    }

    return response;
  }

  try {
    const supabase = createServerClient(
      supabaseUrl,
      supabaseKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            supabaseResponse = NextResponse.next({
              request,
            });
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    // Refresh auth session
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Protected routes: check for authenticated user or guest demo session
    const isGuest = request.cookies.get('stockmind_guest')?.value === 'true';

    const protectedPaths = [
      '/dashboard',
      '/portfolio',
      '/stocks',
      '/funds',
      '/watchlist',
      '/reports',
      '/ai-assistant',
      '/news',
      '/settings',
    ];

    const isProtectedRoute = protectedPaths.some((path) =>
      request.nextUrl.pathname.startsWith(path)
    );

    if (!user && !isGuest && isProtectedRoute) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }

    // Redirect logged-in users away from auth pages
    const authPaths = ['/login', '/register'];
    const isAuthRoute = authPaths.some((path) =>
      request.nextUrl.pathname.startsWith(path)
    );

    if (user && isAuthRoute) {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
  } catch (error) {
    // If Supabase throws an unexpected error (network or invalid key), do not crash with 500
    console.error('Supabase middleware session check error:', error);
    return supabaseResponse;
  }

  return supabaseResponse;
}

