'use client';
import { useEffect } from 'react';
import { useWatchlistStore } from '@/store/useWatchlistStore';
import { marketJson } from '@/lib/api/clientCache';
import { buildScopedQuoteRequests } from '@/lib/market/symbolQuery';
export function WatchlistQuotes() {
  useEffect(() => {
    let alive = true;
    let running = false;
    const update = async () => {
      const { items, currentUserId } = useWatchlistStore.getState();
      if (!items.length || document.hidden || running) return;
      const requests = buildScopedQuoteRequests(items, { liveOnly: true });
      if (!requests.length) return;
      running = true;
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
    void update();
    const timer = setInterval(() => void update(), 60_000);
    const focus = () => void update();
    window.addEventListener('focus', focus);
    document.addEventListener('visibilitychange', focus);
    return () => { alive = false; clearInterval(timer); window.removeEventListener('focus', focus); document.removeEventListener('visibilitychange', focus); };
  }, []);
  return null;
}
