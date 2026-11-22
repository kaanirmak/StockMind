'use client';

import React, { useEffect, useState } from 'react';
import { InstrumentLogo } from '@/components/ui/InstrumentLogo';
import { Button } from '@/components/ui/Button';

interface StickyAssetHeaderProps {
  sentinelRef: React.RefObject<HTMLElement | null>;
  symbol: string;
  name: string;
  priceText: string;
  changePercent: number | null;
  hasAlert?: boolean;
  onAlert: () => void;
  onTrade: () => void;
}

export function StickyAssetHeader({
  sentinelRef,
  symbol,
  name,
  priceText,
  changePercent,
  hasAlert = false,
  onAlert,
  onTrade,
}: StickyAssetHeaderProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const target = sentinelRef.current;
    if (!target || typeof IntersectionObserver === 'undefined') {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        setVisible(!entry.isIntersecting && entry.boundingClientRect.top < 80);
      },
      {
        threshold: 0,
        rootMargin: '-64px 0px 0px 0px',
      }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [sentinelRef]);

  if (!visible) return null;

  const isPositive = (changePercent ?? 0) >= 0;

  return (
    <div
      data-testid="sticky-asset-header"
      className="sticky top-0 z-30 -mx-4 px-4 py-2.5 bg-bg-card/90 backdrop-blur-xl border-b border-border/80 shadow-md animate-fade-in"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <InstrumentLogo symbol={symbol} name={name} size="sm" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-text-primary truncate">{symbol}</span>
              <span className="text-sm font-bold font-mono tabular-nums text-text-primary">
                {priceText}
              </span>
              {changePercent !== null && (
                <span
                  className={`text-xs font-bold font-mono tabular-nums px-1.5 py-0.5 rounded-md ${
                    isPositive ? 'pnl-positive pnl-bg-positive' : 'pnl-negative pnl-bg-negative'
                  }`}
                >
                  {isPositive ? '+' : '-'}%{Math.abs(changePercent).toFixed(2).replace('.', ',')}
                </span>
              )}
            </div>
            <p className="hidden sm:block text-[11px] text-text-muted truncate max-w-xs">{name}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant={hasAlert ? 'secondary' : 'outline'}
            size="sm"
            onClick={onAlert}
          >
            {hasAlert ? 'Alarm Aktif' : 'Alarm'}
          </Button>
          <Button variant="primary" size="sm" onClick={onTrade}>
            İşlem Kaydet
          </Button>
        </div>
      </div>
    </div>
  );
}
