'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { MarketQuoteValue } from './MarketQuoteValue';
import { evaluateRefreshPolicy } from '@/lib/market/refreshPolicy';
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
  const trackRef = useRef<HTMLDivElement>(null);
  const isInteractingRef = useRef(false);
  const prefersReducedMotionRef = useRef(false);
  const [isPausedByUser, setIsPausedByUser] = useState(false);
  const [slideAnnouncement, setSlideAnnouncement] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    prefersReducedMotionRef.current = mediaQuery.matches;
    const handleChange = (event: MediaQueryListEvent) => {
      prefersReducedMotionRef.current = event.matches;
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    if (isPausedByUser || items.length <= 1) return;
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      if (isInteractingRef.current || prefersReducedMotionRef.current) return;
      const track = trackRef.current;
      if (!track || track.scrollWidth <= track.clientWidth + 4) return;
      const firstSlide = track.firstElementChild as HTMLElement | null;
      const step = firstSlide ? firstSlide.getBoundingClientRect().width + 12 : 180;
      if (track.scrollLeft + track.clientWidth >= track.scrollWidth - 8) {
        track.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        track.scrollBy({ left: step, behavior: 'smooth' });
      }
    }, 3600);
    return () => clearInterval(timer);
  }, [isPausedByUser, items.length]);

  const scrollByStep = (direction: -1 | 1) => {
    const track = trackRef.current;
    if (!track || items.length === 0) return;
    const firstSlide = track.firstElementChild as HTMLElement | null;
    const step = firstSlide ? firstSlide.getBoundingClientRect().width + 12 : 180;
    const behavior: ScrollBehavior = prefersReducedMotionRef.current ? 'auto' : 'smooth';
    const maxScrollLeft = Math.max(0, track.scrollWidth - track.clientWidth);
    const currentApproxIndex = step > 0 ? Math.round(track.scrollLeft / step) : 0;
    let nextIndex = currentApproxIndex + direction;

    if (direction === -1 && track.scrollLeft <= 4) {
      nextIndex = items.length - 1;
      track.scrollTo({ left: maxScrollLeft, behavior });
    } else if (direction === 1 && track.scrollLeft >= maxScrollLeft - 8) {
      nextIndex = 0;
      track.scrollTo({ left: 0, behavior });
    } else {
      nextIndex = Math.max(0, Math.min(items.length - 1, nextIndex));
      track.scrollBy({ left: direction * step, behavior });
    }

    setSlideAnnouncement(`Piyasa Nabzı: ${nextIndex + 1} / ${items.length}`);
  };

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
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    let lastFetchAtMs: number | null = null;

    const scheduleNext = (delayMs: number | null) => {
      if (pollTimer) {
        clearTimeout(pollTimer);
        pollTimer = null;
      }
      if (delayMs != null && !controller.signal.aborted) {
        pollTimer = setTimeout(() => {
          void loadData('interval');
        }, delayMs);
      }
    };

    async function loadData(trigger: 'initial' | 'interval' | 'visibility' = 'interval') {
      if (pending) return;
      const decision = evaluateRefreshPolicy({
        surface: 'market_overview',
        trigger,
        isDocumentHidden: typeof document !== 'undefined' ? document.hidden : false,
        exchanges: ['BIST', 'NASDAQ'],
        baseIntervalMs: 15_000,
        closedIntervalMs: 120_000,
        lastFetchAtMs,
      });
      scheduleNext(decision.nextDelayMs);
      if (!decision.shouldFetch) return;

      pending = true;
      lastFetchAtMs = Date.now();
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

    void loadData('initial');
    const onVisibilityChange = () => {
      void loadData('visibility');
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      controller.abort();
      if (pollTimer) clearTimeout(pollTimer);
      clearTimeout(flashTimer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [retry]);

  const allUnavailable = items.length > 0 && items.every(item => item.status === 'unavailable');
  const hasPreviousPrices = items.some(item => item.status === 'last-known');

  return (
    <section aria-labelledby="market-overview-title" aria-roledescription="carousel">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 id="market-overview-title" className="text-lg font-semibold text-text-primary">Piyasa Nabzı</h2>
        <div className="flex items-center gap-1.5">
          {items.length > 1 && (
            <div className="inline-flex items-center gap-1 mr-1">
              <button
                type="button"
                onClick={() => scrollByStep(-1)}
                aria-label="Önceki piyasa kartı"
                className="min-w-7 min-h-7 w-7 h-7 inline-flex items-center justify-center rounded-lg border border-border bg-bg-card text-text-secondary hover:text-text-primary hover:border-accent/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent touch-manipulation cursor-pointer transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => scrollByStep(1)}
                aria-label="Sonraki piyasa kartı"
                className="min-w-7 min-h-7 w-7 h-7 inline-flex items-center justify-center rounded-lg border border-border bg-bg-card text-text-secondary hover:text-text-primary hover:border-accent/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent touch-manipulation cursor-pointer transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setIsPausedByUser((prev) => !prev)}
                aria-label={isPausedByUser ? 'Otomatik kaydırmayı oynat' : 'Otomatik kaydırmayı duraklat'}
                className="min-w-7 min-h-7 w-7 h-7 inline-flex items-center justify-center rounded-lg border border-border bg-bg-card text-text-secondary hover:text-text-primary hover:border-accent/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent touch-manipulation cursor-pointer transition-colors"
              >
                {isPausedByUser ? (
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5.14v14l11-7-11-7z" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 5h4v14H6V5zm8 0h4v14h-4V5z" />
                  </svg>
                )}
              </button>
            </div>
          )}
          <Link href="/piyasalar" className="text-xs font-semibold text-accent hover:underline whitespace-nowrap">
            Tüm Piyasalar →
          </Link>
        </div>
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

      <div
        ref={trackRef}
        tabIndex={0}
        role="group"
        aria-label="Piyasa kartları"
        onMouseEnter={() => { isInteractingRef.current = true; }}
        onMouseLeave={() => { isInteractingRef.current = false; }}
        onFocus={() => { isInteractingRef.current = true; }}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            isInteractingRef.current = false;
          }
        }}
        onTouchStart={() => { isInteractingRef.current = true; }}
        onTouchEnd={() => { isInteractingRef.current = false; }}
        className="flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-1 overscroll-x-contain touch-manipulation motion-safe:scroll-smooth"
      >
        {loading && items.length === 0 && Array.from({ length: 7 }, (_, index) => (
          <div key={index} className="min-w-[164px] sm:min-w-[184px] shrink-0 glass-card h-24 animate-pulse" aria-hidden="true" />
        ))}
        {items.map((item, index) => (
          <div
            key={item.symbol}
            role="group"
            aria-roledescription="slide"
            aria-label={`${index + 1} / ${items.length}: ${item.name}`}
            className="min-w-[164px] sm:min-w-[184px] shrink-0 snap-start"
          >
            <Link
              href={`/piyasalar?market=${marketTargets[item.symbol] ?? 'index'}`}
              className="glass-card p-3 sm:p-3.5 group block hover:border-accent/40 h-full"
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
          </div>
        ))}
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {slideAnnouncement}
      </p>
    </section>
  );
}
