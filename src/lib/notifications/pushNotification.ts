/**
 * StockMind Push & Native Phone Notification Service
 * Manages mobile push notifications via StockMind Android Bridge and Web Notifications API.
 */

export interface PushNotificationPreferences {
  enabled: boolean;
  priceAlerts: boolean;
  dailyReport: boolean;
  portfolioMoves: boolean;
  marketNews: boolean;
}

export const DEFAULT_PUSH_PREFERENCES: PushNotificationPreferences = {
  enabled: true,
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

/**
 * Sends a native phone notification (or web notification if on browser)
 */
export function sendPushNotification(title: string, message: string, route: string = '/dashboard'): boolean {
  if (typeof window === 'undefined') return false;

  const prefs = loadPushPreferences();
  if (!prefs.enabled) {
    console.log('Push notifications are disabled in settings.');
    return false;
  }

  let sent = false;

  // 1. Android Native Push Notification
  const bridge = (window as any).StockMindAndroid;
  if (bridge && typeof bridge.sendNativeNotification === 'function') {
    try {
      bridge.sendNativeNotification(title, message, route);
      sent = true;
    } catch (err) {
      console.error('Failed to send native notification:', err);
    }
  }

  // 2. Browser Web Notification fallback
  if (!sent && 'Notification' in window && Notification.permission === 'granted') {
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

  // 3. Save to In-App Notification list (Header bell dropdown)
  try {
    const raw = localStorage.getItem('stockmind_notifications');
    const list = raw ? JSON.parse(raw) : [];
    list.unshift({
      id: 'push-' + Date.now(),
      title,
      description: message,
      timestamp: 'Az önce',
      read: false,
      category: 'price',
      route,
    });
    localStorage.setItem('stockmind_notifications', JSON.stringify(list.slice(0, 30)));
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
