'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { DailyPnLCalendarHeatmap } from '@/components/portfolio/DailyPnLCalendarHeatmap';
import { Button, StateView } from '@/components/ui';
import { getSamplePortfolioSnapshot } from '@/lib/portfolio/samplePortfolio';
import { usePortfolioStore } from '@/store/usePortfolioStore';

export default function ActivityPage() {
  const {
    portfolios,
    activePortfolioId,
    setActivePortfolioId,
    transactions,
    livePrices,
    getSummary,
    fetchPortfoliosAndTransactions,
    loading,
    hasLoaded,
    isSampleMode,
  } = usePortfolioStore();

  useEffect(() => {
    fetchPortfoliosAndTransactions();
  }, [fetchPortfoliosAndTransactions]);

  const liveSummary = getSummary();
  const sampleSnapshot = isSampleMode ? getSamplePortfolioSnapshot(livePrices) : null;
  const summary = sampleSnapshot ? sampleSnapshot.summary : liveSummary;
  const activePortfolio = sampleSnapshot
    ? sampleSnapshot.portfolio
    : portfolios.find((p) => p.id === activePortfolioId) || portfolios[0];

  let activeTransactions = sampleSnapshot
    ? sampleSnapshot.transactions
    : transactions.filter((t) => t.portfolioId === activePortfolioId);

  if (!sampleSnapshot && activeTransactions.length === 0 && transactions.length > 0) {
    if (portfolios.length <= 1 || !portfolios.some((p) => transactions.some((t) => t.portfolioId === p.id))) {
      activeTransactions = transactions;
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in pb-12 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-text-primary">Aktivite Takvimi</h1>
          <p className="text-xs sm:text-sm text-text-muted mt-0.5">
            Günlük portföy kâr/zarar performansı ve işlem yoğunluğu
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!sampleSnapshot && portfolios.length > 1 && (
            <select
              aria-label="Aktif portföy"
              value={activePortfolio?.id ?? activePortfolioId}
              onChange={(e) => setActivePortfolioId(e.target.value)}
              className="h-9 min-w-0 sm:w-52 rounded-xl border border-border bg-bg-card px-2.5 text-xs font-semibold text-text-primary truncate focus:outline-hidden focus:border-accent"
            >
              {portfolios.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
          <Link href="/portfolio">
            <Button variant="outline" size="sm">
              Portföye Dön
            </Button>
          </Link>
        </div>
      </div>

      {!hasLoaded && loading ? (
        <StateView
          kind="loading"
          compact
          title="Aktivite verileri yükleniyor"
          description="Portföy işlemleri ve günlük kâr/zarar takvimi hazırlanıyor."
        />
      ) : activeTransactions.length > 0 ? (
        <DailyPnLCalendarHeatmap
          portfolioId={activePortfolio?.id ?? activePortfolioId}
          summary={summary}
          transactions={activeTransactions}
        />
      ) : (
        <StateView
          kind="empty"
          title="Aktivite kaydı bulunmuyor"
          description="Günlük kâr/zarar takvimini görmek için portföyünüze işlem ekleyin."
          action={
            <Link href="/portfolio">
              <Button size="sm">Portföye Git</Button>
            </Link>
          }
        />
      )}
    </div>
  );
}
