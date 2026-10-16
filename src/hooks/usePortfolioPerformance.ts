'use client';
import { useEffect, useMemo, useState } from 'react';
import { usePortfolioStore } from '@/store/usePortfolioStore';
import { calculatePeriodPerformance, istanbulDate, type PerformancePeriod, type PriceHistoryMap } from '@/lib/portfolio/periodPerformance';
import { cleanSymbol } from '@/lib/utils/symbol';

export function usePortfolioPerformance(period: PerformancePeriod) {
  const { transactions, activePortfolioId, livePrices } = usePortfolioStore();
  const active = useMemo(() => transactions.filter(t => t.portfolioId === activePortfolioId), [transactions, activePortfolioId]);
  const [loaded, setLoaded] = useState<{ key: string; history: PriceHistoryMap } | null>(null);
  const key = `${activePortfolioId}:${istanbulDate(new Date())}:${active.map(t => `${t.symbol}:${t.assetType}`).sort().join('|')}`;
  const needsHistory = period === 'weekly' || period === 'monthly';
  useEffect(() => {
    if (!needsHistory) return;
    const controller = new AbortController();
    const symbols = new Map(active.map(t => [cleanSymbol(t.symbol).symbol, t.assetType]));
    if (active.some(t => t.currency === 'USD' || t.exchange === 'NASDAQ' || t.exchange === 'NYSE' || ['NASDAQ', 'NYSE'].includes(cleanSymbol(t.symbol).exchange || ''))) symbols.set('USDTRY', 'stock');
    const history: PriceHistoryMap = {};
    void (async () => {
      // Limit simultaneous requests so a large portfolio cannot flood the history service.
      const entries = [...symbols];
      for (let i = 0; i < entries.length; i += 4) {
        await Promise.all(entries.slice(i, i + 4).map(async ([symbol, type]) => {
          try {
            const response = await fetch(type === 'fund' ? `/api/funds/${encodeURIComponent(symbol)}` : `/api/stocks/${encodeURIComponent(symbol)}/history?timeframe=3M`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) });
            if (!response.ok) return;
            const json = await response.json();
            if (!json.success) return;
            const rows = type === 'fund' ? json.data?.history : json.data;
            if (!Array.isArray(rows)) return;
            history[symbol] = {};
            for (const row of rows) {
              const raw = row.date || row.time;
              const day = typeof raw === 'number' ? istanbulDate(new Date(raw * 1000)) : typeof raw === 'string' ? raw.slice(0, 10) : '';
              const price = Number(row.price ?? row.close);
              if (/^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(price) && price > 0) history[symbol][day] = price;
            }
          } catch { /* Missing history is explicitly reported by the calculator. */ }
        }));
        if (controller.signal.aborted) return;
      }
      if (!controller.signal.aborted) setLoaded({ key, history });
    })();
    return () => controller.abort();
  }, [key, needsHistory, active]);
  const history = loaded?.key === key ? loaded.history : {};
  const metric = calculatePeriodPerformance(active, livePrices, history, period);
  return { ...metric, loading: needsHistory && loaded?.key !== key };
}
