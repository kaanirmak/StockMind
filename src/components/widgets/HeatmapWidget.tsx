'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { usePortfolioStore } from '@/store/usePortfolioStore';
import { Holding } from '@/types/portfolio';
import { formatCurrency, formatPercent, getPnLSign } from '@/lib/utils/format';

type MetricType = 'daily' | 'total';

interface TreemapNode {
  holding: Holding;
  x: number;
  y: number;
  width: number;
  height: number;
  metricValue: number;
  weightPercent: number;
}

/**
 * Recursive binary partition treemap algorithm
 */
function computeTreemap(
  items: { holding: Holding; value: number; metricValue: number; weightPercent: number }[],
  x: number,
  y: number,
  w: number,
  h: number
): TreemapNode[] {
  if (items.length === 0) return [];
  if (items.length === 1) {
    return [
      {
        holding: items[0].holding,
        x,
        y,
        width: w,
        height: h,
        metricValue: items[0].metricValue,
        weightPercent: items[0].weightPercent,
      },
    ];
  }

  const total = items.reduce((acc, it) => acc + it.value, 0);
  if (total <= 0) return [];

  const half = total / 2;
  let running = 0;
  let splitIndex = 0;
  let bestDiff = Infinity;

  for (let i = 0; i < items.length - 1; i++) {
    running += items[i].value;
    const diff = Math.abs(running - half);
    if (diff < bestDiff) {
      bestDiff = diff;
      splitIndex = i;
    }
  }

  const leftItems = items.slice(0, splitIndex + 1);
  const rightItems = items.slice(splitIndex + 1);
  const leftSum = leftItems.reduce((acc, it) => acc + it.value, 0);
  const leftRatio = leftSum / total;

  if (w >= h) {
    const leftWidth = w * leftRatio;
    const rightWidth = w - leftWidth;
    return [
      ...computeTreemap(leftItems, x, y, leftWidth, h),
      ...computeTreemap(rightItems, x + leftWidth, y, rightWidth, h),
    ];
  } else {
    const topHeight = h * leftRatio;
    const bottomHeight = h - topHeight;
    return [
      ...computeTreemap(leftItems, x, y, w, topHeight),
      ...computeTreemap(rightItems, x, y + topHeight, w, bottomHeight),
    ];
  }
}

function getTileColor(percent: number) {
  if (percent >= 5) {
    return {
      bg: 'from-emerald-600 via-emerald-700 to-emerald-800',
      border: 'border-emerald-400/50',
      text: 'text-emerald-100',
      glow: 'shadow-[inset_0_0_20px_rgba(16,185,129,0.35)]',
    };
  }
  if (percent >= 2) {
    return {
      bg: 'from-emerald-700/80 via-emerald-800/80 to-teal-900/80',
      border: 'border-emerald-500/40',
      text: 'text-emerald-200',
      glow: 'shadow-[inset_0_0_15px_rgba(16,185,129,0.25)]',
    };
  }
  if (percent > 0.2) {
    return {
      bg: 'from-emerald-800/60 via-emerald-900/60 to-[#0d2a23]',
      border: 'border-emerald-600/30',
      text: 'text-emerald-300',
      glow: '',
    };
  }
  if (percent >= -0.2) {
    return {
      bg: 'from-zinc-800/80 via-zinc-850 to-zinc-900',
      border: 'border-zinc-700/40',
      text: 'text-zinc-300',
      glow: '',
    };
  }
  if (percent >= -2) {
    return {
      bg: 'from-rose-900/60 via-rose-950/70 to-[#2a0e16]',
      border: 'border-rose-600/30',
      text: 'text-rose-300',
      glow: '',
    };
  }
  if (percent >= -5) {
    return {
      bg: 'from-rose-800/80 via-rose-900/80 to-pink-950/80',
      border: 'border-rose-500/40',
      text: 'text-rose-200',
      glow: 'shadow-[inset_0_0_15px_rgba(244,63,94,0.25)]',
    };
  }
  return {
    bg: 'from-rose-600 via-rose-700 to-rose-800',
    border: 'border-rose-400/50',
    text: 'text-rose-100',
    glow: 'shadow-[inset_0_0_20px_rgba(244,63,94,0.35)]',
  };
}

