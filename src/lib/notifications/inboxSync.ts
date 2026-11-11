import {
  readInbox,
  saveInbox,
  sanitizeInboxItems,
  type InboxItem,
} from './inbox';

export interface AccountPushPreferences {
  enabled: boolean;
  inAppEnabled: boolean;
  priceAlerts: boolean;
  dailyReport: boolean;
  portfolioMoves: boolean;
  marketNews: boolean;
}

export const DEFAULT_ACCOUNT_PUSH_PREFERENCES: AccountPushPreferences = {
  enabled: true,
  inAppEnabled: true,
  priceAlerts: true,
  dailyReport: true,
  portfolioMoves: true,
  marketNews: false,
};

export function sanitizePushPreferences(
  value: unknown,
  fallback: AccountPushPreferences = DEFAULT_ACCOUNT_PUSH_PREFERENCES,
): AccountPushPreferences {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...fallback };
  }
  const raw = value as Record<string, unknown>;
  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : fallback.enabled,
    inAppEnabled: typeof raw.inAppEnabled === 'boolean' ? raw.inAppEnabled : fallback.inAppEnabled,
    priceAlerts: typeof raw.priceAlerts === 'boolean' ? raw.priceAlerts : fallback.priceAlerts,
    dailyReport: typeof raw.dailyReport === 'boolean' ? raw.dailyReport : fallback.dailyReport,
    portfolioMoves:
      typeof raw.portfolioMoves === 'boolean' ? raw.portfolioMoves : fallback.portfolioMoves,
    marketNews: typeof raw.marketNews === 'boolean' ? raw.marketNews : fallback.marketNews,
  };
}

/**
 * Merges inbox records across devices while keeping read/archived state consistent
 * and preventing stale devices from reviving archived or read notifications.
 */
export function mergeAccountInboxItems(
  primaryItems: readonly InboxItem[],
  secondaryItems: readonly InboxItem[],
): InboxItem[] {
  const byId = new Map<string, InboxItem>();

  for (const item of [...secondaryItems, ...primaryItems]) {
    const existing = byId.get(item.id);
    if (!existing) {
      byId.set(item.id, { ...item });
      continue;
    }
    const existingTs = existing.updatedAt ? Date.parse(existing.updatedAt) : 0;
    const incomingTs = item.updatedAt ? Date.parse(item.updatedAt) : 0;
    const newer = incomingTs >= existingTs ? item : existing;
    byId.set(item.id, {
      ...existing,
      ...newer,
      read: Boolean(existing.read || item.read),
      ...(existing.archived || item.archived ? { archived: true } : {}),
    });
  }

  return Array.from(byId.values()).slice(0, 200);
}

export async function pullNotificationStateFromServer(
  userId: string,
): Promise<{ inbox: InboxItem[]; preferences?: AccountPushPreferences } | null> {
  if (!userId || userId === 'guest') return null;
  try {
    const res = await fetch('/api/notifications/sync', {
      method: 'GET',
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = await res.json();
    const remoteInbox = sanitizeInboxItems(json?.inbox);
    const localInbox = readInbox(userId);
    const merged = mergeAccountInboxItems(remoteInbox, localInbox);
    saveInbox(merged, userId);

    const prefs = json?.preferences
      ? sanitizePushPreferences(json.preferences)
      : undefined;
    return { inbox: merged, preferences: prefs };
  } catch {
    return null;
  }
}

export async function pushNotificationStateToServer(params: {
  userId?: string | null;
  inbox?: InboxItem[];
  preferences?: AccountPushPreferences;
}): Promise<boolean> {
  if (!params.userId || params.userId === 'guest') return false;
  try {
    const res = await fetch('/api/notifications/sync', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(params.inbox ? { inbox: sanitizeInboxItems(params.inbox) } : {}),
        ...(params.preferences
          ? { preferences: sanitizePushPreferences(params.preferences) }
          : {}),
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
