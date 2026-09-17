'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePortfolioStore } from '@/store/usePortfolioStore';
import { Holding } from '@/types/portfolio';
import { formatCurrency, formatPercent, getPnLSign } from '@/lib/utils/format';

type MetricType = 'daily' | 'total';
type FilterType = 'all' | 'stock' | 'fund';

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

/**
 * Color scale for performance heatmap
 */
function getTileStyle(percent: number) {
  if (percent >= 5) {
    return {
      bg: 'from-emerald-600/90 via-emerald-700/80 to-emerald-800/90',
      border: 'border-emerald-400/50',
      text: 'text-emerald-100',
      badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30',
      glow: 'shadow-[inset_0_0_24px_rgba(16,185,129,0.35)]',
    };
  }
  if (percent >= 2) {
    return {
      bg: 'from-emerald-700/80 via-emerald-800/70 to-emerald-900/80',
      border: 'border-emerald-500/35',
      text: 'text-emerald-200',
      badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
      glow: 'shadow-[inset_0_0_18px_rgba(16,185,129,0.22)]',
    };
  }
  if (percent > 0) {
    return {
      bg: 'from-emerald-900/70 via-[#0d2a20] to-[#081a14]',
      border: 'border-emerald-600/30',
      text: 'text-emerald-300',
      badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-600/20',
      glow: 'shadow-[inset_0_0_12px_rgba(16,185,129,0.12)]',
    };
  }
  if (percent === 0) {
    return {
      bg: 'from-[#1e1438]/80 via-[#150e28]/70 to-[#0e0a1c]/80',
      border: 'border-white/10',
      text: 'text-white/70',
      badge: 'bg-white/10 text-white/60 border-white/10',
      glow: '',
    };
  }
  if (percent > -2) {
    return {
      bg: 'from-rose-950/70 via-[#2a0e1b] to-[#1a0812]',
      border: 'border-rose-600/30',
      text: 'text-rose-300',
      badge: 'bg-rose-500/10 text-rose-400 border-rose-600/20',
      glow: 'shadow-[inset_0_0_12px_rgba(244,63,94,0.12)]',
    };
  }
  if (percent > -5) {
    return {
      bg: 'from-rose-900/80 via-rose-950/70 to-[#220712]',
      border: 'border-rose-500/35',
      text: 'text-rose-200',
      badge: 'bg-rose-500/15 text-rose-300 border-rose-500/25',
      glow: 'shadow-[inset_0_0_18px_rgba(244,63,94,0.22)]',
    };
  }
  return {
    bg: 'from-rose-600/90 via-rose-700/80 to-rose-800/90',
    border: 'border-rose-400/50',
    text: 'text-rose-100',
    badge: 'bg-rose-500/20 text-rose-200 border-rose-400/30',
    glow: 'shadow-[inset_0_0_24px_rgba(244,63,94,0.35)]',
  };
}

