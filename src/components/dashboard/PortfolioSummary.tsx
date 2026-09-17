'use client';

import { useState, useMemo, useRef, useCallback } from 'react';
import { usePortfolioStore } from '@/store/usePortfolioStore';
import { formatCurrency, formatPercent, getPnLSign } from '@/lib/utils/format';
import { calculatePortfolioHistory, HistoryPoint, TimePeriod } from '@/lib/portfolio/history';

export default function PortfolioSummary() {
  const { getSummary, transactions, livePrices } = usePortfolioStore();
  const summary = getSummary();
  const [period, setPeriod] = useState<TimePeriod>('total');
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  const usdQuote = livePrices['USDTRY'] || livePrices['USD'];
  const usdTry = typeof usdQuote === 'number' ? usdQuote : (usdQuote && typeof usdQuote === 'object' ? usdQuote.price : 38.5);

  // Period P&L fallback
  const periodData = useMemo(() => {
    switch (period) {
      case 'daily':
        return {
          label: 'Bugün',
          pnl: summary.dailyPnL,
          pnlPercent: summary.dailyPnLPercent,
        };
      case 'weekly':
        return {
          label: 'Bu Hafta',
          pnl: summary.dailyPnL * 5,
          pnlPercent: summary.dailyPnLPercent * 5,
        };
      case 'monthly':
        return {
          label: 'Bu Ay',
          pnl: summary.dailyPnL * 22,
          pnlPercent: summary.dailyPnLPercent * 22,
        };
      case 'total':
      default:
        return {
          label: 'Toplam',
          pnl: summary.totalPnL,
          pnlPercent: summary.totalPnLPercent,
        };
    }
  }, [period, summary]);

  // Calculate real historical timeline from transactions
  const historyPoints = useMemo(() => {
    return calculatePortfolioHistory(transactions, summary, period, livePrices);
  }, [transactions, summary, period, livePrices]);

  // Chart SVG geometry
  const chartWidth = 500;
  const chartHeight = 90;
  const paddingX = 14;
  const paddingTop = 14;
  const paddingBottom = 16;

  const chartData = useMemo(() => {
    if (historyPoints.length === 0) {
      const midY = chartHeight / 2;
      return {
        linePath: `M 0 ${midY} L ${chartWidth} ${midY}`,
        areaPath: `M 0 ${midY} L ${chartWidth} ${midY} L ${chartWidth} ${chartHeight} L 0 ${chartHeight} Z`,
        pointsCoords: [],
        lastCoords: { x: chartWidth - paddingX, y: midY },
      };
    }

    const values = historyPoints.map((p) => p.value);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const range = maxVal - minVal || (maxVal > 0 ? maxVal * 0.1 : 1);

    const stepX = (chartWidth - 2 * paddingX) / (historyPoints.length - 1 || 1);
    const coords = historyPoints.map((p, i) => {
      const x = paddingX + i * stepX;
      const normalizedY = (p.value - minVal) / range;
      const y = chartHeight - paddingBottom - normalizedY * (chartHeight - paddingTop - paddingBottom);
      return { x, y, point: p };
    });

    // Build smooth cubic bezier curve
    let linePath = `M ${coords[0].x} ${coords[0].y}`;
    for (let i = 1; i < coords.length; i++) {
      const prev = coords[i - 1];
      const curr = coords[i];
      const dx = curr.x - prev.x;
      const cx1 = prev.x + dx * 0.45;
      const cy1 = prev.y;
      const cx2 = curr.x - dx * 0.45;
      const cy2 = curr.y;
      linePath += ` C ${cx1} ${cy1}, ${cx2} ${cy2}, ${curr.x} ${curr.y}`;
    }

    const last = coords[coords.length - 1];
    const first = coords[0];
    const areaPath = `${linePath} L ${last.x} ${chartHeight} L ${first.x} ${chartHeight} Z`;

    return {
      linePath,
      areaPath,
      pointsCoords: coords,
      lastCoords: last,
    };
  }, [historyPoints]);

  // Pointer scrubber handlers
  const handlePointer = useCallback((clientX: number) => {
    if (!chartContainerRef.current || chartData.pointsCoords.length === 0) return;
    const rect = chartContainerRef.current.getBoundingClientRect();
    const relativeX = (clientX - rect.left) / rect.width;
    const clampedX = Math.max(0, Math.min(1, relativeX));
    const targetSvgX = clampedX * chartWidth;

    // Find closest coordinate point
    let closestIndex = 0;
    let minDistance = Infinity;
    chartData.pointsCoords.forEach((c, idx) => {
      const dist = Math.abs(c.x - targetSvgX);
      if (dist < minDistance) {
        minDistance = dist;
        closestIndex = idx;
      }
    });

    setHoverIndex(closestIndex);
  }, [chartData.pointsCoords]);

  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    handlePointer(e.clientX);
  };

  const onTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches[0]) {
      handlePointer(e.touches[0].clientX);
    }
  };

  const onPointerLeave = () => {
    setHoverIndex(null);
  };

  // Active hover point or current live state
  const hoveredPoint = hoverIndex !== null ? historyPoints[hoverIndex] : null;
  const activeCoord = hoverIndex !== null && chartData.pointsCoords[hoverIndex]
    ? chartData.pointsCoords[hoverIndex]
    : null;

  const displayValue = hoveredPoint ? hoveredPoint.value : summary.totalValue;
  const displayPnL = hoveredPoint ? hoveredPoint.pnl : periodData.pnl;
  const displayPnLPercent = hoveredPoint ? hoveredPoint.pnlPercent : periodData.pnlPercent;
  const isPositive = displayPnL >= 0;

  const periods: { key: TimePeriod; label: string }[] = [
    { key: 'daily', label: 'Bugün' },
    { key: 'weekly', label: 'Bu Hafta' },
    { key: 'monthly', label: 'Bu Ay' },
    { key: 'total', label: 'Toplam' },
  ];

  return (
    <div className="space-y-4">
      {/* ═══════════════════════════════════════════════════════
          HERO CARD — Premium Purple to Black Gradient
          ═══════════════════════════════════════════════════════ */}
      <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] shadow-[0_12px_40px_rgba(0,0,0,0.5)]">
        {/* Background gradient: vivid purple to deep obsidian */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#35186f] via-[#160c2e] to-[#08060f]" />

        {/* Ambient radial glows */}
        <div
          className="absolute inset-0 pointer-events-none opacity-50"
          style={{
            background:
              'radial-gradient(ellipse at 25% 15%, rgba(168, 85, 247, 0.35) 0%, transparent 60%), radial-gradient(ellipse at 85% 70%, rgba(139, 92, 246, 0.15) 0%, transparent 50%)',
          }}
        />

        {/* Subtle glass texture overlay */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.025]"
          style={{
            backgroundImage:
              'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")',
          }}
        />

        <div className="relative z-10 p-5 sm:p-7 pb-0">
          {/* Top row: Brand Logo + Period Selector */}
          <div className="flex items-center justify-between gap-3 mb-4">
            {/* StockMind Logo on dark background */}
            <div className="flex items-center gap-2.5">
              <img
                src="/logo-white.png"
                alt="StockMind"
                className="h-8 sm:h-9 w-auto object-contain drop-shadow-[0_0_14px_rgba(168,85,247,0.45)]"
              />
              <span className="relative flex h-2 w-2 ml-0.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
              </span>
            </div>

            {/* Period selector pills */}
            <div className="flex items-center gap-0.5 p-1 rounded-2xl bg-white/[0.07] border border-white/[0.08] backdrop-blur-md">
              {periods.map((p) => (
                <button
                  key={p.key}
                  onClick={() => {
                    setPeriod(p.key);
                    setHoverIndex(null);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
                    period === p.key
                      ? 'bg-white/20 text-white shadow-[0_2px_8px_rgba(0,0,0,0.25)] border border-white/10'
                      : 'text-white/50 hover:text-white/80 hover:bg-white/5'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Middle Row: Main Portfolio Value + Sub info on Left, P&L Badge on Right */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
            <div>
              <h2 className="text-3xl sm:text-4xl lg:text-[42px] font-black text-white tracking-tight tabular-nums leading-none">
                {displayValue > 0
                  ? `₺${displayValue.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : '₺0,00'}
              </h2>

              {/* Sub-info: Cost, USD equivalent, and Date marker */}
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-white/50 font-medium mt-2">
                <span>Maliyet: {formatCurrency(summary.totalCost)}</span>
                {usdTry && usdTry > 0 && (
                  <>
                    <span>•</span>
                    <span>
                      ${(displayValue / usdTry).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      {' '}
                      <span className="text-white/30">(USD/TRY: ₺{usdTry.toFixed(2)})</span>
                    </span>
                  </>
                )}
                {hoveredPoint && (
                  <>
                    <span>•</span>
                    <span className="text-violet-300 font-semibold bg-violet-500/20 px-2 py-0.5 rounded-md border border-violet-500/30 animate-fade-in">
                      {hoveredPoint.dateLabel}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* P&L Badge (Right Aligned as in user sketch) */}
            {summary.totalValue > 0 && (
              <div className="self-start sm:self-center">
                <div
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs sm:text-sm font-bold border backdrop-blur-md transition-all duration-200 shadow-sm ${
                    isPositive
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                      : 'bg-rose-500/15 border-rose-500/30 text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.15)]'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    {isPositive ? (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 4.5l15 15m0 0V8.25m0 11.25H8.25" />
                    )}
                  </svg>
                  <span>{getPnLSign(displayPnL)}{formatCurrency(Math.abs(displayPnL))}</span>
                  <span className="opacity-90">({getPnLSign(displayPnLPercent)}%{Math.abs(displayPnLPercent).toFixed(1)})</span>
                </div>
              </div>
            )}
          </div>

          {/* ═══════════════════════════════════════════════════════
              INTERACTIVE REAL CHART with Scrubber
              ═══════════════════════════════════════════════════════ */}
          <div
            ref={chartContainerRef}
            onMouseMove={onMouseMove}
            onMouseLeave={onPointerLeave}
            onTouchMove={onTouchMove}
            onTouchEnd={onPointerLeave}
            className="relative h-24 sm:h-28 -mx-5 sm:-mx-7 cursor-crosshair select-none touch-none"
          >
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              preserveAspectRatio="none"
              className="w-full h-full overflow-visible"
            >
              <defs>
                {/* Smooth area fill gradient */}
                <linearGradient id="heroChartArea" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor={isPositive ? 'rgba(52, 211, 153, 0.3)' : 'rgba(244, 63, 94, 0.25)'}
                  />
                  <stop
                    offset="50%"
                    stopColor="rgba(168, 85, 247, 0.15)"
                  />
                  <stop offset="100%" stopColor="rgba(8, 6, 15, 0)" />
                </linearGradient>

                {/* Vibrant stroke gradient */}
                <linearGradient id="heroChartLine" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#c084fc" stopOpacity="0.8" />
                  <stop offset="70%" stopColor={isPositive ? '#34d399' : '#fb7185'} stopOpacity="1" />
                  <stop offset="100%" stopColor="#ffffff" stopOpacity="1" />
                </linearGradient>
              </defs>

              {/* Area fill under the curve */}
              <path d={chartData.areaPath} fill="url(#heroChartArea)" />

              {/* Curve line */}
              <path
                d={chartData.linePath}
                fill="none"
                stroke="url(#heroChartLine)"
                strokeWidth="2.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Interactive Scrubber: Vertical Dotted Line */}
              {activeCoord && (
                <line
                  x1={activeCoord.x}
                  y1={activeCoord.y}
                  x2={activeCoord.x}
                  y2={chartHeight}
                  stroke="rgba(255, 255, 255, 0.45)"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                />
              )}

              {/* Interactive Scrubber: Circular Node on Curve */}
              {activeCoord ? (
                <g>
                  {/* Outer glow ring */}
                  <circle
                    cx={activeCoord.x}
                    cy={activeCoord.y}
                    r="8"
                    fill="none"
                    stroke={isPositive ? '#34d399' : '#fb7185'}
                    strokeWidth="1.75"
                    opacity="0.85"
                  />
                  {/* White circle ring */}
                  <circle
                    cx={activeCoord.x}
                    cy={activeCoord.y}
                    r="5"
                    fill="#ffffff"
                    stroke="rgba(0,0,0,0.3)"
                    strokeWidth="1"
                  />
                  {/* Inner node dot */}
                  <circle
                    cx={activeCoord.x}
                    cy={activeCoord.y}
                    r="2.5"
                    fill={isPositive ? '#059669' : '#e11d48'}
                  />
                </g>
              ) : (
                /* Default end point marker when not hovering */
                <g>
                  <circle
                    cx={chartData.lastCoords.x}
                    cy={chartData.lastCoords.y}
                    r="4"
                    fill={isPositive ? '#34d399' : '#fb7185'}
                    stroke="#ffffff"
                    strokeWidth="1.75"
                  />
                  <circle
                    cx={chartData.lastCoords.x}
                    cy={chartData.lastCoords.y}
                    r="9"
                    fill="none"
                    stroke={isPositive ? '#34d399' : '#fb7185'}
                    strokeWidth="1.25"
                    opacity="0.4"
                    className="animate-pulse"
                  />
                </g>
              )}
            </svg>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          STAT CARDS ROW — Below the hero
          ═══════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Daily P&L */}
        <div className="glass-card p-4 relative overflow-hidden group">
          <div className={`absolute inset-0 bg-gradient-to-br ${summary.dailyPnL >= 0 ? 'from-emerald-500/10 to-transparent' : 'from-rose-500/10 to-transparent'} opacity-60`} />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-text-muted font-medium uppercase tracking-wider">Günlük K/Z</span>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${summary.dailyPnL >= 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}`}>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  {summary.dailyPnL >= 0 ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 4.5l15 15m0 0V8.25m0 11.25H8.25" />
                  )}
                </svg>
              </div>
            </div>
            <div className={`text-lg font-bold tabular-nums ${summary.dailyPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {getPnLSign(summary.dailyPnL)}{formatCurrency(Math.abs(summary.dailyPnL))}
            </div>
            {summary.totalValue > 0 && (
              <div className={`text-xs font-medium mt-0.5 ${summary.dailyPnLPercent >= 0 ? 'text-emerald-400/70' : 'text-rose-400/70'}`}>
                {getPnLSign(summary.dailyPnLPercent)}{formatPercent(Math.abs(summary.dailyPnLPercent))}
              </div>
            )}
          </div>
        </div>

        {/* Total P&L */}
        <div className="glass-card p-4 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-accent/10 to-transparent opacity-60" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-text-muted font-medium uppercase tracking-wider">Toplam K/Z</span>
              <div className="w-7 h-7 rounded-lg bg-accent/15 text-accent flex items-center justify-center">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className={`text-lg font-bold tabular-nums ${summary.totalPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {getPnLSign(summary.totalPnL)}{formatCurrency(Math.abs(summary.totalPnL))}
            </div>
            {summary.totalCost > 0 && (
              <div className={`text-xs font-medium mt-0.5 ${summary.totalPnLPercent >= 0 ? 'text-emerald-400/70' : 'text-rose-400/70'}`}>
                {getPnLSign(summary.totalPnLPercent)}{formatPercent(Math.abs(summary.totalPnLPercent))}
              </div>
            )}
          </div>
        </div>

        {/* Total Investment */}
        <div className="glass-card p-4 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-accent-secondary/10 to-transparent opacity-60" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-text-muted font-medium uppercase tracking-wider">Yatırım</span>
              <div className="w-7 h-7 rounded-lg bg-accent-secondary/15 text-accent-secondary flex items-center justify-center">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
                </svg>
              </div>
            </div>
            <div className="text-lg font-bold text-text-primary tabular-nums">
              {formatCurrency(summary.totalCost)}
            </div>
            <div className="text-xs text-text-muted mt-0.5">
              {summary.holdings.length === 0 ? 'Varlık eklenmedi' : `${summary.holdings.length} varlık`}
            </div>
          </div>
        </div>

        {/* Holdings count + volume */}
        <div className="glass-card p-4 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-info/10 to-transparent opacity-60" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-text-muted font-medium uppercase tracking-wider">Hacim</span>
              <div className="w-7 h-7 rounded-lg bg-info/15 text-info flex items-center justify-center">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                </svg>
              </div>
            </div>
            <div className="text-lg font-bold text-text-primary tabular-nums">
              {formatCurrency(summary.totalVolume || summary.buyVolume + summary.sellVolume)}
            </div>
            <div className="text-xs text-text-muted mt-0.5">
              Alış: {formatCurrency(summary.buyVolume)} • Satış: {formatCurrency(summary.sellVolume)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
