'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { MarketQuoteValue } from './MarketQuoteValue';
import type { MarketOverviewItem } from '@/types/stock';

const marketTargets: Record<string, string> = {
  XU100: 'bist',
  GA: 'commodity',
  BRENT: 'commodity',
  USDTRY: 'forex',
  EURTRY: 'forex',
  BTC: 'crypto',
};

const STORAGE_KEY = 'stockmind_market_overview_last_verified_v1';

function readStoredOverviewQuotes(): Map<string, MarketOverviewItem> {
  const map = new Map<string, MarketOverviewItem>();
  if (typeof window === 'undefined') return map;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return map;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return map;
    for (const item of parsed) {
      if (
        item &&
        typeof item === 'object' &&
        typeof item.symbol === 'string' &&
        typeof item.value === 'number' &&
        Number.isFinite(item.value) &&
        item.value > 0 &&
        item.observation &&
        typeof item.observation.fetchedAt === 'string'
      ) {
        map.set(item.symbol, item as MarketOverviewItem);
      }
    }
  } catch {
    // Ignore storage read errors
  }
  return map;
}

function writeStoredOverviewQuotes(map: Map<string, MarketOverviewItem>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(map.values())));
  } catch {
    // Ignore storage write errors
  }
}

export default function MarketOverview() {
  const [items, setItems] = useState<MarketOverviewItem[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [flashes, setFlashes] = useState<Record<string, string>>({});
  const lastQuotes = useRef(new Map<string, MarketOverviewItem>());

  useEffect(() => {
    const stored = readStoredOverviewQuotes();
    for (const [symbol, item] of stored.entries()) {
      if (!lastQuotes.current.has(symbol)) {
        lastQuotes.current.set(symbol, item);
      }
    }

    const controller = new AbortController();
    let pending = false;
    let flashTimer: ReturnType<typeof setTimeout>;

    async function loadData() {
      if (document.hidden || pending) return;
      pending = true;
      try {
        const response = await fetch('/api/markets/overview', { signal: controller.signal });
        if (!response.ok) throw new Error('Piyasa verisi alınamadı');
        const payload = await response.json();
        if (!payload.success || !Array.isArray(payload.data)) throw new Error('Piyasa verisi alınamadı');
        if (controller.signal.aborted) return;

        const changes: Record<string, string> = {};
        const data: MarketOverviewItem[] = payload.data;
        let updatedStorage = false;
        const next = data.map((item): MarketOverviewItem => {
          const previous = lastQuotes.current.get(item.symbol);
          if (item.value === null) return previous ? { ...previous, status: 'last-known' } : item;
          if (item.status === 'available') {
            if (previous?.value != null && item.value !== previous.value) {
              changes[item.symbol] = item.value > previous.value ? 'price-flash-up' : 'price-flash-down';
            }
            lastQuotes.current.set(item.symbol, item);
            updatedStorage = true;
          }
          return item;
        });

        if (updatedStorage) {
          writeStoredOverviewQuotes(lastQuotes.current);
        }

        setItems(next);
        setError(false);
        if (Object.keys(changes).length) {
          clearTimeout(flashTimer);
          setFlashes(changes);
          flashTimer = setTimeout(() => setFlashes({}), 1200);
        }
      } catch {
        if (!controller.signal.aborted) {
          setError(true);
          setItems(previous => {
            if (previous.length > 0) {
              return previous.map(item => (item.value === null ? item : { ...item, status: 'last-known' }));
            }
            const cached = Array.from(lastQuotes.current.values());
            return cached.map(item => ({ ...item, status: 'last-known' }));
          });
        }
      } finally {
        pending = false;
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadData();
    const interval = setInterval(loadData, 15_000);
    document.addEventListener('visibilitychange', loadData);
    return () => {
      controller.abort();
      clearInterval(interval);
      clearTimeout(flashTimer);
      document.removeEventListener('visibilitychange', loadData);
    };
  }, [retry]);

  const allUnavailable = items.length > 0 && items.every(item => item.status === 'unavailable');
  const hasPreviousPrices = items.some(item => item.status === 'last-known');

  return (
    <section aria-labelledby="market-overview-title">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 id="market-overview-title" className="text-lg font-semibold text-text-primary">Piyasa Nabzı</h2>
        <Link href="/piyasalar" className="text-xs font-semibold text-accent hover:underline">
          Tüm Piyasalar →
        </Link>
      </div>

      {(error || allUnavailable || hasPreviousPrices) && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-text-muted" role="status">
          {hasPreviousPrices ? 'Bazı fiyatlar güncellenemedi. Son alınan değerler gösteriliyor.' : 'Piyasa verisi şu anda alınamıyor.'}
          <button
            type="button"
            onClick={() => { setLoading(true); setRetry(value => value + 1); }}
            disabled={loading}
            className="min-h-8 rounded-lg border border-border px-2 font-semibold text-accent disabled:opacity-60"
          >
            Yeniden Dene
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {loading && items.length === 0 && Array.from({ length: 7 }, (_, index) => (
          <div key={index} className="glass-card h-24 animate-pulse" aria-hidden="true" />
        ))}
        {items.map(item => (
          <Link
            key={item.symbol}
            href={`/piyasalar?market=${marketTargets[item.symbol] ?? 'index'}`}
            className="glass-card p-3 sm:p-3.5 group block hover:border-accent/40"
          >
            <div className="flex items-center gap-2 mb-2">
              <Icon name="chart" />
              <div className="min-w-0">
                <p className="text-[10px] text-text-muted font-bold truncate">{item.symbol}</p>
                <p className="text-xs font-medium text-text-secondary truncate group-hover:text-accent">{item.name}</p>
              </div>
            </div>
            <MarketQuoteValue item={item} flash={flashes[item.symbol]} />
          </Link>
        ))}
      </div>
    </section>
  );
}
