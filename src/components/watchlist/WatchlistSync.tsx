'use client';
import { useEffect } from 'react';
import { useWatchlistStore } from '@/store/useWatchlistStore';
import { createClient } from '@/lib/supabase/client';
import { evaluateRefreshPolicy, markSessionInvalid } from '@/lib/market/refreshPolicy';

export function WatchlistSync() {
  const userId = useWatchlistStore((s) => s.currentUserId);
  useEffect(() => {
    if (!userId || userId === 'guest') {
      markSessionInvalid(!userId);
      return;
    }
    markSessionInvalid(false);
    const client = createClient();
    let timer: ReturnType<typeof setTimeout>;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    let lastSyncAtMs: number | null = null;

    const scheduleNext = (delayMs: number | null) => {
      if (pollTimer) {
        clearTimeout(pollTimer);
        pollTimer = null;
      }
      if (delayMs != null) {
        pollTimer = setTimeout(() => {
          reload('interval');
        }, delayMs);
      }
    };

    const reload = (trigger: 'interval' | 'visibility' | 'event' = 'event') => {
      clearTimeout(timer);
      const decision = evaluateRefreshPolicy({
        surface: 'watchlist_sync',
        trigger: trigger === 'event' ? 'manual' : trigger,
        isDocumentHidden: typeof document !== 'undefined' ? document.hidden : false,
        sessionValid: Boolean(userId && userId !== 'guest'),
        baseIntervalMs: 30_000,
        closedIntervalMs: 180_000,
        lastFetchAtMs: lastSyncAtMs,
      });
      scheduleNext(decision.nextDelayMs);
      if (!decision.shouldFetch) return;
      timer = setTimeout(() => {
        if (!document.hidden) {
          lastSyncAtMs = Date.now();
          void useWatchlistStore.getState().refreshFromServer();
        }
      }, 250);
    };
    // DELETE cannot be filtered by Postgres Changes; RLS restricts delivered rows.
    const channel = client.channel(`watchlist-${userId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'watchlist_items' }, () => reload('event')).subscribe();
    scheduleNext(30_000);
    const onOnline = () => reload('event');
    const onVis = () => reload('visibility');
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVis);
    return () => { clearTimeout(timer); if (pollTimer) clearTimeout(pollTimer); window.removeEventListener('online', onOnline); document.removeEventListener('visibilitychange', onVis); void client.removeChannel(channel); };
  }, [userId]);
  return null;
}
