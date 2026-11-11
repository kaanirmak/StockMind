import type { NotificationPermissionState } from './pushNotification';
import {
  getNotificationPermissionState,
  playNotificationSound,
  requestNotificationPermission,
} from './pushNotification';

export type WebPushMode =
  | 'android-native'
  | 'ios-pwa-ready'
  | 'ios-requires-home-screen'
  | 'browser-supported'
  | 'unsupported';

export interface WebPushEnvironmentSnapshot {
  userAgent: string;
  isStandalone: boolean;
  isAndroidWebView: boolean;
  hasNotificationApi: boolean;
  hasServiceWorker: boolean;
  hasPushManager: boolean;
  permissionState: NotificationPermissionState;
  hasVapidPublicKey?: boolean;
}

export interface WebPushSupportReport {
  mode: WebPushMode;
  supported: boolean;
  isIos: boolean;
  isStandalone: boolean;
  iosNeedsHomeScreen: boolean;
  platform: 'android' | 'pwa' | 'web';
  permissionState: NotificationPermissionState;
  vapidConfigured: boolean;
  title: string;
  guidance: string;
}

export interface SerializedPushSubscription {
  endpoint: string;
  expirationTime?: number | null;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
}

export interface WebPushRegistrationResult {
  ok: boolean;
  support: WebPushSupportReport;
  permissionState: NotificationPermissionState;
  platform: 'android' | 'pwa' | 'web';
  serviceWorkerActive: boolean;
  subscriptionEndpoint: string | null;
  serializedSubscription: string | null;
  reason: string;
}

export interface WebPushTestResult {
  delivered: boolean;
  usedServiceWorker: boolean;
  verifiedRoute: string;
  permissionState: NotificationPermissionState;
  testedAt: string;
  reason: string;
}

/**
 * Only allows internal same-origin relative routes to prevent open redirect / phishing via notifications.
 */
export function normalizeWebPushRoute(route?: string | null): string {
  if (typeof route !== 'string') return '/dashboard';
  const trimmed = route.trim();
  if (
    !trimmed.startsWith('/') ||
    trimmed.startsWith('//') ||
    trimmed.startsWith('/\\') ||
    /[\r\n\0]/.test(trimmed)
  ) {
    return '/dashboard';
  }
  return trimmed;
}

export function isIosUserAgent(userAgent: string): boolean {
  return /iphone|ipad|ipod/i.test(userAgent || '');
}