// Fallback holdings for empty portfolios
const SAMPLE_HOLDINGS: Holding[] = [
  {
    symbol: 'THYAO',
    exchange: 'BIST',
    assetType: 'stock',
    totalQuantity: 150,
    averageCost: 260.5,
    totalCost: 39075,
    currentPrice: 284.2,
    currentValue: 42630,
    pnl: 3555,
    pnlPercent: 9.1,
    weight: 35,
    dailyChangePercent: 2.8,
  },
  {
    symbol: 'ASELS',
    exchange: 'BIST',
    assetType: 'stock',
    totalQuantity: 300,
    averageCost: 60.2,
    totalCost: 18060,
    currentPrice: 65.8,
    currentValue: 19740,
    pnl: 1680,
    pnlPercent: 9.3,
    weight: 20,
    dailyChangePercent: 3.4,
  },
  {
    symbol: 'KCHOL',
    exchange: 'BIST',
    assetType: 'stock',
    totalQuantity: 100,
    averageCost: 185.0,
    totalCost: 18500,
    currentPrice: 192.4,
    currentValue: 19240,
    pnl: 740,
    pnlPercent: 4.0,
    weight: 18,
    dailyChangePercent: 1.2,
  },
  {
    symbol: 'EREGL',
    exchange: 'BIST',
    assetType: 'stock',
    totalQuantity: 400,
    averageCost: 48.5,
    totalCost: 19400,
    currentPrice: 47.1,
    currentValue: 18840,
    pnl: -560,
    pnlPercent: -2.88,
    weight: 16,
    dailyChangePercent: -1.4,
  },
  {
    symbol: 'TUPRS',
    exchange: 'BIST',
    assetType: 'stock',
    totalQuantity: 80,
    averageCost: 162.0,
    totalCost: 12960,
    currentPrice: 159.2,
    currentValue: 12736,
    pnl: -224,
    pnlPercent: -1.72,
    weight: 11,
    dailyChangePercent: -0.8,
  },
];

export interface HeatmapWidgetProps {
  standalone?: boolean;
  defaultMetric?: MetricType;
  transparent?: boolean;
  height?: number;
  hideFooter?: boolean;
}

