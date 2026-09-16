import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

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