export function isRunningStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  if (nav.standalone === true) return true;
  if (typeof window.matchMedia === 'function') {
    try {
      return window.matchMedia('(display-mode: standalone)').matches;
    } catch {
      return false;
    }
  }
  return false;
}

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const normalized = base64String.trim();
  const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
  const base64 = (normalized + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData =
    typeof atob === 'function'
      ? atob(base64)
      : Buffer.from(base64, 'base64').toString('binary');
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function parseStoredPushSubscription(
  raw: string | null | undefined,
): SerializedPushSubscription | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SerializedPushSubscription>;
    if (
      parsed &&
      typeof parsed.endpoint === 'string' &&
      parsed.endpoint.startsWith('https://')
    ) {
      return {
        endpoint: parsed.endpoint,
        expirationTime:
          typeof parsed.expirationTime === 'number' || parsed.expirationTime === null
            ? parsed.expirationTime
            : null,
        keys:
          parsed.keys && typeof parsed.keys === 'object'
            ? {
                p256dh:
                  typeof parsed.keys.p256dh === 'string' ? parsed.keys.p256dh : undefined,
                auth: typeof parsed.keys.auth === 'string' ? parsed.keys.auth : undefined,
              }
            : undefined,
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function inspectWebPushSupport(
  snapshot: WebPushEnvironmentSnapshot,
): WebPushSupportReport {
  const isIos = isIosUserAgent(snapshot.userAgent);
  const vapidConfigured = Boolean(snapshot.hasVapidPublicKey);

  if (snapshot.isAndroidWebView) {
    return {
      mode: 'android-native',
      supported: true,
      isIos: false,
      isStandalone: true,
      iosNeedsHomeScreen: false,
      platform: 'android',
      permissionState: snapshot.permissionState,
      vapidConfigured,
      title: 'Android Yerel Bildirim Kanalı',
      guidance: 'Android uygulaması yerel bildirim köprüsü ile çalışıyor.',
    };
  }

  if (isIos && !snapshot.isStandalone) {
    return {
      mode: 'ios-requires-home-screen',
      supported: false,
      isIos: true,
      isStandalone: false,
      iosNeedsHomeScreen: true,
      platform: 'web',
      permissionState: snapshot.permissionState,
      vapidConfigured,
      title: 'iOS Ana Ekrana Ekleme Gerekli',
      guidance:
        'iPhone ve iPad cihazlarda Web Push yalnızca ana ekrana eklenen uygulamada çalışır: Safari alt menüsünden Paylaş > Ana Ekrana Ekle yolunu izleyin ve StockMind’ı ana ekrandan açıp bildirim izni verin.',
    };
  }

  const canWebPush =
    snapshot.hasNotificationApi &&
    snapshot.hasServiceWorker &&
    (snapshot.hasPushManager || snapshot.permissionState !== 'unsupported');

  if (!canWebPush) {
    return {
      mode: 'unsupported',
      supported: false,
      isIos,
      isStandalone: snapshot.isStandalone,
      iosNeedsHomeScreen: false,
      platform: snapshot.isStandalone ? 'pwa' : 'web',
      permissionState: 'unsupported',
      vapidConfigured,
      title: 'Tarayıcı Web Push Desteği Yok',
      guidance:
        'Bu tarayıcı ortamında Web Push / Service Worker API kullanılamıyor. Güncel Chrome, Edge, Firefox veya iOS 16.4+ Ana Ekran web uygulamasını kullanın.',
    };
  }

  if (isIos && snapshot.isStandalone) {
    return {
      mode: 'ios-pwa-ready',
      supported: true,
      isIos: true,
      isStandalone: true,
      iosNeedsHomeScreen: false,
      platform: 'pwa',
      permissionState: snapshot.permissionState,
      vapidConfigured,
      title: 'iOS Ana Ekran Web Uygulaması (PWA)',
      guidance:
        snapshot.permissionState === 'granted'
          ? 'iOS ana ekran web uygulaması bildirim izni etkin ve test bildirimi bağlantısı doğrulanabilir.'
          : 'Ana ekrana eklenen StockMind uygulamasında Web Push iznini etkinleştirip test bildirimi gönderebilirsiniz.',
    };
  }

  return {
    mode: 'browser-supported',
    supported: true,
    isIos: false,
    isStandalone: snapshot.isStandalone,
    iosNeedsHomeScreen: false,
    platform: snapshot.isStandalone ? 'pwa' : 'web',
    permissionState: snapshot.permissionState,
    vapidConfigured,
    title: snapshot.isStandalone ? 'Masaüstü / Mobil Web Uygulaması (PWA)' : 'Desteklenen Web Tarayıcı',
    guidance:
      snapshot.permissionState === 'granted'
        ? 'Service Worker tabanlı Web Push ve bildirim derin bağlantısı (deep-link) hazır.'
        : 'Web Push izni vererek tarayıcı ve PWA bildirim bağlantısını doğrulayın.',
  };
}

export function getBrowserWebPushSnapshot(): WebPushEnvironmentSnapshot {
  if (typeof window === 'undefined') {
    return {
      userAgent: '',
      isStandalone: false,
      isAndroidWebView: false,
      hasNotificationApi: false,
      hasServiceWorker: false,
      hasPushManager: false,
      permissionState: 'unsupported',
      hasVapidPublicKey: Boolean(process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY),
    };
  }

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  const hasNotificationApi = 'Notification' in window;
  const hasServiceWorker = typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
  const hasPushManager = typeof window !== 'undefined' && 'PushManager' in window;

  return {
    userAgent: ua,
    isStandalone: isRunningStandalone(),
    isAndroidWebView: Boolean((window as unknown as Record<string, unknown>).StockMindAndroid),
    hasNotificationApi,
    hasServiceWorker,
    hasPushManager,
    permissionState: getNotificationPermissionState(),
    hasVapidPublicKey: Boolean(process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY),
  };
}

export async function registerWebPushChannel(options?: {
  vapidPublicKey?: string;
  requestPermissionFirst?: boolean;
}): Promise<WebPushRegistrationResult> {
  const vapidPublicKey =
    options?.vapidPublicKey ?? process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY ?? '';
  let snapshot = getBrowserWebPushSnapshot();
  let support = inspectWebPushSupport({
    ...snapshot,
    hasVapidPublicKey: Boolean(vapidPublicKey),
  });

  if (!support.supported || support.mode === 'android-native') {
    return {
      ok: support.mode === 'android-native',
      support,
      permissionState: snapshot.permissionState,
      platform: support.platform,
      serviceWorkerActive: false,
      subscriptionEndpoint: null,
      serializedSubscription: null,
      reason: support.guidance,
    };
  }

  if (options?.requestPermissionFirst !== false && snapshot.permissionState === 'default') {
    await requestNotificationPermission();
    snapshot = getBrowserWebPushSnapshot();
    support = inspectWebPushSupport({
      ...snapshot,
      hasVapidPublicKey: Boolean(vapidPublicKey),
    });
  }

  if (snapshot.permissionState !== 'granted') {
    return {
      ok: false,
      support,
      permissionState: snapshot.permissionState,
      platform: support.platform,
      serviceWorkerActive: false,
      subscriptionEndpoint: null,
      serializedSubscription: null,
      reason:
        snapshot.permissionState === 'denied'
          ? 'Tarayıcı bildirim izni reddedildi. Site ayarlarından izin verin.'
          : 'Web Push için bildirim izni onaylanmadı.',
    };
  }

  if (!snapshot.hasServiceWorker) {
    return {
      ok: false,
      support,
      permissionState: snapshot.permissionState,
      platform: support.platform,
      serviceWorkerActive: false,
      subscriptionEndpoint: null,
      serializedSubscription: null,
      reason: 'Service Worker bu tarayıcı bağlamında kullanılamıyor.',
    };
  }

  try {
    await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    const registration = await navigator.serviceWorker.ready;
    let subscription = registration.pushManager
      ? await registration.pushManager.getSubscription()
      : null;

    if (!subscription && registration.pushManager && vapidPublicKey.trim()) {
      const appServerKey = urlBase64ToUint8Array(vapidPublicKey);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: appServerKey as unknown as BufferSource,
      });
    }

    const serialized = subscription ? JSON.stringify(subscription.toJSON()) : null;
    const endpoint = subscription?.endpoint ?? null;

    return {
      ok: true,
      support,
      permissionState: 'granted',
      platform: support.platform,
      serviceWorkerActive: Boolean(registration.active || registration.waiting || registration.installing),
      subscriptionEndpoint: endpoint,
      serializedSubscription: serialized,
      reason: endpoint
        ? 'Service Worker ve Web Push aboneliği doğrulandı.'
        : 'Service Worker etkin; tarayıcı/PWA bildirimleri gönderime hazır.',
    };
  } catch (err) {
    return {
      ok: false,
      support,
      permissionState: snapshot.permissionState,
      platform: support.platform,
      serviceWorkerActive: false,
      subscriptionEndpoint: null,
      serializedSubscription: null,
      reason:
        err instanceof Error
          ? `Service Worker kaydı tamamlanamadı: ${err.message}`
          : 'Service Worker kaydı sırasında beklenmeyen bir hata oluştu.',
    };
  }
}

export async function sendWebPushTestNotification(input: {
  title: string;
  body: string;
  route?: string;
}): Promise<WebPushTestResult> {
  const testedAt = new Date().toISOString();
  const safeRoute = normalizeWebPushRoute(input.route);
  const permissionState = getNotificationPermissionState();

  if (typeof window === 'undefined') {
    return {
      delivered: false,
      usedServiceWorker: false,
      verifiedRoute: safeRoute,
      permissionState: 'unsupported',
      testedAt,
      reason: 'Sunucu ortamında Web Push test bildirimi gönderilemez.',
    };
  }

  if (permissionState !== 'granted') {
    return {
      delivered: false,
      usedServiceWorker: false,
      verifiedRoute: safeRoute,
      permissionState,
      testedAt,
      reason:
        permissionState === 'denied'
          ? 'Bildirim izni tarayıcı tarafından engellendi.'
          : 'Web Push test bildirimi için önce izin verilmelidir.',
    };
  }

  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      const registration = await navigator.serviceWorker.ready;
      if (registration && typeof registration.showNotification === 'function') {
        await registration.showNotification(input.title, {
          body: input.body,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag: 'stockmind-web-push-test',
          data: { route: safeRoute },
        });
        playNotificationSound();
        return {
          delivered: true,
          usedServiceWorker: true,
          verifiedRoute: safeRoute,
          permissionState: 'granted',
          testedAt,
          reason: `Service Worker üzerinden bildirim gösterildi; tıklanınca "${safeRoute}" sayfası açılır.`,
        };
      }
    } catch {
      /* Fall back to window Notification below */
    }
  }

  if ('Notification' in window) {
    try {
      const notif = new Notification(input.title, {
        body: input.body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        data: { route: safeRoute },
      });
      notif.onclick = () => {
        window.focus();
        window.location.href = safeRoute;
      };
      playNotificationSound();
      return {
        delivered: true,
        usedServiceWorker: false,
        verifiedRoute: safeRoute,
        permissionState: 'granted',
        testedAt,
        reason: `Tarayıcı bildirimi gösterildi; tıklanınca "${safeRoute}" rotasına yönlendirilir.`,
      };
    } catch {
      /* fall through */
    }
  }

  return {
    delivered: false,
    usedServiceWorker: false,
    verifiedRoute: safeRoute,
    permissionState,
    testedAt,
    reason: 'Web Notification API kullanılamadığı için test bildirimi gönderilemedi.',
  };
}
