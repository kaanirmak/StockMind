'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { calculatePortfolioHistory } from '@/lib/portfolio/history';
import {
  BENCHMARK_OPTIONS,
  buildBenchmarkComparison,
  type BenchmarkId,
  type BenchmarkPeriod,
  type ComparisonCurrency,
  type DatedNumericPoint,
} from '@/lib/portfolio/benchmarkComparison';
import type { PortfolioSummary, Transaction } from '@/types/portfolio';
import type { PriceQuote } from '@/lib/portfolio/calculations';

interface BenchmarkComparisonCardProps {
  transactions: Transaction[];
  summary: PortfolioSummary;
  livePrices: Record<string, PriceQuote | number>;
}

const PERIOD_TO_HISTORY_PARAM: Record<BenchmarkPeriod, '1W' | '1M' | '3M' | '6M' | '1Y'> = {
  '1W': '1W',
  '1M': '1M',
  '3M': '3M',
  '6M': '6M',
  '1Y': '1Y',
};

function extractCandleSeries(candles: unknown): DatedNumericPoint[] {
  if (!Array.isArray(candles)) return [];
  const rows: DatedNumericPoint[] = [];
  for (const c of candles) {
    if (!c || typeof c !== 'object') continue;
    const item = c as { time?: string; date?: string; close?: number; value?: number };
    const date = typeof item.time === 'string' ? item.time : typeof item.date === 'string' ? item.date : '';
    const value = Number(item.close ?? item.value);
    if (date && Number.isFinite(value) && value > 0) {
      rows.push({ date: date.slice(0, 10), value });
    }
  }
  return rows;
}

function formatSignedPct(val: number | null | undefined): string {
  if (typeof val !== 'number' || !Number.isFinite(val)) return '—';
  return `${val >= 0 ? '+' : ''}${val.toFixed(2)}%`;
}

