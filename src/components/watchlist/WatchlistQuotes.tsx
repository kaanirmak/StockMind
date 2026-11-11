'use client';
import { useEffect } from 'react';
import { useWatchlistStore } from '@/store/useWatchlistStore';
import { marketJson } from '@/lib/api/clientCache';
import { buildScopedQuoteRequests } from '@/lib/market/symbolQuery';
import { evaluateRefreshPolicy } from '@/lib/market/refreshPolicy';

export function WatchlistQuotes() {
  useEffect(() => {
    let alive = true;
    let running = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastFetchAtMs: number | null = null;

    const scheduleNext = (delayMs: number | null) => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (delayMs != null && alive) {
        timer = setTimeout(() => {
          void update('interval');
        }, delayMs);
      }
    };

    const update = async (trigger: 'initial' | 'interval' | 'visibility' = 'interval') => {
      const { items, currentUserId } = useWatchlistStore.getState();
      if (running) return;
      const exchanges = items.map((i) => i.exchange || (i.assetType === 'fund' ? 'TEFAS' : 'BIST'));
      const decision = evaluateRefreshPolicy({
        surface: 'watchlist_quotes',
        trigger,
        isDocumentHidden: typeof document !== 'undefined' ? document.hidden : false,
        sessionValid: items.length > 0 && Boolean(currentUserId),
        exchanges,
        baseIntervalMs: 60_000,
        closedIntervalMs: 300_000,
        lastFetchAtMs,
      });
      scheduleNext(decision.nextDelayMs);
      if (!decision.shouldFetch || !items.length) return;

      const requests = buildScopedQuoteRequests(items, { liveOnly: true });
      if (!requests.length) return;
      running = true;
      lastFetchAtMs = Date.now();
      try {
        type Quote = { symbol?: string; code?: string; price: number; changePercent?: number; dailyReturn?: number };
        const results = await Promise.allSettled(requests.map((req) => marketJson<{ data: Quote[] }>(req.url, 60_000)));
        if (!alive || useWatchlistStore.getState().currentUserId !== currentUserId) return;
        const quotes = new Map<string, Quote>();
        results.forEach((result, index) => {
          if (result.status !== 'fulfilled' || !Array.isArray(result.value.data)) return;
          const type = requests[index].kind;
          result.value.data.forEach((q) => quotes.set(`${type}:${String(q.symbol || q.code || '').toUpperCase()}`, q));
        });
        useWatchlistStore.setState((state) => ({ items: state.items.map((item) => {
          const quote = quotes.get(`${item.assetType}:${item.symbol.toUpperCase()}`);
          return quote && quote.price > 0 ? { ...item, price: quote.price, changePercent: quote.changePercent ?? quote.dailyReturn ?? item.changePercent } : item;
        }) }));
      } finally { running = false; }
    };
    void update('initial');
    const focus = () => void update('visibility');
    window.addEventListener('focus', focus);
    document.addEventListener('visibilitychange', focus);
    return () => { alive = false; if (timer) clearTimeout(timer); window.removeEventListener('focus', focus); document.removeEventListener('visibilitychange', focus); };
  }, []);
  return null;
}
