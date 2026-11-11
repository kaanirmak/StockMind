'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePortfolioStore } from '@/store/usePortfolioStore';
import { InstrumentLogo, StateView } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import { formatCurrency, formatPercent, getPnLColor, getPnLSign } from '@/lib/utils/format';
import { formatContributionPoints } from '@/lib/portfolio/dailyAttribution';
import {
  extractDailyContributors,
  selectTopImportantEvent,
  type DashboardEventArticle,
} from '@/lib/dashboard/homePriority';

export default function DailyPulseRow() {
  const { getSummary, loading } = usePortfolioStore();
  const summary = getSummary();

  const [eventLoading, setEventLoading] = useState(true);
  const [eventError, setEventError] = useState<string | null>(null);
  const [articles, setArticles] = useState<DashboardEventArticle[]>([]);
  const [isStaleNews, setIsStaleNews] = useState(false);

  const contributors = useMemo(
    () => extractDailyContributors(summary.holdings, 4),
    [summary.holdings],
  );

  const contributionPointsBySymbol = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of summary.dailyAttribution?.allContributors || []) {
      map.set(`${entry.assetType}-${entry.symbol.toUpperCase()}`, entry.contributionPercentPoints);
    }
    return map;
  }, [summary.dailyAttribution]);

  const portfolioSymbolsKey = useMemo(
    () => summary.holdings.map((h) => h.symbol.toUpperCase()).slice(0, 20).join(','),
    [summary.holdings],
  );

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function loadImportantEvent() {
      setEventLoading(true);
      setEventError(null);
      try {
        const query = portfolioSymbolsKey
          ? `/api/news?symbols=${encodeURIComponent(portfolioSymbolsKey)}`
          : '/api/news';
        const res = await fetch(query, { signal: controller.signal });
        if (!res.ok) {
          throw new Error('Önemli olay verisi alınamadı');
        }
        const payload = await res.json();
        if (!active || controller.signal.aborted) return;
        const list = Array.isArray(payload?.data) ? payload.data : [];
        setArticles(list);
        setIsStaleNews(Boolean(payload?.stale));
      } catch (err) {
        if (!active || controller.signal.aborted) return;
        setEventError(err instanceof Error ? err.message : 'Haber akışı alınamadı');
      } finally {
        if (active && !controller.signal.aborted) {
          setEventLoading(false);
        }
      }
    }

    loadImportantEvent();
    return () => {
      active = false;
      controller.abort();
    };
  }, [portfolioSymbolsKey]);

  const portfolioSymbols = useMemo(
    () => summary.holdings.map((h) => h.symbol.toUpperCase()),
    [summary.holdings],
  );

  const topEvent = useMemo(
    () => selectTopImportantEvent(articles, portfolioSymbols),
    [articles, portfolioSymbols],
  );

  return (
    <section
      aria-label="Günün Katkısı ve Önemli Olay"
      data-testid="dashboard-daily-pulse"
      className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-4"
    >
      {/* Daily Contributors */}
      <div className="lg:col-span-7 glass-card p-3.5 sm:p-4 border border-border/70">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-text-primary">
              Günün Katkı Sağlayan Varlıkları
            </h2>
            <p className="text-[11px] text-text-muted">
              Bugünkü portföy değişimine en çok etki eden pozisyonlar
            </p>
          </div>
          <Link
            href="/portfolio"
            className="text-xs font-medium text-accent hover:text-accent-hover transition-colors shrink-0"
          >
            Portföy &rarr;
          </Link>
        </div>

        {loading && contributors.length === 0 ? (
          <p className="text-xs text-text-muted py-3">Portföy katkıları hesaplanıyor...</p>
        ) : contributors.length === 0 ? (
          <div className="py-3 flex items-center justify-between gap-3">
            <p className="text-xs text-text-muted">
              Günlük katkı verisi görmek için portföyünüze varlık ekleyin.
            </p>
            <Link
              href="/portfolio"
              className="px-2.5 py-1.5 rounded-lg bg-accent/15 text-accent text-xs font-semibold shrink-0 hover:bg-accent/25 transition-colors"
            >
              Varlık Ekle
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {contributors.map((item) => (
              <Link
                key={`${item.assetType}-${item.symbol}`}
                href={item.href}
                className="flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-xl bg-bg-secondary/45 hover:bg-bg-hover border border-border/50 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <InstrumentLogo symbol={item.symbol} size="xs" />
                  <div className="min-w-0">
                    <span className="text-sm font-semibold text-text-primary block truncate">
                      {item.symbol}
                    </span>
                    <span className="text-[10px] text-text-muted block">
                      Ağırlık {formatPercent(item.weight, 1)}
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className={`text-xs sm:text-sm font-semibold block ${getPnLColor(item.dailyPnL)}`}>
                    {getPnLSign(item.dailyPnL)}
                    {formatCurrency(Math.abs(item.dailyPnL))}
                  </span>
                  <span className={`text-[11px] font-medium block ${getPnLColor(item.dailyChangePercent)}`}>
                    {getPnLSign(item.dailyChangePercent)}
                    {formatPercent(Math.abs(item.dailyChangePercent))}
                  </span>
                  {contributionPointsBySymbol.has(`${item.assetType}-${item.symbol.toUpperCase()}`) && (
                    <span className="text-[10px] font-mono text-text-muted block">
                      {formatContributionPoints(
                        contributionPointsBySymbol.get(`${item.assetType}-${item.symbol.toUpperCase()}`) || 0
                      )}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Important Event / Portfolio Highlight */}
      <div className="lg:col-span-5 glass-card p-3.5 sm:p-4 border border-border/70 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-1.5">
              <span className="w-6 h-6 rounded-lg bg-amber-500/15 text-amber-800 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center">
                <Icon name="sparkles" className="w-3.5 h-3.5" />
              </span>
              <h2 className="text-sm sm:text-base font-semibold text-text-primary">
                Önemli Olay
              </h2>
            </div>
            <Link
              href="/news"
              className="text-xs font-medium text-accent hover:text-accent-hover transition-colors shrink-0"
            >
              Haber Merkezi &rarr;
            </Link>
          </div>

          {eventLoading && !topEvent ? (
            <StateView
              compact
              kind="loading"
              title="Önemli gelişmeler taranıyor"
              description="Portföy ve piyasa haber akışı kontrol ediliyor."
              className="!border-0 !bg-transparent !shadow-none !p-2"
            />
          ) : eventError || !topEvent ? (
            <StateView
              compact
              kind={eventError ? 'error' : 'empty'}
              title={eventError ? 'Haber akışı alınamadı' : 'Öne çıkan önemli olay yok'}
              description={
                eventError
                  ? 'Piyasa haber akışına şu anda ulaşılamıyor.'
                  : 'Bağlı kaynaklarda bugün için öne çıkan başlık bulunamadı.'
              }
              action={
                <Link
                  href="/news"
                  className="inline-flex text-xs font-medium text-accent hover:underline"
                >
                  Haber akışını aç &rarr;
                </Link>
              }
              className="!border-0 !bg-transparent !shadow-none !p-2"
            />
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {topEvent.event && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-800 dark:text-amber-400 border border-amber-500/30">
                    {topEvent.event}
                  </span>
                )}
                {topEvent.matchedSymbols.slice(0, 3).map((sym) => (
                  <span
                    key={sym}
                    className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-accent/15 text-accent border border-accent/25"
                  >
                    {sym}
                  </span>
                ))}
                {isStaleNews && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-bg-tertiary text-text-muted">
                    Önbellek
                  </span>
                )}
              </div>

              <a
                href={topEvent.article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block group"
              >
                <p className="text-xs sm:text-sm font-semibold text-text-primary group-hover:text-accent transition-colors line-clamp-2">
                  {topEvent.article.title}
                </p>
                {topEvent.article.summary && (
                  <p className="text-[11px] text-text-muted line-clamp-2 mt-1">
                    {topEvent.article.summary}
                  </p>
                )}
              </a>
            </div>
          )}
        </div>

        {topEvent && (
          <div className="mt-2.5 pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-text-muted">
            <span className="truncate">{topEvent.article.source}</span>
            <Link href="/news" className="text-accent hover:underline font-medium shrink-0">
              Detayı Gör
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
