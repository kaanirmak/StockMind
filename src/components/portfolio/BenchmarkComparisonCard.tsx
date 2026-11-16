'use client';

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import {
  BENCHMARK_OPTIONS,
  buildBenchmarkComparison,
  buildCompoundInterestSeries,
  type BenchmarkId,
  type BenchmarkPeriod,
  type ComparisonCurrency,
  type DatedNumericPoint,
} from '@/lib/portfolio/benchmarkComparison';
import {
  buildNetInvestedTimeline,
  type NetInvestedPeriod,
  type PriceHistoryBySymbol,
} from '@/lib/portfolio/netInvestedTimeline';
import {
  buildAreaSvgPath,
  buildSmoothSvgPath,
  computeNiceGridTicks,
  type Point2D,
} from '@/lib/portfolio/svgChartMath';
import type { CashMovement, PortfolioSummary, Transaction } from '@/types/portfolio';
import { cleanSymbol, type PriceQuote } from '@/lib/portfolio/calculations';

interface BenchmarkComparisonCardProps {
  transactions: Transaction[];
  cashMovements?: CashMovement[];
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

const PERIOD_TO_TIMELINE_PERIOD: Record<BenchmarkPeriod, NetInvestedPeriod> = {
  '1W': '1M',
  '1M': '1M',
  '3M': '3M',
  '6M': '6M',
  '1Y': '1Y',
};

const PERIOD_DAYS_COUNT: Record<BenchmarkPeriod, number> = {
  '1W': 10,
  '1M': 35,
  '3M': 95,
  '6M': 185,
  '1Y': 370,
};

function toIstanbulDateStr(input: unknown): string {
  if (typeof input === 'number' && Number.isFinite(input)) {
    const ms = input > 1e12 ? input : input * 1000;
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date(ms));
  }
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}/.test(input.trim())) {
    return input.trim().slice(0, 10);
  }
  return '';
}

function extractCandleSeries(candles: unknown): DatedNumericPoint[] {
  if (!Array.isArray(candles)) return [];
  const rows: DatedNumericPoint[] = [];
  for (const c of candles) {
    if (!c || typeof c !== 'object') continue;
    const item = c as { time?: string | number; date?: string | number; close?: number; value?: number; price?: number };
    const date = toIstanbulDateStr(item.time ?? item.date);
    const value = Number(item.close ?? item.price ?? item.value);
    if (date && Number.isFinite(value) && value > 0) {
      rows.push({ date, value });
    }
  }
  return rows;
}

function formatSignedPct(val: number | null | undefined): string {
  if (typeof val !== 'number' || !Number.isFinite(val)) return '—';
  return `${val >= 0 ? '+' : ''}${val.toFixed(2)}%`;
}

