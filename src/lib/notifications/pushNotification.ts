import { readInbox, saveInbox } from './inbox';
/**
 * StockMind Push & Native Phone Notification Service
 * Manages mobile push notifications via StockMind Android Bridge and Web Notifications API.
 */

export interface PushNotificationPreferences {
  enabled: boolean;
  inAppEnabled: boolean;
  priceAlerts: boolean;
  dailyReport: boolean;
  portfolioMoves: boolean;
  marketNews: boolean;
}

export const DEFAULT_PUSH_PREFERENCES: PushNotificationPreferences = {
  enabled: true,
  inAppEnabled: true,
  priceAlerts: true,
  dailyReport: true,
  portfolioMoves: true,
  marketNews: false,
};

const STORAGE_KEY = 'stockmind_push_preferences';
const LAST_DELIVERY_KEY = 'stockmind_push_delivery_status';

export type NotificationPermissionState = 'granted' | 'denied' | 'default' | 'unsupported';
export type NotificationDeliveryChannel = 'android' | 'web' | 'none';
export type NotificationChannelOutcome = 'delivered' | 'failed' | 'permission-denied' | 'disabled' | 'cooldown';

export interface PushDeliveryDiagnostic {
  permissionState: NotificationPermissionState;
  channel: NotificationDeliveryChannel;
  channelOutcome: NotificationChannelOutcome;
  delivered: boolean;
  inboxSaved: boolean;
  reason: string;
  testedAt: string;
  isTest: boolean;
}

/**
 * Checks if the current environment is running inside the StockMind Android APK WebView
 */
export function isAndroidApp(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean((window as any).StockMindAndroid);
}

/**
 * Returns the explicit notification permission status independently of delivery attempts.
 */
export function getNotificationPermissionState(): NotificationPermissionState {
  if (typeof window === 'undefined') return 'unsupported';

  const bridge = (window as any).StockMindAndroid;
  if (bridge && typeof bridge.hasNotificationPermission === 'function') {
    try {
      return bridge.hasNotificationPermission() ? 'granted' : 'denied';
    } catch {
      return 'denied';
    }
  }

  if ('Notification' in window) {
    const perm = Notification.permission;
    if (perm === 'granted' || perm === 'denied' || perm === 'default') {
      return perm;
    }
  }

  return 'unsupported';
}

/**
 * Checks if phone notification permission is granted
 */
export function hasNotificationPermission(): boolean {
  return getNotificationPermissionState() === 'granted';
}

/**
 * Requests phone notification permission from user
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  // Request Android Native Permission
  const bridge = (window as any).StockMindAndroid;
  if (bridge && typeof bridge.requestNotificationPermission === 'function') {
    try {
      bridge.requestNotificationPermission();
      return hasNotificationPermission();
    } catch (e) {
      console.warn('Native permission request error:', e);
    }
  }

  // Request Browser Web Notification Permission
  if ('Notification' in window) {
    try {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch (e) {
      console.warn('Web notification permission request error:', e);
    }
  }

  return false;
}

/**
 * Checks if the Android app is exempt from OS battery optimizations (Doze mode)
 */
export function isBatteryOptimizationIgnored(): boolean {
  if (typeof window === 'undefined') return true;
  const bridge = (window as any).StockMindAndroid;
  if (bridge && typeof bridge.isBatteryOptimizationIgnored === 'function') {
    try {
      return Boolean(bridge.isBatteryOptimizationIgnored());
    } catch {
      return true;
    }
  }
  return true;
}

/**
 * Prompts user to disable battery restrictions for StockMind so background checks work when closed
 */
export function requestBatteryOptimizationExemption(): void {
  if (typeof window === 'undefined') return;
  const bridge = (window as any).StockMindAndroid;
  if (bridge && typeof bridge.requestBatteryOptimizationExemption === 'function') {
    try {
      bridge.requestBatteryOptimizationExemption();
    } catch (e) {
      console.warn('Native battery optimization exemption error:', e);
    }
  }
}

/**
 * Plays the custom StockMind notification sound (native bridge or HTML5 Audio)
 */
