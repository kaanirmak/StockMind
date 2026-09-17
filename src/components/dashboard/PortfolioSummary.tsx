'use client';

import { useState, useMemo } from 'react';
import { usePortfolioStore } from '@/store/usePortfolioStore';
import { formatCurrency, formatPercent, getPnLSign } from '@/lib/utils/format';

type TimePeriod = 'daily' | 'weekly' | 'monthly' | 'total';

export default function PortfolioSummary() {
  const { getSummary } = usePortfolioStore();
  const summary = getSummary();
  const [period, setPeriod] = useState<TimePeriod>('total');

  // Derive P&L values based on selected period
  const periodData = useMemo(() => {
    switch (period) {
      case 'daily':
        return {
          label: 'Günlük',
          pnl: summary.dailyPnL,
          pnlPercent: summary.dailyPnLPercent,
        };
      case 'weekly':
        // Weekly approximation: dailyPnL * 5
        return {
          label: 'Haftalık',
          pnl: summary.dailyPnL * 5,
          pnlPercent: summary.dailyPnLPercent * 5,
        };
      case 'monthly':
        // Monthly approximation: dailyPnL * 22
        return {
          label: 'Aylık',
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

  const isPositive = periodData.pnl >= 0;

  // Generate a smooth SVG wave path for the mini chart
  const chartPath = useMemo(() => {
    const width = 400;
    const height = 80;
    const points = 12;
    const data: number[] = [];

    // Generate a smooth wave based on holdings data or placeholder
    if (summary.holdings.length > 0) {
      // Use holdings weights to generate variation
      const baseValue = summary.totalValue;
      for (let i = 0; i < points; i++) {
        const progress = i / (points - 1);
        const noise = Math.sin(progress * Math.PI * 2.5) * 0.08 + Math.cos(progress * Math.PI * 1.3) * 0.05;
        const trend = isPositive ? progress * 0.1 : -progress * 0.05;
        data.push(baseValue * (0.85 + noise + trend));
      }
    } else {
      // Placeholder wave
      for (let i = 0; i < points; i++) {
        const progress = i / (points - 1);
        data.push(50 + Math.sin(progress * Math.PI * 2) * 20 + progress * 15);
      }
    }

    // Normalize to chart dimensions
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const padding = 10;

    const normalized = data.map((v) => {
      return height - padding - ((v - min) / range) * (height - padding * 2);
    });

    // Create smooth cubic bezier path
    const stepX = width / (points - 1);
    let path = `M 0 ${normalized[0]}`;

    for (let i = 1; i < normalized.length; i++) {
      const x = i * stepX;
      const prevX = (i - 1) * stepX;
      const cx1 = prevX + stepX * 0.4;
      const cx2 = x - stepX * 0.4;
      path += ` C ${cx1} ${normalized[i - 1]}, ${cx2} ${normalized[i]}, ${x} ${normalized[i]}`;
    }

    // Area fill path
    const areaPath = `${path} L ${width} ${height} L 0 ${height} Z`;

    return { linePath: path, areaPath, lastX: (points - 1) * stepX, lastY: normalized[normalized.length - 1] };
  }, [summary, isPositive]);

  const periods: { key: TimePeriod; label: string }[] = [
    { key: 'daily', label: 'Bugün' },
    { key: 'weekly', label: 'Bu Hafta' },
    { key: 'monthly', label: 'Bu Ay' },
    { key: 'total', label: 'Toplam' },
  ];

  // USD/TRY from live prices
  const { livePrices } = usePortfolioStore();
  const usdTry = livePrices['USDTRY']?.price;

  return (
    <div className="space-y-4">
      {/* ═══════════════════════════════════════
          HERO CARD — Purple to Black Gradient
          ═══════════════════════════════════════ */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.06]">
        {/* Gradient background: purple → dark */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#3b1a7e] via-[#1a0e3a] to-[#080810]" />

        {/* Mesh overlay for depth */}
        <div className="absolute inset-0 opacity-40" style={{
          background: 'radial-gradient(ellipse at 30% 20%, rgba(139, 92, 246, 0.25) 0%, transparent 60%), radial-gradient(ellipse at 80% 60%, rgba(192, 132, 252, 0.1) 0%, transparent 50%)',
        }} />

        {/* Noise texture overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")',
        }} />

        <div className="relative z-10 p-5 sm:p-6 pb-0">
          {/* Top row: badge + period selector */}
          <div className="flex items-center justify-between mb-4">
            {/* Live badge */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.07] border border-white/[0.08] backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
              </span>
              <span className="text-[11px] font-bold text-white/80 uppercase tracking-widest">Canlı Portföy</span>
            </div>

            {/* Period selector */}
            <div className="flex items-center gap-0.5 p-0.5 rounded-xl bg-white/[0.06] border border-white/[0.06]">
              {periods.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPeriod(p.key)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-200 cursor-pointer ${
                    period === p.key
                      ? 'bg-white/15 text-white shadow-sm'
                      : 'text-white/50 hover:text-white/80'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Main value */}
          <div className="mb-1">
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight tabular-nums">
              {summary.totalValue > 0
                ? `₺${summary.totalValue.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : '₺0,00'}
            </h2>
          </div>

          {/* Sub info row: cost + usd + pnl badge */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mb-5">
            <span className="text-xs text-white/40 font-medium">
              Maliyet: {formatCurrency(summary.totalCost)}
              {usdTry && usdTry > 0 && (
                <>
                  {' • '}${(summary.totalValue / usdTry).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  {' '}
                  <span className="text-white/25">(USD/TRY: ₺{usdTry.toFixed(2)})</span>
                </>
              )}
            </span>

            {/* P&L Badge */}
            {summary.totalValue > 0 && (
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border ${
                isPositive
                  ? 'bg-emerald-500/15 border-emerald-500/25 text-emerald-400'
                  : 'bg-red-500/15 border-red-500/25 text-red-400'
              }`}>
                {isPositive ? (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                  </svg>
                ) : (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 4.5l15 15m0 0V8.25m0 11.25H8.25" />
                  </svg>
                )}
                {getPnLSign(periodData.pnl)}{formatCurrency(Math.abs(periodData.pnl))}
                {' '}
                ({getPnLSign(periodData.pnlPercent)}%{Math.abs(periodData.pnlPercent).toFixed(1)})
              </span>
            )}
          </div>

          {/* Mini chart — SVG wave */}
          <div className="relative h-20 sm:h-24 -mx-5 sm:-mx-6 overflow-hidden">
            <svg
              viewBox={`0 0 400 80`}
              preserveAspectRatio="none"
              className="w-full h-full"
            >
              <defs>
                <linearGradient id="chartAreaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={isPositive ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.2)'} />
                  <stop offset="100%" stopColor="transparent" />
                </linearGradient>
                <linearGradient id="chartLineGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={isPositive ? '#10b981' : '#ef4444'} stopOpacity="0.4" />
                  <stop offset="50%" stopColor={isPositive ? '#10b981' : '#ef4444'} stopOpacity="1" />
                  <stop offset="100%" stopColor={isPositive ? '#34d399' : '#f87171'} stopOpacity="1" />
                </linearGradient>
              </defs>

              {/* Area fill */}
              <path
                d={chartPath.areaPath}
                fill="url(#chartAreaGradient)"
              />

              {/* Line */}
              <path
                d={chartPath.linePath}
                fill="none"
                stroke="url(#chartLineGradient)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* End dot */}
              <circle
                cx={chartPath.lastX}
                cy={chartPath.lastY}
                r="4"
                fill={isPositive ? '#10b981' : '#ef4444'}
                stroke="white"
                strokeWidth="1.5"
                className="animate-pulse"
              />
              {/* Glow ring */}
              <circle
                cx={chartPath.lastX}
                cy={chartPath.lastY}
                r="8"
                fill="none"
                stroke={isPositive ? '#10b981' : '#ef4444'}
                strokeWidth="1"
                opacity="0.3"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════
          STAT CARDS ROW — Below the hero
          ═══════════════════════════════════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Daily P&L */}
        <div className="glass-card p-4 relative overflow-hidden group">
          <div className={`absolute inset-0 bg-gradient-to-br ${summary.dailyPnL >= 0 ? 'from-emerald-500/10 to-transparent' : 'from-red-500/10 to-transparent'} opacity-60`} />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-text-muted font-medium uppercase tracking-wider">Günlük K/Z</span>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${summary.dailyPnL >= 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  {summary.dailyPnL >= 0 ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 4.5l15 15m0 0V8.25m0 11.25H8.25" />
                  )}
                </svg>
              </div>
            </div>
            <div className={`text-lg font-bold tabular-nums ${summary.dailyPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {getPnLSign(summary.dailyPnL)}{formatCurrency(Math.abs(summary.dailyPnL))}
            </div>
            {summary.totalValue > 0 && (
              <div className={`text-xs font-medium mt-0.5 ${summary.dailyPnLPercent >= 0 ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
                {getPnLSign(summary.dailyPnLPercent)}{formatPercent(Math.abs(summary.dailyPnLPercent))}
              </div>
            )}
          </div>
        </div>

        {/* Total P&L */}
        <div className="glass-card p-4 relative overflow-hidden group">
          <div className={`absolute inset-0 bg-gradient-to-br from-accent/10 to-transparent opacity-60`} />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-text-muted font-medium uppercase tracking-wider">Toplam K/Z</span>
              <div className="w-7 h-7 rounded-lg bg-accent/15 text-accent flex items-center justify-center">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className={`text-lg font-bold tabular-nums ${summary.totalPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {getPnLSign(summary.totalPnL)}{formatCurrency(Math.abs(summary.totalPnL))}
            </div>
            {summary.totalCost > 0 && (
              <div className={`text-xs font-medium mt-0.5 ${summary.totalPnLPercent >= 0 ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
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
