import { writeSampleModeSession } from '@/lib/portfolio/samplePortfolio';

export const GUEST_COOKIE_NAME = 'stockmind_guest';
export const DEMO_DESTINATION_PATH = '/dashboard?demo=1';

export function resolveSafeAppOrigin(
  headers: { get(name: string): string | null },
  requestOrigin: string,
  envUrl?: string,
  nodeEnv: string = process.env.NODE_ENV || 'development'
): string {
  const forwardedHost = headers.get('x-forwarded-host');
  const forwardedProto = headers.get('x-forwarded-proto') || 'https';
  let appOrigin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : requestOrigin;

  if ((!appOrigin || appOrigin.includes('localhost')) && nodeEnv === 'production') {
    appOrigin =
      envUrl && !envUrl.includes('localhost')
        ? envUrl
        : 'https://stockmind.kaanrmak7.workers.dev';
  }

  return appOrigin.replace(/\/$/, '');
}

export function isDemoQueryActive(
  searchParams: { get(name: string): string | null } | null | undefined
): boolean {
  return searchParams?.get('demo') === '1';
}

export function enterGuestDemoClient(deps?: {
  setCookie?: (cookieStr: string) => void;
  writeSampleSession?: (enabled: boolean) => void;
  navigate?: (url: string) => void;
}): void {
  const setCookie =
    deps?.setCookie ??
    ((cookieStr: string) => {
      if (typeof document !== 'undefined') {
        document.cookie = cookieStr;
      }
    });
  const writeSample = deps?.writeSampleSession ?? writeSampleModeSession;
  const navigate =
    deps?.navigate ??
    ((url: string) => {
      if (typeof window !== 'undefined') {
        window.location.href = url;
      }
    });

  setCookie(`${GUEST_COOKIE_NAME}=true; path=/; max-age=31536000; SameSite=Lax`);
  writeSample(true);
  navigate(DEMO_DESTINATION_PATH);
}
