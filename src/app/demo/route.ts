import { NextResponse } from 'next/server';
import {
  DEMO_DESTINATION_PATH,
  GUEST_COOKIE_NAME,
  resolveSafeAppOrigin,
} from '@/lib/auth/demoFlow';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const appOrigin = resolveSafeAppOrigin(
    request.headers,
    requestUrl.origin,
    process.env.NEXT_PUBLIC_APP_URL
  );

  const response = NextResponse.redirect(`${appOrigin}${DEMO_DESTINATION_PATH}`);
  response.cookies.set(GUEST_COOKIE_NAME, 'true', {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });

  return response;
}
