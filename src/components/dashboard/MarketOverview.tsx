'use client';

import React, { useEffect, useState } from 'react';
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

const DEFAULT_INDICES: MarketItem[] = [
  { symbol: 'XU100', name: 'BIST 100', value: 10542.38, change: 1.24, currency: 'TRY', flag: '🇹🇷' },
  { symbol: 'GA', name: 'Gram Altın', value: 6645.1, change: 0.85, currency: 'TRY', flag: '🪙' },
  { symbol: 'USDTRY', name: 'Dolar / TL', value: 49.26, change: 0.12, currency: 'TRY', flag: '💵' },
  { symbol: 'BTC', name: 'Bitcoin', value: 83050.0, change: 0.45, currency: 'USD', flag: '₿' },
  { symbol: 'SPX', name: 'S&P 500', value: 5823.47, change: 0.59, currency: 'USD', flag: '🇺🇸' },
  { symbol: 'BRENT', name: 'Brent Petrol', value: 104.4, change: 0.51, currency: 'USD', flag: '🛢️' },
];

export default function MarketOverview() {
  const [items, setItems] = useState<MarketItem[]>(DEFAULT_INDICES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const res = await fetch('/api/markets/overview');
        if (res.ok) {
          const json = await res.json();
          if (json.data && json.data.length > 0 && isMounted) {
            setItems(json.data);
          }
        }
      } catch (err) {
        // Fallback to default
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();
    const interval = setInterval(loadData, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
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
          <span>Canlı Finans & Piyasa Nabzı</span>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Canlı Veri" />
        </h2>
        <Link
          href="/piyasalar"
          className="text-xs font-semibold text-accent hover:underline flex items-center gap-1"
        >
          Tüm Piyasalar &rarr;
        </Link>
      </div>

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

              <div className="text-sm sm:text-base font-bold font-mono text-text-primary whitespace-nowrap">
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
    </div>
  );
}