export function BenchmarkComparisonCard({
  transactions,
  summary,
  livePrices,
}: BenchmarkComparisonCardProps) {
  const [benchmarkId, setBenchmarkId] = useState<BenchmarkId>('XU100');
  const [period, setPeriod] = useState<BenchmarkPeriod>('1M');
  const [currency, setCurrency] = useState<ComparisonCurrency>('TRY');

  const [benchSeries, setBenchSeries] = useState<DatedNumericPoint[]>([]);
  const [usdTrySeries, setUsdTrySeries] = useState<DatedNumericPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const selectedBenchmark = useMemo(
    () => BENCHMARK_OPTIONS.find((b) => b.id === benchmarkId) ?? BENCHMARK_OPTIONS[0],
    [benchmarkId]
  );

  useEffect(() => {
    let cancelled = false;
    const tf = PERIOD_TO_HISTORY_PARAM[period];
    const needsFxSeries = currency === 'USD' || selectedBenchmark.nativeCurrency !== currency;

    setLoading(true);
    setFetchError(null);

    Promise.all([
      fetch(`/api/stocks/${encodeURIComponent(selectedBenchmark.symbol)}/history?timeframe=${tf}&exchange=${encodeURIComponent(selectedBenchmark.exchange)}`)
        .then((r) => r.json())
        .catch(() => null),
      needsFxSeries
        ? fetch(`/api/stocks/USDTRY/history?timeframe=${tf}&exchange=FX`)
            .then((r) => r.json())
            .catch(() => null)
        : Promise.resolve(null),
    ]).then(([benchJson, fxJson]) => {
      if (cancelled) return;
      if (!benchJson || !benchJson.success) {
        setBenchSeries([]);
        setFetchError(benchJson?.error || `${selectedBenchmark.label} geçmişi alınamadı.`);
      } else {
        setBenchSeries(extractCandleSeries(benchJson.data));
      }

      if (fxJson && fxJson.success) {
        setUsdTrySeries(extractCandleSeries(fxJson.data));
      } else {
        setUsdTrySeries([]);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [selectedBenchmark, period, currency]);

  const portfolioTrySeries = useMemo<DatedNumericPoint[]>(() => {
    const historyMode = period === '1W' ? 'weekly' : period === '1M' ? 'monthly' : 'total';
    const raw = calculatePortfolioHistory(transactions, summary, historyMode, livePrices);
    const byDate = new Map<string, number>();
    for (const pt of raw) {
      if (!Number.isFinite(pt.value) || pt.value <= 0) continue;
      const dateStr = new Date(pt.date).toISOString().slice(0, 10);
      byDate.set(dateStr, pt.value);
    }
    return Array.from(byDate.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, value]) => ({ date, value }));
  }, [transactions, summary, period, livePrices]);

  const usdQuote = livePrices['USDTRY'] ?? livePrices['USD'];
  const usdTryFallback =
    typeof usdQuote === 'number'
      ? usdQuote
      : usdQuote && typeof usdQuote === 'object'
        ? usdQuote.price
        : null;

  const comparison = useMemo(
    () =>
      buildBenchmarkComparison({
        portfolioTrySeries,
        benchmarkId,
        benchmarkNativeSeries: benchSeries,
        period,
        currency,
        usdTrySeries,
        usdTryFallback,
      }),
    [portfolioTrySeries, benchmarkId, benchSeries, period, currency, usdTrySeries, usdTryFallback]
  );

  const chartSvg = useMemo(() => {
    if (!comparison.comparable || comparison.points.length < 2) return null;
    const allVals = comparison.points.flatMap((p) => [p.portfolioIndexed, p.benchmarkIndexed]);
    const minV = Math.min(...allVals);
    const maxV = Math.max(...allVals);
    const span = Math.max(0.5, maxV - minV);
    const count = comparison.points.length;

    const portPts = comparison.points
      .map((p, idx) => {
        const x = (idx / (count - 1)) * 100;
        const y = 92 - ((p.portfolioIndexed - minV) / span) * 80;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(' ');

    const benchPts = comparison.points
      .map((p, idx) => {
        const x = (idx / (count - 1)) * 100;
        const y = 92 - ((p.benchmarkIndexed - minV) / span) * 80;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(' ');

    const baseLineY = Math.max(4, Math.min(96, 92 - ((100 - minV) / span) * 80));
    return { portPts, benchPts, baseLineY, minV, maxV };
  }, [comparison]);

  return (
    <section
      className="glass-card p-4 sm:p-5 space-y-4"
      data-testid="benchmark-comparison-card"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm sm:text-base font-bold text-text-primary">
              Referans Endeks Karşılaştırması
            </h3>
            <Badge variant="info" size="sm">
              Baz = 100 • {currency}
            </Badge>
          </div>
          <p className="text-xs text-text-muted mt-0.5">
            Portföyünüz ile seçili referansı aynı dönem ve para biriminde ortak başlangıç seviyesinden izleyin.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Referans endeks seç"
            value={benchmarkId}
            onChange={(e) => setBenchmarkId(e.target.value as BenchmarkId)}
            className="bg-bg-secondary text-text-primary border border-border rounded-xl px-2.5 py-1.5 text-xs font-semibold"
          >
            {BENCHMARK_OPTIONS.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </select>

          <div className="inline-flex rounded-xl bg-bg-secondary border border-border p-0.5">
            {(['TRY', 'USD'] as const).map((cur) => (
              <button
                key={cur}
                type="button"
                onClick={() => setCurrency(cur)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  currency === cur ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {cur}
              </button>
            ))}
          </div>

          <div className="inline-flex rounded-xl bg-bg-secondary border border-border p-0.5">
            {(['1W', '1M', '3M', '6M', '1Y'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`px-2 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  period === p ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && (
        <div className="h-36 flex items-center justify-center text-xs text-text-muted">
          {selectedBenchmark.label} ve kur verisi yükleniyor...
        </div>
      )}

      {!loading && comparison.comparable && chartSvg && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            <div className="p-3 rounded-xl bg-bg-tertiary/60 border border-border/50">
              <span className="text-text-muted block">Portföy ({currency})</span>
              <span
                className={`text-sm font-mono font-bold ${
                  (comparison.portfolioReturnPct ?? 0) >= 0 ? 'text-success' : 'text-danger'
                }`}
              >
                {formatSignedPct(comparison.portfolioReturnPct)}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-bg-tertiary/60 border border-border/50">
              <span className="text-text-muted block">
                {selectedBenchmark.label} ({currency})
              </span>
              <span
                className={`text-sm font-mono font-bold ${
                  (comparison.benchmarkReturnPct ?? 0) >= 0 ? 'text-success' : 'text-danger'
                }`}
              >
                {formatSignedPct(comparison.benchmarkReturnPct)}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-bg-tertiary/60 border border-border/50">
              <span className="text-text-muted block">Göreceli Fark (Alfa)</span>
              <span
                className={`text-sm font-mono font-bold ${
                  (comparison.alphaPct ?? 0) >= 0 ? 'text-success' : 'text-danger'
                }`}
              >
                {formatSignedPct(comparison.alphaPct)}
              </span>
            </div>
          </div>

          <div className="h-36 w-full rounded-xl bg-bg-tertiary/30 border border-border/50 p-2">
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="w-full h-full overflow-visible"
              role="img"
              aria-label={`Portföy ve ${selectedBenchmark.label} ortak dönem (${currency}) karşılaştırma grafiği`}
            >
              <line
                x1="0"
                y1={chartSvg.baseLineY}
                x2="100"
                y2={chartSvg.baseLineY}
                stroke="currentColor"
                strokeOpacity="0.2"
                strokeDasharray="2 2"
                strokeWidth="0.6"
              />
              <polyline
                fill="none"
                stroke="#94a3b8"
                strokeWidth="1.4"
                strokeDasharray="2 1.2"
                points={chartSvg.benchPts}
              />
              <polyline
                fill="none"
                stroke="#6366f1"
                strokeWidth="1.8"
                strokeLinecap="round"
                points={chartSvg.portPts}
              />
            </svg>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-text-muted">
            <span className="font-mono">
              {comparison.startDate} – {comparison.endDate} • Başlangıç: 100 ({currency})
            </span>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 text-text-primary font-medium">
                <span className="w-2.5 h-0.5 bg-[#6366f1] inline-block" /> Portföy
              </span>
              <span className="inline-flex items-center gap-1.5 text-text-secondary font-medium">
                <span className="w-2.5 h-0.5 bg-[#94a3b8] inline-block" /> {selectedBenchmark.label}
              </span>
            </div>
          </div>
        </div>
      )}

      {!loading && !comparison.comparable && (
        <div
          data-testid="benchmark-comparison-empty"
          className="p-4 rounded-xl bg-bg-tertiary/40 border border-border/50 text-xs text-text-muted"
        >
          {fetchError || comparison.missingReason || 'Karşılaştırma için yeterli ortak tarihçe bulunamadı.'}
        </div>
      )}
    </section>
  );
}
