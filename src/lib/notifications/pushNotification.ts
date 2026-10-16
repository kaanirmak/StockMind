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

/**
 * Checks if the current environment is running inside the StockMind Android APK WebView
 */
export function isAndroidApp(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean((window as any).StockMindAndroid);
}

/**
 * Checks if phone notification permission is granted
 */
export function hasNotificationPermission(): boolean {
  if (typeof window === 'undefined') return false;

  // Check Android Native Bridge
  const bridge = (window as any).StockMindAndroid;
  if (bridge && typeof bridge.hasNotificationPermission === 'function') {
    try {
      return Boolean(bridge.hasNotificationPermission());
    } catch {
      return false;
    }
  }

  // Check Web Notification API
  if ('Notification' in window) {
    return Notification.permission === 'granted';
  }

  return false;
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
      return true;
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
    if (raw) return JSON.parse(raw);
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

/**
 * Sends a native phone notification (or web notification if on browser)
 */
export function sendPushNotification(title: string, message: string, route: string = '/dashboard'): boolean {
  if (typeof window === 'undefined') return false;

  const prefs = loadPushPreferences();
  if (!prefs.enabled && !prefs.inAppEnabled) return false;

  // Anti-spam cooldown: suppress identical alerts sent within the cooldown window
  const cooldownCache = loadCooldownCache();
  const notifFingerprint = `${title}::${message}`;
  const lastSent = cooldownCache[notifFingerprint] || 0;
  if (Date.now() - lastSent < COOLDOWN_DURATION_MS) {
    return false;
  }
  cooldownCache[notifFingerprint] = Date.now();
  saveCooldownCache(cooldownCache);

  let sent = false;

  // 1. Android Native Push Notification
  const bridge = (window as any).StockMindAndroid;
  if (prefs.enabled && bridge && typeof bridge.sendNativeNotification === 'function') {
    try {
      bridge.sendNativeNotification(title, message, route);
      sent = true;
    } catch (err) {
      console.error('Failed to send native notification:', err);
    }
  }

  // 2. Browser Web Notification fallback
  if (prefs.enabled && !sent && 'Notification' in window && Notification.permission === 'granted') {
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
    } catch (e) {
      console.warn('Browser notification error:', e);
    }
  }

  // 3. The inbox is independent of device push permission and preference.
  if (prefs.inAppEnabled) try {
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
    saveInbox(list);
    // Dispatch storage event to immediately update Header badge
    window.dispatchEvent(new Event('storage'));
  } catch (err) {
    console.warn('Could not save to local notification store', err);
  }

  return sent;
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