export function playNotificationSound(): void {
  if (typeof window === 'undefined') return;

  const bridge = (window as any).StockMindAndroid;
  if (bridge && typeof bridge.playNotificationSound === 'function') {
    try {
      bridge.playNotificationSound();
      return;
    } catch (e) {
      console.warn('Native sound playback error:', e);
    }
  }

  try {
    const audio = new Audio('/sounds/notification.mp3');
    audio.play().catch(() => {
      // Audio playback might be restricted by browser until user gesture
    });
  } catch (e) {
    console.warn('Web audio playback error:', e);
  }
}

// localStorage-backed cooldown cache to suppress duplicate/spam notifications
// (survives Android WebView restarts, unlike an in-memory Map)
const COOLDOWN_STORAGE_KEY = 'stockmind_notif_cooldowns';
const COOLDOWN_DURATION_MS = 30 * 60 * 1000; // 30 minutes

function loadCooldownCache(): Record<string, number> {
  try {
    const raw = localStorage.getItem(COOLDOWN_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  } catch { /* ignore */ }
  return {};
}

function saveCooldownCache(cache: Record<string, number>): void {
  try {
    // Prune expired entries before saving to keep storage lean
    const now = Date.now();
    const pruned: Record<string, number> = {};
    for (const [key, ts] of Object.entries(cache)) {
      if (now - ts < COOLDOWN_DURATION_MS) pruned[key] = ts;
    }
    localStorage.setItem(COOLDOWN_STORAGE_KEY, JSON.stringify(pruned));
  } catch { /* ignore */ }
}

export function loadLastPushDeliveryDiagnostic(): PushDeliveryDiagnostic | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LAST_DELIVERY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.permissionState === 'string' && typeof parsed.channelOutcome === 'string') {
      return parsed as PushDeliveryDiagnostic;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function saveLastPushDeliveryDiagnostic(diagnostic: PushDeliveryDiagnostic): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LAST_DELIVERY_KEY, JSON.stringify(diagnostic));
  } catch {
    /* ignore */
  }
}

/**
 * Sends a notification while separating OS/browser permission state from channel delivery outcome.
 */
