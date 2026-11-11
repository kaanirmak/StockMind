import type {
  NotificationPermissionState,
  PushNotificationPreferences,
} from './pushNotification';

export type NotificationDevicePlatform = 'android' | 'web' | 'pwa';
export type NotificationDeviceChannel = 'android' | 'web' | 'inbox';
export type NotificationDeviceStatus = 'active' | 'revoked' | 'invalid' | 'stale';

export interface NotificationDeviceChannelFlags {
  inApp: boolean;
  push: boolean;
  email: boolean;
}

export interface NotificationDeviceRecord {
  id: string;
  userId?: string;
  deviceKey: string;
  deviceLabel: string;
  platform: NotificationDevicePlatform;
  channel: NotificationDeviceChannel;
  permissionState: NotificationPermissionState;
  pushToken?: string | null;
  channels: NotificationDeviceChannelFlags;
  status: NotificationDeviceStatus;
  invalidReason?: string | null;
  lastSeenAt: string;
  lastErrorAt?: string | null;
}

export interface NotificationChannelSummaryItem {
  id: 'in-app' | 'web-push' | 'android-push' | 'email';
  label: string;
  active: boolean;
  permissionLabel: string;
  reason: string;
}

export const DEVICE_STALE_WINDOW_MS = 45 * 24 * 60 * 60 * 1000;
export const DEVICE_KEY_STORAGE_PREFIX = 'stockmind_notification_device_key';

const INVALID_PUSH_ERROR_PATTERN =
  /\b(404|410)\b|not[_-]?registered|invalid[_-]?registration|mismatch[_-]?sender[_-]?id|unregistered|expired[_-]?subscription|revoked|invalid[_-]?token/i;

export function isInvalidPushErrorCode(value: unknown): boolean {
  if (typeof value === 'number') {
    return value === 404 || value === 410;
  }
  if (typeof value !== 'string') return false;
  return INVALID_PUSH_ERROR_PATTERN.test(value.trim());
}

export function normalizeDevicePlatform(value: unknown): NotificationDevicePlatform {
  if (value === 'android' || value === 'pwa') return value;
  return 'web';
}

export function normalizeDeviceChannel(value: unknown): NotificationDeviceChannel {
  if (value === 'android' || value === 'web') return value;
  return 'inbox';
}

export function normalizePermissionState(value: unknown): NotificationPermissionState {
  if (
    value === 'granted' ||
    value === 'denied' ||
    value === 'default' ||
    value === 'unsupported'
  ) {
    return value;
  }
  return 'default';
}

export function normalizeDeviceChannels(
  value: unknown,
): NotificationDeviceChannelFlags {
  const raw =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  return {
    inApp: raw.inApp !== false,
    push: Boolean(raw.push),
    email: Boolean(raw.email),
  };
}

/**
 * Evaluates whether a registered device remains valid or should be pruned automatically.
 */
export function evaluateDeviceValidity(
  device: NotificationDeviceRecord,
  nowMs: number = Date.now(),
): { valid: boolean; reason?: string; status: NotificationDeviceStatus } {
  if (!device.deviceKey || !device.deviceKey.trim() || !device.deviceLabel.trim()) {
    return { valid: false, reason: 'missing-identity', status: 'invalid' };
  }

  if (device.status === 'invalid' || device.status === 'revoked') {
    return {
      valid: false,
      reason: device.invalidReason || `device-${device.status}`,
      status: device.status,
    };
  }

  if (device.invalidReason && isInvalidPushErrorCode(device.invalidReason)) {
    return {
      valid: false,
      reason: device.invalidReason,
      status: 'invalid',
    };
  }

  if (device.pushToken !== undefined && device.pushToken !== null && !String(device.pushToken).trim()) {
    return { valid: false, reason: 'empty-push-token', status: 'invalid' };
  }

  // A standalone push-only registration whose browser/OS permission is explicitly denied cannot deliver push alerts.
  if (
    device.channel !== 'inbox' &&
    device.permissionState === 'denied' &&
    !device.channels.inApp &&
    !device.channels.email
  ) {
    return { valid: false, reason: 'permission-denied-no-fallback', status: 'revoked' };
  }

  const lastSeenMs = Date.parse(device.lastSeenAt);
  if (!Number.isFinite(lastSeenMs)) {
    return { valid: false, reason: 'invalid-last-seen', status: 'stale' };
  }
  if (nowMs - lastSeenMs > DEVICE_STALE_WINDOW_MS) {
    return { valid: false, reason: 'stale-device-registration', status: 'stale' };
  }

  return { valid: true, status: 'active' };
}

