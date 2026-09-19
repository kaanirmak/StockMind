'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  const router = useRouter();
  const { getSummary, livePrices } = usePortfolioStore();
  const summary = getSummary();
  const [metric, setMetric] = useState<MetricType>('daily');
  const [hoveredNode, setHoveredNode] = useState<TreemapNode | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 360 });

  // Measure container dimensions with mobile-friendly dynamic height
  useEffect(() => {
    if (!containerRef.current) return;
    const updateDim = () => {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth || 360;
        // On mobile, keep an ergonomic aspect ratio suited for touch
        const h = w < 640 ? Math.max(280, Math.min(360, Math.round(w * 0.9))) : 390;
        setDimensions({ width: w, height: h });
      }
    };
    updateDim();
    const observer = new ResizeObserver(updateDim);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Filter holdings with positive value
  const filteredHoldings = useMemo(() => {
    return summary.holdings.filter((h) => h.currentValue > 0);
  }, [summary.holdings]);

  // Compute treemap nodes
  const nodes = useMemo(() => {
    if (filteredHoldings.length === 0 || dimensions.width === 0) return [];

    const totalFilteredValue = filteredHoldings.reduce((acc, h) => acc + h.currentValue, 0);

    const items = filteredHoldings
      .map((h) => {
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

  // Default selected node to the first/largest holding if none selected
  useEffect(() => {
    if (!selectedSymbol && nodes.length > 0) {
      setSelectedSymbol(nodes[0].holding.symbol);
    }
  }, [nodes, selectedSymbol]);

  // Active display node (hover takes precedence on desktop, otherwise selected)
  const activeNode = useMemo(() => {
    if (hoveredNode) return hoveredNode;
    if (selectedSymbol) {
      const found = nodes.find((n) => n.holding.symbol === selectedSymbol);
      if (found) return found;
    }
    return nodes[0] || null;
  }, [hoveredNode, selectedSymbol, nodes]);

  // Handle tile click/tap
  const handleTileInteraction = (node: TreemapNode) => {
    const isTouchDevice =
      typeof window !== 'undefined' &&
      window.matchMedia('(hover: none), (pointer: coarse)').matches;

    const targetUrl =
      node.holding.assetType === 'stock'
        ? `/stocks/${node.holding.symbol}`
        : `/funds/${node.holding.symbol}`;

    if (isTouchDevice) {
      // On mobile/touch: if already selected, tap navigates. Otherwise, select and show details.
      if (selectedSymbol === node.holding.symbol) {
        router.push(targetUrl);
      } else {
        setSelectedSymbol(node.holding.symbol);
      }
    } else {
      // On desktop: single click navigates directly
      router.push(targetUrl);
    }
  };

  return (
    <div className="rounded-2xl sm:rounded-3xl border-0 glass-card p-3.5 sm:p-6 shadow-card transition-all">
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-2.5 mb-3 sm:mb-4">
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent shrink-0">
            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
            </svg>
          </div>
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base md:text-lg font-bold text-text-primary tracking-tight flex items-center gap-1.5 sm:gap-2">
              <span className="truncate">Portföy Isı Haritası</span>
              <span className="text-[10px] sm:text-xs font-semibold px-1.5 sm:px-2 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/25 shrink-0">
                {filteredHoldings.length}
              </span>
            </h3>
            <p className="text-[11px] sm:text-xs text-text-muted hidden sm:block">
              Kutu büyüklüğü portföy ağırlığını, renk ise getiriyi gösterir
            </p>
          </div>
        </div>

        {/* Metric Switcher (Compact on mobile) */}
        <div className="flex items-center p-0.5 sm:p-1 rounded-xl bg-bg-secondary border border-border shrink-0">
          <button
            type="button"
            onClick={() => setMetric('daily')}
            className={`px-2.5 sm:px-3 py-1 rounded-lg text-[11px] sm:text-xs font-semibold transition-all cursor-pointer ${
              metric === 'daily'
                ? 'bg-accent text-white shadow-sm'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            Günlük
          </button>
          <button
            type="button"
            onClick={() => setMetric('total')}
            className={`px-2.5 sm:px-3 py-1 rounded-lg text-[11px] sm:text-xs font-semibold transition-all cursor-pointer ${
              metric === 'total'
                ? 'bg-accent text-white shadow-sm'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <span className="sm:hidden">Toplam</span>
            <span className="hidden sm:inline">Toplam K/Z</span>
          </button>
        </div>
      </div>

      {/* Heatmap Area */}
      <div
        ref={containerRef}
        className="relative w-full rounded-xl sm:rounded-2xl overflow-hidden bg-black/40 border-0"
        style={{ height: dimensions.height }}
      >
        {nodes.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-4 sm:p-6 text-center">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/30 mb-2 sm:mb-3">
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
              </svg>
            </div>
            <p className="text-xs sm:text-sm font-semibold text-white/70">
              Isı haritası için aktif varlık bulunamadı
            </p>
            <Link
              href="/portfolio"
              className="mt-3 px-3 py-1.5 rounded-xl bg-violet-600/30 hover:bg-violet-600/50 border border-violet-500/30 text-violet-200 text-xs font-bold transition-all"
            >
              Varlık Ekle →
            </Link>
          </div>
        ) : (
          nodes.map((node) => {
            const { holding, x, y, width, height, metricValue, weightPercent } = node;
            const style = getTileStyle(metricValue);
            const isStock = holding.assetType === 'stock';

            // Mobile-first micro-gap and dimensions
            const gap = dimensions.width < 640 ? 1 : 1.5;
            const tileW = Math.max(8, width - gap * 2);
            const tileH = Math.max(8, height - gap * 2);

            // Responsive size categorization
            const isTiny = tileW < 52 || tileH < 38;
            const isSmall = !isTiny && (tileW < 80 || tileH < 52);
            const isMedium = !isTiny && !isSmall && (tileW < 130 || tileH < 80);
            const isLarge = !isTiny && !isSmall && !isMedium;

            const isSelected = activeNode?.holding.symbol === holding.symbol;

            return (
              <div
                key={holding.symbol}
                onClick={() => handleTileInteraction(node)}
                onMouseEnter={() => setHoveredNode(node)}
                onMouseLeave={() => setHoveredNode(null)}
                style={{
                  position: 'absolute',
                  left: x + gap,
                  top: y + gap,
                  width: tileW,
                  height: tileH,
                }}
                className={`group rounded-lg sm:rounded-xl border bg-gradient-to-br ${style.bg} ${
                  isSelected ? 'border-white/90 ring-2 ring-white/80 z-20 scale-[1.015] shadow-xl' : style.border
                } ${style.glow} p-1 sm:p-2 flex flex-col justify-between overflow-hidden cursor-pointer transition-all duration-150 active:scale-95 select-none`}
              >
                {/* Micro Layout (Very small tiles) */}
                {isTiny ? (
                  <div className="h-full flex flex-col items-center justify-center text-center leading-none gap-0.5">
                    <span className="font-black text-[10px] text-white truncate max-w-full">
                      {holding.symbol}
                    </span>
                    <span className={`font-bold text-[9px] tabular-nums ${style.text}`}>
                      {getPnLSign(metricValue)}%{Math.abs(metricValue).toFixed(1)}
                    </span>
                  </div>
                ) : isSmall ? (
                  /* Small Layout */
                  <>
                    <div className="flex items-center justify-between leading-none overflow-hidden">
                      <span className="font-black text-[11px] sm:text-xs text-white truncate drop-shadow-sm">
                        {holding.symbol}
                      </span>
                    </div>
                    <div className="my-auto leading-none">
                      <span className={`font-black text-xs sm:text-[13px] tabular-nums ${style.text} drop-shadow-sm`}>
                        {getPnLSign(metricValue)}%{Math.abs(metricValue).toFixed(1)}
                      </span>
                    </div>
                    {tileH >= 46 && (
                      <div className="text-[9px] text-white/60 font-medium tabular-nums pt-0.5 border-t border-white/[0.08] truncate">
                        %{weightPercent.toFixed(0)}
                      </div>
                    )}
                  </>
                ) : isMedium ? (
                  /* Medium Layout */
                  <>
                    <div className="flex items-start justify-between gap-1 leading-tight overflow-hidden">
                      <span className="font-black text-xs sm:text-sm text-white truncate drop-shadow-sm">
                        {holding.symbol}
                      </span>
                      {tileW >= 110 && (
                        <span className="text-[9px] uppercase font-bold text-white/40 bg-black/20 px-1 py-0.5 rounded shrink-0">
                          {isStock ? 'Hisse' : 'Fon'}
                        </span>
                      )}
                    </div>
                    <div className="my-auto leading-none">
                      <div className={`font-black text-xs sm:text-sm tabular-nums ${style.text} drop-shadow-sm`}>
                        {getPnLSign(metricValue)}%{Math.abs(metricValue).toFixed(2)}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-white/70 font-medium pt-0.5 border-t border-white/[0.08] truncate tabular-nums">
                      <span className="truncate">{formatCurrency(holding.currentValue)}</span>
                      <span className="text-white/40 ml-1 font-semibold">%{weightPercent.toFixed(1)}</span>
                    </div>
                  </>
                ) : (
                  /* Large Layout */
                  <>
                    <div className="flex items-start justify-between gap-1 leading-tight">
                      <span className="font-black text-sm sm:text-base text-white truncate drop-shadow-sm">
                        {holding.symbol}
                      </span>
                      <span className="text-[10px] uppercase font-bold text-white/40 bg-black/25 px-1.5 py-0.5 rounded shrink-0">
                        {isStock ? 'Hisse' : 'Fon'}
                      </span>
                    </div>
                    <div className="my-auto leading-none">
                      <div className={`font-black text-base sm:text-lg tabular-nums ${style.text} drop-shadow-sm`}>
                        {getPnLSign(metricValue)}%{Math.abs(metricValue).toFixed(2)}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-white/70 font-medium pt-1 border-t border-white/[0.08] truncate tabular-nums">
                      <span className="truncate">{formatCurrency(holding.currentValue)}</span>
                      <span className="text-white/40 ml-1 font-bold">%{weightPercent.toFixed(1)}</span>
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Touch-Friendly Active Asset Card */}
      {activeNode && (
        <div className="mt-2.5 sm:mt-3 p-2.5 sm:p-3 rounded-xl bg-bg-secondary/70 border border-border flex items-center justify-between gap-2.5 transition-all">
          {/* Left info */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs shrink-0 border ${
                activeNode.metricValue >= 0
                  ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-500 border-rose-500/30'
              }`}
            >
              {activeNode.holding.symbol.slice(0, 3)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 leading-tight">
                <span className="font-bold text-xs sm:text-sm text-text-primary truncate">
                  {activeNode.holding.symbol}
                </span>
                <span className="text-[9px] uppercase font-bold text-text-muted bg-bg-tertiary px-1 py-0.5 rounded shrink-0 border border-border">
                  {activeNode.holding.assetType === 'stock' ? 'Hisse' : 'Fon'}
                </span>
              </div>
              <div className="text-[10px] sm:text-[11px] text-text-muted flex items-center gap-1.5 tabular-nums truncate mt-0.5">
                <span>{formatCurrency(activeNode.holding.currentValue)}</span>
                <span>•</span>
                <span className="text-accent font-semibold">%{activeNode.weightPercent.toFixed(1)} Pay</span>
              </div>
            </div>
          </div>

          {/* Right: Return & Direct Link Button */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="text-right">
              <div
                className={`text-xs sm:text-sm font-black tabular-nums ${
                  activeNode.metricValue >= 0 ? 'text-emerald-500' : 'text-rose-500'
                }`}
              >
                {getPnLSign(activeNode.metricValue)}%{Math.abs(activeNode.metricValue).toFixed(2)}
              </div>
              <div className="text-[9px] sm:text-[10px] text-text-muted">
                {metric === 'daily' ? 'Günlük' : 'Toplam'}
              </div>
            </div>

            <Link
              href={
                activeNode.holding.assetType === 'stock'
                  ? `/stocks/${activeNode.holding.symbol}`
                  : `/funds/${activeNode.holding.symbol}`
              }
              className="px-2.5 py-1.5 rounded-lg bg-accent text-white hover:opacity-90 active:scale-95 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-sm"
            >
              <span className="text-[11px]">İncele</span>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </Link>
          </div>
        </div>
      )}

      {/* Slim Legend Bar */}
      <div className="flex items-center justify-between gap-2 mt-2.5 pt-2.5 border-t border-border/60 text-[10px] sm:text-xs text-text-muted">
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-text-secondary">Skala:</span>
          <span className="text-rose-500 font-bold">-%5+</span>
          <div className="h-1.5 sm:h-2 w-20 sm:w-32 rounded-full bg-gradient-to-r from-rose-600 via-rose-950 via-slate-800 via-emerald-950 to-emerald-500 border border-border" />
          <span className="text-emerald-500 font-bold">+%5+</span>
        </div>
        <span className="text-text-muted text-[10px]">
          Kutuya dokunarak inceleyin
        </span>
      </div>
    </div>
  );
}