export function sendPushNotificationWithResult(
  title: string,
  message: string,
  route: string = '/dashboard',
  test = false
): PushDeliveryDiagnostic {
  const testedAt = new Date().toISOString();
  const permissionState = getNotificationPermissionState();

  if (typeof window === 'undefined') {
    return {
      permissionState: 'unsupported',
      channel: 'none',
      channelOutcome: 'permission-denied',
      delivered: false,
      inboxSaved: false,
      reason: 'Sunucu ortamında tarayıcı/cihaz bildirim kanalı kullanılamıyor.',
      testedAt,
      isTest: test,
    };
  }

  const prefs = loadPushPreferences();

  // Anti-spam cooldown: suppress identical alerts sent within the cooldown window
  const cooldownCache = loadCooldownCache();
  const notifFingerprint = `${title}::${message}`;
  const lastSent = cooldownCache[notifFingerprint] || 0;
  if (!test && Date.now() - lastSent < COOLDOWN_DURATION_MS) {
    return {
      permissionState,
      channel: 'none',
      channelOutcome: 'cooldown',
      delivered: false,
      inboxSaved: false,
      reason: 'Aynı bildirim bekleme süresi içinde olduğu için atlandı.',
      testedAt,
      isTest: false,
    };
  }

  let channel: NotificationDeliveryChannel = 'none';
  let channelOutcome: NotificationChannelOutcome = 'permission-denied';
  let sent = false;
  let reason = 'Bildirim izni kapalı olduğu için cihaz kanalına gönderilmedi.';

  if (permissionState === 'granted') {
    if (!prefs.enabled) {
      channel = 'none';
      channelOutcome = 'disabled';
      reason = 'Bildirim izni açık ancak uygulama içi push bildirim ayarı kapalı.';
    } else {
      const bridge = (window as any).StockMindAndroid;
      if (bridge && typeof bridge.sendNativeNotification === 'function') {
        channel = 'android';
        try {
          sent = bridge.sendNativeNotification(title, message, route) !== false;
          channelOutcome = sent ? 'delivered' : 'failed';
          reason = sent
            ? 'Android yerel bildirim kanalı teslimatı onayladı.'
            : 'Android bildirim izni açık ancak yerel bildirim kanalı teslimatı başarısız oldu.';
        } catch (err) {
          console.error('Failed to send native notification:', err);
          sent = false;
          channelOutcome = 'failed';
          reason = 'Android bildirim izni açık ancak yerel kanal hatası oluştu.';
        }
      } else if ('Notification' in window) {
        channel = 'web';
        try {
          const notif = new Notification(title, {
            body: message,
            icon: '/icon-192.png',
            badge: '/icon-192.png',
          });
          notif.onclick = () => {
            window.focus();
            if (route) window.location.href = route;
          };
          playNotificationSound();
          sent = true;
          channelOutcome = 'delivered';
          reason = 'Tarayıcı bildirim kanalı teslimatı onayladı.';
        } catch (e) {
          console.warn('Browser notification error:', e);
          sent = false;
          channelOutcome = 'failed';
          reason = 'Tarayıcı bildirim izni açık ancak bildirim gösterimi başarısız oldu.';
        }
      } else {
        channel = 'none';
        channelOutcome = 'failed';
        reason = 'Bildirim izni açık görünüyor ancak aktif teslimat kanalı bulunamadı.';
      }
    }
  } else {
    channel = 'none';
    channelOutcome = 'permission-denied';
    reason =
      permissionState === 'unsupported'
        ? 'Bu ortamda cihaz bildirim kanalı desteklenmiyor.'
        : 'Cihaz bildirim izni kapalı olduğu için test/push bildirimi gönderilmedi.';
  }

  // 3. The inbox is independent of device push permission and preference.
  let saved = false;
  if (prefs.inAppEnabled) {
    try {
      const list = readInbox();
      list.unshift({
        id: 'push-' + Date.now(),
        title,
        description: message,
        time: new Date().toLocaleString('tr-TR'),
        read: false,
        category: 'market',
        link: route,
      });
      saved = saveInbox(list);
    } catch (err) {
      console.warn('Could not save to local notification store', err);
    }
  }

  if (!test && (sent || saved)) {
    cooldownCache[notifFingerprint] = Date.now();
    saveCooldownCache(cooldownCache);
  }

  const diagnostic: PushDeliveryDiagnostic = {
    permissionState,
    channel,
    channelOutcome,
    delivered: sent,
    inboxSaved: saved,
    reason,
    testedAt,
    isTest: test,
  };

  if (test || permissionState === 'granted') {
    saveLastPushDeliveryDiagnostic(diagnostic);
  }

  return diagnostic;
}

/**
 * Sends a native phone notification (or web notification if on browser)
 */
export function sendPushNotification(title: string, message: string, route: string = '/dashboard', test = false): boolean {
  const result = sendPushNotificationWithResult(title, message, route, test);
  return test ? result.delivered : result.delivered || result.inboxSaved;
}

/**
 * Load push notification preferences from local storage and native bridge
 */
export function loadPushPreferences(): PushNotificationPreferences {
  if (typeof window === 'undefined') return DEFAULT_PUSH_PREFERENCES;

  try {
    const bridge = (window as any).StockMindAndroid;
    if (bridge && typeof bridge.getPushSettings === 'function') {
      const rawNative = bridge.getPushSettings();
      if (rawNative && rawNative !== '{}') {
        return { ...DEFAULT_PUSH_PREFERENCES, ...JSON.parse(rawNative) };
      }
    }

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return { ...DEFAULT_PUSH_PREFERENCES, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.warn('Error reading push preferences:', e);
  }

  return DEFAULT_PUSH_PREFERENCES;
}

/**
 * Save push notification preferences
 */
export function savePushPreferences(prefs: PushNotificationPreferences): void {
  if (typeof window === 'undefined') return;

  try {
    const jsonStr = JSON.stringify(prefs);
    localStorage.setItem(STORAGE_KEY, jsonStr);

    const bridge = (window as any).StockMindAndroid;
    if (bridge && typeof bridge.savePushSettings === 'function') {
      bridge.savePushSettings(jsonStr);
    }
  } catch (e) {
    console.warn('Error saving push preferences:', e);
  }
}
