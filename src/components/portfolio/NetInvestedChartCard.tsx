'use client';

import React, { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import {
  buildNetInvestedTimeline,
  type NetInvestedPeriod,
} from '@/lib/portfolio/netInvestedTimeline';
import type { CashMovement, PortfolioSummary, Transaction } from '@/types/portfolio';
import type { PriceQuote } from '@/lib/portfolio/calculations';
import { maskDisplayValue } from '@/lib/privacy';

interface NetInvestedChartCardProps {
  transactions: Transaction[];
  cashMovements: CashMovement[];
  summary: PortfolioSummary;
  livePrices: Record<string, PriceQuote | number>;
  isPrivacyMode?: boolean;
}

const PERIOD_LABELS: { id: NetInvestedPeriod; label: string }[] = [
  { id: '1M', label: '1A' },
  { id: '3M', label: '3A' },
  { id: '6M', label: '6A' },
  { id: '1Y', label: '1Y' },
  { id: 'ALL', label: 'Tümü' },
];

function fmtTry(value: number, privacy = false): string {
  return maskDisplayValue(
    `₺${value.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`,
    privacy,
    '₺••••'
  );
}

export function NetInvestedChartCard({
  transactions,
  cashMovements,
  summary,
  livePrices,
  isPrivacyMode = false,
}: NetInvestedChartCardProps) {
  const [period, setPeriod] = useState<NetInvestedPeriod>('ALL');

  const timeline = useMemo(
    () =>
      buildNetInvestedTimeline({
        transactions,
        cashMovements,
        summary,
        livePrices,
        period,
      }),
    [transactions, cashMovements, summary, livePrices, period]
  );

  const chart = useMemo(() => {
    const pts = timeline.points;
    if (pts.length < 2) return null;

    const allSeriesVals = pts.flatMap((p) => [p.portfolioValue, p.netInvested]);
    const minVal = Math.min(0, ...allSeriesVals);
    const maxVal = Math.max(1, ...allSeriesVals);
    const span = Math.max(1, maxVal - minVal);

    const maxFlow = Math.max(
      1,
      ...pts.map((p) => Math.max(p.dailyInflow, p.dailyOutflow))
    );

    const valuePath = pts
      .map((p, idx) => {
        const x = (idx / (pts.length - 1)) * 100;
        const y = 72 - ((p.portfolioValue - minVal) / span) * 66;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(' ');

    const investedPath = pts
      .map((p, idx) => {
        const x = (idx / (pts.length - 1)) * 100;
        const y = 72 - ((p.netInvested - minVal) / span) * 66;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(' ');

    const flowBars = pts
      .map((p, idx) => {
        if (p.dailyInflow <= 0 && p.dailyOutflow <= 0) return null;
        const x = (idx / (pts.length - 1)) * 100;
        const inHeight = p.dailyInflow > 0 ? Math.max(2, (p.dailyInflow / maxFlow) * 14) : 0;
        const outHeight = p.dailyOutflow > 0 ? Math.max(2, (p.dailyOutflow / maxFlow) * 14) : 0;
        return { date: p.date, x, inHeight, outHeight };
      })
      .filter((b): b is { date: string; x: number; inHeight: number; outHeight: number } => Boolean(b));

    return { valuePath, investedPath, flowBars };
  }, [timeline]);

  return (
    <section
      className="glass-card p-4 sm:p-5 space-y-4"
      data-testid="net-invested-chart-card"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm sm:text-base font-bold text-text-primary">
              Portföy Değeri vs. Net Yatırılan Tutar
            </h3>
            <Badge variant={timeline.coverage.isComplete ? 'success' : 'warning'} size="sm">
              Kapsam %{timeline.coverage.coveragePercent}
            </Badge>
          </div>
          <p className="text-xs text-text-muted mt-0.5">
            Geçmiş portföy değeri serisi ile para girişleri (yeşil) ve çıkışları (kırmızı) ayrı çizilir.
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

      {/* KPI Strip: Portfolio Value / Net Invested / Total Inflows / Total Outflows */}
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

      {chart ? (
        <div className="space-y-2" data-testid="net-invested-chart">
          <div className="h-44 w-full rounded-xl bg-bg-tertiary/30 border border-border/50 p-2">
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="w-full h-full overflow-visible"
              role="img"
              aria-label="Portföy değeri, net yatırılan tutar ve nakit akışları grafiği"
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
              {/* Net invested series */}
              <polyline
                fill="none"
                stroke="#10b981"
                strokeWidth="1.4"
                strokeDasharray="2 1.2"
                points={chart.investedPath}
              />
              {/* Portfolio value series */}
              <polyline
                fill="none"
                stroke="#6366f1"
                strokeWidth="1.8"
                strokeLinecap="round"
                points={chart.valuePath}
              />
            </svg>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-text-muted">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 text-text-primary">
                <span className="w-2.5 h-0.5 bg-[#6366f1] inline-block" /> Portföy Değeri
              </span>
              <span className="inline-flex items-center gap-1.5 text-text-secondary">
                <span className="w-2.5 h-0.5 bg-[#10b981] inline-block" /> Net Yatırılan
              </span>
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
          timeline.coverage.isComplete
            ? 'bg-success/5 border-success/30 text-text-secondary'
            : 'bg-warning/5 border-warning/30 text-text-secondary'
        }`}
      >
        <p className="font-semibold text-text-primary">{timeline.coverage.summaryText}</p>
        {timeline.coverage.details.map((line, i) => (
          <p key={i} className="text-[11px] text-text-muted">
            • {line}
          </p>
        ))}
      </div>
    </section>
  );
}