export default function HeatmapWidget({
  standalone = false,
  defaultMetric = 'daily',
  transparent = false,
  height = 260,
  hideFooter = false,
}: HeatmapWidgetProps) {
  const { getSummary, livePrices, fetchPortfoliosAndTransactions } = usePortfolioStore();
  const summary = getSummary();
  const [metric, setMetric] = useState<MetricType>(defaultMetric);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 400, height });
  const [hoveredNode, setHoveredNode] = useState<TreemapNode | null>(null);

  useEffect(() => {
    fetchPortfoliosAndTransactions();
  }, [fetchPortfoliosAndTransactions]);

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const { clientWidth } = containerRef.current;
        setDimensions({
          width: Math.max(260, clientWidth),
          height: Math.max(180, height),
        });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [height]);

  const rawHoldings = summary.holdings.length > 0 ? summary.holdings : SAMPLE_HOLDINGS;

  const nodes = useMemo(() => {
    const totalFilteredValue = rawHoldings.reduce((sum, h) => sum + Math.max(1, h.currentValue), 0);

    const items = rawHoldings
      .map((h) => {
        let metricValue = 0;
        if (metric === 'daily') {
          if (h.dailyChangePercent != null) {
            metricValue = h.dailyChangePercent;
          } else {
            const quote = livePrices[h.symbol] || livePrices[`${h.symbol}.IS`];
            metricValue = quote && typeof quote === 'object' ? quote.changePercent || 0 : (h.pnlPercent * 0.25 || 0);
          }
        } else {
          metricValue = h.pnlPercent || 0;
        }

        const weightPercent = totalFilteredValue > 0 ? (h.currentValue / totalFilteredValue) * 100 : 0;
        return {
          holding: h,
          value: Math.max(1, h.currentValue),
          metricValue,
          weightPercent,
        };
      })
      .sort((a, b) => b.value - a.value);

    return computeTreemap(items, 0, 0, dimensions.width, dimensions.height);
  }, [rawHoldings, dimensions, metric, livePrices]);

  const activeNode = hoveredNode || nodes[0] || null;

  const handleTileClick = (symbol: string) => {
    if (typeof window !== 'undefined') {
      window.open(`/stocks/${symbol}`, '_blank');
    }
  };

  return (
    <div
      className={`relative w-full rounded-3xl p-4 sm:p-5 transition-all duration-300 overflow-hidden select-none border ${
        transparent
          ? 'bg-transparent border-white/10'
          : 'bg-[#0f1422] border-white/10 shadow-2xl'
      }`}
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-accent/20 text-accent flex items-center justify-center font-bold text-xs">
            📊
          </div>
          <h3 className="text-xs sm:text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
            <span>Isı Haritası</span>
            <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-white/10 text-white/70">
              {nodes.length} Varlık
            </span>
          </h3>
        </div>

        {/* Metric Switcher */}
        <div className="flex items-center p-0.5 rounded-lg bg-white/5 border border-white/10 text-[10px] font-bold">
          <button
            type="button"
            onClick={() => setMetric('daily')}
            className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
              metric === 'daily'
                ? 'bg-accent text-white shadow-xs'
                : 'text-white/60 hover:text-white'
            }`}
          >
            Günlük
          </button>
          <button
            type="button"
            onClick={() => setMetric('total')}
            className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
              metric === 'total'
                ? 'bg-accent text-white shadow-xs'
                : 'text-white/60 hover:text-white'
            }`}
          >
            Toplam
          </button>
        </div>
      </div>

      {/* Heatmap Treemap Canvas */}
      <div
        ref={containerRef}
        className="relative w-full rounded-2xl overflow-hidden bg-black/40 border border-white/5 shadow-inner"
        style={{ height: `${dimensions.height}px` }}
      >
        {nodes.map((node) => {
          const style = getTileColor(node.metricValue);
          const isSmall = node.width < 55 || node.height < 45;
          const isTiny = node.width < 35 || node.height < 30;

          return (
            <div
              key={node.holding.symbol}
              onClick={() => handleTileClick(node.holding.symbol)}
              onMouseEnter={() => setHoveredNode(node)}
              onMouseLeave={() => setHoveredNode(null)}
              className={`absolute p-1 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 border bg-gradient-to-br ${style.bg} ${style.border} ${style.glow} hover:z-20 hover:scale-[1.02] hover:brightness-110 active:scale-[0.98]`}
              style={{
                left: `${node.x}px`,
                top: `${node.y}px`,
                width: `${node.width}px`,
                height: `${node.height}px`,
              }}
              title={`${node.holding.symbol}: ${node.metricValue >= 0 ? '+' : ''}${node.metricValue.toFixed(1)}%`}
            >
              {!isTiny && (
                <span className="font-black text-white text-xs sm:text-sm tracking-tight truncate drop-shadow-sm leading-tight">
                  {node.holding.symbol}
                </span>
              )}

              {!isSmall && (
                <span
                  className={`text-[10px] sm:text-xs font-bold tabular-nums drop-shadow-sm ${
                    node.metricValue >= 0 ? 'text-emerald-100' : 'text-rose-100'
                  }`}
                >
                  {node.metricValue >= 0 ? '+' : ''}
                  {node.metricValue.toFixed(1)}%
                </span>
              )}

              {node.width >= 75 && node.height >= 55 && (
                <span className="text-[9px] text-white/70 font-semibold tabular-nums mt-0.5">
                  %{node.weightPercent.toFixed(0)} Pay
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Active Holding Live Info Bar */}
      {activeNode && (
        <div className="mt-2.5 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between text-xs text-white/80">
          <div className="flex items-center gap-2">
            <span className="font-black text-white">{activeNode.holding.symbol}</span>
            <span className="text-[11px] text-white/50 truncate max-w-[130px] hidden sm:inline">
              {activeNode.holding.exchange || 'BIST'} • {activeNode.holding.assetType === 'fund' ? 'TEFAS Fon' : 'Hisse'}
            </span>
          </div>
          <div className="flex items-center gap-3 tabular-nums font-bold">
            <span className="text-white/60">Ağırlık: %{activeNode.weightPercent.toFixed(1)}</span>
            <span
              className={activeNode.metricValue >= 0 ? 'text-emerald-400' : 'text-rose-400'}
            >
              {activeNode.metricValue >= 0 ? '+' : ''}
              {activeNode.metricValue.toFixed(2)}%
            </span>
          </div>
        </div>
      )}

      {/* Footer link */}
      {!hideFooter && (
        <div className="mt-2 flex items-center justify-between text-[11px] text-white/40 pt-1">
          <span>Kutu büyüklüğü ağırlığı, renk getiriyi belirtir</span>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined') window.open('/dashboard', '_blank');
            }}
            className="text-white/60 hover:text-white flex items-center gap-1 hover:underline cursor-pointer"
          >
            <span>Ana Ekranda Aç</span>
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
