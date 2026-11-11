'use client';

import React, { useEffect, useState } from 'react';
import type { UpcomingEventItem, UpcomingEventsReport } from '@/lib/market/upcomingEvents';
import { Badge, Button, Skeleton } from '@/components/ui';
import { formatDate } from '@/lib/utils/format';

export interface UpcomingEventsCardProps {
  symbol: string;
  isNonEquity?: boolean;
}

function getEventTypeBadgeVariant(type: UpcomingEventItem['type']): 'info' | 'success' | 'purple' | 'warning' {
  if (type === 'earnings') return 'info';
  if (type === 'dividend') return 'success';
  if (type === 'ex_dividend') return 'purple';
  return 'warning';
}

function formatCountdownLabel(isoDate: string): string {
  const todayIso = new Date().toISOString().slice(0, 10);
  if (isoDate === todayIso) return 'Bugün';
  const diffMs = new Date(`${isoDate}T00:00:00.000Z`).getTime() - new Date(`${todayIso}T00:00:00.000Z`).getTime();
  const days = Math.round(diffMs / 86_400_000);
  if (days === 1) return 'Yarın';
  if (days > 1) return `${days} gün sonra`;
  return isoDate;
}

export const UpcomingEventsCard: React.FC<UpcomingEventsCardProps> = ({
  symbol,
  isNonEquity = false,
}) => {
  const [report, setReport] = useState<UpcomingEventsReport | null>(null);
  const [loading, setLoading] = useState(!isNonEquity);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    if (!symbol || isNonEquity) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    async function loadEvents() {
      try {
        setLoading(true);
        const res = await fetch(`/api/stocks/${encodeURIComponent(symbol)}/events`);
        if (!res.ok) {
          if (!cancelled) {
            setReport({
              symbol,
              status: 'unavailable',
              events: [],
              checkedAt: new Date().toISOString(),
              notice: 'Olay takvimi sağlayıcısına şu anda ulaşılamadı.',
            });
          }
          return;
        }
        const json = await res.json();
        if (!cancelled) {
          setReport({
            symbol: json.symbol || symbol,
            status: json.status || (Array.isArray(json.events) && json.events.length > 0 ? 'ok' : 'empty'),
            events: Array.isArray(json.events) ? json.events : [],
            checkedAt: json.checkedAt || new Date().toISOString(),
            notice: json.notice || null,
          });
        }
      } catch {
        if (!cancelled) {
          setReport({
            symbol,
            status: 'unavailable',
            events: [],
            checkedAt: new Date().toISOString(),
            notice: 'Olay takvimi kontrol edilirken bağlantı hatası oluştu.',
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadEvents();
    return () => {
      cancelled = true;
    };
  }, [symbol, isNonEquity, reloadTick]);

  if (isNonEquity) {
    return null;
  }

  return (
    <div data-testid="stock-upcoming-events-card" className="glass-card p-4 sm:p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm sm:text-base font-bold text-text-primary">
            Yaklaşan Olaylar & Takvim
          </h2>
          <p className="text-[11px] text-text-muted">
            Doğrulanmış bilanço, temettü ve resmi şirket ilanları tarih ve kaynağıyla gösterilir.
          </p>
        </div>
        {report?.checkedAt && (
          <span className="text-[10px] font-mono text-text-muted">
            Son kontrol: {formatDate(report.checkedAt, 'tr-TR')}
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      ) : report?.status === 'unavailable' ? (
        <div className="rounded-xl border border-warning/30 bg-warning/10 p-3 flex flex-wrap items-center justify-between gap-2 text-xs text-warning">
          <span>{report.notice || 'Takvim sağlayıcısından doğrulama alınamadı.'}</span>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setReloadTick((n) => n + 1)}
          >
            Tekrar Dene
          </Button>
        </div>
      ) : !report || report.events.length === 0 ? (
        <div className="rounded-xl border border-border/60 bg-bg-secondary/30 p-3 text-xs text-text-muted">
          {report?.notice || 'Doğrulanmış yaklaşan bilanço, temettü veya resmi olay bulunamadı.'}
        </div>
      ) : (
        <ul className="space-y-2">
          {report.events.map((ev) => (
            <li
              key={ev.id}
              className="rounded-xl border border-border/60 bg-bg-secondary/40 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant={getEventTypeBadgeVariant(ev.type)} size="sm">
                    {ev.typeLabel}
                  </Badge>
                  <span className="font-mono text-xs font-bold text-text-primary">
                    <time dateTime={ev.eventDate}>{formatDate(ev.eventDate, 'tr-TR', { timeZone: 'UTC' })}</time>
                  </span>
                  <span className="text-[11px] text-accent font-medium">
                    ({formatCountdownLabel(ev.eventDate)})
                  </span>
                </div>
                <p className="text-xs sm:text-sm font-semibold text-text-primary">{ev.title}</p>
                {ev.details && <p className="text-[11px] text-text-muted">{ev.details}</p>}
              </div>

              <div className="shrink-0 flex items-center gap-2 text-[11px]">
                <span className="px-2 py-0.5 rounded-md bg-bg-tertiary border border-border/70 text-text-secondary font-medium">
                  Kaynak: {ev.source}
                </span>
                {ev.sourceUrl && (
                  <a
                    href={ev.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline font-medium"
                  >
                    Duyuru ↗
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
