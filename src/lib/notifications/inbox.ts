export interface InboxItem {
  id: string;
  title: string;
  description: string;
  time: string;
  read: boolean;
  archived?: boolean;
  category: 'portfolio' | 'market' | 'ai' | 'system';
  link?: string;
  updatedAt?: string;
}

export const INBOX_KEY = 'stockmind_notifications';
export const ACTIVE_NOTIFICATION_USER_KEY = 'stockmind_active_notification_user';

let activeMemoryUserId: string | null | undefined = undefined;

export function getInboxStorageKey(userId?: string | null): string {
  const normalized = typeof userId === 'string' ? userId.trim() : '';
  if (normalized && normalized !== 'guest') {
    return `${INBOX_KEY}_user_${normalized}`;
  }
  return INBOX_KEY;
}

export function getActiveNotificationUserId(storage?: Storage): string | null {
  if (activeMemoryUserId !== undefined) return activeMemoryUserId;
  const store = resolveStorage(storage);
  if (store) {
    try {
      const saved = store.getItem(ACTIVE_NOTIFICATION_USER_KEY);
      if (saved && saved !== 'guest' && !saved.startsWith('[')) {
        return saved;
      }
    } catch {
      // Ignore storage access errors
    }
  }
  return null;
}

export function setActiveNotificationUser(userId: string | null, storage?: Storage): void {
  activeMemoryUserId = userId && userId !== 'guest' ? userId : null;
  const store = resolveStorage(storage);
  if (store) {
    try {
      if (activeMemoryUserId) {
        store.setItem(ACTIVE_NOTIFICATION_USER_KEY, activeMemoryUserId);
      } else {
        store.removeItem?.(ACTIVE_NOTIFICATION_USER_KEY);
      }
    } catch {
      // Ignore storage access errors
    }
  }
  dispatchInboxUpdate();
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    try {
      window.dispatchEvent(new Event('stockmind:push-prefs'));
    } catch {
      // Ignore event errors
    }
  }
}

function resolveStorage(storage?: Storage): Storage | null {
  if (storage) return storage;
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    return null;
  }
  return null;
}

function dispatchInboxUpdate(): void {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof Event !== 'undefined') {
    try {
      window.dispatchEvent(new Event('stockmind:inbox'));
    } catch {
      // Ignore event errors
    }
  }
}

export function sanitizeInboxItems(value: unknown): InboxItem[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const clean: InboxItem[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const n = raw as Record<string, unknown>;
    if (typeof n.id !== 'string' || !n.id.trim() || seen.has(n.id)) continue;
    seen.add(n.id);
    const rawCat = n.category === 'price' ? 'market' : n.category;
    const category: InboxItem['category'] =
      rawCat === 'portfolio' || rawCat === 'market' || rawCat === 'ai' || rawCat === 'system'
        ? rawCat
        : 'system';
    clean.push({
      id: n.id,
      title: typeof n.title === 'string' ? n.title.slice(0, 180) : '',
      description: typeof n.description === 'string' ? n.description.slice(0, 600) : '',
      time: typeof n.time === 'string' ? n.time : typeof n.timestamp === 'string' ? n.timestamp : '',
      read: Boolean(n.read),
      ...(n.archived ? { archived: true } : {}),
      category,
      ...(safeInboxLink(n.link || n.route) ? { link: safeInboxLink(n.link || n.route) } : {}),
      ...(typeof n.updatedAt === 'string' ? { updatedAt: n.updatedAt } : {}),
    });
    if (clean.length >= 200) break;
  }
  return clean;
}

export function readInbox(userId?: string | null, storage?: Storage): InboxItem[] {
  const store = resolveStorage(storage);
  if (!store) return [];
  try {
    const resolvedUserId = userId !== undefined ? userId : getActiveNotificationUserId(store);
    const key = getInboxStorageKey(resolvedUserId);
    const value = JSON.parse(store.getItem(key) || '[]');
    return sanitizeInboxItems(value);
  } catch {
    return [];
  }
}

export function safeInboxLink(value: unknown): string | undefined {
  return typeof value === 'string' &&
    /^\/(stocks\/|funds\/|portfolio|watchlist|alerts|dashboard|piyasalar|news|settings|reports|ai-assistant|quant-lab|widgets)/.test(
      value,
    ) &&
    !value.includes('\\')
    ? value
    : undefined;
}

export function saveInbox(items: InboxItem[], userId?: string | null, storage?: Storage) {
  const store = resolveStorage(storage);
  if (!store) return false;
  try {
    const resolvedUserId = userId !== undefined ? userId : getActiveNotificationUserId(store);
    const key = getInboxStorageKey(resolvedUserId);
    store.setItem(key, JSON.stringify(sanitizeInboxItems(items)));
  } catch {
    return false;
  }
  dispatchInboxUpdate();
  return true;
}
