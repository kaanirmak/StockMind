export const SESSION_BOUNDARY_EVENT = 'stockmind:session-boundary';
export const AI_CHAT_STORAGE_KEY_PREFIX = 'stockmind_ai_chat_sessions_v2';

export function resolveSessionScopeKey(userId?: string | null): string {
  const normalized = typeof userId === 'string' ? userId.trim() : '';
  return normalized && normalized !== 'guest' ? normalized : 'guest';
}

export function getPortfolioStorageKey(userId?: string | null): string {
  const scope = resolveSessionScopeKey(userId);
  return scope === 'guest'
    ? 'stockmind_portfolio_state_guest'
    : `stockmind_portfolio_state_user_${scope}`;
}

export function getAiChatStorageKey(userId?: string | null): string {
  const scope = resolveSessionScopeKey(userId);
  return scope === 'guest'
    ? AI_CHAT_STORAGE_KEY_PREFIX
    : `${AI_CHAT_STORAGE_KEY_PREFIX}_${scope}`;
}

export function shouldResetSessionBoundary(
  prevUserId: string | null | undefined,
  nextUserId: string | null,
  event?: string
): boolean {
  if (event === 'SIGNED_OUT') return true;
  if (prevUserId === undefined) return false;
  return prevUserId !== nextUserId;
}

export function dispatchSessionBoundaryEvent(
  detail: {
    previousUserId: string | null;
    nextUserId: string | null;
    reason: 'signout' | 'account_switch' | 'guest_entry';
  },
  eventTarget?: Pick<Window, 'dispatchEvent'> | null
): void {
  const target =
    eventTarget !== undefined
      ? eventTarget
      : typeof window !== 'undefined'
      ? window
      : null;
  if (!target) return;
  try {
    const ev =
      typeof CustomEvent !== 'undefined'
        ? new CustomEvent(SESSION_BOUNDARY_EVENT, { detail })
        : ({ type: SESSION_BOUNDARY_EVENT, detail } as unknown as Event);
    target.dispatchEvent(ev);
  } catch {
    // Ignore event dispatch failures
  }
}

export function clearSignOutGuestArtifacts(
  storage?: Pick<Storage, 'removeItem'> | null
): void {
  const store =
    storage !== undefined
      ? storage
      : typeof window !== 'undefined'
      ? window.localStorage
      : null;
  if (store) {
    try {
      store.removeItem('stockmind_guest_profile');
      store.removeItem('stockmind_active_notification_user');
    } catch {
      // Ignore storage access errors
    }
  }
  if (typeof document !== 'undefined') {
    document.cookie = 'stockmind_guest=; path=/; max-age=0';
  }
}