/**
 * Separates valid connected devices from invalid/expired/revoked records for auto-pruning.
 */
export function partitionAndPruneDevices(
  devices: readonly NotificationDeviceRecord[],
  nowMs: number = Date.now(),
): {
  activeDevices: NotificationDeviceRecord[];
  prunedDevices: Array<NotificationDeviceRecord & { pruneReason: string }>;
} {
  const seenKeys = new Set<string>();
  const activeDevices: NotificationDeviceRecord[] = [];
  const prunedDevices: Array<NotificationDeviceRecord & { pruneReason: string }> = [];

  for (const device of devices) {
    const verdict = evaluateDeviceValidity(device, nowMs);
    if (!verdict.valid) {
      prunedDevices.push({
        ...device,
        status: verdict.status,
        pruneReason: verdict.reason || 'invalid',
      });
      continue;
    }

    if (seenKeys.has(device.deviceKey)) {
      prunedDevices.push({
        ...device,
        status: 'stale',
        pruneReason: 'duplicate-device-key',
      });
      continue;
    }
    seenKeys.add(device.deviceKey);
    activeDevices.push({ ...device, status: 'active' });
  }

  return { activeDevices, prunedDevices };
}

export function buildActiveChannelSummary(input: {
  permissionState: NotificationPermissionState;
  prefs: Pick<PushNotificationPreferences, 'enabled' | 'inAppEnabled' | 'priceAlerts' | 'dailyReport'>;
  isAndroid: boolean;
  emailEnabled: boolean;
  devices?: readonly NotificationDeviceRecord[];
}): NotificationChannelSummaryItem[] {
  const { permissionState, prefs, isAndroid, emailEnabled, devices = [] } = input;
  const permissionGranted = permissionState === 'granted';
  const activeAndroidDevices = devices.filter(
    (d) => d.status === 'active' && d.platform === 'android',
  ).length;
  const activeWebDevices = devices.filter(
    (d) => d.status === 'active' && (d.platform === 'web' || d.platform === 'pwa'),
  ).length;

  return [
    {
      id: 'in-app',
      label: 'Uygulama İçi Bildirim Kutusu',
      active: prefs.inAppEnabled,
      permissionLabel: prefs.inAppEnabled ? 'Etkin' : 'Kapalı',
      reason: prefs.inAppEnabled
        ? 'Hesap genelinde tüm oturumlarda senkronize çalışır.'
        : 'Uygulama içi kutu tercihi kullanıcı tarafından kapatıldı.',
    },
    {
      id: 'android-push',
      label: 'Android Yerel Bildirim Kanalı',
      active: (isAndroid || activeAndroidDevices > 0) && prefs.enabled && permissionGranted,
      permissionLabel: !isAndroid && activeAndroidDevices === 0
        ? 'Bağlı Android Yok'
        : permissionGranted
          ? prefs.enabled
            ? 'İzinli ve Etkin'
            : 'Uygulama İçi Kapalı'
          : permissionState === 'denied'
            ? 'İzin Reddedildi'
            : 'İzin Bekliyor',
      reason:
        activeAndroidDevices > 0
          ? `${activeAndroidDevices} bağlı Android cihaz kayıtlı.`
          : isAndroid
            ? 'Bu cihaz Android köprüsü üzerinden bildirim alabilir.'
            : 'Hesaba bağlı aktif Android uygulama oturumu bulunmuyor.',
    },
    {
      id: 'web-push',
      label: 'Web / Tarayıcı Bildirim Kanalı',
      active: !isAndroid && prefs.enabled && permissionGranted,
      permissionLabel: permissionGranted
        ? prefs.enabled
          ? 'İzinli ve Etkin'
          : 'Ayarlardan Kapalı'
        : permissionState === 'denied'
          ? 'Tarayıcıda Engelli'
          : permissionState === 'unsupported'
            ? 'Desteklenmiyor'
            : 'İzin Bekliyor',
      reason:
        activeWebDevices > 0
          ? `${activeWebDevices} tarayıcı oturumu hesaba kayıtlı.`
          : 'Bu tarayıcı oturumu bildirim iznine göre anlık uyarı gösterebilir.',
    },
    {
      id: 'email',
      label: 'Günlük E-posta Bülteni',
      active: emailEnabled,
      permissionLabel: emailEnabled ? 'Etkin' : 'Kapalı',
      reason: emailEnabled
        ? 'Doğrulanmış hesap e-posta adresinize gönderilir.'
        : 'Hesap ayarlarından devre dışı bırakıldı.',
    },
  ];
}

