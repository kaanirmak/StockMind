'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import {
  buildNetInvestedTimeline,
  type AlternativeBenchmarkId,
  type NetInvestedPeriod,
  type PriceHistoryBySymbol,
} from '@/lib/portfolio/netInvestedTimeline';
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
  { key: 'netInvested', label: 'Net Yatırılan Tutar', color: '#10b981', dashed: true },
  { key: 'bist100', label: 'BIST 100', color: '#38bdf8' },
  { key: 'gold', label: 'Altın (TL)', color: '#f59e0b' },
  { key: 'interest', label: 'Mevduat Faizi (%48)', color: '#a855f7' },
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

function buildPolylinePath(
  values: (number | undefined)[],
  minVal: number,
  span: number
): string | null {
  const count = values.length;
  if (count < 2) return null;
  const pts: string[] = [];
  for (let i = 0; i < count; i++) {
    const v = values[i];
    if (typeof v !== 'number' || !Number.isFinite(v)) continue;
    const x = (i / (count - 1)) * 100;
    const y = 72 - ((v - minVal) / span) * 66;
    pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return pts.length >= 2 ? pts.join(' ') : null;
}

export function NetInvestedChartCard({
  transactions,
  cashMovements,
  summary,
  livePrices,
  isPrivacyMode = false,
}: NetInvestedChartCardProps) {
  const [period, setPeriod] = useState<NetInvestedPeriod>('ALL');
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
    let needsUsdFx = false;
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
      if (
        (tx.currency || '').toUpperCase() === 'USD' ||
        ex === 'NASDAQ' ||
        ex === 'NYSE' ||
        ex === 'AMEX'
      ) {
        needsUsdFx = true;
      }
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
      if ((m.currency || '').toUpperCase() === 'USD') {
        needsUsdFx = true;
      }
    }

    // Always fetch reference benchmarks (BIST 100, Gram Altın TL, USD/TRY)
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
      needsUsdFx,
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
              // Missing history is disclosed accurately in coverage notice
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

  const chart = useMemo(() => {
    const pts = timeline.points;
    if (pts.length < 2) return null;

    const allSeriesVals: number[] = [];
    for (const p of pts) {
      allSeriesVals.push(p.portfolioValue);
      if (visibleSeries.netInvested) allSeriesVals.push(p.netInvested);
      if (visibleSeries.bist100 && typeof p.bist100Value === 'number') allSeriesVals.push(p.bist100Value);
      if (visibleSeries.gold && typeof p.goldValue === 'number') allSeriesVals.push(p.goldValue);
      if (visibleSeries.interest && typeof p.interestValue === 'number') allSeriesVals.push(p.interestValue);
      if (visibleSeries.usd && typeof p.usdValue === 'number') allSeriesVals.push(p.usdValue);
    }

    const minVal = Math.min(0, ...allSeriesVals);
    const maxVal = Math.max(1, ...allSeriesVals);
    const span = Math.max(1, maxVal - minVal);

    const maxFlow = Math.max(
      1,
      ...pts.map((p) => Math.max(p.dailyInflow, p.dailyOutflow))
    );

    const valuePath = buildPolylinePath(
      pts.map((p) => p.portfolioValue),
      minVal,
      span
    );
    const investedPath = visibleSeries.netInvested
      ? buildPolylinePath(
          pts.map((p) => p.netInvested),
          minVal,
          span
        )
      : null;
    const bistPath = visibleSeries.bist100
      ? buildPolylinePath(
          pts.map((p) => p.bist100Value),
          minVal,
          span
        )
      : null;
    const goldPath = visibleSeries.gold
      ? buildPolylinePath(
          pts.map((p) => p.goldValue),
          minVal,
          span
        )
      : null;
    const interestPath = visibleSeries.interest
      ? buildPolylinePath(
          pts.map((p) => p.interestValue),
          minVal,
          span
        )
      : null;
    const usdPath = visibleSeries.usd
      ? buildPolylinePath(
          pts.map((p) => p.usdValue),
          minVal,
          span
        )
      : null;

    const flowBars = pts
      .map((p, idx) => {
        if (p.dailyInflow <= 0 && p.dailyOutflow <= 0) return null;
        const x = (idx / (pts.length - 1)) * 100;
        const inHeight = p.dailyInflow > 0 ? Math.max(2, (p.dailyInflow / maxFlow) * 14) : 0;
        const outHeight = p.dailyOutflow > 0 ? Math.max(2, (p.dailyOutflow / maxFlow) * 14) : 0;
        return { date: p.date, x, inHeight, outHeight };
      })
      .filter((b): b is { date: string; x: number; inHeight: number; outHeight: number } => Boolean(b));

    return {
      valuePath,
      investedPath,
      bistPath,
      goldPath,
      interestPath,
      usdPath,
      flowBars,
    };
  }, [timeline, visibleSeries]);

  const toggleSeries = (key: ToggleableSeriesKey) => {
    setVisibleSeries((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <section
      className="glass-card p-4 sm:p-5 space-y-4"
      data-testid="net-invested-chart-card"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm sm:text-base font-bold text-text-primary">
              Portföy Değeri vs. Yatırılan Tutar &amp; Alternatif Yatırımlar
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
            Aynı para giriş/çıkışlarıyla paranız BIST 100, Altın, Mevduat Faizi (%48) veya Dolar&apos;da olsaydı nasıl performans gösterirdi kıyaslayın.
          </p>
        </div>

        <div className="inline-flex rounded-xl bg-bg-secondary border border-border p-0.5 self-start sm:self-auto">
          {PERIOD_LABELS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setPeriod(opt.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                period === opt.id ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Interactive Comparison Toggles */}
      <div className="flex flex-wrap items-center gap-1.5">
        {SERIES_META.map((s) => {
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

      {/* Primary KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
        <div className="p-3 rounded-xl bg-bg-tertiary/60 border border-border/50">
          <span className="text-text-muted block">Portföy Değeri</span>
          <span className="text-sm font-mono font-bold text-text-primary">
            {fmtTry(timeline.latestPortfolioValue, isPrivacyMode)}
          </span>
        </div>
        <div className="p-3 rounded-xl bg-bg-tertiary/60 border border-border/50">
          <span className="text-text-muted block">Net Yatırılan Tutar</span>
          <span className="text-sm font-mono font-bold text-text-primary">
            {fmtTry(timeline.netInvestedTotal, isPrivacyMode)}
          </span>
        </div>
        <div className="p-3 rounded-xl bg-bg-tertiary/60 border border-border/50">
          <span className="text-text-muted block">Para Girişleri</span>
          <span className="text-sm font-mono font-bold text-success">
            +{fmtTry(timeline.totalInflows, isPrivacyMode)}
          </span>
        </div>
        <div className="p-3 rounded-xl bg-bg-tertiary/60 border border-border/50">
          <span className="text-text-muted block">Para Çıkışları</span>
          <span className="text-sm font-mono font-bold text-danger">
            -{fmtTry(timeline.totalOutflows, isPrivacyMode)}
          </span>
        </div>
      </div>

      {/* Alternative Investment Opportunity Comparison Cards */}
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
              <div className="text-sm font-mono font-bold text-text-primary">
                {item.available
                  ? fmtTry(item.currentValue, isPrivacyMode)
                  : historyLoading
                    ? 'Yükleniyor...'
                    : 'Veri yok'}
              </div>
              {item.available && (
                <div
                  className={`text-[10px] font-mono ${
                    outperforming ? 'text-success' : 'text-danger'
                  }`}
                >
                  Portföy {fmtSignedTry(item.diffVsPortfolio, isPrivacyMode)}{' '}
                  {outperforming ? 'önde' : 'geride'}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {chart && chart.valuePath ? (
        <div className="space-y-2" data-testid="net-invested-chart">
          <div className="h-48 w-full rounded-xl bg-bg-tertiary/30 border border-border/50 p-2">
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="w-full h-full overflow-visible"
              role="img"
              aria-label="Portföy değeri, yatırılan tutar ve alternatif yatırım karşılaştırma grafiği"
            >
              {/* Separator between value lines (top 75%) and inflow/outflow bars (bottom 25%) */}
              <line
                x1="0"
                y1="82"
                x2="100"
                y2="82"
                stroke="currentColor"
                strokeOpacity="0.2"
                strokeWidth="0.5"
              />
              {/* Separate inflow (upward green) and outflow (downward red) bars */}
              {chart.flowBars.map((bar) => (
                <g key={bar.date}>
                  {bar.inHeight > 0 && (
                    <rect
                      x={Math.max(0, bar.x - 0.8)}
                      y={82 - bar.inHeight}
                      width="1.6"
                      height={bar.inHeight}
                      fill="#10b981"
                      fillOpacity="0.75"
                    />
                  )}
                  {bar.outHeight > 0 && (
                    <rect
                      x={Math.max(0, bar.x - 0.8)}
                      y={82}
                      width="1.6"
                      height={bar.outHeight}
                      fill="#ef4444"
                      fillOpacity="0.75"
                    />
                  )}
                </g>
              ))}
              {chart.investedPath && (
                <polyline
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="1.2"
                  strokeDasharray="2 1.2"
                  points={chart.investedPath}
                />
              )}
              {chart.bistPath && (
                <polyline
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="1.25"
                  points={chart.bistPath}
                />
              )}
              {chart.goldPath && (
                <polyline
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="1.25"
                  points={chart.goldPath}
                />
              )}
              {chart.interestPath && (
                <polyline
                  fill="none"
                  stroke="#a855f7"
                  strokeWidth="1.2"
                  strokeDasharray="1.5 1.5"
                  points={chart.interestPath}
                />
              )}
              {chart.usdPath && (
                <polyline
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth="1.2"
                  points={chart.usdPath}
                />
              )}
              {/* Portfolio value series */}
              <polyline
                fill="none"
                stroke="#6366f1"
                strokeWidth="2"
                strokeLinecap="round"
                points={chart.valuePath}
              />
            </svg>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-text-muted">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 text-text-primary font-medium">
                <span className="w-2.5 h-0.5 bg-[#6366f1] inline-block" /> Portföy Değeri
              </span>
              {SERIES_META.filter((s) => visibleSeries[s.key]).map((s) => (
                <span key={s.key} className="inline-flex items-center gap-1.5 text-text-secondary">
                  <span
                    className="w-2.5 h-0.5 inline-block"
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
            <span className="font-mono">
              {timeline.points[0]?.date} – {timeline.points[timeline.points.length - 1]?.date}
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
