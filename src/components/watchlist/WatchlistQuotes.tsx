'use client';
import { useEffect } from 'react';
import { useWatchlistStore } from '@/store/useWatchlistStore';
import { marketJson } from '@/lib/api/clientCache';
export function WatchlistQuotes() {
  useEffect(() => {
    let alive = true;
    let running = false;
    const update = async () => {
      const { items, currentUserId } = useWatchlistStore.getState();
      if (!items.length || document.hidden || running) return;
      running = true;
      try {
        type Quote = { symbol?: string; code?: string; price: number; changePercent?: number; dailyReturn?: number };
        const urls = [items.some((i) => i.assetType === 'stock') && '/api/stocks', items.some((i) => i.assetType === 'fund') && '/api/funds'].filter((url): url is string => Boolean(url));
        const results = await Promise.allSettled(urls.map((url) => marketJson<{ data: Quote[] }>(url, 60_000)));
        if (!alive || useWatchlistStore.getState().currentUserId !== currentUserId) return;
        const quotes = new Map<string, Quote>();
        results.forEach((result, index) => {
          if (result.status !== 'fulfilled' || !Array.isArray(result.value.data)) return;
          const type = urls[index].includes('funds') ? 'fund' : 'stock';
          result.value.data.forEach((q) => quotes.set(`${type}:${q.symbol || q.code}`, q));
        });
        useWatchlistStore.setState((state) => ({ items: state.items.map((item) => {
          const quote = quotes.get(`${item.assetType}:${item.symbol}`);
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
