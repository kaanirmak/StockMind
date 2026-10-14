'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { formatNumber, getPnLColor, getPnLSign } from '@/lib/utils/format';

interface MarketItem {
  symbol: string;
  name: string;
  value: number;
  change: number;
  currency: 'TRY' | 'USD';
  flag: string;
}

export default function MarketOverview() {
  const [items, setItems] = useState<MarketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [priceFlashes, setPriceFlashes] = useState<Record<string, 'up' | 'down'>>({});
  const prevPricesRef = useRef<Record<string, number>>({});

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      // Don't poll if the tab is hidden/backgrounded
      if (typeof document !== 'undefined' && document.hidden) {
        return;
      }

      try {
        const res = await fetch('/api/markets/overview');
        if (res.ok) {
          const json = await res.json();
          if (json.data && json.data.length > 0 && isMounted) {
            const nextData: MarketItem[] = json.data;

            // Compute price flashes
            const newFlashes: Record<string, 'up' | 'down'> = {};
            nextData.forEach((item) => {
              const prev = prevPricesRef.current[item.symbol];
              if (prev !== undefined && prev !== item.value) {
                if (item.value > prev) {
                  newFlashes[item.symbol] = 'up';
                } else if (item.value < prev) {
                  newFlashes[item.symbol] = 'down';
                }
              }
              prevPricesRef.current[item.symbol] = item.value;
            });

            if (Object.keys(newFlashes).length > 0) {
              setPriceFlashes(newFlashes);
              setTimeout(() => {
                if (isMounted) setPriceFlashes({});
              }, 1200);
            }

            setItems(nextData);
            setError(null);
            setLastUpdated(new Date());
          } else if (isMounted) {
            setError((prev) => prev || 'Piyasa verisi alınamadı.');
          }
        } else if (isMounted) {
          setError((prev) => prev || 'Piyasa servisine ulaşılamıyor.');
        }
      } catch (err) {
        if (isMounted) {
          setError((prev) => prev || 'Piyasa verisi yüklenirken bağlantı hatası oluştu.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();

    // 15-second visibility-aware polling
    const interval = setInterval(loadData, 15000);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadData();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMounted = false;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const getTargetUrl = (symbol: string) => {
    if (symbol === 'XU100') return '/piyasalar?market=bist';
    if (symbol === 'GA' || symbol === 'BRENT') return '/piyasalar?market=commodity';
    if (symbol === 'USDTRY' || symbol === 'EURTRY') return '/piyasalar?market=forex';
    if (symbol === 'BTC') return '/piyasalar?market=crypto';
    return '/piyasalar?market=index';
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
          <span>Piyasa Nabzı</span>
          {loading && items.length === 0 ? (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 border border-amber-500/30 text-amber-400">
              Yükleniyor...
            </span>
          ) : error && items.length === 0 ? (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 border border-rose-500/30 text-rose-400">
              Veri Alınamadı
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              Canlı Akış
            </span>
          )}
        </h2>
        <Link
          href="/piyasalar"
          className="text-xs font-semibold text-accent hover:underline flex items-center gap-1"
        >
          Tüm Piyasalar &rarr;
        </Link>
      </div>

      {loading && items.length === 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="glass-card p-3 sm:p-3.5 animate-pulse space-y-2">
              <div className="h-4 bg-border/40 rounded w-2/3" />
              <div className="h-5 bg-border/40 rounded w-full" />
              <div className="h-3 bg-border/40 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : error && items.length === 0 ? (
        <div className="glass-card p-4 rounded-xl text-center text-xs text-text-muted border border-border/60">
          <p>{error}</p>
          <button
            onClick={() => {
              setLoading(true);
              setError(null);
              fetch('/api/markets/overview')
                .then((r) => r.json())
                .then((j) => {
                  if (j.data?.length) setItems(j.data);
                })
                .catch(() => setError('Tekrar denenirken hata oluştu.'))
                .finally(() => setLoading(false));
            }}
            className="mt-2 px-3 py-1 bg-accent/20 hover:bg-accent/30 text-accent font-semibold rounded-lg text-xs transition"
          >
            Yeniden Dene
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 stagger-children">
          {items.map((idx) => {
            const isTry = idx.currency === 'TRY';
            const symbolPrefix = isTry ? '₺' : '$';
            const targetUrl = getTargetUrl(idx.symbol);

            return (
              <Link
                key={idx.symbol}
                href={targetUrl}
                className="glass-card p-3 sm:p-3.5 hover:border-accent/40 transition-all duration-300 group block relative cursor-pointer"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base sm:text-lg">{idx.flag}</span>
                  <div className="min-w-0">
                    <p className="text-[10px] text-text-muted font-bold tracking-wider uppercase truncate">
                      {idx.symbol}
                    </p>
                    <p className="text-xs font-medium text-text-secondary truncate group-hover:text-text-primary transition-colors">
                      {idx.name}
                    </p>
                  </div>
                </div>

                <div
                  className={`text-sm sm:text-base font-bold font-mono text-text-primary whitespace-nowrap transition-all duration-300 ${
                    priceFlashes[idx.symbol] === 'up'
                      ? 'price-flash-up'
                      : priceFlashes[idx.symbol] === 'down'
                      ? 'price-flash-down'
                      : ''
                  }`}
                >
                  {symbolPrefix}
                  {idx.value < 10 ? idx.value.toFixed(2) : formatNumber(idx.value)}
                </div>

                <div className={`flex items-center gap-1 mt-1 text-xs font-semibold font-mono ${getPnLColor(idx.change)}`}>
                  {idx.change > 0 ? (
                    <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                    </svg>
                  ) : (
                    <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 4.5l15 15m0 0V8.25m0 11.25H8.25" />
                    </svg>
                  )}
                  <span>
                    {getPnLSign(idx.change)}{Math.abs(idx.change).toFixed(2)}%
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