export function inferBrowserDeviceLabel(userAgent: string, isAndroid: boolean): string {
  if (isAndroid) return 'StockMind Android Uygulama';
  const ua = userAgent || '';
  const browser = /Edg\//i.test(ua)
    ? 'Edge'
    : /Chrome\//i.test(ua) && !/Edg\//i.test(ua)
      ? 'Chrome'
      : /Safari\//i.test(ua) && !/Chrome\//i.test(ua)
        ? 'Safari'
        : /Firefox\//i.test(ua)
          ? 'Firefox'
          : 'Tarayıcı';
  const os = /iPhone|iPad|iPod/i.test(ua)
    ? 'iOS'
    : /Android/i.test(ua)
      ? 'Android Web'
      : /Mac OS X|Macintosh/i.test(ua)
        ? 'macOS'
        : /Windows/i.test(ua)
          ? 'Windows'
          : /Linux/i.test(ua)
            ? 'Linux'
            : 'Cihaz';
  return `${browser} (${os})`;
}

export function getOrCreateCurrentDeviceKey(userId?: string | null, storage?: Storage): string {
  const scope = userId && userId !== 'guest' ? userId : 'guest';
  const keyName = `${DEVICE_KEY_STORAGE_PREFIX}_${scope}`;
  const targetStorage =
    storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  if (targetStorage) {
    try {
      const existing = targetStorage.getItem(keyName);
      if (existing && existing.trim().length >= 8) {
        return existing.trim();
      }
      const generated =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? `dev-${crypto.randomUUID()}`
          : `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      targetStorage.setItem(keyName, generated);
      return generated;
    } catch {
      // Ignore storage access errors
    }
  }
  return `dev-${scope}-session`;
}

export function detectDevicePlatform(isAndroid: boolean): NotificationDevicePlatform {
  if (isAndroid) return 'android';
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    try {
      if (window.matchMedia('(display-mode: standalone)').matches) {
        return 'pwa';
      }
    } catch {
      // Ignore matchMedia errors
    }
  }
  return 'web';
}

export async function fetchAndSyncNotificationDevices(input?: {
  userId?: string | null;
  permissionState?: NotificationPermissionState;
  prefs?: Pick<PushNotificationPreferences, 'enabled' | 'inAppEnabled'>;
  isAndroid?: boolean;
  emailEnabled?: boolean;
  pushToken?: string | null;
  registerCurrent?: boolean;
}): Promise<{
  devices: NotificationDeviceRecord[];
  prunedCount: number;
}> {
  if (!input?.userId) {
    return { devices: [], prunedCount: 0 };
  }
  try {
    if (input.registerCurrent && input.prefs && input.permissionState) {
      const isAndroid = Boolean(input.isAndroid);
      const platform = detectDevicePlatform(isAndroid);
      const deviceKey = getOrCreateCurrentDeviceKey(input.userId);
      const userAgent =
        typeof navigator !== 'undefined' && navigator.userAgent ? navigator.userAgent : '';
      const res = await fetch('/api/notifications/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceKey,
          deviceLabel: inferBrowserDeviceLabel(userAgent, isAndroid),
          platform,
          channel: isAndroid
            ? 'android'
            : input.permissionState === 'granted' && input.prefs.enabled
              ? 'web'
              : 'inbox',
          permissionState: input.permissionState,
          pushToken: input.pushToken ?? null,
          channels: {
            inApp: input.prefs.inAppEnabled,
            push: input.prefs.enabled && input.permissionState === 'granted',
            email: Boolean(input.emailEnabled),
          },
        }),
      });
      if (res.ok) {
        const json = await res.json();
        return {
          devices: Array.isArray(json?.devices) ? json.devices : [],
          prunedCount: Number(json?.prunedCount) || 0,
        };
      }
    }

    const res = await fetch('/api/notifications/devices', {
      method: 'GET',
      cache: 'no-store',
    });
    if (!res.ok) return { devices: [], prunedCount: 0 };
    const json = await res.json();
    return {
      devices: Array.isArray(json?.devices) ? json.devices : [],
      prunedCount: Number(json?.prunedCount) || 0,
    };
  } catch {
    return { devices: [], prunedCount: 0 };
  }
}

export async function removeNotificationDevice(deviceId: string): Promise<boolean> {
  if (!deviceId) return false;
  try {
    const res = await fetch(
      `/api/notifications/devices?id=${encodeURIComponent(deviceId)}`,
      { method: 'DELETE' },
    );
    return res.ok;
  } catch {
    return false;
  }
}
