'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import type { Holding, Transaction } from '@/types/portfolio';
import type { PriceQuote } from '@/lib/portfolio/calculations';
import type { UpcomingEventItem } from '@/lib/market/upcomingEvents';
import { buildDividendOverviewReport } from '@/lib/portfolio/dividendView';
import { maskDisplayValue } from '@/lib/privacy';

interface DividendOverviewCardProps {
  transactions: Transaction[];
  holdings: Holding[];
  livePrices: Record<string, PriceQuote | number>;
  isPrivacyMode?: boolean;
}

export function DividendOverviewCard({
  transactions,
  holdings,
  livePrices,
  isPrivacyMode = false,
}: DividendOverviewCardProps) {
  const [eventsBySymbol, setEventsBySymbol] = useState<Record<string, UpcomingEventItem[]>>({});
  const [unavailableSymbols, setUnavailableSymbols] = useState<string[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  const stockHoldings = useMemo(
    () => holdings.filter((h) => h.assetType === 'stock' && h.totalQuantity > 0),
    [holdings]
  );
  const symbolKey = useMemo(
    () => stockHoldings.map((h) => h.symbol.toUpperCase()).sort().join(','),
    [stockHoldings]
  );

  useEffect(() => {
    if (!symbolKey) {
      setEventsBySymbol({});
      setUnavailableSymbols([]);
      return;
    }

    let cancelled = false;
    setLoadingEvents(true);

    const symbols = symbolKey.split(',').slice(0, 12);
    Promise.all(
      symbols.map(async (sym) => {
        try {
          const res = await fetch(`/api/stocks/${encodeURIComponent(sym)}/events`);
          const json = await res.json();
          if (!res.ok || !json.success || json.status === 'unavailable') {
            return { sym, events: [] as UpcomingEventItem[], failed: true };
          }
          return {
            sym,
            events: Array.isArray(json.events) ? (json.events as UpcomingEventItem[]) : [],
            failed: false,
          };
        } catch {
          return { sym, events: [] as UpcomingEventItem[], failed: true };
        }
      })
    ).then((results) => {
      if (cancelled) return;
      const nextMap: Record<string, UpcomingEventItem[]> = {};
      const nextFailed: string[] = [];
      for (const r of results) {
        nextMap[r.sym] = r.events;
        if (r.failed) nextFailed.push(r.sym);
      }
      setEventsBySymbol(nextMap);
      setUnavailableSymbols(nextFailed);
      setLoadingEvents(false);
    });

    return () => {
      cancelled = true;
    };
  }, [symbolKey]);

  const report = useMemo(
    () =>
      buildDividendOverviewReport({
        transactions,
        holdings,
        upcomingEventsBySymbol: eventsBySymbol,
        unavailableSymbols,
        livePrices,
      }),
    [transactions, holdings, eventsBySymbol, unavailableSymbols, livePrices]
  );

  return (
    <div className="space-y-4" data-testid="dividend-overview-card">
      {/* Section 1: Realized Dividends */}
      <section className="glass-card p-4 sm:p-5 space-y-3" data-testid="dividends-realized-section">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-text-primary">
                Gerçekleşmiş Temettü Ödemeleri
              </h3>
              <Badge variant="success" size="sm">Kesinleşen</Badge>
            </div>
            <p className="text-xs text-text-muted">
              İşlem geçmişinizdeki onaylanmış nakit temettü kayıtları.
            </p>
          </div>
          <span className="font-mono text-sm font-black text-success">
            {maskDisplayValue(
              `+₺${report.realized.totalTry.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              isPrivacyMode,
              '₺••••'
            )}
          </span>
        </div>

        {report.realized.entries.length > 0 ? (
          <div className="divide-y divide-border/50">
            {report.realized.entries.map((item) => (
              <div key={item.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                <div>
                  <span className="font-bold text-text-primary">{item.symbol}</span>
                  <span className="text-text-muted ml-2 font-mono">{item.paymentDate}</span>
                  {item.missingFxRate && (
                    <span className="ml-2 text-[11px] text-warning">(Güncel kur uygulandı)</span>
                  )}
                </div>
                <span className="font-mono font-bold text-success">
                  {maskDisplayValue(
                    `+₺${item.amountTry.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                    isPrivacyMode,
                    '₺••••'
                  )}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-text-muted">Henüz kaydedilmiş temettü ödemesi bulunmuyor.</p>
        )}
      </section>

      {/* Section 2: Officially Announced Upcoming Dividends */}
      <section className="glass-card p-4 sm:p-5 space-y-3" data-testid="dividends-announced-section">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-text-primary">
                İlan Edilen Gelecek Temettü Ödemeleri
              </h3>
              <Badge variant="info" size="sm">Resmi Takvim</Badge>
            </div>
            <p className="text-xs text-text-muted">
              Portföyünüzdeki hisseler için doğrulanan hak ediş ve ödeme tarihleri.
            </p>
          </div>
          {loadingEvents && <span className="text-xs text-text-muted">Takvim kontrol ediliyor…</span>}
        </div>

        {report.announced.entries.length > 0 ? (
          <div className="divide-y divide-border/50">
            {report.announced.entries.map((ev) => (
              <div key={ev.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div>
                  <Link href={`/stocks/${ev.symbol}`} className="font-bold text-text-primary hover:text-accent">
                    {ev.symbol}
                  </Link>
                  <Badge variant="info" size="sm" className="ml-2">{ev.typeLabel}</Badge>
                  <span className="text-text-muted ml-2">{ev.title}</span>
                </div>
                <div className="text-right font-mono">
                  <span className="font-semibold text-text-primary block">{ev.eventDate}</span>
                  <span className="text-[11px] text-text-muted">{ev.source}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-text-muted">
            {loadingEvents
              ? 'Takvim verisi sorgulanıyor…'
              : 'Portföyünüzdeki varlıklar için şu anda ilan edilmiş gelecek temettü kaydı bulunamadı.'}
          </p>
        )}

        {report.announced.sourcesUnavailable.length > 0 && (
          <p className="text-[11px] text-warning">
            Takvim kaynağına ulaşılamayan semboller: {report.announced.sourcesUnavailable.join(', ')}
          </p>
        )}
      </section>

      {/* Section 3: Estimates (Strictly Separated & Disclosed) */}
      <section className="glass-card p-4 sm:p-5 space-y-3" data-testid="dividends-estimates-section">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-text-primary">
                Tahmini Temettü Öngörüleri (Varsa)
              </h3>
              <Badge variant="warning" size="sm">Tahmin • Garanti Değil</Badge>
            </div>
            <p className="text-xs text-text-muted">{report.estimates.disclaimer}</p>
          </div>
          {report.estimates.entries.length > 0 && (
            <span className="font-mono text-sm font-bold text-warning">
              {maskDisplayValue(
                `~₺${report.estimates.totalAnnualTry.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}/yıl`,
                isPrivacyMode,
                '₺••••'
              )}
            </span>
          )}
        </div>

        {report.estimates.entries.length > 0 ? (
          <div className="divide-y divide-border/50">
            {report.estimates.entries.map((est) => (
              <div key={est.symbol} className="py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div>
                  <span className="font-bold text-text-primary">{est.symbol}</span>
                  <span className="text-text-muted ml-2">{est.basisLabel}</span>
                  <span className="block text-[11px] text-text-muted">{est.confidenceNote}</span>
                </div>
                <span className="font-mono font-bold text-warning">
                  {maskDisplayValue(
                    `~₺${est.estimatedAnnualTry.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`,
                    isPrivacyMode,
                    '₺••••'
                  )}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-text-muted">
            Tahmin üretecek geçmiş temettü ödemesi veya doğrulanmış verim verisi bulunmuyor.
          </p>
        )}
      </section>
    </div>
  );
}
