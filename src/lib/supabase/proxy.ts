import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Maximum total cookie size (bytes) before we consider headers dangerously large.
 * Normal Supabase session is ~2-3 KB. If it exceeds 8 KB, it's bloated and close
 * to triggering Edge / reverse proxy 494/431 (REQUEST_HEADER_TOO_LARGE).
 */
const MAX_COOKIE_BYTES = 8 * 1024;

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
  const { pathname } = request.nextUrl;

  // ─── 1. FAST BYPASS: APIs, binaries, and static files do not need session middleware ───
  if (
    pathname.startsWith('/api/') ||
    pathname.endsWith('.apk') ||
    pathname.includes('StockMind.apk') ||
    pathname.endsWith('.webmanifest') ||
    pathname.endsWith('.ico') ||
    pathname.endsWith('.txt')
  ) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    '';

  // If Supabase is not configured or uses placeholder values, pass through gracefully
  if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('placeholder')) {
    return supabaseResponse;
  }

  // ─── 2. COOKIE SIZE GUARD ───────────────────────────────────────────────
  const cookieSize = getCookieHeaderSize(request);
  if (cookieSize > MAX_COOKIE_BYTES) {
    console.warn(
      `[middleware] Cookie header too large (${cookieSize} bytes > ${MAX_COOKIE_BYTES}). ` +
        'Clearing Supabase auth cookies to prevent 494.'
    );

    const isLoginPage = request.nextUrl.pathname.startsWith('/login');
    const url = request.nextUrl.clone();
    if (!isLoginPage) {
      url.pathname = '/login';
      url.searchParams.set('reason', 'session_too_large');
    }

    const response = isLoginPage
      ? NextResponse.next({ request })
      : NextResponse.redirect(url);

    response.headers.set('Clear-Site-Data', '"cookies"');

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

  // ─── 3. ROUTE CLASSIFICATION ───────────────────────────────────────────
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

  const isProtectedRoute = protectedPaths.some((path) => pathname.startsWith(path));
  const authPaths = ['/login', '/register'];
  const isAuthRoute = authPaths.some((path) => pathname.startsWith(path));
  const isLandingPage = pathname === '/';

  // If this route does not require protection or redirect, pass through without calling Supabase
  if (!isProtectedRoute && !isAuthRoute && !isLandingPage) {
    return supabaseResponse;
  }

  const isGuest = request.cookies.get('stockmind_guest')?.value === 'true';
  const hasAuthCookie = request.cookies.getAll().some((c) => isSupabaseAuthCookie(c.name));

  // If user has NO auth cookies and is not a guest:
  if (!hasAuthCookie) {
    if (isGuest && isLandingPage) {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }

    if (isProtectedRoute && !isGuest) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }

    // Visiting /login, /register, or / without auth cookies: pass through in 0ms!
    return supabaseResponse;
  }

  // ─── 4. VERIFY USER WITH SUPABASE (ONLY FOR REQUESTS WITH COOKIES) ───
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

    if (!user && !isGuest && isProtectedRoute) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }

    if (user && isAuthRoute) {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }

    if ((user || isGuest) && isLandingPage) {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
  } catch (error) {
    console.error('Supabase middleware session check error:', error);
    return supabaseResponse;
  }

  return supabaseResponse;
}

