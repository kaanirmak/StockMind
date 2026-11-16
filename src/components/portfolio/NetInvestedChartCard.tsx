'use client';

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import {
  buildNetInvestedTimeline,
  type AlternativeBenchmarkId,
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
import { maskDisplayValue } from '@/lib/privacy';

interface NetInvestedChartCardProps {
  transactions: Transaction[];
  cashMovements: CashMovement[];
  summary: PortfolioSummary;
  livePrices: Record<string, PriceQuote | number>;
  isPrivacyMode?: boolean;
}

type ToggleableSeriesKey = 'netInvested' | AlternativeBenchmarkId;
type ChartDisplayMode = 'profit' | 'total';

const PERIOD_LABELS: { id: NetInvestedPeriod; label: string }[] = [
  { id: '1M', label: '1A' },
  { id: '3M', label: '3A' },
  { id: '6M', label: '6A' },
  { id: '1Y', label: '1Y' },
  { id: 'ALL', label: 'Tümü' },
];

const SERIES_META: {
  key: ToggleableSeriesKey;
  label: string;
  color: string;
  dashed?: boolean;
}[] = [
  { key: 'netInvested', label: 'Net Yatırılan Anapara', color: '#10b981', dashed: true },
  { key: 'bist100', label: 'BIST 100', color: '#38bdf8' },
  { key: 'gold', label: 'Altın (TL)', color: '#f59e0b' },
  { key: 'interest', label: 'Mevduat Faizi (%48)', color: '#a855f7', dashed: true },
  { key: 'usd', label: 'Dolar (USD)', color: '#22c55e' },
];

function fmtTry(value: number, privacy = false): string {
  return maskDisplayValue(
    `₺${value.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`,
    privacy,
    '₺••••'
  );
}

function fmtSignedTry(value: number, privacy = false): string {
  const absFormatted = Math.abs(value).toLocaleString('tr-TR', {
    maximumFractionDigits: 0,
  });
  return maskDisplayValue(
    `${value >= 0 ? '+' : '-'}₺${absFormatted}`,
    privacy,
    '₺••••'
  );
}

function fmtAxisTry(value: number, privacy = false): string {
  if (privacy) return '₺••';
  const sign = value < 0 ? '-' : value > 0 ? '' : '';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${sign}₺${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}₺${(abs / 1_000).toFixed(0)}K`;
  return `${sign}₺${abs.toFixed(0)}`;
}

function formatShortDate(iso: string): string {
  if (!iso || iso.length < 10) return iso;
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}.${m}.${y.slice(2)}`;
}

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

function mapSeriesToCoords(
  values: (number | undefined)[],
  toX: (idx: number) => number,
  toY: (val: number) => number
): Point2D[] {
  const coords: Point2D[] = [];
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (typeof v !== 'number' || !Number.isFinite(v)) continue;
    coords.push({ x: toX(i), y: toY(v) });
  }
  return coords;
}

const CHART_W = 800;
const CHART_H = 240;
const PAD_LEFT = 58;
const PAD_RIGHT = 16;
const PAD_TOP = 18;
const PLOT_BOTTOM = 178;
const PLOT_H = PLOT_BOTTOM - PAD_TOP;
const FLOW_BASE_Y = 202;
const PLOT_W = CHART_W - PAD_LEFT - PAD_RIGHT;

