'use client';
import { useEffect } from 'react';
import { useWatchlistStore } from '@/store/useWatchlistStore';
import { createClient } from '@/lib/supabase/client';

export function WatchlistSync() {
  const userId = useWatchlistStore((s) => s.currentUserId);
  useEffect(() => {
    if (!userId || userId === 'guest') return;
    const client = createClient();
    let timer: ReturnType<typeof setTimeout>;
    const reload = () => {
      clearTimeout(timer);
      timer = setTimeout(() => { if (!document.hidden) void useWatchlistStore.getState().refreshFromServer(); }, 250);
    };
    // DELETE cannot be filtered by Postgres Changes; RLS restricts delivered rows.
    const channel = client.channel(`watchlist-${userId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'watchlist_items' }, reload).subscribe();
    const poll = setInterval(reload, 30_000);
    window.addEventListener('online', reload);
    document.addEventListener('visibilitychange', reload);
    return () => { clearTimeout(timer); clearInterval(poll); window.removeEventListener('online', reload); document.removeEventListener('visibilitychange', reload); void client.removeChannel(channel); };
  }, [userId]);
  return null;
}