export default function PortfolioHeatmap() {
  const { getSummary, livePrices } = usePortfolioStore();
  const summary = getSummary();
  const [metric, setMetric] = useState<MetricType>('daily');
  const [filter, setFilter] = useState<FilterType>('all');
  const [hoveredNode, setHoveredNode] = useState<TreemapNode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 380 });

  // Measure container dimensions
  useEffect(() => {
    if (!containerRef.current) return;
    const updateDim = () => {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth || 800;
        // On mobile, slightly taller aspect ratio
        const h = w < 640 ? 340 : 400;
        setDimensions({ width: w, height: h });
      }
    };
    updateDim();
    const observer = new ResizeObserver(updateDim);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Filter holdings
  const filteredHoldings = useMemo(() => {
    let list = summary.holdings.filter((h) => h.currentValue > 0);
    if (filter === 'stock') {
      list = list.filter((h) => h.assetType === 'stock');
    } else if (filter === 'fund') {
      list = list.filter((h) => h.assetType === 'fund');
    }
    return list;
  }, [summary.holdings, filter]);

  // Compute treemap nodes
  const nodes = useMemo(() => {
    if (filteredHoldings.length === 0 || dimensions.width === 0) return [];

    const totalFilteredValue = filteredHoldings.reduce((acc, h) => acc + h.currentValue, 0);

    const items = filteredHoldings
      .map((h) => {
        // Resolve daily change from livePrices if holding.dailyChangePercent not available
        let dailyPct = h.dailyChangePercent;
        if (dailyPct == null) {
          const quote = livePrices[h.symbol] || livePrices[h.symbol.toUpperCase()];
          dailyPct = quote && typeof quote === 'object' ? quote.changePercent || 0 : 0;
        }

        const metricValue = metric === 'daily' ? dailyPct : h.pnlPercent;
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
  }, [filteredHoldings, dimensions, metric, livePrices]);

  return (
    <div className="rounded-3xl border border-white/[0.08] bg-gradient-to-b from-[#1c113b]/90 via-[#100a26]/95 to-[#080512] p-5 sm:p-6 backdrop-blur-xl shadow-[0_12px_40px_rgba(0,0,0,0.4)]">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-600/30 border border-violet-500/30 flex items-center justify-center text-violet-300">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                Portföy Isı Haritası
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/10 text-white/70 border border-white/10">
                  {filteredHoldings.length} Varlık
                </span>
              </h3>
              <p className="text-xs text-white/40">
                Kutu büyüklüğü portföy ağırlığını, renk ise getiriyi gösterir
              </p>
            </div>
          </div>
        </div>

        {/* Controls: Metric Switcher + Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Metric selector */}
          <div className="flex items-center p-1 rounded-xl bg-white/[0.06] border border-white/[0.08]">
            <button
              type="button"
              onClick={() => setMetric('daily')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                metric === 'daily'
                  ? 'bg-white/15 text-white shadow-sm'
                  : 'text-white/50 hover:text-white/80'
              }`}
            >
              Günlük
            </button>
            <button
              type="button"
              onClick={() => setMetric('total')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                metric === 'total'
                  ? 'bg-white/15 text-white shadow-sm'
                  : 'text-white/50 hover:text-white/80'
              }`}
            >
              Toplam K/Z
            </button>
          </div>

          {/* Filter selector */}
          <div className="flex items-center p-1 rounded-xl bg-white/[0.06] border border-white/[0.08]">
            {(['all', 'stock', 'fund'] as FilterType[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  filter === f
                    ? 'bg-violet-600/30 text-violet-200 border border-violet-500/30'
                    : 'text-white/50 hover:text-white/80'
                }`}
              >
                {f === 'all' ? 'Tümü' : f === 'stock' ? 'Hisseler' : 'Fonlar'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Heatmap Area */}
      <div
        ref={containerRef}
        className="relative w-full rounded-2xl overflow-hidden bg-black/40 border border-white/[0.06]"
        style={{ height: dimensions.height }}
      >
        {nodes.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/30 mb-3">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-white/70">
              Isı haritası için portföyünüzde aktif varlık bulunamadı
            </p>
            <p className="text-xs text-white/40 mt-1 max-w-sm">
              Hisse senedi veya TEFAS fonu ekleyerek portföy dağılımınızı anlık olarak görselleştirebilirsiniz.
            </p>
            <Link
              href="/portfolio"
              className="mt-4 px-4 py-2 rounded-xl bg-violet-600/30 hover:bg-violet-600/50 border border-violet-500/30 text-violet-200 text-xs font-bold transition-all"
            >
              Varlık Ekle →
            </Link>
          </div>
        ) : (
          nodes.map((node) => {
            const { holding, x, y, width, height, metricValue, weightPercent } = node;
            const style = getTileStyle(metricValue);
            const isStock = holding.assetType === 'stock';
            const targetUrl = isStock ? `/stocks/${holding.symbol}` : `/funds/${holding.symbol}`;

            // Adaptive font sizes based on tile area
            const isWide = width >= 95;
            const isTall = height >= 70;
            const isLarge = width >= 140 && height >= 100;

            const gap = 2;
            const tileW = Math.max(10, width - gap * 2);
            const tileH = Math.max(10, height - gap * 2);

            return (
              <Link
                key={holding.symbol}
                href={targetUrl}
                onMouseEnter={() => setHoveredNode(node)}
                onMouseLeave={() => setHoveredNode(null)}
                style={{
                  position: 'absolute',
                  left: x + gap,
                  top: y + gap,
                  width: tileW,
                  height: tileH,
                }}
                className={`group rounded-xl border bg-gradient-to-br ${style.bg} ${style.border} ${style.glow} p-2 flex flex-col justify-between overflow-hidden cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:z-30 hover:shadow-2xl hover:border-white/40 select-none`}
              >
                {/* Top: Symbol + Asset Type Tag */}
                <div className="flex items-start justify-between gap-1 overflow-hidden leading-tight">
                  <span
                    className={`font-black tracking-tight text-white drop-shadow-sm truncate ${
                      isLarge ? 'text-base sm:text-lg' : isWide ? 'text-xs sm:text-sm' : 'text-[11px]'
                    }`}
                  >
                    {holding.symbol}
                  </span>
                  {isLarge && (
                    <span className="text-[10px] uppercase font-bold text-white/40 bg-black/20 px-1.5 py-0.5 rounded">
                      {isStock ? 'Hisse' : 'Fon'}
                    </span>
                  )}
                </div>

                {/* Middle: Performance Return */}
                <div className="my-auto leading-none">
                  <div
                    className={`font-black tabular-nums drop-shadow-sm ${style.text} ${
                      isLarge ? 'text-lg sm:text-xl' : isWide && isTall ? 'text-sm sm:text-base' : 'text-xs'
                    }`}
                  >
                    {getPnLSign(metricValue)}%{Math.abs(metricValue).toFixed(2)}
                  </div>
                </div>

                {/* Bottom: Value & Weight (Visible if height allows) */}
                {isTall && (
                  <div className="flex items-center justify-between text-[10px] text-white/60 font-medium pt-1 border-t border-white/[0.08] truncate">
                    <span className="tabular-nums truncate">{formatCurrency(holding.currentValue)}</span>
                    {isWide && (
                      <span className="text-white/40 ml-1 shrink-0 font-semibold">
                        %{weightPercent.toFixed(1)}
                      </span>
                    )}
                  </div>
                )}
              </Link>
            );
          })
        )}
      </div>

      {/* Footer Legend Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-4 border-t border-white/[0.06] text-xs text-white/50">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium">Isı Skalası:</span>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-rose-400 font-bold">-%5+</span>
            <div className="h-2 w-28 sm:w-36 rounded-full bg-gradient-to-r from-rose-600 via-rose-950 via-slate-800 via-emerald-950 to-emerald-500 border border-white/10" />
            <span className="text-[10px] text-emerald-400 font-bold">+%5+</span>
          </div>
        </div>

        {/* Hovered details bar */}
        {hoveredNode ? (
          <div className="text-[11px] text-white/90 font-medium flex items-center gap-2 animate-fade-in bg-white/5 px-3 py-1 rounded-lg border border-white/10">
            <span className="font-bold text-white">{hoveredNode.holding.symbol}</span>
            <span>•</span>
            <span>Değer: {formatCurrency(hoveredNode.holding.currentValue)}</span>
            <span>•</span>
            <span className="text-violet-300">Ağırlık: %{hoveredNode.weightPercent.toFixed(1)}</span>
            <span>•</span>
            <span className={hoveredNode.metricValue >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
              {metric === 'daily' ? 'Günlük: ' : 'Toplam: '}
              {getPnLSign(hoveredNode.metricValue)}%{Math.abs(hoveredNode.metricValue).toFixed(2)}
            </span>
          </div>
        ) : (
          <span className="text-[11px] text-white/35">
            Detayları görmek için kutunun üzerine gelin, sayfasına gitmek için tıklayın
          </span>
        )}
      </div>
    </div>
  );
}