export function NetInvestedChartCard({
  transactions,
  cashMovements,
  summary,
  livePrices,
  isPrivacyMode = false,
}: NetInvestedChartCardProps) {
  const gradId = useId().replace(/:/g, '');
  const svgRef = useRef<SVGSVGElement | null>(null);

  const [period, setPeriod] = useState<NetInvestedPeriod>('ALL');
  const [displayMode, setDisplayMode] = useState<ChartDisplayMode>('profit');
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [visibleSeries, setVisibleSeries] = useState<Record<ToggleableSeriesKey, boolean>>({
    netInvested: true,
    bist100: true,
    gold: true,
    interest: true,
    usd: false,
  });

  const assetTargets = useMemo(() => {
    const targets = new Map<
      string,
      { symbol: string; assetType: 'stock' | 'fund'; exchange: string }
    >();
    let earliestDate = '9999-12-31';

    for (const tx of transactions) {
      if (!tx || !tx.symbol) continue;
      if (tx.transactionDate && tx.transactionDate.slice(0, 10) < earliestDate) {
        earliestDate = tx.transactionDate.slice(0, 10);
      }
      const cleaned = cleanSymbol(tx.symbol);
      const sym = cleaned.symbol || tx.symbol.toUpperCase().trim();
      if (!sym) continue;
      const ex = (tx.exchange || cleaned.exchange || (tx.assetType === 'fund' ? 'TEFAS' : 'BIST')).toUpperCase();
      if (!targets.has(sym)) {
        targets.set(sym, {
          symbol: sym,
          assetType: tx.assetType === 'fund' ? 'fund' : 'stock',
          exchange: ex,
        });
      }
    }

    for (const m of cashMovements) {
      if (m.movementDate && m.movementDate.slice(0, 10) < earliestDate) {
        earliestDate = m.movementDate.slice(0, 10);
      }
    }

    if (!targets.has('XU100')) {
      targets.set('XU100', { symbol: 'XU100', assetType: 'stock', exchange: 'BIST' });
    }
    if (!targets.has('XAUTRYG')) {
      targets.set('XAUTRYG', { symbol: 'XAUTRYG', assetType: 'stock', exchange: 'COMMODITY' });
    }
    if (!targets.has('USDTRY')) {
      targets.set('USDTRY', { symbol: 'USDTRY', assetType: 'stock', exchange: 'FX' });
    }

    return {
      list: Array.from(targets.values()),
      earliestDate: earliestDate === '9999-12-31' ? '' : earliestDate,
    };
  }, [transactions, cashMovements]);

  const requestKey = useMemo(
    () =>
      `${assetTargets.earliestDate}|${assetTargets.list
        .map((t) => `${t.symbol}:${t.assetType}:${t.exchange}`)
        .sort()
        .join(',')}`,
    [assetTargets]
  );

  const [loadedHistory, setLoadedHistory] = useState<{
    key: string;
    historyBySymbol: PriceHistoryBySymbol;
  } | null>(null);

  useEffect(() => {
    if (transactions.length === 0 && cashMovements.length === 0) return;

    const controller = new AbortController();
    const earliestMs = assetTargets.earliestDate
      ? Date.parse(`${assetTargets.earliestDate}T12:00:00Z`)
      : Date.now();
    const spanDays = Number.isFinite(earliestMs)
      ? Math.max(30, Math.round((Date.now() - earliestMs) / 86_400_000))
      : 180;
    const stockTimeframe =
      spanDays > 350 ? '5Y' : spanDays > 175 ? '1Y' : spanDays > 85 ? '6M' : spanDays > 28 ? '3M' : '1M';
    const fundDays = Math.max(30, Math.min(1095, spanDays + 14));

    void (async () => {
      const nextHistory: PriceHistoryBySymbol = {};
      const entries = assetTargets.list;

      for (let i = 0; i < entries.length; i += 4) {
        if (controller.signal.aborted) return;
        await Promise.all(
          entries.slice(i, i + 4).map(async (item) => {
            try {
              const url =
                item.assetType === 'fund'
                  ? `/api/funds/${encodeURIComponent(item.symbol)}?days=${fundDays}`
                  : `/api/stocks/${encodeURIComponent(item.symbol)}/history?timeframe=${stockTimeframe}&exchange=${encodeURIComponent(item.exchange)}`;
              const res = await fetch(url, {
                signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
              });
              if (!res.ok) return;
              const json = await res.json();
              if (!json?.success) return;
              const rows = item.assetType === 'fund' ? json.data?.history : json.data;
              if (!Array.isArray(rows) || rows.length === 0) return;

              const map: Record<string, number> = {};
              for (const row of rows) {
                if (!row || typeof row !== 'object') continue;
                const day = toIstanbulDateStr(row.time ?? row.date);
                const price = Number(row.close ?? row.price ?? row.value);
                if (/^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(price) && price > 0) {
                  map[day] = price;
                }
              }
              if (Object.keys(map).length > 0) {
                nextHistory[item.symbol] = map;
              }
            } catch {
              // Disclosed accurately in coverage notice
            }
          })
        );
      }

      if (!controller.signal.aborted) {
        setLoadedHistory({ key: requestKey, historyBySymbol: nextHistory });
      }
    })();

    return () => controller.abort();
  }, [requestKey, assetTargets, transactions.length, cashMovements.length]);

  const hasActivity = transactions.length > 0 || cashMovements.length > 0;
  const historyLoading = hasActivity && loadedHistory?.key !== requestKey;
  const historyBySymbol = useMemo(
    () => (loadedHistory?.key === requestKey ? loadedHistory.historyBySymbol : {}),
    [loadedHistory, requestKey]
  );

  const timeline = useMemo(
    () =>
      buildNetInvestedTimeline({
        transactions,
        cashMovements,
        summary,
        livePrices,
        historyBySymbol,
        period,
      }),
    [transactions, cashMovements, summary, livePrices, historyBySymbol, period]
  );

  const benchmarkMap = useMemo(() => {
    const map = new Map<AlternativeBenchmarkId, (typeof timeline.benchmarks)[number]>();
    for (const b of timeline.benchmarks) {
      map.set(b.id, b);
    }
    return map;
  }, [timeline]);

  const chartModel = useMemo(() => {
    const pts = timeline.points;
    if (pts.length < 2) return null;

    const toSeriesValue = (rawVal: number | undefined, netInv: number): number | undefined => {
      if (typeof rawVal !== 'number' || !Number.isFinite(rawVal)) return undefined;
      return displayMode === 'profit' ? rawVal - netInv : rawVal;
    };

    const portVals = pts.map((p) =>
      displayMode === 'profit' ? p.portfolioValue - p.netInvested : p.portfolioValue
    );
    const investedVals = pts.map((p) => p.netInvested);
    const bistVals = pts.map((p) => toSeriesValue(p.bist100Value, p.netInvested));
    const goldVals = pts.map((p) => toSeriesValue(p.goldValue, p.netInvested));
    const interestVals = pts.map((p) => toSeriesValue(p.interestValue, p.netInvested));
    const usdVals = pts.map((p) => toSeriesValue(p.usdValue, p.netInvested));

    const allSeriesVals: number[] = [0, ...portVals];
    if (displayMode === 'total' && visibleSeries.netInvested) {
      allSeriesVals.push(...investedVals);
    }
    const pushDefined = (arr: (number | undefined)[]) => {
      for (const v of arr) {
        if (typeof v === 'number' && Number.isFinite(v)) allSeriesVals.push(v);
      }
    };
    if (visibleSeries.bist100) pushDefined(bistVals);
    if (visibleSeries.gold) pushDefined(goldVals);
    if (visibleSeries.interest) pushDefined(interestVals);
    if (visibleSeries.usd) pushDefined(usdVals);

    const rawMin = Math.min(...allSeriesVals);
    const rawMax = Math.max(...allSeriesVals);
    const grid = computeNiceGridTicks(rawMin, rawMax, 4);

    const count = pts.length;
    const toX = (idx: number) => PAD_LEFT + (idx / (count - 1)) * PLOT_W;
    const toY = (val: number) => PAD_TOP + (1 - (val - grid.min) / grid.span) * PLOT_H;

    const zeroY = Math.max(PAD_TOP, Math.min(PLOT_BOTTOM, toY(0)));
    const portCoords = mapSeriesToCoords(portVals, toX, toY);
    const investedCoords =
      displayMode === 'total' && visibleSeries.netInvested
        ? mapSeriesToCoords(investedVals, toX, toY)
        : [];
    const bistCoords = visibleSeries.bist100 ? mapSeriesToCoords(bistVals, toX, toY) : [];
    const goldCoords = visibleSeries.gold ? mapSeriesToCoords(goldVals, toX, toY) : [];
    const interestCoords = visibleSeries.interest ? mapSeriesToCoords(interestVals, toX, toY) : [];
    const usdCoords = visibleSeries.usd ? mapSeriesToCoords(usdVals, toX, toY) : [];

    const maxFlow = Math.max(
      1,
      ...pts.map((p) => Math.max(p.dailyInflow, p.dailyOutflow))
    );
    const flowBars = pts
      .map((p, idx) => {
        if (p.dailyInflow <= 0 && p.dailyOutflow <= 0) return null;
        const x = toX(idx);
        const inHeight = p.dailyInflow > 0 ? Math.max(3, (p.dailyInflow / maxFlow) * 14) : 0;
        const outHeight = p.dailyOutflow > 0 ? Math.max(3, (p.dailyOutflow / maxFlow) * 14) : 0;
        return { date: p.date, x, inHeight, outHeight };
      })
      .filter((b): b is { date: string; x: number; inHeight: number; outHeight: number } => Boolean(b));

    const tickRows = grid.ticks.map((val) => ({
      val,
      y: toY(val),
      label: fmtAxisTry(val, isPrivacyMode),
    }));

    const midIdx = Math.floor((count - 1) / 2);
    const xLabels = [
      { idx: 0, x: toX(0), text: formatShortDate(pts[0].date) },
      { idx: midIdx, x: toX(midIdx), text: formatShortDate(pts[midIdx].date) },
      { idx: count - 1, x: toX(count - 1), text: formatShortDate(pts[count - 1].date) },
    ];

    return {
      pts,
      portVals,
      bistVals,
      goldVals,
      interestVals,
      usdVals,
      portCoords,
      portPath: buildSmoothSvgPath(portCoords),
      portAreaPath: buildAreaSvgPath(portCoords, zeroY),
      investedCoords,
      investedPath: buildSmoothSvgPath(investedCoords),
      bistCoords,
      bistPath: buildSmoothSvgPath(bistCoords),
      goldCoords,
      goldPath: buildSmoothSvgPath(goldCoords),
      interestCoords,
      interestPath: buildSmoothSvgPath(interestCoords),
      usdCoords,
      usdPath: buildSmoothSvgPath(usdCoords),
      zeroY,
      tickRows,
      flowBars,
      xLabels,
    };
  }, [timeline, visibleSeries, displayMode, isPrivacyMode]);

  const handlePointerMove = (clientX: number) => {
    if (!svgRef.current || !chartModel) return;
    const rect = svgRef.current.getBoundingClientRect();
    if (rect.width <= 0) return;
    const svgX = ((clientX - rect.left) / rect.width) * CHART_W;
    const clampedRatio = Math.max(0, Math.min(1, (svgX - PAD_LEFT) / PLOT_W));
    const idx = Math.round(clampedRatio * (chartModel.pts.length - 1));
    setHoverIdx(idx);
  };

  const toggleSeries = (key: ToggleableSeriesKey) => {
    setVisibleSeries((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const activePointIdx =
    hoverIdx !== null && chartModel && hoverIdx >= 0 && hoverIdx < chartModel.pts.length
      ? hoverIdx
      : null;

  const netReturnPct =
    timeline.netInvestedTotal > 0
      ? (timeline.netGainAmount / timeline.netInvestedTotal) * 100
      : 0;

  return (
    <section
      className="glass-card p-4 sm:p-5 space-y-4"
      data-testid="net-invested-chart-card"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm sm:text-base font-bold text-text-primary">
              Portföy Kârı vs. Yatırılan Tutar &amp; Alternatif Yatırımlar
            </h3>
            {historyLoading ? (
              <Badge variant="info" size="sm">
                Tarihçe Yükleniyor...
              </Badge>
            ) : (
              <Badge variant={timeline.coverage.isComplete ? 'success' : 'warning'} size="sm">
                Kapsam %{timeline.coverage.coveragePercent}
              </Badge>
            )}
          </div>
          <p className="text-xs text-text-muted mt-0.5">
            Aynı para giriş/çıkışlarıyla elde edilen net kârınızı BIST 100, Altın, Mevduat Faizi (%48) ve Dolar ile kıyaslayın.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl bg-bg-secondary border border-border p-0.5">
            <button
              type="button"
              onClick={() => setDisplayMode('profit')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                displayMode === 'profit' ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Net Kâr (₺)
            </button>
            <button
              type="button"
              onClick={() => setDisplayMode('total')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                displayMode === 'total' ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Toplam Değer
            </button>
          </div>

          <div className="inline-flex rounded-xl bg-bg-secondary border border-border p-0.5">
            {PERIOD_LABELS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setHoverIdx(null);
                  setPeriod(opt.id);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  period === opt.id ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Primary KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
        <div className="p-3 rounded-xl bg-bg-tertiary/60 border border-border/50 space-y-0.5">
          <span className="text-text-muted block">Portföy Net Kârı</span>
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span
              className={`text-sm font-mono font-bold ${
                timeline.netGainAmount >= 0 ? 'text-success' : 'text-danger'
              }`}
            >
              {fmtSignedTry(timeline.netGainAmount, isPrivacyMode)}
            </span>
            <span
              className={`text-[11px] font-mono font-semibold ${
                netReturnPct >= 0 ? 'text-success' : 'text-danger'
              }`}
            >
              ({netReturnPct >= 0 ? '+' : ''}
              {netReturnPct.toFixed(1)}%)
            </span>
          </div>
          <span className="text-[10px] font-mono text-text-muted block">
            Toplam: {fmtTry(timeline.latestPortfolioValue, isPrivacyMode)}
          </span>
        </div>
        <div className="p-3 rounded-xl bg-bg-tertiary/60 border border-border/50 space-y-0.5">
          <span className="text-text-muted block">Net Yatırılan Anapara</span>
          <span className="text-sm font-mono font-bold text-text-primary block">
            {fmtTry(timeline.netInvestedTotal, isPrivacyMode)}
          </span>
          <span className="text-[10px] text-text-muted block">Giriş − Çıkış dengesi</span>
        </div>
        <div className="p-3 rounded-xl bg-bg-tertiary/60 border border-border/50 space-y-0.5">
          <span className="text-text-muted block">Para Girişleri</span>
          <span className="text-sm font-mono font-bold text-success block">
            +{fmtTry(timeline.totalInflows, isPrivacyMode)}
          </span>
          <span className="text-[10px] text-text-muted block">Dönem içi alım/yatırım</span>
        </div>
        <div className="p-3 rounded-xl bg-bg-tertiary/60 border border-border/50 space-y-0.5">
          <span className="text-text-muted block">Para Çıkışları</span>
          <span className="text-sm font-mono font-bold text-danger block">
            -{fmtTry(timeline.totalOutflows, isPrivacyMode)}
          </span>
          <span className="text-[10px] text-text-muted block">Satış/çekim tutarı</span>
        </div>
      </div>

      {/* Alternative Investment Net Profit Comparison Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
        {(['bist100', 'gold', 'interest', 'usd'] as const).map((id) => {
          const item = benchmarkMap.get(id);
          const meta = SERIES_META.find((m) => m.key === id);
          if (!item || !meta) return null;
          const outperforming = item.diffVsPortfolio >= 0;
          return (
            <div
              key={id}
              className="p-3 rounded-xl bg-bg-secondary/60 border border-border/60 space-y-1"
            >
              <div className="flex items-center justify-between gap-1">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-text-secondary">
                  <span
                    className="w-2 h-2 rounded-full inline-block shrink-0"
                    style={{ backgroundColor: meta.color }}
                  />
                  {item.label}
                </span>
                {item.available && (
                  <span
                    className={`text-[10px] font-mono font-bold ${
                      item.returnPercent >= 0 ? 'text-success' : 'text-danger'
                    }`}
                  >
                    {item.returnPercent >= 0 ? '+' : ''}
                    {item.returnPercent.toFixed(1)}%
                  </span>
                )}
              </div>
              <div
                className={`text-sm font-mono font-bold ${
                  item.available
                    ? item.returnAmount >= 0
                      ? 'text-text-primary'
                      : 'text-danger'
                    : 'text-text-muted'
                }`}
              >
                {item.available
                  ? `${fmtSignedTry(item.returnAmount, isPrivacyMode)} kâr`
                  : historyLoading
                    ? 'Yükleniyor...'
                    : 'Veri yok'}
              </div>
              {item.available && (
                <div className="space-y-0.5">
                  <div className="text-[10px] font-mono text-text-muted">
                    Toplam: {fmtTry(item.currentValue, isPrivacyMode)}
                  </div>
                  <div
                    className={`text-[10px] font-mono font-medium ${
                      outperforming ? 'text-success' : 'text-danger'
                    }`}
                  >
                    Portföy {fmtSignedTry(item.diffVsPortfolio, isPrivacyMode)}{' '}
                    {outperforming ? 'önde' : 'geride'}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Interactive Comparison Toggles */}
      <div className="flex flex-wrap items-center gap-1.5">
        {SERIES_META.filter((s) => displayMode === 'total' || s.key !== 'netInvested').map((s) => {
          const active = visibleSeries[s.key];
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => toggleSeries(s.key)}
              aria-pressed={active}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer ${
                active
                  ? 'bg-bg-tertiary text-text-primary border-border'
                  : 'bg-bg-secondary/40 text-text-muted border-border/40 opacity-70 hover:opacity-100'
              }`}
            >
              <span
                className="w-2 h-2 rounded-full inline-block shrink-0"
                style={{ backgroundColor: s.color }}
              />
              <span>{s.label}</span>
            </button>
          );
        })}
      </div>

      {chartModel && chartModel.portPath ? (
        <div
          className="rounded-xl bg-bg-tertiary/30 border border-border/50 p-3 space-y-2"
          data-testid="net-invested-chart"
        >
          {/* Hover / Latest Readout */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] px-1">
            <span className="font-mono text-text-muted">
              {activePointIdx !== null
                ? formatShortDate(chartModel.pts[activePointIdx].date)
                : `${formatShortDate(chartModel.pts[0].date)} – ${formatShortDate(chartModel.pts[chartModel.pts.length - 1].date)}`}
            </span>
            <div className="flex flex-wrap items-center gap-3 font-mono">
              <span className="text-text-primary font-semibold">
                Portföy:{' '}
                {displayMode === 'profit'
                  ? fmtSignedTry(
                      chartModel.portVals[activePointIdx ?? chartModel.pts.length - 1],
                      isPrivacyMode
                    )
                  : fmtTry(
                      chartModel.portVals[activePointIdx ?? chartModel.pts.length - 1],
                      isPrivacyMode
                    )}
              </span>
              {visibleSeries.bist100 &&
                typeof chartModel.bistVals[activePointIdx ?? chartModel.pts.length - 1] === 'number' && (
                  <span className="text-sky-400 font-semibold">
                    BIST 100:{' '}
                    {displayMode === 'profit'
                      ? fmtSignedTry(
                          chartModel.bistVals[activePointIdx ?? chartModel.pts.length - 1]!,
                          isPrivacyMode
                        )
                      : fmtTry(
                          chartModel.bistVals[activePointIdx ?? chartModel.pts.length - 1]!,
                          isPrivacyMode
                        )}
                  </span>
                )}
              {visibleSeries.gold &&
                typeof chartModel.goldVals[activePointIdx ?? chartModel.pts.length - 1] === 'number' && (
                  <span className="text-amber-400 font-semibold">
                    Altın:{' '}
                    {displayMode === 'profit'
                      ? fmtSignedTry(
                          chartModel.goldVals[activePointIdx ?? chartModel.pts.length - 1]!,
                          isPrivacyMode
                        )
                      : fmtTry(
                          chartModel.goldVals[activePointIdx ?? chartModel.pts.length - 1]!,
                          isPrivacyMode
                        )}
                  </span>
                )}
              {visibleSeries.interest &&
                typeof chartModel.interestVals[activePointIdx ?? chartModel.pts.length - 1] === 'number' && (
                  <span className="text-purple-400 font-semibold">
                    Faiz:{' '}
                    {displayMode === 'profit'
                      ? fmtSignedTry(
                          chartModel.interestVals[activePointIdx ?? chartModel.pts.length - 1]!,
                          isPrivacyMode
                        )
                      : fmtTry(
                          chartModel.interestVals[activePointIdx ?? chartModel.pts.length - 1]!,
                          isPrivacyMode
                        )}
                  </span>
                )}
            </div>
          </div>

          <svg
            ref={svgRef}
            viewBox={`0 0 ${CHART_W} ${CHART_H}`}
            className="w-full h-56 sm:h-60 select-none touch-none"
            role="img"
            aria-label="Portföy net kârı, yatırılan tutar ve alternatif yatırım karşılaştırma grafiği"
            onMouseMove={(e) => handlePointerMove(e.clientX)}
            onMouseLeave={() => setHoverIdx(null)}
            onTouchMove={(e) => {
              if (e.touches[0]) handlePointerMove(e.touches[0].clientX);
            }}
            onTouchEnd={() => setHoverIdx(null)}
          >
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Horizontal Grid Lines & Y-Axis TRY Labels */}
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

            {/* ₺0 Break-Even Line */}
            <line
              x1={PAD_LEFT}
              y1={chartModel.zeroY}
              x2={CHART_W - PAD_RIGHT}
              y2={chartModel.zeroY}
              stroke="currentColor"
              strokeOpacity="0.25"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />

            {/* Cash Flow Activity Baseline Strip */}
            <line
              x1={PAD_LEFT}
              y1={FLOW_BASE_Y}
              x2={CHART_W - PAD_RIGHT}
              y2={FLOW_BASE_Y}
              stroke="currentColor"
              strokeOpacity="0.14"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
            {chartModel.flowBars.map((bar) => (
              <g key={bar.date}>
                {bar.inHeight > 0 && (
                  <rect
                    x={bar.x - 2}
                    y={FLOW_BASE_Y - bar.inHeight}
                    width={4}
                    height={bar.inHeight}
                    rx={1.5}
                    fill="#10b981"
                    fillOpacity="0.72"
                  />
                )}
                {bar.outHeight > 0 && (
                  <rect
                    x={bar.x - 2}
                    y={FLOW_BASE_Y}
                    width={4}
                    height={bar.outHeight}
                    rx={1.5}
                    fill="#ef4444"
                    fillOpacity="0.72"
                  />
                )}
              </g>
            ))}

            {/* X-Axis Date Labels */}
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

            {/* Portfolio Area Gradient Fill */}
            <path d={chartModel.portAreaPath} fill={`url(#${gradId})`} />

            {chartModel.investedPath && (
              <path
                d={chartModel.investedPath}
                fill="none"
                stroke="#10b981"
                strokeWidth={1.6}
                strokeDasharray="5 4"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            )}
            {chartModel.bistPath && (
              <path
                d={chartModel.bistPath}
                fill="none"
                stroke="#38bdf8"
                strokeWidth={1.75}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            )}
            {chartModel.goldPath && (
              <path
                d={chartModel.goldPath}
                fill="none"
                stroke="#f59e0b"
                strokeWidth={1.75}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            )}
            {chartModel.interestPath && (
              <path
                d={chartModel.interestPath}
                fill="none"
                stroke="#a855f7"
                strokeWidth={1.65}
                strokeDasharray="4 4"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            )}
            {chartModel.usdPath && (
              <path
                d={chartModel.usdPath}
                fill="none"
                stroke="#22c55e"
                strokeWidth={1.65}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            )}

            {/* Primary Portfolio Curve */}
            <path
              d={chartModel.portPath}
              fill="none"
              stroke="#6366f1"
              strokeWidth={2.5}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />

            {/* End Point Glow Dot */}
            {chartModel.portCoords.length > 0 && (
              <g>
                <circle
                  cx={chartModel.portCoords[chartModel.portCoords.length - 1].x}
                  cy={chartModel.portCoords[chartModel.portCoords.length - 1].y}
                  r={6.5}
                  fill="#6366f1"
                  fillOpacity="0.22"
                />
                <circle
                  cx={chartModel.portCoords[chartModel.portCoords.length - 1].x}
                  cy={chartModel.portCoords[chartModel.portCoords.length - 1].y}
                  r={3.75}
                  fill="#6366f1"
                />
              </g>
            )}

            {/* Interactive Hover Crosshair */}
            {activePointIdx !== null && chartModel.portCoords[activePointIdx] && (
              <g>
                <line
                  x1={chartModel.portCoords[activePointIdx].x}
                  y1={PAD_TOP}
                  x2={chartModel.portCoords[activePointIdx].x}
                  y2={PLOT_BOTTOM}
                  stroke="currentColor"
                  strokeOpacity="0.3"
                  strokeDasharray="3 3"
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
                <circle
                  cx={chartModel.portCoords[activePointIdx].x}
                  cy={chartModel.portCoords[activePointIdx].y}
                  r={4.5}
                  fill="#6366f1"
                  stroke="#ffffff"
                  strokeWidth={1.5}
                />
              </g>
            )}
          </svg>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-text-muted pt-1 border-t border-border/30">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 text-text-primary font-medium">
                <span className="w-3 h-0.5 bg-[#6366f1] rounded-full inline-block" />{' '}
                {displayMode === 'profit' ? 'Portföy Kârı' : 'Portföy Değeri'}
              </span>
              {SERIES_META.filter(
                (s) => visibleSeries[s.key] && (displayMode === 'total' || s.key !== 'netInvested')
              ).map((s) => (
                <span key={s.key} className="inline-flex items-center gap-1.5 text-text-secondary">
                  <span
                    className="w-3 h-0.5 rounded-full inline-block"
                    style={{ backgroundColor: s.color }}
                  />{' '}
                  {s.label}
                </span>
              ))}
              <span className="inline-flex items-center gap-1.5 text-success">
                <span className="w-2 h-2 bg-success inline-block rounded-xs" /> Giriş
              </span>
              <span className="inline-flex items-center gap-1.5 text-danger">
                <span className="w-2 h-2 bg-danger inline-block rounded-xs" /> Çıkış
              </span>
            </div>
            <span className="font-mono text-[10px]">
              {displayMode === 'profit' ? 'Eğriler: Net Kâr (₺)' : 'Eğriler: Toplam Değer (₺)'}
            </span>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-bg-tertiary/40 border border-border/50 text-xs text-text-muted">
          Grafik çizimi için en az 2 tarih noktası gerekir.
        </div>
      )}

      {/* Explicit missing history scope disclosure */}
      <div
        data-testid="net-invested-coverage-notice"
        className={`p-3 rounded-xl border text-xs space-y-1 ${
          historyLoading
            ? 'bg-accent/5 border-accent/30 text-text-secondary'
            : timeline.coverage.isComplete
              ? 'bg-success/5 border-success/30 text-text-secondary'
              : 'bg-warning/5 border-warning/30 text-text-secondary'
        }`}
      >
        <p className="font-semibold text-text-primary">
          {historyLoading
            ? 'Varlık ve referans fiyat tarihçeleri senkronize ediliyor...'
            : timeline.coverage.summaryText}
        </p>
        {!historyLoading &&
          timeline.coverage.details.map((line, i) => (
            <p key={i} className="text-[11px] text-text-muted">
              • {line}
            </p>
          ))}
      </div>
    </section>
  );
}
