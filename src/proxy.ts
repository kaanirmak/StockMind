import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api routes (they handle their own auth or are public)
     * - StockMind.apk & large binary/static assets
     */
    '/((?!_next/static|_next/image|favicon.ico|api/|StockMind\\.apk|.*\\.(?:svg|png|jpg|jpeg|gif|webp|html|apk|ico|webmanifest|txt)$).*)',
  ],
};