function formatShortDate(iso: string): string {
  if (!iso || iso.length < 10) return iso;
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}.${m}.${y.slice(2)}`;
}

const CHART_W = 800;
const CHART_H = 220;
const PAD_LEFT = 52;
const PAD_RIGHT = 16;
const PAD_TOP = 18;
const PAD_BOTTOM = 26;
const PLOT_W = CHART_W - PAD_LEFT - PAD_RIGHT;
const PLOT_H = CHART_H - PAD_TOP - PAD_BOTTOM;

export function BenchmarkComparisonCard({
  transactions,
  cashMovements = [],
  summary,
  livePrices,
}: BenchmarkComparisonCardProps) {
  const gradId = useId().replace(/:/g, '');
  const svgRef = useRef<SVGSVGElement | null>(null);

  const [benchmarkId, setBenchmarkId] = useState<BenchmarkId>('XU100');
  const [period, setPeriod] = useState<BenchmarkPeriod>('1M');
  const [currency, setCurrency] = useState<ComparisonCurrency>('TRY');
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const selectedBenchmark = useMemo(
    () => BENCHMARK_OPTIONS.find((b) => b.id === benchmarkId) ?? BENCHMARK_OPTIONS[0],
    [benchmarkId]
  );

  // Portfolio symbols key
  const assetTargets = useMemo(() => {
    const map = new Map<string, { symbol: string; assetType: 'stock' | 'fund'; exchange: string }>();
    for (const tx of transactions) {
      if (!tx || !tx.symbol) continue;
      const cleaned = cleanSymbol(tx.symbol);
      const sym = cleaned.symbol || tx.symbol.toUpperCase().trim();
      if (!sym || map.has(sym)) continue;
      const ex = (tx.exchange || cleaned.exchange || (tx.assetType === 'fund' ? 'TEFAS' : 'BIST')).toUpperCase();
      map.set(sym, {
        symbol: sym,
        assetType: tx.assetType === 'fund' ? 'fund' : 'stock',
        exchange: ex,
      });
    }
    return Array.from(map.values());
  }, [transactions]);

  const requestKey = useMemo(
    () =>
      `${selectedBenchmark.id}|${period}|${currency}|${assetTargets
        .map((a) => `${a.symbol}:${a.assetType}:${a.exchange}`)
        .sort()
        .join(',')}`,
    [selectedBenchmark.id, period, currency, assetTargets]
  );

  const [loadedState, setLoadedState] = useState<{
    key: string;
    benchSeries: DatedNumericPoint[];
    usdTrySeries: DatedNumericPoint[];
    portfolioHistoryBySymbol: PriceHistoryBySymbol;
    fetchError: string | null;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const tf = PERIOD_TO_HISTORY_PARAM[period];
    const days = PERIOD_DAYS_COUNT[period];
    const isSyntheticInterest = selectedBenchmark.id === 'FAIZ';
    const hasUsdAsset = assetTargets.some((a) => a.exchange === 'NASDAQ' || a.exchange === 'NYSE' || a.exchange === 'AMEX');
    const needsFxSeries = currency === 'USD' || selectedBenchmark.nativeCurrency !== currency || hasUsdAsset;

    void (async () => {
      try {
        const [benchJson, fxJson] = await Promise.all([
          isSyntheticInterest
            ? Promise.resolve(null)
            : fetch(
                `/api/stocks/${encodeURIComponent(selectedBenchmark.symbol)}/history?timeframe=${tf}&exchange=${encodeURIComponent(selectedBenchmark.exchange)}`,
                { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) }
              )
                .then((r) => r.json())
                .catch(() => null),
          needsFxSeries
            ? fetch(`/api/stocks/USDTRY/history?timeframe=${tf}&exchange=FX`, {
                signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
              })
                .then((r) => r.json())
                .catch(() => null)
            : Promise.resolve(null),
        ]);

        const portfolioHistoryBySymbol: PriceHistoryBySymbol = {};
        if (fxJson?.success && Array.isArray(fxJson.data)) {
          const fxMap: Record<string, number> = {};
          for (const pt of extractCandleSeries(fxJson.data)) {
            fxMap[pt.date] = pt.value;
          }
          if (Object.keys(fxMap).length > 0) {
            portfolioHistoryBySymbol['USDTRY'] = fxMap;
          }
        }

        // Fetch historical closes for portfolio assets so profit series reflects real daily prices without capital jumps
        const fetchTf = tf === '1W' ? '1M' : tf;
        for (let i = 0; i < assetTargets.length; i += 4) {
          if (controller.signal.aborted) return;
          await Promise.all(
            assetTargets.slice(i, i + 4).map(async (item) => {
              try {
                const url =
                  item.assetType === 'fund'
                    ? `/api/funds/${encodeURIComponent(item.symbol)}?days=${Math.max(35, days)}`
                    : `/api/stocks/${encodeURIComponent(item.symbol)}/history?timeframe=${fetchTf}&exchange=${encodeURIComponent(item.exchange)}`;
                const res = await fetch(url, {
                  signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
                });
                if (!res.ok) return;
                const json = await res.json();
                if (!json?.success) return;
                const rows = item.assetType === 'fund' ? json.data?.history : json.data;
                const parsed = extractCandleSeries(rows);
                if (parsed.length > 0) {
                  const map: Record<string, number> = {};
                  for (const p of parsed) map[p.date] = p.value;
                  portfolioHistoryBySymbol[item.symbol] = map;
                }
              } catch {
                // Missing individual symbol history falls back gracefully
              }
            })
          );
        }

        if (controller.signal.aborted) return;

        const benchSeries = !isSyntheticInterest && benchJson?.success ? extractCandleSeries(benchJson.data) : [];
        const usdTrySeries = fxJson?.success ? extractCandleSeries(fxJson.data) : [];
        const fetchError =
          !isSyntheticInterest && (!benchJson || !benchJson.success)
            ? benchJson?.error || `${selectedBenchmark.label} geçmişi alınamadı.`
            : null;

        setLoadedState({
          key: requestKey,
          benchSeries,
          usdTrySeries,
          portfolioHistoryBySymbol,
          fetchError,
        });
      } catch {
        if (!controller.signal.aborted) {
          setLoadedState({
            key: requestKey,
            benchSeries: [],
            usdTrySeries: [],
            portfolioHistoryBySymbol: {},
            fetchError: 'Tarihsel veriler alınamadı.',
          });
        }
      }
    })();

    return () => controller.abort();
  }, [requestKey, period, selectedBenchmark, currency, assetTargets]);

  const loading = loadedState?.key !== requestKey;
  const activeLoaded = loadedState?.key === requestKey ? loadedState : null;

  // Build capital-neutral profit performance index (100 * (1 + Net Profit / Net Invested))
  const portfolioProfitTimeline = useMemo(() => {
    const historyBySymbol = activeLoaded?.portfolioHistoryBySymbol ?? {};
    return buildNetInvestedTimeline({
      transactions,
      cashMovements,
      summary,
      livePrices,
      historyBySymbol,
      period: PERIOD_TO_TIMELINE_PERIOD[period],
    });
  }, [transactions, cashMovements, summary, livePrices, activeLoaded?.portfolioHistoryBySymbol, period]);

  const portfolioTrySeries = useMemo<DatedNumericPoint[]>(() => {
    return portfolioProfitTimeline.points
      .map((pt) => {
        const capitalBasis = pt.netInvested > 0 ? pt.netInvested : pt.cumulativeInflows;
        const profitRatio = capitalBasis > 0 ? (pt.portfolioValue - pt.netInvested) / capitalBasis : 0;
        // Scale by net profit percentage rather than raw capital size so new deposits/buys never inflate returns
        const indexedValue = 100 * Math.max(0.05, 1 + profitRatio);
        return {
          date: pt.date,
          value: Number(indexedValue.toFixed(4)),
        };
      })
      .filter((p) => Number.isFinite(p.value) && p.value > 0);
  }, [portfolioProfitTimeline.points]);

  const effectiveBenchSeries = useMemo<DatedNumericPoint[]>(() => {
    if (selectedBenchmark.id === 'FAIZ') {
      return buildCompoundInterestSeries(
        portfolioTrySeries.map((p) => p.date),
        0.48
      );
    }
    return activeLoaded?.benchSeries ?? [];
  }, [selectedBenchmark.id, portfolioTrySeries, activeLoaded?.benchSeries]);

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
        benchmarkNativeSeries: effectiveBenchSeries,
        period,
        currency,
        usdTrySeries: activeLoaded?.usdTrySeries ?? [],
        usdTryFallback,
      }),
    [portfolioTrySeries, benchmarkId, effectiveBenchSeries, period, currency, activeLoaded?.usdTrySeries, usdTryFallback]
  );

  const chartModel = useMemo(() => {
    if (!comparison.comparable || comparison.points.length < 2) return null;
    const pts = comparison.points;
    const count = pts.length;

    const portReturns = pts.map((p) => p.portfolioIndexed - 100);
    const benchReturns = pts.map((p) => p.benchmarkIndexed - 100);
    const minVal = Math.min(0, ...portReturns, ...benchReturns);
    const maxVal = Math.max(0, ...portReturns, ...benchReturns);
    const grid = computeNiceGridTicks(minVal, maxVal, 4);

    const toX = (idx: number) => PAD_LEFT + (idx / (count - 1)) * PLOT_W;
    const toY = (pct: number) => PAD_TOP + (1 - (pct - grid.min) / grid.span) * PLOT_H;

    const portCoords: Point2D[] = portReturns.map((v, idx) => ({ x: toX(idx), y: toY(v) }));
    const benchCoords: Point2D[] = benchReturns.map((v, idx) => ({ x: toX(idx), y: toY(v) }));

    const zeroY = Math.max(PAD_TOP, Math.min(PAD_TOP + PLOT_H, toY(0)));
    const portLinePath = buildSmoothSvgPath(portCoords);
    const portAreaPath = buildAreaSvgPath(portCoords, zeroY);
    const benchLinePath = buildSmoothSvgPath(benchCoords);

    const tickRows = grid.ticks.map((t) => ({
      val: t,
      y: toY(t),
      label: `${t >= 0 ? '+' : ''}${t.toFixed(Math.abs(grid.span) < 5 ? 1 : 0)}%`,
    }));

    const xLabels = [
      { idx: 0, x: toX(0), text: formatShortDate(pts[0].date) },
      { idx: Math.floor((count - 1) / 2), x: toX(Math.floor((count - 1) / 2)), text: formatShortDate(pts[Math.floor((count - 1) / 2)].date) },
      { idx: count - 1, x: toX(count - 1), text: formatShortDate(pts[count - 1].date) },
    ];

    return {
      pts,
      portReturns,
      benchReturns,
      portCoords,
      benchCoords,
      portLinePath,
      portAreaPath,
      benchLinePath,
      zeroY,
      tickRows,
      xLabels,
    };
  }, [comparison]);

  const handlePointerMove = (clientX: number) => {
    if (!svgRef.current || !chartModel) return;
    const rect = svgRef.current.getBoundingClientRect();
    if (rect.width <= 0) return;
    const svgX = ((clientX - rect.left) / rect.width) * CHART_W;
    const clampedRatio = Math.max(0, Math.min(1, (svgX - PAD_LEFT) / PLOT_W));
    const idx = Math.round(clampedRatio * (chartModel.pts.length - 1));
    setHoverIdx(idx);
  };

  const activePointIdx =
    hoverIdx !== null && chartModel && hoverIdx >= 0 && hoverIdx < chartModel.pts.length
      ? hoverIdx
      : null;

  return (
    <section
      className="glass-card p-4 sm:p-5 space-y-4"
      data-testid="benchmark-comparison-card"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm sm:text-base font-bold text-text-primary">
              Yapılan Kâr vs. Referans Endeks Karşılaştırması
            </h3>
            <Badge variant="info" size="sm">
              Kâr Bazlı • {currency}
            </Badge>
          </div>
          <p className="text-xs text-text-muted mt-0.5">
            Anapara eklemelerinden arındırılmış net kâr performansınızı seçili endeks ile aynı dönemde kıyaslayın.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Referans endeks seç"
            value={benchmarkId}
            onChange={(e) => {
              setHoverIdx(null);
              setBenchmarkId(e.target.value as BenchmarkId);
            }}
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
                onClick={() => {
                  setHoverIdx(null);
                  setCurrency(cur);
                }}
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
                onClick={() => {
                  setHoverIdx(null);
                  setPeriod(p);
                }}
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
        <div className="h-44 flex items-center justify-center rounded-xl bg-bg-tertiary/20 border border-border/40 text-xs text-text-muted">
          Portföy kâr tarihçesi ve {selectedBenchmark.label} verisi hazırlanıyor...
        </div>
      )}

      {!loading && comparison.comparable && chartModel && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            <div className="p-3 rounded-xl bg-bg-tertiary/60 border border-border/50">
              <span className="text-text-muted block">Portföy Kâr Getirisi ({currency})</span>
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
              <span className="text-text-muted block">Göreceli Kâr Farkı (Alfa)</span>
              <span
                className={`text-sm font-mono font-bold ${
                  (comparison.alphaPct ?? 0) >= 0 ? 'text-success' : 'text-danger'
                }`}
              >
                {formatSignedPct(comparison.alphaPct)}
              </span>
            </div>
          </div>

          <div className="rounded-xl bg-bg-tertiary/30 border border-border/50 p-3 space-y-2">
            {/* Hover / Latest Data Readout */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] px-1">
              <span className="font-mono text-text-muted">
                {activePointIdx !== null
                  ? formatShortDate(chartModel.pts[activePointIdx].date)
                  : `${formatShortDate(comparison.startDate ?? '')} – ${formatShortDate(comparison.endDate ?? '')}`}
              </span>
              <div className="flex items-center gap-3 font-mono">
                <span className="text-text-primary font-semibold">
                  Portföy:{' '}
                  {formatSignedPct(
                    activePointIdx !== null
                      ? chartModel.portReturns[activePointIdx]
                      : comparison.portfolioReturnPct
                  )}
                </span>
                <span className="text-sky-400 font-semibold">
                  {selectedBenchmark.label}:{' '}
                  {formatSignedPct(
                    activePointIdx !== null
                      ? chartModel.benchReturns[activePointIdx]
                      : comparison.benchmarkReturnPct
                  )}
                </span>
              </div>
            </div>

            <svg
              ref={svgRef}
              viewBox={`0 0 ${CHART_W} ${CHART_H}`}
              className="w-full h-52 sm:h-56 select-none touch-none"
              role="img"
              aria-label={`Portföy net kârı ve ${selectedBenchmark.label} (${currency}) karşılaştırma grafiği`}
              onMouseMove={(e) => handlePointerMove(e.clientX)}
              onMouseLeave={() => setHoverIdx(null)}
              onTouchMove={(e) => {
                if (e.touches[0]) handlePointerMove(e.touches[0].clientX);
              }}
              onTouchEnd={() => setHoverIdx(null)}
            >
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Horizontal Grid Lines & Y-Axis Labels */}
              {chartModel.tickRows.map((tick, idx) => (
                <g key={idx}>
                  <line
                    x1={PAD_LEFT}
                    y1={tick.y}
                    x2={CHART_W - PAD_RIGHT}
                    y2={tick.y}
                    stroke="currentColor"
                    strokeOpacity="0.12"
                    strokeDasharray="4 4"
                    strokeWidth={1}
                    vectorEffect="non-scaling-stroke"
                  />
                  <text
                    x={PAD_LEFT - 8}
                    y={tick.y + 3.5}
                    textAnchor="end"
                    fill="currentColor"
                    fillOpacity="0.5"
                    fontSize="10"
                    fontFamily="monospace"
                  >
                    {tick.label}
                  </text>
                </g>
              ))}

              {/* 0% Break-Even Baseline */}
              <line
                x1={PAD_LEFT}
                y1={chartModel.zeroY}
                x2={CHART_W - PAD_RIGHT}
                y2={chartModel.zeroY}
                stroke="currentColor"
                strokeOpacity="0.28"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />

              {/* X-Axis Dates */}
              {chartModel.xLabels.map((lbl, idx) => (
                <text
                  key={idx}
                  x={lbl.x}
                  y={CHART_H - 6}
                  textAnchor={idx === 0 ? 'start' : idx === chartModel.xLabels.length - 1 ? 'end' : 'middle'}
                  fill="currentColor"
                  fillOpacity="0.45"
                  fontSize="10"
                  fontFamily="monospace"
                >
                  {lbl.text}
                </text>
              ))}

              {/* Portfolio Area Fill */}
              <path d={chartModel.portAreaPath} fill={`url(#${gradId})`} />

              {/* Benchmark Smooth Line */}
              <path
                d={chartModel.benchLinePath}
                fill="none"
                stroke="#38bdf8"
                strokeWidth={1.85}
                strokeDasharray="5 4"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />

              {/* Portfolio Smooth Line */}
              <path
                d={chartModel.portLinePath}
                fill="none"
                stroke="#8b5cf6"
                strokeWidth={2.5}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />

              {/* End Markers */}
              <circle
                cx={chartModel.benchCoords[chartModel.benchCoords.length - 1].x}
                cy={chartModel.benchCoords[chartModel.benchCoords.length - 1].y}
                r={3.5}
                fill="#38bdf8"
              />
              <circle
                cx={chartModel.portCoords[chartModel.portCoords.length - 1].x}
                cy={chartModel.portCoords[chartModel.portCoords.length - 1].y}
                r={6.5}
                fill="#8b5cf6"
                fillOpacity="0.22"
              />
              <circle
                cx={chartModel.portCoords[chartModel.portCoords.length - 1].x}
                cy={chartModel.portCoords[chartModel.portCoords.length - 1].y}
                r={3.75}
                fill="#8b5cf6"
              />

              {/* Interactive Crosshair & Dots */}
              {activePointIdx !== null && (
                <g>
                  <line
                    x1={chartModel.portCoords[activePointIdx].x}
                    y1={PAD_TOP}
                    x2={chartModel.portCoords[activePointIdx].x}
                    y2={PAD_TOP + PLOT_H}
                    stroke="currentColor"
                    strokeOpacity="0.3"
                    strokeDasharray="3 3"
                    strokeWidth={1}
                    vectorEffect="non-scaling-stroke"
                  />
                  <circle
                    cx={chartModel.benchCoords[activePointIdx].x}
                    cy={chartModel.benchCoords[activePointIdx].y}
                    r={4}
                    fill="#38bdf8"
                    stroke="#0f172a"
                    strokeWidth={1.5}
                  />
                  <circle
                    cx={chartModel.portCoords[activePointIdx].x}
                    cy={chartModel.portCoords[activePointIdx].y}
                    r={4.5}
                    fill="#8b5cf6"
                    stroke="#ffffff"
                    strokeWidth={1.5}
                  />
                </g>
              )}
            </svg>

            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-text-muted pt-1 border-t border-border/30">
              <span>Portföy kâr oranı = Net Kâr / Yatırılan Anapara</span>
              <div className="flex items-center gap-4">
                <span className="inline-flex items-center gap-1.5 text-text-primary font-medium">
                  <span className="w-3 h-0.5 bg-[#8b5cf6] rounded-full inline-block" /> Portföy Kârı
                </span>
                <span className="inline-flex items-center gap-1.5 text-text-secondary font-medium">
                  <span className="w-3 h-0.5 bg-[#38bdf8] rounded-full inline-block" /> {selectedBenchmark.label}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {!loading && !comparison.comparable && (
        <div
          data-testid="benchmark-comparison-empty"
          className="p-4 rounded-xl bg-bg-tertiary/40 border border-border/50 text-xs text-text-muted"
        >
          {selectedBenchmark.id === 'FAIZ'
            ? (comparison.missingReason || 'Karşılaştırma için yeterli ortak tarihçe bulunamadı.')
            : (activeLoaded?.fetchError || comparison.missingReason || 'Karşılaştırma için yeterli ortak tarihçe bulunamadı.')}
        </div>
      )}
    </section>
  );
}
