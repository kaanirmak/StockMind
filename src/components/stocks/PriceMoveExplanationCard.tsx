'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui';
import {
  buildPriceMoveExplanation,
  type PriceMoveEventInput,
  type PriceMoveNewsInput,
} from '@/lib/market/priceMoveExplanation';

export interface PriceMoveExplanationCardProps {
  symbol: string;
  currentPrice: number | null;
  previousClose?: number | null;
  change?: number | null;
  changePercent?: number | null;
  currency?: string;
  priceSource?: string | null;
  asOf?: string | null;
  exchange?: string | null;
}

export const PriceMoveExplanationCard: React.FC<PriceMoveExplanationCardProps> = ({
  symbol,
  currentPrice,
  previousClose,
  change,
  changePercent,
  currency = 'TRY',
  priceSource,
  asOf,
  exchange,
}) => {
  const [articles, setArticles] = useState<PriceMoveNewsInput[]>([]);
  const [events, setEvents] = useState<PriceMoveEventInput[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const encoded = encodeURIComponent(symbol);
    Promise.allSettled([
      fetch(`/api/news?symbol=${encoded}`).then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/stocks/${encoded}/events`).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([newsRes, evRes]) => {
        if (!active) return;
        const nextArticles =
          newsRes.status === 'fulfilled' && Array.isArray(newsRes.value?.data)
            ? newsRes.value.data
            : [];
        const nextEvents =
          evRes.status === 'fulfilled' && Array.isArray(evRes.value?.events)
            ? evRes.value.events
            : [];
        setArticles(nextArticles);
        setEvents(nextEvents);
      })
      .catch(() => {
        if (!active) return;
        setArticles([]);
        setEvents([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [symbol]);

  const explanation = useMemo(
    () =>
      buildPriceMoveExplanation({
        symbol,
        quote: {
          price: currentPrice,
          previousClose,
          change,
          changePercent,
          source: priceSource,
          asOf,
          exchange,
        },
        articles,
        events,
      }),
    [symbol, currentPrice, previousClose, change, changePercent, priceSource, asOf, exchange, articles, events]
  );

  const currSym = currency === 'TRY' ? '₺' : currency === 'EUR' ? '€' : '$';
  const pct = explanation.intradayMove.changePercent;

  return (
    <section
      data-testid="price-move-explanation-card"
      className="glass-card p-4 sm:p-5 rounded-2xl border border-border/80 space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-sm sm:text-base font-bold text-text-primary">
            Gün İçi Fiyat Hareketi ve Olay Bağlamı
          </h2>
          <Badge
            variant={
              explanation.causalityStatus === 'correlated_events'
                ? 'info'
                : explanation.causalityStatus === 'uncertain_no_recent_events'
                ? 'warning'
                : 'default'
            }
            size="sm"
          >
            {explanation.causalityStatus === 'correlated_events'
              ? `${explanation.drivers.length} İlgili Olay`
              : explanation.causalityStatus === 'uncertain_no_recent_events'
              ? 'Nedensellik Belirsiz'
              : 'Hareket Doğrulanamadı'}
          </Badge>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          {pct !== null && (
            <span
              className={`px-2 py-0.5 rounded-lg font-bold ${
                pct >= 0
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : 'bg-danger/15 text-danger'
              }`}
            >
              {pct >= 0 ? `+${pct.toFixed(2)}%` : `${pct.toFixed(2)}%`}
              {explanation.intradayMove.change !== null && (
                <> ({explanation.intradayMove.change >= 0 ? '+' : ''}{currSym}{Math.abs(explanation.intradayMove.change).toFixed(2)})</>
              )}
            </span>
          )}
          <span className="text-[11px] text-text-muted">
            Kaynak: {explanation.intradayMove.priceSource}
          </span>
        </div>
      </div>

      <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
        {explanation.explanationText}
      </p>

      {loading ? (
        <p className="text-xs text-text-muted">İlgili haber ve takvim olayları kontrol ediliyor...</p>
      ) : explanation.drivers.length > 0 ? (
        <div className="space-y-2">
          {explanation.drivers.map((driver) => (
            <div
              key={driver.id}
              data-testid="price-move-driver"
              className="rounded-xl border border-border/60 bg-bg-secondary/50 px-3 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
            >
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Badge variant="default" size="sm">{driver.matchType}</Badge>
                  <span className="font-semibold text-accent">{driver.source}</span>
                  <span className="text-text-muted text-[11px]">
                    {new Date(driver.publishedAt).toLocaleString('tr-TR', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <p className="font-medium text-text-primary truncate">{driver.title}</p>
              </div>
              {driver.url && (
                <a
                  href={driver.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-semibold text-accent hover:underline shrink-0"
                >
                  Kaynağı Aç
                </a>
              )}
            </div>
          ))}
        </div>
      ) : null}

      <p
        data-testid="price-move-causality-notice"
        className="text-[11px] text-text-muted rounded-xl border border-border/60 bg-bg-secondary/30 px-3 py-2"
      >
        {explanation.causalityNotice}
      </p>
    </section>
  );
};
